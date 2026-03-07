const { createHash } = require("node:crypto");

const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { getUserSession } = require("../../middleware/auth");
const { requireCsrfToken } = require("../../middleware/csrf");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { sendTapPushNotification, sendExpoPushToUser } = require("../../services/push");

const router = express.Router();
const WRITE_OPERATIONS = new Set(["write", "lock"]);
const SOURCE_SET = new Set(["nfc", "qr", "direct", "share", "widget"]);
const SOURCE_ALIASES = {
  telegram: "share",
  other: "direct",
  nfc_scan: "nfc",
  nfc_write: "nfc",
};

const CITY_TRANSLIT_MAP = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  қ: "q",
  ҳ: "h",
  ғ: "g",
  ў: "u",
};

const UZ_CITY_COORDS = {
  tashkent: { x: 214, y: 88 },
  toshkent: { x: 214, y: 88 },
  chirchiq: { x: 219, y: 81 },
  angren: { x: 224, y: 86 },
  gulistan: { x: 203, y: 105 },
  sirdarya: { x: 202, y: 108 },
  jizzakh: { x: 184, y: 101 },
  djizzak: { x: 184, y: 101 },
  samarkand: { x: 164, y: 98 },
  navoiy: { x: 132, y: 96 },
  navoi: { x: 132, y: 96 },
  bukhara: { x: 109, y: 93 },
  buxoro: { x: 109, y: 93 },
  qarshi: { x: 156, y: 121 },
  karshi: { x: 156, y: 121 },
  termiz: { x: 212, y: 140 },
  surxondaryo: { x: 206, y: 134 },
  denov: { x: 222, y: 130 },
  fergana: { x: 263, y: 84 },
  ferghana: { x: 263, y: 84 },
  namangan: { x: 247, y: 82 },
  andijan: { x: 279, y: 88 },
  nukus: { x: 56, y: 42 },
  urgench: { x: 76, y: 79 },
  xorazm: { x: 77, y: 83 },
  khorezm: { x: 77, y: 83 },
  karakalpakstan: { x: 52, y: 47 },
};

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeSource(value) {
  const source = String(value || "")
    .trim()
    .toLowerCase();
  if (!source) return "direct";
  const aliased = SOURCE_ALIASES[source] || source;
  if (SOURCE_SET.has(aliased)) return aliased;

  // DB can contain verbose/legacy source labels after manual edits/imports.
  if (aliased.includes("nfc")) return "nfc";
  if (aliased.includes("qr")) return "qr";
  if (aliased.includes("telegram") || aliased.includes("share") || aliased.includes("ref")) return "share";
  if (aliased.includes("widget")) return "widget";
  if (aliased.includes("direct") || aliased.includes("link") || aliased.includes("web") || aliased.includes("site")) {
    return "direct";
  }

  return "direct";
}

function normalizeCityKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u02bc\u02bb\u2018\u2019\u201b\u0060\u00b4]/g, "'")
    .replace(/ў/g, "у")
    .replace(/қ/g, "к")
    .replace(/ҳ/g, "х")
    .replace(/ғ/g, "г")
    .replace(/\u02bb/g, "");

  return normalized
    .split("")
    .map((ch) => CITY_TRANSLIT_MAP[ch] || ch)
    .join("")
    .replace(/['`\-\s]+/g, "");
}

function fallbackGeoSlot(city) {
  const key = normalizeCityKey(city) || "unknown";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  const x = 92 + (hash % 170);
  const y = 50 + ((hash >>> 8) % 80);
  return { x, y };
}

function resolveUzbekistanCityPoint(city) {
  const key = normalizeCityKey(city);
  if (key && UZ_CITY_COORDS[key]) {
    return UZ_CITY_COORDS[key];
  }
  return fallbackGeoSlot(city);
}

function parseSourcePeriodStart(periodRaw) {
  const period = String(periodRaw || "30d")
    .trim()
    .toLowerCase();
  if (period === "7d") return parsePeriodStart(7);
  if (period === "all") return null;
  return parsePeriodStart(30);
}

function sourceStatsFromRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const sourceMap = new Map();
  for (const item of safeRows) {
    const source = normalizeSource(item?.source);
    const count = Math.max(0, Number(item?.count || 0));
    sourceMap.set(source, (sourceMap.get(source) || 0) + count);
  }
  const normalizedRows = Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count }));
  const total = normalizedRows.reduce((sum, item) => sum + item.count, 0);

  return normalizedRows
    .filter((item) => item.count > 0)
    .map((item) => ({
      source: item.source,
      count: item.count,
      percent: total > 0 ? Math.round((item.count * 1000) / total) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function sourceStatsFromMap(sourceMap) {
  return sourceStatsFromRows(
    Object.entries(sourceMap || {}).map(([source, count]) => ({
      source,
      count,
    })),
  );
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function parsePeriodStart(days) {
  return new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
}

function detectPlatform(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "macos";
  return "unknown";
}

function normalizeIp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }
  if (raw === "::1") {
    return "127.0.0.1";
  }
  return raw;
}

function pickClientIp(req) {
  const forwardedFor = String(req.get("x-forwarded-for") || "");
  const realIp = String(req.get("x-real-ip") || "");
  const firstForwarded = forwardedFor ? forwardedFor.split(",")[0].trim() : "";
  return normalizeIp(firstForwarded) || normalizeIp(realIp) || normalizeIp(req.ip);
}

function extractSlugFromUrl(rawUrl) {
  const candidate = String(rawUrl || "").trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const tail = url.pathname.split("/").filter(Boolean).at(-1);
    const slug = sanitizeSlug(tail);
    return /^[A-Z]{3}\d{3}$/.test(slug) ? slug : null;
  } catch {
    const match = candidate.match(/([A-Za-z]{3}\d{3})/);
    if (!match) return null;
    const slug = sanitizeSlug(match[1]);
    return /^[A-Z]{3}\d{3}$/.test(slug) ? slug : null;
  }
}

function isMissingStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  return code === "42P01" || code === "42703";
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeStringList(value) {
  return parseJsonArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeProfileButtons(value) {
  return parseJsonArray(value)
    .map((item) => {
      const source = item && typeof item === "object" ? item : {};
      const label = String(source.label || source.type || "").trim().slice(0, 50);
      const url = String(source.url || source.value || source.href || "").trim();
      if (!label || !url) return null;
      return {
        icon: String(source.icon || source.type || "other").trim().toLowerCase() || "other",
        label,
        url,
      };
    })
    .filter(Boolean);
}

async function getOwnedSlugs(userId) {
  const rows = await prisma.slug.findMany({
    where: {
      ownerId: userId,
      status: {
        in: ["active", "private", "paused", "approved"],
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: {
      fullSlug: true,
      isPrimary: true,
    },
  });

  return rows.map((row) => row.fullSlug);
}

async function getPrimarySlug(userId) {
  const slugs = await getOwnedSlugs(userId);
  return slugs[0] || null;
}

async function getUserCity(userId) {
  if (!userId) return null;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { city: true },
  });
  const city = String(row?.city || "").trim();
  return city || null;
}

function buildSeries(rows, days) {
  const byDate = new Map();
  for (const row of rows) {
    const key = String(row.date || "");
    const value = Number(row.count || 0);
    if (!key) continue;
    byDate.set(key, Number.isFinite(value) ? value : 0);
  }

  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(byDate.get(key) || 0);
  }
  return result;
}

async function createTapEvent({
  ownerSlug,
  ownerId,
  visitorUserId,
  visitorSlug,
  source,
  city,
  country,
  userAgent,
  visitorIp,
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO tap_events (
        owner_slug,
        visitor_slug,
        visitor_user_id,
        visitor_ip,
        user_agent,
        source,
        city,
        country
      )
      VALUES (
        ${ownerSlug},
        ${visitorSlug || null},
        ${visitorUserId || null},
        ${visitorIp || null},
        ${userAgent || null},
        ${source},
        ${city || null},
        ${country || null}
      )
    `;

    if (ownerId && visitorUserId && ownerId !== visitorUserId && visitorSlug) {
      await prisma.$executeRaw`
        INSERT INTO user_contacts (
          owner_id,
          contact_slug,
          contact_user_id,
          saved,
          subscribed,
          first_tap_at,
          last_tap_at,
          tap_count
        )
        VALUES (
          ${ownerId},
          ${visitorSlug},
          ${visitorUserId},
          false,
          false,
          now(),
          now(),
          1
        )
        ON CONFLICT (owner_id, contact_slug)
        DO UPDATE SET
          contact_user_id = EXCLUDED.contact_user_id,
          last_tap_at = now(),
          tap_count = user_contacts.tap_count + 1
      `;

      await prisma.$executeRaw`
        INSERT INTO notifications (
          user_id,
          type,
          title,
          body,
          data
        )
        VALUES (
          ${ownerId},
          'tap',
          'Новый тап',
          ${`${visitorSlug} открыл вашу визитку`},
          ${JSON.stringify({ ownerSlug, visitorSlug, source })}
        )
      `;

      void sendTapPushNotification({
        ownerId,
        ownerSlug,
        visitorSlug,
        source,
      }).catch((pushError) => {
        console.error("[push] failed to send tap notification", {
          ownerId,
          ownerSlug,
          visitorSlug,
          source,
          message: pushError?.message || String(pushError),
        });
      });
    }
  } catch (error) {
    if (isMissingStorageError(error)) {
      return;
    }
    throw error;
  }
}

async function upsertNfcTag({ userId, uid, linkedSlug }) {
  if (!uid) return;
  const normalizedUid = String(uid).trim().slice(0, 80);
  if (!normalizedUid) return;

  await prisma.$executeRaw`
    INSERT INTO nfc_tags (
      user_id,
      uid,
      name,
      linked_slug,
      tap_count,
      last_tap_at,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${userId},
      ${normalizedUid},
      ${`Tag ${normalizedUid.slice(-4).toUpperCase()}`},
      ${linkedSlug || null},
      ${linkedSlug ? 1 : 0},
      ${linkedSlug ? new Date() : null},
      'ok',
      now(),
      now()
    )
    ON CONFLICT (uid)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      linked_slug = COALESCE(EXCLUDED.linked_slug, nfc_tags.linked_slug),
      tap_count = CASE
        WHEN EXCLUDED.linked_slug IS NOT NULL THEN nfc_tags.tap_count + 1
        ELSE nfc_tags.tap_count
      END,
      last_tap_at = CASE
        WHEN EXCLUDED.linked_slug IS NOT NULL THEN now()
        ELSE nfc_tags.last_tap_at
      END,
      updated_at = now()
  `;
}

async function appendNfcHistory({ userId, slug, uid, operation, url, password }) {
  const normalizedOperation = WRITE_OPERATIONS.has(operation) ? operation : String(operation || "read");
  await prisma.$executeRaw`
    INSERT INTO nfc_history (
      user_id,
      slug,
      uid,
      operation,
      url,
      password_hash,
      created_at
    )
    VALUES (
      ${userId},
      ${slug || null},
      ${uid || null},
      ${normalizedOperation},
      ${url || null},
      ${password ? createHash("sha256").update(String(password)).digest("hex") : null},
      now()
    )
  `;
}

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const [user, slugs, card] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          username: true,
          email: true,
          plan: true,
          status: true,
        },
      }),
      prisma.slug.findMany({
        where: { ownerId: userId, status: { in: ["active", "private", "paused", "approved"] } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { fullSlug: true, isPrimary: true, status: true },
      }),
      prisma.profileCard.findUnique({
        where: { ownerId: userId },
        select: {
          name: true,
          role: true,
          email: true,
          extraPhone: true,
          avatarUrl: true,
          buttons: true,
          theme: true,
        },
      }),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const selectedSlug = slugs.find((item) => item.isPrimary)?.fullSlug || slugs[0]?.fullSlug || null;

    res.json({
      user: {
        ...user,
        name: card?.name || user.displayName || user.firstName || "UNQX User",
        slug: selectedSlug || "",
        card: card
          ? {
            name: card.name,
            role: card.role,
            email: card.email,
            extraPhone: card.extraPhone,
            avatarUrl: card.avatarUrl,
            buttons: card.buttons,
            theme: card.theme,
          }
          : null,
      },
      slugs: slugs.map((item) => ({
        fullSlug: item.fullSlug,
        isPrimary: item.isPrimary,
        status: item.status,
      })),
      selectedSlug,
    });
  }),
);

router.get(
  "/analytics/summary",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const slugs = await getOwnedSlugs(userId);
    if (slugs.length === 0) {
      res.json({
        summary: {
          totalTaps: 0,
          todayTaps: 0,
          growth: 0,
          weekTaps: Array.from({ length: 7 }, () => 0),
          monthTaps: Array.from({ length: 30 }, () => 0),
          sources: [],
          geo: [],
        },
      });
      return;
    }

    try {
      const [totalRows, todayRows, monthRows, prevMonthRows, weekRows, monthSeriesRows, sourceRows, geoRows] = await Promise.all([
        prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM tap_events WHERE owner_slug = ANY(${slugs}::varchar[])`,
        prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM tap_events WHERE owner_slug = ANY(${slugs}::varchar[]) AND created_at >= CURRENT_DATE`,
        prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM tap_events WHERE owner_slug = ANY(${slugs}::varchar[]) AND created_at >= ${parsePeriodStart(30)}`,
        prisma.$queryRaw`
          SELECT COUNT(*)::int AS count
          FROM tap_events
          WHERE owner_slug = ANY(${slugs}::varchar[])
            AND created_at >= ${parsePeriodStart(60)}
            AND created_at < ${parsePeriodStart(30)}
        `,
        prisma.$queryRaw`
          SELECT DATE(created_at)::text AS date, COUNT(*)::int AS count
          FROM tap_events
          WHERE owner_slug = ANY(${slugs}::varchar[])
            AND created_at >= ${parsePeriodStart(7)}
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `,
        prisma.$queryRaw`
          SELECT DATE(created_at)::text AS date, COUNT(*)::int AS count
          FROM tap_events
          WHERE owner_slug = ANY(${slugs}::varchar[])
            AND created_at >= ${parsePeriodStart(30)}
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `,
        prisma.$queryRaw`
          SELECT source, COUNT(*)::int AS count
          FROM tap_events
          WHERE owner_slug = ANY(${slugs}::varchar[])
            AND created_at >= ${parsePeriodStart(30)}
          GROUP BY source
          ORDER BY COUNT(*) DESC
        `,
        prisma.$queryRaw`
          SELECT city, COUNT(*)::int AS count
          FROM (
            SELECT COALESCE(NULLIF(BTRIM(u.city), ''), NULLIF(BTRIM(te.city), '')) AS city
            FROM tap_events te
            LEFT JOIN users u ON u.id = te.visitor_user_id
            WHERE te.owner_slug = ANY(${slugs}::varchar[])
              AND te.created_at >= ${parsePeriodStart(30)}
              AND te.visitor_user_id IS NOT NULL
          ) geo
          WHERE city IS NOT NULL
          GROUP BY city
          ORDER BY COUNT(*) DESC
          LIMIT 20
        `,
      ]);

      const total = Number(totalRows?.[0]?.count || 0);
      const today = Number(todayRows?.[0]?.count || 0);
      const monthCount = Number(monthRows?.[0]?.count || 0);
      const prevMonthCount = Number(prevMonthRows?.[0]?.count || 0);
      const growth = prevMonthCount > 0 ? Math.round(((monthCount - prevMonthCount) / prevMonthCount) * 100) : monthCount > 0 ? 100 : 0;

      const weekTaps = buildSeries(Array.isArray(weekRows) ? weekRows : [], 7);
      const monthTaps = buildSeries(Array.isArray(monthSeriesRows) ? monthSeriesRows : [], 30);
      const sources = sourceStatsFromRows(sourceRows);
      const geoMax = Math.max(
        1,
        ...(Array.isArray(geoRows) ? geoRows.map((item) => Number(item.count || 0)) : [1]),
      );
      const geo = Array.isArray(geoRows)
        ? geoRows.map((item) => {
          const city = String(item.city || "Unknown");
          const slot = resolveUzbekistanCityPoint(city);
          const count = Number(item.count || 0);
          return {
            city,
            value: count,
            x: slot.x,
            y: slot.y,
            r: Math.max(2, Math.min(8, Math.round((count / geoMax) * 8))),
          };
        })
        : [];

      if (total === 0 && prisma.analyticsView) {
        const [allRows, todayFallback, byDayRows] = await Promise.all([
          prisma.analyticsView.findMany({
            where: {
              slug: { in: slugs },
              visitedAt: { gte: parsePeriodStart(60) },
            },
            select: {
              source: true,
              city: true,
              visitedAt: true,
            },
          }),
          prisma.analyticsView.count({
            where: {
              slug: { in: slugs },
              visitedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),
          prisma.analyticsView.findMany({
            where: {
              slug: { in: slugs },
              visitedAt: { gte: parsePeriodStart(30) },
            },
            select: {
              visitedAt: true,
            },
          }),
        ]);

        const totalFallback = await prisma.analyticsView.count({
          where: { slug: { in: slugs } },
        });
        const monthStart = parsePeriodStart(30);
        const prevMonthStart = parsePeriodStart(60);
        const monthRowsFallback = allRows.filter((row) => row.visitedAt >= monthStart);
        const prevMonthRowsFallback = allRows.filter((row) => row.visitedAt >= prevMonthStart && row.visitedAt < monthStart);
        const growthFallback =
          prevMonthRowsFallback.length > 0
            ? Math.round(((monthRowsFallback.length - prevMonthRowsFallback.length) / prevMonthRowsFallback.length) * 100)
            : monthRowsFallback.length > 0
              ? 100
              : 0;
        const byDay = new Map();
        for (const row of byDayRows) {
          const key = row.visitedAt.toISOString().slice(0, 10);
          byDay.set(key, (byDay.get(key) || 0) + 1);
        }
        const weekFallback = buildSeries(
          Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
          7,
        );
        const monthFallback = buildSeries(
          Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
          30,
        );
        const sourceMap = {};
        for (const row of monthRowsFallback) {
          const sourceKey = normalizeSource(row.source);
          sourceMap[sourceKey] = (sourceMap[sourceKey] || 0) + 1;
        }
        const sourceFallback = sourceStatsFromMap(sourceMap);
        // analyticsView does not store visitor user ids, so we cannot safely exclude guests there.
        const geoFallback = [];

        res.json({
          summary: {
            totalTaps: totalFallback,
            todayTaps: todayFallback,
            growth: growthFallback,
            weekTaps: weekFallback,
            monthTaps: monthFallback,
            sources: sourceFallback,
            geo: geoFallback,
          },
        });
        return;
      }

      res.json({
        summary: {
          totalTaps: total,
          todayTaps: today,
          growth,
          weekTaps,
          monthTaps,
          sources,
          geo,
        },
      });
    } catch (error) {
      if (isMissingStorageError(error)) {
        if (prisma.analyticsView) {
          const [totalFallback, todayFallback, rows60] = await Promise.all([
            prisma.analyticsView.count({
              where: { slug: { in: slugs } },
            }),
            prisma.analyticsView.count({
              where: {
                slug: { in: slugs },
                visitedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              },
            }),
            prisma.analyticsView.findMany({
              where: {
                slug: { in: slugs },
                visitedAt: { gte: parsePeriodStart(60) },
              },
              select: {
                source: true,
                city: true,
                visitedAt: true,
              },
            }),
          ]);
          const monthStart = parsePeriodStart(30);
          const prevMonthStart = parsePeriodStart(60);
          const monthRows = rows60.filter((row) => row.visitedAt >= monthStart);
          const prevRows = rows60.filter((row) => row.visitedAt >= prevMonthStart && row.visitedAt < monthStart);
          const growth =
            prevRows.length > 0
              ? Math.round(((monthRows.length - prevRows.length) / prevRows.length) * 100)
              : monthRows.length > 0
                ? 100
                : 0;
          const dayMap = new Map();
          for (const row of monthRows) {
            const key = row.visitedAt.toISOString().slice(0, 10);
            dayMap.set(key, (dayMap.get(key) || 0) + 1);
          }
          const mapped = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
          const sourceMap = {};
          for (const row of monthRows) {
            const sourceKey = normalizeSource(row.source);
            sourceMap[sourceKey] = (sourceMap[sourceKey] || 0) + 1;
          }
          res.json({
            summary: {
              totalTaps: totalFallback,
              todayTaps: todayFallback,
              growth,
              weekTaps: buildSeries(mapped, 7),
              monthTaps: buildSeries(mapped, 30),
              sources: sourceStatsFromMap(sourceMap),
              geo: [],
            },
          });
          return;
        }

        res.json({
          summary: {
            totalTaps: 0,
            todayTaps: 0,
            growth: 0,
            weekTaps: Array.from({ length: 7 }, () => 0),
            monthTaps: Array.from({ length: 30 }, () => 0),
            sources: [],
            geo: [],
          },
        });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/analytics/recent",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const slugs = await getOwnedSlugs(userId);
    if (slugs.length === 0) {
      res.json({ items: [] });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        SELECT id, visitor_slug, source, created_at
        FROM tap_events
        WHERE owner_slug = ANY(${slugs}::varchar[])
        ORDER BY created_at DESC
        LIMIT 20
      `;
      const visitorSlugs = Array.from(
        new Set(
          (Array.isArray(rows) ? rows : [])
            .map((item) => sanitizeSlug(item.visitor_slug))
            .filter(Boolean),
        ),
      );
      const names = visitorSlugs.length
        ? await prisma.$queryRaw`
            SELECT
              s.full_slug,
              COALESCE(pc.name, u.display_name, u.first_name, 'UNQX User') AS name
            FROM slugs s
            LEFT JOIN users u ON u.id = s.owner_id
            LEFT JOIN profile_cards pc ON pc.owner_id = u.id
            WHERE s.full_slug = ANY(${visitorSlugs}::varchar[])
          `
        : [];
      const nameBySlug = new Map(
        (Array.isArray(names) ? names : []).map((item) => [String(item.full_slug), String(item.name || "UNQX User")]),
      );

      if (Array.isArray(rows) && rows.length === 0 && prisma.analyticsView) {
        const fallbackRows = await prisma.analyticsView.findMany({
          where: { slug: { in: slugs } },
          orderBy: { visitedAt: "desc" },
          take: 20,
          select: {
            id: true,
            slug: true,
            source: true,
            visitedAt: true,
          },
        });
        res.json({
          items: fallbackRows.map((item) => ({
            id: String(item.id),
            slug: sanitizeSlug(item.slug),
            source: normalizeSource(item.source),
            name: "Гость",
            timestamp: toIso(item.visitedAt),
          })),
        });
        return;
      }

      res.json({
        items: (Array.isArray(rows) ? rows : []).map((item) => ({
          id: String(item.id),
          slug: sanitizeSlug(item.visitor_slug) || "UNQ000",
          source: normalizeSource(item.source),
          name: nameBySlug.get(sanitizeSlug(item.visitor_slug)) || "Неизвестный",
          timestamp: toIso(item.created_at),
        })),
      });
    } catch (error) {
      if (isMissingStorageError(error) && prisma.analyticsView) {
        const fallbackRows = await prisma.analyticsView.findMany({
          where: { slug: { in: slugs } },
          orderBy: { visitedAt: "desc" },
          take: 20,
          select: {
            id: true,
            slug: true,
            source: true,
            visitedAt: true,
          },
        });
        res.json({
          items: fallbackRows.map((item) => ({
            id: String(item.id),
            slug: sanitizeSlug(item.slug),
            source: normalizeSource(item.source),
            name: "Гость",
            timestamp: toIso(item.visitedAt),
          })),
        });
        return;
      }
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/analytics/sources",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }
    const slugs = await getOwnedSlugs(userId);
    if (slugs.length === 0) {
      res.json({ items: [] });
      return;
    }
    const periodStart = parseSourcePeriodStart(req.query?.period);

    try {
      const rows =
        periodStart === null
          ? await prisma.$queryRaw`
              SELECT source, COUNT(*)::int AS count
              FROM tap_events
              WHERE owner_slug = ANY(${slugs}::varchar[])
              GROUP BY source
              ORDER BY COUNT(*) DESC
            `
          : await prisma.$queryRaw`
              SELECT source, COUNT(*)::int AS count
              FROM tap_events
              WHERE owner_slug = ANY(${slugs}::varchar[])
                AND created_at >= ${periodStart}
              GROUP BY source
              ORDER BY COUNT(*) DESC
            `;
      res.json({ items: sourceStatsFromRows(rows) });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/analytics/geo",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }
    const slugs = await getOwnedSlugs(userId);
    if (slugs.length === 0) {
      res.json({ items: [] });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        SELECT city, country, COUNT(*)::int AS count
        FROM (
          SELECT
            COALESCE(NULLIF(BTRIM(u.city), ''), NULLIF(BTRIM(te.city), '')) AS city,
            te.country AS country
          FROM tap_events te
          LEFT JOIN users u ON u.id = te.visitor_user_id
          WHERE te.owner_slug = ANY(${slugs}::varchar[])
            AND te.visitor_user_id IS NOT NULL
        ) geo
        WHERE city IS NOT NULL
        GROUP BY city, country
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `;
      res.json({ items: Array.isArray(rows) ? rows : [] });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/contacts",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const q = String(req.query.q || "").trim().toLowerCase();
    try {
      const rows = await prisma.$queryRawUnsafe(
        `
          SELECT
            uc.contact_slug AS slug,
            uc.saved,
            uc.subscribed,
            uc.tap_count,
            uc.first_tap_at,
            uc.last_tap_at,
            COALESCE(pc.name, u.display_name, u.first_name, 'Unknown') AS name,
            pc.avatar_url AS "avatarUrl",
            pc.extra_phone AS phone,
            u.plan AS tag
          FROM user_contacts uc
          LEFT JOIN slugs s ON s.full_slug = uc.contact_slug
          LEFT JOIN users u ON u.id = s.owner_id
          LEFT JOIN profile_cards pc ON pc.owner_id = u.id
          WHERE uc.owner_id = $1
            AND (
              $2 = ''
              OR lower(uc.contact_slug) LIKE $3
              OR lower(COALESCE(pc.name, u.display_name, u.first_name, '')) LIKE $3
            )
          ORDER BY uc.last_tap_at DESC
          LIMIT 300
        `,
        userId,
        q,
        `%${q}%`,
      );

      res.json({
        items: (Array.isArray(rows) ? rows : []).map((item) => ({
          slug: sanitizeSlug(item.slug),
          name: String(item.name || "Unknown"),
          avatarUrl: item.avatarUrl || null,
          phone: item.phone || "",
          taps: Number(item.tap_count || 0),
          saved: Boolean(item.saved),
          subscribed: Boolean(item.subscribed),
          tag: String(item.tag || "basic"),
          lastSeen: toIso(item.last_tap_at),
        })),
      });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/directory",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const q = String(req.query.q || "").trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 24) || 24));
    const offset = (page - 1) * limit;

    let rows = [];
    try {
      rows = await prisma.$queryRawUnsafe(
        `
          SELECT
            s.full_slug AS slug,
            COALESCE(pc.name, u.display_name, u.first_name, 'Unknown') AS name,
            pc.avatar_url AS "avatarUrl",
            COALESCE(u.verified_company, '') AS city,
            COALESCE(u.plan, 'basic') AS tag,
            COALESCE(s.analytics_views_count, 0) AS taps,
            COALESCE(uc.subscribed, FALSE) AS subscribed,
            COALESCE(uc.saved, FALSE) AS saved
          FROM slugs s
          JOIN users u ON u.id = s.owner_id
          LEFT JOIN profile_cards pc ON pc.owner_id = u.id
          LEFT JOIN user_contacts uc ON uc.owner_id = $1 AND uc.contact_slug = s.full_slug
          WHERE s.status = 'active'
            AND u.status = 'active'
            AND COALESCE(u.show_in_directory, TRUE) = TRUE
            AND (
              $2 = ''
              OR lower(s.full_slug) LIKE $3
              OR lower(COALESCE(pc.name, u.display_name, u.first_name, '')) LIKE $3
            )
          ORDER BY s.analytics_views_count DESC, s.updated_at DESC
          LIMIT $4 OFFSET $5
        `,
        userId,
        q,
        `%${q}%`,
        limit,
        offset,
      );
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
      rows = await prisma.$queryRawUnsafe(
        `
          SELECT
            s.full_slug AS slug,
            COALESCE(pc.name, u.display_name, u.first_name, 'Unknown') AS name,
            pc.avatar_url AS "avatarUrl",
            COALESCE(u.verified_company, '') AS city,
            COALESCE(u.plan, 'basic') AS tag,
            COALESCE(s.analytics_views_count, 0) AS taps,
            FALSE AS subscribed,
            FALSE AS saved
          FROM slugs s
          JOIN users u ON u.id = s.owner_id
          LEFT JOIN profile_cards pc ON pc.owner_id = u.id
          WHERE s.status = 'active'
            AND u.status = 'active'
            AND COALESCE(u.show_in_directory, TRUE) = TRUE
            AND (
              $1 = ''
              OR lower(s.full_slug) LIKE $2
              OR lower(COALESCE(pc.name, u.display_name, u.first_name, '')) LIKE $2
            )
          ORDER BY s.analytics_views_count DESC, s.updated_at DESC
          LIMIT $3 OFFSET $4
        `,
        q,
        `%${q}%`,
        limit,
        offset,
      );
    }

    res.json({
      items: (Array.isArray(rows) ? rows : []).map((item) => ({
        slug: sanitizeSlug(item.slug),
        name: String(item.name || "Unknown"),
        avatarUrl: item.avatarUrl || null,
        city: String(item.city || ""),
        tag: String(item.tag || "basic"),
        taps: Number(item.taps || 0),
        subscribed: Boolean(item.subscribed),
        saved: Boolean(item.saved),
      })),
      page,
      limit,
    });
  }),
);

router.get(
  "/directory/:slug",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const slug = sanitizeSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: "Slug is required", code: "VALIDATION_ERROR" });
      return;
    }

    let rows = [];
    try {
      rows = await prisma.$queryRawUnsafe(
        `
          SELECT
            s.full_slug AS slug,
            s.owner_id AS "ownerId",
            COALESCE(pc.name, u.display_name, u.first_name, 'Unknown') AS name,
            pc.avatar_url AS "avatarUrl",
            COALESCE(u.verified_company, '') AS city,
            COALESCE(u.plan, 'basic') AS tag,
            COALESCE(s.analytics_views_count, 0) AS taps,
            COALESCE(pc.role, '') AS role,
            COALESCE(pc.bio, '') AS bio,
            COALESCE(pc.email, '') AS email,
            COALESCE(pc.extra_phone, '') AS phone,
            COALESCE(pc.tags, '[]'::jsonb) AS tags,
            COALESCE(pc.buttons, '[]'::jsonb) AS buttons,
            COALESCE(uc.subscribed, FALSE) AS subscribed,
            COALESCE(uc.saved, FALSE) AS saved
          FROM slugs s
          JOIN users u ON u.id = s.owner_id
          LEFT JOIN profile_cards pc ON pc.owner_id = u.id
          LEFT JOIN user_contacts uc ON uc.owner_id = $1 AND uc.contact_slug = s.full_slug
          WHERE s.full_slug = $2
            AND s.status IN ('active', 'private', 'paused', 'approved')
            AND u.status = 'active'
          LIMIT 1
        `,
        userId,
        slug,
      );
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
      res.status(404).json({ error: "Resident not found", code: "NOT_FOUND" });
      return;
    }

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      res.status(404).json({ error: "Resident not found", code: "NOT_FOUND" });
      return;
    }

    let slugRows = [];
    try {
      slugRows = await prisma.$queryRawUnsafe(
        `
          SELECT full_slug AS slug
          FROM slugs
          WHERE owner_id = $1
            AND status IN ('active', 'private', 'paused', 'approved')
          ORDER BY is_primary DESC, created_at ASC
          LIMIT 24
        `,
        row.ownerId,
      );
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }

    const slugs = (Array.isArray(slugRows) ? slugRows : [])
      .map((item) => sanitizeSlug(item.slug))
      .filter(Boolean);

    res.json({
      profile: {
        slug: sanitizeSlug(row.slug),
        slugs: slugs.length ? slugs : [sanitizeSlug(row.slug)],
        name: String(row.name || "Unknown"),
        avatarUrl: row.avatarUrl || null,
        city: String(row.city || ""),
        tag: String(row.tag || "basic"),
        taps: Number(row.taps || 0),
        role: String(row.role || ""),
        bio: String(row.bio || ""),
        email: String(row.email || ""),
        phone: String(row.phone || ""),
        buttons: normalizeProfileButtons(row.buttons),
        tags: normalizeStringList(row.tags),
        subscribed: Boolean(row.subscribed),
        saved: Boolean(row.saved),
      },
    });
  }),
);

