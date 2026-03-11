const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, requireVerifiedUserPage, getUserSession, logoutUserSession } = require("../../middleware/auth");
const { getEffectivePlan } = require("../../services/profile");
const { absoluteUrl } = require("../../utils/url");
const { buildLeaderboard, normalizePeriod, getPeriodRange, getSlugTopBadge, getUserLeaderboardSummary } = require("../../services/leaderboard");
const { getFeatureSetting } = require("../../services/feature-settings");
const { getActiveFlashSale, resolveConditionLabel, getFlashSaleSlotsLeft } = require("../../services/flash-sales");
const { normalizeRefCode } = require("../../services/referrals");
const { getPricingSettings } = require("../../services/pricing-settings");
const { getManySettings } = require("../../services/platform-settings");
const { sendTapPushNotification } = require("../../services/push");
const { detectDevice } = require("../../services/ua");
const { seoHub, getSeoPage } = require("../../content/seo-pages");

const router = express.Router();
const defaultSocialImage = absoluteUrl("/brand/logo.PNG");
const CARD_THEMES = new Set(["default_dark", "arctic", "linen", "marble", "forest", "royal_ivory", "midnight_obsidian"]);
const LEGAL_DOCS_DIR = path.join(env.EXPRESS_APP_DIR, "docs");

function isMissingModelTable(error, modelName) {
  return (
    Boolean(error) &&
    error.code === "P2021" &&
    (!modelName || String(error?.meta?.modelName || "") === modelName)
  );
}

function isMissingModelColumn(error, modelName) {
  if (!error || error.code !== "P2022") {
    return false;
  }

  if (!modelName) {
    return true;
  }

  const targetModel = String(error?.meta?.modelName || "");
  if (!targetModel) {
    return true;
  }

  return targetModel === modelName;
}

function getModelDelegate(modelName) {
  if (!modelName || typeof modelName !== "string") {
    return null;
  }
  const key = `${modelName.slice(0, 1).toLowerCase()}${modelName.slice(1)}`;
  const delegate = prisma[key];
  return delegate && typeof delegate === "object" ? delegate : null;
}

function isMissingModelDelegateError(error) {
  if (!error || error.name !== "TypeError") {
    return false;
  }
  const message = String(error.message || "");
  return (
    message.includes("Cannot read properties of undefined") &&
    (message.includes("findMany") || message.includes("findUnique") || message.includes("count") || message.includes("upsert"))
  );
}

async function withMissingTableFallback(modelName, fallbackValue, callback) {
  if (!getModelDelegate(modelName)) {
    return fallbackValue;
  }
  try {
    return await callback();
  } catch (error) {
    if (isMissingModelTable(error, modelName) || isMissingModelColumn(error, modelName) || isMissingModelDelegateError(error)) {
      return fallbackValue;
    }
    throw error;
  }
}

function readLegalDoc(fileName) {
  try {
    return fs.readFileSync(path.join(LEGAL_DOCS_DIR, fileName), "utf8");
  } catch {
    return "";
  }
}

const legalDocs = {
  terms: readLegalDoc("terms-of-service.md"),
  privacy: readLegalDoc("privacy-policy.md"),
  refund: readLegalDoc("refund-policy.md"),
};

function buildBreadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildFaqJsonLd(faqs) {
  if (!Array.isArray(faqs) || !faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function stripFirstHeading(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLine === -1) return "";
  if (/^#\s+/.test(lines[firstContentLine].trim())) {
    lines.splice(firstContentLine, 1);
  }
  return lines.join("\n").trim();
}

function extractMarkdownHeading(markdown, fallback) {
  const match = String(markdown || "").match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function extractMarkdownMeta(markdown, label) {
  const escaped = String(label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, "i");
  const match = String(markdown || "").match(re);
  return match ? match[1].trim() : "";
}

function estimateReadingMinutes(markdown) {
  const words = String(markdown || "")
    .replace(/[#*_`>-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function markdownToHtml(markdown, { stripTitle = false } = {}) {
  const source = stripTitle ? stripFirstHeading(markdown) : String(markdown || "");
  const lines = source.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p class=\"mt-3 text-sm leading-7 text-neutral-700 md:text-base\">${applyInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushParagraph();
      closeList();
      out.push(`<h2 class=\"mt-8 border-t border-neutral-200 pt-6 text-2xl font-bold tracking-tight text-neutral-900\">${applyInlineMarkdown(h2[1])}</h2>`);
      return;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flushParagraph();
      closeList();
      out.push(`<h3 class=\"mt-5 text-lg font-semibold text-neutral-900\">${applyInlineMarkdown(h3[1])}</h3>`);
      return;
    }

    const bullet = trimmed.match(/^-\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!inList) {
        out.push("<ul class=\"mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 md:text-base\">");
        inList = true;
      }
      out.push(`<li>${applyInlineMarkdown(bullet[1])}</li>`);
      return;
    }

    closeList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();
  return out.join("\n");
}

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeTapSource(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "direct";
  if (raw === "telegram") return "share";
  if (["nfc", "qr", "direct", "share", "widget"].includes(raw)) {
    return raw;
  }
  return "direct";
}

function isMobileUA(ua) {
  return /android|iphone|ipad|mobile/i.test(String(ua || ""));
}

function resolveTapSource(req) {
  const explicit = req.query?.src;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
    return normalizeTapSource(explicit);
  }

  const referer = String(req.get("referer") || "").trim();
  const userAgent = String(req.get("user-agent") || "");
  if (!referer && isMobileUA(userAgent)) {
    return "nfc";
  }
  return "direct";
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

async function logTapEventFromPageRequest({ req, res, ownerSlug, ownerId }) {
  const source = resolveTapSource(req);
  const device = detectDevice(req.get("user-agent"));
  const sessionId = getAnalyticsSessionId(req, res);
  const visitorIp = pickClientIp(req);
  const userSession = getUserSession(req);
  const visitorUserId = userSession?.userId ? String(userSession.userId) : null;
  const visitorSlug = visitorUserId ? await getPrimarySlugForUser(visitorUserId) : null;

  try {
    await prisma.$transaction(async (tx) => {
      let isUniqueSessionView = true;
      if (tx.analyticsView) {
        const exists = await tx.analyticsView.findFirst({
          where: {
            slug: ownerSlug,
            sessionId,
          },
          select: { id: true },
        });
        isUniqueSessionView = !exists;
      }

      if (tx.slug && isUniqueSessionView) {
        await tx.slug.update({
          where: { fullSlug: ownerSlug },
          data: { analyticsViewsCount: { increment: 1 } },
        });
      }

      if (tx.analyticsView) {
        await tx.analyticsView.create({
          data: {
            slug: ownerSlug,
            source,
            city: "Неизвестно",
            device,
            sessionId,
          },
        });
      }

      await tx.$executeRaw`
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
          ${visitorUserId || null},
          ${visitorIp || null},
          ${String(req.get("user-agent") || "") || null},
          ${source},
          ${null},
          ${null}
        WHERE NOT EXISTS (
          SELECT 1
          FROM tap_events te
          WHERE te.owner_slug = ${ownerSlug}
            AND te.source = ${source}
            AND te.visitor_slug IS NOT DISTINCT FROM ${visitorSlug || null}
            AND te.visitor_user_id IS NOT DISTINCT FROM ${visitorUserId || null}
            AND te.visitor_ip IS NOT DISTINCT FROM ${visitorIp || null}
            AND te.created_at >= now() - interval '5 seconds'
        )
      `;

      if (visitorUserId && ownerId && visitorUserId !== ownerId && visitorSlug) {
        await tx.$executeRaw`
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

        await tx.$executeRaw`
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
    });
  } catch (error) {
    if (error && (String(error.code || "") === "42P01" || String(error.code || "") === "42703")) {
      return;
    }
    if (error && String(error.code || "") === "P2025") {
      return;
    }
    throw error;
  }
}

function isSlugStatusDecodeError(error) {
  if (!error || typeof error !== "object") return false;
  const message = String(error.message || "");
  return (
    error.code === "P2032" ||
    (message.includes("SlugStatus") && message.includes("incompatible value")) ||
    (message.includes("Error converting field") && message.includes("status"))
  );
}

function isSlugMissingColumnError(error) {
  if (!error || typeof error !== "object") return false;
  return error.code === "P2022";
}

function isUserMissingColumnError(error) {
  if (!error || typeof error !== "object") return false;
  return error.code === "P2022";
}

async function findUserByTelegramIdWithLegacyFallback(userId) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        username: true,
        displayName: true,
        status: true,
        plan: true,
        isVerified: true,
        verifiedCompany: true,
      },
    });
  } catch (error) {
    if (!isUserMissingColumnError(error)) {
      throw error;
    }
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        first_name AS "firstName",
        username
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return {
      ...row,
      displayName: null,
      status: "active",
      plan: "none",
      isVerified: false,
      verifiedCompany: null,
    };
  }
}

async function findUserByRefCodeWithLegacyFallback(refCode) {
  try {
    return await prisma.user.findFirst({
      where: { refCode },
      select: {
        firstName: true,
        displayName: true,
        username: true,
      },
    });
  } catch (error) {
    if (!isUserMissingColumnError(error)) {
      throw error;
    }
    return null;
  }
}

