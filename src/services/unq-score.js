const { subDays, differenceInMonths, startOfDay } = require("date-fns");

const { prisma } = require("../db/prisma");
const { calculateSlugPrice } = require("./slug-pricing");
const { getFeatureSetting } = require("./feature-settings");

const MAX_SCORE = 999;
const VIEW_SCORE_MAX = 300;
const SLUG_RARITY_SCORE_MAX = 200;
const TENURE_SCORE_MAX = 150;
const CTR_SCORE_MAX = 200;
const BRACELET_SCORE_MAX = 100;
const PLAN_SCORE_MAX = 49;
const VIEW_LOG_DENOMINATOR = Math.log10(10001);

function getSlugMultiplier(fullSlug) {
  const normalized = String(fullSlug || "").toUpperCase();
  if (!/^[A-Z]{3}[0-9]{3}$/.test(normalized)) {
    return 1;
  }
  const pricing = calculateSlugPrice({
    letters: normalized.slice(0, 3),
    digits: normalized.slice(3),
  });
  return Number(pricing?.letters?.multiplier || 1) * Number(pricing?.digits?.multiplier || 1);
}

function getRarityFromMultiplier(multiplier) {
  const value = Number(multiplier || 0);
  if (value >= 20) return { label: "LEGENDARY", score: 200 };
  if (value >= 9) return { label: "EPIC", score: 150 };
  if (value >= 4) return { label: "RARE", score: 100 };
  if (value >= 2) return { label: "UNCOMMON", score: 75 };
  return { label: "COMMON", score: 50 };
}

function calculateViewsScore(views30d) {
  const base = Math.max(0, Number(views30d || 0));
  const score = Math.floor((Math.log10(base + 1) / VIEW_LOG_DENOMINATOR) * VIEW_SCORE_MAX);
  return Math.max(0, Math.min(VIEW_SCORE_MAX, score));
}

function calculateTenureScore(activatedAt) {
  if (!activatedAt) return 0;
  const monthsActive = Math.max(0, differenceInMonths(new Date(), new Date(activatedAt)));
  return Math.min(TENURE_SCORE_MAX, monthsActive * 12);
}

function calculateCtrScore(views30d, clicks30d) {
  const views = Math.max(0, Number(views30d || 0));
  const clicks = Math.max(0, Number(clicks30d || 0));
  if (views <= 0) return 0;
  const ctr = Math.min(1, clicks / views);
  return Math.min(CTR_SCORE_MAX, Math.floor(ctr * CTR_SCORE_MAX));
}

function asTopPercent(percentile) {
  const top = Math.ceil(100 - Number(percentile || 0));
  return Math.max(1, top);
}

async function getUserScoreInputs(userId, tx = prisma) {
  const now = new Date();
  const since30d = subDays(now, 30);

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      status: true,
    },
  });
  if (!user) return null;

  const slugs = await tx.slug.findMany({
    where: {
      ownerId: userId,
      status: { in: ["approved", "active", "paused", "private"] },
    },
    orderBy: [{ isPrimary: "desc" }, { activatedAt: "asc" }, { createdAt: "asc" }],
    select: {
      fullSlug: true,
      status: true,
      activatedAt: true,
      isPrimary: true,
    },
  });
  const slugNames = slugs.map((item) => item.fullSlug);

  const [views30d, clicks30d, hasBracelet] = await Promise.all([
    slugNames.length && tx.analyticsView
      ? tx.analyticsView.count({
        where: {
          slug: { in: slugNames },
          visitedAt: { gte: since30d },
        },
      })
      : 0,
    slugNames.length && tx.analyticsClick
      ? tx.analyticsClick.count({
        where: {
          slug: { in: slugNames },
          clickedAt: { gte: since30d },
        },
      })
      : 0,
    slugNames.length
      ? tx.braceletOrder.count({
        where: {
          slug: { in: slugNames },
          deliveryStatus: { in: ["ORDERED", "SHIPPED", "DELIVERED"] },
        },
      })
      : 0,
  ]);

  const primary = slugs.find((item) => item.isPrimary) || slugs[0] || null;
  const withMultiplier = slugs.map((item) => ({ ...item, multiplier: getSlugMultiplier(item.fullSlug) }));
  const highestRaritySlug = withMultiplier.sort((a, b) => b.multiplier - a.multiplier)[0] || null;
  const activatedBase = primary?.activatedAt || slugs.find((item) => item.activatedAt)?.activatedAt || null;
  return {
    user,
    slugs,
    primarySlug: primary?.fullSlug || null,
    highestRaritySlug: highestRaritySlug?.fullSlug || null,
    rarity: getRarityFromMultiplier(highestRaritySlug?.multiplier || 1),
    views30d,
    clicks30d,
    activatedAt: activatedBase,
    hasBracelet: hasBracelet > 0,
    hasPlan: user.plan === "premium",
  };
}

