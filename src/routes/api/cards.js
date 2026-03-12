const { createHash } = require("node:crypto");

const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { generateVCard } = require("../../services/vcard");
const { calculateSlugPrice, calculateSlugPriceFromSettings, getSlugPricingConfig } = require("../../services/slug-pricing");
const { sendOrderRequestToTelegram, TelegramConfigError, TelegramDeliveryError } = require("../../services/telegram");
const {
  buildOrderPaymentDraft,
  getOrderPaymentReference,
  buildManualTelegramPaymentUrl,
  normalizeTelegramUsername,
} = require("../../services/payment-flow");
const { getActiveFlashSale, applyFlashSaleToPrice } = require("../../services/flash-sales");
const { markDropSlugSold } = require("../../services/drops");
const {
  normalizePlan,
  getPricingSettings,
  getBraceletPrice,
  resolveRequestedPlanForOrder,
  getPlanCharge,
} = require("../../services/pricing-settings");
const { asyncHandler } = require("../../middleware/async");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { publicOrderRateLimit } = require("../../middleware/rate-limit");
const { getUserSession, requireUserApi } = require("../../middleware/auth");
const { OrderRequestSchema } = require("../../validation/order-request");
const { getSetting, getManySettings } = require("../../services/platform-settings");
const { normalizeButtonType, getAnalyticsSessionId, recordView } = require("../../services/tap-tracker");
const { resolveClientIp, buildViewerFingerprint } = require("../../services/request-ip");
const { logPaymentEvent } = require("../../services/payment-events");
const {
  getReferralV1Settings,
  getWalletBalance,
  hasApprovedSlugPurchase,
  resolveReferrerForUser,
  computeDiscountAllocation,
  resolveOrderAttribution,
} = require("../../services/referral-v1");
const {
  normalizePromoCode,
  getReferralV2Settings,
  resolveCampaignForCheckout,
  buildCampaignSnapshot,
  evaluateCampaignEligibility,
  runFraudCheck,
  reserveCampaignUsage,
} = require("../../services/referral-v2");

const router = express.Router();
const SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;
const THEMES = new Set(["default_dark", "arctic", "linen", "marble", "forest", "sage_luxe", "midnight_obsidian", "golden_noir", "aurora_codex", "nebula_glass"]);
const FALLBACK_SUPPORT_TELEGRAM = "unqx_uz";
const AFFORDABLE_CACHE_TTL_LOW_LOAD_MS = 10_000;
const AFFORDABLE_CACHE_TTL_MEDIUM_LOAD_MS = 8_000;
const AFFORDABLE_CACHE_TTL_HIGH_LOAD_MS = 5_000;
const affordableCandidatesCache = {
  expiresAt: 0,
  candidates: [],
};
const affordablePickCache = {
  expiresAt: 0,
  slug: "",
  estimatedPrice: 0,
};
const affordableLoadWindow = [];

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

