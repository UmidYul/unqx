const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { getUserSession } = require("../../middleware/auth");
const { buildLeaderboard, getUserLeaderboardSummary, normalizePeriod } = require("../../services/leaderboard");
const { getFeatureSetting } = require("../../services/feature-settings");
const { getActiveFlashSale, resolveConditionLabel } = require("../../services/flash-sales");
const { getDropLiveStats } = require("../../services/drops");
const { getReferralBootstrap, claimReferralReward } = require("../../services/referrals");
const { getWalletBalance } = require("../../services/referral-v1");
const { getManySettings } = require("../../services/platform-settings");
const {
  normalizePromoCode,
  getActiveCampaignsSafe,
  resolveCampaignForCheckout,
  buildCampaignSnapshot,
} = require("../../services/referral-v2");
const { getReferralV1Settings } = require("../../services/referral-v1");

const router = express.Router();
const ONLINE_WINDOW_SECONDS = 90;
const SYNTHETIC_FINGERPRINT_PREFIX = "synthetic:";

async function countOnlineSessionsSince(onlineSince) {
  if (!prisma.analyticsView) return 0;
  try {
    const rows = await prisma.analyticsView.findMany({
      where: { visitedAt: { gte: onlineSince } },
      select: { sessionId: true, fingerprint: true },
    });
    return new Set(
      rows
        .filter((row) => !String(row.fingerprint || "").startsWith(SYNTHETIC_FINGERPRINT_PREFIX))
        .map((row) => String(row.sessionId || "").trim())
        .filter(Boolean),
    ).size;
  } catch (error) {
    const knownColumnErrors = new Set(["P2021", "P2022", "42703"]);
    if (!knownColumnErrors.has(String(error?.code || ""))) {
      throw error;
    }
    const rows = await prisma.analyticsView.findMany({
      where: { visitedAt: { gte: onlineSince } },
      select: { sessionId: true },
    });
    return new Set(rows.map((row) => String(row.sessionId || "").trim()).filter(Boolean)).size;
  }
}

function requireUser(req, res) {
  const userSession = getUserSession(req);
  if (!userSession?.userId) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    return null;
  }
  return userSession;
}

router.get(
  "/public/live-stats",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_SECONDS * 1000);

    const [activeCardsTotal, todayCreated, todayActivated, todayTotal, onlineNow] = await Promise.all([
      prisma.slug.count({ where: { status: "active" } }),
      prisma.slug.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.slug.count({ where: { activatedAt: { gte: todayStart } } }),
      prisma.slug.count({
        where: {
          OR: [{ createdAt: { gte: todayStart } }, { activatedAt: { gte: todayStart } }],
        },
      }),
      countOnlineSessionsSince(onlineSince),
    ]);

    res.json({
      activeCardsTotal,
      todayCreated,
      todayActivated,
      todayTotal,
      onlineNow,
    });
  }),
);

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const settings = await getFeatureSetting("leaderboard");
    if (!settings.enabled) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const period = normalizePeriod(req.query.period);
    const board = await buildLeaderboard(period);
    res.json({
      period: board.period,
      generatedAt: board.generatedAt,
      items: board.publicItems,
      limit: Number(board.settings.publicLimit) || 20,
    });
  }),
);

router.get(
  "/leaderboard/me",
  asyncHandler(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const period = normalizePeriod(req.query.period);
    const payload = await getUserLeaderboardSummary({ userId: user.userId, period });
    res.json({ item: payload });
  }),
);

router.get(
  "/flash-sale/active",
  asyncHandler(async (_req, res) => {
    const sale = await getActiveFlashSale();
    if (!sale) {
      res.json({ active: false });
      return;
    }
    res.json({
      active: true,
      sale: {
        id: sale.id,
        title: sale.title,
        description: sale.description,
        discountPercent: sale.discountPercent,
        startsAt: sale.startsAt,
        endsAt: sale.endsAt,
        conditionType: sale.conditionType,
        conditionLabel: resolveConditionLabel(sale),
      },
    });
  }),
);

router.get(
  "/drops",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.drop.findMany({
      orderBy: { dropAt: "desc" },
      take: 50,
    });
    const mapped = rows.map((row) => {
      const pool = Array.isArray(row.slugsPool) ? row.slugsPool : [];
      const sold = Array.isArray(row.soldSlugs) ? row.soldSlugs : [];
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        dropAt: row.dropAt,
        isLive: row.isLive,
        isSoldOut: row.isSoldOut,
        isFinished: row.isFinished,
        slugCount: row.slugCount || pool.length,
        remaining: Math.max(0, pool.length - sold.length),
      };
    });

    res.json({
      upcoming: mapped.filter((item) => !item.isFinished && !item.isLive),
      live: mapped.filter((item) => item.isLive),
      past: mapped.filter((item) => item.isFinished || item.isSoldOut),
      items: mapped,
    });
  }),
);

router.get(
  "/drops/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.drop.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: "Drop not found" });
      return;
    }
    const waitlistCount = await prisma.dropWaitlist.count({ where: { dropId: row.id } });
    const pool = Array.isArray(row.slugsPool) ? row.slugsPool : [];
    const sold = Array.isArray(row.soldSlugs) ? row.soldSlugs : [];

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      dropAt: row.dropAt,
      slugCount: row.slugCount || pool.length,
      isLive: row.isLive,
      isSoldOut: row.isSoldOut,
      isFinished: row.isFinished,
      waitlistCount,
      remaining: Math.max(0, pool.length - sold.length),
      slugsPool: row.isLive ? pool : [],
    });
  }),
);

