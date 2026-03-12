const { createHash, randomUUID } = require("node:crypto");
const { Prisma } = require("@prisma/client");

const { prisma } = require("../db/prisma");
const { getUserSession } = require("../middleware/auth");
const { detectDevice } = require("./ua");
const { sendTapPushNotification } = require("./push");
const { resolveUzbekistanCity } = require("../constants/uzbekistan-cities");
const { resolveClientIp, buildViewerFingerprint } = require("./request-ip");

const TRACKED_SOURCES = new Set(["nfc", "qr", "direct", "share", "widget"]);
const TRACKED_BUTTON_TYPES = new Set([
  "telegram",
  "phone",
  "website",
  "card",
  "whatsapp",
  "instagram",
  "youtube",
  "email",
  "tiktok",
  "other",
]);
const VIEW_DEDUPE_WINDOW_MINUTES = 30;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeSource(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "direct";
  if (raw === "nfc_scan" || raw === "nfc_write") return "nfc";
  if (raw === "telegram") return "share";
  if (TRACKED_SOURCES.has(raw)) return raw;

  if (raw.includes("nfc")) return "nfc";
  if (raw.includes("qr")) return "qr";
  if (raw.includes("telegram") || raw.includes("share") || raw.includes("ref")) return "share";
  if (raw.includes("widget")) return "widget";
  if (raw.includes("direct") || raw.includes("link") || raw.includes("web") || raw.includes("site")) return "direct";

  return "direct";
}

function isMobileUA(ua) {
  return /android|iphone|ipad|mobile/i.test(String(ua || ""));
}

function resolveTapSource(req, rawSource) {
  const hasExplicitSource = rawSource !== undefined && rawSource !== null && String(rawSource).trim() !== "";
  if (hasExplicitSource) {
    return normalizeSource(rawSource);
  }

  const referer = String(req.get("referer") || "").trim();
  const userAgent = String(req.get("user-agent") || "");
  if (!referer && isMobileUA(userAgent)) {
    return "nfc";
  }
  return "direct";
}

function normalizeButtonType(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "other";
  return TRACKED_BUTTON_TYPES.has(raw) ? raw : "other";
}

function getAnalyticsSessionId(req, res) {
  const rawCookie = String(req.get("cookie") || "");
  const match = rawCookie.match(/(?:^|;\s*)unqx_sid=([^;]+)/);
  const existing = match ? decodeURIComponent(match[1]) : "";
  if (existing && /^[a-zA-Z0-9_-]{16,80}$/.test(existing)) {
    return existing;
  }

  const next = randomUUID().replace(/-/g, "").slice(0, 32);
  if (res && typeof res.append === "function") {
    res.append("Set-Cookie", `unqx_sid=${next}; Max-Age=31536000; Path=/; SameSite=Lax; HttpOnly`);
  }
  return next;
}

async function resolveGeoByIp(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return { city: "unknown", country: "" };
  }
  try {
    const response = await withTimeout(fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`), 2000);
    if (!response.ok) {
      return { city: "unknown", country: "" };
    }
    const payload = await response.json().catch(() => ({}));
    const cityRaw = String(payload?.city || "").trim();
    const country = String(payload?.country_name || payload?.country || "").trim();

    const normalizedCity = resolveUzbekistanCity(cityRaw);
    const city = normalizedCity || (cityRaw ? cityRaw.slice(0, 120) : "unknown");

    return {
      city,
      country: country ? country.slice(0, 120) : "",
    };
  } catch {
    return { city: "unknown", country: "" };
  }
}

async function getPrimarySlugForUser(userId) {
  if (!userId) return null;
  const row = await prisma.slug.findFirst({
    where: {
      ownerId: userId,
      status: { in: ["active", "private", "paused", "approved"] },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { fullSlug: true },
  });
  return row?.fullSlug || null;
}

async function resolveCityForView({ viewerUserId, visitorIp }) {
  if (viewerUserId && prisma.user) {
    try {
      const viewer = await prisma.user.findUnique({
        where: { id: viewerUserId },
        select: { city: true },
      });
      const city = String(viewer?.city || "").trim();
      if (city) {
        return city.slice(0, 120);
      }
    } catch {
      // ignore profile city lookup errors
    }
  }

  const geo = await resolveGeoByIp(visitorIp);
  return geo.city || "unknown";
}

async function runPostCommitSideEffects({ req, ownerSlug, ownerId, viewerUserId, source, visitorIp, resolvedCity }) {
  const visitorSlug = viewerUserId ? await getPrimarySlugForUser(viewerUserId) : null;

  try {
    const geo = resolvedCity && resolvedCity !== "unknown"
      ? { city: resolvedCity, country: "" }
      : await resolveGeoByIp(visitorIp);

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
      SELECT
        ${ownerSlug},
        ${visitorSlug || null},
        ${viewerUserId || null},
        ${visitorIp || null},
        ${String(req.get("user-agent") || "") || null},
        ${source},
        ${geo.city || null},
        ${geo.country || null}
      WHERE NOT EXISTS (
        SELECT 1
        FROM tap_events te
        WHERE te.owner_slug = ${ownerSlug}
          AND te.source = ${source}
          AND te.visitor_user_id IS NOT DISTINCT FROM ${viewerUserId || null}
          AND te.visitor_ip IS NOT DISTINCT FROM ${visitorIp || null}
          AND te.created_at >= now() - interval '5 seconds'
      )
    `;
  } catch (error) {
    console.error("[tap-tracker] failed to write tap event", {
      ownerSlug,
      source,
      message: error?.message || String(error),
      code: error?.code || null,
    });
  }

  if (!viewerUserId || !ownerId || viewerUserId === ownerId || !visitorSlug) {
    return;
  }

  try {
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
        ${viewerUserId},
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
        'New tap',
        ${`${visitorSlug} opened your card`},
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
  } catch (error) {
    console.error("[tap-tracker] failed to write tap side effects", {
      ownerSlug,
      ownerId,
      viewerUserId,
      source,
      message: error?.message || String(error),
      code: error?.code || null,
    });
  }
}