function isReferralInfraError(error) {
  if (!error) return false;
  if (isMissingModelTable(error) || isMissingModelColumn(error) || isMissingModelDelegateError(error)) {
    return true;
  }
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (name.includes("PrismaClientValidationError") || name.includes("PrismaClientKnownRequestError") || name.includes("PrismaClientUnknownRequestError")) {
    return /referral|campaign|bonus|wallet|promo/i.test(message);
  }
  return false;
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

async function findLatestActiveOrderSafe(userId) {
  const where = {
    userId,
    status: { in: ["new", "contacted", "paid"] },
  };
  const orderBy = { createdAt: "desc" };
  try {
    return await prisma.slugRequest.findFirst({
      where,
      orderBy,
      select: {
        id: true,
        slug: true,
        status: true,
        requestedPlan: true,
        slugPrice: true,
        planPrice: true,
        inviteeDiscountApplied: true,
        bonusSpent: true,
        discountCapApplied: true,
        campaignId: true,
        promoCode: true,
        fraudVerdict: true,
        fraudReason: true,
        campaignSnapshot: true,
        bracelet: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (!(isMissingModelTable(error, "SlugRequest") || isMissingModelColumn(error, "SlugRequest") || isMissingModelDelegateError(error))) {
      throw error;
    }
    // Fallback for databases that are behind on referral-v2 columns.
    return withMissingTableFallback("SlugRequest", null, () =>
      prisma.slugRequest.findFirst({
        where,
        orderBy,
        select: {
          id: true,
          slug: true,
          status: true,
          requestedPlan: true,
          slugPrice: true,
          planPrice: true,
          bracelet: true,
          createdAt: true,
        },
      }),
    );
  }
}

async function safeResolveCampaignForCheckout(params) {
  try {
    return await resolveCampaignForCheckout(params);
  } catch (error) {
    if (isReferralInfraError(error)) {
      console.warn("[express-app] referral campaign resolve fallback in cards route", error?.message || error);
      return {
        campaign: null,
        normalizedPromoCode: normalizePromoCode(params?.promoCode || ""),
      };
    }
    throw error;
  }
}

async function safeEvaluateCampaignEligibility(params) {
  try {
    return await evaluateCampaignEligibility(params);
  } catch (error) {
    if (isReferralInfraError(error)) {
      console.warn("[express-app] referral campaign eligibility fallback in cards route", error?.message || error);
      return { allowed: false, reason: "campaign_unavailable", usedBudget: 0, usedByUser: 0 };
    }
    throw error;
  }
}

async function safeGetWalletBalance(userId) {
  try {
    return await getWalletBalance(userId);
  } catch (error) {
    if (isReferralInfraError(error)) {
      console.warn("[express-app] wallet balance fallback in cards route", error?.message || error);
      return 0;
    }
    throw error;
  }
}

async function safeHasApprovedSlugPurchase(userId) {
  try {
    return await hasApprovedSlugPurchase(userId);
  } catch (error) {
    if (isReferralInfraError(error)) {
      console.warn("[express-app] first approved purchase fallback in cards route", error?.message || error);
      return false;
    }
    throw error;
  }
}

async function safeResolveReferrerForUser(params) {
  try {
    return await resolveReferrerForUser(params);
  } catch (error) {
    if (isReferralInfraError(error)) {
      console.warn("[express-app] resolve referrer fallback in cards route", error?.message || error);
      return null;
    }
    throw error;
  }
}

async function getPromoPolicySettings() {
  const settings = await getManySettings([
    "feature_promo_codes",
    "promo_codes_require_referrer",
    "promo_codes_first_order_only",
  ]);
  return {
    enabled: settings.feature_promo_codes !== undefined ? Boolean(settings.feature_promo_codes) : true,
    requireReferrer: settings.promo_codes_require_referrer !== undefined ? Boolean(settings.promo_codes_require_referrer) : false,
    firstOrderOnly: settings.promo_codes_first_order_only !== undefined ? Boolean(settings.promo_codes_first_order_only) : true,
  };
}

function resolveInviteeDiscountCandidate({
  referralEnabled,
  campaignSnapshot,
  promoPolicy,
  hasReferrer,
  firstApprovedOrderExists,
}) {
  const isPromoCampaign = String(campaignSnapshot?.campaignType || "") === "promo_code";
  const isFirstOrder = !firstApprovedOrderExists;
  if (isPromoCampaign) {
    if (!promoPolicy.enabled) return { allowed: false, reason: "promo_disabled", amount: 0 };
    if (promoPolicy.requireReferrer && !hasReferrer) return { allowed: false, reason: "promo_requires_referrer", amount: 0 };
    if (promoPolicy.firstOrderOnly && !isFirstOrder) return { allowed: false, reason: "promo_first_order_only", amount: 0 };
    return { allowed: true, reason: "", amount: Math.max(0, Number(campaignSnapshot?.inviteeDiscount || 0)) };
  }
  const referralEligible = Boolean(referralEnabled) && isFirstOrder && hasReferrer;
  return {
    allowed: referralEligible,
    reason: referralEligible ? "" : "referral_not_eligible",
    amount: referralEligible ? Math.max(0, Number(campaignSnapshot?.inviteeDiscount || 0)) : 0,
  };
}

function toOrderStatusLabel(status) {
  switch (status) {
    case "NEW":
      return "Новая";
    case "CONTACTED":
      return "Связались";
    case "PAID":
      return "Оплачено";
    case "ACTIVATED":
      return "Активировано";
    case "REJECTED":
      return "Отклонено";
    default:
      return status;
  }
}

function pickClientIdentity(req) {
  const resolvedIp = resolveClientIp(req);
  const fingerprint = buildViewerFingerprint(req, resolvedIp);
  if (fingerprint) {
    return fingerprint;
  }
  return resolvedIp ? `ip:${resolvedIp}` : null;
}

function isMissingStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  return code === "42P01" || code === "42703";
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
  const rows = await getSlugStatesBulk([slug]);
  return rows.get(slug) || { available: true, reason: "available", priceOverride: null };
}

function mapSlugRowToState(slug, slugRow) {
  if (!slugRow) {
    return { available: true, reason: "available", priceOverride: null };
  }

  const ownerFromSlug =
    slugRow.owner && ["approved", "active", "private", "paused"].includes(slugRow.status)
      ? {
        name: slugRow.owner.profileCard?.name || slugRow.owner.firstName || "UNQX User",
        avatarUrl: slugRow.owner.profileCard?.avatarUrl || null,
        href: `/${slug}`,
      }
      : null;

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

async function getSlugStatesBulk(slugs = []) {
  const target = Array.from(new Set((Array.isArray(slugs) ? slugs : []).filter((item) => SLUG_REGEX.test(item))));
  const out = new Map();
  if (target.length === 0) {
    return out;
  }

  const slugRows = await withMissingTableFallback("Slug", [], () =>
    prisma.slug.findMany({
      where: {
        fullSlug: { in: target },
      },
      select: {
        fullSlug: true,
        status: true,
        price: true,
        pendingExpiresAt: true,
        owner: {
          select: {
            firstName: true,
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
  );
  const rowsBySlug = new Map(slugRows.map((row) => [row.fullSlug, row]));

  for (const slug of target) {
    out.set(slug, mapSlugRowToState(slug, rowsBySlug.get(slug) || null));
  }
  return out;
}

async function getTakenSlugsSet() {
  const slugRows = await withMissingTableFallback("Slug", [], () =>
    prisma.slug.findMany({
      where: { status: { not: "free" } },
      select: { fullSlug: true },
    }),
  );

  const taken = new Set();
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

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)] || "";
}

function buildRandomLettersAffordable() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const mode = randomFrom(["random", "random", "random", "sequential", "palindrome"]);
  if (mode === "sequential") {
    const startIndex = Math.floor(Math.random() * 24);
    return `${alphabet[startIndex]}${alphabet[startIndex + 1]}${alphabet[startIndex + 2]}`;
  }
  if (mode === "palindrome") {
    const a = randomFrom(alphabet);
    const b = randomFrom(alphabet.filter((char) => char !== a));
    return `${a}${b}${a}`;
  }
  return `${randomFrom(alphabet)}${randomFrom(alphabet)}${randomFrom(alphabet)}`;
}

function buildRandomDigitsAffordable() {
  const mode = randomFrom(["random", "random", "palindrome", "round", "sequential"]);
  if (mode === "round") {
    const first = Math.floor(Math.random() * 9) + 1;
    return `${first}00`;
  }
  if (mode === "sequential") {
    const start = Math.floor(Math.random() * 8);
    return `${start}${start + 1}${start + 2}`;
  }
  if (mode === "palindrome") {
    const a = Math.floor(Math.random() * 10);
    const b = Math.floor(Math.random() * 10);
    return `${a}${b}${a}`;
  }
  return `${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
}

async function generateAffordableCandidates({ limit = 120 }) {
  const targetLimit = Math.max(20, Math.min(300, Number(limit) || 120));
  const config = await getSlugPricingConfig();
  const basePrice = Math.max(1, Number(config?.basePrice || 100_000));
  const minTotal = Math.round(basePrice);
  const maxTotal = Math.round(basePrice * 8);
  const out = [];
  const seen = new Set();
  const attempts = 650;

  for (let i = 0; i < attempts; i += 1) {
    const slug = `${buildRandomLettersAffordable()}${buildRandomDigitsAffordable()}`;
    if (!SLUG_REGEX.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const parsed = splitSlug(slug);
    if (!parsed) continue;
    const price = Number(
      calculateSlugPrice({
        letters: parsed.letters,
        digits: parsed.digits,
        config,
      }).total,
    );
    if (price < minTotal || price > maxTotal) continue;
    out.push({ slug, price });
    if (out.length >= targetLimit) break;
  }

  return out.sort((left, right) => {
    if (left.price !== right.price) return left.price - right.price;
    return left.slug.localeCompare(right.slug);
  });
}

async function getAffordableCandidatesCached({ limit = 120 }) {
  const now = Date.now();
  if (affordableCandidatesCache.expiresAt > now && Array.isArray(affordableCandidatesCache.candidates) && affordableCandidatesCache.candidates.length > 0) {
    return affordableCandidatesCache.candidates;
  }
  const generated = await generateAffordableCandidates({ limit });
  affordableCandidatesCache.candidates = generated;
  affordableCandidatesCache.expiresAt = now + AFFORDABLE_CACHE_TTL_MEDIUM_LOAD_MS;
  return generated;
}

function getAdaptiveAffordableTtlMs() {
  const now = Date.now();
  const windowMs = 60_000;
  affordableLoadWindow.push(now);
  while (affordableLoadWindow.length > 0 && now - affordableLoadWindow[0] > windowMs) {
    affordableLoadWindow.shift();
  }
  const rpm = affordableLoadWindow.length;
  if (rpm >= 25) {
    return AFFORDABLE_CACHE_TTL_HIGH_LOAD_MS;
  }
  if (rpm <= 8) {
    return AFFORDABLE_CACHE_TTL_LOW_LOAD_MS;
  }
  return AFFORDABLE_CACHE_TTL_MEDIUM_LOAD_MS;
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

    const newItems = await withMissingTableFallback("Slug", [], () =>
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
          price: true,
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
    );

    const slugPricingConfig = await getSlugPricingConfig();

    const itemsMap = new Map();
    for (const row of newItems) {
      const parts = splitSlug(row.fullSlug);
      const calculatedPrice = parts
        ? Number(
          calculateSlugPrice({
            letters: parts.letters,
            digits: parts.digits,
            config: slugPricingConfig,
          }).total,
        )
        : 0;
      const resolvedPrice = typeof row.price === "number" ? Number(row.price) : calculatedPrice;

      itemsMap.set(row.fullSlug, {
        slug: row.fullSlug,
        name: row.owner?.profileCard?.name || row.owner?.firstName || "UNQX User",
        slugPrice: resolvedPrice,
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

router.get(
  "/availability-bulk",
  asyncHandler(async (req, res) => {
    const source = typeof req.query.source === "string" ? req.query.source.slice(0, 20).toLowerCase() : "unknown";
    const rawInput = String(req.query.slugs || req.query.items || "");
    const requested = rawInput
      .split(",")
      .map((item) => String(item || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
      .filter(Boolean)
      .slice(0, 60);

    const unique = Array.from(new Set(requested));
    const validSlugs = unique.filter((slug) => SLUG_REGEX.test(slug));
    const stateMap = await getSlugStatesBulk(validSlugs);
    const items = unique.map((slug) => {
      const validFormat = SLUG_REGEX.test(slug);
      if (!validFormat) {
        return {
          slug,
          validFormat: false,
          available: false,
          reason: "invalid_format",
        };
      }
      const state = stateMap.get(slug) || { available: true, reason: "available", priceOverride: null };
      return {
        slug,
        validFormat: true,
        available: Boolean(state.available),
        reason: String(state.reason || "unknown"),
      };
    });

    if (source === "hero") {
      await Promise.all(
        items.slice(0, 10).map((item) =>
          logChecker({
            slug: item.slug,
            pattern: item.slug,
            source,
            result: item.validFormat ? (item.available ? "AVAILABLE" : "TAKEN") : "INVALID",
          }),
        ),
      );
    }

    res.json({
      items,
      checked: items.length,
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
    const userId = sessionUser?.userId ? String(sessionUser.userId) : null;
    const identity = pickClientIdentity(req);
    const ipHash = identity ? createHash("sha256").update(`${identity}|${requested}`).digest("hex") : null;
    const userAgent = String(req.get("user-agent") || "").slice(0, 400);

    const dedupeFilters = [
      ...(userId ? [{ userId }] : []),
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
          userId,
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
  "/slug-generate-affordable",
  asyncHandler(async (req, res) => {
    const source = typeof req.query.source === "string" ? req.query.source.slice(0, 20).toLowerCase() : "calculator";
    const bypassPickCache = source === "calculator_generate";
    const now = Date.now();
    const adaptiveTtlMs = getAdaptiveAffordableTtlMs();

    if (!bypassPickCache && affordablePickCache.expiresAt > now && SLUG_REGEX.test(affordablePickCache.slug)) {
      const cachedMap = await getSlugStatesBulk([affordablePickCache.slug]);
      if (cachedMap.get(affordablePickCache.slug)?.available === true) {
        res.json({
          ok: true,
          source,
          slug: affordablePickCache.slug,
          estimatedPrice: affordablePickCache.estimatedPrice,
          segment: "low_mid",
          cache: "hit",
          ttlMs: adaptiveTtlMs,
        });
        return;
      }
      affordablePickCache.expiresAt = 0;
      affordablePickCache.slug = "";
      affordablePickCache.estimatedPrice = 0;
    }

    const candidates = await getAffordableCandidatesCached({ limit: 140 });
    const slugs = candidates.map((item) => item.slug).slice(0, 80);
    const states = await getSlugStatesBulk(slugs);
    const availableCandidates = candidates.filter((item) => states.get(item.slug)?.available === true);
    let picked = null;
    if (availableCandidates.length > 0) {
      if (bypassPickCache) {
        // Rotate generated slugs for calculator clicks instead of returning the same first candidate.
        const pool = availableCandidates.slice(0, Math.min(24, availableCandidates.length));
        const withoutPrevious = pool.filter((item) => item.slug !== affordablePickCache.slug);
        const bag = withoutPrevious.length > 0 ? withoutPrevious : pool;
        picked = bag[Math.floor(Math.random() * bag.length)] || null;
      } else {
        picked = availableCandidates[0] || null;
      }
    }

    if (!picked) {
      res.json({
        ok: false,
        source,
        slug: "",
        message: "no_available_affordable_slug",
      });
      return;
    }

    await logChecker({
      slug: picked.slug,
      pattern: picked.slug,
      source: source === "hero" ? "hero" : "calculator",
      result: "AVAILABLE",
    });

    res.json({
      ok: true,
      source,
      slug: picked.slug,
      estimatedPrice: picked.price,
      segment: "low_mid",
      cache: "miss",
      ttlMs: adaptiveTtlMs,
    });

    if (!bypassPickCache) {
      affordablePickCache.expiresAt = now + adaptiveTtlMs;
      affordablePickCache.slug = picked.slug;
      affordablePickCache.estimatedPrice = picked.price;
      if (affordableCandidatesCache.expiresAt < now + adaptiveTtlMs) {
        affordableCandidatesCache.expiresAt = now + adaptiveTtlMs;
      }
    } else {
      affordablePickCache.slug = picked.slug;
    }
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

    const [pricing, slugRow] = await Promise.all([
      calculateSlugPriceFromSettings({
        letters: parsed.letters,
        digits: parsed.digits,
      }),
      withMissingTableFallback("Slug", null, () =>
        prisma.slug.findUnique({
          where: { fullSlug: slug },
          select: { price: true },
        }),
      ),
    ]);
    const hasPriceOverride = typeof slugRow?.price === "number";
    const basePrice = hasPriceOverride ? Number(slugRow.price) : Number(pricing.total);
    const activeSale = await getActiveFlashSale();
    const flash = applyFlashSaleToPrice({
      slug,
      basePrice,
      sale: activeSale,
    });

    res.json({
      slug,
      validFormat: true,
      price: flash.finalPrice,
      basePrice: flash.basePrice,
      calculatedPrice: Number(pricing.total),
      calculation: {
        basePrice: Number(pricing.basePrice || 0),
        lettersMultiplier: Number(pricing.letters?.multiplier || 1),
        digitsMultiplier: Number(pricing.digits?.multiplier || 1),
        multipliedBase: Number(pricing.multipliedBase || 0),
        customDeltaTotal: Number(pricing.customDeltaTotal || 0),
        customBreakdown: Array.isArray(pricing.customBreakdown) ? pricing.customBreakdown : [],
      },
      hasFlashSale: flash.hasDiscount,
      discountAmount: flash.discountAmount,
      discountPercent: flash.discountPercent,
      flashSaleId: flash.hasDiscount ? activeSale.id : null,
      source: hasPriceOverride ? "override" : "calculator",
    });
  }),
);

router.get(
  "/pricing",
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    const userId = sessionUser?.userId ? String(sessionUser.userId) : null;
    const [pricing, user, braceletPrice] = await Promise.all([
      getPricingSettings(),
      userId
        ? prisma.user.findUnique({
          where: { id: userId },
          select: { plan: true },
        })
        : Promise.resolve(null),
      getBraceletPrice(),
    ]);

    res.json({
      ...pricing,
      braceletPrice,
      userPlan: user?.plan || "none",
    });
  }),
);

router.get(
  "/order-precheck",
  asyncHandler(async (req, res) => {
    const requestedPlan = String(req.query.requestedPlan || req.query.plan || "").trim().toLowerCase() === "premium" ? "premium" : "basic";
    const activeOrdersLimit = 3;
    const sessionUser = getUserSession(req);
    const promoCodeInput = normalizePromoCode(req.query.promoCode || req.query.promo || "");
    const attribution = resolveOrderAttribution({
      body: {},
      query: req.query || {},
      path: req.path || req.originalUrl || "",
    });

    const safeFailPrecheck = (message = "Временная ошибка precheck. Попробуйте снова.") => {
      res.json({
        authenticated: Boolean(sessionUser?.userId),
        accountStatus: sessionUser?.userId ? "active" : "guest",
        currentPlan: "none",
        requestedPlan,
        resolvedPlan: requestedPlan,
        canPurchase: false,
        nextAction: sessionUser?.userId ? "retry" : "login",
        message,
        pricing: {
          planBasicPrice: 50_000,
          planPremiumPrice: 130_000,
          premiumUpgradePrice: 80_000,
          braceletPrice: 300_000,
          planChargePreview: requestedPlan === "premium" ? 130_000 : 50_000,
        },
        limits: {
          activeOrdersLimit,
          activeOrdersCount: 0,
          slugLimit: requestedPlan === "premium" ? 3 : 1,
          userSlugsCount: 0,
        },
        referral: {
          enabled: false,
          source: attribution.refSource,
          offer: attribution.refOffer,
          promoCodeApplied: "",
          campaignApplied: false,
          campaignType: null,
          campaignName: "",
          walletBalance: 0,
          hasReferrer: false,
          firstOrderEligible: false,
          inviteeDiscountCandidate: 0,
          bonusSpendCandidate: 0,
          capPercent: 30,
          fraudVerdict: "allow",
          fraudHint: "",
          breakdown: {
            inviteeDiscountApplied: 0,
            bonusSpent: 0,
            discountCapApplied: 0,
            productDiscountAmount: 0,
          },
        },
        pendingOrder: null,
      });
    };

    let pricing;
    let braceletPrice;
    let referralSettings;
    let referralV2Settings;
    let campaignResolved;
    let promoPolicy;
    try {
      [pricing, braceletPrice, referralSettings, referralV2Settings, campaignResolved, promoPolicy] = await Promise.all([
        getPricingSettings(),
        getBraceletPrice(),
        getReferralV1Settings(),
        getReferralV2Settings(),
        safeResolveCampaignForCheckout({
          source: attribution.refSource,
          offer: attribution.refOffer,
          promoCode: promoCodeInput,
        }),
        getPromoPolicySettings(),
      ]);
    } catch (error) {
      console.error("[express-app] order-precheck base load failed", error);
      safeFailPrecheck("Не удалось загрузить precheck. Попробуйте снова.");
      return;
    }
    const campaignPreview = buildCampaignSnapshot({
      campaign: campaignResolved.campaign,
      referrerReward: referralSettings.referrerReward,
      inviteeDiscount: referralSettings.inviteeDiscount,
      discountCapPercent: referralSettings.discountCapPercent,
      normalizedPromoCode: campaignResolved.normalizedPromoCode,
    });

    if (!sessionUser?.userId) {
      res.json({
        authenticated: false,
        accountStatus: "guest",
        currentPlan: "none",
        requestedPlan,
        resolvedPlan: requestedPlan,
        canPurchase: false,
        nextAction: "login",
        message: "Войдите в аккаунт, чтобы продолжить покупку тарифа.",
        pricing: {
          ...pricing,
          braceletPrice,
          planChargePreview: requestedPlan === "premium" ? pricing.planPremiumPrice : pricing.planBasicPrice,
        },
        limits: {
          activeOrdersLimit,
          activeOrdersCount: 0,
          slugLimit: requestedPlan === "premium" ? 3 : 1,
          userSlugsCount: 0,
        },
        referral: {
          enabled: referralSettings.enabled,
          source: attribution.refSource,
          offer: attribution.refOffer,
          promoCodeApplied: campaignPreview.promoCodeApplied || "",
          campaignApplied: campaignPreview.campaignApplied,
          campaignType: campaignPreview.campaignType,
          campaignName: campaignPreview.campaignName,
          walletBalance: 0,
          hasReferrer: false,
          firstOrderEligible: false,
          inviteeDiscountCandidate: 0,
          bonusSpendCandidate: 0,
          capPercent: referralSettings.discountCapPercent,
          fraudVerdict: "allow",
          fraudHint: "",
          breakdown: {
            inviteeDiscountApplied: 0,
            bonusSpent: 0,
            discountCapApplied: 0,
            productDiscountAmount: 0,
          },
        },
        pendingOrder: null,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: {
        id: true,
        status: true,
        plan: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
      },
    });

    if (!user) {
      res.json({
        authenticated: false,
        accountStatus: "guest",
        currentPlan: "none",
        requestedPlan,
        resolvedPlan: requestedPlan,
        canPurchase: false,
        nextAction: "login",
        message: "Сессия устарела. Войдите снова.",
        pricing: {
          ...pricing,
          braceletPrice,
          planChargePreview: requestedPlan === "premium" ? pricing.planPremiumPrice : pricing.planBasicPrice,
        },
        limits: {
          activeOrdersLimit,
          activeOrdersCount: 0,
          slugLimit: requestedPlan === "premium" ? 3 : 1,
          userSlugsCount: 0,
        },
        referral: {
          enabled: referralSettings.enabled,
          source: attribution.refSource,
          offer: attribution.refOffer,
          promoCodeApplied: campaignPreview.promoCodeApplied || "",
          campaignApplied: campaignPreview.campaignApplied,
          campaignType: campaignPreview.campaignType,
          campaignName: campaignPreview.campaignName,
          walletBalance: 0,
          hasReferrer: false,
          firstOrderEligible: false,
          inviteeDiscountCandidate: 0,
          bonusSpendCandidate: 0,
          capPercent: referralSettings.discountCapPercent,
          fraudVerdict: "allow",
          fraudHint: "",
          breakdown: {
            inviteeDiscountApplied: 0,
            bonusSpent: 0,
            discountCapApplied: 0,
            productDiscountAmount: 0,
          },
        },
        pendingOrder: null,
      });
      return;
    }

    const currentPlan = normalizePlan(user.plan);
    const resolvedPlan = resolveRequestedPlanForOrder({
      currentPlan,
      requestedPlan,
    });
    const slugLimit = resolvedPlan === "premium" ? 3 : 1;

    const [activeOrdersCount, userSlugsCount, latestActiveOrder, supportTelegramRaw, walletBalance, firstApprovedOrderExists, referrerLink] = await Promise.all([
      prisma.slugRequest.count({
        where: {
          userId: user.id,
          status: { in: ["new", "contacted", "paid"] },
        },
      }),
      withMissingTableFallback("Slug", 0, () =>
        prisma.slug.count({
          where: {
            ownerId: user.id,
            status: { in: ["approved", "active", "paused", "private"] },
          },
        }),
      ),
      findLatestActiveOrderSafe(user.id),
      getSetting("contact_support_telegram", `@${FALLBACK_SUPPORT_TELEGRAM}`),
      safeGetWalletBalance(user.id),
      safeHasApprovedSlugPurchase(user.id),
      safeResolveReferrerForUser({
        userId: user.id,
        explicitRefCode: attribution.refCode,
        sessionRefCode: req.session?.pendingRefCode,
      }),
    ]);
    const campaignEligibility = await safeEvaluateCampaignEligibility({
      campaign: campaignResolved.campaign,
      userId: user.id,
      settings: referralV2Settings,
    });
    const effectiveCampaign = campaignEligibility.allowed ? campaignResolved.campaign : null;
    const campaignSnapshot = buildCampaignSnapshot({
      campaign: effectiveCampaign,
      referrerReward: referralSettings.referrerReward,
      inviteeDiscount: referralSettings.inviteeDiscount,
      discountCapPercent: referralSettings.discountCapPercent,
      normalizedPromoCode: campaignResolved.normalizedPromoCode,
    });
    const supportTelegram = normalizeTelegramUsername(supportTelegramRaw);
    const fullName = [user.firstName, user.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ") || String(user.displayName || "").trim();

    let pendingOrder = null;
    if (latestActiveOrder) {
      const slugRow = await withMissingTableFallback("Slug", null, () =>
        prisma.slug.findUnique({
          where: { fullSlug: latestActiveOrder.slug },
          select: {
            status: true,
            pendingExpiresAt: true,
          },
        }),
      );
      const slugIsPending = String(slugRow?.status || "") === "pending";
      if (slugIsPending) {
        pendingOrder = {
          id: latestActiveOrder.id,
          slug: latestActiveOrder.slug,
          status: latestActiveOrder.status,
          requestedPlan: latestActiveOrder.requestedPlan,
          paymentReference: getOrderPaymentReference(latestActiveOrder.id),
          slugPrice: Number(latestActiveOrder.slugPrice || 0),
          planPrice: Number(latestActiveOrder.planPrice || 0),
          inviteeDiscountApplied: Number(latestActiveOrder.inviteeDiscountApplied || 0),
          bonusSpent: Number(latestActiveOrder.bonusSpent || 0),
          discountCapApplied: Number(latestActiveOrder.discountCapApplied || 0),
          campaignId: latestActiveOrder.campaignId || null,
          promoCodeApplied: latestActiveOrder.promoCode || "",
          campaignSnapshot: latestActiveOrder.campaignSnapshot || null,
          fraudVerdict: latestActiveOrder.fraudVerdict || "allow",
          fraudHint: latestActiveOrder.fraudReason || "",
          bracelet: Boolean(latestActiveOrder.bracelet),
          braceletPrice: Number(braceletPrice || 0),
          totalOneTime:
            Math.max(
              0,
              Number(latestActiveOrder.slugPrice || 0) -
                Number(latestActiveOrder.inviteeDiscountApplied || 0) -
                Number(latestActiveOrder.bonusSpent || 0),
            ) +
            Number(latestActiveOrder.planPrice || 0) +
            (latestActiveOrder.bracelet ? Number(braceletPrice || 0) : 0),
          paymentUrl: buildManualTelegramPaymentUrl({
            orderId: latestActiveOrder.id,
            slug: latestActiveOrder.slug,
            requestedPlan: latestActiveOrder.requestedPlan,
            reference: getOrderPaymentReference(latestActiveOrder.id),
            telegramUsername: supportTelegram,
            fullName,
            email: user.email || "",
            slugPrice: latestActiveOrder.slugPrice,
            planPrice: latestActiveOrder.planPrice,
            inviteeDiscountApplied: latestActiveOrder.inviteeDiscountApplied,
            bonusSpent: latestActiveOrder.bonusSpent,
            bracelet: Boolean(latestActiveOrder.bracelet),
            braceletPrice,
            totalAmount:
              Math.max(
                0,
                Number(latestActiveOrder.slugPrice || 0) -
                  Number(latestActiveOrder.inviteeDiscountApplied || 0) -
                  Number(latestActiveOrder.bonusSpent || 0),
              ) +
              Number(latestActiveOrder.planPrice || 0) +
              (latestActiveOrder.bracelet ? Number(braceletPrice || 0) : 0),
          }),
          createdAt: latestActiveOrder.createdAt,
          pendingExpiresAt: slugRow?.pendingExpiresAt || null,
        };
      }
    }

    let nextAction = "checkout";
    let canPurchase = true;
    let message = "";

    if (user.status === "blocked" || user.status === "deactivated") {
      nextAction = "blocked";
      canPurchase = false;
      message = "Аккаунт временно недоступен. Обратитесь в поддержку.";
    } else if (pendingOrder) {
      nextAction = "resume_pending";
      canPurchase = false;
      message = `У вас уже есть незавершённый заказ ${pendingOrder.slug}. Продолжите оплату или отмените заказ.`;
    } else if (activeOrdersCount >= activeOrdersLimit) {
      nextAction = "limit_reached";
      canPurchase = false;
      message = `У вас уже есть ${activeOrdersLimit} активных заказов. Дождитесь обработки или отмените один.`;
    } else if (userSlugsCount >= slugLimit) {
      nextAction = "slug_limit_reached";
      canPurchase = false;
      message = slugLimit === 3 ? "Достигнут лимит: 3 UNQ для тарифа Премиум." : "Для нового UNQ требуется переход на Премиум.";
    } else if (currentPlan === "premium") {
      nextAction = "checkout";
      canPurchase = true;
      message = "Тариф Премиум уже активен. Оплачиваются только slug и дополнительные товары.";
    } else if (currentPlan === "basic" && requestedPlan === "basic") {
      nextAction = "checkout";
      canPurchase = true;
      message = "Тариф Базовый уже активен. Вы можете выбрать Премиум для расширенных возможностей.";
    } else if (currentPlan === "basic" && requestedPlan === "premium") {
      nextAction = "upgrade";
      canPurchase = true;
      message = "Доступно обновление до тарифа Премиум.";
    }

    const discountCandidate = resolveInviteeDiscountCandidate({
      referralEnabled: referralSettings.enabled,
      campaignSnapshot,
      promoPolicy,
      hasReferrer: Boolean(referrerLink?.referrerId),
      firstApprovedOrderExists,
    });
    const firstOrderEligible = discountCandidate.allowed;
    const inviteeDiscountCandidate = discountCandidate.amount;
    const referralPreview = computeDiscountAllocation({
      slugBasePrice: 0,
      slugPriceAfterProductDiscount: 0,
      inviteeDiscountCandidate,
      walletBalance,
      discountCapPercent: campaignSnapshot.discountCapPercent,
    });

    res.json({
      authenticated: true,
      accountStatus: user.status || "active",
      currentPlan,
      requestedPlan,
      resolvedPlan,
      canPurchase,
      nextAction,
      message,
      pricing: {
        ...pricing,
        braceletPrice,
        planChargePreview: getPlanCharge({
          currentPlan,
          requestedPlan: resolvedPlan,
          pricing,
        }),
      },
      limits: {
        activeOrdersLimit,
        activeOrdersCount,
        slugLimit,
        userSlugsCount,
      },
      referral: {
        enabled: referralSettings.enabled,
        source: attribution.refSource,
        offer: attribution.refOffer,
        promoCodeApplied: campaignSnapshot.promoCodeApplied || "",
        campaignApplied: campaignSnapshot.campaignApplied,
        campaignType: campaignSnapshot.campaignType,
        campaignName: campaignSnapshot.campaignName,
        refCode: referrerLink?.refCode || attribution.refCode || "",
        hasReferrer: Boolean(referrerLink?.referrerId),
        firstOrderEligible,
        walletBalance,
        inviteeDiscountCandidate,
        bonusSpendCandidate: Math.max(0, Math.round(Number(walletBalance || 0))),
        capPercent: campaignSnapshot.discountCapPercent,
        promoPolicy,
        fraudVerdict: "allow",
        fraudHint: discountCandidate.reason || campaignEligibility.reason || "",
        breakdown: {
          inviteeDiscountApplied: referralPreview.inviteeDiscountApplied,
          bonusSpent: referralPreview.bonusSpent,
          discountCapApplied: referralPreview.discountCapApplied,
          productDiscountAmount: referralPreview.productDiscountAmount,
        },
      },
      pendingOrder,
    });
  }),
);

router.get(
  "/slug-pricing-config",
  asyncHandler(async (_req, res) => {
    const config = await getSlugPricingConfig();
    res.json(config);
  }),
);

router.post(
  "/order-request",
  publicOrderRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    if (!userSession?.userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userSession.userId },
      select: {
        id: true,
        telegramChatId: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        username: true,
        telegramUsername: true,
        plan: true,
        status: true,
      },
    });

    if (!user || user.status === "blocked" || user.status === "deactivated") {
      res.status(403).json({ error: "Аккаунт недоступен", code: "ACCOUNT_DISABLED" });
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
    const activeOrdersLimit = 3;
    const activeOrdersCount = await prisma.slugRequest.count({
      where: {
        userId: user.id,
        status: { in: ["new", "contacted", "paid"] },
      },
    });
    if (activeOrdersCount >= activeOrdersLimit) {
      res.status(429).json({
        error: `У вас уже есть ${activeOrdersLimit} активных заказов. Дождитесь обработки или отмените один.`,
        code: "TOO_MANY_ACTIVE_ORDERS",
        activeOrdersLimit,
      });
      return;
    }

    const attribution = resolveOrderAttribution({
      body: payload,
      query: req.query || {},
      path: req.path || req.originalUrl || "",
    });
    const promoCodeInput = normalizePromoCode(payload.promoCode || req.query?.promoCode || "");
    const [pricing, referralSettings, referralV2Settings, walletBalance, firstApprovedOrderExists, referrerLink, campaignResolved, promoPolicy] = await Promise.all([
      getPricingSettings(),
      getReferralV1Settings(),
      getReferralV2Settings(),
      safeGetWalletBalance(user.id),
      safeHasApprovedSlugPurchase(user.id),
      safeResolveReferrerForUser({
        userId: user.id,
        explicitRefCode: attribution.refCode || payload.refCode,
        sessionRefCode: req.session?.pendingRefCode,
      }),
      safeResolveCampaignForCheckout({
        source: attribution.refSource,
        offer: attribution.refOffer,
        promoCode: promoCodeInput,
      }),
      getPromoPolicySettings(),
    ]);
    const campaignEligibility = await safeEvaluateCampaignEligibility({
      campaign: campaignResolved.campaign,
      userId: user.id,
      settings: referralV2Settings,
    });
    const effectiveCampaign = campaignEligibility.allowed ? campaignResolved.campaign : null;
    const campaignSnapshot = buildCampaignSnapshot({
      campaign: effectiveCampaign,
      referrerReward: referralSettings.referrerReward,
      inviteeDiscount: referralSettings.inviteeDiscount,
      discountCapPercent: referralSettings.discountCapPercent,
      normalizedPromoCode: campaignResolved.normalizedPromoCode,
    });
    const requestedPlan = resolveRequestedPlanForOrder({
      currentPlan: user.plan,
      requestedPlan: payload.tariff,
    });
    const slugLimit = requestedPlan === "premium" ? 3 : 1;
    const userSlugsCount = await withMissingTableFallback("Slug", 0, () =>
      prisma.slug.count({
        where: {
          ownerId: user.id,
          status: { in: ["approved", "active", "paused", "private"] },
        },
      }),
    );
    if (userSlugsCount >= slugLimit) {
      res.status(403).json({
        error: slugLimit === 3 ? "Premium UNQ limit reached" : "Upgrade required",
        code: slugLimit === 3 ? "PREMIUM_SLUG_LIMIT_REACHED" : "BASIC_SLUG_LIMIT_REACHED",
      });
      return;
    }
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

    const braceletPriceValue = await getBraceletPrice();
    const slugPricingConfig = await getSlugPricingConfig();
    const basePricing =
      typeof state.priceOverride === "number"
        ? {
          total: state.priceOverride,
        }
        : calculateSlugPrice({ letters: payload.letters, digits: payload.digits, config: slugPricingConfig });
    const activeFlashSale = await getActiveFlashSale();
    const flashApplied = applyFlashSaleToPrice({
      slug,
      basePrice: basePricing.total,
      sale: activeFlashSale,
    });
    const slugPriceAfterProductDiscount = flashApplied.finalPrice;
    const fraudCheck = await runFraudCheck({
      userId: user.id,
      ipRaw: req.ip || req.get("x-forwarded-for") || req.get("x-real-ip") || "",
      userAgent: req.get("user-agent") || "",
      persist: false,
    });
    let effectiveCampaignForOrder = effectiveCampaign;
    let campaignSnapshotForOrder = campaignSnapshot;
    if (fraudCheck.verdict === "block") {
      effectiveCampaignForOrder = null;
      campaignSnapshotForOrder = buildCampaignSnapshot({
        campaign: null,
        referrerReward: referralSettings.referrerReward,
        inviteeDiscount: referralSettings.inviteeDiscount,
        discountCapPercent: referralSettings.discountCapPercent,
        normalizedPromoCode: campaignResolved.normalizedPromoCode,
      });
    }

    const discountCandidate = resolveInviteeDiscountCandidate({
      referralEnabled: referralSettings.enabled,
      campaignSnapshot: campaignSnapshotForOrder,
      promoPolicy,
      hasReferrer: Boolean(referrerLink?.referrerId),
      firstApprovedOrderExists,
    });
    const firstOrderEligible = discountCandidate.allowed;
    const inviteeDiscountCandidate = discountCandidate.amount;
    const referralPricing = computeDiscountAllocation({
      slugBasePrice: basePricing.total,
      slugPriceAfterProductDiscount,
      inviteeDiscountCandidate,
      walletBalance,
      discountCapPercent: campaignSnapshotForOrder.discountCapPercent,
    });
    const finalSlugPrice = referralPricing.finalSlugPayable;
    const planPrice = getPlanCharge({
      currentPlan: user.plan,
      requestedPlan,
      pricing,
    });
    const tariffPriceLabelValue =
      requestedPlan === "premium"
        ? user.plan === "premium"
          ? 0
          : user.plan === "basic"
            ? pricing.premiumUpgradePrice
            : pricing.planPremiumPrice
        : user.plan === "none"
          ? pricing.planBasicPrice
          : 0;
    const braceletPrice = payload.products.bracelet ? braceletPriceValue : 0;
    const totalOneTime = finalSlugPrice + planPrice + braceletPrice;
    const theme = requestedPlan === "premium" ? normalizeTheme(payload.theme) : undefined;
    const requestedAt = new Date();
    const pendingExpiryHours = Math.max(1, Math.min(168, Number(await getSetting("pending_expiry_hours", 24)) || 24));
    const pendingExpiresAt = new Date(Date.now() + pendingExpiryHours * 60 * 60 * 1000);
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
            userId: user.id,
            slug,
            slugPrice: finalSlugPrice,
            requestedPlan,
            planPrice,
            bracelet: Boolean(payload.products.bracelet),
            status: "new",
            dropId: drop ? drop.id : null,
            flashSaleId: flashApplied.hasDiscount ? activeFlashSale.id : null,
            flashDiscountAmount: flashApplied.discountAmount,
            refCode: referrerLink?.refCode || attribution.refCode || null,
            refSource: attribution.refSource || null,
            refOffer: attribution.refOffer || null,
            campaignId: effectiveCampaignForOrder?.id || null,
            promoCode: campaignSnapshotForOrder.promoCodeApplied || null,
            fraudVerdict: fraudCheck.verdict || "allow",
            fraudReason: fraudCheck.reason || null,
            campaignSnapshot: campaignSnapshotForOrder,
            inviteeDiscountApplied: referralPricing.inviteeDiscountApplied,
            bonusSpent: referralPricing.bonusSpent,
            discountCapApplied: referralPricing.discountCapApplied,
          },
          select: { id: true, status: true, slug: true },
        });

        if (tx.referralFraudCheck) {
          await tx.referralFraudCheck.create({
            data: {
              orderId: slugRequest.id,
              userId: user.id,
              ipHash: fraudCheck.ipHash || null,
              deviceHash: fraudCheck.deviceHash || null,
              velocityIpCount: Number(fraudCheck.velocityIpCount || 0),
              velocityDeviceCount: Number(fraudCheck.velocityDeviceCount || 0),
              score: Number(fraudCheck.score || 0),
              reason: fraudCheck.reason || null,
              verdict: fraudCheck.verdict || "allow",
            },
          });
        }

        if (effectiveCampaignForOrder?.id) {
          await reserveCampaignUsage({
            tx,
            campaignId: effectiveCampaignForOrder.id,
            userId: user.id,
            orderId: slugRequest.id,
            amountSpent: referralPricing.inviteeDiscountApplied,
            idempotencyKey: `campaign:${effectiveCampaignForOrder.id}:order:${slugRequest.id}:reserve`,
          });
        }

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
    const payment = await buildOrderPaymentDraft({
      orderId: order.id,
      amount: totalOneTime,
    });
    const supportTelegram = normalizeTelegramUsername(
      await getSetting("contact_support_telegram", `@${FALLBACK_SUPPORT_TELEGRAM}`),
    );
    const fullName =
      String(payload.name || "").trim() ||
      [user.firstName, user.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
    const paymentTelegramUrl = buildManualTelegramPaymentUrl({
      orderId: order.id,
      slug,
      requestedPlan,
      reference: payment.reference,
      telegramUsername: supportTelegram,
      fullName,
      email: user.email || "",
      slugPrice: finalSlugPrice,
      slugPriceBeforeDiscount: slugPriceAfterProductDiscount,
      inviteeDiscountApplied: referralPricing.inviteeDiscountApplied,
      bonusSpent: referralPricing.bonusSpent,
      planPrice,
      bracelet: Boolean(payload.products.bracelet),
      braceletPrice,
      totalAmount: totalOneTime,
    });
    try {
      await sendOrderRequestToTelegram({
        orderId: order.id,
        name: payload.name,
        telegramId: user.telegramChatId || "",
        email: user.email || "",
        username: user.telegramUsername || user.username || "",
        slug,
        slugPriceLabel: formatPrice(finalSlugPrice),
        tariff: requestedPlan,
        tariffPriceLabel: formatPrice(tariffPriceLabelValue),
        bracelet: payload.products.bracelet,
        braceletPrice: braceletPriceValue,
        contact: user.username ? `@${user.username}` : `${user.firstName}`,
        totalOneTimeLabel: formatPrice(totalOneTime),
        statusLabel: toOrderStatusLabel("NEW"),
        themeLabel: theme || "default_dark",
        payment,
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

    try {
      await logPaymentEvent({
        orderId: order.id,
        userId: user.id,
        status: "new",
        provider: payment.provider,
        reference: payment.reference,
        amount: payment.amount,
        actor: `user:${user.id}`,
        source: "order_request",
        note: telegramDelivered ? "Order created" : `Order created, telegram warning: ${telegramError || "unknown"}`,
      });
    } catch (error) {
      console.error("[express-app] failed to log payment event for order request", error);
    }

    res.json({
      ok: true,
      orderId: order.id,
      pendingExpiresAt,
      telegramDelivered,
      pricing: {
        slugBasePrice: Math.max(0, Math.round(Number(basePricing.total || 0))),
        slugPriceAfterProductDiscount: slugPriceAfterProductDiscount,
        productDiscountAmount: referralPricing.productDiscountAmount,
        campaignApplied: campaignSnapshotForOrder.campaignApplied,
        campaignType: campaignSnapshotForOrder.campaignType,
        campaignName: campaignSnapshotForOrder.campaignName,
        promoCodeApplied: campaignSnapshotForOrder.promoCodeApplied || "",
        inviteeDiscountApplied: referralPricing.inviteeDiscountApplied,
        bonusSpent: referralPricing.bonusSpent,
        discountCapApplied: referralPricing.discountCapApplied,
        fraudVerdict: fraudCheck.verdict || "allow",
        fraudHint: fraudCheck.reason || "",
        slugPrice: finalSlugPrice,
        planPrice,
        braceletPrice,
        totalOneTime,
      },
      referral: {
        enabled: referralSettings.enabled,
        source: attribution.refSource,
        offer: attribution.refOffer,
        promoCodeApplied: campaignSnapshotForOrder.promoCodeApplied || "",
        campaignApplied: campaignSnapshotForOrder.campaignApplied,
        campaignType: campaignSnapshotForOrder.campaignType,
        campaignName: campaignSnapshotForOrder.campaignName,
        campaignId: campaignSnapshotForOrder.campaignId,
        refCode: referrerLink?.refCode || attribution.refCode || "",
        hasReferrer: Boolean(referrerLink?.referrerId),
        firstOrderEligible,
        walletBalance,
        capPercent: campaignSnapshotForOrder.discountCapPercent,
        rewardAmount: campaignSnapshotForOrder.referrerReward,
        promoPolicy,
        fraudVerdict: fraudCheck.verdict || "allow",
        fraudHint: discountCandidate.reason || fraudCheck.reason || "",
      },
      payment,
      paymentLinks: {
        telegramUrl: paymentTelegramUrl,
      },
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
  "/order-request/:orderId/cancel",
  requireUserApi,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    const sessionUserId = sessionUser?.userId ? String(sessionUser.userId) : "";
    const orderId = String(req.params.orderId || "").trim();

    if (!sessionUserId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    if (!orderId) {
      res.status(400).json({ error: "Order ID is required" });
      return;
    }

    // Find order
    const order = await prisma.slugRequest.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        slug: true,
        status: true,
        createdAt: true,
      },
    });

    if (!order) {
      res.status(404).json({ error: "Заказ не найден" });
      return;
    }

    // Check ownership
    if (String(order.userId || "") !== sessionUserId) {
      res.status(403).json({ error: "Это не ваш заказ" });
      return;
    }

    const orderStatus = String(order.status || "").toLowerCase();
    const cancelableStatuses = new Set(["new", "contacted", "paid"]);

    // Allow cancellation for any unfinished order statuses shown in precheck.
    if (!cancelableStatuses.has(orderStatus)) {
      res.status(400).json({
        error: "Нельзя отменить заказ в статусе: " + order.status,
        currentStatus: order.status,
      });
      return;
    }

    // Update order status to rejected and free the slug
    await prisma.$transaction(async (tx) => {
      // Update order
      await tx.slugRequest.update({
        where: { id: order.id },
        data: {
          status: "rejected",
          adminNote: "Отменено пользователем",
        },
      });

      // Free the slug
      await tx.slug.update({
        where: { fullSlug: order.slug },
        data: {
          status: "free",
          ownerId: null,
          pendingExpiresAt: null,
        },
      });

      if (tx.referralCampaignUsage) {
        await tx.referralCampaignUsage.updateMany({
          where: {
            orderId: order.id,
            status: "reserved",
          },
          data: {
            status: "released",
            releasedAt: new Date(),
          },
        });
      }
    });

    // Log cancellation event
    try {
      await logPaymentEvent({
        orderId: order.id,
        userId: sessionUserId,
        status: "rejected",
        provider: "manual_tg",
        reference: getOrderPaymentReference(order.id),
        amount: 0,
        actor: `user:${sessionUserId}`,
        source: "user_cancel",
        note: "User cancelled order",
      });
    } catch (error) {
      console.error("[express-app] failed to log cancel event", error);
    }

    res.json({
      ok: true,
      message: "Заказ отменён, slug освобождён",
      orderId: order.id,
      slug: order.slug,
    });
  }),
);

router.post(
  "/:slug/click",
  asyncHandler(async (req, res) => {
    const requestedSlug = sanitizeSlug(req.params.slug);
    const buttonType = normalizeButtonType(req.body?.buttonType);
    const sessionId = getAnalyticsSessionId(req, res);

    const slugRow = await withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { fullSlug: true, status: true, ownerId: true },
      }),
    );

    if (!slugRow || !["active", "private"].includes(slugRow.status)) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const dedupeSince = new Date(Date.now() - 30 * 1000);
      try {
        await tx.$executeRaw`
          INSERT INTO analytics_clicks (
            slug,
            button_type,
            session_id
          )
          SELECT
            ${slugRow.fullSlug},
            ${buttonType},
            ${sessionId}
          WHERE NOT EXISTS (
            SELECT 1
            FROM analytics_clicks ac
            WHERE ac.slug = ${slugRow.fullSlug}
              AND ac.button_type = ${buttonType}
              AND ac.session_id = ${sessionId}
              AND ac.clicked_at >= ${dedupeSince}
          )
        `;
      } catch (error) {
        if (!isMissingStorageError(error) && !isMissingModelColumn(error, "AnalyticsClick")) {
          throw error;
        }
        if (tx.analyticsClick) {
          await tx.analyticsClick.create({
            data: {
              slug: slugRow.fullSlug,
              buttonType,
            },
          });
        }
      }
    });

    res.json({ ok: true });
  }),
);

router.post(
  "/:slug/view",
  asyncHandler(async (req, res) => {
    const requestedSlug = sanitizeSlug(req.params.slug);

    const slugRow = await withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { fullSlug: true, status: true, ownerId: true },
      }),
    );

    if (!slugRow || !["active", "private"].includes(slugRow.status)) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    res.json({ ok: true });
    void recordView({
      req,
      res,
      ownerSlug: slugRow.fullSlug,
      ownerId: slugRow.ownerId || null,
      sourceInput: req.query?.src || req.body?.src,
    }).catch((error) => {
      console.error("[express-app] failed to write slug analytics view", error);
    });
  }),
);
router.get(
  "/:slug/vcf",
  asyncHandler(async (req, res) => {
    const requestedSlug = sanitizeSlug(req.params.slug);
    const slugRow = await withMissingTableFallback("Slug", null, () =>
      prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { fullSlug: true, status: true, ownerId: true },
      }),
    );

    if (slugRow && ["active", "private"].includes(slugRow.status) && slugRow.ownerId) {
      const [user, profileCard] = await Promise.all([
        prisma.user.findUnique({
          where: { id: slugRow.ownerId },
          select: { firstName: true, username: true },
        }),
        prisma.profileCard.findUnique({
          where: { ownerId: slugRow.ownerId },
          select: {
            name: true,
            buttons: true,
            bio: true,
            hashtag: true,
            email: true,
            extraPhone: true,
            address: true,
            postcode: true,
          },
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
          email: profileCard.email || emailRaw || undefined,
          extraPhone: profileCard.extraPhone || undefined,
          address: profileCard.address || "",
          postcode: profileCard.postcode || "",
          hashtag: profileCard.hashtag || profileCard.bio || "",
        });

        res.setHeader("Content-Type", "text/vcard; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${slugRow.fullSlug}.vcf"`);
        res.setHeader("Cache-Control", "no-store");
        res.send(payload);
        return;
      }
    }

    res.status(404).json({ error: "Card not found" });
  }),
);

module.exports = {
  publicApiRouter: router,
};







