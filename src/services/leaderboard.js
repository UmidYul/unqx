const { startOfDay, startOfMonth, addDays, addMonths, subDays, subMonths, format } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { getFeatureSetting } = require("./feature-settings");

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

async function getExcludedSet() {
  const rows = await prisma.leaderboardExclusion.findMany({ select: { fullSlug: true } });
  return new Set(rows.map((row) => row.fullSlug));
}

async function groupViews({ startUtc, endUtc, excludedSet }) {
  const grouped = await prisma.slugView.groupBy({
    by: ["fullSlug"],
    where: {
      isUnique: true,
      viewedAt: { gte: startUtc, lt: endUtc },
    },
    _count: { _all: true },
  });

  const filtered = grouped
    .map((row) => ({ slug: row.fullSlug, views: row._count._all || 0 }))
    .filter((row) => !excludedSet.has(row.slug) && row.views > 0)
    .sort((a, b) => b.views - a.views || a.slug.localeCompare(b.slug));

  return filtered;
}

async function buildLeaderboard(period = "week", options = {}) {
  const timezone = options.timezone || env.TIMEZONE;
  const settings = await getFeatureSetting("leaderboard");
  const range = getPeriodRange(period, timezone);
  const excludedSet = await getExcludedSet();

  const [current, previous] = await Promise.all([
    groupViews({ startUtc: range.startUtc, endUtc: range.endUtc, excludedSet }),
    range.period === "all"
      ? Promise.resolve([])
      : groupViews({ startUtc: range.previousStartUtc, endUtc: range.previousEndUtc, excludedSet }),
  ]);

  const previousRanks = new Map(previous.map((row, index) => [row.slug, index + 1]));
  const slugs = current.map((row) => row.slug);

  const slugRows = slugs.length
    ? await prisma.slug.findMany({
        where: { fullSlug: { in: slugs } },
        select: {
          fullSlug: true,
          ownerTelegramId: true,
          owner: {
            select: {
              firstName: true,
              username: true,
              photoUrl: true,
              plan: true,
              profileCard: {
                select: { name: true, avatarUrl: true },
              },
            },
          },
        },
      })
    : [];

  const slugMap = new Map(slugRows.map((row) => [row.fullSlug, row]));
  const items = current.map((row, index) => {
    const rank = index + 1;
    const prevRank = previousRanks.get(row.slug) || null;
    const delta = prevRank ? prevRank - rank : null;
    const source = slugMap.get(row.slug);
    const owner = source?.owner || null;

    return {
      rank,
      slug: row.slug,
      views: row.views,
      previousRank: prevRank,
      delta,
      ownerTelegramId: source?.ownerTelegramId || null,
      ownerName: owner?.profileCard?.name || owner?.firstName || owner?.username || "UNQ+ User",
      ownerUsername: owner?.username || null,
      avatarUrl: owner?.profileCard?.avatarUrl || owner?.photoUrl || "/brand/unq-mark.svg",
      plan: owner?.plan || "basic",
    };
  });

  const publicLimit = Math.max(1, Math.min(200, Number(settings.publicLimit) || 20));

  return {
    period: range.period,
    generatedAt: new Date().toISOString(),
    settings,
    items,
    publicItems: items.slice(0, publicLimit),
  };
}

async function getUserLeaderboardSummary({ telegramId, period = "week" }) {
  if (!telegramId) {
    return null;
  }
  const board = await buildLeaderboard(period);
  const userRows = board.items.filter((row) => row.ownerTelegramId === telegramId);
  if (!userRows.length) {
    return null;
  }
  const best = userRows.slice().sort((a, b) => a.rank - b.rank)[0];
  const limit = Math.max(1, Number(board.settings.publicLimit) || 20);
  const topN = board.items.slice(0, limit);
  const cutoffViews = topN.length === limit ? topN[topN.length - 1].views : 0;
  return {
    rank: best.rank,
    slug: best.slug,
    views: best.views,
    toTopViews: best.rank <= limit ? 0 : Math.max(0, cutoffViews - best.views + 1),
    limit,
  };
}

function matchesSpike(rows, threshold) {
  return Array.isArray(rows) && rows.length >= threshold;
}

async function detectSuspiciousActivity() {
  const settings = await getFeatureSetting("leaderboard");
  const threshold = Math.max(10, Number(settings.suspiciousThreshold) || 50);
  const windowMinutes = Math.max(1, Number(settings.suspiciousWindowMinutes) || 10);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const grouped = await prisma.slugView.groupBy({
    by: ["fullSlug"],
    where: {
      isUnique: true,
      viewedAt: { gte: windowStart, lte: now },
    },
    _count: { _all: true },
  });

  const suspicious = grouped
    .map((row) => ({ slug: row.fullSlug, views: row._count._all || 0 }))
    .filter((row) => row.views >= threshold)
    .sort((a, b) => b.views - a.views);

  if (suspicious.length) {
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
