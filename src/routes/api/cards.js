const { createHash } = require("node:crypto");

const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { detectDevice } = require("../../services/ua");
const { generateVCard } = require("../../services/vcard");
const { calculateSlugPrice } = require("../../services/slug-pricing");
const { sendOrderRequestToTelegram, TelegramConfigError, TelegramDeliveryError } = require("../../services/telegram");
const { getActiveFlashSale, applyFlashSaleToPrice } = require("../../services/flash-sales");
const { markDropSlugSold } = require("../../services/drops");
const { asyncHandler } = require("../../middleware/async");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { publicOrderRateLimit } = require("../../middleware/rate-limit");
const { getUserSession } = require("../../middleware/auth");
const { OrderRequestSchema } = require("../../validation/order-request");

const router = express.Router();
const SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;
const TARIFF_MONTHLY = {
  basic: 29_000,
  premium: 79_000,
};
const BRACELET_PRICE = 300_000;
const THEMES = new Set(["default_dark", "light_minimal", "gradient", "neon", "corporate"]);

function isMissingModelTable(error, modelName) {
  return (
    Boolean(error) &&
    error.code === "P2021" &&
    (!modelName || String(error?.meta?.modelName || "") === modelName)
  );
}

function isMissingModelColumn(error, modelName) {
  if (!error || error.code !== "P2022") {
    return false;
  }

  if (!modelName) {
    return true;
  }

  const targetModel = String(error?.meta?.modelName || "");
  if (!targetModel) {
    return true;
  }

  return targetModel === modelName;
}

function getModelDelegate(modelName) {
  if (!modelName || typeof modelName !== "string") {
    return null;
  }
  const key = `${modelName.slice(0, 1).toLowerCase()}${modelName.slice(1)}`;
  const delegate = prisma[key];
  return delegate && typeof delegate === "object" ? delegate : null;
}

function isMissingModelDelegateError(error) {
  if (!error || error.name !== "TypeError") {
    return false;
  }
  const message = String(error.message || "");
  return (
    message.includes("Cannot read properties of undefined") &&
    (message.includes("findMany") || message.includes("findUnique") || message.includes("count") || message.includes("upsert"))
  );
}

async function withMissingTableFallback(modelName, fallbackValue, callback) {
  if (!getModelDelegate(modelName)) {
    return fallbackValue;
  }
  try {
    return await callback();
  } catch (error) {
    if (isMissingModelTable(error, modelName) || isMissingModelColumn(error, modelName) || isMissingModelDelegateError(error)) {
      return fallbackValue;
    }
    throw error;
  }
}

function toOrderStatusLabel(status) {
  switch (status) {
    case "NEW":
      return "🆕 Новая";
    case "CONTACTED":
      return "💬 Связались";
    case "PAID":
      return "💳 Оплачено";
    case "ACTIVATED":
      return "✅ Активировано";
    case "REJECTED":
      return "❌ Отклонено";
    default:
      return status;
  }
}

function normalizeIp(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const raw = value.trim().toLowerCase();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }

  if (raw === "::1") {
    return "127.0.0.1";
  }

  return raw;
}

function pickClientIdentity(req) {
  const forwardedFor = req.get("x-forwarded-for");
  const realIp = req.get("x-real-ip");

  const forwardedIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const directIp = normalizeIp(forwardedIp) || normalizeIp(realIp) || normalizeIp(req.ip);

  if (directIp) {
    return `ip:${directIp}`;
  }

  const userAgent = (req.get("user-agent") || "").trim();
  const acceptLanguage = (req.get("accept-language") || "").trim();

  if (!userAgent && !acceptLanguage) {
    return null;
  }

  return `fp:${userAgent}|${acceptLanguage}`;
}

function formatPrice(value) {
  return Number(value).toLocaleString("ru-RU").replace(/,/g, " ");
}

function mapOrderValidationIssues(error) {
  const issues = {};

  for (const issue of error.issues || []) {
    const field = issue.path && issue.path[0];

    if (field === "name") {
      issues.name = issue.message || "Имя обязательно";
      continue;
    }

    if (field === "letters" || field === "digits") {
      issues.slug = "UNQ должен быть в формате AAA000";
      continue;
    }

  }

  return issues;
}

