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
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000);

    const [activeCardsTotal, todayCreated, todayActivated, todayTotal, onlineNow] = await Promise.all([
      prisma.slug.count({ where: { status: "active" } }),
      prisma.slug.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.slug.count({ where: { activatedAt: { gte: todayStart } } }),
      prisma.slug.count({
        where: {
          OR: [{ createdAt: { gte: todayStart } }, { activatedAt: { gte: todayStart } }],
        },
      }),
      prisma.analyticsView
        ? prisma.analyticsView
            .findMany({
              where: { visitedAt: { gte: onlineSince } },
              select: { sessionId: true },
            })
            .then((rows) => new Set(rows.map((row) => row.sessionId)).size)
        : Promise.resolve(0),
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

    const drop = await prisma.drop.findUnique({ where: { id: req.params.id } });
    if (!drop) {
      res.status(404).json({ error: "Drop not found" });
      return;
    }

    await prisma.dropWaitlist.upsert({
      where: {
        dropId_userId: {
          dropId: drop.id,
          userId: user.userId,
        },
      },
      create: {
        dropId: drop.id,
        userId: user.userId,
      },
      update: {},
    });

    const waitlistCount = await prisma.dropWaitlist.count({ where: { dropId: drop.id } });
    res.json({ ok: true, waitlistCount });
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

module.exports = {
  featuresApiRouter: router,
};
