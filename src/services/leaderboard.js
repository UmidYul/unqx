const { startOfDay, startOfMonth, addDays, addMonths, subDays, subMonths } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { getFeatureSetting } = require("./feature-settings");
const { getScoreLeaderboard } = require("./unq-score");

function normalizePeriod(period) {
  if (period === "month" || period === "all") {
    return period;
  }
  return "week";
}

function getPeriodRange(period, timezone = env.TIMEZONE) {
  const normalized = normalizePeriod(period);
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);

  if (normalized === "all") {
    return {
      period: normalized,
      startUtc: new Date("1970-01-01T00:00:00.000Z"),
      endUtc: addDays(now, 1),
      previousStartUtc: new Date("1970-01-01T00:00:00.000Z"),
      previousEndUtc: new Date("1970-01-01T00:00:00.000Z"),
    };
  }

  if (normalized === "month") {
    const start = startOfMonth(zonedNow);
    const next = addMonths(start, 1);
    const prevStart = subMonths(start, 1);
    return {
      period: normalized,
      startUtc: fromZonedTime(start, timezone),
      endUtc: fromZonedTime(next, timezone),
      previousStartUtc: fromZonedTime(prevStart, timezone),
      previousEndUtc: fromZonedTime(start, timezone),
    };
  }

  const dayStart = startOfDay(zonedNow);
  const weekStart = subDays(dayStart, 6);
  const next = addDays(dayStart, 1);
  const prevStart = subDays(weekStart, 7);
  return {
    period: normalized,
    startUtc: fromZonedTime(weekStart, timezone),
    endUtc: fromZonedTime(next, timezone),
    previousStartUtc: fromZonedTime(prevStart, timezone),
    previousEndUtc: fromZonedTime(weekStart, timezone),
  };
}

async function buildLeaderboard(period = "week") {
  const settings = await getFeatureSetting("leaderboard");
  const range = getPeriodRange(period);
  const items = await getScoreLeaderboard(300);
  const publicLimit = Math.max(1, Math.min(200, Number(settings.publicLimit) || 20));

  return {
    period: range.period,
    generatedAt: new Date().toISOString(),
    settings,
    items,
    publicItems: items.slice(0, publicLimit),
  };
}

async function getUserLeaderboardSummary({ userId, telegramId, period = "week" }) {
  const targetId = userId || telegramId;
  if (!targetId) return null;
  const board = await buildLeaderboard(period);
  const target = board.items.find((item) => item.userId === targetId || item.telegramId === targetId);
  if (!target) return null;

  const limit = Math.max(1, Number(board.settings.publicLimit) || 20);
  const topN = board.items.slice(0, limit);
  const cutoffScore = topN.length === limit ? Number(topN[topN.length - 1].score || 0) : 0;
  return {
    rank: target.rank,
    slug: target.slug,
    score: target.score,
    views: target.views,
    toTopScore: target.rank <= limit ? 0 : Math.max(0, cutoffScore - Number(target.score || 0) + 1),
    limit,
  };
}

async function detectSuspiciousActivity() {
  if (!prisma.analyticsView || typeof prisma.analyticsView.groupBy !== "function") {
    return [];
  }
  const settings = await getFeatureSetting("leaderboard");
  const threshold = Math.max(10, Number(settings.suspiciousThreshold) || 50);
  const windowMinutes = Math.max(1, Number(settings.suspiciousWindowMinutes) || 10);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const grouped = await prisma.analyticsView.groupBy({
    by: ["slug"],
    where: {
      visitedAt: { gte: windowStart, lte: now },
    },
    _count: { _all: true },
  });

  const suspicious = grouped
    .map((row) => ({ slug: row.slug, views: row._count._all || 0 }))
    .filter((row) => row.views >= threshold)
    .sort((a, b) => b.views - a.views);

  if (suspicious.length && prisma.leaderboardSuspiciousLog && typeof prisma.leaderboardSuspiciousLog.createMany === "function") {
    await prisma.leaderboardSuspiciousLog.createMany({
      data: suspicious.map((row) => ({
        fullSlug: row.slug,
        viewsCount: row.views,
        windowMinutes,
        threshold,
      })),
    });
  }

  return suspicious;
}

async function getSlugTopBadge(slug) {
  const board = await buildLeaderboard("week");
  const limit = Math.max(1, Number(board.settings.publicLimit) || 20);
  const found = board.items.find((item) => item.slug === String(slug || "").toUpperCase());
  if (!found || found.rank > limit) {
    return null;
  }
  return {
    rank: found.rank,
    periodLabel: "этой недели",
  };
}

module.exports = {
  buildLeaderboard,
  getUserLeaderboardSummary,
  getPeriodRange,
  normalizePeriod,
  detectSuspiciousActivity,
  getSlugTopBadge,
};