router.post(
  "/contacts/:slug/save",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const slug = sanitizeSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: "Slug is required", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      const current = await prisma.$queryRaw`
        SELECT saved
        FROM user_contacts
        WHERE owner_id = ${userId} AND contact_slug = ${slug}
        LIMIT 1
      `;
      const savedNow = !Boolean(current?.[0]?.saved);

      await prisma.$executeRaw`
        INSERT INTO user_contacts (
          owner_id,
          contact_slug,
          saved,
          subscribed,
          first_tap_at,
          last_tap_at,
          tap_count
        )
        VALUES (
          ${userId},
          ${slug},
          ${savedNow},
          false,
          now(),
          now(),
          0
        )
        ON CONFLICT (owner_id, contact_slug)
        DO UPDATE SET
          saved = ${savedNow},
          last_tap_at = now()
      `;

      res.json({ ok: true, saved: savedNow });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
      res.json({ ok: true, saved: false });
    }
  }),
);

router.post(
  "/contacts/:slug/subscribe",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const slug = sanitizeSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: "Slug is required", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      const current = await prisma.$queryRaw`
        SELECT subscribed
        FROM user_contacts
        WHERE owner_id = ${userId} AND contact_slug = ${slug}
        LIMIT 1
      `;
      const subscribedNow = !Boolean(current?.[0]?.subscribed);

      await prisma.$executeRaw`
        INSERT INTO user_contacts (
          owner_id,
          contact_slug,
          saved,
          subscribed,
          first_tap_at,
          last_tap_at,
          tap_count
        )
        VALUES (
          ${userId},
          ${slug},
          false,
          ${subscribedNow},
          now(),
          now(),
          0
        )
        ON CONFLICT (owner_id, contact_slug)
        DO UPDATE SET
          subscribed = ${subscribedNow},
          last_tap_at = now()
      `;

      res.json({ ok: true, subscribed: subscribedNow });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
      res.json({ ok: true, subscribed: false });
    }
  }),
);

