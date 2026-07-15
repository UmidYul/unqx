const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, requireVerifiedUserPage, getUserSession, logoutUserSession } = require("../../middleware/auth");
const {
  getEffectivePlan,
  PROFILE_THEMES,
  PROFILE_AVATAR_FRAMES,
  PROFILE_EMOJI_BACKGROUNDS,
} = require("../../services/profile");
const { absoluteUrl } = require("../../utils/url");
const { buildLeaderboard, normalizePeriod, normalizeLeaderboardType, getSlugTopBadge, getUserLeaderboardSummary } = require("../../services/leaderboard");
const { getFeatureSetting } = require("../../services/feature-settings");
const {
  getActiveFlashSale,
  resolveConditionLabel,
  getFlashSaleSlotsLeft,
  resolveFlashSalePresentation,
} = require("../../services/flash-sales");
const { normalizeRefCode } = require("../../services/referrals");
const { getActiveAuction } = require("../../services/auctions");
const { getPricingSettings } = require("../../services/pricing-settings");
const { getManySettings } = require("../../services/platform-settings");
const { listAdvertisements } = require("../../services/advertisements");
const { listEventCardReleases } = require("../../services/event-card-releases");
const { findTrackById, normalizeTrackId } = require("../../services/profile-music");
const { findLibraryPetById, listLibraryPets, normalizeLibraryPetId } = require("../../services/profile-pets-library");
const { findPublicThemeConfigByKey } = require("../../services/theme-configs");
const { getProfileEditorPresetsWithDisplayNames } = require("../../services/profile-editor-presets");
const { recordView } = require("../../services/tap-tracker");
const { isPublicProfileVisible } = require("../../services/subscription");
const {
  verifyPrivateAccessToken,
  extractPrivateAccessToken,
  setPrivateAccessCookie,
  clearPrivateAccessCookie,
} = require("../../services/private-access");
const { seoHub, getSeoPage } = require("../../content/seo-pages");
const { isValidSlug } = require("../../services/slug");
const {
  isWallStorageMissing,
  listPublicWallPosts,
  listLatestHomeWallPosts,
  listPublicSiteWallPosts,
} = require("../../services/profile-wall");
const {
  getViewerFollowLookup,
  getFollowSummaryForOwner,
} = require("../../services/follows");
const { sortProfileCardPets } = require("../../services/pets");
const {
  findPublicHandleByValue,
  getActivePublicHandle,
  getFreeProfileUserSelect,
  isFreeProfileCode,
  normalizePublicHandleValue,
  supportsFreeProfileUserFields,
} = require("../../services/public-handle");

const router = express.Router();
const defaultSocialImage = absoluteUrl("/brand/logo.PNG");
const CARD_THEMES = PROFILE_THEMES;
const LEGAL_DOCS_DIR = path.join(env.EXPRESS_APP_DIR, "docs");

function normalizePublicThemeKey(value) {
  const theme = String(value || "").trim();
  return theme === "royal_ivory" ? "sage_luxe" : theme;
}

async function resolvePublicCustomTheme(card) {
  const theme = normalizePublicThemeKey(card?.theme);
  if (!theme || CARD_THEMES.has(theme)) return null;
  if (card?.tariff !== "premium") return null;
  return findPublicThemeConfigByKey(theme);
}

function normalizeSafeNextPath(value, fallback = "/profile") {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(raw, "http://local.unqx");
    if (parsed.origin !== "http://local.unqx" || !parsed.pathname.startsWith("/")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function buildPathWithoutQueryKeys(basePath, query, keysToOmit = []) {
  const omitted = new Set(
    (Array.isArray(keysToOmit) ? keysToOmit : [])
      .map((key) => String(key || "").trim())
      .filter(Boolean),
  );
  const params = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (omitted.has(String(key || ""))) {
      return;
    }
    if (Array.isArray(value)) {
      value
        .filter((item) => typeof item === "string" && item.length > 0)
        .forEach((item) => {
          params.append(key, item);
        });
      return;
    }
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  });

  const serialized = params.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

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
  childSafety: readLegalDoc("child-safety-standards.md"),
};

const { getOfficialUnqClientConfig, isOfficialUnqSlugWithPrefixes } = require("../../services/official-unq-config");

router.use(
  asyncHandler(async (_req, res, next) => {
    try {
      res.locals.officialUnqClientConfig = await getOfficialUnqClientConfig();
    } catch {
      res.locals.officialUnqClientConfig = null;
    }
    next();
  }),
);

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
  return normalizePublicHandleValue(value);
}

function renderPublicFreeUnqOffer(res, req, slug) {
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
}

async function logTapEventFromPageRequest({ req, res, ownerSlug, ownerId }) {
  try {
    await recordView({
      req,
      res,
      ownerSlug,
      ownerId: ownerId || null,
      sourceInput: req.query?.src,
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

function getNameInitials(value, fallback = "UN") {
  const initials = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ? part[0].toUpperCase() : ""))
    .join("");
  return initials || fallback;
}

function mapLegacyCompatiblePublicUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }
  return {
    ...user,
    username: user.login || user.username || null,
    telegramUsername: user.telegramUsername || null,
  };
}

function getPublicUserHandle(user) {
  return String(user?.login || user?.username || "")
    .trim()
    .replace(/^@+/, "");
}

function getPublicTelegramHandle(user) {
  return String(user?.telegramUsername || "")
    .trim()
    .replace(/^@+/, "");
}

async function findUserByTelegramIdWithLegacyFallback(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        username: true,
        telegramUsername: true,
        login: true,
        displayName: true,
        status: true,
        plan: true,
        subscriptionStartedAt: true,
        subscriptionExpiresAt: true,
        isVerified: true,
        verifiedCompany: true,
        createdByStaffId: true,
      },
    });
    return mapLegacyCompatiblePublicUser(user);
  } catch (error) {
    if (!isUserMissingColumnError(error)) {
      throw error;
    }
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        first_name AS "firstName",
        username,
        telegram_username AS "telegramUsername",
        login
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return mapLegacyCompatiblePublicUser({
      ...row,
      displayName: null,
      status: "active",
      plan: "none",
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      isVerified: false,
      verifiedCompany: null,
      createdByStaffId: null,
    });
  }
}