async function findSlugByFullSlugWithLegacyFallback(fullSlug) {
  try {
    return await prisma.slug.findUnique({
      where: { fullSlug },
      select: {
        id: true,
        fullSlug: true,
        price: true,
        ownerId: true,
        status: true,
        pauseMessage: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (!isSlugStatusDecodeError(error) && !isSlugMissingColumnError(error)) {
      throw error;
    }

    const rows = await prisma.$queryRaw`
      SELECT
        id,
        full_slug AS "fullSlug",
        price,
        owner_id AS "ownerId",
        status::text AS "status",
        is_primary AS "isPrimary",
        NULL::text AS "pauseMessage",
        NULL::timestamptz AS "requestedAt",
        NULL::timestamptz AS "pendingExpiresAt",
        NULL::timestamptz AS "approvedAt",
        NULL::timestamptz AS "activatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM slugs
      WHERE full_slug = ${fullSlug}
      LIMIT 1
    `;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return {
      ...row,
      letters: null,
      digits: null,
      owner: null,
    };
  }
}

async function findProfileCardByOwnerId(ownerId) {
  if (!ownerId) return null;
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      owner_id AS "ownerId",
      name,
      role,
      bio,
      hashtag,
      address,
      postcode,
      email,
      extra_phone AS "extraPhone",
      avatar_url AS "avatarUrl",
      tags,
      buttons,
      theme,
      custom_color AS "customColor",
      show_branding AS "showBranding",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM profile_cards
    WHERE owner_id = ${ownerId}
    LIMIT 1
  `;
  return Array.isArray(rows) ? rows[0] || null : null;
}

function mapProfileButtons(rawButtons) {
  const allowedTypes = new Set([
    "phone",
    "telegram",
    "instagram",
    "tiktok",
    "youtube",
    "website",
    "map",
    "card",
    "whatsapp",
    "email",
    "other",
  ]);
  let source = [];
  if (Array.isArray(rawButtons)) {
    source = rawButtons;
  } else if (typeof rawButtons === "string" && rawButtons.trim()) {
    try {
      const parsed = JSON.parse(rawButtons);
      source = Array.isArray(parsed) ? parsed : [];
    } catch {
      source = [];
    }
  }
  return source
    .map((item) => {
      const obj = item && typeof item === "object" ? item : {};
      const typeRaw = String(obj.type || "other")
        .trim()
        .toLowerCase();
      const type = allowedTypes.has(typeRaw) ? typeRaw : "other";
      const label = String(obj.label || "").trim().slice(0, 50);
      const href = String(obj.href || obj.url || obj.value || "").trim();
      const normalizedHref = normalizeButtonUrl(href, type, label);
      if (!label || !normalizedHref || !isSupportedButtonHref(normalizedHref)) {
        return null;
      }
      return {
        type,
        label,
        url: normalizedHref,
        isActive: true,
      };
    })
    .filter(Boolean);
}

function mapProfileTags(rawTags) {
  const source = Array.isArray(rawTags) ? rawTags : [];
  return source
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((label) => ({ label }));
}

function classifySectorFromTags(tags) {
  const joined = (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").toLowerCase())
    .join(" ");
  if (/(дизайн|design|ux|ui|product)/i.test(joined)) return "design";
  if (/(продаж|sales|account|bizdev)/i.test(joined)) return "sales";
  if (/(маркет|marketing|smm|seo|brand)/i.test(joined)) return "marketing";
  if (/(it|dev|developer|frontend|backend|qa|data|ai)/i.test(joined)) return "it";
  return "other";
}

function isSupportedButtonHref(value) {
  return /^(https?:\/\/|mailto:|tel:|card:)/i.test(String(value || "").trim());
}

function parseCardDigits(rawValue) {
  const digits = String(rawValue || "").replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) {
    return "";
  }
  return digits;
}

function normalizeButtonUrl(rawUrl, type, label) {
  const input = String(rawUrl || "").trim();
  const kind = String(type || "other")
    .trim()
    .toLowerCase();
  const labelRaw = String(label || "").trim().toLowerCase();
  const mapLikeLabel = /(карта|map|maps|geo|location|локац)/i.test(labelRaw);
  if (!input) return "";
  if (isSupportedButtonHref(input)) return input;
  if (kind === "card") {
    const digits = parseCardDigits(input);
    return digits ? `card:${digits}` : "";
  }
  if (kind === "map" || mapLikeLabel) {
    return `https://maps.google.com/?q=${encodeURIComponent(input)}`;
  }
  if (kind === "phone") {
    const compact = input.replace(/\s+/g, "");
    return compact ? `tel:${compact}` : "";
  }
  if (kind === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? `mailto:${input}` : "";
  }
  if (kind === "website" || kind === "other") {
    if (/^[^\s]+\.[^\s]+$/.test(input) && !input.startsWith("@")) {
      return `https://${input}`;
    }
  }
  if (kind === "telegram") {
    const normalized = input.replace(/^@+/, "").replace(/^https?:\/\/t\.me\//i, "").trim();
    return normalized ? `https://t.me/${normalized}` : "";
  }
  if (kind === "instagram") {
    const normalized = input
      .replace(/^@+/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/\/+$/, "")
      .trim();
    return normalized ? `https://instagram.com/${normalized}` : "";
  }
  if (kind === "tiktok") {
    const normalized = input
      .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, "")
      .replace(/^@+/, "")
      .replace(/\/+$/, "")
      .trim();
    if (!normalized) return "";
    return normalized.startsWith("@") ? `https://tiktok.com/${normalized}` : `https://tiktok.com/@${normalized}`;
  }
  if (kind === "youtube") {
    if (/^(?:@[\w.-]+)$/i.test(input)) return `https://youtube.com/${input}`;
    if (/^[\w.-]+$/i.test(input)) return `https://youtube.com/@${input}`;
  }
  if (kind === "whatsapp") {
    const digits = input.replace(/[^\d]/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
  return input;
}

function normalizeDirectorySector(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["design", "sales", "marketing", "it", "other"].includes(normalized) ? normalized : "";
}

function buildPublicCardFromProfile({ slug, user, profileCard, viewsCount, allSlugs = [] }) {
  const plan = getEffectivePlan(user).plan;
  const normalizedSlugs = Array.isArray(allSlugs)
    ? allSlugs
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean)
    : [];
  return {
    slug,
    slugs: normalizedSlugs.length ? normalizedSlugs : [slug],
    slugPrice: Number.isFinite(Number(profileCard.slugPrice)) ? Number(profileCard.slugPrice) : null,
    avatarUrl: profileCard.avatarUrl || null,
    name: profileCard.name,
    role: profileCard.role || "",
    bio: profileCard.bio || "",
    verified: Boolean(user?.isVerified),
    verifiedCompany: user?.verifiedCompany || "",
    tariff: plan,
    theme: typeof profileCard.theme === "string" && CARD_THEMES.has(profileCard.theme) ? profileCard.theme : "default_dark",
    customColor: profileCard.customColor || "",
    phone: "",
    tags: mapProfileTags(profileCard.tags),
    buttons: mapProfileButtons(profileCard.buttons),
    hashtag: profileCard.hashtag || "",
    address: profileCard.address || "",
    postcode: profileCard.postcode || "",
    email: profileCard.email || "",
    extraPhone: profileCard.extraPhone || "",
    viewsCount: Number(viewsCount || 0),
    showBranding: Boolean(profileCard.showBranding),
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const weekRange = getPeriodRange("week");
    const userSession = getUserSession(req);
    const userId = userSession?.userId ? String(userSession.userId) : "";
    const [leaderboardSettings, activeFlashSale, nextDrop, pricing, publicSettingsRaw, topWeeklyViews, authPhotoUrl] = await Promise.all([
      getFeatureSetting("leaderboard"),
      getActiveFlashSale(),
      prisma.drop.findFirst({
        where: {
          isFinished: false,
          isLive: false,
          dropAt: { gt: new Date() },
        },
        orderBy: { dropAt: "asc" },
      }),
      getPricingSettings(),
      getManySettings([
        "platform_name",
        "platform_tagline",
        "platform_hero_subtitle",
        "platform_total_slugs",
        "pricing_footnote",
        "pricing_section_visible",
        "plan_basic_name",
        "plan_premium_name",
        "plan_basic_features",
        "plan_basic_excluded_features",
        "plan_premium_features",
        "plan_premium_excluded_features",
        "plan_premium_popular_badge",
        "bracelet_name",
        "bracelet_price",
        "bracelet_in_stock",
        "bracelet_cta_text",
        "bracelet_features",
        "bracelet_description",
        "bracelet_note",
        "contact_support_telegram",
        "contact_phone",
        "contact_response_time",
        "contact_error_fallback",
        "pending_expiry_hours",
      ]),
      (async () => {
        if (!prisma.analyticsView || typeof prisma.analyticsView.groupBy !== "function") {
          return [];
        }

        const grouped = await prisma.analyticsView.groupBy({
          by: ["slug", "sessionId"],
          where: {
            visitedAt: {
              gte: weekRange.startUtc,
              lt: weekRange.endUtc,
            },
          },
          _count: { _all: true },
        });

        const uniqueBySlug = new Map();
        for (const row of grouped) {
          const slugValue = String(row.slug || "").trim().toUpperCase();
          if (!slugValue) continue;
          uniqueBySlug.set(slugValue, (uniqueBySlug.get(slugValue) || 0) + 1);
        }

        const ranked = Array.from(uniqueBySlug.entries())
          .map(([slugValue, views]) => ({ slug: slugValue, views: Number(views || 0) }))
          .filter((row) => row.views > 0)
          .sort((a, b) => b.views - a.views);

        if (!ranked.length) return [];

        const slugs = ranked.map((item) => item.slug);
        const slugRows = await prisma.slug.findMany({
          where: {
            fullSlug: { in: slugs },
            status: { in: ["active", "private"] },
          },
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                isVerified: true,
                verifiedCompany: true,
                profileCard: {
                  select: {
                    name: true,
                    role: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        const slugMap = new Map(slugRows.map((row) => [String(row.fullSlug || "").toUpperCase(), row]));
        const owners = new Map();

        for (const item of ranked) {
          const row = slugMap.get(item.slug);
          const owner = row?.owner;
          const ownerId = owner?.id ? String(owner.id) : "";
          if (!ownerId) continue;

          const existing = owners.get(ownerId);
          if (!existing) {
            owners.set(ownerId, {
              ownerId,
              name: owner.profileCard?.name || owner.displayName || owner.firstName || "UNQX User",
              role: owner.profileCard?.role || "",
              company: owner.verifiedCompany || owner.profileCard?.role || "",
              isVerified: Boolean(owner.isVerified),
              avatarUrl: owner.profileCard?.avatarUrl || null,
              views: item.views,
            });
            continue;
          }

          existing.views += item.views;
        }

        const topOwners = Array.from(owners.values())
          .sort((a, b) => b.views - a.views)
          .slice(0, 3);

        if (!topOwners.length) return [];

        const ownerSlugs = await prisma.slug.findMany({
          where: {
            ownerId: { in: topOwners.map((item) => item.ownerId) },
            status: { in: ["approved", "active", "private", "paused"] },
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            ownerId: true,
            fullSlug: true,
          },
        });

        const slugsByOwner = new Map();
        for (const row of ownerSlugs) {
          const ownerId = String(row.ownerId || "");
          if (!ownerId) continue;
          const current = slugsByOwner.get(ownerId) || [];
          current.push(String(row.fullSlug || "").toUpperCase());
          slugsByOwner.set(ownerId, current);
        }

        return topOwners.map((item) => {
          const allSlugs = slugsByOwner.get(item.ownerId) || [];
          return {
            primarySlug: allSlugs[0] || "",
            slugs: allSlugs,
            views: item.views,
            name: item.name,
            role: item.role,
            company: item.company,
            isVerified: item.isVerified,
            avatarUrl: item.avatarUrl,
          };
        });
      })(),
      userId
        ? findProfileCardByOwnerId(userId)
          .then((card) => String(card?.avatarUrl || "").trim())
          .catch(() => "")
        : Promise.resolve(""),
    ]);
    const flashSaleSlotsLeft = activeFlashSale ? await getFlashSaleSlotsLeft(activeFlashSale) : null;

    let testimonials = [];
    try {
      const rawTestimonials = await prisma.testimonial.findMany({
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      const testimonialSlugs = rawTestimonials
        .map((item) => sanitizeSlug(item.slug))
        .filter(Boolean);

      const avatarBySlug = new Map();
      if (testimonialSlugs.length) {
        const slugRows = await withMissingTableFallback("Slug", [], () =>
          prisma.slug.findMany({
            where: { fullSlug: { in: testimonialSlugs } },
            select: {
              fullSlug: true,
              owner: {
                select: {
                  profileCard: {
                    select: { avatarUrl: true },
                  },
                },
              },
            },
          }),
        );
        for (const row of slugRows) {
          const key = String(row?.fullSlug || "").trim().toUpperCase();
          if (!key) continue;
          avatarBySlug.set(key, String(row?.owner?.profileCard?.avatarUrl || "").trim());
        }
      }

      testimonials = rawTestimonials.map((item) => {
        const normalizedSlug = sanitizeSlug(item.slug);
        return {
          ...item,
          slug: normalizedSlug || item.slug,
          avatarUrl: avatarBySlug.get(normalizedSlug) || "",
        };
      });
    } catch (error) {
      console.error("[express-app] failed to load testimonials", error);
    }

    res.render("public/home", {
      title: "UNQX | Цифровая визитка за 1 минуту",
      description: "Одна ссылка вместо тысячи слов. Создай свою цифровую визитку на unqx.uz",
      image: defaultSocialImage,
      testimonials,
      slugTotalLimit: Number(publicSettingsRaw.platform_total_slugs || env.SLUG_TOTAL_LIMIT),
      leaderboardEnabled: Boolean(leaderboardSettings.enabled),
      activeFlashSale: activeFlashSale
        ? {
          id: activeFlashSale.id,
          discountPercent: activeFlashSale.discountPercent,
          conditionLabel: resolveConditionLabel(activeFlashSale),
          slotsLeft: Number.isFinite(flashSaleSlotsLeft) ? flashSaleSlotsLeft : null,
          startsAt: activeFlashSale.startsAt,
          endsAt: activeFlashSale.endsAt,
          description: activeFlashSale.description || activeFlashSale.title,
        }
        : null,
      nextDrop: nextDrop
        ? {
          id: nextDrop.id,
          title: nextDrop.title,
          dropAt: nextDrop.dropAt,
          slugCount: nextDrop.slugCount,
        }
        : null,
      topWeeklyViews,
      pricing,
      authPhotoUrl,
      publicSettings: publicSettingsRaw,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/login",
  asyncHandler(async (req, res) => {
    if (getUserSession(req)?.userId) {
      res.redirect("/profile");
      return;
    }
    res.render("public/login", {
      title: "Вход | UNQX",
      description: "Войди в UNQX по email и паролю",
      image: defaultSocialImage,
      next: typeof req.query.next === "string" ? req.query.next : "/profile",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/register",
  asyncHandler(async (req, res) => {
    if (getUserSession(req)?.userId) {
      res.redirect("/profile");
      return;
    }
    res.render("public/register", {
      title: "Регистрация | UNQX",
      description: "Создай аккаунт UNQX",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    res.render("public/verify-email", {
      title: "Подтверждение email | UNQX",
      description: "Подтверди email и заверши регистрацию",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    res.render("public/forgot-password", {
      title: "Сброс пароля | UNQX",
      description: "Запрос кода для сброса пароля",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/reset-password",
  asyncHandler(async (req, res) => {
    res.render("public/reset-password", {
      title: "Новый пароль | UNQX",
      description: "Установи новый пароль",
      image: defaultSocialImage,
      email: typeof req.query.email === "string" ? req.query.email : "",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/reactivate-account",
  asyncHandler(async (req, res) => {
    if (getUserSession(req)?.userId) {
      res.redirect("/profile");
      return;
    }
    res.render("public/reactivate-account", {
      title: "Восстановление аккаунта | UNQX",
      description: "Восстанови деактивированный аккаунт UNQX",
      image: defaultSocialImage,
      email: typeof req.query.email === "string" ? req.query.email : "",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/ref/:refCode",
  asyncHandler(async (req, res) => {
    const refCode = normalizeRefCode(req.params.refCode);
    if (!refCode) {
      res.redirect("/");
      return;
    }

    if (req.session) {
      req.session.pendingRefCode = refCode;
    }

    const referrer = await findUserByRefCodeWithLegacyFallback(refCode);

    const referrerName = (referrer?.displayName || referrer?.firstName || "").trim();
    const referrerUsername = referrer?.username ? `@${referrer.username}` : "";

    res.render("public/referral", {
      title: "Вас пригласили в UNQX",
      description: "Зарегистрируйтесь в UNQX и получите доступ к цифровой визитке по приглашению.",
      image: defaultSocialImage,
      refCode,
      referrerName,
      referrerUsername,
      noindex: true,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/themes",
  asyncHandler(async (req, res) => {
    res.render("public/themes", {
      title: "Темы Премиум | UNQX",
      description: "Каталог премиум-тем UNQX: выбери стиль визитки, цвета и оформление под свой бренд.",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/demo",
  asyncHandler(async (req, res) => {
    const allowedThemes = new Set(["default_dark", "arctic", "linen", "marble", "forest", "royal_ivory", "midnight_obsidian"]);
    const theme = typeof req.query.theme === "string" && allowedThemes.has(req.query.theme) ? req.query.theme : "default_dark";
    const embed = req.query.embed === "1";

    res.render("public/demo", {
      title: "UNQX Demo",
      description: "Демо цифровой визитки UNQX: посмотри как выглядит карточка до покупки и настройки профиля.",
      image: defaultSocialImage,
      theme,
      embed,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/profile",
  requireVerifiedUserPage,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    const user = sessionUser?.userId ? await findUserByTelegramIdWithLegacyFallback(sessionUser.userId) : null;

    if (!user || user.status === "blocked" || user.status === "deactivated" || user.status === "deleted") {
      // Clear stale/invalid auth to avoid /profile <-> /login redirect loops.
      await logoutUserSession(req);
      res.redirect("/login");
      return;
    }

    res.render("public/profile", {
      title: "Мой профиль | UNQX",
      description: "Личный кабинет UNQX: управляй визиткой, UNQ, аналитикой, заявками и настройками профиля.",
      image: defaultSocialImage,
      telegramBotUsername: String(env.TELEGRAM_BOT_USERNAME || "").replace(/^@+/, "").trim(),
      reactivationWindowDays: Number(env.ACCOUNT_REACTIVATION_WINDOW_DAYS || 30),
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const settings = await getFeatureSetting("leaderboard");
    if (!settings.enabled) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "leaderboard",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const period = normalizePeriod(req.query.period);
    const [board, userSummary] = await Promise.all([
      buildLeaderboard(period),
      (() => {
        const user = getUserSession(req);
        if (!user?.userId) return Promise.resolve(null);
        return getUserLeaderboardSummary({
          userId: user.userId,
          period,
        });
      })(),
    ]);

    res.render("public/leaderboard", {
      title: "Топ визиток по просмотрам · UNQX",
      description: "Лидерборд визиток UNQX по просмотрам",
      image: defaultSocialImage,
      period: board.period,
      items: board.publicItems,
      viewerTelegramId: getUserSession(req)?.userId || "",
      userSummary,
      leaderboardSettings: board.settings,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/drops",
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    const viewerUserId = sessionUser?.userId ? String(sessionUser.userId) : "";
    const rows = await prisma.drop.findMany({
      orderBy: { dropAt: "desc" },
      take: 50,
    });
    let joinedDropIds = [];
    if (viewerUserId && rows.length && prisma.dropWaitlist && typeof prisma.dropWaitlist.findMany === "function") {
      try {
        const items = await prisma.dropWaitlist.findMany({
          where: {
            userId: viewerUserId,
            dropId: { in: rows.map((row) => row.id) },
          },
          select: { dropId: true },
        });
        joinedDropIds = items.map((item) => String(item.dropId || "")).filter(Boolean);
      } catch (error) {
        if (!error || (error.code !== "P2021" && error.code !== "P2022")) {
          throw error;
        }
      }
    }
    const summary = rows.reduce(
      (acc, drop) => {
        const pool = Array.isArray(drop.slugsPool) ? drop.slugsPool : [];
        const sold = Array.isArray(drop.soldSlugs) ? drop.soldSlugs : [];
        const total = Number(drop.slugCount) > 0 ? Number(drop.slugCount) : pool.length;
        const remaining = Math.max(0, total - sold.length);
        const isPast = Boolean(drop.isFinished || drop.isSoldOut);
        const isLive = Boolean(drop.isLive) && !isPast;
        const isUpcoming = !isLive && !isPast;

        acc.total += 1;
        acc.totalSlots += total;
        if (isLive) {
          acc.live += 1;
          acc.liveRemaining += remaining;
        } else if (isUpcoming) {
          acc.upcoming += 1;
        } else {
          acc.past += 1;
        }
        return acc;
      },
      { total: 0, live: 0, upcoming: 0, past: 0, totalSlots: 0, liveRemaining: 0 },
    );

    res.render("public/drops", {
      title: "Релизы slug · UNQX",
      description: "Актуальные и прошедшие релизы slug на UNQX",
      image: defaultSocialImage,
      drops: rows,
      dropsSummary: summary,
      viewerUserId,
      joinedDropIds,
      telegramBotUsername: String(env.TELEGRAM_BOT_USERNAME || "").replace(/^@+/, "").trim(),
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/guides",
  asyncHandler(async (req, res) => {
    const canonical = absoluteUrl("/guides");
    const hubJsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: seoHub.heading,
        description: seoHub.description,
        url: canonical,
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Гайды", url: canonical },
      ]),
    ];

    res.render("public/seo-hub", {
      title: seoHub.title,
      description: seoHub.description,
      heading: seoHub.heading,
      lead: seoHub.lead,
      cards: seoHub.cards,
      image: defaultSocialImage,
      jsonLd: hubJsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/faq",
  asyncHandler(async (req, res) => {
    const page = getSeoPage("faq");
    const canonical = absoluteUrl("/faq");
    if (!page) {
      res.redirect("/guides");
      return;
    }

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.heading,
        description: page.description,
        mainEntityOfPage: canonical,
        dateModified: page.updatedAt,
        author: {
          "@type": "Organization",
          name: "UNQX",
        },
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "FAQ", url: canonical },
      ]),
      buildFaqJsonLd(page.faqs),
    ].filter(Boolean);

    res.render("public/seo-page", {
      title: page.title,
      description: page.description,
      heading: page.heading,
      lead: page.lead,
      sections: page.sections,
      faqs: page.faqs,
      readingMinutes: page.readingMinutes,
      updatedAt: page.updatedAt,
      image: defaultSocialImage,
      jsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/guides/:slug",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const page = getSeoPage(slug);
    if (!page) {
      res.status(404).render("public/not-found", {
        title: "Гайд не найден",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    const canonical = absoluteUrl(`/guides/${slug}`);
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.heading,
        description: page.description,
        mainEntityOfPage: canonical,
        dateModified: page.updatedAt,
        author: {
          "@type": "Organization",
          name: "UNQX",
        },
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Гайды", url: absoluteUrl("/guides") },
        { name: page.heading, url: canonical },
      ]),
      buildFaqJsonLd(page.faqs),
    ].filter(Boolean);

    res.render("public/seo-page", {
      title: page.title,
      description: page.description,
      heading: page.heading,
      lead: page.lead,
      sections: page.sections,
      faqs: page.faqs,
      readingMinutes: page.readingMinutes,
      updatedAt: page.updatedAt,
      image: defaultSocialImage,
      jsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/terms",
  asyncHandler(async (req, res) => {
    const markdown = legalDocs.terms;
    const heading = extractMarkdownHeading(markdown, "UNQX Terms of Service");
    const updatedAt = extractMarkdownMeta(markdown, "Last updated") || "2026-03-07";
    const canonical = absoluteUrl("/terms");
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: heading,
        description: "Terms of Service for UNQX digital business card platform.",
        url: canonical,
        dateModified: updatedAt,
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Terms", url: canonical },
      ]),
    ];

    res.render("public/legal-page", {
      title: `${heading} | UNQX`,
      description: "Terms of Service for UNQX digital business card platform.",
      heading,
      lead: "These terms define the rules for using UNQX services.",
      updatedAt,
      effectiveDate: "",
      readingMinutes: estimateReadingMinutes(markdown),
      contentHtml: markdownToHtml(markdown, { stripTitle: true }),
      image: defaultSocialImage,
      jsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/policy",
  asyncHandler(async (req, res) => {
    const privacyMd = legalDocs.privacy;
    const refundMd = legalDocs.refund;
    const updatedAt = extractMarkdownMeta(privacyMd, "Last updated") || "2026-03-07";
    const effectiveDate = extractMarkdownMeta(privacyMd, "Effective date") || "";
    const canonical = absoluteUrl("/policy");
    const combinedMarkdown = [
      "# UNQX Policy",
      "",
      stripFirstHeading(privacyMd),
      "",
      "## Refund Policy",
      "",
      stripFirstHeading(refundMd),
    ]
      .filter(Boolean)
      .join("\n");

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "UNQX Privacy and Refund Policy",
        description: "Privacy Policy and Refund Policy for UNQX.",
        url: canonical,
        dateModified: updatedAt,
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Policy", url: canonical },
      ]),
    ];

    res.render("public/legal-page", {
      title: "UNQX Privacy and Refund Policy",
      description: "Privacy Policy and Refund Policy for UNQX.",
      heading: "UNQX Policy",
      lead: "This page includes UNQX Privacy Policy and Refund Policy.",
      updatedAt,
      effectiveDate,
      readingMinutes: estimateReadingMinutes(combinedMarkdown),
      contentHtml: markdownToHtml(combinedMarkdown, { stripTitle: true }),
      image: defaultSocialImage,
      jsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/directory",
  asyncHandler(async (req, res) => {
    const directorySettings = await getFeatureSetting("directory");
    if (!directorySettings.enabled) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "directory",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const q = String(req.query.q || "").trim().slice(0, 80);
    const sector = String(req.query.sector || "all").trim().toLowerCase();
    const sort = ["score", "date", "views"].includes(String(req.query.sort || "")) ? String(req.query.sort) : "score";
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 24;

    const exclusions = prisma.directoryExclusion
      ? await prisma.directoryExclusion.findMany({ select: { slug: true } })
      : [];
    const excludedSlugs = exclusions.map((row) => row.slug);

    const where = {
      status: "active",
      owner: {
        status: "active",
        showInDirectory: true,
      },
      ...(excludedSlugs.length ? { fullSlug: { notIn: excludedSlugs } } : {}),
    };

    const rows = await prisma.slug.findMany({
      where,
      orderBy:
        sort === "views"
          ? [{ updatedAt: "desc" }]
          : sort === "date"
            ? [{ createdAt: "desc" }]
            : [{ updatedAt: "desc" }],
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            isVerified: true,
            verifiedCompany: true,
            directorySector: true,
            unqScore: {
              select: {
                score: true,
                percentile: true,
              },
            },
            profileCard: {
              select: {
                name: true,
                role: true,
                bio: true,
                tags: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      take: 500,
    });

    const rowSlugs = rows.map((row) => String(row.fullSlug || "").trim().toUpperCase()).filter(Boolean);
    const uniqueViewRows = rowSlugs.length && prisma.analyticsView && typeof prisma.analyticsView.groupBy === "function"
      ? await prisma.analyticsView.groupBy({
        by: ["slug", "sessionId"],
        where: { slug: { in: rowSlugs } },
        _count: { _all: true },
      })
      : [];
    const uniqueViewsBySlug = new Map();
    uniqueViewRows.forEach((row) => {
      const slugKey = String(row.slug || "").trim().toUpperCase();
      if (!slugKey) return;
      uniqueViewsBySlug.set(slugKey, (uniqueViewsBySlug.get(slugKey) || 0) + 1);
    });

    const groupedByOwner = new Map();
    for (const row of rows) {
      const owner = row.owner;
      if (!owner?.id) continue;

      const ownerId = String(owner.id);
      const tags = Array.isArray(owner.profileCard?.tags) ? owner.profileCard.tags : [];
      const normalizedDirectorySector = normalizeDirectorySector(owner.directorySector);
      const slug = String(row.fullSlug || "").trim();
      const currentViews = Number(uniqueViewsBySlug.get(String(row.fullSlug || "").trim().toUpperCase()) || 0);
      const currentCreatedAt = row.createdAt ? new Date(row.createdAt) : new Date(0);

      const existing = groupedByOwner.get(ownerId);
      if (!existing) {
        groupedByOwner.set(ownerId, {
          name: owner.displayName || owner.profileCard?.name || owner.firstName || "UNQX User",
          role: owner.profileCard?.role || owner.verifiedCompany || "",
          bio: owner.profileCard?.bio || "",
          tags: tags.map((tag) => String(tag || "").trim()).filter(Boolean),
          avatarUrl: owner.profileCard?.avatarUrl || null,
          isVerified: Boolean(owner.isVerified),
          verifiedCompany: owner.verifiedCompany || "",
          score: Number(owner.unqScore?.score || 0),
          topPercent: Math.max(1, Math.round(Number(owner.unqScore?.percentile ? 100 - owner.unqScore.percentile : 100))),
          views: currentViews,
          createdAt: currentCreatedAt,
          sector: normalizedDirectorySector || classifySectorFromTags(tags),
          primarySlug: slug,
          slugs: slug ? [slug] : [],
          slugSet: new Set(slug ? [slug] : []),
        });
        continue;
      }

      existing.views += currentViews;
      if (currentCreatedAt.getTime() > existing.createdAt.getTime()) {
        existing.createdAt = currentCreatedAt;
      }
      if (slug && !existing.slugSet.has(slug)) {
        existing.slugSet.add(slug);
        existing.slugs.push(slug);
      }
    }

    const prepared = Array.from(groupedByOwner.values())
      .map((item) => ({
        name: item.name,
        role: item.role,
        bio: item.bio,
        tags: item.tags,
        avatarUrl: item.avatarUrl,
        isVerified: item.isVerified,
        verifiedCompany: item.verifiedCompany,
        score: item.score,
        topPercent: item.topPercent,
        views: item.views,
        createdAt: item.createdAt,
        sector: item.sector,
        primarySlug: item.primarySlug,
        slugs: item.slugs.sort((a, b) => a.localeCompare(b)),
      }))
      .filter((item) => {
        if (sector !== "all" && item.sector !== sector) return false;
        if (!q) return true;
        const hay = [item.name, item.role, item.bio, item.slugs.join(" "), item.tags.join(" ")].join(" ").toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => {
        if (sort === "views") return b.views - a.views;
        if (sort === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return b.score - a.score;
      });

    const total = prepared.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const items = prepared.slice((safePage - 1) * pageSize, safePage * pageSize);

    res.render("public/directory", {
      title: "UNQ Directory",
      description: "Публичный каталог визиток UNQX",
      image: defaultSocialImage,
      items,
      pagination: { page: safePage, totalPages, total },
      filters: { q, sector, sort },
      noindex: false,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/qr/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const slugRow = await findSlugByFullSlugWithLegacyFallback(slug);
    if (!slugRow || !["active", "private"].includes(slugRow.status) || !slugRow.ownerId) {
      res.status(404).render("public/not-found", {
        title: "Визитка не найдена",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    const [owner, profileCard] = await Promise.all([
      findUserByTelegramIdWithLegacyFallback(slugRow.ownerId),
      findProfileCardByOwnerId(slugRow.ownerId),
    ]);

    if (!owner || owner.status !== "active") {
      res.status(200).render("public/qr", {
        title: `QR ${slug}`,
        description: `QR-визитка UNQ ${slug} временно недоступна.`,
        image: defaultSocialImage,
        slug,
        unavailable: true,
        adminSession: getAdminSession(req),
      });
      return;
    }

    res.render("public/qr", {
      title: `QR ${slug}`,
      description: `QR-визитка UNQ ${slug}. Открой цифровую карточку владельца по ссылке и поделись за секунду.`,
      slug,
      image: defaultSocialImage,
      url: absoluteUrl(`/${slug}?src=qr`),
      ownerName: profileCard?.name || owner.displayName || owner.firstName || "UNQX User",
      ownerRole: profileCard?.role || "",
      score: 0,
      unavailable: false,
      noindex: slugRow.status === "private",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);

    const slugRow = await findSlugByFullSlugWithLegacyFallback(slug);

    if (slugRow) {
      if (slugRow.status === "blocked") {
        res.status(200).render("public/slug-state", {
          title: "Недоступно",
          slug,
          heading: "Недоступно",
          message: "Этот UNQ сейчас недоступен.",
          ctaLabel: "",
          ctaHref: "",
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "free") {
        res.status(200).render("public/slug-state", {
          title: "UNQ свободен",
          slug,
          heading: "Этот UNQ пока свободен",
          message: "Ты можешь занять его прямо сейчас.",
          ctaLabel: "Занять",
          ctaHref: "#",
          ctaOrderLink: true,
          ctaOrderPrefill: slug,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "pending" || slugRow.status === "reserved") {
        res.status(200).render("public/slug-state", {
          title: `UNQ занят: ${slug}`,
          slug,
          heading: "Этот UNQ уже занят",
          message: "Сейчас он на рассмотрении. Встань в wishlist и мы сообщим, если он освободится.",
          ctaLabel: "Встать в wishlist",
          ctaHref: "#",
          ctaWaitlistSlug: slug,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "reserved_drop") {
        res.status(200).render("public/slug-state", {
          title: `UNQ доступен в дропе`,
          slug,
          heading: "Этот UNQ доступен в дропе",
          message: "Подпишись на ближайший дроп и забери этот slug в момент старта.",
          ctaLabel: "Перейти к дропам",
          ctaHref: "/drops",
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "paused") {
        const owner = slugRow.owner
          ? slugRow.owner
          : slugRow.ownerId
            ? await findUserByTelegramIdWithLegacyFallback(slugRow.ownerId)
            : null;
        if (owner && (owner.status === "blocked" || owner.status === "deactivated")) {
          res.status(200).render("public/slug-state", {
            title: "Недоступно",
            slug,
            heading: "Недоступно",
            message: "Эта визитка временно недоступна.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }
        const profileCard = slugRow.ownerId
          ? await findProfileCardByOwnerId(slugRow.ownerId)
          : null;
        const socialButtons =
          profileCard && Array.isArray(profileCard.buttons)
            ? mapProfileButtons(profileCard.buttons)
            : [];
        const usernameForTelegram = String(owner?.username || "").replace(/^@+/, "").trim();
        const telegramFallback = usernameForTelegram
          ? { type: "telegram", label: "Telegram", url: `https://t.me/${usernameForTelegram}`, isActive: true }
          : null;
        const primarySocial =
          socialButtons.find((item) => item.type === "telegram") || socialButtons[0] || telegramFallback;

        res.status(200).render("public/slug-paused", {
          title: `${slug} | Пауза`,
          slug,
          ownerName: owner?.displayName || owner?.firstName || "UNQX User",
          ownerUsername: owner?.username ? `@${owner.username}` : "",
          ownerAvatar: profileCard?.avatarUrl || "",
          pauseMessage: slugRow.pauseMessage || "Скоро вернусь · Пишите в Telegram",
          primarySocial,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "approved" || slugRow.status === "active" || slugRow.status === "private") {
        if (!slugRow.ownerId) {
          res.status(200).render("public/slug-state", {
            title: "Скоро",
            slug,
            heading: "Скоро появится",
            message: "Визитка для этого UNQ ещё не опубликована.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        const [owner, profileCard, views, ownerSlugs] = await Promise.all([
          findUserByTelegramIdWithLegacyFallback(slugRow.ownerId),
          findProfileCardByOwnerId(slugRow.ownerId),
          prisma.analyticsView
            ? prisma.analyticsView
              .findMany({
                where: { slug },
                select: { sessionId: true },
              })
              .then((rows) => new Set(rows.map((row) => row.sessionId)).size)
            : Promise.resolve(0),
          prisma.slug.findMany({
            where: {
              ownerId: slugRow.ownerId,
              status: { not: "free" },
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { fullSlug: true },
          }),
        ]);

        if (!owner || !profileCard) {
          res.status(200).render("public/slug-state", {
            title: "Скоро",
            slug,
            heading: "Скоро появится",
            message: "Визитка для этого UNQ ещё не опубликована.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        if (owner.status === "blocked" || owner.status === "deactivated") {
          res.status(200).render("public/slug-state", {
            title: "Недоступно",
            slug,
            heading: "Недоступно",
            message: "Эта визитка временно недоступна.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        const card = buildPublicCardFromProfile({
          slug,
          user: owner,
          profileCard: {
            ...profileCard,
            slugPrice: typeof slugRow.price === "number" ? slugRow.price : null,
          },
          viewsCount: views,
          allSlugs: ownerSlugs.map((item) => item.fullSlug),
        });
        const image = card.avatarUrl ? absoluteUrl(card.avatarUrl) : absoluteUrl("/brand/logo.PNG");
        const score = null;
        try {
          await logTapEventFromPageRequest({
            req,
            res,
            ownerSlug: slug,
            ownerId: slugRow.ownerId,
          });
        } catch (error) {
          console.error("[public] failed to log page tap event", error);
        }

        const topBadge = await getSlugTopBadge(slug);
        res.render("public/card", {
          title: `${card.name} | UNQX`,
          description: `Цифровая визитка ${card.name} на UNQX: контакты, соцсети, QR и быстрый обмен ссылкой.`,
          image,
          card,
          topBadge,
          score,
          noindex: slugRow.status === "private",
          adminSession: getAdminSession(req),
        });
        return;
      }
    }

    try {
      await prisma.errorLog.create({
        data: {
          type: "not_found",
          path: `/${req.params.slug}`,
          userAgent: req.get("user-agent") || "",
        },
      });
    } catch (error) {
      console.error("[express-app] failed to persist not_found log", error);
    }

    res.status(404).render("public/not-found", {
      title: "Визитка не найдена",
      slug: req.params.slug,
      adminSession: getAdminSession(req),
    });
    return;
  }),
);

module.exports = {
  publicPagesRouter: router,
};