router.get(
  "/nfc/history",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        SELECT
          id,
          slug,
          uid,
          operation,
          created_at
        FROM nfc_history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 100
      `;

      res.json({
        items: (Array.isArray(rows) ? rows : []).map((row) => ({
          id: String(row.id),
          slug: sanitizeSlug(row.slug) || "UNQ000",
          uid: row.uid || undefined,
          type: String(row.operation || "read"),
          timestamp: toIso(row.created_at),
        })),
      });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/nfc/tags",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        SELECT
          uid,
          name,
          linked_slug,
          status,
          tap_count,
          last_tap_at,
          created_at
        FROM nfc_tags
        WHERE user_id = ${userId}
        ORDER BY COALESCE(last_tap_at, created_at) DESC
        LIMIT 100
      `;

      res.json({
        items: (Array.isArray(rows) ? rows : []).map((row) => ({
          uid: String(row.uid),
          name: String(row.name || "Метка"),
          linkedSlug: sanitizeSlug(row.linked_slug) || undefined,
          status: String(row.status || "ok"),
          tapCount: Number(row.tap_count || 0),
          lastTapAt: row.last_tap_at ? toIso(row.last_tap_at) : null,
        })),
      });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/nfc/scan",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const uid = String(req.body?.uid || "").trim().slice(0, 80);
    const url = String(req.body?.url || "").trim();
    const slug = extractSlugFromUrl(url);
    const shouldRecordTap = req.body?.recordTap === undefined ? true : Boolean(req.body?.recordTap);

    try {
      await appendNfcHistory({ userId, slug, uid, operation: "read", url });
      await upsertNfcTag({ userId, uid, linkedSlug: slug });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
    if (slug && shouldRecordTap) {
      const visitorSlug = await getPrimarySlug(userId);
      const visitorCity = await getUserCity(userId);
      const ownerSlugRow = await prisma.slug.findUnique({
        where: { fullSlug: slug },
        select: { ownerId: true },
      });
      try {
        await createTapEvent({
          ownerSlug: slug,
          ownerId: ownerSlugRow?.ownerId || null,
          visitorUserId: userId,
          visitorSlug,
          source: "nfc",
          city: visitorCity,
          country: null,
          userAgent: String(req.get("user-agent") || ""),
          visitorIp: pickClientIp(req),
        });
      } catch (error) {
        if (!isMissingStorageError(error)) {
          throw error;
        }
      }
    }

    res.json({ ok: true });
  }),
);

