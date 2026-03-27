const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { requireAdminApi } = require("../../middleware/auth");
const { adminApiRateLimit } = require("../../middleware/rate-limit");
const { buildLeaderboard, normalizePeriod, normalizeLeaderboardType } = require("../../services/leaderboard");
const { getFeatureSetting, setFeatureSetting } = require("../../services/feature-settings");
const { getPricingSettings, setPricingSettings } = require("../../services/pricing-settings");
const {
  getSettingsByGroup,
  setSettingsBatch,
  resetSettingToDefault,
  getSettingsChanges,
  getDefaultSettingDef,
  getManySettings,
} = require("../../services/platform-settings");
const { getSlugPricingConfig } = require("../../services/slug-pricing");
const { buildDropSlugPool, reserveDropSlugs, getDropLiveStats, releaseUnsoldDropSlugs } = require("../../services/drops");
const { sendTelegramMessage } = require("../../services/telegram");
const { recalculateAllScores, recalculateAndRefreshPercentiles } = require("../../services/unq-score");
const { normalizeSource, normalizeOffer } = require("../../services/referral-v2");
const {
  normalizePromoCode,
  normalizePromoStatus,
  normalizePromoDiscountType,
} = require("../../services/promo-codes");
const { recordBonusLedger } = require("../../services/referral-v1");

const router = express.Router();

router.use(adminApiRateLimit);
router.use(requireAdminApi);

const SETTINGS_GROUPS = new Set(["pricing", "algorithm", "bracelet", "contacts", "platform"]);
const FLASH_CONDITION_TYPES = new Set(["all", "pattern_000", "pattern_aaa", "sequential_digits", "custom"]);
const FLASH_SLUG_RE = /^[A-Z]{3}[0-9]{3}$/;
const FLASH_FULL_MASK_RE = /^[A-Z0-9*?]{6}$/;
const FLASH_LETTER_MASK_RE = /^[A-Z*?]{3}$/;
const FLASH_DIGIT_MASK_RE = /^[0-9*?]{3}$/;
const GROUP_KEY_PREFIX = {
  pricing: ["plan_", "pricing_"],
  algorithm: ["slug_"],
  bracelet: ["bracelet_"],
  contacts: ["contact_"],
  platform: ["platform_", "feature_", "pending_", "score_", "leaderboard_", "referral_", "promo_", "maintenance_"],
};

function isKnownGroup(group) {
  return SETTINGS_GROUPS.has(String(group || ""));
}

function isKeyAllowedForGroup(group, key) {
  const prefixes = GROUP_KEY_PREFIX[group] || [];
  return prefixes.some((prefix) => String(key || "").startsWith(prefix));
}

function validateSettingValue(key, value) {
  const k = String(key || "");
  if (k.endsWith("_price") || k === "slug_base_price") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return "Цена не может быть отрицательной";
  }
  if (k === "pending_expiry_hours") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 168) return "pending_expiry_hours должен быть от 1 до 168";
  }
  if (k.startsWith("slug_mult_")) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0.1 || n > 100) return "Множитель должен быть от 0.1 до 100";
  }
  if (k.endsWith("_slug_limit") || k.endsWith("_button_limit") || k.endsWith("_tag_limit")) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return "Лимит не может быть отрицательным";
  }
  return null;
}

function normalizeFlashLetters(value) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : "";
}

function normalizeFlashDigits(value) {
  const cleaned = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 3);
  return /^[0-9]{3}$/.test(cleaned) ? cleaned : "";
}

function normalizeFlashRule(type, value) {
  const normalizedType = String(type || "").trim().toLowerCase();
  if (normalizedType === "slug") {
    const cleaned = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return FLASH_SLUG_RE.test(cleaned) ? { type: "slug", value: cleaned } : null;
  }
  if (normalizedType === "mask") {
    const cleaned = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9*?]/g, "");
    if (!cleaned) return null;
    if (FLASH_FULL_MASK_RE.test(cleaned)) return { type: "mask", value: cleaned };
    if (FLASH_LETTER_MASK_RE.test(cleaned)) return { type: "mask", value: cleaned + "***" };
    if (FLASH_DIGIT_MASK_RE.test(cleaned)) return { type: "mask", value: "***" + cleaned };
    return null;
  }
  if (normalizedType === "letters") {
    const letters = normalizeFlashLetters(value);
    return letters ? { type: "letters", value: letters } : null;
  }
  if (normalizedType === "digits") {
    const digits = normalizeFlashDigits(value);
    return digits ? { type: "digits", value: digits } : null;
  }
  return null;
}

function parseFlashPatternToken(value) {
  const rawToken = String(value || "").trim();
  if (!rawToken) return null;
  const isExclude = rawToken.startsWith("!") || rawToken.startsWith("-");
  const token = isExclude ? rawToken.slice(1).trim() : rawToken;
  if (!token) return null;

  const typed = token.match(/^([a-z_]+):(.*)$/i);
  if (typed) {
    const parsed = normalizeFlashRule(typed[1], typed[2]);
    if (!parsed) return null;
    return { type: parsed.type, value: parsed.value, exclude: isExclude };
  }

  const bySlug = normalizeFlashRule("slug", token);
  if (bySlug) return { type: bySlug.type, value: bySlug.value, exclude: isExclude };
  const byMask = normalizeFlashRule("mask", token);
  if (byMask) return { type: byMask.type, value: byMask.value, exclude: isExclude };
  return null;
}

