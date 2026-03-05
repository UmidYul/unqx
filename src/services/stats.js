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

  return { keys, startUtc: fromZonedTime(startDay, timezone) };
}

async function getSeries(days, timezone, slug) {
  if (!prisma.analyticsView) {
    return [];
  }
  const { keys, startUtc } = buildDateKeys(days, timezone);
  const bucket = new Map(keys.map((key) => [key, { views: 0, sessions: new Set() }]));

  const rows = await prisma.analyticsView.findMany({
    where: {
      visitedAt: { gte: startUtc },
      ...(slug ? { slug } : {}),
    },
    select: {
      visitedAt: true,
      sessionId: true,
    },
  });

  for (const row of rows) {
    const key = format(toZonedTime(row.visitedAt, timezone), "yyyy-MM-dd");
    if (!bucket.has(key)) continue;
    const current = bucket.get(key);
    current.views += 1;
    current.sessions.add(row.sessionId);
  }

  return keys.map((key) => {
    const current = bucket.get(key);
    return {
      date: key,
      views: current.views,
      uniqueViews: current.sessions.size,
    };
  });
}

async function getCardStats(slug, timezone = DEFAULT_TIMEZONE, days = 7) {
  const normalizedDays = Math.max(1, Math.min(30, days));
  if (!prisma.analyticsView) {
    return {
      totalViews: 0,
      totalUniqueViews: 0,
      series7d: [],
      lastViewAt: null,
      deviceSplit: { mobile: 0, desktop: 0 },
    };
  }

  const [views, series7d] = await Promise.all([
    prisma.analyticsView.findMany({
      where: { slug },
      select: { visitedAt: true, sessionId: true, device: true },
      orderBy: { visitedAt: "desc" },
    }),
    getSeries(normalizedDays, timezone, slug),
  ]);

  const totalUniqueViews = new Set(views.map((item) => item.sessionId)).size;
  const deviceSplit = { mobile: 0, desktop: 0 };
  for (const row of views) {
    if (row.device === "mobile") deviceSplit.mobile += 1;
    if (row.device === "desktop") deviceSplit.desktop += 1;
  }

  return {
    totalViews: views.length,
    totalUniqueViews,
    series7d,
    lastViewAt: views[0]?.visitedAt || null,
    deviceSplit,
  };
}

async function getGlobalStats(timezone = DEFAULT_TIMEZONE) {
  const [totalCards, activeCards, totalsAggregate, topCards, dailySeries] = await Promise.all([
    prisma.slug.count(),
    prisma.slug.count({ where: { status: "active" } }),
    prisma.slug.aggregate({ _sum: { analyticsViewsCount: true } }),
    prisma.slug.findMany({
      where: { status: { in: ["active", "private", "paused", "approved"] } },
      orderBy: [{ analyticsViewsCount: "desc" }, { updatedAt: "desc" }],
      take: 10,
      include: {
        owner: {
          select: {
            firstName: true,
            displayName: true,
            profileCard: {
              select: { name: true },
            },
          },
        },
      },
    }),
    getSeries(30, timezone),
  ]);

  return {
    totalCards,
    activeCards,
    totalViews: Number(totalsAggregate?._sum?.analyticsViewsCount || 0),
    totalUniqueViews: 0,
    topCards: topCards.map((row) => ({
      id: row.id,
      slug: row.fullSlug,
      name: row.owner?.profileCard?.name || row.owner?.displayName || row.owner?.firstName || "UNQ+ User",
      viewsCount: Number(row.analyticsViewsCount || 0),
      uniqueViewsCount: 0,
    })),
    dailySeries,
  };
}

module.exports = {
  getCardStats,
  getGlobalStats,
};