function buildScoreFromInputs(inputs) {
  const scoreViews = calculateViewsScore(inputs.views30d);
  const scoreSlugRarity = Number(inputs.rarity?.score || 0);
  const scoreTenure = calculateTenureScore(inputs.activatedAt);
  const scoreCtr = calculateCtrScore(inputs.views30d, inputs.clicks30d);
  const scoreBracelet = inputs.hasBracelet ? BRACELET_SCORE_MAX : 0;
  const scorePlan = inputs.hasPlan ? PLAN_SCORE_MAX : 0;
  const score = Math.min(
    MAX_SCORE,
    scoreViews + scoreSlugRarity + scoreTenure + scoreCtr + scoreBracelet + scorePlan,
  );
  return {
    score,
    scoreViews,
    scoreSlugRarity,
    scoreTenure,
    scoreCtr,
    scoreBracelet,
    scorePlan,
  };
}

async function updatePercentiles(tx = prisma) {
  if (!tx.unqScore) return;
  const activeUsers = await tx.user.findMany({
    where: {
      status: "active",
      slugs: {
        some: {
          status: { in: ["approved", "active", "paused", "private"] },
        },
      },
    },
    select: { id: true },
  });
  const activeIds = activeUsers.map((item) => item.id);
  if (!activeIds.length) return;

  const ranked = await tx.unqScore.findMany({
    where: {
      userId: { in: activeIds },
      score: { gt: 0 },
    },
    select: { userId: true, score: true },
  });
  const total = ranked.length;
  if (!total) {
    await tx.unqScore.updateMany({
      where: { userId: { in: activeIds } },
      data: { percentile: 0 },
    });
    return;
  }

  const sortedScores = ranked.map((row) => row.score).sort((a, b) => a - b);
  const lowerScoreCount = new Map();
  sortedScores.forEach((score, index) => {
    if (!lowerScoreCount.has(score)) {
      lowerScoreCount.set(score, index);
    }
  });

  await Promise.all(
    ranked.map((row) =>
      tx.unqScore.update({
        where: { userId: row.userId },
        data: {
          percentile: Number((((lowerScoreCount.get(row.score) || 0) / total) * 100).toFixed(1)),
        },
      }),
    ),
  );

  const zeroRows = activeIds.filter((id) => !ranked.some((row) => row.userId === id));
  if (zeroRows.length) {
    await tx.unqScore.updateMany({
      where: { userId: { in: zeroRows } },
      data: { percentile: 0 },
    });
  }
}

async function storeDailyHistory(userId, score, tx = prisma, now = new Date()) {
  if (!tx.scoreHistory) return;
  const today = startOfDay(now);
  await tx.scoreHistory.upsert({
    where: {
      userId_recordedAt: {
        userId,
        recordedAt: today,
      },
    },
    create: {
      userId,
      score,
      recordedAt: today,
    },
    update: {
      score,
    },
  });
}