function tokenizePatternsInput(raw) {
  return String(raw || "")
    .split(/[\s,;]+/g)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeFlashConditionValue(conditionType, rawConditionValue) {
  if (conditionType !== "custom") return null;

  const matchModeRaw =
    rawConditionValue && typeof rawConditionValue === "object" ? String(rawConditionValue.matchMode || "any") : "any";
  const matchMode = matchModeRaw.toLowerCase() === "all" ? "all" : "any";
  const parsed = [];

  if (typeof rawConditionValue === "string") {
    parsed.push(...tokenizePatternsInput(rawConditionValue));
  } else if (rawConditionValue && typeof rawConditionValue === "object") {
    if (Array.isArray(rawConditionValue.allowedSlugs)) {
      parsed.push(...rawConditionValue.allowedSlugs.map((item) => String(item || "")));
    }
    if (Array.isArray(rawConditionValue.slugPatterns)) {
      parsed.push(...rawConditionValue.slugPatterns.map((item) => String(item || "")));
    }
    if (Array.isArray(rawConditionValue.includeRules)) {
      for (const rule of rawConditionValue.includeRules) {
        if (rule && typeof rule === "object") {
          parsed.push(String(rule.type || "").trim() + ":" + String(rule.value || "").trim());
        }
      }
    }
    if (Array.isArray(rawConditionValue.excludeRules)) {
      for (const rule of rawConditionValue.excludeRules) {
        if (rule && typeof rule === "object") {
          parsed.push("!" + String(rule.type || "").trim() + ":" + String(rule.value || "").trim());
        }
      }
    }
    if (typeof rawConditionValue.patternsInput === "string") {
      parsed.push(...tokenizePatternsInput(rawConditionValue.patternsInput));
    }
  }

  const includeRules = [];
  const excludeRules = [];
  const seen = new Set();
  for (const token of parsed) {
    const normalized = parseFlashPatternToken(token);
    if (!normalized) continue;
    const target = normalized.exclude ? "exclude" : "include";
    const dedupeKey = target + ":" + normalized.type + ":" + normalized.value;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (normalized.exclude) {
      excludeRules.push({ type: normalized.type, value: normalized.value });
    } else {
      includeRules.push({ type: normalized.type, value: normalized.value });
    }
  }

  if (!includeRules.length) {
    return { error: "Для custom-условия укажите хотя бы один slug или паттерн" };
  }

  const allowedSlugs = includeRules.filter((item) => item.type === "slug").map((item) => item.value);
  const slugPatterns = includeRules.filter((item) => item.type === "mask").map((item) => item.value);

  return {
    value: {
      matchMode,
      includeRules,
      excludeRules,
      allowedSlugs,
      slugPatterns,
    },
  };
}

function normalizeFlashDiscountPercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 1 || percent > 95) {
    return { error: "discountPercent должен быть от 1 до 95" };
  }
  return { value: Math.trunc(percent) };
}

function parseIsoDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `${fieldName} должен быть валидной датой` };
  }
  return { value: date };
}

function normalizeCampaignType(value, fallback = "promo_code") {
  const type = String(value || "").trim().toLowerCase();
  return type === "source_offer" || type === "promo_code" ? type : fallback;
}

function normalizeCampaignStatus(value, fallback = "draft") {
  const status = String(value || "").trim().toLowerCase();
  return ["draft", "active", "paused", "archived"].includes(status) ? status : fallback;
}

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const board = await buildLeaderboard(
      normalizePeriod(req.query.period),
      normalizeLeaderboardType(req.query.type),
    );
    res.json({
      period: board.period,
      type: board.type,
      settings: board.settings,
      items: board.items,
    });
  }),
);

router.patch(
  "/leaderboard/settings",
  asyncHandler(async (req, res) => {
    const current = await getFeatureSetting("leaderboard");
    const next = await setFeatureSetting("leaderboard", {
      ...current,
      enabled: req.body.enabled === undefined ? current.enabled : Boolean(req.body.enabled),
      publicLimit: Number(req.body.publicLimit || current.publicLimit || 20),
      suspiciousThreshold: Number(req.body.suspiciousThreshold || current.suspiciousThreshold || 50),
      suspiciousWindowMinutes: Number(req.body.suspiciousWindowMinutes || current.suspiciousWindowMinutes || 10),
    });
    res.json({ ok: true, settings: next });
  }),
);

router.patch(
  "/leaderboard/exclusions/:slug",
  asyncHandler(async (req, res) => {
    const fullSlug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const excluded = Boolean(req.body.excluded);
    if (excluded) {
      await prisma.leaderboardExclusion.upsert({
        where: { fullSlug },
        create: {
          fullSlug,
          reason: String(req.body.reason || "").trim() || null,
          excludedBy: req.session?.admin?.login || "admin",
        },
        update: {
          reason: String(req.body.reason || "").trim() || null,
          excludedBy: req.session?.admin?.login || "admin",
        },
      });
    } else {
      await prisma.leaderboardExclusion.deleteMany({ where: { fullSlug } });
    }
    res.json({ ok: true });
  }),
);

router.post(
  "/leaderboard/reset-user/:userId",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "");
    const slugs = await prisma.slug.findMany({
      where: { ownerId: userId },
      select: { fullSlug: true },
    });
    const targets = slugs.map((row) => row.fullSlug);
    if (targets.length) {
      await prisma.analyticsView.deleteMany({ where: { slug: { in: targets } } });
    }
    res.json({ ok: true, removed: targets.length });
  }),
);

router.get(
  "/leaderboard/suspicious",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.leaderboardSuspiciousLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    res.json({ items: rows });
  }),
);

router.get(
  "/score/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getFeatureSetting("unqScore");
    res.json({ settings });
  }),
);

router.patch(
  "/score/settings",
  asyncHandler(async (req, res) => {
    const current = await getFeatureSetting("unqScore");
    const next = await setFeatureSetting("unqScore", {
      ...current,
      enabledOnCards: req.body.enabledOnCards === undefined ? current.enabledOnCards : Boolean(req.body.enabledOnCards),
    });
    res.json({ ok: true, settings: next });
  }),
);

router.get(
  "/score/overview",
  asyncHandler(async (_req, res) => {
    if (!prisma.unqScore) {
      res.json({ items: [] });
      return;
    }
    const rows = await prisma.unqScore.findMany({
      orderBy: [{ score: "desc" }, { percentile: "desc" }],
      take: 500,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            username: true,
            profileCard: { select: { name: true } },
            slugs: {
              where: { status: { in: ["active", "private", "paused", "approved"] } },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
              select: { fullSlug: true },
            },
          },
        },
      },
    });
    res.json({
      items: rows.map((row) => ({
        userId: row.userId,
        userName: row.user?.profileCard?.name || row.user?.firstName || row.user?.username || "UNQX User",
        slug: row.user?.slugs?.[0]?.fullSlug || "—",
        score: row.score,
        percentile: row.percentile,
        calculatedAt: row.calculatedAt,
        breakdown: {
          views: row.scoreViews,
          rarity: row.scoreSlugRarity,
          tenure: row.scoreTenure,
          ctr: row.scoreCtr,
          bracelet: row.scoreBracelet,
          plan: row.scorePlan,
        },
      })),
    });
  }),
);

router.post(
  "/score/recalculate/:userId",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "");
    if (!userId) {
      res.status(400).json({ error: "User ID required" });
      return;
    }
    const row = await recalculateAndRefreshPercentiles(userId);
    res.json({ ok: true, score: row?.score || 0 });
  }),
);

router.post(
  "/score/recalculate-all",
  asyncHandler(async (_req, res) => {
    const result = await recalculateAllScores({ reason: "manual" });
    res.json({ ok: true, result });
  }),
);

router.get(
  "/score/runs",
  asyncHandler(async (_req, res) => {
    if (!prisma.scoreRecalculationRun) {
      res.json({ items: [] });
      return;
    }
    const rows = await prisma.scoreRecalculationRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    });
    res.json({ items: rows });
  }),
);