router.post(
  "/nfc/tap",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const ownerSlug = sanitizeSlug(req.body?.ownerSlug || req.body?.slug);
    if (!/^[A-Z]{3}\d{3}$/.test(ownerSlug)) {
      res.status(400).json({ error: "ownerSlug обязателен", code: "VALIDATION_ERROR" });
      return;
    }
    const source = normalizeSource(req.body?.source || "nfc");

    const ownerSlugRow = await prisma.slug.findUnique({
      where: { fullSlug: ownerSlug },
      select: { ownerId: true },
    });
    if (!ownerSlugRow) {
      res.status(404).json({ error: "Owner slug not found", code: "SLUG_NOT_FOUND" });
      return;
    }

    const visitorSlug = await getPrimarySlug(userId);
    const visitorCity = await getUserCity(userId);

    try {
      await createTapEvent({
        ownerSlug,
        ownerId: ownerSlugRow.ownerId || null,
        visitorUserId: userId,
        visitorSlug,
        source,
        city: visitorCity,
        country: null,
        userAgent: String(req.get("user-agent") || ""),
        visitorIp: pickClientIp(req),
      });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }

    res.json({ ok: true });
  }),
);

router.post(
  "/nfc/write",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const uid = String(req.body?.uid || "").trim().slice(0, 80);
    const url = String(req.body?.url || "").trim();
    const slug = extractSlugFromUrl(url);

    try {
      await appendNfcHistory({ userId, slug, uid, operation: "write", url });
      await upsertNfcTag({ userId, uid, linkedSlug: slug });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
    res.json({ ok: true });
  }),
);

