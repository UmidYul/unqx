const { addDays, format, startOfDay, subDays } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");

const DEFAULT_TIMEZONE = env.TIMEZONE;

function buildDateKeys(days, timezone) {
  const now = new Date();
  const nowInZone = toZonedTime(now, timezone);
  const endDay = startOfDay(nowInZone);
  const startDay = subDays(endDay, days - 1);

  const keys = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(format(addDays(startDay, i), "yyyy-MM-dd"));
  }

  const startUtc = fromZonedTime(startDay, timezone);

  return { keys, startUtc };
}

async function getSeries(days, timezone, cardId) {
  const { keys, startUtc } = buildDateKeys(days, timezone);
  const bucket = new Map(keys.map((key) => [key, { views: 0, uniqueViews: 0 }]));

  const logs = await prisma.viewLog.findMany({
    where: {
      viewedAt: { gte: startUtc },
      ...(cardId ? { cardId } : {}),
    },
    select: {
      viewedAt: true,
      isUnique: true,
    },
  });

  for (const row of logs) {
    const key = format(toZonedTime(row.viewedAt, timezone), "yyyy-MM-dd");
    if (bucket.has(key)) {
      const current = bucket.get(key);
      current.views += 1;
      if (row.isUnique) {
        current.uniqueViews += 1;
      }
    }
  }

  return keys.map((key) => {
    const current = bucket.get(key);
    return {
      date: key,
      views: current.views,
      uniqueViews: current.uniqueViews,
    };
  });
}

async function getCardStats(cardId, timezone = DEFAULT_TIMEZONE, days = 7) {
  const normalizedDays = Math.max(1, Math.min(30, days));

  const [card, lastView, grouped, series7d] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId }, select: { viewsCount: true, uniqueViewsCount: true } }),
    prisma.viewLog.findFirst({
      where: { cardId },
      orderBy: { viewedAt: "desc" },
      select: { viewedAt: true },
    }),
    prisma.viewLog.groupBy({
      by: ["device"],
      where: { cardId },
      _count: { _all: true },
    }),
    getSeries(normalizedDays, timezone, cardId),
  ]);

  const deviceSplit = { mobile: 0, desktop: 0 };

  for (const row of grouped) {
    if (row.device === "mobile") {
      deviceSplit.mobile = row._count._all;
    }

    if (row.device === "desktop") {
      deviceSplit.desktop = row._count._all;
    }
  }

  return {
    totalViews: card ? card.viewsCount : 0,
    totalUniqueViews: card ? card.uniqueViewsCount : 0,
    series7d,
    lastViewAt: lastView ? lastView.viewedAt : null,
    deviceSplit,
  };
}

async function getGlobalStats(timezone = DEFAULT_TIMEZONE) {
  const [totalCards, activeCards, totalsAggregate, topCards, dailySeries] = await Promise.all([
    prisma.card.count(),
    prisma.card.count({ where: { isActive: true } }),
    prisma.card.aggregate({ _sum: { viewsCount: true, uniqueViewsCount: true } }),
    prisma.card.findMany({
      orderBy: { viewsCount: "desc" },
      take: 10,
      select: {
        id: true,
        slug: true,
        name: true,
        viewsCount: true,
        uniqueViewsCount: true,
      },
    }),
    getSeries(30, timezone),
  ]);

  return {
    totalCards,
    activeCards,
    totalViews: totalsAggregate._sum.viewsCount || 0,
    totalUniqueViews: totalsAggregate._sum.uniqueViewsCount || 0,
    topCards,
    dailySeries,
  };
}

module.exports = {
  getCardStats,
  getGlobalStats,
};