router.get(
  "/referrals/stats",
  asyncHandler(async (req, res) => {
    const where = {};
    if (typeof req.query.source === "string" && req.query.source.trim()) {
      where.refSource = req.query.source.trim().toLowerCase();
    }
    if (typeof req.query.offer === "string" && req.query.offer.trim()) {
      where.refOffer = req.query.offer.trim().toLowerCase();
    }
    if (typeof req.query.dateFrom === "string" && req.query.dateFrom.trim()) {
      const date = new Date(req.query.dateFrom);
      if (Number.isFinite(date.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), gte: date };
      }
    }
    if (typeof req.query.dateTo === "string" && req.query.dateTo.trim()) {
      const date = new Date(req.query.dateTo);
      if (Number.isFinite(date.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), lte: date };
      }
    }
    const [total, approved, rewardSum, ledgerCredit, ledgerDebit] = await Promise.all([
      prisma.referralConversion ? prisma.referralConversion.count({ where }) : Promise.resolve(0),
      prisma.referralConversion ? prisma.referralConversion.count({ where: { ...where, status: "approved" } }) : Promise.resolve(0),
      prisma.referralConversion
        ? prisma.referralConversion.aggregate({
            where: { ...where, status: "approved" },
            _sum: { rewardAmount: true },
          })
        : Promise.resolve({ _sum: { rewardAmount: 0 } }),
      prisma.bonusLedger
        ? prisma.bonusLedger.aggregate({
            where: { direction: "credit" },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      prisma.bonusLedger
        ? prisma.bonusLedger.aggregate({
            where: { direction: "debit" },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
    ]);
    res.json({
      totalRegistrations: total,
      conversionPaid: total > 0 ? Number(((approved / total) * 100).toFixed(2)) : 0,
      rewarded: approved,
      rewardAmount: Number(rewardSum?._sum?.rewardAmount || 0),
      bonusCredited: Number(ledgerCredit?._sum?.amount || 0),
      bonusDebited: Number(ledgerDebit?._sum?.amount || 0),
    });
  }),
);

router.get(
  "/referrals",
  asyncHandler(async (req, res) => {
    const where = {};
    if (typeof req.query.source === "string" && req.query.source.trim()) {
      where.refSource = req.query.source.trim().toLowerCase();
    }
    if (typeof req.query.offer === "string" && req.query.offer.trim()) {
      where.refOffer = req.query.offer.trim().toLowerCase();
    }
    if (typeof req.query.status === "string" && req.query.status.trim()) {
      where.status = req.query.status.trim().toLowerCase();
    }
    const rows = prisma.referralConversion
      ? await prisma.referralConversion.findMany({
          where,
          include: {
            referrer: { select: { id: true, username: true, firstName: true } },
            referred: { select: { id: true, username: true, firstName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];
    res.json({ items: rows });
  }),
);

router.get(
  "/referrals/campaigns",
  asyncHandler(async (_req, res) => {
    const items = prisma.referralCampaign
      ? await prisma.referralCampaign.findMany({
          orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
          take: 500,
        })
      : [];
    res.json({ items });
  }),
);

router.post(
  "/referrals/campaigns",
  asyncHandler(async (req, res) => {
    if (!prisma.referralCampaign) {
      res.status(503).json({ error: "Referral campaign storage unavailable" });
      return;
    }
    const type = normalizeCampaignType(req.body.type, "");
    if (!type) {
      res.status(400).json({ error: "Invalid campaign type" });
      return;
    }
    const status = normalizeCampaignStatus(req.body.status, "draft");
    const promoCode = type === "promo_code" ? normalizePromoCode(req.body.promoCode || "") : "";
    const source = type === "source_offer" ? normalizeSource(req.body.source || "") : "";
    const offer = type === "source_offer" ? normalizeOffer(req.body.offer || "") : "";
    if (type === "promo_code" && !promoCode) {
      res.status(400).json({ error: "Promo code is required for promo campaign" });
      return;
    }
    if (type === "source_offer" && (!source || !offer)) {
      res.status(400).json({ error: "Source and offer are required for source/offer campaign" });
      return;
    }
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      res.status(400).json({ error: "Invalid startsAt" });
      return;
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      res.status(400).json({ error: "Invalid endsAt" });
      return;
    }
    if (startsAt && endsAt && startsAt > endsAt) {
      res.status(400).json({ error: "startsAt must be before endsAt" });
      return;
    }
    const created = await prisma.referralCampaign.create({
      data: {
        name: String(req.body.name || "").trim() || "Referral campaign",
        type,
        status,
        source: type === "source_offer" ? source : null,
        offer: type === "source_offer" ? offer : null,
        promoCode: type === "promo_code" ? promoCode : null,
        rewardAmountOverride:
          req.body.rewardAmountOverride === undefined ? null : Math.max(0, Math.round(Number(req.body.rewardAmountOverride || 0))),
        inviteeDiscountOverride:
          req.body.inviteeDiscountOverride === undefined ? null : Math.max(0, Math.round(Number(req.body.inviteeDiscountOverride || 0))),
        discountCapPercentOverride:
          req.body.discountCapPercentOverride === undefined ? null : Math.max(0, Math.min(100, Number(req.body.discountCapPercentOverride || 0))),
        priority: Math.round(Number(req.body.priority || 0)),
        budgetAmount: Math.max(0, Math.round(Number(req.body.budgetAmount || 0))),
        perUserCap: Math.max(1, Math.round(Number(req.body.perUserCap || 1))),
        startsAt,
        endsAt,
        createdBy: req.session?.admin?.login || "admin",
      },
    });
    res.status(201).json({ ok: true, item: created });
  }),
);

router.patch(
  "/referrals/campaigns/:id",
  asyncHandler(async (req, res) => {
    if (!prisma.referralCampaign) {
      res.status(503).json({ error: "Referral campaign storage unavailable" });
      return;
    }
    const existing = await prisma.referralCampaign.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const nextType = req.body.type !== undefined ? normalizeCampaignType(req.body.type, existing.type) : existing.type;
    const nextPromoCode = req.body.promoCode !== undefined ? normalizePromoCode(req.body.promoCode || "") : String(existing.promoCode || "");
    const nextSource = req.body.source !== undefined ? normalizeSource(req.body.source || "") : String(existing.source || "");
    const nextOffer = req.body.offer !== undefined ? normalizeOffer(req.body.offer || "") : String(existing.offer || "");
    if (nextType === "promo_code" && !nextPromoCode) {
      res.status(400).json({ error: "Promo code is required for promo campaign" });
      return;
    }
    if (nextType === "source_offer" && (!nextSource || !nextOffer)) {
      res.status(400).json({ error: "Source and offer are required for source/offer campaign" });
      return;
    }
    const startsAt = req.body.startsAt !== undefined ? (req.body.startsAt ? new Date(req.body.startsAt) : null) : existing.startsAt;
    const endsAt = req.body.endsAt !== undefined ? (req.body.endsAt ? new Date(req.body.endsAt) : null) : existing.endsAt;
    if (startsAt && Number.isNaN(new Date(startsAt).getTime())) {
      res.status(400).json({ error: "Invalid startsAt" });
      return;
    }
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) {
      res.status(400).json({ error: "Invalid endsAt" });
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      res.status(400).json({ error: "startsAt must be before endsAt" });
      return;
    }
    const updated = await prisma.referralCampaign.update({
      where: { id: existing.id },
      data: {
        ...(req.body.name !== undefined ? { name: String(req.body.name || "").trim() || existing.name } : {}),
        ...(req.body.type !== undefined ? { type: nextType } : {}),
        ...(req.body.status !== undefined ? { status: normalizeCampaignStatus(req.body.status, existing.status) } : {}),
        ...(req.body.source !== undefined ? { source: nextType === "source_offer" ? nextSource : null } : {}),
        ...(req.body.offer !== undefined ? { offer: nextType === "source_offer" ? nextOffer : null } : {}),
        ...(req.body.promoCode !== undefined ? { promoCode: nextType === "promo_code" ? nextPromoCode : null } : {}),
        ...(req.body.rewardAmountOverride !== undefined ? { rewardAmountOverride: Math.max(0, Math.round(Number(req.body.rewardAmountOverride || 0))) } : {}),
        ...(req.body.inviteeDiscountOverride !== undefined ? { inviteeDiscountOverride: Math.max(0, Math.round(Number(req.body.inviteeDiscountOverride || 0))) } : {}),
        ...(req.body.discountCapPercentOverride !== undefined ? { discountCapPercentOverride: Math.max(0, Math.min(100, Number(req.body.discountCapPercentOverride || 0))) } : {}),
        ...(req.body.priority !== undefined ? { priority: Math.round(Number(req.body.priority || 0)) } : {}),
        ...(req.body.budgetAmount !== undefined ? { budgetAmount: Math.max(0, Math.round(Number(req.body.budgetAmount || 0))) } : {}),
        ...(req.body.perUserCap !== undefined ? { perUserCap: Math.max(1, Math.round(Number(req.body.perUserCap || 1))) } : {}),
        ...(req.body.startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
        ...(req.body.endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.delete(
  "/referrals/campaigns/:id",
  asyncHandler(async (req, res) => {
    if (!prisma.referralCampaign) {
      res.status(503).json({ error: "Referral campaign storage unavailable" });
      return;
    }
    const existing = await prisma.referralCampaign.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    await prisma.referralCampaign.delete({ where: { id: existing.id } });
    res.json({ ok: true, deleted: true });
  }),
);

router.get(
  "/referrals/campaigns/:id/usage",
  asyncHandler(async (req, res) => {
    const items = prisma.referralCampaignUsage
      ? await prisma.referralCampaignUsage.findMany({
          where: { campaignId: req.params.id },
          include: {
            user: { select: { id: true, username: true, firstName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];
    res.json({ items });
  }),
);

router.get(
  "/promocodes",
  asyncHandler(async (_req, res) => {
    const items = prisma.promoCode
      ? await prisma.promoCode.findMany({
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 500,
        })
      : [];
    res.json({ items });
  }),
);

router.post(
  "/promocodes",
  asyncHandler(async (req, res) => {
    if (!prisma.promoCode) {
      res.status(503).json({ error: "Promo-code storage unavailable" });
      return;
    }
    const name = String(req.body.name || "").trim();
    const promoCode = normalizePromoCode(req.body.promoCode || req.body.code || "");
    const status = normalizePromoStatus(req.body.status, "draft");
    const discountType = normalizePromoDiscountType(req.body.discountType, "discount_amount");
    const discountValue = Math.max(0, Math.round(Number(req.body.discountValue || 0)));
    if (!name) {
      res.status(400).json({ error: "Promo name is required" });
      return;
    }
    if (!promoCode) {
      res.status(400).json({ error: "Promo code is required" });
      return;
    }
    if (discountType === "discount_amount" && discountValue <= 0) {
      res.status(400).json({ error: "Discount value must be greater than 0" });
      return;
    }
    if (discountType === "discount_percent" && (discountValue <= 0 || discountValue > 100)) {
      res.status(400).json({ error: "Discount percent must be between 1 and 100" });
      return;
    }
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      res.status(400).json({ error: "Invalid startsAt" });
      return;
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      res.status(400).json({ error: "Invalid endsAt" });
      return;
    }
    if (startsAt && endsAt && startsAt > endsAt) {
      res.status(400).json({ error: "startsAt must be before endsAt" });
      return;
    }
    const budgetAmount = Math.max(0, Math.round(Number(req.body.budgetAmount || 0)));
    const perUserCap = Math.max(1, Math.round(Number(req.body.perUserCap || 1)));

    try {
      const item = await prisma.promoCode.create({
        data: {
          code: promoCode,
          name,
          status,
          discountType,
          discountValue,
          budgetAmount,
          perUserCap,
          startsAt,
          endsAt,
          createdBy: req.session?.admin?.login || "admin",
        },
      });
      res.json({ ok: true, item });
    } catch (error) {
      if (error?.code === "P2002") {
        res.status(409).json({ error: "Promo code already exists" });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/promocodes/:id",
  asyncHandler(async (req, res) => {
    if (!prisma.promoCode) {
      res.status(503).json({ error: "Promo-code storage unavailable" });
      return;
    }
    const existing = await prisma.promoCode.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Promo code not found" });
      return;
    }
    const nextCode = req.body.promoCode !== undefined || req.body.code !== undefined
      ? normalizePromoCode(req.body.promoCode || req.body.code || "")
      : String(existing.code || "");
    if ((req.body.promoCode !== undefined || req.body.code !== undefined) && !nextCode) {
      res.status(400).json({ error: "Promo code is required" });
      return;
    }
    const nextDiscountType =
      req.body.discountType !== undefined
        ? normalizePromoDiscountType(req.body.discountType, existing.discountType)
        : existing.discountType;
    const nextDiscountValue =
      req.body.discountValue !== undefined
        ? Math.max(0, Math.round(Number(req.body.discountValue || 0)))
        : Number(existing.discountValue || 0);
    if (nextDiscountType === "discount_amount" && nextDiscountValue <= 0) {
      res.status(400).json({ error: "Discount value must be greater than 0" });
      return;
    }
    if (nextDiscountType === "discount_percent" && (nextDiscountValue <= 0 || nextDiscountValue > 100)) {
      res.status(400).json({ error: "Discount percent must be between 1 and 100" });
      return;
    }
    const startsAt =
      req.body.startsAt !== undefined ? (req.body.startsAt ? new Date(req.body.startsAt) : null) : existing.startsAt;
    const endsAt =
      req.body.endsAt !== undefined ? (req.body.endsAt ? new Date(req.body.endsAt) : null) : existing.endsAt;
    if (startsAt && Number.isNaN(new Date(startsAt).getTime())) {
      res.status(400).json({ error: "Invalid startsAt" });
      return;
    }
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) {
      res.status(400).json({ error: "Invalid endsAt" });
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      res.status(400).json({ error: "startsAt must be before endsAt" });
      return;
    }

    try {
      const item = await prisma.promoCode.update({
        where: { id: existing.id },
        data: {
          ...(req.body.name !== undefined ? { name: String(req.body.name || "").trim() || existing.name } : {}),
          ...(req.body.status !== undefined ? { status: normalizePromoStatus(req.body.status, existing.status) } : {}),
          ...(req.body.promoCode !== undefined || req.body.code !== undefined ? { code: nextCode } : {}),
          ...(req.body.discountType !== undefined ? { discountType: nextDiscountType } : {}),
          ...(req.body.discountValue !== undefined ? { discountValue: nextDiscountValue } : {}),
          ...(req.body.budgetAmount !== undefined ? { budgetAmount: Math.max(0, Math.round(Number(req.body.budgetAmount || 0))) } : {}),
          ...(req.body.perUserCap !== undefined ? { perUserCap: Math.max(1, Math.round(Number(req.body.perUserCap || 1))) } : {}),
          ...(req.body.startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
          ...(req.body.endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
        },
      });
      res.json({ ok: true, item });
    } catch (error) {
      if (error?.code === "P2002") {
        res.status(409).json({ error: "Promo code already exists" });
        return;
      }
      throw error;
    }
  }),
);

router.delete(
  "/promocodes/:id",
  asyncHandler(async (req, res) => {
    if (!prisma.promoCode) {
      res.status(503).json({ error: "Promo-code storage unavailable" });
      return;
    }
    const existing = await prisma.promoCode.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Promo code not found" });
      return;
    }
    await prisma.promoCode.delete({ where: { id: existing.id } });
    res.json({ ok: true, deleted: true });
  }),
);

router.get(
  "/promocodes/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getManySettings([
      "feature_promo_codes",
      "promo_codes_first_order_only",
    ]);
    res.json({ settings });
  }),
);

router.patch(
  "/promocodes/settings",
  asyncHandler(async (req, res) => {
    const payload = {};
    if (req.body.promoCodesEnabled !== undefined) payload.feature_promo_codes = Boolean(req.body.promoCodesEnabled);
    if (req.body.promoFirstOrderOnly !== undefined) payload.promo_codes_first_order_only = Boolean(req.body.promoFirstOrderOnly);
    await setSettingsBatch("platform", payload, req.session?.admin?.login || "admin");
    const next = await getManySettings([
      "feature_promo_codes",
      "promo_codes_first_order_only",
    ]);
    res.json({ ok: true, settings: next });
  }),
);

router.get(
  "/referrals/fraud",
  asyncHandler(async (req, res) => {
    const where = {};
    if (typeof req.query.verdict === "string" && req.query.verdict.trim()) {
      where.verdict = req.query.verdict.trim().toLowerCase();
    }
    const items = prisma.referralFraudCheck
      ? await prisma.referralFraudCheck.findMany({
          where,
          include: {
            user: { select: { id: true, username: true, firstName: true } },
            order: { select: { id: true, slug: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];
    res.json({ items });
  }),
);

router.patch(
  "/referrals/fraud/:id/verdict",
  asyncHandler(async (req, res) => {
    if (!prisma.referralFraudCheck) {
      res.status(503).json({ error: "Referral fraud storage unavailable" });
      return;
    }
    const verdict = String(req.body.verdict || "").trim().toLowerCase();
    if (!["allow", "block", "review"].includes(verdict)) {
      res.status(400).json({ error: "Invalid verdict" });
      return;
    }
    const item = await prisma.referralFraudCheck.update({
      where: { id: req.params.id },
      data: {
        verdict,
        reason: req.body.reason !== undefined ? String(req.body.reason || "") : undefined,
      },
      include: { order: { select: { id: true } } },
    });
    if (item.orderId && prisma.slugRequest) {
      const order = await prisma.slugRequest.update({
        where: { id: item.orderId },
        data: {
          fraudVerdict: verdict,
          ...(req.body.reason !== undefined ? { fraudReason: String(req.body.reason || "") } : {}),
        },
        select: {
          id: true,
          campaignSnapshot: true,
        },
      });
      if (verdict === "allow" && prisma.referralConversion && prisma.bonusLedger && prisma.userBonusWallet) {
        const conversion = await prisma.referralConversion.findUnique({
          where: { orderId: item.orderId },
          select: {
            id: true,
            referrerId: true,
            status: true,
            rewardAmount: true,
            purchaseId: true,
          },
        });
        if (conversion && conversion.status !== "approved") {
          const rewardAmount = Math.max(
            0,
            Math.round(Number(order?.campaignSnapshot?.referrerReward || conversion.rewardAmount || 0)),
          );
          const updatedConversion = await prisma.referralConversion.update({
            where: { id: conversion.id },
            data: {
              status: "approved",
              rewardAmount,
              approvedAt: new Date(),
            },
            select: { id: true, referrerId: true, orderId: true, purchaseId: true, rewardAmount: true },
          });
          if (rewardAmount > 0) {
            await prisma.$transaction(async (tx) => {
              await recordBonusLedger({
                tx,
                userId: updatedConversion.referrerId,
                delta: rewardAmount,
                kind: "referral_reward",
                idempotencyKey: `refconv:${updatedConversion.id}:reward`,
                orderId: updatedConversion.orderId || item.orderId,
                purchaseId: updatedConversion.purchaseId || null,
                conversionId: updatedConversion.id,
                note: `Referral reward approved by fraud review`,
              });
            });
          }
        }
      }
    }
    res.json({ ok: true, item });
  }),
);

router.get(
  "/referrals/ledger",
  asyncHandler(async (req, res) => {
    const where = {};
    if (typeof req.query.kind === "string" && req.query.kind.trim()) {
      where.kind = req.query.kind.trim().toLowerCase();
    }
    if (typeof req.query.direction === "string" && req.query.direction.trim()) {
      where.direction = req.query.direction.trim().toLowerCase();
    }
    if (typeof req.query.dateFrom === "string" && req.query.dateFrom.trim()) {
      const date = new Date(req.query.dateFrom);
      if (Number.isFinite(date.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), gte: date };
      }
    }
    if (typeof req.query.dateTo === "string" && req.query.dateTo.trim()) {
      const date = new Date(req.query.dateTo);
      if (Number.isFinite(date.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), lte: date };
      }
    }
    const rows = prisma.bonusLedger
      ? await prisma.bonusLedger.findMany({
          where,
          include: {
            user: { select: { id: true, username: true, firstName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];
    res.json({ items: rows });
  }),
);

router.get(
  "/referrals/summary",
  asyncHandler(async (_req, res) => {
    const [bySource, byOffer] = await Promise.all([
      prisma.referralConversion
        ? prisma.referralConversion.groupBy({
            by: ["refSource"],
            _count: { _all: true },
            _sum: { rewardAmount: true },
            orderBy: { _count: { refSource: "desc" } },
            take: 50,
          })
        : Promise.resolve([]),
      prisma.referralConversion
        ? prisma.referralConversion.groupBy({
            by: ["refOffer"],
            _count: { _all: true },
            _sum: { rewardAmount: true },
            orderBy: { _count: { refOffer: "desc" } },
            take: 100,
          })
        : Promise.resolve([]),
    ]);
    res.json({ bySource, byOffer });
  }),
);

router.patch(
  "/referrals/:id/status",
  asyncHandler(async (req, res) => {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!["pending", "approved", "reversed"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    if (!prisma.referralConversion) {
      res.status(503).json({ error: "Referral conversion storage unavailable" });
      return;
    }
    const updated = await prisma.referralConversion.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === "approved" ? { approvedAt: new Date() } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.post(
  "/referrals/:id/reward",
  asyncHandler(async (req, res) => {
    if (!prisma.referralConversion || !prisma.userBonusWallet || !prisma.bonusLedger) {
      res.status(503).json({ error: "Referral wallet storage unavailable" });
      return;
    }
    const amount = Math.max(0, Math.round(Number(req.body.amount || 0)));
    if (!amount) {
      res.status(400).json({ error: "Amount is required" });
      return;
    }
    const conversion = await prisma.referralConversion.findUnique({
      where: { id: req.params.id },
      include: {
        referrer: { select: { id: true, username: true, firstName: true } },
        referred: { select: { id: true } },
      },
    });
    if (!conversion) {
      res.status(404).json({ error: "Referral conversion not found" });
      return;
    }
    const idempotencyKey = `admin:manual_reward:${conversion.id}:${amount}`;
    await prisma.$transaction(async (tx) => {
      const exists = await tx.bonusLedger.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (exists) {
        return;
      }
      const wallet = await tx.userBonusWallet.upsert({
        where: { userId: conversion.referrerId },
        create: { userId: conversion.referrerId, balance: 0 },
        update: {},
      });
      const nextBalance = Number(wallet.balance || 0) + amount;
      await tx.userBonusWallet.update({
        where: { userId: conversion.referrerId },
        data: { balance: nextBalance },
      });
      await tx.bonusLedger.create({
        data: {
          userId: conversion.referrerId,
          direction: "credit",
          kind: "manual_adjustment",
          amount,
          balanceAfter: nextBalance,
          idempotencyKey,
          conversionId: conversion.id,
          note: "Manual reward adjustment from admin panel",
        },
      });
    });
    res.json({ ok: true, item: conversion });
  }),
);

router.patch(
  "/referrals/settings",
  asyncHandler(async (req, res) => {
    const payload = {};
    if (req.body.enabled !== undefined) payload.feature_referrals = Boolean(req.body.enabled);
    if (req.body.referrerReward !== undefined) payload.referral_v1_referrer_reward = Math.max(0, Math.round(Number(req.body.referrerReward || 0)));
    if (req.body.inviteeDiscount !== undefined) payload.referral_v1_invitee_discount = Math.max(0, Math.round(Number(req.body.inviteeDiscount || 0)));
    if (req.body.discountCapPercent !== undefined) payload.referral_v1_discount_cap_percent = Math.max(0, Math.min(100, Number(req.body.discountCapPercent || 0)));
    if (req.body.tiersEnabled !== undefined) payload.referral_v1_tiers_enabled = Boolean(req.body.tiersEnabled);
    if (req.body.fraudVelocityWindowHours !== undefined) payload.referral_v2_velocity_window_hours = Math.max(1, Math.min(168, Math.round(Number(req.body.fraudVelocityWindowHours || 24))));
    if (req.body.fraudVelocityIpLimit !== undefined) payload.referral_v2_velocity_ip_limit = Math.max(1, Math.round(Number(req.body.fraudVelocityIpLimit || 5)));
    if (req.body.fraudVelocityDeviceLimit !== undefined) payload.referral_v2_velocity_device_limit = Math.max(1, Math.round(Number(req.body.fraudVelocityDeviceLimit || 4)));
    if (req.body.fraudReviewScoreThreshold !== undefined) payload.referral_v2_review_score_threshold = Math.max(1, Math.round(Number(req.body.fraudReviewScoreThreshold || 60)));
    if (req.body.fraudBlockScoreThreshold !== undefined) payload.referral_v2_block_score_threshold = Math.max(1, Math.round(Number(req.body.fraudBlockScoreThreshold || 100)));
    if (req.body.defaultPerUserCap !== undefined) payload.referral_v2_default_per_user_cap = Math.max(1, Math.round(Number(req.body.defaultPerUserCap || 1)));
    await setSettingsBatch("platform", payload, req.session?.admin?.login || "admin");
    const next = await getManySettings([
      "feature_referrals",
      "referral_v1_referrer_reward",
      "referral_v1_invitee_discount",
      "referral_v1_discount_cap_percent",
      "referral_v1_tiers_enabled",
      "referral_v2_velocity_window_hours",
      "referral_v2_velocity_ip_limit",
      "referral_v2_velocity_device_limit",
      "referral_v2_review_score_threshold",
      "referral_v2_block_score_threshold",
      "referral_v2_default_per_user_cap",
    ]);
    res.json({ ok: true, settings: next });
  }),
);

router.get(
  "/referrals/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getManySettings([
      "feature_referrals",
      "referral_v1_referrer_reward",
      "referral_v1_invitee_discount",
      "referral_v1_discount_cap_percent",
      "referral_v1_tiers_enabled",
      "referral_v2_velocity_window_hours",
      "referral_v2_velocity_ip_limit",
      "referral_v2_velocity_device_limit",
      "referral_v2_review_score_threshold",
      "referral_v2_block_score_threshold",
      "referral_v2_default_per_user_cap",
    ]);
    res.json({ settings });
  }),
);

router.get(
  "/pricing/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getPricingSettings();
    res.json({ settings });
  }),
);

router.get(
  "/settings/changes",
  asyncHandler(async (req, res) => {
    const group = typeof req.query.group === "string" ? req.query.group : "";
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : "";
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize || 20));
    const payload = await getSettingsChanges({ group: group || undefined, dateFrom, dateTo, page, pageSize });
    res.json(payload);
  }),
);

router.get(
  "/settings/:group",
  asyncHandler(async (req, res) => {
    const group = String(req.params.group || "");
    if (!isKnownGroup(group)) {
      res.status(404).json({ error: "Unknown settings group" });
      return;
    }
    const rows = await getSettingsByGroup(group);
    const mapped = rows.map((item) => ({
      key: item.key,
      value: item.value,
      group: item.group,
      label: item.label,
      description: item.description,
      type: item.type,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
      defaultValue: getDefaultSettingDef(item.key)?.value,
    }));
    if (group === "algorithm") {
      const previewConfig = await getSlugPricingConfig();
      res.json({ group, items: mapped, previewConfig });
      return;
    }
    res.json({ group, items: mapped });
  }),
);

router.patch(
  "/settings/:group",
  asyncHandler(async (req, res) => {
    const group = String(req.params.group || "");
    if (!isKnownGroup(group)) {
      res.status(404).json({ error: "Unknown settings group" });
      return;
    }
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const invalid = [];
    const patch = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!isKeyAllowedForGroup(group, key)) {
        continue;
      }
      const issue = validateSettingValue(key, value);
      if (issue) {
        invalid.push({ key, message: issue });
        continue;
      }
      patch[key] = value;
    }
    if (invalid.length) {
      res.status(400).json({ error: "VALIDATION_ERROR", issues: invalid });
      return;
    }
    const changed = await setSettingsBatch(group, patch, req.session?.admin?.login || "admin");
    const rows = await getSettingsByGroup(group);
    res.json({
      ok: true,
      changed,
      warning:
        group === "pricing"
          ? "Изменение цены не затрагивает существующие покупки и активации."
          : group === "algorithm"
            ? "Изменение алгоритма не пересчитывает уже одобренные заявки. Новые цены применяются только к новым заявкам."
            : null,
      items: rows,
    });
  }),
);

router.post(
  "/settings/:group/reset/:key",
  asyncHandler(async (req, res) => {
    const group = String(req.params.group || "");
    const key = String(req.params.key || "");
    if (!isKnownGroup(group) || !isKeyAllowedForGroup(group, key)) {
      res.status(404).json({ error: "Unknown setting" });
      return;
    }
    const row = await resetSettingToDefault(key, req.session?.admin?.login || "admin");
    res.json({ ok: true, item: row });
  }),
);

router.patch(
  "/pricing/settings",
  asyncHandler(async (req, res) => {
    const current = await getPricingSettings();
    const next = await setPricingSettings({
      ...current,
      ...(req.body.planBasicPrice !== undefined ? { planBasicPrice: Number(req.body.planBasicPrice) } : {}),
      ...(req.body.planPremiumPrice !== undefined ? { planPremiumPrice: Number(req.body.planPremiumPrice) } : {}),
      ...(req.body.premiumUpgradePrice !== undefined ? { premiumUpgradePrice: Number(req.body.premiumUpgradePrice) } : {}),
      ...(req.body.pricingFootnote !== undefined ? { pricingFootnote: String(req.body.pricingFootnote || "") } : {}),
    });
    res.json({ ok: true, settings: next });
  }),
);

router.get(
  "/flash-sales",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.flashSale.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ items: rows });
  }),
);

router.post(
  "/flash-sales",
  asyncHandler(async (req, res) => {
    const conditionType = String(req.body.conditionType || "all");
    if (!FLASH_CONDITION_TYPES.has(conditionType)) {
      res.status(400).json({ error: "Некорректный conditionType" });
      return;
    }

    const discount = normalizeFlashDiscountPercent(req.body.discountPercent);
    if (discount.error) {
      res.status(400).json({ error: discount.error });
      return;
    }

    const startsAt = parseIsoDate(req.body.startsAt, "startsAt");
    if (startsAt.error) {
      res.status(400).json({ error: startsAt.error });
      return;
    }
    const endsAt = parseIsoDate(req.body.endsAt, "endsAt");
    if (endsAt.error) {
      res.status(400).json({ error: endsAt.error });
      return;
    }
    if (endsAt.value <= startsAt.value) {
      res.status(400).json({ error: "endsAt должен быть позже startsAt" });
      return;
    }

    const condition = normalizeFlashConditionValue(conditionType, req.body.conditionValue);
    if (condition?.error) {
      res.status(400).json({ error: condition.error });
      return;
    }

    const created = await prisma.flashSale.create({
      data: {
        title: String(req.body.title || "Flash sale").trim(),
        description: String(req.body.description || "").trim() || null,
        discountPercent: discount.value,
        conditionType,
        conditionValue: condition?.value || null,
        startsAt: startsAt.value,
        endsAt: endsAt.value,
        isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
        notifyTelegram: Boolean(req.body.notifyTelegram),
        telegramTarget: String(req.body.telegramTarget || "").trim() || null,
        createdByAdmin: req.session?.admin?.login || "admin",
      },
    });
    res.status(201).json({ ok: true, item: created });
  }),
);

router.patch(
  "/flash-sales/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.flashSale.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const nextConditionType = req.body.conditionType !== undefined ? String(req.body.conditionType || "all") : existing.conditionType;
    if (!FLASH_CONDITION_TYPES.has(nextConditionType)) {
      res.status(400).json({ error: "Некорректный conditionType" });
      return;
    }

    let nextStartsAt = existing.startsAt;
    if (req.body.startsAt !== undefined) {
      const startsAt = parseIsoDate(req.body.startsAt, "startsAt");
      if (startsAt.error) {
        res.status(400).json({ error: startsAt.error });
        return;
      }
      nextStartsAt = startsAt.value;
    }

    let nextEndsAt = existing.endsAt;
    if (req.body.endsAt !== undefined) {
      const endsAt = parseIsoDate(req.body.endsAt, "endsAt");
      if (endsAt.error) {
        res.status(400).json({ error: endsAt.error });
        return;
      }
      nextEndsAt = endsAt.value;
    }

    if (nextEndsAt <= nextStartsAt) {
      res.status(400).json({ error: "endsAt должен быть позже startsAt" });
      return;
    }

    let normalizedDiscount = null;
    if (req.body.discountPercent !== undefined) {
      normalizedDiscount = normalizeFlashDiscountPercent(req.body.discountPercent);
      if (normalizedDiscount.error) {
        res.status(400).json({ error: normalizedDiscount.error });
        return;
      }
    }

    let normalizedConditionValue;
    if (req.body.conditionType !== undefined || req.body.conditionValue !== undefined) {
      const sourceConditionValue = req.body.conditionValue !== undefined ? req.body.conditionValue : existing.conditionValue;
      const condition = normalizeFlashConditionValue(nextConditionType, sourceConditionValue);
      if (condition?.error) {
        res.status(400).json({ error: condition.error });
        return;
      }
      normalizedConditionValue = condition?.value || null;
    }

    const updated = await prisma.flashSale.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title || "") } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || "") || null } : {}),
        ...(normalizedDiscount ? { discountPercent: normalizedDiscount.value } : {}),
        ...(req.body.conditionType !== undefined ? { conditionType: nextConditionType } : {}),
        ...(normalizedConditionValue !== undefined ? { conditionValue: normalizedConditionValue } : {}),
        ...(req.body.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
        ...(req.body.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
        ...(req.body.notifyTelegram !== undefined ? { notifyTelegram: Boolean(req.body.notifyTelegram) } : {}),
        ...(req.body.telegramTarget !== undefined ? { telegramTarget: String(req.body.telegramTarget || "") || null } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.post(
  "/flash-sales/:id/stop",
  asyncHandler(async (req, res) => {
    const updated = await prisma.flashSale.update({
      where: { id: req.params.id },
      data: { isActive: false, endsAt: new Date() },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.delete(
  "/flash-sales/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.flashSale.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.flashSale.delete({
      where: { id: req.params.id },
    });
    res.json({ ok: true });
  }),
);

router.get(
  "/flash-sales/:id/stats",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [requests, sale] = await Promise.all([
      prisma.slugRequest.findMany({ where: { flashSaleId: id } }),
      prisma.flashSale.findUnique({ where: { id } }),
    ]);
    if (!sale) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const discountSum = requests.reduce((sum, row) => sum + Number(row.flashDiscountAmount || 0), 0);
    res.json({
      requestsCount: requests.length,
      discountSum,
    });
  }),
);

router.get(
  "/drops",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.drop.findMany({
      orderBy: { dropAt: "desc" },
      take: 200,
    });
    res.json({ items: rows });
  }),
);

router.post(
  "/drops",
  asyncHandler(async (req, res) => {
    const slugPatternType = String(req.body.slugPatternType || "random");
    const slugCount = Number(req.body.slugCount || 1);
    const manualList = String(req.body.manualSlugs || "")
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const pool = buildDropSlugPool({
      slugPatternType,
      slugCount,
      manualList,
    });

    const created = await prisma.drop.create({
      data: {
        title: String(req.body.title || "Drop").trim(),
        description: String(req.body.description || "").trim() || null,
        dropAt: new Date(req.body.dropAt),
        slugCount: pool.length,
        slugPatternType,
        slugsPool: pool,
        notifyTelegram: Boolean(req.body.notifyTelegram),
        telegramTarget: String(req.body.telegramTarget || "").trim() || null,
      },
    });

    await reserveDropSlugs(pool);

    if (created.notifyTelegram && created.telegramTarget) {
      try {
        await sendTelegramMessage({
          chatId: created.telegramTarget,
          text: `🔥 Новый дроп: ${created.title}\nДата: ${created.dropAt.toLocaleString("ru-RU")}\nunqx.uz/drops`,
          parseMode: "HTML",
        });
        await prisma.drop.update({ where: { id: created.id }, data: { isAnnounced: true } });
      } catch (error) {
        console.error("[express-app] failed to announce drop", error);
      }
    }

    res.status(201).json({ ok: true, item: created, pool });
  }),
);

router.patch(
  "/drops/:id",
  asyncHandler(async (req, res) => {
    const updated = await prisma.drop.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title || "") } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || "") || null } : {}),
        ...(req.body.dropAt !== undefined ? { dropAt: new Date(req.body.dropAt) } : {}),
        ...(req.body.notifyTelegram !== undefined ? { notifyTelegram: Boolean(req.body.notifyTelegram) } : {}),
        ...(req.body.telegramTarget !== undefined ? { telegramTarget: String(req.body.telegramTarget || "") || null } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.patch(
  "/drops/:id/slugs",
  asyncHandler(async (req, res) => {
    const pool = Array.from(
      new Set(
        (Array.isArray(req.body.slugs) ? req.body.slugs : [])
          .map((item) => String(item || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
          .filter((item) => /^[A-Z]{3}[0-9]{3}$/.test(item)),
      ),
    );

    const updated = await prisma.drop.update({
      where: { id: req.params.id },
      data: {
        slugsPool: pool,
        slugCount: pool.length,
      },
    });
    await reserveDropSlugs(pool);
    res.json({ ok: true, item: updated });
  }),
);

router.post(
  "/drops/:id/finish",
  asyncHandler(async (req, res) => {
    const updated = await prisma.drop.update({
      where: { id: req.params.id },
      data: {
        isLive: false,
        isFinished: true,
      },
    });
    await releaseUnsoldDropSlugs(updated.id);
    res.json({ ok: true, item: updated });
  }),
);

router.delete(
  "/drops/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.drop.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await releaseUnsoldDropSlugs(req.params.id);
    await prisma.drop.delete({
      where: { id: req.params.id },
    });
    res.json({ ok: true });
  }),
);

router.get(
  "/drops/:id/live",
  asyncHandler(async (req, res) => {
    const stats = await getDropLiveStats(req.params.id);
    if (!stats) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const buyers = await prisma.slugRequest.findMany({
      where: { dropId: req.params.id, status: { in: ["paid", "approved"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { userId: true, slug: true, createdAt: true },
    });
    res.json({ ...stats, buyers });
  }),
);

router.get(
  "/drops/:id/waitlist",
  asyncHandler(async (req, res) => {
    const items = await prisma.dropWaitlist.findMany({
      where: { dropId: req.params.id },
      include: { user: { select: { id: true, username: true, firstName: true } } },
      orderBy: { joinedAt: "desc" },
    });
    res.json({ items });
  }),
);

router.post(
  "/drops/:id/notify-manual",
  asyncHandler(async (req, res) => {
    const drop = await prisma.drop.findUnique({ where: { id: req.params.id } });
    if (!drop) {
      res.status(404).json({ error: "Drop not found" });
      return;
    }

    const waitlist = await prisma.dropWaitlist.findMany({
      where: { dropId: drop.id },
      include: {
        user: {
          select: {
            telegramChatId: true,
          },
        },
      },
    });
    for (const row of waitlist) {
      const chatId = row.user?.telegramChatId;
      if (!chatId) {
        continue;
      }
      try {
        await sendTelegramMessage({
          chatId,
          text: `🔔 Напоминание о дропе: ${drop.title}\nunqx.uz/drops`,
          parseMode: "HTML",
        });
        await prisma.dropWaitlist.update({ where: { id: row.id }, data: { notifiedAt: new Date() } });
      } catch (error) {
        console.error("[express-app] manual drop notify failed", error);
      }
    }

    res.json({ ok: true, sent: waitlist.length });
  }),
);

module.exports = {
  adminFeaturesApiRouter: router,
};

