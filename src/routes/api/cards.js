const { createHash } = require("node:crypto");

const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { detectDevice } = require("../../services/ua");
const { generateVCard } = require("../../services/vcard");
const { calculateSlugPrice } = require("../../services/slug-pricing");
const { sendOrderRequestToTelegram, TelegramConfigError, TelegramDeliveryError } = require("../../services/telegram");
const { asyncHandler } = require("../../middleware/async");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { publicOrderRateLimit } = require("../../middleware/rate-limit");
const { OrderRequestSchema } = require("../../validation/order-request");

const router = express.Router();
const SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;
const TARIFF_MONTHLY = {
  basic: 29_000,
  premium: 79_000,
};
const BRACELET_PRICE = 300_000;
const THEMES = new Set(["default_dark", "light_minimal", "gradient", "neon", "corporate"]);

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
      issues.slug = "Slug должен быть в формате AAA000";
      continue;
    }

    if (field === "contact") {
      issues.contact = issue.message || "Контакт обязателен";
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

function normalizeTheme(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  return THEMES.has(value) ? value : undefined;
}

async function getSlugState(slug) {
  const [card, record] = await Promise.all([
    prisma.card.findUnique({
      where: { slug },
      select: { id: true },
    }),
    prisma.slugRecord.findUnique({
      where: { slug },
      select: { state: true, priceOverride: true },
    }),
  ]);

  if (record?.state === "BLOCKED") {
    return { available: false, reason: "blocked", priceOverride: record.priceOverride };
  }

  if (card || record?.state === "TAKEN") {
    return { available: false, reason: "taken", priceOverride: record?.priceOverride ?? null };
  }

  return { available: true, reason: "available", priceOverride: record?.priceOverride ?? null };
}

async function getTakenSlugsSet() {
  const [cardRows, recordRows] = await Promise.all([
    prisma.card.findMany({
      select: { slug: true },
    }),
    prisma.slugRecord.findMany({
      where: { state: { in: ["TAKEN", "BLOCKED"] } },
      select: { slug: true },
    }),
  ]);

  const taken = new Set();
  for (const row of cardRows) {
    taken.add(row.slug);
  }
  for (const row of recordRows) {
    taken.add(row.slug);
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

    const items = await prisma.card.findMany({
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
    });

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
      suggestions,
    });
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

    const record = await prisma.slugRecord.findUnique({
      where: { slug },
      select: { priceOverride: true },
    });

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

    res.json({
      slug,
      validFormat: true,
      price: pricing.total,
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
    if (!state.available) {
      res.status(409).json({
        error: "Slug is not available",
        reason: state.reason,
      });
      return;
    }

    const pricing =
      typeof state.priceOverride === "number"
        ? {
            total: state.priceOverride,
          }
        : calculateSlugPrice({ letters: payload.letters, digits: payload.digits });
    const tariffPrice = TARIFF_MONTHLY[payload.tariff] ?? TARIFF_MONTHLY.basic;
    const braceletPrice = payload.products.bracelet ? BRACELET_PRICE : 0;
    const totalOneTime = pricing.total + braceletPrice;
    const theme = payload.tariff === "premium" ? normalizeTheme(payload.theme) : undefined;

    const order = await prisma.orderRequest.create({
      data: {
        name: payload.name,
        slug,
        slugPrice: pricing.total,
        tariff: payload.tariff,
        theme: theme || null,
        bracelet: Boolean(payload.products.bracelet),
        contact: payload.contact,
        status: "NEW",
        ...(payload.products.bracelet
          ? {
              braceletOrder: {
                create: {
                  name: payload.name,
                  slug,
                  contact: payload.contact,
                  deliveryStatus: "ORDERED",
                },
              },
            }
          : {}),
      },
      select: { id: true, status: true },
    });

    let telegramDelivered = true;
    let telegramError = null;
    try {
      await sendOrderRequestToTelegram({
        name: payload.name,
        slug,
        slugPriceLabel: formatPrice(pricing.total),
        tariff: payload.tariff,
        tariffPriceLabel: formatPrice(tariffPrice),
        bracelet: payload.products.bracelet,
        contact: payload.contact,
        totalOneTimeLabel: formatPrice(totalOneTime),
        statusLabel: toOrderStatusLabel(order.status),
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
      telegramDelivered,
      ...(telegramDelivered ? {} : { warning: telegramError }),
    });
  }),
);

router.post(
  "/:slug/view",
  asyncHandler(async (req, res) => {
    const card = await prisma.card.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, isActive: true },
    });

    if (!card || !card.isActive) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const device = detectDevice(req.get("user-agent"));
    const dateKey = new Date().toISOString().slice(0, 10);
    const identity = pickClientIdentity(req);
    const ipHash = identity ? createHash("sha256").update(`${identity}|${req.params.slug}|${dateKey}`).digest("hex") : null;
    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);

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