async function findUserByRefCodeWithLegacyFallback(refCode) {
  try {
    const user = await prisma.user.findFirst({
      where: { refCode },
      select: {
        firstName: true,
        displayName: true,
        login: true,
        username: true,
      },
    });
    return mapLegacyCompatiblePublicUser(user);
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
  const selectBase = `
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
      avatar_frame AS "avatarFrame",
      emoji_background_pack AS "emojiBackgroundPack",
      show_branding AS "showBranding",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  let rows = [];
  try {
    rows = await prisma.$queryRawUnsafe(`
      SELECT ${selectBase}, selected_track_id AS "selectedTrackId", selected_pet_id AS "selectedPetId"
      FROM profile_cards
      WHERE owner_id = $1
      LIMIT 1
    `, ownerId);
  } catch (error) {
    const message = String(error?.message || "");
    if (!/selected_track_id|selected_pet_id|column .* does not exist/i.test(message)) {
      throw error;
    }
    try {
      rows = await prisma.$queryRawUnsafe(`
        SELECT ${selectBase}, selected_track_id AS "selectedTrackId"
        FROM profile_cards
        WHERE owner_id = $1
        LIMIT 1
      `, ownerId);
    } catch (fallbackError) {
      const fallbackMessage = String(fallbackError?.message || "");
      if (!/selected_track_id|column .* does not exist/i.test(fallbackMessage)) {
        throw fallbackError;
      }
      rows = await prisma.$queryRawUnsafe(`
        SELECT ${selectBase}
        FROM profile_cards
        WHERE owner_id = $1
        LIMIT 1
      `, ownerId);
    }
  }
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findPublicHandleForRoute(fullSlug) {
  const normalized = sanitizeSlug(fullSlug);
  if (!normalized) {
    return null;
  }

  if (isFreeProfileCode(normalized)) {
    const freeHandle = await findPublicHandleByValue(normalized, {
      includeProfileCard: true,
      includeSlugs: true,
    });
    if (!freeHandle) {
      return null;
    }
    return {
      id: `free:${freeHandle.ownerId}`,
      fullSlug: freeHandle.value,
      price: null,
      ownerId: freeHandle.ownerId,
      status: freeHandle.status,
      pauseMessage: freeHandle.pauseMessage || null,
      isPrimary: true,
      owner: freeHandle.owner || null,
      createdAt: freeHandle.owner?.createdAt || null,
      updatedAt: freeHandle.owner?.createdAt || null,
      approvedAt: freeHandle.owner?.createdAt || null,
      activatedAt: freeHandle.owner?.createdAt || null,
      type: "free",
    };
  }

  const slugRow = await findSlugByFullSlugWithLegacyFallback(normalized);
  return slugRow ? { ...slugRow, type: "slug" } : null;
}

async function listOwnedPetsByUserId(userId) {
  if (!userId || !prisma.profileCardPet) {
    return [];
  }
  try {
    const rows = await prisma.profileCardPet.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return sortProfileCardPets(rows);
  } catch {
    return [];
  }
}

async function findLatestApprovedVerificationByUserId(userId) {
  if (!userId || !prisma.verificationRequest) {
    return null;
  }
  try {
    return await prisma.verificationRequest.findFirst({
      where: {
        userId,
        status: "approved",
      },
      orderBy: [{ reviewedAt: "desc" }, { requestedAt: "desc" }],
      select: {
        companyName: true,
        role: true,
      },
    });
  } catch (error) {
    if (
      isMissingModelTable(error, "VerificationRequest") ||
      isMissingModelColumn(error, "VerificationRequest") ||
      isMissingModelDelegateError(error)
    ) {
      return null;
    }
    throw error;
  }
}

async function findApprovedBadgesByUserId(userId) {
  if (!userId || !prisma.badgeApplication) {
    return { government: false, unqx_staff: false };
  }
  try {
    const rows = await prisma.badgeApplication.findMany({
      where: { userId, status: "approved" },
      select: { badgeType: true },
    });
    const types = new Set(rows.map((r) => r.badgeType));
    return { government: types.has("government"), unqx_staff: types.has("unqx_staff") };
  } catch {
    return { government: false, unqx_staff: false };
  }
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
      const typeAlias = typeRaw === "карта" ? "card" : typeRaw;
      const type = allowedTypes.has(typeAlias) ? typeAlias : "other";
      const label = String(obj.label || "").trim().slice(0, 50);
      const href = String(obj.href || obj.value || obj.url || "").trim();
      const normalizedHref = normalizeButtonUrl(href, type, label);
      const effectiveType = normalizedHref.startsWith("card:") ? "card" : type;
      if (!label || !normalizedHref || !isSupportedButtonHref(normalizedHref)) {
        return null;
      }
      return {
        type: effectiveType,
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
  if (/(?:\u0434\u0438\u0437\u0430\u0439\u043d|design|ux|ui|product)/i.test(joined)) return "design";
  if (/(?:\u043f\u0440\u043e\u0434\u0430\u0436|sales|account|bizdev)/i.test(joined)) return "sales";
  if (/(?:\u043c\u0430\u0440\u043a\u0435\u0442|marketing|smm|seo|brand)/i.test(joined)) return "marketing";
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
  const cardLikeLabel = /(карта|card)/i.test(labelRaw);
  const mapLikeLabel = /(map|maps|geo|location|локац)/i.test(labelRaw);
  if (!input) return "";
  if (isSupportedButtonHref(input)) return input;
  if (kind === "card" || cardLikeLabel) {
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

function formatPublicWallAuthorLabel(value) {
  const normalized = String(value || "").trim().replace(/^@+/, "");
  return normalized ? `@${normalized}` : "";
}

function getPublicWallAuthorLabel(user, fallbackLabel = "") {
  const loginLabel = formatPublicWallAuthorLabel(user?.login);
  if (loginLabel) {
    return loginLabel;
  }
  const usernameLabel = formatPublicWallAuthorLabel(user?.username);
  if (usernameLabel) {
    return usernameLabel;
  }
  const fallback = String(fallbackLabel || "").trim();
  return fallback || "UNQX User";
}

function buildImmediatePublicProfileCard(user, profileCard) {
  const safeProfileCard = profileCard && typeof profileCard === "object" ? profileCard : {};
  const cardName =
    String(
      safeProfileCard.name ||
        user?.displayName ||
        user?.firstName ||
        user?.username ||
        "UNQX User",
    ).trim() || "UNQX User";

  return {
    ...safeProfileCard,
    name: cardName,
    role: String(safeProfileCard.role || "").trim(),
    bio: String(safeProfileCard.bio || "").trim(),
    hashtag: String(safeProfileCard.hashtag || "").trim(),
    address: String(safeProfileCard.address || "").trim(),
    postcode: String(safeProfileCard.postcode || "").trim(),
    email: String(safeProfileCard.email || "").trim(),
    extraPhone: String(safeProfileCard.extraPhone || "").trim(),
    avatarUrl: String(safeProfileCard.avatarUrl || "").trim(),
    tags: Array.isArray(safeProfileCard.tags) ? safeProfileCard.tags : [],
    buttons: Array.isArray(safeProfileCard.buttons) ? safeProfileCard.buttons : [],
    theme: String(safeProfileCard.theme || "default_dark").trim() || "default_dark",
    customColor: String(safeProfileCard.customColor || "").trim(),
    avatarFrame: String(safeProfileCard.avatarFrame || "none").trim().toLowerCase() || "none",
    emojiBackgroundPack: String(safeProfileCard.emojiBackgroundPack || "none").trim().toLowerCase() || "none",
    selectedTrackId: normalizeTrackId(safeProfileCard.selectedTrackId || safeProfileCard.selected_track_id),
    selectedTrack: safeProfileCard.selectedTrack || null,
    selectedPetId: normalizeLibraryPetId(safeProfileCard.selectedPetId || safeProfileCard.selected_pet_id),
    selectedPet: safeProfileCard.selectedPet || null,
    showBranding: typeof safeProfileCard.showBranding === "boolean" ? safeProfileCard.showBranding : true,
  };
}

function buildPublicCardFromProfile({ slug, user, profileCard, verifiedIdentity, viewsCount, allSlugs = [], pets = [] }) {
  const effectiveProfileCard = buildImmediatePublicProfileCard(user, profileCard);
  const plan = getEffectivePlan(user).plan;
  const isCurrentlyVerified = Boolean(user?.isVerified);
  const rawCardTheme = String(effectiveProfileCard.theme || "").trim();
  const normalizedCardTheme = normalizePublicThemeKey(rawCardTheme);
  const verifiedCompany =
    String(isCurrentlyVerified ? (verifiedIdentity?.companyName || user?.verifiedCompany || "") : "")
      .trim();
  const verifiedRole =
    String(isCurrentlyVerified ? (verifiedIdentity?.role || "") : "")
      .trim();
  const slugSaleListings = {};
  const normalizedSlugs = Array.isArray(allSlugs)
    ? allSlugs
      .map((value) => {
        if (value && typeof value === "object") {
          const fullSlug = String(value.fullSlug || value.full_slug || "").trim().toUpperCase();
          const salePrice = value.salePrice == null && value.sale_price == null
            ? null
            : Number(value.salePrice ?? value.sale_price);
          if (fullSlug && Boolean(value.onSale ?? value.on_sale) && Number.isFinite(salePrice) && salePrice > 0) {
            slugSaleListings[fullSlug] = { salePrice };
          }
          return fullSlug;
        }
        return String(value || "").trim().toUpperCase();
      })
      .filter(Boolean)
    : [];
  return {
    slug,
    slugs: normalizedSlugs.length ? normalizedSlugs : [slug],
    slugSaleListings,
    slugPrice: Number.isFinite(Number(effectiveProfileCard.slugPrice)) ? Number(effectiveProfileCard.slugPrice) : null,
    avatarUrl: effectiveProfileCard.avatarUrl || null,
    name: effectiveProfileCard.name,
    wallAuthorLabel: getPublicWallAuthorLabel(user, effectiveProfileCard.name),
    role: verifiedRole,
    bio: effectiveProfileCard.bio || "",
    verified: isCurrentlyVerified,
    verifiedCompany,
    tariff: plan,
    theme: normalizedCardTheme || "default_dark",
    customColor: effectiveProfileCard.customColor || "",
    avatarFrame: (() => {
      const nextFrame = String(effectiveProfileCard.avatarFrame || "").trim().toLowerCase();
      return PROFILE_AVATAR_FRAMES.has(nextFrame) ? nextFrame : "none";
    })(),
    emojiBackgroundPack: (() => {
      const nextPack = String(effectiveProfileCard.emojiBackgroundPack || "").trim().toLowerCase();
      return PROFILE_EMOJI_BACKGROUNDS.has(nextPack) ? nextPack : "none";
    })(),
    selectedTrackId: normalizeTrackId(effectiveProfileCard.selectedTrackId),
    selectedTrack: effectiveProfileCard.selectedTrack || null,
    selectedPetId: normalizeLibraryPetId(effectiveProfileCard.selectedPetId),
    selectedPet: effectiveProfileCard.selectedPet || null,
    phone: "",
    tags: mapProfileTags(effectiveProfileCard.tags),
    buttons: mapProfileButtons(effectiveProfileCard.buttons),
    hashtag: effectiveProfileCard.hashtag || "",
    address: effectiveProfileCard.address || "",
    postcode: effectiveProfileCard.postcode || "",
    email: effectiveProfileCard.email || "",
    extraPhone: effectiveProfileCard.extraPhone || "",
    viewsCount: Number(viewsCount || 0),
    showBranding: Boolean(effectiveProfileCard.showBranding),
    pets: [],
  };
}

function parsePaymentJsonArray(value) {
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

function normalizePaymentPublicSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+payment\/+/i, "")
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function isPaymentCardStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  let meta = "";
  try {
    meta = JSON.stringify(error.meta || {}).toLowerCase();
  } catch {
    meta = "";
  }
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "P2021" ||
    (code === "P2010" && (message.includes("42703") || meta.includes("42703"))) ||
    message.includes("payment_cards")
  );
}

function mapPublicPaymentMethods(value) {
  return parsePaymentJsonArray(value)
    .map((item) => {
      const obj = item && typeof item === "object" ? item : {};
      const label = String(obj.label || "").trim().slice(0, 80);
      const detail = String(obj.value || obj.requisite || "").trim().slice(0, 240);
      const note = String(obj.note || "").trim().slice(0, 240);
      if (obj.isActive === false || (!label && !detail && !note)) return null;
      return {
        type: String(obj.type || "other").trim().toLowerCase(),
        label: label || "Реквизит",
        value: detail,
        note,
      };
    })
    .filter(Boolean);
}

function mapPublicPaymentCardRow(row) {
  if (!row) return null;
  const profile = {
    name: row.profile_name || row.user_display_name || row.user_first_name || "UNQX User",
    role: row.profile_role || "",
    bio: row.profile_bio || "",
    hashtag: row.profile_hashtag || "",
    email: row.profile_email || row.user_email || "",
    extraPhone: row.profile_extra_phone || "",
    avatarUrl: row.profile_avatar_url || "",
    tags: parsePaymentJsonArray(row.profile_tags_json),
    theme: (() => {
      const theme = String(row.profile_theme || "").trim();
      return CARD_THEMES.has(theme) ? theme : "default_dark";
    })(),
    customColor: row.profile_custom_color || "",
    avatarFrame: (() => {
      const nextFrame = String(row.profile_avatar_frame || "").trim().toLowerCase();
      return PROFILE_AVATAR_FRAMES.has(nextFrame) ? nextFrame : "none";
    })(),
    emojiBackgroundPack: (() => {
      const nextPack = String(row.profile_emoji_background_pack || "").trim().toLowerCase();
      return PROFILE_EMOJI_BACKGROUNDS.has(nextPack) ? nextPack : "none";
    })(),
  };
  return {
    id: row.id,
    publicSlug: row.public_slug,
    title: row.title || "Payment",
    address: row.address || "",
    postcode: row.postcode || "",
    methods: mapPublicPaymentMethods(row.methods_json),
    profile,
    owner: {
      id: row.owner_id,
      login: row.user_login || "",
      username: row.user_login || row.user_username || "",
      telegramUsername: row.user_telegram_username || "",
      city: row.user_city || "",
    },
    updatedAt: row.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = userSession?.userId ? String(userSession.userId) : "";
    const [
      leaderboardSettings,
      activeFlashSale,
      nextDrop,
      pricing,
      publicSettingsRaw,
      topWeeklyViews,
      latestCreatedCards,
      latestHomeWallPosts,
      activeAuction,
      advertisements,
      authPhotoUrl,
    ] = await Promise.all([
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
        "homepage_flash_sale_visible",
        "homepage_hero_visible",
        "homepage_next_drop_visible",
        "homepage_calculator_visible",
        "homepage_live_profiles_visible",
        "homepage_testimonials_visible",
        "homepage_latest_posts_visible",
        "homepage_latest_unq_visible",
        "homepage_views_ranking_visible",
        "homepage_auction_visible",
        "homepage_faq_visible",
        "plan_premium_name",
        "plan_premium_monthly_price_usd",
        "plan_premium_monthly_price_uzs",
        "plan_premium_features",
        "plan_premium_excluded_features",
        "plan_premium_popular_badge",
        "contact_support_telegram",
        "contact_phone",
        "contact_response_time",
        "contact_error_fallback",
        "pending_expiry_hours",
      ]),
      (async () => {
        const board = await buildLeaderboard("day");
        return (Array.isArray(board.publicItems) ? board.publicItems : board.items || []).map((item) => ({
          primarySlug: String(item.slug || "").toUpperCase(),
          slugs: Array.isArray(item.slugs) ? item.slugs : [],
          views: Number(item.views || 0),
          name: String(item.ownerName || "UNQX User"),
          role: String(item.ownerRole || ""),
          company: String(item.ownerCompany || ""),
          isVerified: Boolean(item.isVerified),
          avatarUrl: item.avatarUrl || null,
        }));
      })(),
      (async () => {
        const [slugRows, freeUsers] = await Promise.all([
          withMissingTableFallback("Slug", [], () =>
            prisma.slug.findMany({
              where: {
                ownerId: { not: null },
                status: { in: ["approved", "active", "private", "paused"] },
              },
              orderBy: [{ createdAt: "desc" }],
              take: 24,
              select: {
                fullSlug: true,
                createdAt: true,
                owner: {
                  select: {
                    id: true,
                    status: true,
                    plan: true,
                    subscriptionStartedAt: true,
                    subscriptionExpiresAt: true,
                    firstName: true,
                    displayName: true,
                    username: true,
                    telegramUsername: true,
                    isVerified: true,
                    ...getFreeProfileUserSelect(),
                    slugs: {
                      where: {
                        status: { in: ["approved", "active", "private", "paused"] },
                      },
                      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                      select: {
                        fullSlug: true,
                        status: true,
                        pauseMessage: true,
                        isPrimary: true,
                      },
                    },
                    profileCard: {
                      select: {
                        name: true,
                        role: true,
                        bio: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            }),
          ),
          supportsFreeProfileUserFields()
            ? prisma.user.findMany({
                where: {
                  status: "active",
                  freeProfileCode: { not: null },
                  freeProfileDisabledAt: null,
                  slugs: {
                    none: {
                      status: { in: ["approved", "active", "private", "paused"] },
                    },
                  },
                },
                orderBy: [{ createdAt: "desc" }],
                take: 24,
                select: {
                  id: true,
                  createdAt: true,
                  status: true,
                  plan: true,
                  subscriptionStartedAt: true,
                  subscriptionExpiresAt: true,
                  firstName: true,
                  displayName: true,
                  username: true,
                  telegramUsername: true,
                  isVerified: true,
                  ...getFreeProfileUserSelect(),
                  slugs: {
                    where: {
                      status: { in: ["approved", "active", "private", "paused"] },
                    },
                    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                    select: {
                      fullSlug: true,
                      status: true,
                      pauseMessage: true,
                      isPrimary: true,
                    },
                  },
                  profileCard: {
                    select: {
                      name: true,
                      role: true,
                      bio: true,
                      avatarUrl: true,
                    },
                  },
                },
              })
            : Promise.resolve([]),
        ]);

        const candidates = [
          ...slugRows.map((row) => ({
            slug: String(row?.fullSlug || "").trim().toUpperCase(),
            createdAt: row?.createdAt || null,
            owner: row?.owner || null,
          })),
          ...freeUsers.map((owner) => ({
            slug: String(getActivePublicHandle(owner)?.value || "").trim().toUpperCase(),
            createdAt: owner?.createdAt || null,
            owner,
          })),
        ];

        const cards = [];
        for (const candidate of candidates) {
          const slug = String(candidate?.slug || "").trim().toUpperCase();
          const owner = candidate?.owner;
          const card = owner?.profileCard;
          if (!slug || !owner || !isPublicProfileVisible(owner) || !card) {
            continue;
          }

          cards.push({
            slug,
            createdAt: candidate.createdAt,
            name: String(card.name || owner.displayName || owner.firstName || "UNQX User").trim() || "UNQX User",
            username: String(owner.username || owner.telegramUsername || slug).trim().replace(/^@+/, ""),
            isVerified: Boolean(owner.isVerified),
            role: String(card.role || "").trim(),
            bio: String(card.bio || "").trim(),
            avatarUrl: String(card.avatarUrl || "").trim(),
          });

          if (cards.length >= 5) {
            break;
          }
        }

        return cards;
      })(),
      listLatestHomeWallPosts({ limit: 3 }).catch((error) => {
        if (isWallStorageMissing(error)) {
          return [];
        }
        throw error;
      }),
      getActiveAuction({ fallbackDemo: true }),
      listAdvertisements({ limit: 100 }),
      userId
        ? findProfileCardByOwnerId(userId)
          .then((card) => String(card?.avatarUrl || "").trim())
          .catch(() => "")
        : Promise.resolve(""),
    ]);
    const flashSaleSlotsLeft = activeFlashSale ? await getFlashSaleSlotsLeft(activeFlashSale) : null;
    const latestHomePostOwnerIds = Array.isArray(latestHomeWallPosts)
      ? latestHomeWallPosts.map((item) => String(item?.author?.userId || item?.ownerId || "").trim()).filter(Boolean)
      : [];
    const latestHomePostIds = Array.isArray(latestHomeWallPosts)
      ? latestHomeWallPosts.map((item) => String(item?.id || "").trim()).filter(Boolean)
      : [];
    const [latestHomePostViewerFollowSet, latestHomePostViewerLikedRows] = await Promise.all([
      getViewerFollowLookup(userId, latestHomePostOwnerIds),
      userId && latestHomePostIds.length
        ? withMissingTableFallback("ProfileWallPostLike", [], () =>
          prisma.profileWallPostLike.findMany({
            where: {
              userId,
              postId: { in: latestHomePostIds },
            },
            select: { postId: true },
          }),
        )
        : Promise.resolve([]),
    ]);
    const latestHomePostViewerLikedSet = new Set(
      latestHomePostViewerLikedRows.map((item) => String(item?.postId || "").trim()).filter(Boolean),
    );
    const latestPublishedPosts = Array.isArray(latestHomeWallPosts)
      ? latestHomeWallPosts.map((item) => ({
        ...item,
        viewerHasLiked: latestHomePostViewerLikedSet.has(String(item?.id || "").trim()),
        viewerFollowState: {
          isFollowing: latestHomePostViewerFollowSet.has(String(item?.author?.userId || item?.ownerId || "").trim()),
          canFollow: Boolean(item?.author?.userId) && String(item.author.userId).trim() !== userId,
          requiresAuth: !userId,
        },
      }))
      : [];

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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
      image: defaultSocialImage,
      testimonials,
      slugTotalLimit: Number(publicSettingsRaw.platform_total_slugs || env.SLUG_TOTAL_LIMIT),
      leaderboardEnabled: Boolean(leaderboardSettings.enabled),
      activeFlashSale: activeFlashSale
        ? {
          id: activeFlashSale.id,
          title: activeFlashSale.title,
          discountPercent: activeFlashSale.discountPercent,
          conditionLabel: resolveConditionLabel(activeFlashSale),
          conditionType: activeFlashSale.conditionType,
          slotsLeft: Number.isFinite(flashSaleSlotsLeft) ? flashSaleSlotsLeft : null,
          startsAt: activeFlashSale.startsAt,
          endsAt: activeFlashSale.endsAt,
          description: activeFlashSale.description || "",
          presentation: resolveFlashSalePresentation(activeFlashSale),
        }
        : null,
      activeAuction,
      nextDrop: nextDrop
        ? {
          id: nextDrop.id,
          title: nextDrop.title,
          dropAt: nextDrop.dropAt,
          slugCount: nextDrop.slugCount,
        }
        : null,
      topWeeklyViews,
      latestCreatedCards,
      latestPublishedPosts,
      advertisements,
      latestCreatedCard: Array.isArray(latestCreatedCards) && latestCreatedCards.length ? latestCreatedCards[0] : null,
      pricing,
      authPhotoUrl,
      publicSettings: publicSettingsRaw,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = String(userSession?.userId || "").trim();
    const page = Math.max(1, Math.round(Number(req.query.page || 1) || 1));
    const pageSize = 12;
    const [leaderboardSettings, postsPayload, authPhotoUrl] = await Promise.all([
      getFeatureSetting("leaderboard"),
      listPublicSiteWallPosts({ page, pageSize }).catch((error) => {
        if (isWallStorageMissing(error)) {
          return {
            items: [],
            pagination: { page, pageSize, total: 0, totalPages: 1, hasMore: false },
          };
        }
        throw error;
      }),
      userId
        ? findProfileCardByOwnerId(userId)
          .then((card) => String(card?.avatarUrl || "").trim())
          .catch(() => "")
        : Promise.resolve(""),
    ]);

    const postOwnerIds = Array.isArray(postsPayload.items)
      ? postsPayload.items.map((item) => String(item?.author?.userId || item?.ownerId || "").trim()).filter(Boolean)
      : [];
    const postIds = Array.isArray(postsPayload.items)
      ? postsPayload.items.map((item) => String(item?.id || "").trim()).filter(Boolean)
      : [];
    const [viewerFollowSet, viewerLikedRows] = await Promise.all([
      getViewerFollowLookup(userId, postOwnerIds),
      userId && postIds.length
        ? withMissingTableFallback("ProfileWallPostLike", [], () =>
          prisma.profileWallPostLike.findMany({
            where: {
              userId,
              postId: { in: postIds },
            },
            select: { postId: true },
          }),
        )
        : Promise.resolve([]),
    ]);
    const viewerLikedSet = new Set(
      viewerLikedRows.map((item) => String(item?.postId || "").trim()).filter(Boolean),
    );
    const posts = Array.isArray(postsPayload.items)
      ? postsPayload.items.map((item) => ({
        ...item,
        viewerHasLiked: viewerLikedSet.has(String(item?.id || "").trim()),
        viewerFollowState: {
          isFollowing: viewerFollowSet.has(String(item?.author?.userId || item?.ownerId || "").trim()),
          canFollow: Boolean(item?.author?.userId) && String(item.author.userId).trim() !== userId,
          requiresAuth: !userId,
        },
      }))
      : [];

    res.render("public/posts", {
      title: "Посты | UNQX",
      description: "Все опубликованные посты пользователей UNQX.",
      image: defaultSocialImage,
      baseUrl: absoluteUrl(""),
      canonicalUrl: absoluteUrl("/posts"),
      leaderboardEnabled: Boolean(leaderboardSettings.enabled),
      posts,
      pagination: postsPayload.pagination,
      authPhotoUrl,
      userSession,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/cards",
  asyncHandler(async (req, res) => {
    const userSession = getUserSession(req);
    const userId = String(userSession?.userId || "").trim();
    const [leaderboardSettings, eventCards, authPhotoUrl] = await Promise.all([
      getFeatureSetting("leaderboard"),
      listEventCardReleases({ limit: 100 }),
      userId
        ? findProfileCardByOwnerId(userId)
          .then((card) => String(card?.avatarUrl || "").trim())
          .catch(() => "")
        : Promise.resolve(""),
    ]);

    res.render("public/event-cards", {
      title: "Карты | UNQX",
      description: "Эксклюзивные ивентовые дизайны карт UNQX.",
      image: defaultSocialImage,
      baseUrl: absoluteUrl(""),
      canonicalUrl: absoluteUrl("/cards"),
      leaderboardEnabled: Boolean(leaderboardSettings.enabled),
      eventCards,
      authPhotoUrl,
      userSession,
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
      title: "Войти | UNQX",
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
      image: defaultSocialImage,
      next: normalizeSafeNextPath(req.query.next, "/profile"),
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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
      description: "Подтвердите email для завершения регистрации в UNQX",
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
      description: "Введите email, чтобы получить ссылку для сброса пароля",
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
      description: "Создайте новый пароль для входа в аккаунт UNQX",
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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
  "/unqx-game",
  requireVerifiedUserPage,
  asyncHandler(async (req, res) => {
    res.status(404).render("public/not-found", {
      title: "Страница не найдена",
      slug: "unqx-game",
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

    const profileCard = await findProfileCardByOwnerId(user.id);

    res.render("public/profile", {
      title: "Profile | UNQX",
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
      image: defaultSocialImage,
      telegramBotUsername: String(env.TELEGRAM_BOT_USERNAME || "").replace(/^@+/, "").trim(),
      reactivationWindowDays: Number(env.ACCOUNT_REACTIVATION_WINDOW_DAYS || 30),
      themePresets: await getProfileEditorPresetsWithDisplayNames({
        selectedTheme: profileCard?.theme,
        selectedFrame: profileCard?.avatarFrame,
      }),
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
    const type = normalizeLeaderboardType(req.query.type);
    const [board, userSummary] = await Promise.all([
      buildLeaderboard(period, type),
      (() => {
        const user = getUserSession(req);
        if (!user?.userId) return Promise.resolve(null);
        return getUserLeaderboardSummary({
          userId: user.userId,
          period,
          type,
        });
      })(),
    ]);
    const periodTitleMap = {
      day: "Топ визиток дня",
      week: "Топ визиток недели",
      month: "Топ визиток месяца",
      all: "Топ визиток за всё время",
    };
    const pageTitle = `${periodTitleMap[period] || "Топ визиток"} | UNQX`;

    res.render("public/leaderboard", {
      title: pageTitle,
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
      image: defaultSocialImage,
      period: board.period,
      type: board.type,
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
    res.status(404).render("public/not-found", {
      title: "Страница не найдена",
      slug: "drops",
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
        { name: "Гайы", url: canonical },
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
        title: "Страница не найдена",
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
        { name: "Гайы", url: absoluteUrl("/guides") },
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
        description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
        description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
  "/child-safety",
  asyncHandler(async (req, res) => {
    const markdown = legalDocs.childSafety;
    const heading = extractMarkdownHeading(markdown, "UNQX Child Safety Standards (CSAE)");
    const updatedAt = extractMarkdownMeta(markdown, "Last updated") || "2026-03-28";
    const effectiveDate = extractMarkdownMeta(markdown, "Effective date") || "";
    const canonical = absoluteUrl("/child-safety");
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: heading,
        description: "UNQX child safety standards, reporting channels, moderation and enforcement.",
        url: canonical,
        dateModified: updatedAt,
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Child Safety", url: canonical },
      ]),
    ];

    res.render("public/legal-page", {
      title: `${heading} | UNQX`,
      description: "UNQX child safety standards, reporting channels, moderation and enforcement.",
      heading,
      lead: "Zero-tolerance standards for CSAM, child exploitation, grooming, and trafficking on UNQX.",
      updatedAt,
      effectiveDate,
      readingMinutes: estimateReadingMinutes(markdown),
      contentHtml: markdownToHtml(markdown, { stripTitle: true }),
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
            status: true,
            firstName: true,
            displayName: true,
            isVerified: true,
            verifiedCompany: true,
            directorySector: true,
            plan: true,
            subscriptionStartedAt: true,
            subscriptionExpiresAt: true,
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
      if (!isPublicProfileVisible(owner)) continue;

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
      description: "UNQX personal dashboard: card settings, UNQ, analytics, requests and profile settings.",
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
  "/payment/:publicSlug",
  asyncHandler(async (req, res) => {
    const publicSlug = normalizePaymentPublicSlug(req.params.publicSlug);
    if (!publicSlug) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: req.params.publicSlug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    try {
      const rows = await prisma.$queryRawUnsafe(
        `
          SELECT
            pc.*,
            pc.methods AS methods_json,
            u.first_name AS user_first_name,
            u.display_name AS user_display_name,
            u.login AS user_login,
            u.username AS user_username,
            u.telegram_username AS user_telegram_username,
            u.email AS user_email,
            u.city AS user_city,
            u.status AS user_status,
            pr.name AS profile_name,
            pr.role AS profile_role,
            pr.bio AS profile_bio,
            pr.hashtag AS profile_hashtag,
            pr.email AS profile_email,
            pr.extra_phone AS profile_extra_phone,
            pr.avatar_url AS profile_avatar_url,
            pr.tags AS profile_tags_json,
            pr.theme AS profile_theme,
            pr.custom_color AS profile_custom_color,
            pr.avatar_frame AS profile_avatar_frame,
            pr.emoji_background_pack AS profile_emoji_background_pack
          FROM payment_cards pc
          JOIN users u ON u.id = pc.owner_id
          LEFT JOIN profile_cards pr ON pr.owner_id = u.id
          WHERE pc.public_slug = $1
            AND pc.is_published = true
          LIMIT 1
        `,
        publicSlug,
      );
      const row = Array.isArray(rows) ? rows[0] || null : null;
      if (!row || row.user_status === "blocked" || row.user_status === "deactivated" || row.user_status === "deleted") {
        res.status(404).render("public/not-found", {
          title: "Страница не найдена",
          slug: publicSlug,
          adminSession: getAdminSession(req),
        });
        return;
      }

      const paymentCard = mapPublicPaymentCardRow(row);
      const image = paymentCard.profile.avatarUrl ? absoluteUrl(paymentCard.profile.avatarUrl) : defaultSocialImage;
      res.render("public/payment-card", {
        title: `${paymentCard.title} | ${paymentCard.profile.name}`,
        description: `Реквизиты оплаты ${paymentCard.title} для ${paymentCard.profile.name}.`,
        image,
        paymentCard,
        noindex: false,
        adminSession: getAdminSession(req),
      });
    } catch (error) {
      if (isPaymentCardStorageError(error)) {
        res.status(404).render("public/not-found", {
          title: "Страница не найдена",
          slug: publicSlug,
          adminSession: getAdminSession(req),
        });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/qr/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const slugRow = await findSlugByFullSlugWithLegacyFallback(slug);
    if (!slugRow || !["active", "private"].includes(slugRow.status) || !slugRow.ownerId) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
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
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }
    if (!isPublicProfileVisible(owner)) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    res.render("public/qr", {
      title: `QR ${slug}`,
      description: `QR-взтка UNQ ${slug}. Открой цфровую карточку влаельца по ссылке  поелсь за секуну.`,
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

/* ─── Payment Card page: /payment/:number ─── */
router.get(
  "/payment/:number",
  asyncHandler(async (req, res) => {
    const raw = req.params.number;
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 0 || String(num) !== raw) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const cardRows = await prisma.$queryRaw`
      SELECT
        id,
        number,
        owner_id   AS "ownerId",
        name,
        role,
        bio,
        hashtag,
        address,
        postcode,
        email,
        extra_phone  AS "extraPhone",
        avatar_url   AS "avatarUrl",
        tags,
        buttons,
        theme,
        custom_color AS "customColor",
        avatar_frame AS "avatarFrame",
        show_branding AS "showBranding",
        views_count  AS "viewsCount",
        created_at   AS "createdAt",
        updated_at   AS "updatedAt"
      FROM payment_cards
      WHERE number = ${num}
      LIMIT 1
    `;
    const paymentCard = Array.isArray(cardRows) ? cardRows[0] || null : null;

    if (!paymentCard) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const owner = await findUserByTelegramIdWithLegacyFallback(paymentCard.ownerId);

    if (!owner || owner.status === "blocked" || owner.status === "deactivated") {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "",
        adminSession: getAdminSession(req),
      });
      return;
    }

    if (!isPublicProfileVisible(owner)) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const verifiedIdentity = await findLatestApprovedVerificationByUserId(paymentCard.ownerId);
    const profileCard = await findProfileCardByOwnerId(paymentCard.ownerId);
    const isCurrentlyVerified = Boolean(owner.isVerified);
    const verifiedCompany = String(
      isCurrentlyVerified ? (verifiedIdentity?.companyName || owner.verifiedCompany || "") : ""
    ).trim();
    const verifiedRole = String(
      isCurrentlyVerified ? (verifiedIdentity?.role || "") : ""
    ).trim();

    const card = {
      slug: `PAYMENT/${num}`,
      slugs: [`PAYMENT/${num}`],
      slugPrice: null,
      avatarUrl: paymentCard.avatarUrl || profileCard?.avatarUrl || owner.photoUrl || null,
      name: paymentCard.name,
      role: paymentCard.role || verifiedRole,
      bio: paymentCard.bio || "",
      verified: isCurrentlyVerified,
      verifiedCompany,
      tariff: getEffectivePlan(owner).plan,
      theme: "marble",
      customColor: paymentCard.customColor || "",
      phone: "",
      tags: mapProfileTags(paymentCard.tags),
      buttons: mapProfileButtons(paymentCard.buttons),
      hashtag: paymentCard.hashtag || "",
      address: paymentCard.address || "",
      postcode: paymentCard.postcode || "",
      email: paymentCard.email || "",
      extraPhone: paymentCard.extraPhone || "",
      viewsCount: Number(paymentCard.viewsCount || 0),
      showBranding: Boolean(paymentCard.showBranding),
    };

    // Increment views count
    try {
      await prisma.$executeRaw`
        UPDATE payment_cards SET views_count = views_count + 1, updated_at = now()
        WHERE id = ${paymentCard.id}::uuid
      `;
    } catch (err) {
      console.error("[payment-card] failed to increment views_count", err);
    }

    // Log tap event for analytics
    try {
      await logTapEventFromPageRequest({
        req,
        res,
        ownerSlug: `PAYMENT/${num}`,
        ownerId: paymentCard.ownerId,
      });
    } catch (error) {
      console.error("[payment-card] failed to log page tap event", error);
    }

    const topBadge = null;
    const officialCfg = await getOfficialUnqClientConfig();
    const approvedBadges = await findApprovedBadgesByUserId(paymentCard.ownerId);
    const showOfficialUnqBadge = approvedBadges.government;
    const officialUnqBadge = showOfficialUnqBadge
      ? { title: officialCfg.profileBadgeTitle, line: officialCfg.profileBadgeLine }
      : null;
    const showStaffBadge = approvedBadges.unqx_staff;
    const staffBadge = showStaffBadge
      ? { title: officialCfg.staffProfileBadgeTitle, line: officialCfg.staffProfileBadgeLine }
      : null;
    const image = card.avatarUrl ? absoluteUrl(card.avatarUrl) : absoluteUrl("/brand/logo.PNG");
    const customTheme = await resolvePublicCustomTheme(card);
    if (customTheme) {
      res.set("Cache-Control", "no-cache, must-revalidate");
    }

    res.render("public/card", {
      title: `${card.name} | UNQX`,
      description: `${card.name} on UNQX: digital business card, contacts, links, QR and analytics.`,
      image,
      card,
      customTheme,
      topBadge,
      score: null,
      officialUnqBadge,
      staffBadge,
      noindex: true,
      privateAccess: null,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);

    const slugRow = await findPublicHandleForRoute(slug);

    // Нет строки в slugs, но код валидного UNQ (AAA000) — считаем инвентарь свободным, без предсидирования всех комбинаций.
    if (!slugRow && isValidSlug(slug)) {
      renderPublicFreeUnqOffer(res, req, slug);
      return;
    }

    if (slugRow) {
      if (slugRow.status === "blocked") {
        res.status(200).render("public/slug-state", {
          title: "Неоступно",
          slug,
          heading: "Неоступно",
          message: "Этот UNQ сейчас неоступен.",
          ctaLabel: "",
          ctaHref: "",
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "free") {
        if (isValidSlug(slug)) {
          renderPublicFreeUnqOffer(res, req, slug);
          return;
        }
        res.status(404).render("public/not-found", {
          title: "Страница не найдена",
          slug,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "pending" || slugRow.status === "reserved") {
        res.status(200).render("public/slug-state", {
          title: `UNQ занят: ${slug}`,
          slug,
          heading: "Этот UNQ уже занят",
          message: "Сейчас он на рассотрен. Встань в wishlist  ы сообщ, есл он освоботся.",
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
          title: `UNQ оступен в ропе`,
          slug,
          heading: "Этот UNQ оступен в ропе",
          message: "Попшсь на блжайшй роп  забер этот slug в оент старта.",
          ctaLabel: "На главную",
          ctaHref: "/",
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
            title: "Неоступно",
            slug,
            heading: "Неоступно",
            message: "Эта взтка вреенно неоступна.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }
        if (!isPublicProfileVisible(owner)) {
          res.status(404).render("public/not-found", {
            title: "Страница не найдена",
            slug,
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
        const usernameForTelegram = getPublicTelegramHandle(owner);
        const telegramFallback = usernameForTelegram
          ? { type: "telegram", label: "Telegram", url: `https://t.me/${usernameForTelegram}`, isActive: true }
          : null;
        const primarySocial =
          socialButtons.find((item) => item.type === "telegram") || socialButtons[0] || telegramFallback;
        const ownerHandle = getPublicUserHandle(owner);

        res.status(200).render("public/slug-paused", {
          title: `${slug} | Пауза`,
          slug,
          ownerName: owner?.displayName || owner?.firstName || "UNQX User",
          ownerUsername: ownerHandle ? `@${ownerHandle}` : "",
          ownerAvatar: profileCard?.avatarUrl || "",
          pauseMessage: slugRow.pauseMessage || "Скоро вернусь · Пште в Telegram",
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
            message: "Визитка для этого UNQ пока не опубликована.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        const [owner, profileCard, ownedPets] = await Promise.all([
          findUserByTelegramIdWithLegacyFallback(slugRow.ownerId),
          findProfileCardByOwnerId(slugRow.ownerId),
          listOwnedPetsByUserId(slugRow.ownerId),
        ]);

        if (!owner) {
          res.status(200).render("public/slug-state", {
            title: "Скоро",
            slug,
            heading: "Скоро появится",
            message: "Визитка для этого UNQ пока не опубликована.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }
        const effectiveProfileCard = buildImmediatePublicProfileCard(owner, profileCard);

        if (owner.status === "blocked" || owner.status === "deactivated") {
          res.status(200).render("public/slug-state", {
            title: "Неоступно",
            slug,
            heading: "Неоступно",
            message: "Эта взтка вреенно неоступна.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }
        if (!isPublicProfileVisible(owner)) {
          res.status(404).render("public/not-found", {
            title: "Страница не найдена",
            slug,
            adminSession: getAdminSession(req),
          });
          return;
        }

        let privateAccessExpiry = null;
        if (slugRow.status === "private") {
          const sessionUser = getUserSession(req);
          const isOwnerViewer = sessionUser?.userId && String(sessionUser.userId) === String(slugRow.ownerId);
          if (!isOwnerViewer) {
            const accessToken = extractPrivateAccessToken(req);
            const accessPayload = verifyPrivateAccessToken(accessToken, {
              slug,
              ownerId: slugRow.ownerId,
            });
            if (!accessPayload) {
              clearPrivateAccessCookie(req, res);
              const lockedQuery = String(req.query.locked || "")
                .trim()
                .toLowerCase();
              const ownerSlugRows = await prisma.slug.findMany({
                where: { ownerId: slugRow.ownerId },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                select: { fullSlug: true },
              });
              const ownerSlugs = ownerSlugRows
                .map((item) => String(item.fullSlug || "").trim().toUpperCase())
                .filter(Boolean);
              if (!ownerSlugs.length) {
                ownerSlugs.push(slug);
              }
              const ownerHandle = getPublicUserHandle(owner);
              res.status(200).render("public/slug-private", {
                title: `${slug} | Закрытая визитка`,
                slug,
                ownerSlugs,
                ownerName: effectiveProfileCard.name,
                ownerUsername: ownerHandle ? `@${ownerHandle}` : "",
                ownerAvatar: effectiveProfileCard.avatarUrl || "",
                ownerIsVerified: Boolean(owner?.isVerified),
                theme: effectiveProfileCard.theme || "default_dark",
                customColor: effectiveProfileCard.customColor || "",
                avatarFrame: effectiveProfileCard.avatarFrame || "none",
                lockedReason: lockedQuery === "expired" ? "expired" : "",
                noindex: true,
                adminSession: getAdminSession(req),
              });
              return;
            }
            if (typeof req.query?.accessToken === "string" && req.query.accessToken.trim()) {
              setPrivateAccessCookie(req, res, accessToken, accessPayload.exp);
              res.redirect(buildPathWithoutQueryKeys(`/${encodeURIComponent(slug)}`, req.query, ["accessToken"]));
              return;
            }
            privateAccessExpiry = accessPayload.exp;
          }
        }
        if (slugRow.status === "private" && privateAccessExpiry) {
          // One-time access: force password prompt again on next page refresh.
          clearPrivateAccessCookie(req, res);
        }

        const viewerSession = getUserSession(req);
        const viewerUserId = String(viewerSession?.userId || "").trim();
        const [views, ownerSlugs, verifiedIdentity, wall, viewerProfileCard, followSummary, selectedTrack, selectedPet] = await Promise.all([
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
            select: { fullSlug: true, onSale: true, salePrice: true },
              }),
          findLatestApprovedVerificationByUserId(slugRow.ownerId),
          slugRow.status === "active"
            ? listPublicWallPosts({
              ownerId: slugRow.ownerId,
              viewerUserId,
            }).catch((error) => {
              if (isWallStorageMissing(error)) {
                return {
                  items: [],
                  pagination: { page: 1, pageSize: 10, total: 0, hasMore: false },
                };
              }
              throw error;
            })
            : Promise.resolve(null),
          viewerUserId
            ? findProfileCardByOwnerId(viewerUserId).catch(() => null)
            : Promise.resolve(null),
          getFollowSummaryForOwner({
            ownerId: slugRow.ownerId,
            viewerUserId,
            scope: "public",
          }),
          effectiveProfileCard.selectedTrackId
            ? findTrackById(effectiveProfileCard.selectedTrackId)
            : Promise.resolve(null),
          effectiveProfileCard.selectedPetId
            ? listLibraryPets({
              limit: 20,
              activeOnly: true,
              userId: owner.id,
              includeIds: [effectiveProfileCard.selectedPetId],
            }).then((items) => items.find((item) => item.id === effectiveProfileCard.selectedPetId) || null)
            : Promise.resolve(null),
        ]);

        const card = buildPublicCardFromProfile({
          slug,
          user: owner,
          profileCard: {
            ...effectiveProfileCard,
            slugPrice: typeof slugRow.price === "number" ? slugRow.price : null,
            selectedTrack: selectedTrack
              ? { title: selectedTrack.title, audioUrl: selectedTrack.audioUrl }
              : null,
            selectedPet: selectedPet
              ? {
                id: selectedPet.id,
                name: selectedPet.displayName || selectedPet.name,
                imageUrl: selectedPet.imageUrl,
                eventName: selectedPet.eventName || "",
                price: selectedPet.price || 0,
              }
              : null,
          },
          pets: ownedPets,
          verifiedIdentity,
          viewsCount: views,
          allSlugs: ownerSlugs,
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
        const resolvedTopBadge = slugRow.type === "free" ? null : topBadge;
        const officialCfg = await getOfficialUnqClientConfig();
        const approvedBadges = await findApprovedBadgesByUserId(slugRow.ownerId);
        const allCardSlugs = [slug, ...ownerSlugs.map((item) => item.fullSlug)]
          .map((value) => String(value || "").trim().toUpperCase())
          .filter(Boolean);
        const showOfficialUnqBadge = allCardSlugs.some((value) => isOfficialUnqSlugWithPrefixes(value, officialCfg.prefixes)) || approvedBadges.government;
        const officialUnqBadge = showOfficialUnqBadge
          ? { title: officialCfg.profileBadgeTitle, line: officialCfg.profileBadgeLine }
          : null;
        const showStaffBadge = approvedBadges.unqx_staff;
        const staffBadge = showStaffBadge
          ? { title: officialCfg.staffProfileBadgeTitle, line: officialCfg.staffProfileBadgeLine }
          : null;
        const viewerCommentComposer = {
          avatarUrl: String(viewerProfileCard?.avatarUrl || "").trim() || "/brand/profile-user.svg",
          initials: getNameInitials(
            viewerSession?.displayName ||
              [viewerSession?.firstName, viewerSession?.lastName].filter(Boolean).join(" ") ||
              viewerSession?.login ||
              "",
          ),
          placeholder: "Добавьте ответ...",
        };
        const customTheme = await resolvePublicCustomTheme(card);
        if (customTheme) {
          res.set("Cache-Control", "no-cache, must-revalidate");
        }
        res.render("public/card", {
          title: `${card.name} | UNQX`,
          description: `${card.name} on UNQX: digital business card, contacts, links, QR and analytics.`,
          image,
          card,
          customTheme,
          wall: wall
            ? {
              enabled: true,
              ...wall,
            }
            : null,
          topBadge: resolvedTopBadge,
          score,
          officialUnqBadge,
          staffBadge,
          viewerCommentComposer,
          followSummary,
          noindex: slugRow.status === "private",
          privateAccess: null,
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
      title: "Страница не найдена",
      slug: req.params.slug,
      adminSession: getAdminSession(req),
    });
    return;
  }),
);

module.exports = {
  publicPagesRouter: router,
};