async function recalculateUserScore(userId, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const tx = options.tx || prisma;
  if (!tx.unqScore) return null;
  const inputs = await getUserScoreInputs(userId, tx);
  if (!inputs) return null;
  const scorePayload = buildScoreFromInputs(inputs);
  const row = await tx.unqScore.upsert({
    where: { userId },
    create: {
      userId,
      ...scorePayload,
      percentile: 0,
      calculatedAt: now,
    },
    update: {
      ...scorePayload,
      calculatedAt: now,
    },
  });
  await storeDailyHistory(userId, row.score, tx, now);
  return row;
}

async function recalculateAllScores(options = {}) {
  if (!prisma.unqScore) {
    return { processed: 0, averageMsPerUser: 0 };
  }
  const now = new Date();
  const startedAt = Date.now();
  const users = await prisma.user.findMany({
    where: {
      status: "active",
      slugs: {
        some: {
          status: { in: ["approved", "active", "paused", "private"] },
        },
      },
    },
    select: { id: true },
  });
  for (const item of users) {
    await recalculateUserScore(item.id, { now });
  }
  await updatePercentiles();
  const totalMs = Date.now() - startedAt;
  const processed = users.length;
  const averageMs = processed > 0 ? totalMs / processed : 0;
  if (prisma.scoreRecalculationRun) {
    await prisma.scoreRecalculationRun.create({
      data: {
        processedUsers: processed,
        averageMsPerUser: Number(averageMs.toFixed(2)),
        startedAt: new Date(startedAt),
        finishedAt: new Date(),
      },
    });
  }
  if (options.reason && options.reason !== "manual") {
    return { processed, averageMsPerUser: averageMs, reason: options.reason };
  }
  return { processed, averageMsPerUser: averageMs };
}

async function recalculateAndRefreshPercentiles(userId) {
  const row = await recalculateUserScore(userId);
  await updatePercentiles();
  return row;
}

async function ensureDailyRecalculation() {
  if (!prisma.scoreRecalculationRun) return;
  const latest = await prisma.scoreRecalculationRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const now = Date.now();
  const shouldRun = !latest || now - new Date(latest.startedAt).getTime() >= 24 * 60 * 60 * 1000;
  if (!shouldRun) return null;
  return recalculateAllScores({ reason: "daily" });
}

async function getScoreByUserId(userId) {
  if (!userId || !prisma.unqScore) return null;
  return prisma.unqScore.findUnique({
    where: { userId },
  });
}