router.post(
  "/nfc/verify",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const uid = String(req.body?.uid || "").trim().slice(0, 80);
    const url = String(req.body?.url || "").trim();
    const slug = extractSlugFromUrl(url);

    try {
      await appendNfcHistory({ userId, slug, uid, operation: "verify", url });
      await upsertNfcTag({ userId, uid, linkedSlug: slug });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
    res.json({ ok: true });
  }),
);

router.post(
  "/nfc/lock",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const uid = String(req.body?.uid || "").trim().slice(0, 80);
    const password = String(req.body?.password || "");
    if (password.length < 4) {
      res.status(400).json({ error: "Минимум 4 символа", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      await appendNfcHistory({
        userId,
        slug: null,
        uid,
        operation: "lock",
        url: null,
        password,
      });
      await upsertNfcTag({ userId, uid, linkedSlug: null });
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
    res.json({ ok: true });
  }),
);

router.patch(
  "/nfc/tags/:uid",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const uid = String(req.params.uid || "").trim().slice(0, 80);
    const name = String(req.body?.name || "").trim().slice(0, 100);
    if (!uid || !name) {
      res.status(400).json({ error: "UID и имя обязательны", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      await prisma.$executeRaw`
        UPDATE nfc_tags
        SET name = ${name}, updated_at = now()
        WHERE uid = ${uid} AND user_id = ${userId}
      `;
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
    res.json({ ok: true });
  }),
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        SELECT
          id,
          type,
          title,
          body,
          read,
          created_at
        FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 100
      `;

      res.json({
        items: (Array.isArray(rows) ? rows : []).map((item) => ({
          id: String(item.id),
          type: String(item.type || "system"),
          title: String(item.title || "UNQX"),
          subtitle: String(item.body || ""),
          read: Boolean(item.read),
          time: toIso(item.created_at),
        })),
      });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.json({ items: [] });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/notifications/read-all",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    try {
      await prisma.$executeRaw`
        UPDATE notifications
        SET read = true
        WHERE user_id = ${userId} AND read = false
      `;
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }

    res.json({ ok: true });
  }),
);

router.post(
  "/notifications/token",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const token = String(req.body?.token || "").trim();
    if (!token) {
      res.status(400).json({ error: "Token is required", code: "VALIDATION_ERROR" });
      return;
    }

    const platform = String(req.body?.platform || detectPlatform(req.get("user-agent")));
    try {
      await prisma.$executeRaw`
        INSERT INTO push_tokens (user_id, token, platform, created_at, updated_at)
        VALUES (${userId}, ${token}, ${platform}, now(), now())
        ON CONFLICT (user_id, token)
        DO UPDATE SET platform = EXCLUDED.platform, updated_at = now()
      `;
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }

    res.json({ ok: true });
  }),
);

router.post(
  "/notifications/test-send",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const title = String(req.body?.title || "Тестовое уведомление").trim().slice(0, 120);
    const body = String(req.body?.body || "Проверка push-уведомлений UNQX").trim().slice(0, 512);
    if (!title || !body) {
      res.status(400).json({ error: "Title and body are required", code: "VALIDATION_ERROR" });
      return;
    }

    const data = req.body?.data && typeof req.body.data === "object" ? req.body.data : { type: "test" };

    const result = await sendExpoPushToUser({
      userId,
      title,
      body,
      data,
    });

    res.json({
      ok: true,
      result,
    });
  }),
);

router.get(
  "/wristband/status",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const latest = await prisma.slugRequest.findFirst({
      where: { userId, bracelet: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!latest) {
      res.json({ status: null });
      return;
    }

    res.json({
      status: {
        status: String(latest.status || "pending").toLowerCase(),
        linkedSlug: sanitizeSlug(latest.slug),
        orderId: latest.id,
        model: "wristband",
        updatedAt: toIso(latest.updatedAt),
      },
    });
  }),
);

router.get(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const orderId = String(req.params.id || "").trim();
    const order = await prisma.slugRequest.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found", code: "ORDER_NOT_FOUND" });
      return;
    }

    res.json({
      order: {
        id: order.id,
        status: String(order.status || "pending").toLowerCase(),
        createdAt: toIso(order.createdAt),
        estimatedAt: toIso(order.updatedAt),
      },
    });
  }),
);

router.patch(
  "/me/card",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const name = String(req.body?.name || "").trim().slice(0, 120);
    if (!name) {
      res.status(400).json({ error: "Имя обязательно", code: "VALIDATION_ERROR" });
      return;
    }

    const buttons = Array.isArray(req.body?.buttons) ? req.body.buttons : [];
    const normalizedButtons = buttons
      .map((item) => ({
        type: String(item?.icon || "other"),
        label: String(item?.label || "").trim().slice(0, 50),
        value: String(item?.url || "").trim(),
      }))
      .filter((item) => item.label && item.value);

    const requestedTheme = String(req.body?.theme || "light").toLowerCase();
    const theme =
      requestedTheme === "dark" ? "default_dark" : requestedTheme === "gradient" ? "marble" : "linen";
    const role = String(req.body?.job || "").trim().slice(0, 120) || null;
    const bio = role || null;
    const email = String(req.body?.email || "").trim().slice(0, 100) || null;
    const extraPhone = String(req.body?.phone || "").trim().slice(0, 30) || null;
    const telegram = String(req.body?.telegram || "").trim();
    const tags = telegram ? [telegram.replace(/^@+/, "@")] : [];

    const rows = await prisma.$queryRaw`
      SELECT id
      FROM profile_cards
      WHERE owner_id = ${userId}
      LIMIT 1
    `;

    if (Array.isArray(rows) && rows[0]?.id) {
      await prisma.$executeRaw`
        UPDATE profile_cards
        SET
          name = ${name},
          role = ${role},
          bio = ${bio},
          email = ${email},
          extra_phone = ${extraPhone},
          tags = ${JSON.stringify(tags)}::jsonb,
          buttons = ${JSON.stringify(normalizedButtons)}::jsonb,
          theme = ${theme},
          updated_at = now()
        WHERE owner_id = ${userId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO profile_cards (
          owner_id,
          name,
          role,
          bio,
          email,
          extra_phone,
          tags,
          buttons,
          theme,
          show_branding,
          created_at,
          updated_at
        )
        VALUES (
          ${userId},
          ${name},
          ${role},
          ${bio},
          ${email},
          ${extraPhone},
          ${JSON.stringify(tags)}::jsonb,
          ${JSON.stringify(normalizedButtons)}::jsonb,
          ${theme},
          true,
          now(),
          now()
        )
      `;
    }

    const updated = await prisma.$queryRaw`
      SELECT *
      FROM profile_cards
      WHERE owner_id = ${userId}
      LIMIT 1
    `;
    res.json({ ok: true, card: Array.isArray(updated) ? updated[0] || null : null });
  }),
);

module.exports = {
  mobileApiRouter: router,
  createTapEvent,
  extractSlugFromUrl,
  pickClientIp,
  normalizeSource,
};