function splitSlug(slug) {
  if (!SLUG_REGEX.test(slug)) {
    return null;
  }
  return {
    letters: slug.slice(0, 3),
    digits: slug.slice(3),
  };
}

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeTheme(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  return THEMES.has(value) ? value : undefined;
}

async function getSlugState(slug) {
  const [card, record, slugRow] = await Promise.all([
    prisma.card.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isActive: true,
      },
    }),
    withMissingTableFallback("SlugRecord", null, () =>
      prisma.slugRecord.findUnique({
        where: { slug },
        select: { state: true, priceOverride: true },
      }),
    ),
    withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: slug },
        select: {
          status: true,
          price: true,
          pendingExpiresAt: true,
          owner: {
            select: {
              firstName: true,
              photoUrl: true,
              profileCard: {
                select: {
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
    ),
  ]);

  const ownerFromSlug =
    slugRow?.owner && ["approved", "active", "private", "paused"].includes(slugRow.status)
      ? {
          name: slugRow.owner.profileCard?.name || slugRow.owner.firstName || "UNQ+ User",
          photoUrl: slugRow.owner.profileCard?.avatarUrl || slugRow.owner.photoUrl || null,
          href: `/${slug}`,
        }
      : null;

  const ownerFromCard =
    card && card.isActive
      ? {
          name: card.name || "UNQ+ User",
          photoUrl: card.avatarUrl || null,
          href: `/${slug}`,
        }
      : null;

  if (slugRow) {
    if (slugRow.status === "reserved_drop") {
      return { available: false, reason: "drop_reserved", priceOverride: slugRow.price ?? null };
    }
    if (slugRow.status === "blocked") {
      return { available: false, reason: "blocked", priceOverride: slugRow.price ?? null };
    }
    if (slugRow.status === "free") {
      return { available: true, reason: "available", priceOverride: slugRow.price ?? null };
    }
    return {
      available: false,
      reason: slugRow.status,
      priceOverride: slugRow.price ?? null,
      pendingExpiresAt: slugRow.pendingExpiresAt || null,
      owner: ownerFromSlug,
    };
  }

  if (record?.state === "BLOCKED") {
    return { available: false, reason: "blocked", priceOverride: record.priceOverride };
  }

  if (card || record?.state === "TAKEN") {
    return {
      available: false,
      reason: "taken",
      priceOverride: record?.priceOverride ?? null,
      owner: ownerFromCard,
    };
  }

  return { available: true, reason: "available", priceOverride: record?.priceOverride ?? null };
}

async function getTakenSlugsSet() {
  const [cardRows, recordRows, slugRows] = await Promise.all([
    prisma.card.findMany({
      select: { slug: true },
    }),
    withMissingTableFallback("SlugRecord", [], () =>
      prisma.slugRecord.findMany({
        where: { state: { in: ["TAKEN", "BLOCKED"] } },
        select: { slug: true },
      }),
    ),
    withMissingTableFallback("Slug", [], () =>
      prisma.slug.findMany({
        where: { status: { not: "free" } },
        select: { fullSlug: true },
      }),
    ),
  ]);

  const taken = new Set();
  for (const row of cardRows) {
    taken.add(row.slug);
  }
  for (const row of recordRows) {
    taken.add(row.slug);
  }
  for (const row of slugRows) {
    taken.add(row.fullSlug);
  }
  return taken;
}

function mutateSlugCandidates(slug) {
  if (!SLUG_REGEX.test(slug)) {
    return [];
  }

  const letters = slug.slice(0, 3).split("");
  const digits = Number.parseInt(slug.slice(3), 10);
  const out = new Set();

  out.add(`${letters.join("")}${String((digits + 1) % 1000).padStart(3, "0")}`);
  out.add(`${letters.join("")}${String((digits + 10) % 1000).padStart(3, "0")}`);
  out.add(`${letters.join("")}${String((digits + 100) % 1000).padStart(3, "0")}`);

  for (let i = 0; i < 3; i += 1) {
    const code = letters[i].charCodeAt(0);
    if (code < 90) {
      const next = [...letters];
      next[i] = String.fromCharCode(code + 1);
      out.add(`${next.join("")}${slug.slice(3)}`);
    }
    if (code > 65) {
      const prev = [...letters];
      prev[i] = String.fromCharCode(code - 1);
      out.add(`${prev.join("")}${slug.slice(3)}`);
    }
  }

  return Array.from(out).filter((item) => item !== slug && SLUG_REGEX.test(item));
}

function randomSlug() {
  const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
  const digits = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${letters}${digits}`;
}

async function generateAvailableSuggestions({ count, base }) {
  const target = Math.max(1, Math.min(10, Number(count) || 5));
  const taken = await getTakenSlugsSet();
  const out = [];
  const seen = new Set();

  if (base && SLUG_REGEX.test(base)) {
    for (const candidate of mutateSlugCandidates(base)) {
      if (out.length >= target) {
        break;
      }
      if (seen.has(candidate) || taken.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      out.push(candidate);
    }
  }

  let guard = 0;
  while (out.length < target && guard < 2000) {
    guard += 1;
    const candidate = randomSlug();
    if (seen.has(candidate) || taken.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    out.push(candidate);
  }

  return out.slice(0, target);
}

async function logChecker({ slug, pattern, source, result }) {
  try {
    if (source !== "hero") {
      return;
    }
    await prisma.slugCheckerLog.create({
      data: {
        slug: slug || null,
        pattern: (pattern || "").slice(0, 20) || "unknown",
        source: "hero",
        result,
      },
    });
  } catch (error) {
    console.error("[express-app] failed to write slug checker log", error);
  }
}

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.q === "string" ? req.query.q : "";
    const query = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    if (!query) {
      res.json({ items: [] });
      return;
    }

    const [legacyItems, newItems] = await Promise.all([
      prisma.card.findMany({
        where: {
          isActive: true,
          slug: {
            startsWith: query,
            mode: "insensitive",
          },
        },
        select: {
          slug: true,
          name: true,
        },
        orderBy: {
          slug: "asc",
        },
        take: 8,
      }),
      withMissingTableFallback("Slug", [], () =>
        prisma.slug.findMany({
          where: {
            status: { in: ["active", "private"] },
            fullSlug: {
              startsWith: query,
              mode: "insensitive",
            },
          },
          select: {
            fullSlug: true,
            owner: {
              select: {
                firstName: true,
                profileCard: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            fullSlug: "asc",
          },
          take: 8,
        }),
      ),
    ]);

    const itemsMap = new Map();
    for (const row of legacyItems) {
      itemsMap.set(row.slug, {
        slug: row.slug,
        name: row.name,
      });
    }
    for (const row of newItems) {
      itemsMap.set(row.fullSlug, {
        slug: row.fullSlug,
        name: row.owner?.profileCard?.name || row.owner?.firstName || "UNQ+ User",
      });
    }

    const items = Array.from(itemsMap.values())
      .sort((a, b) => (a.slug > b.slug ? 1 : -1))
      .slice(0, 8);

    res.json({ items });
  }),
);

router.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const source = typeof req.query.source === "string" ? req.query.source.slice(0, 20).toLowerCase() : "unknown";
    const slug = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const validFormat = SLUG_REGEX.test(slug);

    if (!validFormat) {
      await logChecker({
        slug,
        pattern: slug || "invalid",
        source,
        result: "INVALID",
      });

      res.json({
        slug,
        validFormat: false,
        available: false,
        reason: "invalid_format",
        suggestions: [],
      });
      return;
    }

    const state = await getSlugState(slug);
    let suggestions = [];
    if (!state.available) {
      suggestions = await generateAvailableSuggestions({ count: 3, base: slug });
    }

    await logChecker({
      slug,
      pattern: slug,
      source,
      result: state.reason === "blocked" ? "BLOCKED" : state.available ? "AVAILABLE" : "TAKEN",
    });

    res.json({
      slug,
      validFormat: true,
      available: state.available,
      reason: state.reason,
      pendingExpiresAt: state.pendingExpiresAt || null,
      owner: state.owner || null,
      suggestions,
    });
  }),
);

router.post(
  "/waitlist",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const requested = sanitizeSlug(req.body?.slug || "");
    if (!SLUG_REGEX.test(requested)) {
      res.status(400).json({ error: "Invalid UNQ format", code: "INVALID_SLUG" });
      return;
    }

    const state = await getSlugState(requested);
    if (state.reason !== "pending") {
      res.status(409).json({ error: "UNQ is not pending", code: "SLUG_NOT_PENDING" });
      return;
    }

    const sessionUser = getUserSession(req);
    const telegramId = sessionUser?.telegramId ? String(sessionUser.telegramId) : null;
    const identity = pickClientIdentity(req);
    const ipHash = identity ? createHash("sha256").update(`${identity}|${requested}`).digest("hex") : null;
    const userAgent = String(req.get("user-agent") || "").slice(0, 400);

    const dedupeFilters = [
      ...(telegramId ? [{ telegramId }] : []),
      ...(ipHash ? [{ ipHash }] : []),
    ];
    const existing = dedupeFilters.length
      ? await withMissingTableFallback("SlugWaitlist", null, () =>
          prisma.slugWaitlist.findFirst({
            where: {
              fullSlug: requested,
              OR: dedupeFilters,
            },
            select: { id: true },
          }),
        )
      : null;

    if (existing) {
      res.json({ ok: true, queued: false });
      return;
    }

    await withMissingTableFallback("SlugWaitlist", null, () =>
      prisma.slugWaitlist.create({
        data: {
          fullSlug: requested,
          telegramId,
          ipHash,
          userAgent,
        },
      }),
    );

    res.json({ ok: true, queued: true });
  }),
);

router.get(
  "/slug-counter",
  asyncHandler(async (_req, res) => {
    const taken = await getTakenSlugsSet();
    res.json({
      taken: taken.size,
      total: env.SLUG_TOTAL_LIMIT,
    });
  }),
);

router.get(
  "/slug-suggestions",
  asyncHandler(async (req, res) => {
    const rawBase = typeof req.query.base === "string" ? req.query.base : "";
    const base = rawBase.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const count = Number(req.query.count || 5);
    const suggestions = await generateAvailableSuggestions({
      count,
      base: SLUG_REGEX.test(base) ? base : null,
    });
    res.json({ suggestions });
  }),
);

router.get(
  "/slug-price",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const slug = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const parsed = splitSlug(slug);

    if (!parsed) {
      res.status(400).json({
        slug,
        validFormat: false,
      });
      return;
    }

    const record = await withMissingTableFallback("SlugRecord", null, () =>
      prisma.slugRecord.findUnique({
        where: { slug },
        select: { priceOverride: true },
      }),
    );

    if (record && typeof record.priceOverride === "number") {
      res.json({
        slug,
        validFormat: true,
        price: record.priceOverride,
        source: "override",
      });
      return;
    }

    const pricing = calculateSlugPrice({
      letters: parsed.letters,
      digits: parsed.digits,
    });
    const activeSale = await getActiveFlashSale();
    const flash = applyFlashSaleToPrice({
      slug,
      basePrice: pricing.total,
      sale: activeSale,
    });

    res.json({
      slug,
      validFormat: true,
      price: flash.finalPrice,
      basePrice: flash.basePrice,
      hasFlashSale: flash.hasDiscount,
      discountAmount: flash.discountAmount,
      discountPercent: flash.discountPercent,
      flashSaleId: flash.hasDiscount ? activeSale.id : null,
      source: "calculator",
    });
  }),
);

router.post(
  "/order-request",
  publicOrderRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    if (!userSession || !userSession.telegramId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: userSession.telegramId },
      select: {
        telegramId: true,
        firstName: true,
        username: true,
        plan: true,
        planExpiresAt: true,
        status: true,
      },
    });

    if (!user || user.status === "blocked" || user.status === "deactivated") {
      res.status(403).json({ error: "Account is disabled", code: "ACCOUNT_DISABLED" });
      return;
    }

    const hasActivePremium = user.plan === "premium" && user.planExpiresAt && new Date(user.planExpiresAt).getTime() > Date.now();
    const effectivePlan = hasActivePremium ? "premium" : "basic";
    const slugLimit = effectivePlan === "premium" ? 3 : 1;
    const userSlugsCount = await withMissingTableFallback("Slug", 0, () =>
      prisma.slug.count({
        where: {
          ownerTelegramId: user.telegramId,
          status: { in: ["approved", "active", "paused", "private"] },
        },
      }),
    );
    if (userSlugsCount >= slugLimit) {
      res.status(403).json({
        error: effectivePlan === "premium" ? "Premium UNQ limit reached" : "Upgrade required",
        code: effectivePlan === "premium" ? "PREMIUM_SLUG_LIMIT_REACHED" : "BASIC_SLUG_LIMIT_REACHED",
      });
      return;
    }

    const parsed = OrderRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        issues: mapOrderValidationIssues(parsed.error),
      });
      return;
    }

    const payload = parsed.data;
    const slug = `${payload.letters}${payload.digits}`;
    const state = await getSlugState(slug);
    const dropId = payload.dropId || null;
    let drop = null;
    if (dropId) {
      drop = await prisma.drop.findUnique({ where: { id: dropId } });
      if (!drop || !drop.isLive || drop.isFinished || drop.isSoldOut) {
        res.status(409).json({ error: "Drop is not active", code: "DROP_NOT_ACTIVE" });
        return;
      }
      const pool = Array.isArray(drop.slugsPool) ? drop.slugsPool : [];
      if (!pool.includes(slug)) {
        res.status(409).json({ error: "Slug is not part of this drop", code: "DROP_SLUG_MISMATCH" });
        return;
      }
    }
    if (!state.available) {
      if (state.reason === "drop_reserved" && dropId) {
        // allow checkout through active drop flow
      } else if (state.reason === "drop_reserved" && !dropId) {
        res.status(409).json({
          error: "Этот UNQ доступен только в активном дропе",
          reason: state.reason,
          code: "DROP_ONLY_SLUG",
        });
        return;
      } else {
        res.status(409).json({
          error: "Этот UNQ только что заняли. Выбери другой.",
          reason: state.reason,
          code: "SLUG_NOT_AVAILABLE",
        });
        return;
      }
    }

    const basePricing =
      typeof state.priceOverride === "number"
        ? {
            total: state.priceOverride,
          }
        : calculateSlugPrice({ letters: payload.letters, digits: payload.digits });
    const activeFlashSale = await getActiveFlashSale();
    const flashApplied = applyFlashSaleToPrice({
      slug,
      basePrice: basePricing.total,
      sale: activeFlashSale,
    });
    const finalSlugPrice = flashApplied.finalPrice;
    const tariffPrice = TARIFF_MONTHLY[payload.tariff] ?? TARIFF_MONTHLY.basic;
    const braceletPrice = payload.products.bracelet ? BRACELET_PRICE : 0;
    const totalOneTime = finalSlugPrice + braceletPrice;
    const theme = payload.tariff === "premium" ? normalizeTheme(payload.theme) : undefined;
    const contact = user.username ? `@${user.username}` : `${user.firstName}`;
    const requestedAt = new Date();
    const pendingExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const canUseSlugTable = await withMissingTableFallback("Slug", false, async () => {
      await prisma.slug.findFirst({
        select: { id: true },
      });
      return true;
    });

    let order = null;
    try {
      order = await prisma.$transaction(async (tx) => {
        const existingSlug = canUseSlugTable
          ? await tx.slug.findUnique({
              where: { fullSlug: slug },
              select: { fullSlug: true, status: true },
            })
          : null;
        if (existingSlug && existingSlug.status !== "free") {
          const conflictError = new Error("Slug is not available");
          conflictError.code = "SLUG_NOT_AVAILABLE";
          conflictError.reason = existingSlug.status;
          throw conflictError;
        }

        if (canUseSlugTable) {
          await tx.slug.upsert({
            where: { fullSlug: slug },
            create: {
              letters: payload.letters,
              digits: payload.digits,
              fullSlug: slug,
              status: "pending",
              requestedAt,
              pendingExpiresAt,
              price: finalSlugPrice,
            },
            update: {
              status: "pending",
              requestedAt,
              pendingExpiresAt,
              price: finalSlugPrice,
            },
          });
        }

        const slugRequest = await tx.slugRequest.create({
          data: {
            telegramId: user.telegramId,
            slug,
            slugPrice: finalSlugPrice,
            requestedPlan: payload.tariff,
            bracelet: Boolean(payload.products.bracelet),
            contact,
            status: "new",
            dropId: drop ? drop.id : null,
            flashSaleId: flashApplied.hasDiscount ? activeFlashSale.id : null,
            flashDiscountAmount: flashApplied.discountAmount,
          },
          select: { id: true, status: true },
        });

        await tx.orderRequest.create({
          data: {
            name: payload.name,
            slug,
            slugPrice: finalSlugPrice,
            tariff: payload.tariff,
            theme: theme || null,
            bracelet: Boolean(payload.products.bracelet),
            contact,
            status: "NEW",
            ...(payload.products.bracelet
              ? {
                  braceletOrder: {
                    create: {
                      name: payload.name,
                      slug,
                      contact,
                      deliveryStatus: "ORDERED",
                    },
                  },
                }
              : {}),
          },
          select: { id: true },
        });

        return slugRequest;
      });
    } catch (error) {
      if (error && error.code === "SLUG_NOT_AVAILABLE") {
        res.status(409).json({
          error: "Этот UNQ только что заняли. Выбери другой.",
          reason: error.reason || "taken",
          code: "SLUG_NOT_AVAILABLE",
        });
        return;
      }
      throw error;
    }

    let telegramDelivered = true;
    let telegramError = null;
    try {
      await sendOrderRequestToTelegram({
        name: payload.name,
        telegramId: user.telegramId,
        username: user.username || "",
        slug,
        slugPriceLabel: formatPrice(finalSlugPrice),
        tariff: payload.tariff,
        tariffPriceLabel: formatPrice(tariffPrice),
        bracelet: payload.products.bracelet,
        contact,
        totalOneTimeLabel: formatPrice(totalOneTime),
        statusLabel: toOrderStatusLabel("NEW"),
        themeLabel: theme || "default_dark",
      });
    } catch (error) {
      if (error instanceof TelegramConfigError) {
        console.error("[express-app] telegram config missing for order-request");
        telegramDelivered = false;
        telegramError = "Telegram is not configured";
      } else if (error instanceof TelegramDeliveryError) {
        console.error("[express-app] telegram delivery failed", error.message);
        telegramDelivered = false;
        telegramError = "Failed to deliver request";
      } else {
        throw error;
      }
    }

    res.json({
      ok: true,
      orderId: order.id,
      pendingExpiresAt,
      telegramDelivered,
      flashSale: flashApplied.hasDiscount
        ? {
            saleId: activeFlashSale.id,
            discountAmount: flashApplied.discountAmount,
            discountPercent: flashApplied.discountPercent,
            basePrice: flashApplied.basePrice,
            finalPrice: flashApplied.finalPrice,
          }
        : null,
      ...(telegramDelivered ? {} : { warning: telegramError }),
    });

    if (drop) {
      try {
        await markDropSlugSold({ dropId: drop.id, slug });
      } catch (error) {
        console.error("[express-app] failed to mark drop slug sold", error);
      }
    }
  }),
);

router.post(
  "/:slug/click",
  asyncHandler(async (req, res) => {
    const requestedSlug = sanitizeSlug(req.params.slug);
    const device = detectDevice(req.get("user-agent"));
    const dateKey = new Date().toISOString().slice(0, 10);
    const identity = pickClientIdentity(req);
    const ipHash = identity ? createHash("sha256").update(`${identity}|click|${requestedSlug || req.params.slug}|${dateKey}`).digest("hex") : null;
    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);

    const slugRow = await withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { fullSlug: true, status: true },
      }),
    );

    if (!slugRow || !["active", "private"].includes(slugRow.status)) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    if (!prisma.slugClick) {
      res.json({ ok: true });
      return;
    }

    await prisma.$transaction(async (tx) => {
      let isUnique = false;
      if (ipHash) {
        const existing = await tx.slugClick.findFirst({
          where: {
            fullSlug: slugRow.fullSlug,
            ipHash,
            clickedAt: { gte: dayStart },
          },
          select: { id: true },
        });
        isUnique = !existing;
      }

      await tx.slugClick.create({
        data: {
          fullSlug: slugRow.fullSlug,
          device,
          ipHash,
          isUnique,
        },
      });
    });

    res.json({ ok: true });
  }),
);

router.post(
  "/:slug/view",
  asyncHandler(async (req, res) => {
    const requestedSlug = sanitizeSlug(req.params.slug);
    const device = detectDevice(req.get("user-agent"));
    const dateKey = new Date().toISOString().slice(0, 10);
    const identity = pickClientIdentity(req);
    const ipHash = identity ? createHash("sha256").update(`${identity}|${requestedSlug || req.params.slug}|${dateKey}`).digest("hex") : null;
    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);

    const slugRow = await withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { fullSlug: true, status: true },
      }),
    );

    if (slugRow) {
      if (!["active", "private"].includes(slugRow.status)) {
        res.status(404).json({ error: "Card not found" });
        return;
      }

      await withMissingTableFallback("SlugView", null, () =>
        prisma.$transaction(async (tx) => {
          let isUnique = false;
          if (ipHash) {
            const existing = await tx.slugView.findFirst({
              where: {
                fullSlug: slugRow.fullSlug,
                ipHash,
                viewedAt: { gte: dayStart },
              },
              select: { id: true },
            });
            isUnique = !existing;
          }

          await tx.slugView.create({
            data: {
              fullSlug: slugRow.fullSlug,
              device,
              ipHash,
              isUnique,
            },
          });
        }),
      );
      res.json({ ok: true });
      return;
    }

    const card = await prisma.card.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, isActive: true },
    });

    if (!card || !card.isActive) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      let isUnique = false;

      if (ipHash) {
        const existing = await tx.viewLog.findFirst({
          where: {
            cardId: card.id,
            ipHash,
            viewedAt: { gte: dayStart },
          },
          select: { id: true },
        });

        isUnique = !existing;
      }

      await tx.card.update({
        where: { id: card.id },
        data: {
          viewsCount: { increment: 1 },
          ...(isUnique ? { uniqueViewsCount: { increment: 1 } } : {}),
        },
      });

      await tx.viewLog.create({
        data: {
          cardId: card.id,
          device,
          ipHash,
          isUnique,
        },
      });
    });

    res.json({ ok: true });
  }),
);

router.get(
  "/:slug/vcf",
  asyncHandler(async (req, res) => {
    const requestedSlug = sanitizeSlug(req.params.slug);
    const slugRow = await withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { fullSlug: true, status: true, ownerTelegramId: true },
      }),
    );

    if (slugRow && ["active", "private"].includes(slugRow.status) && slugRow.ownerTelegramId) {
      const [user, profileCard] = await Promise.all([
        prisma.user.findUnique({
          where: { telegramId: slugRow.ownerTelegramId },
          select: { firstName: true, username: true },
        }),
        prisma.profileCard.findUnique({
          where: { ownerTelegramId: slugRow.ownerTelegramId },
          select: { name: true, buttons: true, bio: true, address: true, postcode: true, extraPhone: true },
        }),
      ]);

      if (profileCard) {
        const buttons = Array.isArray(profileCard.buttons) ? profileCard.buttons : [];
        const firstPhone = buttons.find((item) => {
          const type = String(item?.type || "").toLowerCase();
          const href = String(item?.href || item?.value || "").toLowerCase();
          return type === "phone" || href.startsWith("tel:");
        });
        const firstEmail = buttons.find((item) => {
          const type = String(item?.type || "").toLowerCase();
          const href = String(item?.href || item?.value || "").toLowerCase();
          return type === "email" || href.startsWith("mailto:");
        });

        const phoneRaw = String(firstPhone?.value || firstPhone?.href || "").replace(/^tel:/i, "");
        const emailRaw = String(firstEmail?.value || firstEmail?.href || "").replace(/^mailto:/i, "");
        const payload = generateVCard({
          slug: slugRow.fullSlug,
          isActive: true,
          name: profileCard.name || user?.firstName || user?.username || slugRow.fullSlug,
          phone: phoneRaw || "+998000000000",
          email: emailRaw || undefined,
          extraPhone: profileCard.extraPhone || undefined,
          address: profileCard.address || "",
          postcode: profileCard.postcode || "",
          hashtag: profileCard.bio || "",
        });

        res.setHeader("Content-Type", "text/vcard; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${slugRow.fullSlug}.vcf"`);
        res.setHeader("Cache-Control", "no-store");
        res.send(payload);
        return;
      }
    }

    const card = await prisma.card.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        isActive: true,
        name: true,
        phone: true,
        email: true,
        extraPhone: true,
        address: true,
        postcode: true,
        hashtag: true,
      },
    });

    if (!card || !card.isActive) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const payload = generateVCard(card);

    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${card.slug}.vcf"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(payload);
  }),
);

module.exports = {
  publicApiRouter: router,
};