async function recordView({ req, res, ownerSlug, ownerId, sourceInput }) {
  const source = resolveTapSource(req, sourceInput);
  const device = detectDevice(req.get("user-agent"));
  const sessionId = getAnalyticsSessionId(req, res);
  const userSession = getUserSession(req);
  const viewerUserId = userSession?.userId ? String(userSession.userId) : null;

  if (viewerUserId && ownerId && viewerUserId === ownerId) {
    return { ok: true, skipped: "self_view" };
  }

  const visitorIp = resolveClientIp(req);
  const fingerprintRaw = buildViewerFingerprint(req, visitorIp);
  const fingerprint = fingerprintRaw ? createHash("sha256").update(fingerprintRaw).digest("hex") : null;
  const resolvedCity = await resolveCityForView({ viewerUserId, visitorIp });
  const dedupeSince = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MINUTES * 60 * 1000);

  const persisted = await prisma.$transaction(async (tx) => {
    let inserted = false;

    try {
      const duplicateRows = await tx.$queryRaw(
        fingerprint
          ? Prisma.sql`
              SELECT id
              FROM analytics_views
              WHERE slug = ${ownerSlug}
                AND visited_at >= ${dedupeSince}
                AND (session_id = ${sessionId} OR fingerprint = ${fingerprint})
              LIMIT 1
            `
          : Prisma.sql`
              SELECT id
              FROM analytics_views
              WHERE slug = ${ownerSlug}
                AND visited_at >= ${dedupeSince}
                AND session_id = ${sessionId}
              LIMIT 1
            `,
      );

      const duplicate = Array.isArray(duplicateRows) && duplicateRows.length > 0;
      if (!duplicate) {
        await tx.$executeRaw`
          INSERT INTO analytics_views (
            slug,
            source,
            city,
            device,
            session_id,
            fingerprint
          )
          VALUES (
            ${ownerSlug},
            ${source},
            ${resolvedCity},
            ${device},
            ${sessionId},
            ${fingerprint || null}
          )
        `;
        inserted = true;
      }
    } catch (error) {
      const code = String(error?.code || "");
      const canFallback =
        code === "42703" ||
        code === "42P01" ||
        code === "P2022" ||
        code === "P2021";

      if (!canFallback || !tx.analyticsView) {
        throw error;
      }

      const duplicate = await tx.analyticsView.findFirst({
        where: {
          slug: ownerSlug,
          visitedAt: { gte: dedupeSince },
          sessionId,
        },
        select: { id: true },
      });

      if (!duplicate) {
        await tx.analyticsView.create({
          data: {
            slug: ownerSlug,
            source,
            city: resolvedCity,
            device,
            sessionId,
          },
        });
        inserted = true;
      }
    }

    if (inserted && tx.slug) {
      await tx.slug.update({
        where: { fullSlug: ownerSlug },
        data: { analyticsViewsCount: { increment: 1 } },
      });
    }

    return { inserted };
  });

  void runPostCommitSideEffects({
    req,
    ownerSlug,
    ownerId,
    viewerUserId,
    source,
    visitorIp,
    resolvedCity,
  });

  return {
    ok: true,
    inserted: persisted.inserted,
    sessionId,
    source,
  };
}

module.exports = {
  normalizeButtonType,
  getAnalyticsSessionId,
  recordView,
  resolveTapSource,
};