async function getPublicScoreForSlug({ slug, viewerTelegramId = null, viewerUserId = null }) {
  const normalized = String(slug || "").toUpperCase();
  const slugRow = await prisma.slug.findUnique({
    where: { fullSlug: normalized },
    select: {
      fullSlug: true,
      ownerId: true,
      status: true,
      activatedAt: true,
    },
  });
  if (!slugRow || !slugRow.ownerId) return null;

  const settings = await getFeatureSetting("unqScore");
  const viewerId = viewerUserId || viewerTelegramId;
  const isOwner = viewerId && viewerId === slugRow.ownerId;
  const cardsEnabled = Boolean(settings.enabledOnCards);
  if (!isOwner && !cardsEnabled) return null;
  if (!isOwner && slugRow.status === "paused") return null;
  if (!isOwner && slugRow.status === "private") return null;

  const score = await getScoreByUserId(slugRow.ownerId);
  if (!score && !isOwner) return null;

  const multiplier = getSlugMultiplier(normalized);
  const rarity = getRarityFromMultiplier(multiplier);
  const isNew = Boolean(slugRow.activatedAt) && (Date.now() - new Date(slugRow.activatedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;

  return {
    score: score?.score || 0,
    percentile: score?.percentile || 0,
    topPercent: asTopPercent(score?.percentile || 0),
    calculatedAt: score?.calculatedAt || null,
    showProgress: !(score?.score === 0 && isNew),
    isForming: score?.score === 0 && isNew,
    rarityLabel: rarity.label,
    rarityScore: rarity.score,
  };
}

async function getProfileScoreByUserId(userId) {
  const [score, history, inputs] = await Promise.all([
    getScoreByUserId(userId),
    prisma.scoreHistory
      ? prisma.scoreHistory.findMany({
        where: { userId },
        orderBy: { recordedAt: "asc" },
        take: 30,
      })
      : [],
    getUserScoreInputs(userId),
  ]);
  const fallback = {
    score: 0,
    scoreViews: 0,
    scoreSlugRarity: 0,
    scoreTenure: 0,
    scoreCtr: 0,
    scoreBracelet: 0,
    scorePlan: 0,
    percentile: 0,
    calculatedAt: null,
  };
  const payload = score || fallback;
  return {
    ...payload,
    topPercent: asTopPercent(payload.percentile),
    rarityLabel: inputs?.rarity?.label || "COMMON",
    history: history.map((item) => ({
      date: item.recordedAt,
      score: item.score,
    })),
    isPremium: Boolean(inputs?.hasPlan),
  };
}

async function getScoreLeaderboard(limit = 100) {
  if (!prisma.unqScore) return [];
  const capped = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await prisma.unqScore.findMany({
    where: {
      user: {
        status: "active",
      },
      score: { gt: 0 },
    },
    orderBy: [{ score: "desc" }, { percentile: "desc" }],
    take: capped,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          username: true,
          plan: true,
          profileCard: {
            select: { name: true, avatarUrl: true },
          },
          slugs: {
            where: { status: { in: ["active", "private", "paused", "approved"] } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 3,
            select: {
              fullSlug: true,
              isPrimary: true,
            },
          },
        },
      },
    },
  });

  const since30d = subDays(new Date(), 30);
  const allSlugs = rows.flatMap((row) => (row.user?.slugs || []).map((slug) => slug.fullSlug));
  const uniqueSlugs = Array.from(new Set(allSlugs));
  const viewsGrouped = uniqueSlugs.length && prisma.analyticsView
    ? await prisma.analyticsView.groupBy({
      by: ["slug"],
      where: {
        slug: { in: uniqueSlugs },
        visitedAt: { gte: since30d },
      },
      _count: { _all: true },
    })
    : [];
  const viewsBySlug = new Map(viewsGrouped.map((row) => [row.slug, row._count._all || 0]));

  return rows.map((row, index) => {
    const slugs = row.user?.slugs || [];
    const primary = slugs.find((item) => item.isPrimary) || slugs[0] || null;
    const slug = primary?.fullSlug || "UNQ";
    const views = slugs.reduce((acc, item) => acc + (viewsBySlug.get(item.fullSlug) || 0), 0);
    const rarity = getRarityFromMultiplier(getSlugMultiplier(slug));
    return {
      rank: index + 1,
      userId: row.userId,
      telegramId: row.userId,
      slug,
      ownerName: row.user?.profileCard?.name || row.user?.firstName || row.user?.username || "UNQX User",
      avatarUrl: row.user?.profileCard?.avatarUrl || "/brand/logo.PNG",
      plan: row.user?.plan || "basic",
      score: row.score,
      percentile: row.percentile,
      topPercent: asTopPercent(row.percentile),
      views,
      rarityLabel: rarity.label,
    };
  });
}

module.exports = {
  MAX_SCORE,
  getSlugMultiplier,
  getRarityFromMultiplier,
  asTopPercent,
  recalculateUserScore,
  recalculateAllScores,
  recalculateAndRefreshPercentiles,
  ensureDailyRecalculation,
  getPublicScoreForSlug,
  getProfileScoreByTelegramId: getProfileScoreByUserId,
  getProfileScoreByUserId,
  getScoreByTelegramId: getScoreByUserId,
  getScoreByUserId,
  getScoreLeaderboard,
  updatePercentiles,
};
