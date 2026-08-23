const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { getUserSession } = require("../../middleware/auth");
const { buildLeaderboard, getUserLeaderboardSummary, normalizePeriod, normalizeLeaderboardType } = require("../../services/leaderboard");
const { createDonationRequest, listDonationLeaders, resolveDonationRank } = require("../../services/donation-leaders");
const { getFeatureSetting } = require("../../services/feature-settings");
const { getActiveFlashSale, resolveConditionLabel, resolveFlashSalePresentation } = require("../../services/flash-sales");
const { getDropLiveStats } = require("../../services/drops");
const { getTodayVisitorsStats, getUtcDayStart } = require("../../services/live-stats");
const { getReferralBootstrap, claimReferralReward } = require("../../services/referrals");
const { getWalletBalance, hasApprovedSlugPurchase } = require("../../services/referral-v1");
const { getActiveCampaignsSafe } = require("../../services/referral-v2");
const {
  normalizePromoCode,
  getPromoPolicySettings,
  resolvePromoForCheckout,
  evaluatePromoEligibility,
} = require("../../services/promo-codes");

const router = express.Router();

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
    const todayStart = getUtcDayStart(now);
    const activeOwnerWhere = env.SUBSCRIPTION_AUTO_RENEW_ENABLED
      ? {
          status: "active",
          plan: { in: ["basic", "premium"] },
        }
      : {
          status: "active",
          plan: { in: ["basic", "premium"] },
          OR: [{ subscriptionExpiresAt: null }, { subscriptionExpiresAt: { gt: now } }],
        };

    const [activeCardsTotal, todayCreated, todayActivated, todayTotal, todayVisitorsStats] = await Promise.all([
      prisma.slug.count({
        where: {
          status: { in: ["active", "private", "approved"] },
          owner: activeOwnerWhere,
        },
      }),
      prisma.slug.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.slug.count({ where: { activatedAt: { gte: todayStart } } }),
      prisma.slug.count({
        where: {
          OR: [{ createdAt: { gte: todayStart } }, { activatedAt: { gte: todayStart } }],
        },
      }),
      getTodayVisitorsStats(now),
    ]);

    res.json({
      activeCardsTotal,
      todayCreated,
      todayActivated,
      todayTotal,
      todayVisitors: todayVisitorsStats.total,
    });
  }),
);

router.get(
  "/leaders",
  asyncHandler(async (_req, res) => {
    const payload = await listDonationLeaders({ limit: 100, useCache: true });
    res.json(payload);
  }),
);

router.get(
  "/leaders/quote",
  asyncHandler(async (req, res) => {
    try {
      const userSession = getUserSession(req);
      const quote = await resolveDonationRank({
        userId: userSession?.userId || "",
        amount: req.query.amount,
        includeCurrentUserTotal: Boolean(userSession?.userId),
      });
      res.json({ quote });
    } catch (error) {
      res.status(400).json({ error: "Некорректная сумма доната", code: error?.message || "DONATION_QUOTE_FAILED" });
    }
  }),
);

router.post(
  "/leaders/donate",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = requireUser(req, res);
    if (!userSession) return;
    try {
      const payload = await createDonationRequest({
        userId: userSession.userId,
        amount: req.body?.amount,
      });
      res.status(201).json(payload);
    } catch (error) {
      const code = String(error?.message || "DONATION_REQUEST_FAILED");
      const status = Number(error?.status || 400);
      const message =
        code === "DONATION_AMOUNT_TOO_SMALL"
          ? "Минимальная сумма доната: 10 000 сум"
          : code === "USER_NOT_FOUND"
            ? "Пользователь не найден"
            : "Не удалось создать заявку на донат";
      res.status(status >= 400 && status < 600 ? status : 400).json({ error: message, code });
    }
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
    const type = normalizeLeaderboardType(req.query.type);
    const board = await buildLeaderboard(period, type);
    res.json({
      period: board.period,
      type: board.type,
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
    const type = normalizeLeaderboardType(req.query.type);
    const payload = await getUserLeaderboardSummary({ userId: user.userId, period, type });
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
        presentation: resolveFlashSalePresentation(sale),
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
    const userSession = getUserSession(req);
    const userId = userSession?.userId ? String(userSession.userId) : null;
    const [promoPolicy, resolved, firstApprovedOrderExists] = await Promise.all([
      getPromoPolicySettings(),
      resolvePromoForCheckout({ promoCode }),
      userId ? hasApprovedSlugPurchase(userId) : Promise.resolve(false),
    ]);

    const eligibility = await evaluatePromoEligibility({
      promo: resolved.promo || null,
      userId,
      firstApprovedOrderExists,
      policy: promoPolicy,
    });

    if (!eligibility.allowed) {
      res.json({
        ok: false,
        promoCode,
        valid: false,
        reason: eligibility.reason || "promo_not_active",
        policy: {
          enabled: promoPolicy.enabled,
          firstOrderOnly: promoPolicy.firstOrderOnly,
        },
      });
      return;
    }

    res.json({
      ok: true,
      valid: true,
      promoCode,
      name: String(resolved.promo?.name || ""),
      discountType: String(resolved.promo?.discountType || ""),
      discountValue: Math.max(0, Math.round(Number(resolved.promo?.discountValue || 0))),
      policy: {
        enabled: promoPolicy.enabled,
        firstOrderOnly: promoPolicy.firstOrderOnly,
      },
    });
  }),
);

module.exports = {
  featuresApiRouter: router,
};
