const { startOfDay, startOfMonth, addDays, addMonths, subDays, subMonths } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { getFeatureSetting } = require("./feature-settings");

function normalizePeriod(period) {
  if (period === "day" || period === "week" || period === "month" || period === "all") {
    return period;
  }
  return "day";
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
  if (normalized === "day") {
    const next = addDays(dayStart, 1);
    const prevStart = subDays(dayStart, 1);
    return {
      period: normalized,
      startUtc: fromZonedTime(dayStart, timezone),
      endUtc: fromZonedTime(next, timezone),
      previousStartUtc: fromZonedTime(prevStart, timezone),
      previousEndUtc: fromZonedTime(dayStart, timezone),
    };
  }

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

async function buildLeaderboard(period = "day") {
  const settings = await getFeatureSetting("leaderboard");
  const range = getPeriodRange(period);
  const groupedViews = prisma.analyticsView && typeof prisma.analyticsView.groupBy === "function"
    ? await prisma.analyticsView.groupBy({
      by: ["slug", "sessionId"],
      where:
        range.period === "all"
          ? undefined
          : {
              visitedAt: {
                gte: range.startUtc,
                lt: range.endUtc,
              },
            },
    })
    : [];

  const uniqueViewsBySlug = new Map();
  groupedViews.forEach((row) => {
    const slug = String(row?.slug || "").trim().toUpperCase();
    if (!slug) return;
    uniqueViewsBySlug.set(slug, (uniqueViewsBySlug.get(slug) || 0) + 1);
  });

  const rankedByViews = Array.from(uniqueViewsBySlug.entries())
    .map(([slug, views]) => ({ slug, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 1000);

  const slugRows = rankedByViews.length
    ? await prisma.slug.findMany({
      where: {
        fullSlug: { in: rankedByViews.map((row) => row.slug) },
        status: { in: ["approved", "active", "private", "paused"] },
      },
      select: {
        fullSlug: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            plan: true,
            isVerified: true,
            verifiedCompany: true,
            profileCard: {
              select: {
                name: true,
                role: true,
                avatarUrl: true,
              },
            },
            unqScore: {
              select: {
                score: true,
              },
            },
          },
        },
      },
    })
    : [];

  const bySlug = new Map(
    slugRows.map((row) => [
      String(row.fullSlug || "").toUpperCase(),
      row,
    ]),
  );

  const owners = new Map();
  for (const entry of rankedByViews) {
    const row = bySlug.get(entry.slug);
    const owner = row?.owner;
    const ownerId = owner?.id ? String(owner.id) : "";
    if (!row || !owner || !ownerId) continue;

    const existing = owners.get(ownerId);
    if (!existing) {
      owners.set(ownerId, {
        views: entry.views,
        ownerName: owner.profileCard?.name || owner.displayName || owner.firstName || "UNQX User",
        ownerRole: owner.profileCard?.role || "",
        ownerCompany: owner.verifiedCompany || owner.profileCard?.role || "",
        avatarUrl: owner.profileCard?.avatarUrl || null,
        plan: owner.plan || "none",
        userId: ownerId,
        telegramId: ownerId,
        score: Number(owner.unqScore?.score || 0),
        isVerified: Boolean(owner.isVerified),
        rankedSlugs: [entry.slug],
      });
      continue;
    }

    existing.views += entry.views;
    existing.rankedSlugs.push(entry.slug);
  }

  const ownerIds = Array.from(owners.keys());
  const ownerSlugRows = ownerIds.length
    ? await prisma.slug.findMany({
      where: {
        ownerId: { in: ownerIds },
        status: { in: ["approved", "active", "private", "paused"] },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        ownerId: true,
        fullSlug: true,
      },
    })
    : [];

  const ownerSlugs = new Map();
  for (const row of ownerSlugRows) {
    const ownerId = String(row.ownerId || "");
    if (!ownerId) continue;
    const current = ownerSlugs.get(ownerId) || [];
    current.push(String(row.fullSlug || "").toUpperCase());
    ownerSlugs.set(ownerId, current);
  }

  const validItems = Array.from(owners.values())
    .map((item) => {
      const slugs = ownerSlugs.get(item.userId) || item.rankedSlugs;
      const slug = slugs[0] || item.rankedSlugs[0] || "";
      return {
        slug,
        slugs,
        views: item.views,
        ownerName: item.ownerName,
        ownerRole: item.ownerRole,
        ownerCompany: item.ownerCompany,
        avatarUrl: item.avatarUrl,
        plan: item.plan,
        userId: item.userId,
        telegramId: item.telegramId,
        score: item.score,
        isVerified: item.isVerified,
      };
    })
    .filter((item) => item.slug)
    .sort((a, b) => b.views - a.views)
    .slice(0, 1000);

  const total = validItems.length;
  const items = validItems.map((item, index) => ({
    ...item,
    rank: index + 1,
    topPercent: Math.max(1, Math.ceil(((index + 1) / Math.max(1, total)) * 100)),
    rarityLabel: "",
  }));

  const publicLimit = Math.max(1, Math.min(200, Number(settings.publicLimit) || 20));

  return {
    period: range.period,
    generatedAt: new Date().toISOString(),
    settings,
    items,
    publicItems: items.slice(0, publicLimit),
  };
}

async function getUserLeaderboardSummary({ userId, telegramId, period = "day" }) {
  const targetId = userId || telegramId;
  if (!targetId) return null;
  const board = await buildLeaderboard(period);
  const target = board.items.find((item) => item.userId === targetId || item.telegramId === targetId);
  if (!target) return null;

  const limit = Math.max(1, Number(board.settings.publicLimit) || 20);
  const topN = board.items.slice(0, limit);
  const cutoffViews = topN.length === limit ? Number(topN[topN.length - 1].views || 0) : 0;
  return {
    rank: target.rank,
    slug: target.slug,
    score: target.score,
    views: target.views,
    toTopViews: target.rank <= limit ? 0 : Math.max(0, cutoffViews - Number(target.views || 0) + 1),
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
    by: ["slug", "sessionId"],
    where: {
      visitedAt: { gte: windowStart, lte: now },
    },
    _count: { _all: true },
  });

  const uniqueBySlug = new Map();
  grouped.forEach((row) => {
    const slug = String(row.slug || "");
    if (!slug) return;
    uniqueBySlug.set(slug, (uniqueBySlug.get(slug) || 0) + 1);
  });

  const suspicious = Array.from(uniqueBySlug.entries())
    .map(([slug, views]) => ({ slug, views }))
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
  const targetSlug = String(slug || "").toUpperCase();
  const found = board.items.find((item) => Array.isArray(item.slugs) && item.slugs.includes(targetSlug));
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
