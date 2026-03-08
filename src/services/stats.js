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
    if (!current.sessions.has(row.sessionId)) {
      current.views += 1;
    }
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
  const deviceSessions = { mobile: new Set(), desktop: new Set() };
  for (const row of views) {
    if (row.device === "mobile") deviceSessions.mobile.add(row.sessionId);
    if (row.device === "desktop") deviceSessions.desktop.add(row.sessionId);
  }
  const deviceSplit = { mobile: deviceSessions.mobile.size, desktop: deviceSessions.desktop.size };

  return {
    totalViews: totalUniqueViews,
    totalUniqueViews,
    series7d,
    lastViewAt: views[0]?.visitedAt || null,
    deviceSplit,
  };
}

async function getGlobalStats(timezone = DEFAULT_TIMEZONE) {
  const [totalCards, activeCards, uniqueSlugSessionRows, dailySeries] = await Promise.all([
    prisma.slug.count(),
    prisma.slug.count({ where: { status: "active" } }),
    prisma.analyticsView && typeof prisma.analyticsView.groupBy === "function"
      ? prisma.analyticsView.groupBy({
        by: ["slug", "sessionId"],
        _count: { _all: true },
      })
      : Promise.resolve([]),
    getSeries(30, timezone),
  ]);

  const uniqueViewsBySlug = new Map();
  uniqueSlugSessionRows.forEach((row) => {
    const slug = String(row.slug || "").trim().toUpperCase();
    if (!slug) return;
    uniqueViewsBySlug.set(slug, (uniqueViewsBySlug.get(slug) || 0) + 1);
  });

  const topSlugEntries = Array.from(uniqueViewsBySlug.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topSlugs = topSlugEntries.map(([slug]) => slug);
  const topCardsRows = topSlugs.length
    ? await prisma.slug.findMany({
      where: { fullSlug: { in: topSlugs } },
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
    })
    : [];
  const topCardsBySlug = new Map(topCardsRows.map((row) => [String(row.fullSlug || "").toUpperCase(), row]));
  const totalUniqueViews = Array.from(uniqueViewsBySlug.values()).reduce((sum, value) => sum + Number(value || 0), 0);

  return {
    totalCards,
    activeCards,
    totalViews: totalUniqueViews,
    totalUniqueViews,
    topCards: topSlugEntries.map(([slug, views]) => {
      const row = topCardsBySlug.get(slug);
      return {
        id: row?.id || slug,
        slug,
        name: row?.owner?.profileCard?.name || row?.owner?.displayName || row?.owner?.firstName || "UNQX User",
        viewsCount: Number(views || 0),
        uniqueViewsCount: Number(views || 0),
      };
    }),
    dailySeries,
  };
}

module.exports = {
  getCardStats,
  getGlobalStats,
};