router.get(
  "/drops/:id/live",
  asyncHandler(async (req, res) => {
    const stats = await getDropLiveStats(req.params.id);
    if (!stats) {
      res.status(404).json({ error: "Drop not found" });
      return;
    }
    res.json(stats);
  }),
);

router.post(
  "/drops/:id/waitlist",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const [drop, userRow] = await Promise.all([
      prisma.drop.findUnique({ where: { id: req.params.id } }),
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { telegramChatId: true, notificationsEnabled: true },
      }),
    ]);

    if (!drop) {
      res.status(404).json({ error: "Drop not found" });
      return;
    }

    if (drop.isFinished || drop.isSoldOut) {
      res.status(409).json({ error: "Drop is closed", code: "DROP_CLOSED" });
      return;
    }

    if (drop.isLive) {
      res.status(409).json({ error: "Drop already live", code: "DROP_ALREADY_LIVE" });
      return;
    }

    if (!userRow?.telegramChatId) {
      res.status(409).json({
        error: "Telegram is not linked",
        code: "TELEGRAM_NOT_LINKED",
      });
      return;
    }

    const existing = await prisma.dropWaitlist.findUnique({
      where: {
        dropId_userId: {
          dropId: drop.id,
          userId: user.userId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.dropWaitlist.create({
        data: {
          dropId: drop.id,
          userId: user.userId,
        },
      });
    }

    if (!userRow.notificationsEnabled) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { notificationsEnabled: true },
      });
    }

    const waitlistCount = await prisma.dropWaitlist.count({ where: { dropId: drop.id } });
    res.json({ ok: true, waitlistCount, alreadyJoined: Boolean(existing) });
  }),
);

router.get(
  "/referrals/bootstrap",
  asyncHandler(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const payload = await getReferralBootstrap(user.userId);
    res.json(payload || {});
  }),
);

router.post(
  "/referrals/rewards/:rewardRuleId/claim",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    try {
      const payload = await claimReferralReward({
        userId: user.userId,
        ruleId: String(req.params.rewardRuleId || ""),
      });
      res.json({ ok: true, reward: payload });
    } catch (error) {
      res.status(400).json({ error: error.message, code: error.code || "CLAIM_FAILED" });
    }
  }),
);

router.get(
  "/referrals/bonus",
  asyncHandler(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const [balance, history] = await Promise.all([
      getWalletBalance(user.userId),
      prisma.bonusLedger
        ? prisma.bonusLedger.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
    ]);
    res.json({
      balance,
      history: history.map((item) => ({
        id: item.id,
        direction: item.direction,
        kind: item.kind,
        amount: Number(item.amount || 0),
        balanceAfter: Number(item.balanceAfter || 0),
        note: item.note || "",
        createdAt: item.createdAt,
      })),
    });
  }),
);

router.get(
  "/referrals/campaigns/active",
  asyncHandler(async (_req, res) => {
    const items = await getActiveCampaignsSafe();
    res.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        source: item.source || "",
        offer: item.offer || "",
        promoCode: item.type === "promo_code" ? String(item.promoCode || "") : "",
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priority: Number(item.priority || 0),
      })),
    });
  }),
);

router.post(
  "/referrals/promo/validate",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const promoCode = normalizePromoCode(req.body?.promoCode || "");
    if (!promoCode) {
      res.status(400).json({ error: "PROMO_CODE_REQUIRED" });
      return;
    }
    const [v1Settings, resolved, promoSettings] = await Promise.all([
      getReferralV1Settings(),
      resolveCampaignForCheckout({
        source: String(req.body?.refSource || "order_modal"),
        offer: String(req.body?.refOffer || "default"),
        promoCode,
      }),
      getManySettings([
        "feature_promo_codes",
        "promo_codes_require_referrer",
        "promo_codes_first_order_only",
      ]),
    ]);
    const promoEnabled = promoSettings.feature_promo_codes !== undefined ? Boolean(promoSettings.feature_promo_codes) : true;
    if (!promoEnabled) {
      res.json({
        ok: false,
        promoCode,
        valid: false,
        reason: "promo_disabled",
      });
      return;
    }
    const snapshot = buildCampaignSnapshot({
      campaign: resolved.campaign,
      referrerReward: v1Settings.referrerReward,
      inviteeDiscount: v1Settings.inviteeDiscount,
      discountCapPercent: v1Settings.discountCapPercent,
      normalizedPromoCode: resolved.normalizedPromoCode,
    });
    if (!snapshot.campaignApplied || snapshot.campaignType !== "promo_code") {
      res.json({
        ok: false,
        promoCode,
        valid: false,
        reason: "promo_not_active",
      });
      return;
    }
    res.json({
      ok: true,
      valid: true,
      promoCode,
      campaignApplied: snapshot.campaignApplied,
      campaignType: snapshot.campaignType,
      campaignName: snapshot.campaignName,
      inviteeDiscount: snapshot.inviteeDiscount,
      referrerReward: snapshot.referrerReward,
      capPercent: snapshot.discountCapPercent,
      policy: {
        requireReferrer: promoSettings.promo_codes_require_referrer !== undefined
          ? Boolean(promoSettings.promo_codes_require_referrer)
          : false,
        firstOrderOnly: promoSettings.promo_codes_first_order_only !== undefined
          ? Boolean(promoSettings.promo_codes_first_order_only)
          : true,
      },
    });
  }),
);

module.exports = {
  featuresApiRouter: router,
};
