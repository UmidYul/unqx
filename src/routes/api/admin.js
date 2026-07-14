const { randomUUID } = require("node:crypto");
const express = require("express");
const multer = require("multer");
const { addDays, format, startOfDay, subDays } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");
const { Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { requireStaffApi } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/async");
const { adminApiRateLimit } = require("../../middleware/rate-limit");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { parsePositiveInt } = require("../../utils/http");
const { normalizeLogin, isValidLogin } = require("../../utils/login");
const { generateNextSlug } = require("../../services/cards");
const {
  getAssignableSlugType,
  getSlugStorageParts,
  isAssignableSlug,
  isLegacySlug,
  isReservedSlugPath,
  normalizeAssignableSlug,
} = require("../../services/slug");
const { getGlobalStats } = require("../../services/stats");
const { calculateSlugPrice, getSlugPricingConfig } = require("../../services/slug-pricing");
const { sendTelegramMessage, sendPaymentAlertsToAdmin } = require("../../services/telegram");
const { recalculateAndRefreshPercentiles } = require("../../services/unq-score");
const { sendExpoPushToUser, sendExpoPushToUsers } = require("../../services/push");
const { applyOrderStatusTransition } = require("../../services/order-status-transition");
const {
  getBraceletPrice,
  getPlanCharge,
  getPlanPurchaseType,
  getPricingSettings,
  normalizePlan,
} = require("../../services/pricing-settings");
const { buildOrderPaymentDraft } = require("../../services/payment-flow");
const {
  PROFILE_THEMES,
  PROFILE_AVATAR_FRAMES,
  PROFILE_EMOJI_BACKGROUNDS,
  getEffectivePlan,
  getSlugLimit,
  getTagLimit,
  getButtonLimit,
  canCreateCard,
  normalizeThemeByPlan,
  normalizeAvatarFrameByPlan,
  normalizeEmojiBackgroundByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  normalizeProfileType,
} = require("../../services/profile");
const {
  isWallStorageMissing,
  listAllAdminWallPosts,
  listAdminWallPosts,
  updateWallPostAsAdmin,
  resolveWallPage,
  resolveWallPageSize,
  WALL_ADMIN_PAGE_SIZE,
} = require("../../services/profile-wall");
const {
  isSupportedAvatarBuffer,
  saveAvatarFromBuffer,
  deleteAvatarByPublicPath,
  buildAvatarSlug,
} = require("../../services/avatar");
const {
  getPaymentStatistics,
  getPaymentAlerts,
  getConversionFunnel,
  isPaymentEventsStorageError: isPaymentEventsStorageErrorAnalytics,
} = require("../../services/payment-analytics");
const { detectDevice } = require("../../services/ua");
const { getTodayVisitorsStats, getUtcDayStart, incrementTodayVisitorsAdjustment } = require("../../services/live-stats");
const {
  getPetCatalog,
  getPetPriceFromCatalog,
  normalizePetType,
  normalizePetDisplayName,
  resolvePetDisplayName,
  getPetTypeLabel,
  mapProfileCardPet,
  sortProfileCardPets,
  mapPetPurchaseRequest,
} = require("../../services/pets");
const { buildPublicHandleUserSelect } = require("../../services/public-handle");
const {
  listAdminAuctions,
  createAuction,
  banBid,
  finishAuction,
} = require("../../services/auctions");
const {
  createAdvertisement,
  deleteAdvertisement,
  deleteAdvertisementImage,
  listAdvertisements,
  saveAdvertisementPng,
} = require("../../services/advertisements");
const {
  createEventCardRelease,
  deleteEventCardImage,
  deleteEventCardRelease,
  listEventCardReleases,
  saveEventCardImage,
} = require("../../services/event-card-releases");
const {
  createTrack,
  deleteTrack,
  deleteTrackFile,
  listTracks,
  saveTrackMp3,
} = require("../../services/profile-music");
const {
  deleteThemeConfig,
  findPublicThemeConfigByKey,
  listThemeConfigs,
  upsertThemeConfig,
} = require("../../services/theme-configs");

const router = express.Router();
const ONLINE_WINDOW_SECONDS = 90;
const SYNTHETIC_FINGERPRINT_PREFIX = "synthetic:";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const eventCardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const trackUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
async function safeDeleteAvatarByPublicPath(publicPath) {
  if (!publicPath) return;
  try {
    const refs = await prisma.profileCard.count({ where: { avatarUrl: publicPath } });
    if (refs > 1) {
      return;
    }
  } catch {
    return;
  }
  await deleteAvatarByPublicPath(publicPath);
}
async function safeDeletePaymentCardAvatar(publicPath, excludeCardId) {
  if (!publicPath) return;
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS cnt FROM payment_cards WHERE avatar_url = ${publicPath} AND id != ${excludeCardId}::uuid
    `;
    if (Array.isArray(rows) && rows[0] && Number(rows[0].cnt) > 0) return;
  } catch { return; }
  await deleteAvatarByPublicPath(publicPath);
}
const PROFILE_CARD_BASE_COLUMNS = [
  "owner_id",
  "name",
  "role",
  "bio",
  "email",
  "avatar_url",
  "tags",
  "buttons",
  "theme",
  "custom_color",
  "avatar_frame",
  "emoji_background_pack",
  "show_branding",
];
const CARD_THEME_ENUM_CACHE_TTL_MS = 5 * 60 * 1000;
let cardThemeEnumCache = {
  checkedAt: 0,
  values: null,
};
const PUSH_PRIORITY_SET = new Set(["default", "normal", "high"]);
const PUSH_SOUND_SET = new Set(["default", "none"]);
const BROADCAST_CHUNK_USERS = 400;
const BROADCAST_JOB_LIMIT = 50;
const BROADCAST_JOB_TTL_MS = 1000 * 60 * 30;
const MAX_ADMIN_BOOST_VIEWS = 5000;
const MAX_ADMIN_BOOST_PERIOD_DAYS = 90;
const MAX_TODAY_VISITORS_INCREMENT = 100_000;
const MAX_DB_INT = 2_147_483_647;
const PASSWORD_ROUNDS = 12;
const broadcastJobs = new Map();
const USER_COLUMN_MAP = {
  id: "id",
  firstName: "first_name",
  displayName: "display_name",
  city: "city",
  username: "username",
  telegramUsername: "telegram_username",
  login: "login",
  isVerified: "is_verified",
  verifiedCompany: "verified_company",
  plan: "plan",
  planPurchasedAt: "plan_purchased_at",
  planUpgradedAt: "plan_upgraded_at",
  profileType: "profile_type",
  createdByStaffId: "created_by_staff_id",
  status: "status",
  createdAt: "created_at",
};
let cachedUserColumns = null;
let cachedUserColumnsAt = 0;

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeAnalyticsPattern(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_*\-]/g, "")
    .slice(0, 32);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCityOptional(value) {
  const raw = String(value || "").trim().slice(0, 120);
  return raw || null;
}

function generateRefCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUniqueRefCode() {
  for (let i = 0; i < 20; i += 1) {
    const candidate = generateRefCode();
    const existing = await prisma.user.findFirst({
      where: { refCode: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `${generateRefCode()}${generateRefCode().slice(0, 2)}`;
}

async function getUserColumns() {
  const now = Date.now();
  if (cachedUserColumns && now - cachedUserColumnsAt < 1000 * 60 * 5) {
    return cachedUserColumns;
  }
  try {
    const rows = await prisma.$queryRaw`
      SELECT column_name::text AS column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND table_schema = current_schema()
    `;
    cachedUserColumns = new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.column_name || "")));
    cachedUserColumnsAt = now;
    return cachedUserColumns;
  } catch {
    return null;
  }
}

function hasUserColumn(columns, field) {
  if (!columns) return true;
  const columnName = USER_COLUMN_MAP[field] || field;
  return columns.has(columnName);
}

function parseJsonArray(value) {
  if (!value) return [];
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

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "t" || value === "true") return true;
  if (value === 0 || value === "0" || value === "f" || value === "false") return false;
  return fallback;
}

function mapProfileCardRow(row) {
  if (!row) return null;
  const ownerId = row.ownerId ?? row.owner_id ?? null;
  const avatarUrl = row.avatarUrl ?? row.avatar_url ?? "";
  const customColor = row.customColor ?? row.custom_color ?? "";
  const avatarFrameRaw = row.avatarFrame ?? row.avatar_frame ?? "";
  const emojiBackgroundPackRaw = row.emojiBackgroundPack ?? row.emoji_background_pack ?? "";
  const extraPhone = row.extraPhone ?? row.extra_phone ?? "";
  const createdAt = row.createdAt ?? row.created_at ?? null;
  const updatedAt = row.updatedAt ?? row.updated_at ?? null;
  const showBrandingRaw = row.showBranding ?? row.show_branding;
  const rawTheme = String(row.theme || "").trim();
  const normalizedTheme = rawTheme === "royal_ivory" ? "sage_luxe" : rawTheme;
  return {
    id: row.id,
    ownerId,
    name: row.name,
    role: row.role || "",
    bio: row.bio || "",
    hashtag: row.hashtag || "",
    address: row.address || "",
    postcode: row.postcode || "",
    email: row.email || "",
    extraPhone: extraPhone || "",
    avatarUrl: avatarUrl || "",
    tags: parseJsonArray(row.tags),
    buttons: parseJsonArray(row.buttons),
    theme: normalizedTheme || "default_dark",
    customColor: customColor || "",
    avatarFrame: (() => {
      const nextFrame = String(avatarFrameRaw || "").trim().toLowerCase();
      return PROFILE_AVATAR_FRAMES.has(nextFrame) ? nextFrame : "none";
    })(),
    emojiBackgroundPack: (() => {
      const nextPack = String(emojiBackgroundPackRaw || "").trim().toLowerCase();
      return PROFILE_EMOJI_BACKGROUNDS.has(nextPack) ? nextPack : "none";
    })(),
    showBranding: toBool(showBrandingRaw, true),
    pets: sortProfileCardPets(row.pets),
    createdAt,
    updatedAt,
  };
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

async function listPetRequestsAdmin(where = {}) {
  if (!prisma.petPurchaseRequest) {
    return [];
  }
  try {
    return await prisma.petPurchaseRequest.findMany({
      where,
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            username: true,
            telegramUsername: true,
            email: true,
            login: true,
            slugs: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 3,
              select: {
                fullSlug: true,
                isPrimary: true,
              },
            },
          },
        },
        profileCard: {
          select: {
            id: true,
            ownerId: true,
            name: true,
          },
        },
      },
    });
  } catch {
    return [];
  }
}

function mapAdminPetRequestRow(row) {
  if (!row) return null;
  const base = mapPetPurchaseRequest(row);
  if (!base) return null;
  const user = row.user && typeof row.user === "object" ? row.user : {};
  const slugs = Array.isArray(user.slugs) ? user.slugs : [];
  const primarySlug = slugs.find((item) => item?.isPrimary) || slugs[0] || null;
  return {
    ...base,
    user: {
      id: String(user.id || "").trim(),
      firstName: String(user.firstName || "").trim(),
      displayName: String(user.displayName || "").trim(),
      username: String(user.username || user.login || "").trim(),
      telegramUsername: String(user.telegramUsername || "").trim(),
      email: String(user.email || "").trim(),
    },
    slug: String(primarySlug?.fullSlug || "").trim(),
    profileCardId: row.profileCardId || row.profile_card_id || row.profileCard?.id || null,
    profileCardName: String(row.profileCard?.name || "").trim(),
    requestedAt: row.requestedAt ?? row.requested_at ?? null,
    reviewedAt: row.reviewedAt ?? row.reviewed_at ?? null,
  };
}

async function findProfileCardByOwnerId(ownerId) {
  if (!ownerId) return null;
  const rows = await prisma.$queryRaw`
    SELECT *
    FROM profile_cards
    WHERE owner_id = ${ownerId}
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return mapProfileCardRow(row);
}

function buildProfileCardColumnValues(input) {
  return {
    owner_id: input.ownerId,
    name: input.name,
    role: input.role,
    bio: input.bio,
    email: input.email,
    avatar_url: input.avatarUrl,
    tags: JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
    buttons: JSON.stringify(Array.isArray(input.buttons) ? input.buttons : []),
    theme: input.theme,
    custom_color: input.customColor,
    avatar_frame: input.avatarFrame,
    emoji_background_pack: input.emojiBackgroundPack,
    show_branding: Boolean(input.showBranding),
  };
}

function buildRawErrorText(error) {
  if (!error || typeof error !== "object") {
    return "";
  }
  const parts = [];
  const push = (value) => {
    if (value === undefined || value === null) return;
    const text = String(value);
    if (text.trim()) parts.push(text);
  };

  push(error.message);
  push(error.code);
  push(error?.meta?.message);
  push(error?.meta?.code);
  push(error?.meta?.dbErrorCode);
  push(error?.meta?.driverAdapterError?.message);
  push(error?.meta?.driverAdapterError?.cause?.message);

  try {
    push(JSON.stringify(error.meta || {}));
  } catch {
    // ignore non-serializable meta
  }

  return parts.join("\n");
}

async function getSupportedCardThemeEnumValues() {
  const now = Date.now();
  if (
    cardThemeEnumCache.values instanceof Set &&
    now - Number(cardThemeEnumCache.checkedAt || 0) < CARD_THEME_ENUM_CACHE_TTL_MS
  ) {
    return cardThemeEnumCache.values;
  }
  try {
    const rows = await prisma.$queryRaw`
      SELECT e.enumlabel::text AS value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE lower(t.typname::text) = 'cardtheme'
      ORDER BY e.enumsortorder
    `;
    const values = new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => String(row?.value || "").trim())
        .filter(Boolean),
    );
    cardThemeEnumCache = {
      checkedAt: now,
      values,
    };
    return values;
  } catch {
    return null;
  }
}

async function normalizeCardThemeForDatabase(theme) {
  const requested = String(theme || "default_dark").trim() || "default_dark";
  if (requested === "default_dark") {
    return requested;
  }
  if (!PROFILE_THEMES.has(requested)) {
    const customTheme = await findPublicThemeConfigByKey(requested);
    if (!customTheme) return "default_dark";
  }
  const supported = await getSupportedCardThemeEnumValues();
  if (!supported || supported.size === 0) {
    console.warn(
      `[express-app] failed to read CardTheme enum values; fallback "${requested}" -> "default_dark"`,
    );
    return "default_dark";
  }
  if (supported.has(requested)) {
    return requested;
  }
  if (requested === "sage_luxe" && supported.has("royal_ivory")) {
    return "royal_ivory";
  }
  if (await ensureCardThemeEnumValue(requested)) {
    return requested;
  }
  return "default_dark";
}

async function ensureCardThemeEnumValue(theme) {
  const requested = String(theme || "").trim();
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(requested)) {
    return false;
  }
  const escapedValue = requested.replace(/'/g, "''");
  const statements = [
    `ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS '${escapedValue}'`,
    `ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS '${escapedValue}'`,
  ];
  let addedOrExists = false;
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      addedOrExists = true;
    } catch (error) {
      const message = buildRawErrorText(error);
      if (!/does not exist|type .* does not exist/i.test(message)) {
        console.warn(`[express-app] failed to extend CardTheme enum with "${requested}"`, error);
      }
    }
  }
  if (addedOrExists) {
    cardThemeEnumCache = { checkedAt: 0, values: null };
    const refreshed = await getSupportedCardThemeEnumValues();
    return Boolean(refreshed?.has(requested));
  }
  return false;
}

function extractMissingColumnName(error) {
  const message = buildRawErrorText(error);
  if (!message) return null;
  const patterns = [
    /column\s+"?([a-z0-9_]+)"?\s+does not exist/i,
    /column\s+profile_cards\."?([a-z0-9_]+)"?\s+does not exist/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return String(match[1]).toLowerCase();
    }
  }
  return null;
}

function isCardThemeEnumValueError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const mergedMessage = buildRawErrorText(error);
  const enumInputFailure =
    code === "P2010" || code === "22P02" || /invalid input value for enum/i.test(mergedMessage);
  return enumInputFailure && /cardtheme/i.test(mergedMessage);
}

function isMissingColumnError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "");
  return code === "42703" || /column .* does not exist/i.test(message);
}

function isMissingStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "");
  const metaCode = String(error?.meta?.code || error?.meta?.dbErrorCode || "");
  return (
    code === "42P01" ||
    code === "42703" ||
    metaCode === "42P01" ||
    metaCode === "42703" ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}

async function upsertProfileCardCompat(db, input) {
  const requiredColumns = new Set(["owner_id", "name"]);
  const baseValues = buildProfileCardColumnValues(input);
  let enabledColumns = PROFILE_CARD_BASE_COLUMNS.filter((column) => {
    return requiredColumns.has(column) || baseValues[column] !== undefined;
  });
  let effectiveTheme = input.theme;

  for (let attempt = 0; attempt < PROFILE_CARD_BASE_COLUMNS.length + 4; attempt += 1) {
    const valuesMap = buildProfileCardColumnValues({
      ...input,
      theme: effectiveTheme,
    });
    const entries = enabledColumns.map((column) => [column, valuesMap[column]]);
    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = columns.map((column, index) => {
      const n = index + 1;
      if (column === "tags" || column === "buttons") {
        return `$${n}::jsonb`;
      }
      return `$${n}`;
    });
    const updates = columns
      .filter((column) => column !== "owner_id")
      .map((column) => `"${column}" = EXCLUDED."${column}"`);

    const query = `
      INSERT INTO profile_cards (${columns.map((column) => `"${column}"`).join(", ")})
      VALUES (${placeholders.join(", ")})
      ON CONFLICT (owner_id) DO UPDATE
        SET ${updates.join(", ")}
      RETURNING *
    `;

    try {
      const rows = await db.$queryRawUnsafe(query, ...values);
      const row = Array.isArray(rows) ? rows[0] || null : null;
      return mapProfileCardRow(row);
    } catch (error) {
      if (isCardThemeEnumValueError(error) && String(effectiveTheme || "") !== "default_dark" && columns.includes("theme")) {
        console.warn(
          `[express-app] unsupported CardTheme value "${String(effectiveTheme || "")}" in DB enum; fallback to default_dark`,
        );
        effectiveTheme = "default_dark";
        continue;
      }

      const missingColumn = extractMissingColumnName(error);
      if (missingColumn && enabledColumns.includes(missingColumn) && !requiredColumns.has(missingColumn)) {
        console.warn(`[express-app] profile_cards column "${missingColumn}" is missing; retrying without it`);
        enabledColumns = enabledColumns.filter((column) => column !== missingColumn);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to upsert profile card with available schema");
}

async function patchOptionalProfileCardFields(db, ownerId, fields) {
  const optionalColumns = {
    hashtag: fields.hashtag ?? null,
    address: fields.address ?? null,
    postcode: fields.postcode ?? null,
    extra_phone: fields.extraPhone ?? null,
  };

  for (const [column, value] of Object.entries(optionalColumns)) {
    try {
      await db.$executeRawUnsafe(`UPDATE profile_cards SET "${column}" = $1 WHERE owner_id = $2`, value, ownerId);
    } catch (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      throw error;
    }
  }
}

function parseProfileCardRow(row) {
  if (!row) {
    return null;
  }
  return mapProfileCardRow(row);
}

async function safeRecalculateScore(userId) {
  try {
    await recalculateAndRefreshPercentiles(userId);
  } catch (error) {
    console.error("[express-app] failed to recalculate score", error);
  }
}

function isPushStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  return code === "42P01" || code === "42703" || code === "P2021" || code === "P2022";
}

function parseJsonObject(value, fallback) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const raw = value.trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function normalizePushPriority(value) {
  const priority = String(value || "").trim().toLowerCase();
  return PUSH_PRIORITY_SET.has(priority) ? priority : "high";
}

function normalizePushSound(value) {
  const sound = String(value || "").trim().toLowerCase();
  return PUSH_SOUND_SET.has(sound) ? sound : "default";
}

function normalizePlanFilter(value) {
  const plan = String(value || "").trim().toLowerCase();
  if (plan === "basic") return "premium";
  return ["all", "none", "premium"].includes(plan) ? plan : "all";
}

function normalizeStatusFilter(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["all", "active", "blocked"].includes(status) ? status : "all";
}

async function insertInAppNotifications(userIds, title, body, data, type = "system") {
  const normalizedIds = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (!normalizedIds.length) {
    return 0;
  }

  const payload = JSON.stringify(data && typeof data === "object" ? data : {});
  let inserted = 0;

  for (let i = 0; i < normalizedIds.length; i += 200) {
    const chunk = normalizedIds.slice(i, i + 200);
    const values = chunk.map((userId) =>
      Prisma.sql`(${userId}, ${type}, ${title}, ${body}, ${payload})`,
    );

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO notifications (
          user_id,
          type,
          title,
          body,
          data
        )
        VALUES ${Prisma.join(values)}
      `,
    );
    inserted += chunk.length;
  }

  return inserted;
}

async function listBroadcastRecipientIds({ plan, status, onlyWithPushTokens, limit }) {
  let recipientRows = [];
  try {
    recipientRows = await prisma.$queryRaw`
      SELECT u.id
      FROM users u
      WHERE (${plan} = 'all' OR (
        CASE
          WHEN coalesce(u.plan, 'none') = 'basic' THEN 'premium'
          ELSE coalesce(u.plan, 'none')
        END
      ) = ${plan})
        AND (${status} = 'all' OR coalesce(u.status, 'active') = ${status})
        AND (${onlyWithPushTokens} = false OR EXISTS (
          SELECT 1
          FROM push_tokens pt
          WHERE pt.user_id = u.id
        ))
      ORDER BY u.created_at DESC
      LIMIT ${limit}
    `;
  } catch (error) {
    if (!isPushStorageError(error)) {
      throw error;
    }
    recipientRows = [];
  }

  return Array.from(
    new Set(
      (Array.isArray(recipientRows) ? recipientRows : [])
        .map((row) => String(row?.id || "").trim())
        .filter(Boolean),
    ),
  );
}

function trimBroadcastJobs() {
  const now = Date.now();
  for (const [jobId, job] of broadcastJobs.entries()) {
    const updatedAt = new Date(job?.updatedAt || job?.createdAt || 0).getTime();
    if (!Number.isFinite(updatedAt) || now - updatedAt > BROADCAST_JOB_TTL_MS) {
      broadcastJobs.delete(jobId);
    }
  }

  if (broadcastJobs.size <= BROADCAST_JOB_LIMIT) {
    return;
  }

  const oldJobs = Array.from(broadcastJobs.entries()).sort((a, b) => {
    const aTime = new Date(a?.[1]?.updatedAt || a?.[1]?.createdAt || 0).getTime();
    const bTime = new Date(b?.[1]?.updatedAt || b?.[1]?.createdAt || 0).getTime();
    return aTime - bTime;
  });

  while (broadcastJobs.size > BROADCAST_JOB_LIMIT && oldJobs.length) {
    const oldest = oldJobs.shift();
    if (!oldest) break;
    broadcastJobs.delete(oldest[0]);
  }
}

function makeBroadcastJob(payload) {
  trimBroadcastJobs();
  const jobId = `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  const job = {
    id: jobId,
    status: "queued",
    createdAt: nowIso,
    updatedAt: nowIso,
    startedAt: null,
    finishedAt: null,
    error: null,
    payload,
    progress: {
      totalRecipients: payload.recipientIds.length,
      processedRecipients: 0,
      chunksTotal: Math.max(1, Math.ceil(payload.recipientIds.length / BROADCAST_CHUNK_USERS)),
      chunksDone: 0,
      percent: payload.recipientIds.length ? 0 : 100,
      sent: 0,
      tokens: 0,
      cleaned: 0,
      inAppInserted: 0,
      usersReached: 0,
    },
  };
  broadcastJobs.set(jobId, job);
  return job;
}

function getBroadcastJobView(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    dryRun: Boolean(job.payload?.dryRun),
    filters: job.payload?.filters || null,
    error: job.error,
    progress: job.progress,
  };
}

async function runBroadcastJob(jobId) {
  const job = broadcastJobs.get(jobId);
  if (!job || job.status !== "queued") {
    return;
  }

  const nowIso = new Date().toISOString();
  job.status = "running";
  job.startedAt = nowIso;
  job.updatedAt = nowIso;

  try {
    if (job.payload.dryRun) {
      job.progress.percent = 100;
      job.status = "completed";
      job.finishedAt = new Date().toISOString();
      job.updatedAt = job.finishedAt;
      return;
    }

    const { recipientIds, title, body, data, sound, priority, includeInApp, respectNotifications } = job.payload;
    const total = recipientIds.length;
    const chunks = [];
    for (let i = 0; i < total; i += BROADCAST_CHUNK_USERS) {
      chunks.push(recipientIds.slice(i, i + BROADCAST_CHUNK_USERS));
    }

    if (!chunks.length) {
      job.progress.percent = 100;
      job.status = "completed";
      job.finishedAt = new Date().toISOString();
      job.updatedAt = job.finishedAt;
      return;
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const pushResult = await sendExpoPushToUsers({
        userIds: chunk,
        title,
        body,
        data,
        sound,
        priority,
        respectNotifications,
      });

      let inAppInsertedChunk = 0;
      if (includeInApp && chunk.length) {
        try {
          inAppInsertedChunk = await insertInAppNotifications(chunk, title, body, data, "system");
        } catch (error) {
          if (!isPushStorageError(error)) {
            throw error;
          }
        }
      }

      job.progress.processedRecipients += chunk.length;
      job.progress.chunksDone = index + 1;
      job.progress.percent = total
        ? Math.min(100, Math.round((job.progress.processedRecipients / total) * 100))
        : 100;
      job.progress.sent += Number(pushResult?.sent || 0);
      job.progress.tokens += Number(pushResult?.tokens || 0);
      job.progress.cleaned += Number(pushResult?.cleaned || 0);
      job.progress.inAppInserted += Number(inAppInsertedChunk || 0);
      job.progress.usersReached += Number(pushResult?.users || 0);
      job.updatedAt = new Date().toISOString();
    }

    job.progress.percent = 100;
    job.status = "completed";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
  } catch (error) {
    job.status = "failed";
    job.error = error?.message || String(error);
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
  }
}

function normalizeTariff(value) {
  return "premium";
}

function normalizeUserPlan(value) {
  if (value === "premium") return "premium";
  if (value === "basic") return "premium";
  return "none";
}

function buildAdminCardOwnerLabel(user) {
  const raw = [
    user?.displayName,
    user?.firstName,
    user?.username ? `@${user.username}` : "",
    user?.telegramUsername ? `@${user.telegramUsername}` : "",
    user?.email,
  ].find((value) => String(value || "").trim());
  return String(raw || "UNQX User").trim().slice(0, 120) || "UNQX User";
}

function isAdminCardActiveStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "active" || normalized === "private";
}

function getAdminCardSlugPriority(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") return 0;
  if (normalized === "private") return 1;
  if (normalized === "paused") return 2;
  if (normalized === "approved") return 3;
  if (normalized === "blocked") return 4;
  return 5;
}

function mapAdminCardSlugRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || "").trim(),
    fullSlug: String(row.fullSlug || row.full_slug || "").trim(),
    status: String(row.status || "").trim().toLowerCase(),
    isPrimary: Boolean(row.isPrimary ?? row.is_primary),
    viewsCount: Number(row.analyticsViewsCount ?? row.analytics_views_count ?? 0) || 0,
    createdAt: row.createdAt ?? row.created_at ?? null,
    activatedAt: row.activatedAt ?? row.activated_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  };
}

function pickAdminCardPreviewSlug(slugs) {
  const items = Array.isArray(slugs) ? slugs.map(mapAdminCardSlugRow).filter(Boolean) : [];
  if (!items.length) return null;
  const sorted = items.slice().sort((left, right) => {
    const primaryDelta = Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary));
    if (primaryDelta !== 0) {
      return primaryDelta;
    }
    const statusDelta = getAdminCardSlugPriority(left.status) - getAdminCardSlugPriority(right.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
  });
  return sorted[0] || null;
}

function mapAdminCardCompatRecord(record) {
  if (!record) return null;

  const owner = record.owner && typeof record.owner === "object" ? record.owner : {};
  const slugs = Array.isArray(owner.slugs) ? owner.slugs.map(mapAdminCardSlugRow).filter(Boolean) : [];
  const previewSlug = pickAdminCardPreviewSlug(slugs);
  const planSnapshot = getEffectivePlan(owner);
  const latestVerificationRequest = Array.isArray(owner.verificationRequests)
    ? owner.verificationRequests[0] || null
    : null;
  const card = parseProfileCardRow({
    id: record.id,
    ownerId: record.ownerId,
    name: record.name,
    role: record.role,
    bio: record.bio,
    hashtag: record.hashtag,
    address: record.address,
    postcode: record.postcode,
    email: record.email,
    extraPhone: record.extraPhone,
    avatarUrl: record.avatarUrl,
    tags: record.tags,
    buttons: record.buttons,
    theme: record.theme,
    customColor: record.customColor,
    avatarFrame: record.avatarFrame,
    emojiBackgroundPack: record.emojiBackgroundPack,
    showBranding: record.showBranding,
    pets: record.pets,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

  return {
    id: String(record.id || "").trim(),
    ownerId: String(record.ownerId || "").trim(),
    card,
    slugs,
    previewSlug,
    isActive: isAdminCardActiveStatus(previewSlug?.status),
    publicUrl: previewSlug?.fullSlug ? `/${encodeURIComponent(previewSlug.fullSlug)}` : "",
    tariff: planSnapshot.plan === "premium" ? "premium" : "legacy",
    owner: {
      id: String(owner.id || "").trim(),
      name: buildAdminCardOwnerLabel(owner),
      firstName: String(owner.firstName || "").trim(),
      displayName: String(owner.displayName || "").trim(),
      username: String(owner.username || "").trim(),
      telegramUsername: String(owner.telegramUsername || "").trim(),
      email: String(owner.email || "").trim(),
      city: String(owner.city || "").trim(),
      status: String(owner.status || "").trim().toLowerCase() || "active",
      plan: planSnapshot.plan === "premium" ? "premium" : "none",
      profileType: normalizeProfileType(owner.profileType, { fallback: "person" }),
      isVerified: Boolean(owner.isVerified),
      verifiedCompany: String(owner.verifiedCompany || "").trim(),
      createdAt: owner.createdAt || null,
      updatedAt: owner.updatedAt || null,
      planPurchasedAt: owner.planPurchasedAt || null,
      planUpgradedAt: owner.planUpgradedAt || null,
      subscriptionStartedAt: owner.subscriptionStartedAt || null,
      subscriptionRenewedAt: owner.subscriptionRenewedAt || null,
      subscriptionExpiresAt: owner.subscriptionExpiresAt || null,
    },
    verification: {
      isVerified: Boolean(owner.isVerified),
      verifiedCompany: String(owner.verifiedCompany || "").trim(),
      latestRequest: latestVerificationRequest
        ? {
          id: String(latestVerificationRequest.id || "").trim(),
          slug: String(latestVerificationRequest.slug || "").trim(),
          companyName: String(latestVerificationRequest.companyName || "").trim(),
          role: String(latestVerificationRequest.role || "").trim(),
          sector: String(latestVerificationRequest.sector || "").trim(),
          status: String(latestVerificationRequest.status || "").trim().toLowerCase(),
          adminNote: String(latestVerificationRequest.adminNote || "").trim(),
          requestedAt: latestVerificationRequest.requestedAt || null,
          reviewedAt: latestVerificationRequest.reviewedAt || null,
        }
        : null,
    },
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function buildAdminCardDetailResponse(record) {
  const mapped = mapAdminCardCompatRecord(record);
  if (!mapped) return null;
  return {
    ok: true,
    id: mapped.id,
    ownerId: mapped.ownerId,
    card: mapped.card,
    pets: mapped.card?.pets || [],
    owner: mapped.owner,
    slugs: mapped.slugs,
    previewSlug: mapped.previewSlug,
    publicUrl: mapped.publicUrl,
    isActive: mapped.isActive,
    tariff: mapped.tariff,
    verification: mapped.verification,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

async function findAdminCardCompatById(cardId) {
  if (!cardId || !prisma.profileCard) {
    return null;
  }

  const row = await prisma.profileCard.findUnique({
    where: { id: String(cardId || "").trim() },
    select: {
      id: true,
      ownerId: true,
      name: true,
      role: true,
      bio: true,
      hashtag: true,
      address: true,
      postcode: true,
      email: true,
      extraPhone: true,
      avatarUrl: true,
      tags: true,
      buttons: true,
      theme: true,
      customColor: true,
      avatarFrame: true,
      emojiBackgroundPack: true,
      showBranding: true,
      createdAt: true,
      updatedAt: true,
      pets: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          profileCardId: true,
          userId: true,
          petType: true,
          displayName: true,
          priceSnapshot: true,
          isVisible: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      owner: {
        select: {
          id: true,
          firstName: true,
          displayName: true,
          username: true,
          telegramUsername: true,
          email: true,
          city: true,
          profileType: true,
          plan: true,
          status: true,
          isVerified: true,
          verifiedCompany: true,
          createdAt: true,
          updatedAt: true,
          planPurchasedAt: true,
          planUpgradedAt: true,
          subscriptionStartedAt: true,
          subscriptionRenewedAt: true,
          subscriptionExpiresAt: true,
          slugs: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              fullSlug: true,
              status: true,
              isPrimary: true,
              analyticsViewsCount: true,
              createdAt: true,
              activatedAt: true,
              updatedAt: true,
            },
          },
          verificationRequests: {
            orderBy: { requestedAt: "desc" },
            take: 1,
            select: {
              id: true,
              slug: true,
              companyName: true,
              role: true,
              sector: true,
              status: true,
              adminNote: true,
              requestedAt: true,
              reviewedAt: true,
            },
          },
        },
      },
    },
  });

  return row || null;
}

function buildAdminCardsListWhere(query) {
  const search = String(query?.q || "").trim();
  const statusFilter = String(query?.status || "all").trim().toLowerCase();
  const and = [];

  if (search) {
    const or = [
      { name: { contains: search, mode: "insensitive" } },
      { owner: { firstName: { contains: search, mode: "insensitive" } } },
      { owner: { displayName: { contains: search, mode: "insensitive" } } },
      { owner: { username: { contains: search, mode: "insensitive" } } },
      { owner: { telegramUsername: { contains: search, mode: "insensitive" } } },
      { owner: { email: { contains: search, mode: "insensitive" } } },
      { owner: { slugs: { some: { fullSlug: { contains: search, mode: "insensitive" } } } } },
    ];
    if (isUuid(search)) {
      or.push({ id: search });
      or.push({ ownerId: search });
    }
    and.push({ OR: or });
  }

  if (statusFilter === "active") {
    and.push({ owner: { slugs: { some: { status: { in: ["active", "private"] } } } } });
  } else if (statusFilter === "inactive") {
    and.push({ NOT: { owner: { slugs: { some: { status: { in: ["active", "private"] } } } } } });
  }

  return and.length ? { AND: and } : {};
}

async function listAdminCardCompatRows(query) {
  if (!prisma.profileCard) {
    return {
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    };
  }

  const page = Math.max(1, parsePositiveInt(query?.page, 1) || 1);
  const pageSize = 20;
  const where = buildAdminCardsListWhere(query);

  const [total, rows] = await Promise.all([
    prisma.profileCard.count({ where }),
    prisma.profileCard.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        ownerId: true,
        name: true,
        role: true,
        bio: true,
        hashtag: true,
        address: true,
        postcode: true,
        email: true,
        extraPhone: true,
        avatarUrl: true,
        tags: true,
        buttons: true,
        theme: true,
        customColor: true,
        avatarFrame: true,
        showBranding: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            username: true,
            telegramUsername: true,
            email: true,
            city: true,
            profileType: true,
            plan: true,
            status: true,
            isVerified: true,
            verifiedCompany: true,
            createdAt: true,
            updatedAt: true,
            planPurchasedAt: true,
            planUpgradedAt: true,
            subscriptionStartedAt: true,
            subscriptionRenewedAt: true,
            subscriptionExpiresAt: true,
            slugs: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              select: {
                id: true,
                fullSlug: true,
                status: true,
                isPrimary: true,
                analyticsViewsCount: true,
                createdAt: true,
                activatedAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: (Array.isArray(rows) ? rows : [])
      .map(mapAdminCardCompatRecord)
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        ownerId: item.ownerId,
        slug: item.previewSlug?.fullSlug || "",
        name: item.card?.name || item.owner?.name || "UNQX User",
        tariff: item.tariff,
        isActive: item.isActive,
        viewsCount: Number(item.previewSlug?.viewsCount || 0),
        createdAt: item.createdAt,
        theme: item.card?.theme || "default_dark",
      })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function saveAdminCardCompatForOwner(ownerId, rawBody) {
  const user = await prisma.user.findUnique({
    where: { id: String(ownerId || "").trim() },
    select: {
      id: true,
      firstName: true,
      displayName: true,
      username: true,
      telegramUsername: true,
      email: true,
      verifiedCompany: true,
    },
  });

  if (!user) {
    return null;
  }

  const currentCard = await findProfileCardByOwnerId(user.id);
  const petCatalog = await getPetCatalog();
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};
  const name = normalizeDisplayName(body.name, currentCard?.name || buildAdminCardOwnerLabel(user));
  const role = String(body.role ?? currentCard?.role ?? "").trim().slice(0, 120) || null;
  const bio = String(body.bio ?? currentCard?.bio ?? "").trim().slice(0, 120) || null;
  const hashtag = String(body.hashtag ?? currentCard?.hashtag ?? "").trim().slice(0, 50) || null;
  const address = String(body.address ?? currentCard?.address ?? "").trim() || null;
  const postcode = String(body.postcode ?? currentCard?.postcode ?? "").trim().slice(0, 20) || null;
  const email = String(body.email ?? currentCard?.email ?? "").trim().slice(0, 100) || null;
  const extraPhone = String(body.extraPhone ?? currentCard?.extraPhone ?? "").trim().slice(0, 30) || null;
  const verifiedCompany = String(body.verifiedCompany ?? user.verifiedCompany ?? "").trim().slice(0, 160) || null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Invalid email");
    error.code = "INVALID_EMAIL";
    throw error;
  }

  const theme = normalizeThemeByPlan(body.theme ?? currentCard?.theme, "premium");
  const themeForDatabase = await normalizeCardThemeForDatabase(theme);
  const customColor = Object.prototype.hasOwnProperty.call(body, "customColor")
    ? normalizeColor(body.customColor)
    : normalizeColor(currentCard?.customColor);
  const avatarFrame = normalizeAvatarFrameByPlan(
    Object.prototype.hasOwnProperty.call(body, "avatarFrame") ? body.avatarFrame : currentCard?.avatarFrame,
    "premium",
  );
  const emojiBackgroundPack = normalizeEmojiBackgroundByPlan(
    Object.prototype.hasOwnProperty.call(body, "emojiBackgroundPack")
      ? body.emojiBackgroundPack
      : currentCard?.emojiBackgroundPack,
    "premium",
  );
  const showBranding = Object.prototype.hasOwnProperty.call(body, "showBranding")
    ? Boolean(body.showBranding)
    : currentCard?.showBranding !== false;
  const tags = normalizeTags(
    Object.prototype.hasOwnProperty.call(body, "tags") ? body.tags : currentCard?.tags,
    "premium",
  );
  const activeButtons = Array.isArray(body.buttons)
    ? body.buttons.filter((item) => !(item && typeof item === "object" && item.active === false))
    : currentCard?.buttons;
  const buttons = normalizeButtons(activeButtons, "premium");
  const petPatches = Array.isArray(body.pets)
    ? body.pets
      .map((item) => ({
        id: String(item?.id || "").trim(),
        petType: normalizePetType(item?.petType),
        displayName: normalizePetDisplayName(item?.displayName),
        isVisible: typeof item?.isVisible === "boolean" ? item.isVisible : null,
      }))
      .filter((item) => item.id || item.petType)
    : [];

  const savedCard = await prisma.$transaction(async (tx) => {
    if (verifiedCompany !== String(user.verifiedCompany || "").trim()) {
      await tx.user.update({
        where: { id: user.id },
        data: { verifiedCompany },
        select: { id: true },
      });
    }

    const saved = await upsertProfileCardCompat(tx, {
      ownerId: user.id,
      name,
      role,
      bio,
      hashtag,
      address,
      postcode,
      email,
      extraPhone,
      tags,
      buttons,
      theme: themeForDatabase,
      customColor,
      avatarFrame,
      emojiBackgroundPack,
      showBranding,
      avatarUrl: currentCard?.avatarUrl || null,
    });

    await patchOptionalProfileCardFields(tx, user.id, {
      hashtag,
      address,
      postcode,
      extraPhone,
    });

    if (petPatches.length && tx.profileCardPet) {
      const ownedPets = await tx.profileCardPet.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const ownedById = new Map(ownedPets.map((item) => [String(item.id), item]));
      const ownedByType = new Map(ownedPets.map((item) => [String(item.petType), item]));

      for (const patch of petPatches) {
        const existingById = patch.id ? ownedById.get(patch.id) : null;
        const existingByType = patch.petType ? ownedByType.get(patch.petType) : null;
        const existingPet = existingById || existingByType || null;

        if (existingPet) {
          await tx.profileCardPet.update({
            where: { id: existingPet.id },
            data: {
              displayName: resolvePetDisplayName(
                patch.displayName,
                patch.petType || existingPet.petType,
              ),
              isVisible: patch.isVisible == null ? existingPet.isVisible : Boolean(patch.isVisible),
              profileCardId: saved.id,
            },
          });
          continue;
        }

        if (!patch.petType) {
          continue;
        }

        await tx.profileCardPet.create({
          data: {
            profileCardId: saved.id,
            userId: user.id,
            petType: patch.petType,
            displayName: resolvePetDisplayName(patch.displayName, patch.petType),
            priceSnapshot: getPetPriceFromCatalog(petCatalog, patch.petType),
            isVisible: patch.isVisible == null ? true : Boolean(patch.isVisible),
          },
        });
      }
    }

    return saved;
  });

  await safeRecalculateScore(user.id);
  return findAdminCardCompatById(savedCard.id);
}

function ensureAdminCardsApiAccess(req, res) {
  if (isManagerSession(req)) {
    res.status(403).json({ error: "Forbidden", code: "MANAGER_FORBIDDEN" });
    return false;
  }
  if (!prisma.profileCard) {
    res.status(503).json({ error: "Cards storage unavailable", code: "CARDS_STORAGE_UNAVAILABLE" });
    return false;
  }
  return true;
}

function normalizeVerificationStatusInput(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (["verified", "verify", "active", "on", "1", "true", "yes", "да", "вкл", "включить"].includes(raw)) {
    return true;
  }
  if (["unverified", "off", "0", "false", "no", "нет", "выкл", "снять", "remove"].includes(raw)) {
    return false;
  }
  return null;
}

const MANUAL_ASSIGNABLE_BADGE_TYPES = ["unqx_staff", "government"];
const MANUAL_ASSIGNABLE_BADGE_TYPE_SET = new Set(MANUAL_ASSIGNABLE_BADGE_TYPES);
const MANUAL_BADGE_TYPES = new Set(["none", ...MANUAL_ASSIGNABLE_BADGE_TYPES]);

function normalizeManualBadgeTypeInput(value, fallback = "none") {
  const normalizedFallback = MANUAL_BADGE_TYPES.has(String(fallback || "").trim().toLowerCase())
    ? String(fallback || "").trim().toLowerCase()
    : "none";
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return normalizedFallback;
  return MANUAL_BADGE_TYPES.has(raw) ? raw : normalizedFallback;
}

function normalizeManualBadgeTypesInput(value, fallback = []) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const fallbackTypes = Array.isArray(fallback)
    ? fallback
    : [normalizeManualBadgeTypeInput(fallback, "none")];
  const normalizedFallback = fallbackTypes
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item, index, items) => MANUAL_ASSIGNABLE_BADGE_TYPE_SET.has(item) && items.indexOf(item) === index)
    .slice(0, 2);
  const normalized = source
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item, index, items) => MANUAL_ASSIGNABLE_BADGE_TYPE_SET.has(item) && items.indexOf(item) === index)
    .slice(0, 2);
  return normalized.length ? normalized : normalizedFallback;
}

function getPrimaryManualBadgeType(badgeTypes) {
  const types = Array.isArray(badgeTypes) ? badgeTypes : [];
  if (types.includes("government")) return "government";
  if (types.includes("unqx_staff")) return "unqx_staff";
  return "none";
}

function normalizeShortSlug(value) {
  return normalizeAssignableSlug(value);
}

function isShortSlug(value) {
  return isAssignableSlug(String(value || "").toUpperCase());
}

function getAssignableSlugValidationCode(value) {
  const slug = normalizeShortSlug(value);
  if (!slug) return "SLUG_REQUIRED";
  if (isReservedSlugPath(slug)) return "SLUG_RESERVED";
  if (!isAssignableSlug(slug)) return "SLUG_INVALID";
  return "";
}

function sendAssignableSlugValidationError(res, value, options = {}) {
  const prefix = options.prefix || "SLUG";
  const code = getAssignableSlugValidationCode(value);
  const responseCode = prefix === "SLUG" ? code : code.replace(/^SLUG_/, `${prefix}_`);
  const error =
    code === "SLUG_RESERVED"
      ? "Slug is reserved"
      : "Slug must be AAA000, 0-999, or A-Z up to 3 letters";
  res.status(400).json({ error, code: responseCode || `${prefix}_INVALID` });
}

async function getCalculatedShortSlugPrice(slug) {
  if (!isLegacySlug(slug)) return 0;
  const slugPricingConfig = await getSlugPricingConfig();
  const quote = calculateSlugPrice({
    letters: slug.slice(0, 3),
    digits: slug.slice(3),
    config: slugPricingConfig,
  });
  const numeric = Number(quote?.total || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(MAX_DB_INT, Math.round(numeric)));
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function pickWeightedSource() {
  const roll = Math.random();
  if (roll < 0.52) return "direct";
  if (roll < 0.74) return "share";
  if (roll < 0.9) return "qr";
  if (roll < 0.97) return "nfc";
  return "widget";
}

function pickRandomUserAgentForSource(source) {
  if (source === "nfc") {
    return Math.random() < 0.7
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  }
  const roll = Math.random();
  if (roll < 0.46) {
    return "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36";
  }
  if (roll < 0.7) {
    return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1";
  }
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
}

function pickSyntheticCity(preferredCity) {
  const cityPool = [
    "Tashkent",
    "Samarkand",
    "Bukhara",
    "Namangan",
    "Fergana",
    "Andijan",
    "Nukus",
    "Khiva",
    "Unknown",
  ];
  if (preferredCity && Math.random() < 0.2) {
    return preferredCity;
  }
  return cityPool[Math.floor(Math.random() * cityPool.length)] || "Unknown";
}

function buildSyntheticViewRows({ slug, count, periodDays, preferredCity }) {
  const rows = [];
  const nowMs = Date.now();
  const windowMs = Math.max(1, periodDays) * 24 * 60 * 60 * 1000;
  for (let index = 0; index < count; index += 1) {
    const source = pickWeightedSource();
    const userAgent = pickRandomUserAgentForSource(source);
    const skewedFactor = Math.pow(Math.random(), 1.85);
    const visitedAt = new Date(nowMs - Math.floor(windowMs * skewedFactor));
    rows.push({
      slug,
      visitedAt,
      source,
      city: pickSyntheticCity(preferredCity),
      device: detectDevice(userAgent),
      sessionId: randomUUID().replace(/-/g, ""),
      fingerprint: `synthetic:${randomUUID().replace(/-/g, "").slice(0, 54)}`,
    });
  }
  return rows;
}

function normalizeDirectorySector(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["design", "sales", "marketing", "it", "other"].includes(normalized) ? normalized : "other";
}

function modelDelegateExists(name) {
  const key = `${name.slice(0, 1).toLowerCase()}${name.slice(1)}`;
  return Boolean(prisma[key] && typeof prisma[key] === "object");
}

function isMissingModelError(error, modelName) {
  return Boolean(error) && error.code === "P2021" && String(error?.meta?.modelName || "") === modelName;
}

function ensureUsersStorageReady(res) {
  if (!modelDelegateExists("User")) {
    res.status(503).json({ error: "Users storage unavailable", code: "USERS_STORAGE_UNAVAILABLE" });
    return false;
  }
  return true;
}

function isManagerSession(req) {
  return String(req.session?.admin?.role || "admin") === "manager";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

async function resolveManagerId(req) {
  if (!isManagerSession(req)) {
    return "";
  }

  const directId = String(req.session?.admin?.id || "").trim();
  if (directId && isUuid(directId)) {
    try {
      const managerById = await prisma.staffUser.findFirst({
        where: {
          id: directId,
          role: "manager",
        },
        select: { id: true },
      });
      if (String(managerById?.id || "").trim()) {
        return directId;
      }
    } catch {
      // ignore and fallback to resolving by login below
    }
  }

  const sessionLogin = normalizeLogin(req.session?.admin?.login);
  if (!sessionLogin) {
    return "";
  }

  try {
    const manager = await prisma.staffUser.findFirst({
      where: {
        login: sessionLogin,
        role: "manager",
      },
      select: { id: true },
    });
    const resolvedId = String(manager?.id || "").trim();
    if (resolvedId && req.session?.admin) {
      req.session.admin.id = resolvedId;
    }
    return resolvedId;
  } catch {
    return "";
  }
}

async function getManagerScope(req) {
  if (!isManagerSession(req)) {
    return {
      isManager: false,
      managerId: "",
      hasCreatorColumn: true,
    };
  }

  const managerId = await resolveManagerId(req);
  const userColumns = await getUserColumns();
  const hasCreatorColumn = hasUserColumn(userColumns, "createdByStaffId");
  return {
    isManager: true,
    managerId,
    hasCreatorColumn,
  };
}

function isManagerScopeBlocked(scope) {
  return Boolean(scope?.isManager) && (!scope.managerId || !scope.hasCreatorColumn);
}

function andWhere(baseWhere, extraWhere) {
  if (!extraWhere) return baseWhere || {};
  if (!baseWhere || Object.keys(baseWhere).length === 0) {
    return extraWhere;
  }
  return {
    AND: [baseWhere, extraWhere],
  };
}

async function managerOwnsUser(req, userId) {
  const scope = await getManagerScope(req);
  if (!scope.isManager) {
    return true;
  }
  if (isManagerScopeBlocked(scope)) {
    return false;
  }
  const row = await prisma.user.findFirst({
    where: {
      id: String(userId || "").trim(),
      createdByStaffId: scope.managerId,
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function managerOwnsOrder(req, orderId) {
  const scope = await getManagerScope(req);
  if (!scope.isManager) {
    return true;
  }
  if (isManagerScopeBlocked(scope)) {
    return false;
  }
  const row = await prisma.slugRequest.findFirst({
    where: {
      id: String(orderId || "").trim(),
      user: {
        createdByStaffId: scope.managerId,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function managerOwnsVerificationRequest(req, verificationRequestId) {
  const scope = await getManagerScope(req);
  if (!scope.isManager) {
    return true;
  }
  if (isManagerScopeBlocked(scope)) {
    return false;
  }
  const row = await prisma.verificationRequest.findFirst({
    where: {
      id: String(verificationRequestId || "").trim(),
      user: {
        createdByStaffId: scope.managerId,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function managerOwnsPetRequest(req, petRequestId) {
  const scope = await getManagerScope(req);
  if (!scope.isManager) {
    return true;
  }
  if (isManagerScopeBlocked(scope)) {
    return false;
  }
  const row = await prisma.petPurchaseRequest.findFirst({
    where: {
      id: String(petRequestId || "").trim(),
      user: {
        createdByStaffId: scope.managerId,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

function isPaymentCardsStorageError(error) {
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

function normalizePaymentCardPublicSlug(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^\/+payment\/+/i, "")
    .replace(/^\/+/, "")
    .toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "payment";
}

function normalizePaymentCardMethods(rawMethods) {
  const source = Array.isArray(rawMethods) ? rawMethods : [];
  const out = [];
  for (const item of source) {
    if (out.length >= 12) break;
    const obj = item && typeof item === "object" ? item : {};
    const label = String(obj.label || "").trim().slice(0, 80);
    const value = String(obj.value || obj.requisite || obj.href || "").trim().slice(0, 240);
    const note = String(obj.note || "").trim().slice(0, 240);
    if (!label && !value && !note) continue;
    out.push({
      id: String(obj.id || `${Date.now()}_${Math.random()}`).slice(0, 60),
      type: String(obj.type || "other").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) || "other",
      label: label || "Реквизит",
      value,
      note,
      isActive: obj.isActive === false ? false : true,
    });
  }
  return out;
}

function mapPaymentCardRow(row) {
  if (!row) return null;
  const methodsRaw = row.methods_json ?? row.methods ?? [];
  return {
    id: String(row.id || ""),
    ownerId: String(row.owner_id || row.ownerId || ""),
    publicSlug: String(row.public_slug || row.publicSlug || ""),
    title: String(row.title || ""),
    address: String(row.address || ""),
    postcode: String(row.postcode || ""),
    methods: parseJsonArray(methodsRaw),
    isPublished: toBool(row.is_published ?? row.isPublished, true),
    createdByStaffId: row.created_by_staff_id || row.createdByStaffId || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    user: {
      id: String(row.owner_id || row.ownerId || ""),
      name: String(row.user_display_name || row.user_first_name || row.profile_name || "UNQX User"),
      firstName: String(row.user_first_name || ""),
      displayName: String(row.user_display_name || ""),
      username: row.user_username || row.user_telegram_username || null,
      email: row.user_email || null,
      city: row.user_city || "",
      profileType: row.user_profile_type || "person",
      createdByStaffId: row.user_created_by_staff_id || null,
    },
    profile: {
      hasCard: Boolean(row.profile_card_id),
      name: String(row.profile_name || row.user_display_name || row.user_first_name || "UNQX User"),
      role: String(row.profile_role || ""),
      bio: String(row.profile_bio || ""),
      hashtag: String(row.profile_hashtag || ""),
      email: String(row.profile_email || row.user_email || ""),
      extraPhone: String(row.profile_extra_phone || ""),
      avatarUrl: String(row.profile_avatar_url || ""),
      tags: parseJsonArray(row.profile_tags_json ?? row.profile_tags ?? []),
      theme: String(row.profile_theme || "default_dark"),
      customColor: String(row.profile_custom_color || ""),
    },
    publicUrl: `/payment/${encodeURIComponent(String(row.public_slug || row.publicSlug || ""))}`,
  };
}

async function findPaymentCardById(paymentCardId) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        pc.*,
        pc.methods AS methods_json,
        u.first_name AS user_first_name,
        u.display_name AS user_display_name,
        u.username AS user_username,
        u.telegram_username AS user_telegram_username,
        u.email AS user_email,
        u.city AS user_city,
        u.profile_type AS user_profile_type,
        u.created_by_staff_id AS user_created_by_staff_id,
        pr.id AS profile_card_id,
        pr.name AS profile_name,
        pr.role AS profile_role,
        pr.bio AS profile_bio,
        pr.hashtag AS profile_hashtag,
        pr.email AS profile_email,
        pr.extra_phone AS profile_extra_phone,
        pr.avatar_url AS profile_avatar_url,
        pr.tags AS profile_tags_json,
        pr.theme AS profile_theme,
        pr.custom_color AS profile_custom_color
      FROM payment_cards pc
      JOIN users u ON u.id = pc.owner_id
      LEFT JOIN profile_cards pr ON pr.owner_id = u.id
      WHERE pc.id = $1
      LIMIT 1
    `,
    String(paymentCardId || "").trim(),
  );
  return mapPaymentCardRow(Array.isArray(rows) ? rows[0] || null : null);
}

async function findPaymentCardOwnerId(paymentCardId) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT owner_id FROM payment_cards WHERE id = $1 LIMIT 1",
    String(paymentCardId || "").trim(),
  );
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return row ? String(row.owner_id || "") : "";
}

async function getPaymentCardUserPreview(userId) {
  if (!userId) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        u.id AS owner_id,
        u.first_name AS user_first_name,
        u.display_name AS user_display_name,
        u.username AS user_username,
        u.telegram_username AS user_telegram_username,
        u.email AS user_email,
        u.city AS user_city,
        u.profile_type AS user_profile_type,
        u.created_by_staff_id AS user_created_by_staff_id,
        pr.id AS profile_card_id,
        pr.name AS profile_name,
        pr.role AS profile_role,
        pr.bio AS profile_bio,
        pr.hashtag AS profile_hashtag,
        pr.email AS profile_email,
        pr.extra_phone AS profile_extra_phone,
        pr.avatar_url AS profile_avatar_url,
        pr.tags AS profile_tags_json,
        pr.theme AS profile_theme,
        pr.custom_color AS profile_custom_color
      FROM users u
      LEFT JOIN profile_cards pr ON pr.owner_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    String(userId || "").trim(),
  );
  const row = Array.isArray(rows) ? rows[0] || null : null;
  if (!row) return null;
  const mapped = mapPaymentCardRow({
    ...row,
    id: "",
    owner_id: row.owner_id,
    public_slug: "",
    title: "",
    address: "",
    postcode: "",
    methods_json: [],
    is_published: true,
  });
  return mapped ? { user: mapped.user, profile: mapped.profile } : null;
}

async function ensureUniquePaymentCardSlug(baseSlug, excludeId = "") {
  const base = normalizePaymentCardPublicSlug(baseSlug);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 74)}-${attempt + 1}`;
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT id
        FROM payment_cards
        WHERE public_slug = $1
          AND ($2::uuid IS NULL OR id <> $2::uuid)
        LIMIT 1
      `,
      candidate,
      excludeId && isUuid(excludeId) ? excludeId : null,
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return candidate;
    }
  }
  return `${base.slice(0, 62)}-${randomUUID().slice(0, 8)}`;
}

function toOrderStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  switch (normalized) {
    case "new":
      return "new";
    case "contacted":
      return "contacted";
    case "paid":
      return "paid";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    default:
      return "new";
  }
}

function toSlugState(value, mode = "filter") {
  if (value === "blocked") {
    return "BLOCKED";
  }
  if (value === "taken") {
    return "TAKEN";
  }
  if (value === "free") {
    return "FREE";
  }
  return mode === "action" ? "FREE" : "ALL";
}

function toDeliveryStatus(value) {
  switch (value) {
    case "SHIPPED":
    case "DELIVERED":
      return value;
    default:
      return "ORDERED";
  }
}

function formatOrderStatusLabel(status) {
  switch (status) {
    case "new":
      return "Новая";
    case "contacted":
      return "Связались";
    case "paid":
      return "Оплачено";
    case "approved":
      return "Активировано";
    case "rejected":
      return "Отклонено";
    case "expired":
      return "Отклонено";
    default:
      return status;
  }
}

function orderStatusEventTitle(status) {
  switch (status) {
    case "new":
      return "Новая заявка";
    case "paid":
      return "Оплата подтверждена";
    case "approved":
      return "Заявка активирована";
    case "rejected":
      return "Заявка отклонена";
    case "contacted":
      return "Связались по заявке";
    case "expired":
      return "Заявка истекла";
    default:
      return "Обновление заявки";
  }
}

function computeDateRangeKey(timezone, days) {
  const nowInZone = toZonedTime(new Date(), timezone);
  const end = startOfDay(nowInZone);
  const start = subDays(end, days - 1);
  const keys = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(format(addDays(start, i), "yyyy-MM-dd"));
  }
  return {
    keys,
    startUtc: fromZonedTime(start, timezone),
  };
}

function encodeBlockedPauseMessage(previousStatus, originalPauseMessage) {
  const prev = String(previousStatus || "paused").toLowerCase();
  const safePrev = ["approved", "active", "paused", "private"].includes(prev) ? prev : "paused";
  const base = String(originalPauseMessage || "").trim();
  return base
    ? `[blocked_prev:${safePrev}] ${base}`
    : `[blocked_prev:${safePrev}]`;
}

function parseBlockedPauseMessage(value) {
  const raw = String(value || "");
  const match = raw.match(/^\[blocked_prev:(approved|active|paused|private)\]\s*/i);
  if (!match) {
    return null;
  }
  const previousStatus = String(match[1] || "paused").toLowerCase();
  const pauseMessage = raw.replace(match[0], "").trim();
  return {
    previousStatus,
    pauseMessage: pauseMessage || null,
  };
}

function isTableOrColumnMissing(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  if (code === "42P01" || code === "42703" || code === "P2021" || code === "P2022") {
    return true;
  }

  if (code !== "P2010") {
    return false;
  }

  const meta = error.meta && typeof error.meta === "object" ? error.meta : {};
  const adapterError = meta.driverAdapterError && typeof meta.driverAdapterError === "object"
    ? meta.driverAdapterError
    : {};
  const adapterCause = adapterError.cause && typeof adapterError.cause === "object"
    ? adapterError.cause
    : {};

  const nestedCode = String(
    meta.code ||
    meta.dbErrorCode ||
    adapterError.code ||
    adapterCause.code ||
    "",
  );
  if (nestedCode === "42P01" || nestedCode === "42703") {
    return true;
  }

  const message = [
    String(error.message || ""),
    String(meta.message || ""),
    String(meta.dbErrorMessage || ""),
    String(adapterError.message || ""),
    String(adapterCause.message || ""),
  ]
    .join(" ")
    .toLowerCase();

  return (
    message.includes("does not exist") &&
    (message.includes("relation") ||
      message.includes("column") ||
      message.includes("tabledoesnotexist") ||
      message.includes("columndoesnotexist"))
  );
}

async function safeExecuteRaw(sql, ...params) {
  try {
    return await prisma.$executeRawUnsafe(sql, ...params);
  } catch (error) {
    if (isTableOrColumnMissing(error)) {
      return 0;
    }
    throw error;
  }
}

router.use(adminApiRateLimit);
router.use(requireStaffApi);
router.use(requireSameOrigin);
router.use(requireCsrfToken);

const MANAGER_ALLOWED_ROUTES = [
  { method: "GET", re: /^\/navigation-summary\/?$/ },
  { method: "GET", re: /^\/payment-cards\/?$/ },
  { method: "POST", re: /^\/users\/[^/]+\/payment-cards\/?$/ },
  { method: "PATCH", re: /^\/payment-cards\/[^/]+\/?$/ },
  { method: "DELETE", re: /^\/payment-cards\/[^/]+\/?$/ },
  { method: "GET", re: /^\/users\/?$/ },
  { method: "GET", re: /^\/users\/check\/?$/ },
  { method: "GET", re: /^\/slugs\/availability\/check\/?$/ },
  { method: "POST", re: /^\/users\/?$/ },
  { method: "GET", re: /^\/users\/[^/]+\/card\/?$/ },
  { method: "PUT", re: /^\/users\/[^/]+\/card\/?$/ },
  { method: "POST", re: /^\/users\/[^/]+\/card\/avatar\/?$/ },
  { method: "DELETE", re: /^\/users\/[^/]+\/card\/avatar\/?$/ },
  { method: "PATCH", re: /^\/users\/[^/]+\/profile\/?$/ },
  { method: "PATCH", re: /^\/users\/[^/]+\/verification\/?$/ },
  { method: "PATCH", re: /^\/users\/[^/]+\/badge\/?$/ },
  { method: "GET", re: /^\/orders\/?$/ },
  { method: "PATCH", re: /^\/orders\/[^/]+\/status\/?$/ },
  { method: "POST", re: /^\/orders\/[^/]+\/extend-pending\/?$/ },
  { method: "GET", re: /^\/orders\/export\.csv\/?$/ },
  { method: "GET", re: /^\/verification-requests\/?$/ },
  { method: "POST", re: /^\/verification-requests\/[^/]+\/approve\/?$/ },
  { method: "POST", re: /^\/verification-requests\/[^/]+\/reject\/?$/ },
  { method: "POST", re: /^\/verification-requests\/[^/]+\/revoke\/?$/ },
  { method: "GET", re: /^\/pet-requests\/?$/ },
  { method: "POST", re: /^\/pet-requests\/[^/]+\/approve\/?$/ },
  { method: "POST", re: /^\/pet-requests\/[^/]+\/reject\/?$/ },
  { method: "GET", re: /^\/badge-applications\/?$/ },
  { method: "POST", re: /^\/badge-applications\/[^/]+\/approve\/?$/ },
  { method: "POST", re: /^\/badge-applications\/[^/]+\/reject\/?$/ },
  { method: "POST", re: /^\/badge-applications\/[^/]+\/revoke\/?$/ },
  { method: "GET", re: /^\/users\/[^/]+\/payment-cards\/?$/ },
  { method: "POST", re: /^\/users\/[^/]+\/payment-cards\/?$/ },
  { method: "PUT", re: /^\/payment-cards\/[^/]+\/?$/ },
  { method: "DELETE", re: /^\/payment-cards\/[^/]+\/?$/ },
  { method: "POST", re: /^\/payment-cards\/[^/]+\/avatar\/?$/ },
  { method: "DELETE", re: /^\/payment-cards\/[^/]+\/avatar\/?$/ },
];

router.use((req, res, next) => {
  const role = String(req.session?.admin?.role || "admin");
  if (role !== "manager") {
    next();
    return;
  }
  const method = String(req.method || "GET").toUpperCase();
  const path = String(req.path || "");
  const allowed = MANAGER_ALLOWED_ROUTES.some((rule) => rule.method === method && rule.re.test(path));
  if (!allowed) {
    res.status(403).json({ error: "Forbidden", code: "MANAGER_FORBIDDEN" });
    return;
  }
  next();
});

router.get(
  "/auctions",
  asyncHandler(async (_req, res) => {
    const items = await listAdminAuctions();
    res.json({ items, auctions: items });
  }),
);

router.post(
  "/auctions",
  asyncHandler(async (req, res) => {
    try {
      const item = await createAuction(req.body || {}, req.session?.admin || null);
      res.status(201).json({ ok: true, item });
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: error?.message || "Не удалось создать аукцион.",
      });
    }
  }),
);

router.post(
  "/auctions/:auctionId/finish",
  asyncHandler(async (req, res) => {
    const item = await finishAuction(req.params.auctionId);
    res.json({ ok: true, item });
  }),
);

router.post(
  "/auction-bids/:bidId/ban",
  asyncHandler(async (req, res) => {
    const item = await banBid(req.params.bidId, req.body?.note || "Banned from admin");
    res.json({ ok: true, item });
  }),
);

router.get(
  "/advertisements",
  asyncHandler(async (req, res) => {
    const items = await listAdvertisements({ limit: 100, placement: req.query?.placement });
    res.json({ items, advertisements: items });
  }),
);

router.post(
  "/advertisements",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file || req.file.mimetype !== "image/png") {
      res.status(400).json({ error: "Загрузите PNG-файл.", code: "PNG_REQUIRED" });
      return;
    }
    let imageUrl = "";
    try {
      imageUrl = await saveAdvertisementPng(req.file.buffer);
      const item = await createAdvertisement({
        imageUrl,
        targetUrl: req.body?.targetUrl,
        positionIndex: req.body?.positionIndex,
        placement: req.body?.placement,
      });
      res.status(201).json({ ok: true, item });
    } catch (error) {
      if (imageUrl) {
        await deleteAdvertisementImage(imageUrl);
      }
      const status = Number(error?.status || 500);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: error?.message || "Не удалось создать баннер.",
      });
    }
  }),
);

router.delete(
  "/advertisements/:id",
  asyncHandler(async (req, res) => {
    const item = await deleteAdvertisement(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Баннер не найден." });
      return;
    }
    res.json({ ok: true, item });
  }),
);

router.get(
  "/themes",
  asyncHandler(async (_req, res) => {
    const items = await listThemeConfigs({ limit: 500 });
    res.json({ items, themes: items });
  }),
);

router.post(
  "/themes",
  asyncHandler(async (req, res) => {
    try {
      const item = await upsertThemeConfig(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (error) {
      const status = Number(error?.status || 500);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: error?.message || "Не удалось сохранить тему.",
      });
    }
  }),
);

router.delete(
  "/themes/:id",
  asyncHandler(async (req, res) => {
    const item = await deleteThemeConfig(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Тема не найдена." });
      return;
    }
    res.json({ ok: true, item });
  }),
);

router.get(
  "/event-cards",
  asyncHandler(async (_req, res) => {
    const items = await listEventCardReleases({ limit: 100 });
    res.json({ items, eventCards: items });
  }),
);

router.post(
  "/event-cards",
  eventCardUpload.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const frontFile = Array.isArray(req.files?.frontImage) ? req.files.frontImage[0] : null;
    const backFile = Array.isArray(req.files?.backImage) ? req.files.backImage[0] : null;
    if (!frontFile || !backFile || !ALLOWED_MIME.has(frontFile.mimetype) || !ALLOWED_MIME.has(backFile.mimetype)) {
      res.status(400).json({ error: "Загрузите две картинки PNG, JPG или WebP.", code: "EVENT_CARD_IMAGES_REQUIRED" });
      return;
    }

    let imageFrontUrl = "";
    let imageBackUrl = "";
    try {
      imageFrontUrl = await saveEventCardImage(frontFile.buffer, "front");
      imageBackUrl = await saveEventCardImage(backFile.buffer, "back");
      const item = await createEventCardRelease({
        title: req.body?.title,
        description: req.body?.description,
        imageFrontUrl,
        imageBackUrl,
      });
      res.status(201).json({ ok: true, item });
    } catch (error) {
      await Promise.all([
        imageFrontUrl ? deleteEventCardImage(imageFrontUrl) : Promise.resolve(),
        imageBackUrl ? deleteEventCardImage(imageBackUrl) : Promise.resolve(),
      ]);
      const status = Number(error?.status || 500);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: error?.message || "Не удалось опубликовать карту.",
      });
    }
  }),
);

router.delete(
  "/event-cards/:id",
  asyncHandler(async (req, res) => {
    const item = await deleteEventCardRelease(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Публикация не найдена." });
      return;
    }
    res.json({ ok: true, item });
  }),
);

router.get(
  "/tracks",
  asyncHandler(async (_req, res) => {
    const items = await listTracks({ limit: 500 });
    res.json({ items, tracks: items });
  }),
);

router.post(
  "/tracks",
  trackUpload.single("file"),
  asyncHandler(async (req, res) => {
    const fileName = String(req.file?.originalname || "").toLowerCase();
    const mimeType = String(req.file?.mimetype || "").toLowerCase();
    const isMp3 = Boolean(req.file) && (fileName.endsWith(".mp3") || mimeType === "audio/mpeg" || mimeType === "audio/mp3");
    if (!isMp3) {
      res.status(400).json({ error: "Загрузите MP3-файл.", code: "MP3_REQUIRED" });
      return;
    }
    let audioUrl = "";
    try {
      audioUrl = await saveTrackMp3(req.file.buffer);
      const item = await createTrack({
        title: req.body?.title,
        audioUrl,
      });
      res.status(201).json({ ok: true, item });
    } catch (error) {
      if (audioUrl) {
        await deleteTrackFile(audioUrl);
      }
      const status = Number(error?.status || 500);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: error?.message || "Не удалось добавить трек.",
      });
    }
  }),
);

router.delete(
  "/tracks/:id",
  asyncHandler(async (req, res) => {
    const item = await deleteTrack(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Трек не найден." });
      return;
    }
    res.json({ ok: true, item });
  }),
);

router.get(
  "/navigation-summary",
  asyncHandler(async (req, res) => {
    const managerScope = await getManagerScope(req);
    if (isManagerScopeBlocked(managerScope)) {
      res.json({
        badges: {
          orders: 0,
          pets: 0,
        },
        events: [],
      });
      return;
    }
    const isScopedManager = managerScope.isManager && !isManagerScopeBlocked(managerScope);
    const managerOrdersWhere = isScopedManager
      ? { user: { createdByStaffId: managerScope.managerId } }
      : null;
    const managerOrderHref = "/manager/dashboard?tab=orders";
    const adminOrderHref = "/admin/dashboard?tab=orders";
    const managerPetsHref = "/manager/dashboard?tab=pets";
    const adminPetsHref = "/admin/dashboard?tab=pets";

    const petEventTitle = (item) => {
      const status = String(item?.status || "").trim().toLowerCase();
      const petLabel = getPetTypeLabel(item?.petType);
      if (status === "approved") {
        return `${petLabel} выдан`;
      }
      if (status === "rejected") {
        return `${petLabel} отклонен`;
      }
      return `Новая заявка: ${petLabel}`;
    };

    const [newOrdersCount, pendingPetsCount, orderEvents, petEvents] = await Promise.all([
      prisma.slugRequest.count({
        where: andWhere({ status: "new" }, managerOrdersWhere),
      }),
      prisma.petPurchaseRequest
        ? prisma.petPurchaseRequest.count({
          where: andWhere(
            { status: "pending" },
            isScopedManager ? { user: { createdByStaffId: managerScope.managerId } } : null,
          ),
        })
        : Promise.resolve(0),
      prisma.slugRequest.findMany({
        where: managerOrdersWhere || undefined,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.petPurchaseRequest
        ? prisma.petPurchaseRequest.findMany({
          where: isScopedManager ? { user: { createdByStaffId: managerScope.managerId } } : undefined,
          orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            id: true,
            petType: true,
            status: true,
            displayName: true,
            requestedAt: true,
            reviewedAt: true,
          },
        })
        : Promise.resolve([]),
    ]);

    const mergedEvents = [
      ...orderEvents.map((item) => ({
        id: `order:${item.id}`,
        title: orderStatusEventTitle(item.status),
        slug: item.slug,
        at: item.updatedAt,
        href: isScopedManager ? managerOrderHref : adminOrderHref,
      })),
      ...petEvents.map((item) => ({
        id: `pet:${item.id}`,
        title: petEventTitle(item),
        slug: item.displayName || getPetTypeLabel(item.petType),
        at: item.reviewedAt || item.requestedAt,
        href: isScopedManager ? managerPetsHref : adminPetsHref,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);

    res.json({
      badges: {
        orders: newOrdersCount,
        pets: pendingPetsCount,
      },
      events: mergedEvents,
    });
  }),
);

router.get(
  "/payment-cards",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(100, pageSizeRaw));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    const scope = await getManagerScope(req);

    if (scope.isManager && isManagerScopeBlocked(scope)) {
      res.json({
        items: [],
        selected: null,
        pagination: { page, pageSize, total: 0, totalPages: 1 },
      });
      return;
    }

    if (scope.isManager && userId && !(await managerOwnsUser(req, userId))) {
      res.status(403).json({ error: "Forbidden", code: "MANAGER_FORBIDDEN" });
      return;
    }

    const where = [];
    const params = [];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (scope.isManager) {
      where.push(`u.created_by_staff_id = ${addParam(scope.managerId)}::uuid`);
    }
    if (userId) {
      where.push(`pc.owner_id = ${addParam(userId)}::uuid`);
    }
    if (q) {
      const needle = `%${q}%`;
      const p = addParam(needle);
      where.push(`(
        pc.title ILIKE ${p}
        OR pc.public_slug ILIKE ${p}
        OR u.first_name ILIKE ${p}
        OR COALESCE(u.display_name, '') ILIKE ${p}
        OR COALESCE(u.login, '') ILIKE ${p}
        OR COALESCE(u.telegram_username, '') ILIKE ${p}
        OR COALESCE(pr.name, '') ILIKE ${p}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;
    try {
      const countRows = await prisma.$queryRawUnsafe(
        `
          SELECT COUNT(*)::int AS total
          FROM payment_cards pc
          JOIN users u ON u.id = pc.owner_id
          LEFT JOIN profile_cards pr ON pr.owner_id = u.id
          ${whereSql}
        `,
        ...params,
      );
      const total = Number(Array.isArray(countRows) ? countRows[0]?.total || 0 : 0);
      const rows = await prisma.$queryRawUnsafe(
        `
          SELECT
            pc.*,
            pc.methods AS methods_json,
            u.first_name AS user_first_name,
            u.display_name AS user_display_name,
            u.username AS user_username,
            u.telegram_username AS user_telegram_username,
            u.email AS user_email,
            u.city AS user_city,
            u.profile_type AS user_profile_type,
            u.created_by_staff_id AS user_created_by_staff_id,
            pr.id AS profile_card_id,
            pr.name AS profile_name,
            pr.role AS profile_role,
            pr.bio AS profile_bio,
            pr.hashtag AS profile_hashtag,
            pr.email AS profile_email,
            pr.extra_phone AS profile_extra_phone,
            pr.avatar_url AS profile_avatar_url,
            pr.tags AS profile_tags_json,
            pr.theme AS profile_theme,
            pr.custom_color AS profile_custom_color
          FROM payment_cards pc
          JOIN users u ON u.id = pc.owner_id
          LEFT JOIN profile_cards pr ON pr.owner_id = u.id
          ${whereSql}
          ORDER BY pc.updated_at DESC, pc.created_at DESC
          LIMIT ${addParam(pageSize)} OFFSET ${addParam(offset)}
        `,
        ...params,
      );
      const selected = userId ? await getPaymentCardUserPreview(userId) : null;
      res.json({
        items: (Array.isArray(rows) ? rows : []).map(mapPaymentCardRow).filter(Boolean),
        selected,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    } catch (error) {
      if (isPaymentCardsStorageError(error)) {
        res.json({
          items: [],
          selected: null,
          pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
        });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/users/:userId/payment-cards",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId || !(await managerOwnsUser(req, userId))) {
      res.status(403).json({ error: "Forbidden", code: "MANAGER_FORBIDDEN" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, displayName: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const title = String(req.body?.title || "").trim().slice(0, 140) || "Payment card";
    const requestedSlug = String(req.body?.publicSlug || req.body?.slug || title || user.displayName || user.firstName || "payment");
    const publicSlug = await ensureUniquePaymentCardSlug(requestedSlug);
    const address = String(req.body?.address || "").trim().slice(0, 1000);
    const postcode = String(req.body?.postcode || "").trim().slice(0, 20);
    const methods = normalizePaymentCardMethods(req.body?.methods || req.body?.requisites || []);
    const isPublished = typeof req.body?.isPublished === "boolean" ? req.body.isPublished : true;
    const createdByStaffId = isManagerSession(req) ? await resolveManagerId(req) : "";

    try {
      const rows = await prisma.$queryRawUnsafe(
        `
          INSERT INTO payment_cards (
            owner_id,
            public_slug,
            title,
            address,
            postcode,
            methods,
            is_published,
            created_by_staff_id
          )
          VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8::uuid)
          RETURNING id
        `,
        userId,
        publicSlug,
        title,
        address || null,
        postcode || null,
        JSON.stringify(methods),
        isPublished,
        createdByStaffId && isUuid(createdByStaffId) ? createdByStaffId : null,
      );
      const row = Array.isArray(rows) ? rows[0] || null : null;
      const paymentCard = await findPaymentCardById(row?.id);
      res.status(201).json({ ok: true, paymentCard });
    } catch (error) {
      if (isPaymentCardsStorageError(error)) {
        res.status(503).json({ error: "Payment cards storage unavailable", code: "PAYMENT_CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/payment-cards/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "").trim();
    const ownerId = await findPaymentCardOwnerId(id).catch((error) => {
      if (isPaymentCardsStorageError(error)) return "";
      throw error;
    });
    if (!ownerId) {
      res.status(404).json({ error: "Payment card not found", code: "PAYMENT_CARD_NOT_FOUND" });
      return;
    }
    if (!(await managerOwnsUser(req, ownerId))) {
      res.status(403).json({ error: "Forbidden", code: "MANAGER_FORBIDDEN" });
      return;
    }
    const current = await findPaymentCardById(id);
    if (!current) {
      res.status(404).json({ error: "Payment card not found", code: "PAYMENT_CARD_NOT_FOUND" });
      return;
    }

    const title =
      Object.prototype.hasOwnProperty.call(req.body || {}, "title")
        ? String(req.body?.title || "").trim().slice(0, 140) || "Payment card"
        : current.title;
    const nextSlug =
      Object.prototype.hasOwnProperty.call(req.body || {}, "publicSlug") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "slug")
        ? await ensureUniquePaymentCardSlug(req.body?.publicSlug || req.body?.slug || title, id)
        : current.publicSlug;
    const address =
      Object.prototype.hasOwnProperty.call(req.body || {}, "address")
        ? String(req.body?.address || "").trim().slice(0, 1000)
        : current.address;
    const postcode =
      Object.prototype.hasOwnProperty.call(req.body || {}, "postcode")
        ? String(req.body?.postcode || "").trim().slice(0, 20)
        : current.postcode;
    const methods =
      Object.prototype.hasOwnProperty.call(req.body || {}, "methods") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "requisites")
        ? normalizePaymentCardMethods(req.body?.methods || req.body?.requisites || [])
        : current.methods;
    const isPublished =
      typeof req.body?.isPublished === "boolean" ? req.body.isPublished : current.isPublished;

    try {
      await prisma.$executeRawUnsafe(
        `
          UPDATE payment_cards
          SET
            public_slug = $2,
            title = $3,
            address = $4,
            postcode = $5,
            methods = $6::jsonb,
            is_published = $7,
            updated_at = now()
          WHERE id = $1::uuid
        `,
        id,
        nextSlug,
        title,
        address || null,
        postcode || null,
        JSON.stringify(methods),
        isPublished,
      );
      const paymentCard = await findPaymentCardById(id);
      res.json({ ok: true, paymentCard });
    } catch (error) {
      if (isPaymentCardsStorageError(error)) {
        res.status(503).json({ error: "Payment cards storage unavailable", code: "PAYMENT_CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.delete(
  "/payment-cards/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "").trim();
    const ownerId = await findPaymentCardOwnerId(id).catch((error) => {
      if (isPaymentCardsStorageError(error)) return "";
      throw error;
    });
    if (!ownerId) {
      res.status(404).json({ error: "Payment card not found", code: "PAYMENT_CARD_NOT_FOUND" });
      return;
    }
    if (!(await managerOwnsUser(req, ownerId))) {
      res.status(403).json({ error: "Forbidden", code: "MANAGER_FORBIDDEN" });
      return;
    }
    await prisma.$executeRawUnsafe("DELETE FROM payment_cards WHERE id = $1::uuid", id);
    res.json({ ok: true });
  }),
);

router.get(
  "/staff",
  asyncHandler(async (_req, res) => {
    const items = await prisma.staffUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        login: true,
        role: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    const userColumns = await getUserColumns();
    const hasCreatorColumn = hasUserColumn(userColumns, "createdByStaffId");
    const staffIds = items.map((item) => item.id);
    const createdAccountsByStaff = new Map();

    if (hasCreatorColumn && staffIds.length > 0) {
      const userSelect = {
        id: true,
        createdByStaffId: true,
        createdAt: true,
      };
      if (hasUserColumn(userColumns, "login")) userSelect.login = true;
      if (hasUserColumn(userColumns, "firstName")) userSelect.firstName = true;
      if (hasUserColumn(userColumns, "displayName")) userSelect.displayName = true;

      let createdUsers = [];
      try {
        createdUsers = await prisma.user.findMany({
          where: {
            createdByStaffId: { in: staffIds },
          },
          orderBy: { createdAt: "desc" },
          select: userSelect,
        });
      } catch (error) {
        if (!isMissingModelError(error, "User") && !isMissingStorageError(error)) {
          throw error;
        }
      }

      for (const row of createdUsers) {
        const managerId = row.createdByStaffId;
        if (!managerId) {
          continue;
        }
        if (!createdAccountsByStaff.has(managerId)) {
          createdAccountsByStaff.set(managerId, []);
        }
        createdAccountsByStaff.get(managerId).push({
          id: row.id,
          login: row.login || null,
          name: row.displayName || row.firstName || row.login || row.id,
          createdAt: row.createdAt || null,
        });
      }
    }

    const enrichedItems = items.map((item) => {
      const createdAccounts = createdAccountsByStaff.get(item.id) || [];
      return {
        ...item,
        createdAccountsCount: createdAccounts.length,
        createdAccounts,
      };
    });

    res.json({ items: enrichedItems });
  }),
);

router.post(
  "/staff",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim().slice(0, 120);
    const login = normalizeLogin(req.body?.login);
    const password = String(req.body?.password || "");

    if (!name || !login || !isValidLogin(login) || !password || password.length < 8) {
      res.status(400).json({ error: "Invalid payload", code: "VALIDATION_ERROR" });
      return;
    }

    const adminLogin = normalizeLogin(env.ADMIN_EMAIL || env.ADMIN_LOGIN || "");
    if (adminLogin && adminLogin === login) {
      res.status(409).json({ error: "Login already reserved", code: "LOGIN_RESERVED" });
      return;
    }

    const existing = await prisma.staffUser.findFirst({
      where: { login },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: "Login already taken", code: "LOGIN_TAKEN" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    const created = await prisma.staffUser.create({
      data: {
        login,
        passwordHash,
        role: "manager",
        isActive: true,
        name,
      },
      select: {
        id: true,
        login: true,
        role: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    res.json({ ok: true, staff: created });
  }),
);

router.patch(
  "/staff/:id",
  asyncHandler(async (req, res) => {
    const staffId = String(req.params.id || "").trim();
    if (!staffId) {
      res.status(400).json({ error: "Invalid staff id" });
      return;
    }

    const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : null;
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) : null;

    if (isActive === null && name === null) {
      res.status(400).json({ error: "Nothing to update", code: "NO_CHANGES" });
      return;
    }

    try {
      const updated = await prisma.staffUser.update({
        where: { id: staffId },
        data: {
          ...(isActive !== null ? { isActive } : {}),
          ...(name !== null ? { name: name || null } : {}),
        },
        select: {
          id: true,
          login: true,
          role: true,
          name: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });
      res.json({ ok: true, staff: updated });
    } catch (error) {
      if (isMissingModelError(error, "StaffUser")) {
        res.status(404).json({ error: "Staff not found", code: "STAFF_NOT_FOUND" });
        return;
      }
      if (String(error?.code || "") === "P2025") {
        res.status(404).json({ error: "Staff not found", code: "STAFF_NOT_FOUND" });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/staff/:id/password",
  asyncHandler(async (req, res) => {
    const staffId = String(req.params.id || "").trim();
    const password = String(req.body?.password || "");
    if (!staffId || !password || password.length < 8) {
      res.status(400).json({ error: "Invalid password", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
      await prisma.staffUser.update({
        where: { id: staffId },
        data: { passwordHash },
        select: { id: true },
      });
      res.json({ ok: true });
    } catch (error) {
      if (isMissingModelError(error, "StaffUser")) {
        res.status(404).json({ error: "Staff not found", code: "STAFF_NOT_FOUND" });
        return;
      }
      if (String(error?.code || "") === "P2025") {
        res.status(404).json({ error: "Staff not found", code: "STAFF_NOT_FOUND" });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/cards",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const payload = await listAdminCardCompatRows(req.query || {});
    res.json(payload);
  }),
);

router.post(
  "/cards",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const ownerId = String(req.body?.ownerId || "").trim();
    if (!ownerId) {
      res.status(400).json({ error: "Owner id is required", code: "OWNER_ID_REQUIRED" });
      return;
    }

    try {
      const saved = await saveAdminCardCompatForOwner(ownerId, req.body || {});
      if (!saved) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      res.json(buildAdminCardDetailResponse(saved));
    } catch (error) {
      if (error?.code === "INVALID_EMAIL") {
        res.status(400).json({ error: "Invalid email", code: "INVALID_EMAIL" });
        return;
      }
      if (isMissingStorageError(error)) {
        res.status(503).json({ error: "Cards storage unavailable", code: "CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/cards/:id",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await findAdminCardCompatById(cardId);
    if (!card) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    res.json({
      ...buildAdminCardDetailResponse(card),
      petCatalog: await getPetCatalog(),
    });
  }),
);

router.patch(
  "/cards/:id",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const current = await findAdminCardCompatById(cardId);
    if (!current) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    try {
      const saved = await saveAdminCardCompatForOwner(current.ownerId, req.body || {});
      if (!saved) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      res.json({
        ...buildAdminCardDetailResponse(saved),
        petCatalog: await getPetCatalog(),
      });
    } catch (error) {
      if (error?.code === "INVALID_EMAIL") {
        res.status(400).json({ error: "Invalid email", code: "INVALID_EMAIL" });
        return;
      }
      if (isMissingStorageError(error)) {
        res.status(503).json({ error: "Cards storage unavailable", code: "CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.delete(
  "/cards/:id",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await findAdminCardCompatById(cardId);
    if (!card) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    if (card.card?.avatarUrl) {
      await safeDeleteAvatarByPublicPath(card.card.avatarUrl);
    }

    await prisma.profileCard.delete({ where: { id: cardId } });
    await safeRecalculateScore(card.ownerId);
    res.json({ ok: true });
  }),
);

router.patch(
  "/cards/:id/toggle-active",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await findAdminCardCompatById(cardId);
    if (!card) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    const shouldBeActive = Boolean(req.body?.isActive);
    if (shouldBeActive) {
      await prisma.slug.updateMany({
        where: {
          ownerId: card.ownerId,
          status: { in: ["approved", "paused"] },
        },
        data: {
          status: "active",
          activatedAt: new Date(),
        },
      });
    } else {
      await prisma.slug.updateMany({
        where: {
          ownerId: card.ownerId,
          status: { in: ["active", "private"] },
        },
        data: {
          status: "paused",
        },
      });
    }

    const refreshed = await findAdminCardCompatById(cardId);
    res.json({
      ok: true,
      id: cardId,
      isActive: refreshed ? buildAdminCardDetailResponse(refreshed).isActive : shouldBeActive,
    });
  }),
);

router.patch(
  "/cards/:id/tariff",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await findAdminCardCompatById(cardId);
    if (!card) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    const nextPlan = normalizeUserPlan(req.body?.tariff || req.body?.plan);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: card.ownerId },
        select: {
          id: true,
          plan: true,
          planPurchasedAt: true,
          planUpgradedAt: true,
          subscriptionStartedAt: true,
          subscriptionRenewedAt: true,
          subscriptionExpiresAt: true,
        },
      });

      if (!user) {
        return null;
      }

      const userPatch = { plan: nextPlan };
      if (nextPlan === "premium") {
        const currentExpiry =
          user.subscriptionExpiresAt && Number.isFinite(new Date(user.subscriptionExpiresAt).getTime())
            ? new Date(user.subscriptionExpiresAt)
            : null;
        const renewalBase = currentExpiry && currentExpiry > now ? currentExpiry : now;
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
        userPatch.planUpgradedAt = user.plan === "premium" ? user.planUpgradedAt : now;
        userPatch.subscriptionStartedAt = user.subscriptionStartedAt || now;
        userPatch.subscriptionRenewedAt = now;
        userPatch.subscriptionExpiresAt = addDays(renewalBase, 30);
      } else {
        userPatch.subscriptionExpiresAt = now;
      }

      const updated = await tx.user.update({
        where: { id: card.ownerId },
        data: userPatch,
        select: {
          id: true,
          plan: true,
          subscriptionExpiresAt: true,
        },
      });

      if (nextPlan === "none") {
        await tx.slug.updateMany({
          where: {
            ownerId: card.ownerId,
            status: { in: ["approved", "active", "paused", "private"] },
          },
          data: { status: "paused" },
        });
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    await safeRecalculateScore(card.ownerId);
    res.json({
      ok: true,
      id: cardId,
      tariff: nextPlan === "premium" ? "premium" : "legacy",
      subscriptionExpiresAt: result.subscriptionExpiresAt || null,
    });
  }),
);

router.post(
  "/cards/:id/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await findAdminCardCompatById(cardId);
    if (!card) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    if (!req.file || !ALLOWED_MIME.has(req.file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type", code: "UNSUPPORTED_FILE_TYPE" });
      return;
    }

    const okBuffer = await isSupportedAvatarBuffer(req.file.buffer);
    if (!okBuffer) {
      res.status(400).json({ error: "Invalid image payload", code: "INVALID_IMAGE_PAYLOAD" });
      return;
    }

    const avatarSlug = buildAvatarSlug(`admin_profile_${card.ownerId}`);
    const avatarUrl = await saveAvatarFromBuffer(avatarSlug, req.file.buffer);
    if (card.card?.avatarUrl && card.card.avatarUrl !== avatarUrl) {
      await safeDeleteAvatarByPublicPath(card.card.avatarUrl);
    }

    await prisma.$executeRaw`
      UPDATE profile_cards
      SET avatar_url = ${avatarUrl},
          updated_at = now()
      WHERE id = ${cardId}::uuid
    `;

    res.json({ ok: true, avatarUrl });
  }),
);

router.delete(
  "/cards/:id/avatar",
  asyncHandler(async (req, res) => {
    if (!ensureAdminCardsApiAccess(req, res)) {
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await findAdminCardCompatById(cardId);
    if (!card) {
      res.status(404).json({ error: "Card not found", code: "CARD_NOT_FOUND" });
      return;
    }

    if (card.card?.avatarUrl) {
      await safeDeleteAvatarByPublicPath(card.card.avatarUrl);
    }

    await prisma.$executeRaw`
      UPDATE profile_cards
      SET avatar_url = NULL,
          updated_at = now()
      WHERE id = ${cardId}::uuid
    `;

    res.json({ ok: true, avatarUrl: "" });
  }),
);

function buildOrdersWhere(query) {
  const where = {};
  if (typeof query.q === "string" && query.q.trim()) {
    const term = query.q.trim();
    const orClauses = [
      { slug: { contains: term, mode: "insensitive" } },
      { user: { username: { contains: term, mode: "insensitive" } } },
      { user: { firstName: { contains: term, mode: "insensitive" } } },
      { user: { displayName: { contains: term, mode: "insensitive" } } },
    ];
    if (isUuid(term)) orClauses.push({ userId: { equals: term } });
    where.OR = orClauses;
  }
  if (query.status && query.status !== "all") {
    where.status = toOrderStatus(query.status);
  }
  if (query.tariff && query.tariff !== "all") {
    where.requestedPlan = normalizeTariff(query.tariff);
  }
  if (typeof query.dateFrom === "string" && query.dateFrom) {
    const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) {
      where.createdAt = { gte: from };
    }
  }
  if (typeof query.dateTo === "string" && query.dateTo) {
    const to = new Date(`${query.dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime())) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: to,
      };
    }
  }
  return where;
}

function buildPurchasesWhere(query) {
  const where = {};
  const allowedTypes = new Set(["slug", "basic_plan", "premium_plan", "upgrade_to_premium", "pet"]);

  if (typeof query.type === "string" && query.type !== "all" && allowedTypes.has(query.type)) {
    where.type = query.type;
  }
  if (typeof query.dateFrom === "string" && query.dateFrom) {
    const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) {
      where.purchasedAt = { gte: from };
    }
  }
  if (typeof query.dateTo === "string" && query.dateTo) {
    const to = new Date(`${query.dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime())) {
      where.purchasedAt = {
        ...(where.purchasedAt || {}),
        lte: to,
      };
    }
  }
  if (typeof query.user === "string" && query.user.trim()) {
    const term = query.user.trim();
    const orClauses = [
      { user: { username: { contains: term, mode: "insensitive" } } },
      { user: { firstName: { contains: term, mode: "insensitive" } } },
      { user: { displayName: { contains: term, mode: "insensitive" } } },
    ];
    if (isUuid(term)) orClauses.push({ userId: { equals: term } });
    where.OR = orClauses;
  }
  return where;
}

function isPaymentEventsStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "P2021" || message.includes("payment_events");
}

function normalizePaymentEventFilters(query) {
  const allowedStatus = new Set(["new", "contacted", "paid", "approved", "rejected", "expired"]);
  const allowedProvider = new Set(["manual_tg", "click", "payme"]);

  const status = String(query.status || "").trim().toLowerCase();
  const provider = String(query.provider || "").trim().toLowerCase();
  const source = String(query.source || "").trim().toLowerCase();
  const orderId = String(query.orderId || "").trim();
  const userId = String(query.userId || "").trim();
  const reference = String(query.reference || "").trim();
  const actor = String(query.actor || "").trim();

  const dateFromRaw = String(query.dateFrom || "").trim();
  const dateToRaw = String(query.dateTo || "").trim();
  const dateFrom = dateFromRaw ? new Date(`${dateFromRaw}T00:00:00.000Z`) : null;
  const dateTo = dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`) : null;

  return {
    status: allowedStatus.has(status) ? status : "",
    provider: allowedProvider.has(provider) ? provider : "",
    source,
    orderId,
    userId,
    reference,
    actor,
    dateFrom: dateFrom && Number.isFinite(dateFrom.getTime()) ? dateFrom : null,
    dateTo: dateTo && Number.isFinite(dateTo.getTime()) ? dateTo : null,
  };
}

function buildPaymentEventsWhereSql(filters) {
  const clauses = [];
  if (filters.status) clauses.push(Prisma.sql`pe.status = ${filters.status}`);
  if (filters.provider) clauses.push(Prisma.sql`pe.provider = ${filters.provider}`);
  if (filters.source) clauses.push(Prisma.sql`pe.source = ${filters.source}`);
  if (filters.orderId) clauses.push(Prisma.sql`CAST(pe.order_id AS TEXT) = ${filters.orderId}`);
  if (filters.userId) clauses.push(Prisma.sql`CAST(pe.user_id AS TEXT) = ${filters.userId}`);
  if (filters.reference) clauses.push(Prisma.sql`pe.reference ILIKE ${`%${filters.reference}%`}`);
  if (filters.actor) clauses.push(Prisma.sql`pe.actor ILIKE ${`%${filters.actor}%`}`);
  if (filters.dateFrom) clauses.push(Prisma.sql`pe.created_at >= ${filters.dateFrom}`);
  if (filters.dateTo) clauses.push(Prisma.sql`pe.created_at <= ${filters.dateTo}`);
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, Prisma.sql` AND `)}` : Prisma.empty;
}

async function queryPaymentEvents({ query, page, pageSize }) {
  const filters = normalizePaymentEventFilters(query || {});
  const whereSql = buildPaymentEventsWhereSql(filters);
  const offset = (page - 1) * pageSize;

  const baseSelectSql = Prisma.sql`
    FROM payment_events pe
    LEFT JOIN users u ON u.id = pe.user_id
    ${whereSql}
  `;

  const [rows, countRows, totalAmountRows] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT
        pe.id,
        pe.order_id AS "orderId",
        pe.user_id AS "userId",
        pe.status,
        pe.provider,
        pe.reference,
        pe.amount,
        pe.actor,
        pe.source,
        pe.note,
        pe.created_at AS "createdAt",
        u.first_name AS "firstName",
        u.display_name AS "displayName",
        u.username AS "username"
      ${baseSelectSql}
      ORDER BY pe.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `),
    prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      ${baseSelectSql}
    `),
    prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(SUM(pe.amount), 0)::bigint AS total_amount
      ${baseSelectSql}
    `),
  ]);

  const total = Number(countRows?.[0]?.total || 0);
  const totalAmount = Number(totalAmountRows?.[0]?.total_amount || 0);
  return { rows: Array.isArray(rows) ? rows : [], total, totalAmount, filters };
}

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const managerScope = await getManagerScope(req);
    if (isManagerScopeBlocked(managerScope)) {
      res.json({
        items: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
        },
      });
      return;
    }

    const baseWhere = buildOrdersWhere(req.query);
    const where = managerScope.isManager
      ? andWhere(baseWhere, { user: { createdByStaffId: managerScope.managerId } })
      : baseWhere;
    const [total, rows] = await Promise.all([
      prisma.slugRequest.count({ where }),
      prisma.slugRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              displayName: true,
              username: true,
              telegramChatId: true,
            },
          },
        },
      }),
    ]);

    const slugSet = new Set(rows.map((row) => row.slug));
    const slugMetaRows = slugSet.size
      ? await prisma.slug.findMany({
        where: { fullSlug: { in: Array.from(slugSet) } },
        select: { fullSlug: true, status: true, pendingExpiresAt: true },
      })
      : [];
    const slugMetaBySlug = new Map(slugMetaRows.map((row) => [row.fullSlug, row]));
    const paymentByOrderId = new Map();
    await Promise.all(
      rows.map(async (row) => {
        const totalAmount = Number(row.slugPrice || 0) + Number(row.planPrice || 0);
        const payment = await buildOrderPaymentDraft({
          orderId: row.id,
          amount: totalAmount,
        });
        paymentByOrderId.set(row.id, payment);
      }),
    );

    res.json({
      items: rows.map((row) => ({
        payment: paymentByOrderId.get(row.id) || null,
        slugState: slugMetaBySlug.get(row.slug)?.status || null,
        pendingExpiresAt: slugMetaBySlug.get(row.slug)?.pendingExpiresAt || null,
        id: row.id,
        name: row.user?.displayName || row.user?.firstName || "UNQX User",
        slug: row.slug,
        slugPrice: row.slugPrice,
        planPrice: row.planPrice || 0,
        amount: Number(row.slugPrice || 0) + Number(row.planPrice || 0),
        tariff: row.requestedPlan,
        theme: null,
        contact: row.user?.username ? `@${row.user.username}` : row.user?.telegramChatId || row.user?.id || "",
        telegramId: row.userId,
        username: row.user?.username || null,
        tMeLink: row.user?.username ? `https://t.me/${row.user.username}` : null,
        status: row.status,
        adminNote: row.adminNote || null,
        createdAt: row.createdAt,
        statusLabel: formatOrderStatusLabel(row.status),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    if (isManagerSession(req)) {
      const ownsOrder = await managerOwnsOrder(req, req.params.id);
      if (!ownsOrder) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
    }
    const status = toOrderStatus(req.body.status);
    const adminNote = String(req.body.adminNote || "").trim();
    const adminLogin = String(req.session?.admin?.login || "").trim() || null;
    try {
      const { updated } = await applyOrderStatusTransition({
        orderId: req.params.id,
        status,
        adminNote,
        adminActor: adminLogin || "admin",
        source: "admin_api",
      });
      res.json({ id: updated.id, status: updated.status });
    } catch (error) {
      if (error?.code === "ORDER_NOT_FOUND") {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      if (error?.code === "INVALID_STATUS_TRANSITION") {
        res.status(409).json({ error: error.message, code: error.code });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/orders/:id/extend-pending",
  asyncHandler(async (req, res) => {
    if (isManagerSession(req)) {
      const ownsOrder = await managerOwnsOrder(req, req.params.id);
      if (!ownsOrder) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
    }

    const order = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, status: true },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.status === "expired") {
      res.status(409).json({ error: "Expired order cannot be extended" });
      return;
    }

    const slugRow = await prisma.slug.findUnique({
      where: { fullSlug: order.slug },
      select: { fullSlug: true, status: true, pendingExpiresAt: true },
    });

    if (!slugRow || slugRow.status !== "pending") {
      res.status(409).json({ error: "UNQ is not pending" });
      return;
    }

    const base = slugRow.pendingExpiresAt && slugRow.pendingExpiresAt.getTime() > Date.now() ? slugRow.pendingExpiresAt : new Date();
    const nextExpiry = addDays(base, 1);

    const updated = await prisma.slug.update({
      where: { fullSlug: slugRow.fullSlug },
      data: { pendingExpiresAt: nextExpiry },
      select: { fullSlug: true, pendingExpiresAt: true },
    });

    res.json({
      ok: true,
      slug: updated.fullSlug,
      pendingExpiresAt: updated.pendingExpiresAt,
    });
  }),
);

router.post(
  "/orders/:id/activate",
  asyncHandler(async (req, res) => {
    res.status(410).json({
      error: "Legacy activation flow is deprecated. Use slug request approval.",
      code: "LEGACY_ORDER_ACTIVATION_DEPRECATED",
    });
  }),
);

router.delete(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true },
    });
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.slugRequest.delete({ where: { id: req.params.id } });

      const activeOrdersCount = await tx.slugRequest.count({
        where: {
          slug: row.slug,
          status: { in: ["new", "contacted", "paid"] },
        },
      });

      if (activeOrdersCount === 0) {
        await tx.slug.updateMany({
          where: {
            fullSlug: row.slug,
            status: "pending",
          },
          data: {
            status: "free",
            ownerId: null,
            isPrimary: false,
            pendingExpiresAt: null,
            requestedAt: null,
            approvedAt: null,
            activatedAt: null,
            pauseMessage: null,
          },
        });
      }
    });
    res.json({ ok: true });
  }),
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userColumns = await getUserColumns();
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const sort = req.query.sort === "score_desc" ? "score_desc" : "created_desc";
    const rawPlanFilter = typeof req.query.plan === "string" ? req.query.plan.trim() : "";
    const planFilter = rawPlanFilter === "basic"
      ? "premium"
      : ["none", "premium"].includes(rawPlanFilter)
        ? rawPlanFilter
        : "all";
    const rawProfileTypeFilter = typeof req.query.profileType === "string"
      ? req.query.profileType
      : req.query.type;
    const profileTypeFilter = normalizeProfileType(rawProfileTypeFilter, { fallback: "all", allowAll: true });
    const adminSession = req.session?.admin || null;
    const requesterRole = String(adminSession?.role || "admin");
    const requesterManagerId = requesterRole === "manager" ? await resolveManagerId(req) : "";
    const hasCreatorColumn = hasUserColumn(userColumns, "createdByStaffId");
    const managerScopeBlocked = requesterRole === "manager" && (!requesterManagerId || !hasCreatorColumn);

    const where = {};
    if (requesterRole === "manager") {
      if (managerScopeBlocked) {
        res.json({
          items: [],
          managerStats: {
            createdAccountsCount: 0,
            trackingEnabled: hasCreatorColumn,
          },
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 1,
          },
        });
        return;
      }
      where.createdByStaffId = requesterManagerId;
    }
    if (planFilter !== "all" && hasUserColumn(userColumns, "plan")) {
      where.plan = planFilter === "premium" ? { in: ["premium", "basic"] } : planFilter;
    }
    if (profileTypeFilter !== "all" && hasUserColumn(userColumns, "profileType")) {
      where.profileType = profileTypeFilter;
    }
    if (q) {
      const or = [];
      if (hasUserColumn(userColumns, "id") && isUuid(q)) {
        or.push({ id: { equals: q } });
      }
      if (hasUserColumn(userColumns, "firstName")) {
        or.push({ firstName: { contains: q, mode: "insensitive" } });
      }
      if (hasUserColumn(userColumns, "city")) {
        or.push({ city: { contains: q, mode: "insensitive" } });
      }
      if (hasUserColumn(userColumns, "username")) {
        or.push({ username: { contains: q, mode: "insensitive" } });
      }
      if (hasUserColumn(userColumns, "email")) {
        or.push({ email: { contains: q, mode: "insensitive" } });
      }
      if (hasUserColumn(userColumns, "telegramUsername")) {
        or.push({ telegramUsername: { contains: q, mode: "insensitive" } });
      }
      if (hasUserColumn(userColumns, "login")) {
        or.push({ login: { contains: q, mode: "insensitive" } });
      }
      if (hasUserColumn(userColumns, "displayName")) {
        or.push({ displayName: { contains: q, mode: "insensitive" } });
      }
      if (or.length) {
        where.OR = or;
      }
    }

    let total;
    let users;
    let managerCreatedAccountsCount = null;
    try {
      const select = { id: true };
      if (hasUserColumn(userColumns, "firstName")) select.firstName = true;
      if (hasUserColumn(userColumns, "displayName")) select.displayName = true;
      if (hasUserColumn(userColumns, "city")) select.city = true;
      if (hasUserColumn(userColumns, "username")) select.username = true;
      if (hasUserColumn(userColumns, "email")) select.email = true;
      if (hasUserColumn(userColumns, "telegramUsername")) select.telegramUsername = true;
      if (hasUserColumn(userColumns, "login")) select.login = true;
      if (hasUserColumn(userColumns, "isVerified")) select.isVerified = true;
      if (hasUserColumn(userColumns, "verifiedCompany")) select.verifiedCompany = true;
      if (hasUserColumn(userColumns, "plan")) select.plan = true;
      if (hasUserColumn(userColumns, "planPurchasedAt")) select.planPurchasedAt = true;
      if (hasUserColumn(userColumns, "planUpgradedAt")) select.planUpgradedAt = true;
      if (hasUserColumn(userColumns, "profileType")) select.profileType = true;
      if (hasUserColumn(userColumns, "freeProfileCode")) select.freeProfileCode = true;
      if (hasCreatorColumn) select.createdByStaffId = true;
      if (hasUserColumn(userColumns, "status")) select.status = true;
      if (hasUserColumn(userColumns, "createdAt")) select.createdAt = true;

      [total, users, managerCreatedAccountsCount] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: sort === "created_desc" ? { createdAt: "desc" } : { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select,
        }),
        requesterManagerId && hasCreatorColumn
          ? prisma.user.count({
            where: { createdByStaffId: requesterManagerId },
          })
          : Promise.resolve(null),
      ]);
    } catch (error) {
      if (isMissingModelError(error, "User")) {
        res.status(503).json({ error: "Users storage unavailable", code: "USERS_STORAGE_UNAVAILABLE" });
        return;
      }
      if (isMissingStorageError(error)) {
        res.status(503).json({ error: "Users storage unavailable", code: "USERS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }

    const userIds = users.map((item) => item.id);
    const creatorIds = hasCreatorColumn
      ? Array.from(new Set(users.map((item) => item.createdByStaffId).filter(Boolean)))
      : [];
    const [slugs, cards, unqScores, creatorStaff, approvedVerificationRows, approvedBadges] = await Promise.all([
      prisma.slug.findMany({
        where: { ownerId: { in: userIds } },
        select: {
          ownerId: true,
          fullSlug: true,
          status: true,
          isPrimary: true,
          pauseMessage: true,
        },
      }),
      prisma.profileCard.findMany({
        where: { ownerId: { in: userIds } },
        select: { ownerId: true, id: true, theme: true, role: true },
      }),
      modelDelegateExists("UnqScore")
        ? prisma.unqScore.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            score: true,
            percentile: true,
            calculatedAt: true,
            scoreViews: true,
            scoreSlugRarity: true,
            scoreTenure: true,
            scoreCtr: true,
            scoreBracelet: true,
            scorePlan: true,
          },
        })
        : Promise.resolve([]),
      creatorIds.length
        ? prisma.staffUser.findMany({
          where: { id: { in: creatorIds } },
          select: {
            id: true,
            login: true,
            name: true,
          },
        })
        : Promise.resolve([]),
      modelDelegateExists("VerificationRequest")
        ? prisma.verificationRequest.findMany({
          where: {
            userId: { in: userIds },
            status: "approved",
          },
          orderBy: [
            { reviewedAt: "desc" },
            { requestedAt: "desc" },
          ],
          select: {
            userId: true,
            role: true,
          },
        })
        : Promise.resolve([]),
      prisma.badgeApplication
        ? prisma.badgeApplication.findMany({
          where: {
            userId: { in: userIds },
            status: "approved",
            badgeType: { in: ["government", "unqx_staff"] },
          },
          select: {
            userId: true,
            badgeType: true,
          },
          orderBy: [{ requestedAt: "desc" }],
        })
        : Promise.resolve([]),
    ]);

    const slugsByUser = new Map();
    for (const row of slugs) {
      if (!slugsByUser.has(row.ownerId)) {
        slugsByUser.set(row.ownerId, []);
      }
      slugsByUser.get(row.ownerId).push({
        fullSlug: row.fullSlug,
        status: row.status,
        isPrimary: row.isPrimary,
        pauseMessage: row.pauseMessage || null,
      });
    }
    const cardsSet = new Set(cards.map((item) => item.ownerId));
    const cardThemeByUser = new Map(
      cards.map((item) => [item.ownerId, item.theme || "default_dark"]),
    );
    const cardRoleByUser = new Map(
      cards.map((item) => [item.ownerId, String(item.role || "").trim()]),
    );
    const verificationRoleByUser = new Map();
    for (const row of approvedVerificationRows) {
      if (!verificationRoleByUser.has(row.userId)) {
        verificationRoleByUser.set(row.userId, String(row.role || "").trim());
      }
    }
    const scoreByUser = new Map(unqScores.map((row) => [row.userId, row]));
    const staffById = new Map(creatorStaff.map((row) => [row.id, row]));
    const badgeTypesByUser = new Map();
    for (const row of approvedBadges) {
      const userId = String(row?.userId || "").trim();
      const nextType = String(row?.badgeType || "").trim();
      if (!userId || !MANUAL_ASSIGNABLE_BADGE_TYPE_SET.has(nextType)) continue;
      if (!badgeTypesByUser.has(userId)) {
        badgeTypesByUser.set(userId, new Set());
      }
      badgeTypesByUser.get(userId).add(nextType);
    }

    const items = users.map((user) => {
      const telegramUsername = user.telegramUsername || null;
      const username = user.username || null;
      const createdByStaffId = user.createdByStaffId || null;
      const creator = createdByStaffId ? staffById.get(createdByStaffId) || null : null;
      const badgeTypes = MANUAL_ASSIGNABLE_BADGE_TYPES.filter((type) =>
        badgeTypesByUser.get(user.id)?.has(type),
      );
      return {
        unqScore: scoreByUser.get(user.id)
          ? {
            score: scoreByUser.get(user.id).score,
            percentile: scoreByUser.get(user.id).percentile,
            calculatedAt: scoreByUser.get(user.id).calculatedAt,
            breakdown: {
              views: scoreByUser.get(user.id).scoreViews,
              slugRarity: scoreByUser.get(user.id).scoreSlugRarity,
              tenure: scoreByUser.get(user.id).scoreTenure,
              ctr: scoreByUser.get(user.id).scoreCtr,
              plan: scoreByUser.get(user.id).scorePlan,
            },
          }
          : null,
        telegramId: user.id,
        name: user.displayName || user.firstName,
        city: user.city || "",
        email: user.email || "",
        username,
        telegramUsername,
        login: user.login || null,
        createdBy: createdByStaffId
          ? {
            id: createdByStaffId,
            login: creator?.login || null,
            name: creator?.name || null,
          }
          : null,
        isVerified: Boolean(user.isVerified),
        verifiedCompany: user.verifiedCompany || "",
        verifiedRole: cardRoleByUser.get(user.id) || verificationRoleByUser.get(user.id) || "",
        badgeType: getPrimaryManualBadgeType(badgeTypes),
        badgeTypes,
        plan: user.plan,
        planPurchasedAt: user.planPurchasedAt,
        planUpgradedAt: user.planUpgradedAt,
        profileType: normalizeProfileType(user.profileType, { fallback: "person" }),
        freeProfileCode: user.freeProfileCode || null,
        slugs: slugsByUser.get(user.id) || [],
        activeSlugCount: (slugsByUser.get(user.id) || []).filter((slug) =>
          ["approved", "active", "paused", "private"].includes(slug.status),
        ).length,
        hasCard: cardsSet.has(user.id),
        theme: cardThemeByUser.get(user.id) || "default_dark",
        status: user.status,
        createdAt: user.createdAt,
      };
    });

    if (sort === "score_desc") {
      items.sort((a, b) => (Number(b.unqScore?.score || 0) - Number(a.unqScore?.score || 0)));
    }

    res.json({
      items,
      managerStats: requesterRole === "manager"
        ? {
          createdAccountsCount: Number(managerCreatedAccountsCount || 0),
          trackingEnabled: hasCreatorColumn,
        }
        : null,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/users/check",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userColumns = await getUserColumns();
    const login = normalizeLogin(req.query?.login);
    const email = normalizeEmail(req.query?.email);

    const response = {
      login: {
        provided: Boolean(login),
        valid: true,
        available: true,
        checked: false,
        message: "",
      },
      email: {
        provided: Boolean(email),
        valid: true,
        available: true,
        checked: false,
        message: "",
      },
    };

    if (login) {
      if (!isValidLogin(login)) {
        response.login.valid = false;
        response.login.available = false;
        response.login.message = "Логин может содержать только латиницу, цифры и символы . _ @ + -";
      } else if (hasUserColumn(userColumns, "login")) {
        response.login.checked = true;
      }
    }

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        response.email.valid = false;
        response.email.available = false;
        response.email.message = "Введите email в формате name@example.com";
      } else if (hasUserColumn(userColumns, "email")) {
        response.email.checked = true;
      }
    }

    try {
      const checks = await Promise.all([
        response.login.checked
          ? prisma.user.findFirst({
            where: { login },
            select: { id: true },
          })
          : Promise.resolve(null),
        response.email.checked
          ? prisma.user.findFirst({
            where: { email },
            select: { id: true },
          })
          : Promise.resolve(null),
      ]);

      if (response.login.checked && checks[0]) {
        response.login.available = false;
        response.login.message = "Этот логин уже занят";
      }
      if (response.email.checked && checks[1]) {
        response.email.available = false;
        response.email.message = "Этот email уже используется";
      }

      res.json(response);
    } catch (error) {
      if (isMissingModelError(error, "User") || isMissingStorageError(error)) {
        res.status(503).json({
          error: "Users storage unavailable",
          code: "USERS_STORAGE_UNAVAILABLE",
        });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userColumns = await getUserColumns();
    const hasCreatorColumn = hasUserColumn(userColumns, "createdByStaffId");
    const adminSession = req.session?.admin || null;
    const createdByManagerId = adminSession?.role === "manager" ? await resolveManagerId(req) : "";

    const firstName = String(req.body?.firstName || req.body?.name || "").trim().slice(0, 120);
    const login = normalizeLogin(req.body?.login);
    const password = String(req.body?.password || "");
    const email = normalizeEmail(req.body?.email);
    const displayNameRaw = String(req.body?.displayName || "").trim().slice(0, 120);
    const city = normalizeCityOptional(req.body?.city);
    const telegramUsername = String(req.body?.telegramUsername || "")
      .replace(/^@+/, "")
      .trim()
      .slice(0, 120) || null;
    const requestedPlan = normalizeUserPlan(req.body?.plan);
    const requestedSlug = normalizeShortSlug(req.body?.slug);
    const profileType = normalizeProfileType(req.body?.profileType, { fallback: "person" });
    const badgeTypes = normalizeManualBadgeTypesInput(req.body?.badgeTypes ?? req.body?.badgeType);
    const badgeType = getPrimaryManualBadgeType(badgeTypes);
    const hasSlugInput = Boolean(String(req.body?.slug || "").trim());
    const requesterRole = String(adminSession?.role || "admin");
    const requiresInlineActivation = requesterRole === "manager" || requestedPlan !== "none" || hasSlugInput;

    if (!firstName || !login || !isValidLogin(login) || !password || password.length < 8) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email", code: "EMAIL_INVALID" });
      return;
    }

    if (requiresInlineActivation && requestedPlan === "none") {
      res.status(400).json({
        error: "Plan is required for immediate activation",
        code: "PLAN_REQUIRED_FOR_ACTIVATION",
      });
      return;
    }

    if (requiresInlineActivation && !isShortSlug(requestedSlug)) {
      sendAssignableSlugValidationError(res, requestedSlug);
      return;
    }

    const existingLogin = await prisma.user.findFirst({
      where: { login },
      select: { id: true },
    });
    if (existingLogin) {
      res.status(409).json({ error: "Login already taken", code: "LOGIN_TAKEN" });
      return;
    }

    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (existingEmail) {
        res.status(409).json({ error: "Email already taken", code: "EMAIL_TAKEN" });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    const refCode = await generateUniqueRefCode();
    const displayName = normalizeDisplayName(displayNameRaw, firstName);
    const now = new Date();
    const selectedPlan = requiresInlineActivation ? requestedPlan : "none";
    const adminActor = String(adminSession?.login || "").trim() || null;

    let planCharge = 0;
    let planPurchaseType = null;
    let slugCharge = 0;
    if (requiresInlineActivation) {
      const pricingSettings = await getPricingSettings();
      planCharge = getPlanCharge({
        currentPlan: "none",
        requestedPlan: selectedPlan,
        pricing: pricingSettings,
      });
      planPurchaseType = getPlanPurchaseType({
        currentPlan: "none",
        requestedPlan: selectedPlan,
      });
      slugCharge = await getCalculatedShortSlugPrice(requestedSlug);
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        if (requiresInlineActivation) {
          const existingSlug = await tx.slug.findUnique({
            where: { fullSlug: requestedSlug },
            select: { fullSlug: true, ownerId: true, status: true },
          });
          if (existingSlug?.ownerId) {
            const error = new Error("Slug is already assigned to another user");
            error.code = "SLUG_TAKEN";
            throw error;
          }
          if (existingSlug && existingSlug.status !== "free") {
            const error = new Error("Slug is not free right now");
            error.code = "SLUG_NOT_FREE";
            error.status = existingSlug.status;
            throw error;
          }
        }

        const createdUser = await tx.user.create({
          data: {
            firstName,
            displayName,
            city,
            login,
            passwordHash,
            email: email || null,
            emailVerified: Boolean(email),
            pendingEmail: null,
            otpCode: null,
            otpExpiresAt: null,
            otpAttempts: 0,
            resetPasswordToken: null,
            resetPasswordExpiresAt: null,
            loginAttempts: 0,
            lockedUntil: null,
            plan: selectedPlan,
            planPurchasedAt: selectedPlan === "none" ? null : now,
            planUpgradedAt: null,
            ...(hasUserColumn(userColumns, "profileType") ? { profileType } : {}),
            status: "active",
            refCode,
            telegramUsername,
            ...(hasCreatorColumn && createdByManagerId
              ? { createdByStaffId: createdByManagerId }
              : {}),
          },
          select: {
            id: true,
            login: true,
            email: true,
            emailVerified: true,
            firstName: true,
            displayName: true,
            city: true,
            username: true,
            telegramUsername: true,
            plan: true,
            planPurchasedAt: true,
            ...(hasUserColumn(userColumns, "profileType") ? { profileType: true } : {}),
          },
        });

        let activatedSlug = null;
        if (requiresInlineActivation) {
          const storageParts = getSlugStorageParts(requestedSlug);
          const slugPayload = {
            ownerId: createdUser.id,
            status: "active",
            isPrimary: true,
            pauseMessage: null,
            pendingExpiresAt: null,
            requestedAt: now,
            approvedAt: now,
            activatedAt: now,
            price: isLegacySlug(requestedSlug) ? slugCharge : null,
          };
          const existingSlug = await tx.slug.findUnique({
            where: { fullSlug: requestedSlug },
            select: { fullSlug: true, ownerId: true, status: true },
          });
          if (existingSlug) {
            const claimed = await tx.slug.updateMany({
              where: {
                fullSlug: requestedSlug,
                ownerId: null,
                status: "free",
              },
              data: slugPayload,
            });
            if (!claimed.count) {
              const refreshed = await tx.slug.findUnique({
                where: { fullSlug: requestedSlug },
                select: { ownerId: true, status: true },
              });
              if (refreshed?.ownerId) {
                const error = new Error("Slug is already assigned to another user");
                error.code = "SLUG_TAKEN";
                throw error;
              }
              const error = new Error("Slug is not free right now");
              error.code = "SLUG_NOT_FREE";
              error.status = refreshed?.status || null;
              throw error;
            }
          } else {
            try {
              await tx.slug.create({
                data: {
                  letters: storageParts.letters,
                  digits: storageParts.digits,
                  fullSlug: requestedSlug,
                  ...slugPayload,
                },
              });
            } catch (createError) {
              if (createError?.code === "P2002") {
                const error = new Error("Slug is already assigned to another user");
                error.code = "SLUG_TAKEN";
                throw error;
              }
              throw createError;
            }
          }

          activatedSlug = await tx.slug.findUnique({
            where: { fullSlug: requestedSlug },
            select: {
              fullSlug: true,
              ownerId: true,
              status: true,
              isPrimary: true,
              price: true,
              requestedAt: true,
              approvedAt: true,
              activatedAt: true,
            },
          });

          if (tx.purchase && typeof tx.purchase.create === "function") {
            await tx.purchase.create({
              data: {
                userId: createdUser.id,
                type: "slug",
                amount: slugCharge,
                slug: requestedSlug,
                purchasedAt: now,
                approvedByAdmin: adminActor,
                approvedAt: now,
                note: "user-create:inline-activation",
              },
            });
            if (planPurchaseType && planCharge > 0) {
              await tx.purchase.create({
                data: {
                  userId: createdUser.id,
                  type: planPurchaseType,
                  amount: planCharge,
                  slug: null,
                  purchasedAt: now,
                  approvedByAdmin: adminActor,
                  approvedAt: now,
                  note: "user-create:inline-activation",
                },
              });
            }
          }
        }

        if (tx.badgeApplication && typeof tx.badgeApplication.deleteMany === "function") {
          try {
            await tx.badgeApplication.deleteMany({
              where: {
                userId: createdUser.id,
                badgeType: { in: ["government", "unqx_staff"] },
              },
            });
            if (badgeTypes.length && typeof tx.badgeApplication.create === "function") {
              for (const nextBadgeType of badgeTypes) {
                await tx.badgeApplication.create({
                  data: {
                    userId: createdUser.id,
                    badgeType: nextBadgeType,
                    workplace: "Установлено менеджером",
                    role: "Системная отметка",
                    proofText: `manager:${adminActor || "staff"}`,
                    comment: "Badge set from user creation form",
                    status: "approved",
                    reviewedAt: now,
                  },
                });
              }
            }
          } catch (error) {
            if (!isMissingStorageError(error)) {
              throw error;
            }
          }
        }

        return {
          user: createdUser,
          activatedSlug,
          badgeType,
          badgeTypes,
          charges: {
            slug: slugCharge,
            plan: planCharge,
          },
        };
      });

      res.json({
        ok: true,
        user: result.user,
        badgeType: result.badgeType,
        badgeTypes: result.badgeTypes,
        activation: result.activatedSlug
          ? {
            slug: result.activatedSlug,
            charges: result.charges,
          }
          : null,
      });
    } catch (error) {
      if (error?.code === "SLUG_TAKEN") {
        res.status(409).json({ error: "Slug is already assigned to another user", code: "SLUG_TAKEN" });
        return;
      }
      if (error?.code === "SLUG_NOT_FREE") {
        res.status(409).json({
          error: "Slug is not free right now",
          code: "SLUG_NOT_FREE",
          status: error.status || null,
        });
        return;
      }
      if (error?.code === "P2002") {
        res.status(409).json({ error: "Login or email already taken", code: "LOGIN_OR_EMAIL_TAKEN" });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/users/:userId/card",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    const userColumns = await getUserColumns();
    const userSelect = {
      id: true,
      firstName: true,
      displayName: true,
      username: true,
      telegramUsername: true,
      email: true,
      login: true,
      city: true,
      plan: true,
      status: true,
      isVerified: true,
      verifiedCompany: true,
      createdAt: true,
    };
    if (hasUserColumn(userColumns, "profileType")) {
      userSelect.profileType = true;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const normalizedUser = {
      ...user,
      username: user.username || user.telegramUsername || null,
      profileType: normalizeProfileType(user.profileType, { fallback: "person" }),
    };

    let card;
    try {
      card = await findProfileCardByOwnerId(user.id);
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.status(503).json({ error: "Cards storage unavailable", code: "CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }

    const [slugs, pets, petCatalog] = await Promise.all([
      prisma.slug.findMany({
      where: { ownerId: user.id },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
        { fullSlug: "asc" },
      ],
      select: {
        fullSlug: true,
        status: true,
        isPrimary: true,
        requestedAt: true,
        approvedAt: true,
        activatedAt: true,
        createdAt: true,
      },
      }),
      listOwnedPetsByUserId(user.id),
      getPetCatalog(),
    ]);

    const effective = getEffectivePlan(user);
    res.json({
      user: normalizedUser,
      card: card ? parseProfileCardRow({ ...card, pets }) : null,
      pets,
      petCatalog,
      slugs,
      limits: {
        tags: getTagLimit(effective.plan),
        buttons: getButtonLimit(effective.plan),
      },
      themes: Array.from(PROFILE_THEMES),
    });
  }),
);

router.get(
  "/wall-posts",
  asyncHandler(async (req, res) => {
    const page = resolveWallPage(req.query.page);
    const pageSize = resolveWallPageSize(req.query.pageSize, WALL_ADMIN_PAGE_SIZE, 100);
    try {
      const payload = await listAllAdminWallPosts({
        page,
        pageSize,
        q: req.query.q,
        status: req.query.status,
        sort: req.query.sort,
      });
      res.json(payload);
    } catch (error) {
      if (isWallStorageMissing(error)) {
        res.json({
          items: [],
          pagination: { page, pageSize, total: 0, totalPages: 1, hasMore: false },
          filters: {
            q: String(req.query.q || "").trim(),
            status: String(req.query.status || "all").trim() || "all",
            sort: String(req.query.sort || "newest").trim() || "newest",
          },
        });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/users/:userId/wall-posts",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required", code: "USER_ID_REQUIRED" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const page = resolveWallPage(req.query.page);
    const pageSize = resolveWallPageSize(req.query.pageSize, WALL_ADMIN_PAGE_SIZE, 50);
    try {
      const payload = await listAdminWallPosts({
        ownerId: userId,
        page,
        pageSize,
      });
      res.json(payload);
    } catch (error) {
      if (isWallStorageMissing(error)) {
        res.json({
          items: [],
          pagination: { page, pageSize, total: 0, hasMore: false },
        });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/users/:userId/wall-posts/:postId",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required", code: "USER_ID_REQUIRED" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    try {
      const post = await updateWallPostAsAdmin({
        ownerId: userId,
        postId: req.params.postId,
        content: req.body?.content,
        status: req.body?.status,
      });
      res.json({ ok: true, post });
    } catch (error) {
      if (isWallStorageMissing(error)) {
        res.status(503).json({ error: "Wall storage unavailable", code: "WALL_STORAGE_UNAVAILABLE" });
        return;
      }
      if (error?.code === "WALL_POST_NOT_FOUND") {
        res.status(404).json({ error: "Пост не найден", code: error.code });
        return;
      }
      if (error?.code === "WALL_POST_CONTENT_REQUIRED") {
        res.status(400).json({ error: "Текст поста обязателен", code: error.code });
        return;
      }
      if (error?.code === "WALL_POST_STATUS_INVALID" || error?.code === "WALL_POST_NO_CHANGES") {
        res.status(400).json({ error: error.message || "Некорректное действие", code: error.code });
        return;
      }
      throw error;
    }
  }),
);

router.delete(
  "/users/:userId/wall-posts/:postId",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required", code: "USER_ID_REQUIRED" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    try {
      const post = await updateWallPostAsAdmin({
        ownerId: userId,
        postId: req.params.postId,
        status: "deleted",
      });
      res.json({ ok: true, post });
    } catch (error) {
      if (isWallStorageMissing(error)) {
        res.status(503).json({ error: "Wall storage unavailable", code: "WALL_STORAGE_UNAVAILABLE" });
        return;
      }
      if (error?.code === "WALL_POST_NOT_FOUND") {
        res.status(404).json({ error: "Пост не найден", code: error.code });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/users/:userId/profile",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const firstName = String(req.body?.firstName || "").trim().slice(0, 120);
    if (!firstName) {
      res.status(400).json({ error: "Name is required", code: "NAME_REQUIRED" });
      return;
    }
    const userColumns = await getUserColumns();
    const hasProfileTypeColumn = hasUserColumn(userColumns, "profileType");

    const displayNameRaw = String(req.body?.displayName || "").trim().slice(0, 120);
    const displayName = normalizeDisplayName(displayNameRaw, firstName);
    const city = normalizeCityOptional(req.body?.city);
    const telegramUsername = String(req.body?.telegramUsername || "")
      .replace(/^@+/, "")
      .trim()
      .slice(0, 120) || null;
    const email = normalizeEmail(req.body?.email);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email", code: "EMAIL_INVALID" });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        ...(hasProfileTypeColumn ? { profileType: true } : {}),
      },
    });
    if (!existingUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email, id: { not: userId } },
        select: { id: true },
      });
      if (existingEmail) {
        res.status(409).json({ error: "Email already taken", code: "EMAIL_TAKEN" });
        return;
      }
    }

    const nextUsername = existingUser.username || telegramUsername || null;
    const nextProfileType = normalizeProfileType(req.body?.profileType, {
      fallback: normalizeProfileType(existingUser.profileType, { fallback: "person" }),
    });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        displayName,
        city,
        telegramUsername,
        username: nextUsername,
        email: email || null,
        emailVerified: Boolean(email),
        pendingEmail: null,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        ...(hasProfileTypeColumn ? { profileType: nextProfileType } : {}),
      },
      select: {
        id: true,
        firstName: true,
        displayName: true,
        city: true,
        email: true,
        emailVerified: true,
        username: true,
        telegramUsername: true,
        ...(hasProfileTypeColumn ? { profileType: true } : {}),
      },
    });

    res.json({
      ok: true,
      user: {
        ...updated,
        profileType: normalizeProfileType(updated.profileType, { fallback: "person" }),
      },
    });
  }),
);

router.post(
  "/users/:userId/slugs",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const nextSlug = normalizeShortSlug(req.body?.slug);
    if (!isShortSlug(nextSlug)) {
      sendAssignableSlugValidationError(res, nextSlug);
      return;
    }
    const calculatedSlugPrice = await getCalculatedShortSlugPrice(nextSlug);
    const storageParts = getSlugStorageParts(nextSlug);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, plan: true },
        });
        if (!user) {
          const error = new Error("User not found");
          error.code = "USER_NOT_FOUND";
          throw error;
        }

        const ownedSlugs = await tx.slug.findMany({
          where: { ownerId: userId },
          select: { fullSlug: true, isPrimary: true },
        });
        if (ownedSlugs.some((row) => row.fullSlug === nextSlug)) {
          const error = new Error("User already owns this slug");
          error.code = "SLUG_ALREADY_OWNED";
          throw error;
        }

        const slugLimit = getSlugLimit(getEffectivePlan(user).plan);
        if (ownedSlugs.length >= slugLimit) {
          const error = new Error("Slug limit reached for current plan");
          error.code = "SLUG_LIMIT_REACHED";
          error.slugLimit = slugLimit;
          error.currentSlugCount = ownedSlugs.length;
          error.ownedSlugs = ownedSlugs.map((row) => row.fullSlug);
          throw error;
        }

        const existing = await tx.slug.findUnique({
          where: { fullSlug: nextSlug },
          select: { fullSlug: true, ownerId: true, status: true },
        });
        if (existing?.ownerId && existing.ownerId !== userId) {
          const error = new Error("Slug is already assigned to another user");
          error.code = "SLUG_TAKEN";
          throw error;
        }
        if (existing && !existing.ownerId && existing.status !== "free") {
          const error = new Error("Slug is not free right now");
          error.code = "SLUG_NOT_FREE";
          error.status = existing.status;
          throw error;
        }

        const hasPrimary = ownedSlugs.some((row) => row.isPrimary);
        const shouldBePrimary = !hasPrimary;
        const hasCard = await tx.profileCard.findUnique({
          where: { ownerId: userId },
          select: { ownerId: true },
        });
        const now = new Date();
        const nextStatus = hasCard ? "active" : "approved";

        if (shouldBePrimary) {
          await tx.slug.updateMany({
            where: { ownerId: userId },
            data: { isPrimary: false },
          });
        }

        const payload = {
          ownerId: userId,
          status: nextStatus,
          isPrimary: shouldBePrimary,
          price: isLegacySlug(nextSlug) ? calculatedSlugPrice : null,
          pauseMessage: null,
          pendingExpiresAt: null,
          requestedAt: now,
          approvedAt: now,
          activatedAt: nextStatus === "active" ? now : null,
        };

        const slugSelect = {
          fullSlug: true,
          ownerId: true,
          status: true,
          isPrimary: true,
          requestedAt: true,
          approvedAt: true,
          activatedAt: true,
        };

        let slugRow;
        if (existing) {
          const claimed = await tx.slug.updateMany({
            where: {
              fullSlug: nextSlug,
              ownerId: null,
              status: "free",
            },
            data: payload,
          });
          if (!claimed.count) {
            const refreshed = await tx.slug.findUnique({
              where: { fullSlug: nextSlug },
              select: { ownerId: true, status: true },
            });
            if (refreshed?.ownerId && refreshed.ownerId !== userId) {
              const error = new Error("Slug is already assigned to another user");
              error.code = "SLUG_TAKEN";
              throw error;
            }
            if (refreshed?.ownerId === userId) {
              const error = new Error("User already owns this slug");
              error.code = "SLUG_ALREADY_OWNED";
              throw error;
            }
            const error = new Error("Slug is not free right now");
            error.code = "SLUG_NOT_FREE";
            error.status = refreshed?.status || null;
            throw error;
          }
          slugRow = await tx.slug.findUnique({
            where: { fullSlug: nextSlug },
            select: slugSelect,
          });
          if (!slugRow) {
            const error = new Error("Slug is not free right now");
            error.code = "SLUG_NOT_FREE";
            throw error;
          }
        } else {
          try {
            slugRow = await tx.slug.create({
              data: {
                letters: storageParts.letters,
                digits: storageParts.digits,
                fullSlug: nextSlug,
                ...payload,
              },
              select: slugSelect,
            });
          } catch (createError) {
            if (createError?.code === "P2002") {
              const error = new Error("Slug is already assigned to another user");
              error.code = "SLUG_TAKEN";
              throw error;
            }
            throw createError;
          }
        }

        return slugRow;
      });

      await safeRecalculateScore(userId);
      res.json({ ok: true, slug: result });
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      if (error?.code === "SLUG_ALREADY_OWNED") {
        res.status(409).json({ error: "User already owns this slug", code: "SLUG_ALREADY_OWNED" });
        return;
      }
      if (error?.code === "SLUG_TAKEN") {
        res.status(409).json({ error: "Slug is already assigned to another user", code: "SLUG_TAKEN" });
        return;
      }
      if (error?.code === "SLUG_NOT_FREE") {
        res.status(409).json({
          error: "Slug is not free right now",
          code: "SLUG_NOT_FREE",
          status: error.status || null,
        });
        return;
      }
      if (error?.code === "SLUG_LIMIT_REACHED") {
        res.status(409).json({
          error: "Slug limit reached for current plan",
          code: "SLUG_LIMIT_REACHED",
          slugLimit: Number(error.slugLimit || 0),
          currentSlugCount: Number(error.currentSlugCount || 0),
          ownedSlugs: Array.isArray(error.ownedSlugs) ? error.ownedSlugs : [],
        });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/users/:userId/slugs/:slug",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const currentSlug = normalizeShortSlug(req.params.slug);
    const nextSlug = normalizeShortSlug(req.body?.slug);
    if (!isShortSlug(currentSlug)) {
      sendAssignableSlugValidationError(res, currentSlug, { prefix: "CURRENT_SLUG" });
      return;
    }
    if (!isShortSlug(nextSlug)) {
      sendAssignableSlugValidationError(res, nextSlug, { prefix: "TARGET_SLUG" });
      return;
    }
    if (currentSlug === nextSlug) {
      res.status(400).json({ error: "New slug must differ from current slug" });
      return;
    }
    const calculatedSlugPrice = await getCalculatedShortSlugPrice(nextSlug);
    const storageParts = getSlugStorageParts(nextSlug);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user) {
          const error = new Error("User not found");
          error.code = "USER_NOT_FOUND";
          throw error;
        }

        const current = await tx.slug.findUnique({
          where: { fullSlug: currentSlug },
          select: {
            fullSlug: true,
            ownerId: true,
            status: true,
            isPrimary: true,
            pauseMessage: true,
            requestedAt: true,
            approvedAt: true,
            activatedAt: true,
            pendingExpiresAt: true,
            analyticsViewsCount: true,
          },
        });
        if (!current || current.ownerId !== userId) {
          const error = new Error("User does not own current slug");
          error.code = "CURRENT_SLUG_NOT_OWNED";
          throw error;
        }

        const target = await tx.slug.findUnique({
          where: { fullSlug: nextSlug },
          select: { fullSlug: true, ownerId: true, status: true },
        });
        if (target?.ownerId && target.ownerId !== userId) {
          const error = new Error("New slug is already assigned to another user");
          error.code = "TARGET_SLUG_TAKEN";
          throw error;
        }
        if (target?.ownerId === userId) {
          const error = new Error("User already owns target slug");
          error.code = "TARGET_SLUG_ALREADY_OWNED";
          throw error;
        }
        if (target && !target.ownerId && target.status !== "free") {
          const error = new Error("New slug is not free right now");
          error.code = "TARGET_SLUG_NOT_FREE";
          error.status = target.status;
          throw error;
        }

        const transferPayload = {
          ownerId: userId,
          status: current.status,
          isPrimary: current.isPrimary,
          price: isLegacySlug(nextSlug) ? calculatedSlugPrice : null,
          pauseMessage: current.pauseMessage,
          requestedAt: current.requestedAt,
          approvedAt: current.approvedAt,
          activatedAt: current.activatedAt,
          pendingExpiresAt: current.pendingExpiresAt,
        };

        const slugSelect = {
          fullSlug: true,
          ownerId: true,
          status: true,
          isPrimary: true,
          requestedAt: true,
          approvedAt: true,
          activatedAt: true,
          analyticsViewsCount: true,
        };
        let replacement;
        if (target) {
          const claimed = await tx.slug.updateMany({
            where: {
              fullSlug: nextSlug,
              ownerId: null,
              status: "free",
            },
            data: transferPayload,
          });
          if (!claimed.count) {
            const refreshed = await tx.slug.findUnique({
              where: { fullSlug: nextSlug },
              select: { ownerId: true, status: true },
            });
            if (refreshed?.ownerId && refreshed.ownerId !== userId) {
              const error = new Error("New slug is already assigned to another user");
              error.code = "TARGET_SLUG_TAKEN";
              throw error;
            }
            if (refreshed?.ownerId === userId) {
              const error = new Error("User already owns target slug");
              error.code = "TARGET_SLUG_ALREADY_OWNED";
              throw error;
            }
            const error = new Error("New slug is not free right now");
            error.code = "TARGET_SLUG_NOT_FREE";
            error.status = refreshed?.status || null;
            throw error;
          }
          replacement = await tx.slug.findUnique({
            where: { fullSlug: nextSlug },
            select: slugSelect,
          });
          if (!replacement) {
            const error = new Error("New slug is not free right now");
            error.code = "TARGET_SLUG_NOT_FREE";
            throw error;
          }
        } else {
          try {
            replacement = await tx.slug.create({
              data: {
                letters: storageParts.letters,
                digits: storageParts.digits,
                fullSlug: nextSlug,
                ...transferPayload,
              },
              select: slugSelect,
            });
          } catch (createError) {
            if (createError?.code === "P2002") {
              const error = new Error("New slug is already assigned to another user");
              error.code = "TARGET_SLUG_TAKEN";
              throw error;
            }
            throw createError;
          }
        }

        await tx.slug.update({
          where: { fullSlug: currentSlug },
          data: {
            ownerId: null,
            status: "free",
            isPrimary: false,
            pauseMessage: null,
            requestedAt: null,
            approvedAt: null,
            activatedAt: null,
            pendingExpiresAt: null,
            analyticsViewsCount: 0,
          },
        });

        const safeTxUpdateMany = async (fn) => {
          try {
            return await fn();
          } catch (error) {
            if (isTableOrColumnMissing(error)) {
              return { count: 0 };
            }
            throw error;
          }
        };

        if (tx.analyticsView && typeof tx.analyticsView.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.analyticsView.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.analyticsClick && typeof tx.analyticsClick.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.analyticsClick.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.slugRequest && typeof tx.slugRequest.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.slugRequest.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.purchase && typeof tx.purchase.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.purchase.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.braceletOrder && typeof tx.braceletOrder.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.braceletOrder.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.verificationRequest && typeof tx.verificationRequest.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.verificationRequest.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.testimonial && typeof tx.testimonial.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.testimonial.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.slugCheckerLog && typeof tx.slugCheckerLog.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.slugCheckerLog.updateMany({
              where: { slug: currentSlug },
              data: { slug: replacement.fullSlug },
            }),
          );
        }
        if (tx.leaderboardSuspiciousLog && typeof tx.leaderboardSuspiciousLog.updateMany === "function") {
          await safeTxUpdateMany(() =>
            tx.leaderboardSuspiciousLog.updateMany({
              where: { fullSlug: currentSlug },
              data: { fullSlug: replacement.fullSlug },
            }),
          );
        }

        if (tx.directoryExclusion && typeof tx.directoryExclusion.findUnique === "function") {
          const [currentDir, targetDir] = await Promise.all([
            tx.directoryExclusion.findUnique({ where: { slug: currentSlug }, select: { slug: true } }),
            tx.directoryExclusion.findUnique({ where: { slug: replacement.fullSlug }, select: { slug: true } }),
          ]);
          if (currentDir && targetDir) {
            await safeTxUpdateMany(() => tx.directoryExclusion.deleteMany({ where: { slug: currentSlug } }));
          } else if (currentDir) {
            await safeTxUpdateMany(() =>
              tx.directoryExclusion.updateMany({
                where: { slug: currentSlug },
                data: { slug: replacement.fullSlug },
              }),
            );
          }
        }

        if (tx.leaderboardExclusion && typeof tx.leaderboardExclusion.findUnique === "function") {
          const [currentLb, targetLb] = await Promise.all([
            tx.leaderboardExclusion.findUnique({ where: { fullSlug: currentSlug }, select: { fullSlug: true } }),
            tx.leaderboardExclusion.findUnique({ where: { fullSlug: replacement.fullSlug }, select: { fullSlug: true } }),
          ]);
          if (currentLb && targetLb) {
            await safeTxUpdateMany(() => tx.leaderboardExclusion.deleteMany({ where: { fullSlug: currentSlug } }));
          } else if (currentLb) {
            await safeTxUpdateMany(() =>
              tx.leaderboardExclusion.updateMany({
                where: { fullSlug: currentSlug },
                data: { fullSlug: replacement.fullSlug },
              }),
            );
          }
        }

        const currentViewsCount = Number(current.analyticsViewsCount || 0);
        if (currentViewsCount > 0) {
          await tx.slug.update({
            where: { fullSlug: replacement.fullSlug },
            data: { analyticsViewsCount: { increment: currentViewsCount } },
          });
          replacement.analyticsViewsCount = Number(replacement.analyticsViewsCount || 0) + currentViewsCount;
        }

        if (replacement.isPrimary) {
          await tx.slug.updateMany({
            where: {
              ownerId: userId,
              fullSlug: { not: replacement.fullSlug },
            },
            data: { isPrimary: false },
          });
        }

        return replacement;
      });

      await safeExecuteRaw(
        `
        UPDATE slug_views
        SET slug = $1
        WHERE slug = $2
        `,
        result.fullSlug,
        currentSlug,
      );
      await safeExecuteRaw(
        `
        UPDATE slug_clicks
        SET slug = $1
        WHERE slug = $2
        `,
        result.fullSlug,
        currentSlug,
      );
      await safeExecuteRaw(
        `
        UPDATE views_log
        SET slug = $1
        WHERE slug = $2
        `,
        result.fullSlug,
        currentSlug,
      );
      await safeExecuteRaw(
        `
        UPDATE tap_events
        SET owner_slug = $1
        WHERE owner_slug = $2
        `,
        result.fullSlug,
        currentSlug,
      );
      await safeExecuteRaw(
        `
        UPDATE tap_events
        SET visitor_slug = $1
        WHERE visitor_slug = $2
        `,
        result.fullSlug,
        currentSlug,
      );
      await safeExecuteRaw(
        `
        UPDATE user_contacts
        SET contact_slug = $1
        WHERE contact_slug = $2
        `,
        result.fullSlug,
        currentSlug,
      );

      await safeRecalculateScore(userId);
      res.json({
        ok: true,
        previousSlug: currentSlug,
        slug: result,
      });
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      if (error?.code === "CURRENT_SLUG_NOT_OWNED") {
        res.status(404).json({ error: "Current slug is not owned by this user", code: "CURRENT_SLUG_NOT_OWNED" });
        return;
      }
      if (error?.code === "TARGET_SLUG_TAKEN") {
        res.status(409).json({ error: "New slug is already assigned to another user", code: "TARGET_SLUG_TAKEN" });
        return;
      }
      if (error?.code === "TARGET_SLUG_ALREADY_OWNED") {
        res.status(409).json({ error: "User already owns target slug", code: "TARGET_SLUG_ALREADY_OWNED" });
        return;
      }
      if (error?.code === "TARGET_SLUG_NOT_FREE") {
        res.status(409).json({
          error: "New slug is not free right now",
          code: "TARGET_SLUG_NOT_FREE",
          status: error.status || null,
        });
        return;
      }
      throw error;
    }
  }),
);

router.delete(
  "/users/:userId/slugs/:slug",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const targetSlug = normalizeShortSlug(req.params.slug);
    if (!isShortSlug(targetSlug)) {
      sendAssignableSlugValidationError(res, targetSlug, { prefix: "TARGET_SLUG" });
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user) {
          const error = new Error("User not found");
          error.code = "USER_NOT_FOUND";
          throw error;
        }

        const current = await tx.slug.findUnique({
          where: { fullSlug: targetSlug },
          select: {
            fullSlug: true,
            ownerId: true,
            isPrimary: true,
          },
        });
        if (!current || current.ownerId !== userId) {
          const error = new Error("User does not own target slug");
          error.code = "TARGET_SLUG_NOT_OWNED";
          throw error;
        }

        await tx.slug.update({
          where: { fullSlug: targetSlug },
          data: {
            ownerId: null,
            status: "free",
            isPrimary: false,
            pauseMessage: null,
            pendingExpiresAt: null,
            approvedAt: null,
            requestedAt: null,
            activatedAt: null,
            analyticsViewsCount: 0,
          },
        });

        let deletedAnalyticsViews = 0;
        let deletedAnalyticsClicks = 0;
        if (tx.analyticsView && typeof tx.analyticsView.deleteMany === "function") {
          const viewsResult = await tx.analyticsView.deleteMany({
            where: { slug: targetSlug },
          });
          deletedAnalyticsViews = Number(viewsResult?.count || 0);
        }
        if (tx.analyticsClick && typeof tx.analyticsClick.deleteMany === "function") {
          const clicksResult = await tx.analyticsClick.deleteMany({
            where: { slug: targetSlug },
          });
          deletedAnalyticsClicks = Number(clicksResult?.count || 0);
        }

        const rawCleanup = {
          slugViewsLegacy: 0,
          slugClicksLegacy: 0,
          viewsLogLegacy: 0,
          directoryExclusions: 0,
          leaderboardExclusions: 0,
          leaderboardSuspicious: 0,
        };
        const remaining = await tx.slug.findMany({
          where: { ownerId: userId },
          select: {
            fullSlug: true,
            isPrimary: true,
            status: true,
            createdAt: true,
          },
        });

        let nextPrimarySlug = null;
        const hasPrimary = remaining.some((row) => row.isPrimary);
        if (remaining.length && (current.isPrimary || !hasPrimary)) {
          const rank = (status) =>
            status === "active" || status === "private" || status === "paused" || status === "approved" ? 0 : 1;
          const sorted = [...remaining].sort((left, right) => {
            const byRank = rank(left.status) - rank(right.status);
            if (byRank !== 0) return byRank;
            const byCreatedAt = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            if (byCreatedAt !== 0) return byCreatedAt;
            return String(left.fullSlug).localeCompare(String(right.fullSlug));
          });
          const nextPrimary = sorted[0] || null;
          if (nextPrimary) {
            await tx.slug.updateMany({
              where: { ownerId: userId },
              data: { isPrimary: false },
            });
            await tx.slug.update({
              where: { fullSlug: nextPrimary.fullSlug },
              data: { isPrimary: true },
            });
            nextPrimarySlug = nextPrimary.fullSlug;
          }
        } else if (hasPrimary) {
          nextPrimarySlug = remaining.find((row) => row.isPrimary)?.fullSlug || null;
        }

        return {
          deletedSlug: targetSlug,
          nextPrimarySlug,
          deletedAnalytics: {
            analyticsViews: deletedAnalyticsViews,
            analyticsClicks: deletedAnalyticsClicks,
            ...rawCleanup,
          },
        };
      });

      result.deletedAnalytics.slugViewsLegacy = Number(
        await safeExecuteRaw(
          `
          DELETE FROM slug_views
          WHERE slug = $1
          `,
          targetSlug,
        ),
      );
      result.deletedAnalytics.slugClicksLegacy = Number(
        await safeExecuteRaw(
          `
          DELETE FROM slug_clicks
          WHERE slug = $1
          `,
          targetSlug,
        ),
      );
      result.deletedAnalytics.viewsLogLegacy = Number(
        await safeExecuteRaw(
          `
          DELETE FROM views_log
          WHERE slug = $1
          `,
          targetSlug,
        ),
      );
      result.deletedAnalytics.directoryExclusions = Number(
        await safeExecuteRaw(
          `
          DELETE FROM directory_exclusions
          WHERE slug = $1
          `,
          targetSlug,
        ),
      );
      result.deletedAnalytics.leaderboardExclusions = Number(
        await safeExecuteRaw(
          `
          DELETE FROM leaderboard_exclusions
          WHERE full_slug = $1
          `,
          targetSlug,
        ),
      );
      result.deletedAnalytics.leaderboardSuspicious = Number(
        await safeExecuteRaw(
          `
          DELETE FROM leaderboard_suspicious_log
          WHERE full_slug = $1
          `,
          targetSlug,
        ),
      );

      await safeRecalculateScore(userId);
      res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      if (error?.code === "TARGET_SLUG_NOT_OWNED") {
        res.status(404).json({ error: "Target slug is not owned by this user", code: "TARGET_SLUG_NOT_OWNED" });
        return;
      }
      throw error;
    }
  }),
);

router.put(
  "/users/:userId/card",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: buildPublicHandleUserSelect({ includeProfileCard: false }),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!canCreateCard(user)) {
      res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
      return;
    }

    const effective = getEffectivePlan(user);
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const role = String(body.role || "").trim().slice(0, 120) || null;
    const company = String(body.company || "").trim().slice(0, 160) || null;
    const bio = String(body.bio || "").trim().slice(0, 120) || null;
    const hashtag = String(body.hashtag || "").trim().slice(0, 50) || null;
    const address = String(body.address || "").trim() || null;
    const postcode = String(body.postcode || "").trim().slice(0, 20) || null;
    const email = String(body.email || "").trim().slice(0, 100) || null;
    const extraPhone = String(body.extraPhone || "").trim().slice(0, 30) || null;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    const rawTags = Array.isArray(body.tags) ? body.tags : [];
    const rawButtons = Array.isArray(body.buttons) ? body.buttons : [];
    if (effective.plan !== "premium" && rawTags.length > getTagLimit("none")) {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }
    if (effective.plan !== "premium" && rawButtons.length > getButtonLimit("none")) {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }
    const tags = normalizeTags(body.tags, effective.plan);
    const buttons = normalizeButtons(body.buttons, effective.plan);
    const theme = normalizeThemeByPlan(body.theme, effective.plan);
    const themeForDatabase = await normalizeCardThemeForDatabase(theme);
    const customColor = effective.plan === "premium" ? normalizeColor(body.customColor) : null;
    const hasAvatarFrameInput = Object.prototype.hasOwnProperty.call(body, "avatarFrame");
    const hasEmojiBackgroundPackInput = Object.prototype.hasOwnProperty.call(body, "emojiBackgroundPack");
    const currentCard =
      hasAvatarFrameInput && hasEmojiBackgroundPackInput ? null : await findProfileCardByOwnerId(user.id);
    const avatarFrame = hasAvatarFrameInput
      ? normalizeAvatarFrameByPlan(body.avatarFrame, effective.plan)
      : normalizeAvatarFrameByPlan(currentCard?.avatarFrame, effective.plan);
    const emojiBackgroundPack = hasEmojiBackgroundPackInput
      ? normalizeEmojiBackgroundByPlan(body.emojiBackgroundPack, effective.plan)
      : normalizeEmojiBackgroundByPlan(currentCard?.emojiBackgroundPack, effective.plan);
    const showBranding = effective.plan === "premium" ? Boolean(body.showBranding) : true;

    if (effective.plan !== "premium") {
      const requestedTheme = String(body.theme || "").trim();
      if (requestedTheme && requestedTheme !== "default_dark") {
        res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
        return;
      }
      const requestedAvatarFrame = String(body.avatarFrame || "").trim().toLowerCase();
      if (requestedAvatarFrame && requestedAvatarFrame !== "none") {
        res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
        return;
      }
      const requestedEmojiBackgroundPack = String(body.emojiBackgroundPack || "").trim().toLowerCase();
      if (requestedEmojiBackgroundPack && requestedEmojiBackgroundPack !== "none") {
        res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
        return;
      }
    }

    let saved;
    try {
      saved = await saveAdminCardCompatForOwner(user.id, {
        ...body,
        name,
        verifiedCompany: company,
        role,
        bio,
        hashtag,
        address,
        postcode,
        email,
        extraPhone,
        tags,
        buttons,
        theme: themeForDatabase,
        customColor,
        avatarFrame,
        emojiBackgroundPack,
        showBranding,
        pets: Array.isArray(body.pets) ? body.pets : [],
      });

      await prisma.slug.updateMany({
        where: {
          ownerId: user.id,
          status: "approved",
        },
        data: {
          status: "active",
          activatedAt: new Date(),
        },
      });
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.status(503).json({ error: "Cards storage unavailable", code: "CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }

    const detail = buildAdminCardDetailResponse(saved);
    res.json({
      ok: true,
      card: detail?.card || null,
      pets: detail?.pets || [],
      user: {
        id: user.id,
        verifiedCompany: detail?.verification?.verifiedCompany || company,
      },
    });
  }),
);

router.post(
  "/users/:userId/card/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: buildPublicHandleUserSelect({ includeProfileCard: false }),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!canCreateCard(user)) {
      res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
      return;
    }

    const card = await findProfileCardByOwnerId(user.id);
    if (!card) {
      res.status(400).json({ error: "Сначала сохрани визитку" });
      return;
    }

    if (!req.file || !ALLOWED_MIME.has(req.file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const okBuffer = await isSupportedAvatarBuffer(req.file.buffer);
    if (!okBuffer) {
      res.status(400).json({ error: "Invalid image payload" });
      return;
    }

    const avatarSlug = buildAvatarSlug(`profile_${String(user.id)}`);
    const avatarUrl = await saveAvatarFromBuffer(avatarSlug, req.file.buffer);
    if (card.avatarUrl && card.avatarUrl !== avatarUrl) {
      await safeDeleteAvatarByPublicPath(card.avatarUrl);
    }

    await prisma.$executeRaw`
      UPDATE profile_cards
      SET avatar_url = ${avatarUrl},
          updated_at = now()
      WHERE owner_id = ${user.id}
    `;

    res.json({ ok: true, avatarUrl });
  }),
);

router.delete(
  "/users/:userId/card/avatar",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: buildPublicHandleUserSelect({ includeProfileCard: false }),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!canCreateCard(user)) {
      res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
      return;
    }

    const card = await findProfileCardByOwnerId(user.id);
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    if (card.avatarUrl) {
      await safeDeleteAvatarByPublicPath(card.avatarUrl);
    }

    await prisma.$executeRaw`
      UPDATE profile_cards
      SET avatar_url = NULL,
          updated_at = now()
      WHERE owner_id = ${user.id}
    `;

    res.json({ ok: true, avatarUrl: "" });
  }),
);

/* ─── Payment Cards CRUD ─── */

router.get(
  "/users/:userId/payment-cards",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }
    const rows = await prisma.$queryRaw`
      SELECT
        id, number, owner_id AS "ownerId", name, role, bio, hashtag,
        address, postcode, email, extra_phone AS "extraPhone",
        avatar_url AS "avatarUrl", tags, buttons, theme,
        custom_color AS "customColor", show_branding AS "showBranding",
        views_count AS "viewsCount",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM payment_cards
      WHERE owner_id = ${userId}
      ORDER BY number ASC
    `;

    // Load profile card for pre-fill defaults
    const profileRows = await prisma.$queryRaw`
      SELECT name, avatar_url AS "avatarUrl"
      FROM profile_cards
      WHERE owner_id = ${userId}
      LIMIT 1
    `;
    const profileCard = Array.isArray(profileRows) ? profileRows[0] || null : null;

    res.json({
      ok: true,
      paymentCards: Array.isArray(rows) ? rows : [],
      profileDefaults: profileCard ? { name: profileCard.name || "", avatarUrl: profileCard.avatarUrl || "" } : null,
    });
  }),
);

router.post(
  "/users/:userId/payment-cards",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: buildPublicHandleUserSelect({ includeProfileCard: false }),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!canCreateCard(user)) {
      res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
      return;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const number = Number(body.number);
    if (!Number.isInteger(number) || number < 0) {
      res.status(400).json({ error: "Number must be a non-negative integer" });
      return;
    }

    // Check uniqueness
    const existing = await prisma.$queryRaw`
      SELECT id FROM payment_cards WHERE number = ${number} LIMIT 1
    `;
    if (Array.isArray(existing) && existing.length > 0) {
      res.status(409).json({ error: "Этот номер уже занят", code: "NUMBER_TAKEN" });
      return;
    }

    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const role = String(body.role || "").trim().slice(0, 120) || null;
    const bio = String(body.bio || "").trim().slice(0, 120) || null;
    const hashtag = String(body.hashtag || "").trim().slice(0, 50) || null;
    const address = String(body.address || "").trim() || null;
    const postcode = String(body.postcode || "").trim().slice(0, 20) || null;
    const email = String(body.email || "").trim().slice(0, 100) || null;
    const extraPhone = String(body.extraPhone || "").trim().slice(0, 30) || null;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    const tags = normalizeTags(body.tags, "premium");
    const buttons = normalizeButtons(body.buttons, "premium");

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO payment_cards (id, number, owner_id, name, role, bio, hashtag, address, postcode, email, extra_phone, tags, buttons, theme, show_branding, created_at, updated_at)
      VALUES (${id}::uuid, ${number}, ${userId}::uuid, ${name}, ${role}, ${bio}, ${hashtag}, ${address}, ${postcode}, ${email}, ${extraPhone}, ${JSON.stringify(tags)}::jsonb, ${JSON.stringify(buttons)}::jsonb, 'marble', true, now(), now())
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        id, number, owner_id AS "ownerId", name, role, bio, hashtag,
        address, postcode, email, extra_phone AS "extraPhone",
        avatar_url AS "avatarUrl", tags, buttons, theme,
        custom_color AS "customColor", show_branding AS "showBranding",
        views_count AS "viewsCount",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM payment_cards WHERE id = ${id}::uuid LIMIT 1
    `;
    res.json({ ok: true, paymentCard: rows[0] || null });
  }),
);

router.put(
  "/payment-cards/:id",
  asyncHandler(async (req, res) => {
    const cardId = String(req.params.id || "").trim();
    if (!cardId) {
      res.status(400).json({ error: "Card id is required" });
      return;
    }

    const cardRows = await prisma.$queryRaw`
      SELECT id, owner_id AS "ownerId" FROM payment_cards WHERE id = ${cardId}::uuid LIMIT 1
    `;
    const card = Array.isArray(cardRows) ? cardRows[0] || null : null;
    if (!card) {
      res.status(404).json({ error: "Payment card not found" });
      return;
    }

    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, card.ownerId);
      if (!ownsUser) {
        res.status(404).json({ error: "Payment card not found" });
        return;
      }
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const role = String(body.role || "").trim().slice(0, 120) || null;
    const bio = String(body.bio || "").trim().slice(0, 120) || null;
    const hashtag = String(body.hashtag || "").trim().slice(0, 50) || null;
    const address = String(body.address || "").trim() || null;
    const postcode = String(body.postcode || "").trim().slice(0, 20) || null;
    const email = String(body.email || "").trim().slice(0, 100) || null;
    const extraPhone = String(body.extraPhone || "").trim().slice(0, 30) || null;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    const tags = normalizeTags(body.tags, "premium");
    const buttons = normalizeButtons(body.buttons, "premium");

    await prisma.$executeRaw`
      UPDATE payment_cards
      SET name = ${name}, role = ${role}, bio = ${bio}, hashtag = ${hashtag},
          address = ${address}, postcode = ${postcode}, email = ${email},
          extra_phone = ${extraPhone},
          tags = ${JSON.stringify(tags)}::jsonb, buttons = ${JSON.stringify(buttons)}::jsonb,
          theme = 'marble', updated_at = now()
      WHERE id = ${cardId}::uuid
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        id, number, owner_id AS "ownerId", name, role, bio, hashtag,
        address, postcode, email, extra_phone AS "extraPhone",
        avatar_url AS "avatarUrl", tags, buttons, theme,
        custom_color AS "customColor", show_branding AS "showBranding",
        views_count AS "viewsCount",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM payment_cards WHERE id = ${cardId}::uuid LIMIT 1
    `;
    res.json({ ok: true, paymentCard: rows[0] || null });
  }),
);

router.delete(
  "/payment-cards/:id",
  asyncHandler(async (req, res) => {
    const cardId = String(req.params.id || "").trim();
    if (!cardId) {
      res.status(400).json({ error: "Card id is required" });
      return;
    }

    const cardRows = await prisma.$queryRaw`
      SELECT id, owner_id AS "ownerId", avatar_url AS "avatarUrl" FROM payment_cards WHERE id = ${cardId}::uuid LIMIT 1
    `;
    const card = Array.isArray(cardRows) ? cardRows[0] || null : null;
    if (!card) {
      res.status(404).json({ error: "Payment card not found" });
      return;
    }

    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, card.ownerId);
      if (!ownsUser) {
        res.status(404).json({ error: "Payment card not found" });
        return;
      }
    }

    if (card.avatarUrl) {
      await safeDeletePaymentCardAvatar(card.avatarUrl, card.id);
    }

    await prisma.$executeRaw`DELETE FROM payment_cards WHERE id = ${cardId}::uuid`;
    res.json({ ok: true });
  }),
);

router.post(
  "/payment-cards/:id/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const cardId = String(req.params.id || "").trim();
    if (!cardId) {
      res.status(400).json({ error: "Card id is required" });
      return;
    }

    const cardRows = await prisma.$queryRaw`
      SELECT id, owner_id AS "ownerId", avatar_url AS "avatarUrl" FROM payment_cards WHERE id = ${cardId}::uuid LIMIT 1
    `;
    const card = Array.isArray(cardRows) ? cardRows[0] || null : null;
    if (!card) {
      res.status(404).json({ error: "Payment card not found" });
      return;
    }

    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, card.ownerId);
      if (!ownsUser) {
        res.status(404).json({ error: "Payment card not found" });
        return;
      }
    }

    if (!req.file || !ALLOWED_MIME.has(req.file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const okBuffer = await isSupportedAvatarBuffer(req.file.buffer);
    if (!okBuffer) {
      res.status(400).json({ error: "Invalid image payload" });
      return;
    }

    const avatarSlug = buildAvatarSlug(`paycard_${cardId}`);
    const avatarUrl = await saveAvatarFromBuffer(avatarSlug, req.file.buffer);
    if (card.avatarUrl && card.avatarUrl !== avatarUrl) {
      await safeDeletePaymentCardAvatar(card.avatarUrl, card.id);
    }

    await prisma.$executeRaw`
      UPDATE payment_cards SET avatar_url = ${avatarUrl}, updated_at = now()
      WHERE id = ${cardId}::uuid
    `;

    res.json({ ok: true, avatarUrl });
  }),
);

router.delete(
  "/payment-cards/:id/avatar",
  asyncHandler(async (req, res) => {
    const cardId = String(req.params.id || "").trim();
    if (!cardId) {
      res.status(400).json({ error: "Card id is required" });
      return;
    }

    const cardRows = await prisma.$queryRaw`
      SELECT id, owner_id AS "ownerId", avatar_url AS "avatarUrl" FROM payment_cards WHERE id = ${cardId}::uuid LIMIT 1
    `;
    const card = Array.isArray(cardRows) ? cardRows[0] || null : null;
    if (!card) {
      res.status(404).json({ error: "Payment card not found" });
      return;
    }

    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, card.ownerId);
      if (!ownsUser) {
        res.status(404).json({ error: "Payment card not found" });
        return;
      }
    }

    if (card.avatarUrl) {
      await safeDeletePaymentCardAvatar(card.avatarUrl, card.id);
    }

    await prisma.$executeRaw`
      UPDATE payment_cards SET avatar_url = NULL, updated_at = now()
      WHERE id = ${cardId}::uuid
    `;

    res.json({ ok: true, avatarUrl: "" });
  }),
);

router.patch(
  "/users/:userId/login",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "").trim();
    const login = normalizeLogin(req.body?.login);
    if (!userId || !login || !isValidLogin(login)) {
      res.status(400).json({ error: "Invalid login", code: "LOGIN_INVALID" });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { login },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: "Login already taken", code: "LOGIN_TAKEN" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { login },
      select: { id: true, login: true },
    });
    res.json({ ok: true, user: updated });
  }),
);

router.patch(
  "/users/:userId/password",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "").trim();
    const password = String(req.body?.password || "");
    if (!userId || !password || password.length < 8) {
      res.status(400).json({ error: "Invalid password", code: "VALIDATION_ERROR" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
      select: { id: true },
    });
    res.json({ ok: true });
  }),
);

router.patch(
  "/users/:userId/plan",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    const plan = normalizeUserPlan(req.body.plan);
    const reason = String(req.body.reason || "").trim();
    const now = new Date();
    const requestedExpiryRaw = req.body.subscriptionExpiresAt;
    let requestedExpiry = null;
    if (requestedExpiryRaw !== undefined && requestedExpiryRaw !== null && String(requestedExpiryRaw).trim()) {
      const parsed = new Date(requestedExpiryRaw);
      if (!Number.isFinite(parsed.getTime())) {
        res.status(400).json({ error: "Invalid subscription expiry date", code: "SUBSCRIPTION_EXPIRES_AT_INVALID" });
        return;
      }
      requestedExpiry = parsed;
    }
    if (!reason) {
      res.status(400).json({ error: "Reason is required", code: "PLAN_CHANGE_REASON_REQUIRED" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          plan: true,
          planPurchasedAt: true,
          planUpgradedAt: true,
          subscriptionStartedAt: true,
          subscriptionRenewedAt: true,
          subscriptionExpiresAt: true,
        },
      });
      if (!user) {
        return null;
      }

      const owned = await tx.slug.findMany({
        where: {
          ownerId: userId,
          status: { in: ["approved", "active", "paused", "private"] },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          fullSlug: true,
          status: true,
          isPrimary: true,
        },
      });

      const currentPlan = normalizePlan(user.plan);
      const userPatch = { plan };
      if (currentPlan === "none" && plan === "premium") {
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
      }
      if (plan === "premium") {
        const currentExpiry =
          user.subscriptionExpiresAt && Number.isFinite(new Date(user.subscriptionExpiresAt).getTime())
            ? new Date(user.subscriptionExpiresAt)
            : null;
        const renewalBase = currentExpiry && currentExpiry > now ? currentExpiry : now;
        userPatch.subscriptionStartedAt = user.subscriptionStartedAt || now;
        userPatch.subscriptionRenewedAt = now;
        userPatch.subscriptionExpiresAt = requestedExpiry || addDays(renewalBase, 30);
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
        if (currentPlan !== "premium") {
          userPatch.planUpgradedAt = now;
        }
      } else {
        userPatch.subscriptionExpiresAt = now;
      }
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: userPatch,
        select: {
          id: true,
          plan: true,
          planPurchasedAt: true,
          planUpgradedAt: true,
          subscriptionStartedAt: true,
          subscriptionRenewedAt: true,
          subscriptionExpiresAt: true,
        },
      });

      if (plan === "none" && owned.length > 0) {
        await tx.slug.updateMany({
          where: { fullSlug: { in: owned.map((row) => row.fullSlug) } },
          data: { status: "paused" },
        });
      }

      return {
        ...updatedUser,
        requiresConfirmation: false,
      };
    });

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    try {
      await recalculateAndRefreshPercentiles(result.id);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after plan change", error);
    }

    res.json({
      telegramId: result.id,
      plan: result.plan,
      planPurchasedAt: result.planPurchasedAt,
      planUpgradedAt: result.planUpgradedAt,
      subscriptionStartedAt: result.subscriptionStartedAt,
      subscriptionRenewedAt: result.subscriptionRenewedAt,
      subscriptionExpiresAt: result.subscriptionExpiresAt,
    });
  }),
);

router.patch(
  "/users/:userId/badge",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required", code: "USER_ID_REQUIRED" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const badgeTypes = normalizeManualBadgeTypesInput(req.body?.badgeTypes ?? req.body?.badgeType);
    const badgeType = getPrimaryManualBadgeType(badgeTypes);
    const actorLogin = String(req.session?.admin?.login || "").trim() || "staff";
    const now = new Date();

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!targetUser) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    if (!prisma.badgeApplication) {
      res.status(503).json({ error: "Badge storage unavailable", code: "BADGE_STORAGE_UNAVAILABLE" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.badgeApplication.deleteMany({
        where: {
          userId,
          badgeType: { in: ["government", "unqx_staff"] },
        },
      });
      for (const nextBadgeType of badgeTypes) {
        await tx.badgeApplication.create({
          data: {
            userId,
            badgeType: nextBadgeType,
            workplace: "Установлено менеджером",
            role: "Системная отметка",
            proofText: `manager:${actorLogin}`,
            comment: "Badge updated from users table",
            status: "approved",
            reviewedAt: now,
          },
        });
      }
    });

    res.json({ ok: true, userId, badgeType, badgeTypes });
  }),
);

router.patch(
  "/users/:userId/verification",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required", code: "USER_ID_REQUIRED" });
      return;
    }

    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }

    const status = normalizeVerificationStatusInput(req.body?.status ?? req.body?.isVerified);
    if (status === null) {
      res.status(400).json({ error: "Invalid verification status", code: "VERIFICATION_STATUS_INVALID" });
      return;
    }

    const company = String(req.body?.company || "").trim().slice(0, 160);
    const role = String(req.body?.role || "").trim().slice(0, 120);
    if (status && (!company || !role)) {
      res.status(400).json({
        error: "Company and role are required to verify user",
        code: "VERIFICATION_PROFILE_REQUIRED",
      });
      return;
    }

    const now = new Date();
    const actorLogin = String(req.session?.admin?.login || "").trim() || "staff";
    const badgeTypes = normalizeManualBadgeTypesInput(req.body?.badgeTypes ?? req.body?.badgeType);
    const badgeType = getPrimaryManualBadgeType(badgeTypes);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, isVerified: true, verifiedCompany: true },
        });
        if (!targetUser) {
          const error = new Error("User not found");
          error.code = "USER_NOT_FOUND";
          throw error;
        }

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            isVerified: status,
            verifiedCompany: status ? company : null,
            verifiedAt: status ? now : null,
          },
          select: {
            id: true,
            isVerified: true,
            verifiedCompany: true,
            verifiedAt: true,
          },
        });

        let appliedRole = status ? role : null;
        if (tx.profileCard && typeof tx.profileCard.updateMany === "function") {
          try {
            await tx.profileCard.updateMany({
              where: { ownerId: userId },
              data: {
                role: status ? role : null,
              },
            });
          } catch (error) {
            if (!isMissingStorageError(error)) {
              throw error;
            }
          }
        }

        if (status && tx.verificationRequest && typeof tx.verificationRequest.create === "function") {
          let requestSlug = "PROFILE";
          try {
            const primarySlug = await tx.slug.findFirst({
              where: { ownerId: userId, isPrimary: true },
              select: { fullSlug: true },
            });
            if (primarySlug?.fullSlug) {
              requestSlug = String(primarySlug.fullSlug);
            }
          } catch (error) {
            if (!isMissingStorageError(error)) {
              throw error;
            }
          }

          try {
            await tx.verificationRequest.create({
              data: {
                userId,
                slug: requestSlug,
                companyName: company,
                role,
                sector: "other",
                proofType: "email",
                proofValue: actorLogin,
                comment: "Verified from manager dashboard",
                status: "approved",
                adminNote: "Approved by manager from users table",
                requestedAt: now,
                reviewedAt: now,
              },
            });
          } catch (error) {
            if (!isMissingStorageError(error)) {
              throw error;
            }
          }
        }

        if (tx.badgeApplication && typeof tx.badgeApplication.deleteMany === "function") {
          try {
            await tx.badgeApplication.deleteMany({
              where: {
                userId,
                badgeType: { in: ["government", "unqx_staff"] },
              },
            });
            if (badgeTypes.length && typeof tx.badgeApplication.create === "function") {
              for (const nextBadgeType of badgeTypes) {
                await tx.badgeApplication.create({
                  data: {
                    userId,
                    badgeType: nextBadgeType,
                    workplace: company || "Установлено менеджером",
                    role: role || "Системная отметка",
                    proofText: `manager:${actorLogin}`,
                    comment: "Badge updated from users verification modal",
                    status: "approved",
                    reviewedAt: now,
                  },
                });
              }
            }
          } catch (error) {
            if (!isMissingStorageError(error)) {
              throw error;
            }
          }
        }

        return {
          user: updatedUser,
          role: appliedRole,
          badgeType,
          badgeTypes,
        };
      });

      res.json({
        ok: true,
        userId: result.user.id,
        isVerified: result.user.isVerified,
        verifiedCompany: result.user.verifiedCompany,
        verifiedAt: result.user.verifiedAt,
        role: result.role,
        badgeType: result.badgeType,
        badgeTypes: result.badgeTypes,
      });
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      if (isMissingModelError(error, "User") || isMissingStorageError(error)) {
        res.status(503).json({ error: "Users storage unavailable", code: "USERS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.patch(
  "/users/:userId/unverify",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required", code: "USER_ID_REQUIRED" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsUser = await managerOwnsUser(req, userId);
      if (!ownsUser) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isVerified: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: false,
        verifiedCompany: null,
      },
      select: {
        id: true,
        isVerified: true,
        verifiedCompany: true,
      },
    });

    res.json({
      ok: true,
      userId: updated.id,
      isVerified: updated.isVerified,
      verifiedCompany: updated.verifiedCompany,
    });
  }),
);

router.post(
  "/users/:userId/views",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    if (!prisma.analyticsView || !prisma.slug) {
      res.status(503).json({ error: "Analytics storage unavailable", code: "ANALYTICS_STORAGE_UNAVAILABLE" });
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }

    const count = clampInteger(req.body?.count, 1, MAX_ADMIN_BOOST_VIEWS, 0);
    if (!count) {
      res.status(400).json({ error: `Count must be an integer from 1 to ${MAX_ADMIN_BOOST_VIEWS}` });
      return;
    }
    const periodDays = clampInteger(req.body?.periodDays, 1, MAX_ADMIN_BOOST_PERIOD_DAYS, 7);
    const requestedSlug = normalizeShortSlug(req.body?.slug);

    const [user, ownedSlugs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, city: true },
      }),
      prisma.slug.findMany({
        where: { ownerId: userId },
        select: { fullSlug: true, status: true, isPrimary: true },
      }),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isViewableSlug = (slugRow) => ["active", "private"].includes(String(slugRow?.status || ""));
    let targetSlug = null;
    if (requestedSlug) {
      targetSlug = ownedSlugs.find((row) => row.fullSlug === requestedSlug) || null;
      if (!targetSlug) {
        res.status(404).json({ error: "Requested slug is not owned by user" });
        return;
      }
    } else {
      targetSlug =
        ownedSlugs.find((row) => row.isPrimary && isViewableSlug(row)) ||
        ownedSlugs.find((row) => isViewableSlug(row)) ||
        null;
    }

    if (!targetSlug) {
      res.status(409).json({ error: "User does not have an active/public slug for views" });
      return;
    }

    if (!isViewableSlug(targetSlug)) {
      res.status(409).json({ error: "Only active/private slug can receive realistic views" });
      return;
    }

    const rows = buildSyntheticViewRows({
      slug: targetSlug.fullSlug,
      count,
      periodDays,
      preferredCity: String(user.city || "").trim().slice(0, 120) || null,
    });

    await prisma.$transaction(async (tx) => {
      if (!tx.analyticsView || typeof tx.analyticsView.createMany !== "function") {
        throw new Error("Analytics storage unavailable");
      }
      for (let offset = 0; offset < rows.length; offset += 500) {
        const chunk = rows.slice(offset, offset + 500);
        if (chunk.length) {
          await tx.analyticsView.createMany({ data: chunk });
        }
      }
      await tx.slug.update({
        where: { fullSlug: targetSlug.fullSlug },
        data: { analyticsViewsCount: { increment: count } },
      });
    });

    await safeRecalculateScore(userId);
    res.json({
      ok: true,
      userId,
      slug: targetSlug.fullSlug,
      addedViews: count,
      periodDays,
    });
  }),
);

router.post(
  "/users/:userId/views/reduce",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    if (!prisma.analyticsView || !prisma.slug) {
      res.status(503).json({ error: "Analytics storage unavailable", code: "ANALYTICS_STORAGE_UNAVAILABLE" });
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }

    const count = clampInteger(req.body?.count, 1, MAX_ADMIN_BOOST_VIEWS, 0);
    if (!count) {
      res.status(400).json({ error: `Count must be an integer from 1 to ${MAX_ADMIN_BOOST_VIEWS}` });
      return;
    }
    const requestedSlug = normalizeShortSlug(req.body?.slug);

    const [user, ownedSlugs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      prisma.slug.findMany({
        where: { ownerId: userId },
        select: { fullSlug: true, status: true, isPrimary: true },
      }),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isReducibleSlug = (slugRow) => ["active", "private", "paused", "approved"].includes(String(slugRow?.status || ""));
    let targetSlug = null;
    if (requestedSlug) {
      targetSlug = ownedSlugs.find((row) => row.fullSlug === requestedSlug) || null;
      if (!targetSlug) {
        res.status(404).json({ error: "Requested slug is not owned by user" });
        return;
      }
    } else {
      targetSlug =
        ownedSlugs.find((row) => row.isPrimary && isReducibleSlug(row)) ||
        ownedSlugs.find((row) => isReducibleSlug(row)) ||
        null;
    }

    if (!targetSlug) {
      res.status(409).json({ error: "User does not have slug eligible for view reduction" });
      return;
    }

    const removedViews = await prisma.$transaction(async (tx) => {
      if (!tx.analyticsView || !tx.slug) {
        throw new Error("Analytics storage unavailable");
      }

      const rowsToDelete = await tx.analyticsView.findMany({
        where: { slug: targetSlug.fullSlug },
        orderBy: { visitedAt: "desc" },
        take: count,
        select: { id: true },
      });
      const ids = rowsToDelete.map((row) => String(row.id || "")).filter(Boolean);
      const removed = ids.length;
      if (!removed) return 0;

      await tx.analyticsView.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      const currentSlug = await tx.slug.findUnique({
        where: { fullSlug: targetSlug.fullSlug },
        select: { analyticsViewsCount: true },
      });
      const nextViewsCount = Math.max(0, Number(currentSlug?.analyticsViewsCount || 0) - removed);
      await tx.slug.update({
        where: { fullSlug: targetSlug.fullSlug },
        data: { analyticsViewsCount: nextViewsCount },
      });

      return removed;
    });

    await safeRecalculateScore(userId);
    res.json({
      ok: true,
      userId,
      slug: targetSlug.fullSlug,
      removedViews,
      requestedCount: count,
    });
  }),
);

router.patch(
  "/users/:userId/block",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    await prisma.$transaction(async (tx) => {
      const owned = await tx.slug.findMany({
        where: { ownerId: userId },
        select: {
          fullSlug: true,
        },
      });
      for (const row of owned) {
        await tx.slug.update({
          where: { fullSlug: row.fullSlug },
          data: {
            ownerId: null,
            status: "free",
            isPrimary: false,
            pauseMessage: null,
            pendingExpiresAt: null,
            approvedAt: null,
            requestedAt: null,
            activatedAt: null,
          },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { status: "blocked" },
      });
    });
    try {
      await recalculateAndRefreshPercentiles(userId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after user block", error);
    }
    res.json({ ok: true });
  }),
);

router.patch(
  "/users/:userId/unblock",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    await prisma.$transaction(async (tx) => {
      const blocked = await tx.slug.findMany({
        where: {
          ownerId: userId,
          status: "blocked",
        },
        select: {
          fullSlug: true,
          pauseMessage: true,
        },
      });

      for (const row of blocked) {
        const parsed = parseBlockedPauseMessage(row.pauseMessage);
        await tx.slug.update({
          where: { fullSlug: row.fullSlug },
          data: {
            status: parsed?.previousStatus || "paused",
            pauseMessage: parsed?.pauseMessage || null,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { status: "active" },
      });
    });
    try {
      await recalculateAndRefreshPercentiles(userId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after user unblock", error);
    }

    res.json({ ok: true });
  }),
);

router.delete(
  "/users/:userId/purge",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const ownedSlugRows = await prisma.slug.findMany({
      where: { ownerId: userId },
      select: { fullSlug: true },
    });
    const ownedSlugs = Array.from(new Set(ownedSlugRows.map((item) => String(item.fullSlug || "").trim()).filter(Boolean)));

    const txResult = await prisma.$transaction(async (tx) => {
      const freed = await tx.slug.updateMany({
        where: { ownerId: userId },
        data: {
          ownerId: null,
          status: "free",
          isPrimary: false,
          pauseMessage: null,
          pendingExpiresAt: null,
          approvedAt: null,
          requestedAt: null,
          activatedAt: null,
        },
      });

      await tx.user.delete({
        where: { id: userId },
      });

      return {
        freedSlugs: Number(freed.count || 0),
      };
    });

    // Best-effort cleanup for session/mobile/legacy tables not fully represented in Prisma schema.
    const rawCleanupCounts = {};
    rawCleanupCounts.userSessions = Number(
      await safeExecuteRaw(
        `
        DELETE FROM user_sessions
        WHERE (sess::jsonb #>> '{user,userId}') = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.tapEventsVisitor = Number(
      await safeExecuteRaw(
        `
        DELETE FROM tap_events
        WHERE visitor_user_id = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.userContactsByContactUser = Number(
      await safeExecuteRaw(
        `
        DELETE FROM user_contacts
        WHERE contact_user_id = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.nfcHistory = Number(
      await safeExecuteRaw(
        `
        DELETE FROM nfc_history
        WHERE user_id = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.nfcTags = Number(
      await safeExecuteRaw(
        `
        DELETE FROM nfc_tags
        WHERE user_id = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.notifications = Number(
      await safeExecuteRaw(
        `
        DELETE FROM notifications
        WHERE user_id = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.pushTokens = Number(
      await safeExecuteRaw(
        `
        DELETE FROM push_tokens
        WHERE user_id = $1
        `,
        userId,
      ),
    );
    rawCleanupCounts.telegramLinkTokens = Number(
      await safeExecuteRaw(
        `
        DELETE FROM telegram_link_tokens
        WHERE user_id = $1
        `,
        userId,
      ),
    );

    if (ownedSlugs.length > 0) {
      rawCleanupCounts.tapEventsByOwnerSlug = Number(
        await safeExecuteRaw(
          `
          DELETE FROM tap_events
          WHERE owner_slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.userContactsBySlug = Number(
        await safeExecuteRaw(
          `
          DELETE FROM user_contacts
          WHERE contact_slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.slugViewsLegacy = Number(
        await safeExecuteRaw(
          `
          DELETE FROM slug_views
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.slugClicksLegacy = Number(
        await safeExecuteRaw(
          `
          DELETE FROM slug_clicks
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.viewsLogLegacy = Number(
        await safeExecuteRaw(
          `
          DELETE FROM views_log
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.directoryExclusions = Number(
        await safeExecuteRaw(
          `
          DELETE FROM directory_exclusions
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.leaderboardExclusions = Number(
        await safeExecuteRaw(
          `
          DELETE FROM leaderboard_exclusions
          WHERE full_slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.leaderboardSuspicious = Number(
        await safeExecuteRaw(
          `
          DELETE FROM leaderboard_suspicious_log
          WHERE full_slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.slugCheckerLogs = Number(
        await safeExecuteRaw(
          `
          DELETE FROM slug_checker_logs
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.analyticsViews = Number(
        await safeExecuteRaw(
          `
          DELETE FROM analytics_views
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
      rawCleanupCounts.analyticsClicks = Number(
        await safeExecuteRaw(
          `
          DELETE FROM analytics_clicks
          WHERE slug = ANY($1::text[])
          `,
          ownedSlugs,
        ),
      );
    }

    res.json({
      ok: true,
      purgedUserId: userId,
      freedSlugs: txResult.freedSlugs,
      affectedSlugs: ownedSlugs,
      cleanup: rawCleanupCounts,
    });
  }),
);

router.get(
  "/orders/export.csv",
  asyncHandler(async (req, res) => {
    const managerScope = await getManagerScope(req);
    const managerBlocked = isManagerScopeBlocked(managerScope);
    const baseWhere = buildOrdersWhere(req.query);
    const where = managerScope.isManager
      ? andWhere(baseWhere, { user: { createdByStaffId: managerScope.managerId } })
      : baseWhere;
    const rows = managerBlocked
      ? []
      : await prisma.slugRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              firstName: true,
              displayName: true,
              username: true,
              telegramChatId: true,
            },
          },
        },
      });

    const lines = [
      "Дата,Имя,Slug,Цена slug,Цена тарифа,Сумма,Контакт,Статус",
      ...rows.map((row) =>
        [
          `"${new Date(row.createdAt).toLocaleString("ru-RU")}"`,
          `"${String(row.user?.displayName || row.user?.firstName || "UNQX User").replace(/"/g, '""')}"`,
          `"${row.slug}"`,
          row.slugPrice,
          Number(row.planPrice || 0),
          Number(row.slugPrice || 0) + Number(row.planPrice || 0),
          `"${String(row.user?.username ? `@${row.user.username}` : row.user?.telegramChatId || row.userId || "").replace(/"/g, '""')}"`,
          `"${formatOrderStatusLabel(row.status)}"`,
        ].join(","),
      ),
    ];

    const csv = `\uFEFF${lines.join("\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
    res.send(csv);
  }),
);

router.get(
  "/purchases",
  asyncHandler(async (req, res) => {
    if (!prisma.purchase) {
      res.json({
        totalRevenue: 0,
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
      return;
    }

    const where = buildPurchasesWhere(req.query);
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));

    const [total, rows, sum] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              displayName: true,
              username: true,
            },
          },
        },
      }),
      prisma.purchase.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalRevenue: Number(sum?._sum?.amount || 0),
      items: rows.map((row) => ({
        id: row.id,
        purchasedAt: row.purchasedAt,
        telegramId: row.userId,
        userName: row.user?.displayName || row.user?.firstName || "UNQX User",
        username: row.user?.username || null,
        type: row.type,
        slug: row.slug || null,
        amount: row.amount,
        approvedByAdmin: row.approvedByAdmin || null,
        approvedAt: row.approvedAt || null,
        note: row.note || null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/purchases/export.csv",
  asyncHandler(async (req, res) => {
    if (!prisma.purchase) {
      res.status(503).json({ error: "Purchases storage unavailable" });
      return;
    }
    const where = buildPurchasesWhere(req.query);
    const rows = await prisma.purchase.findMany({
      where,
      orderBy: { purchasedAt: "desc" },
      include: {
        user: {
          select: {
            firstName: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    const lines = [
      "Дата,Пользователь,Telegram,Тип,Slug,Сумма,Одобрил,Одобрено,Примечание",
      ...rows.map((row) =>
        [
          `"${new Date(row.purchasedAt).toLocaleString("ru-RU")}"`,
          `"${String(row.user?.displayName || row.user?.firstName || "UNQX User").replace(/"/g, '""')}"`,
          `"${String(row.user?.username ? `@${row.user.username}` : row.userId).replace(/"/g, '""')}"`,
          `"${String(row.type)}"`,
          `"${String(row.slug || "").replace(/"/g, '""')}"`,
          Number(row.amount || 0),
          `"${String(row.approvedByAdmin || "").replace(/"/g, '""')}"`,
          `"${row.approvedAt ? new Date(row.approvedAt).toLocaleString("ru-RU") : ""}"`,
          `"${String(row.note || "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ];

    const csv = `\uFEFF${lines.join("\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=purchases.csv");
    res.send(csv);
  }),
);

router.get(
  "/payment-events",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(500, pageSizeRaw));

    try {
      const result = await queryPaymentEvents({ query: req.query, page, pageSize });
      res.json({
        totalAmount: result.totalAmount,
        filters: result.filters,
        items: result.rows.map((row) => ({
          id: row.id,
          orderId: row.orderId,
          userId: row.userId,
          userName: row.displayName || row.firstName || "UNQX User",
          username: row.username || null,
          status: row.status,
          provider: row.provider,
          reference: row.reference,
          amount: Number(row.amount || 0),
          actor: row.actor,
          source: row.source,
          note: row.note || null,
          createdAt: row.createdAt,
        })),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
        },
      });
    } catch (error) {
      if (isPaymentEventsStorageError(error)) {
        res.json({
          totalAmount: 0,
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/payment-events/export.csv",
  asyncHandler(async (req, res) => {
    try {
      const result = await queryPaymentEvents({ query: req.query, page: 1, pageSize: 10_000 });
      const lines = [
        "Дата,Order ID,Пользователь,Username,Статус,Провайдер,Reference,Сумма,Actor,Source,Примечание",
        ...result.rows.map((row) =>
          [
            `"${new Date(row.createdAt).toLocaleString("ru-RU")}"`,
            `"${String(row.orderId || "").replace(/"/g, '""')}"`,
            `"${String(row.displayName || row.firstName || "UNQX User").replace(/"/g, '""')}"`,
            `"${String(row.username ? `@${row.username}` : "").replace(/"/g, '""')}"`,
            `"${String(row.status || "").replace(/"/g, '""')}"`,
            `"${String(row.provider || "").replace(/"/g, '""')}"`,
            `"${String(row.reference || "").replace(/"/g, '""')}"`,
            Number(row.amount || 0),
            `"${String(row.actor || "").replace(/"/g, '""')}"`,
            `"${String(row.source || "").replace(/"/g, '""')}"`,
            `"${String(row.note || "").replace(/"/g, '""')}"`,
          ].join(","),
        ),
      ];

      const csv = `\uFEFF${lines.join("\n")}`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=payment-events.csv");
      res.send(csv);
    } catch (error) {
      if (isPaymentEventsStorageError(error)) {
        res.status(503).json({ error: "Payment events storage unavailable" });
        return;
      }
      throw error;
    }
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Payment Analytics & Dashboard
// ─────────────────────────────────────────────────────────────────────────

router.get(
  "/payment-stats",
  asyncHandler(async (req, res) => {
    const period = String(req.query.period || "day");
    const allowedPeriods = ["day", "week", "month", "all"];
    const validPeriod = allowedPeriods.includes(period) ? period : "day";

    try {
      const stats = await getPaymentStatistics({ period: validPeriod });
      res.json(stats);
    } catch (error) {
      if (isPaymentEventsStorageErrorAnalytics(error)) {
        res.status(503).json({ error: "Payment analytics unavailable" });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/payment-alerts",
  asyncHandler(async (req, res) => {
    try {
      const alerts = await getPaymentAlerts();
      res.json({ alerts });
    } catch (error) {
      console.error("Error fetching payment alerts:", error);
      res.status(500).json({ error: "Failed to fetch payment alerts" });
    }
  }),
);

router.get(
  "/conversion-funnel",
  asyncHandler(async (req, res) => {
    const period = String(req.query.period || "week");
    const allowedPeriods = ["day", "week", "month"];
    const validPeriod = allowedPeriods.includes(period) ? period : "week";

    try {
      const funnel = await getConversionFunnel({ period: validPeriod });
      res.json(funnel);
    } catch (error) {
      console.error("Error fetching conversion funnel:", error);
      res.status(500).json({ error: "Failed to fetch conversion funnel" });
    }
  }),
);

router.post(
  "/payment-alerts/notify",
  asyncHandler(async (_req, res) => {
    try {
      const alerts = await getPaymentAlerts();

      if (alerts.length === 0) {
        res.json({ ok: true, message: "No alerts to send", alertCount: 0 });
        return;
      }

      await sendPaymentAlertsToAdmin(alerts);
      res.json({ ok: true, message: "Alerts sent to Telegram", alertCount: alerts.length });
    } catch (error) {
      console.error("Error sending payment alerts:", error);
      res.status(500).json({ error: "Failed to send payment alerts" });
    }
  }),
);

router.get(
  "/slugs/stats",
  asyncHandler(async (_req, res) => {
    const [free, blocked, taken] = await Promise.all([
      prisma.slug.count({ where: { status: "free" } }),
      prisma.slug.count({ where: { status: "blocked" } }),
      prisma.slug.count({ where: { status: { not: "free" } } }),
    ]);
    const total = free + taken;
    res.json({
      total,
      taken,
      blocked,
      free,
    });
  }),
);

router.get(
  "/slugs",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
    const stateRaw = String(req.query.state || "all");
    const qRaw = typeof req.query.q === "string" ? req.query.q : "";
    const qUpper = qRaw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const where = {};
    if (qUpper) {
      where.fullSlug = { contains: qUpper };
    }
    if (stateRaw === "free") {
      where.status = "free";
    } else if (stateRaw === "blocked") {
      where.status = "blocked";
    } else if (stateRaw === "taken") {
      where.status = { not: "free" };
    }

    const [total, rows] = await Promise.all([
      prisma.slug.count({ where }),
      prisma.slug.findMany({
        where,
        orderBy: { fullSlug: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: {
            select: {
              firstName: true,
              displayName: true,
              username: true,
              id: true,
              telegramChatId: true,
            },
          },
        },
      }),
    ]);
    const slugPricingConfig = await getSlugPricingConfig();

    const items = rows.map((row) => {
      const calcPrice =
        isLegacySlug(row.fullSlug) &&
          (row.price === null || row.price === undefined)
          ? calculateSlugPrice({ letters: row.fullSlug.slice(0, 3), digits: row.fullSlug.slice(3), config: slugPricingConfig }).total
          : null;
      const effectivePrice = typeof row.price === "number" ? row.price : calcPrice;
      return {
        slug: row.fullSlug,
        state: row.status.toUpperCase(),
        stateLabel:
          row.status === "free"
            ? "Свободен"
            : row.status === "blocked"
              ? "Заблокирован"
              : "Занят",
        ownerName: row.owner?.displayName || row.owner?.firstName || "",
        ownerId: row.ownerId || null,
        ownerUsername: row.owner?.username || null,
        effectivePrice,
        priceOverride: typeof row.price === "number" ? row.price : null,
        requestedAt: row.requestedAt,
        approvedAt: row.approvedAt,
        activatedAt: row.activatedAt,
        isPrimary: Boolean(row.isPrimary),
      };
    });

    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/slugs/availability/check",
  asyncHandler(async (req, res) => {
    const slug = normalizeShortSlug(req.query.slug);
    const validationCode = getAssignableSlugValidationCode(slug);
    if (validationCode) {
      const reason = validationCode === "SLUG_RESERVED" ? "reserved_path" : "invalid_format";
      res.json({
        slug,
        validFormat: false,
        available: false,
        reason,
        code: validationCode,
        type: "",
        price: null,
      });
      return;
    }

    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true, ownerId: true, status: true, price: true },
    });
    const type = getAssignableSlugType(slug);
    const legacy = type === "legacy";
    let price = null;
    if (legacy) {
      price = typeof existing?.price === "number"
        ? existing.price
        : await getCalculatedShortSlugPrice(slug);
    }

    const available = !existing || (!existing.ownerId && existing.status === "free");
    let reason = "available";
    if (!available) {
      reason = existing?.ownerId ? "taken" : existing?.status || "not_free";
    }

    res.json({
      slug,
      validFormat: true,
      available,
      reason,
      code: available ? "SLUG_AVAILABLE" : existing?.ownerId ? "SLUG_TAKEN" : "SLUG_NOT_FREE",
      type,
      isLegacy: legacy,
      isManagedUsername: type === "username",
      price,
      status: existing?.status || null,
      ownerId: existing?.ownerId || null,
    });
  }),
);

router.patch(
  "/slugs/:slug/state",
  asyncHandler(async (req, res) => {
    const slug = normalizeShortSlug(req.params.slug);
    const next = String(req.body.state || "").trim().toLowerCase();
    if (!["blocked", "free", "active", "paused", "private", "approved"].includes(next)) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true, ownerId: true, status: true, pauseMessage: true, owner: { select: { telegramChatId: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }

    const data = { status: next };
    if (next === "free") {
      data.ownerId = null;
      data.isPrimary = false;
      data.pauseMessage = null;
      data.requestedAt = null;
      data.approvedAt = null;
      data.activatedAt = null;
      data.pendingExpiresAt = null;
    }
    if (next === "blocked") {
      data.pauseMessage = encodeBlockedPauseMessage(existing.status, existing.pauseMessage);
      data.pendingExpiresAt = null;
    }
    if (next === "approved" || next === "active" || next === "paused" || next === "private") {
      data.pendingExpiresAt = null;
    }
    const updated = await prisma.slug.update({
      where: { fullSlug: slug },
      data,
    });

    if (next === "blocked" && existing.owner?.telegramChatId) {
      try {
        await sendTelegramMessage({
          chatId: existing.owner.telegramChatId,
          text: `Твой slug ${updated.fullSlug} был временно заблокирован администратором.`,
        });
      } catch (error) {
        console.error("[express-app] failed to send slug blocked notification", error);
      }
    }
    if (updated.ownerId) {
      try {
        await recalculateAndRefreshPercentiles(updated.ownerId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after slug state change", error);
      }
    }

    res.json({
      slug: updated.fullSlug,
      status: updated.status,
      ownerId: updated.ownerId,
      isPrimary: updated.isPrimary,
      requestedAt: updated.requestedAt,
      approvedAt: updated.approvedAt,
      activatedAt: updated.activatedAt,
      pauseMessage: updated.pauseMessage,
    });
  }),
);

router.patch(
  "/slugs/:slug/activate",
  asyncHandler(async (req, res) => {
    const slug = normalizeShortSlug(req.params.slug);
    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug: slug },
      data: {
        status: "active",
        activatedAt: new Date(),
        pendingExpiresAt: null,
      },
      select: { fullSlug: true, status: true, activatedAt: true, ownerId: true },
    });
    if (updated.ownerId) {
      try {
        await recalculateAndRefreshPercentiles(updated.ownerId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after slug activation", error);
      }
    }
    res.json({ ok: true, slug: updated.fullSlug, status: updated.status, activatedAt: updated.activatedAt });
  }),
);

router.patch(
  "/slugs/:slug/price-override",
  asyncHandler(async (req, res) => {
    const slug = normalizeShortSlug(req.params.slug);
    if (!isLegacySlug(slug)) {
      res.status(400).json({ error: "Slug must be in AAA000 format" });
      return;
    }
    const parsed = /^([A-Z]{3})([0-9]{3})$/.exec(slug);
    const parsePriceOverride = (rawValue) => {
      if (rawValue === null || rawValue === undefined || rawValue === "") return null;
      const normalized = String(rawValue)
        .trim()
        .replace(/\s+/g, "")
        .replace(/[^\d.,-]/g, "")
        .replace(",", ".");
      if (!normalized) return Number.NaN;
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    };
    const value = req.body.priceOverride;
    let priceOverride = null;
    if (!(value === null || value === "")) {
      const numeric = parsePriceOverride(value);
      if (!Number.isFinite(numeric)) {
        res.status(400).json({ error: "Invalid price override" });
        return;
      }
      const normalized = Math.max(0, Math.round(numeric));
      if (normalized > MAX_DB_INT) {
        res.status(400).json({ error: `Price override is too large (max: ${MAX_DB_INT})` });
        return;
      }
      priceOverride = normalized;
    }

    const effectiveSlugPrice = (() => {
      if (typeof priceOverride === "number") {
        return priceOverride;
      }
      return null;
    })();

    let resolvedPrice = effectiveSlugPrice;
    if (resolvedPrice === null && parsed) {
      const slugPricingConfig = await getSlugPricingConfig();
      resolvedPrice = calculateSlugPrice({
        letters: parsed[1],
        digits: parsed[2],
        config: slugPricingConfig,
      }).total;
    }
    if (typeof resolvedPrice === "number") {
      if (!Number.isFinite(resolvedPrice)) {
        resolvedPrice = null;
      } else {
        resolvedPrice = Math.max(0, Math.min(MAX_DB_INT, Math.round(resolvedPrice)));
      }
    }

    const [row, synced] = await prisma.$transaction(async (tx) => {
      const existingSlug = await tx.slug.findUnique({
        where: { fullSlug: slug },
        select: {
          fullSlug: true,
          price: true,
        },
      });

      const updatedSlug = existingSlug
        ? await tx.slug.update({
          where: { fullSlug: slug },
          data: { price: priceOverride },
          select: {
            fullSlug: true,
            status: true,
            price: true,
          },
        })
        : await tx.slug.create({
          data: {
            letters: parsed[1],
            digits: parsed[2],
            fullSlug: slug,
            status: "free",
            isPrimary: false,
            price: priceOverride,
          },
          select: {
            fullSlug: true,
            status: true,
            price: true,
          },
        });

      // Apply override only to not yet purchased requests; keep approved/history immutable.
      const slugRequestsResult =
        typeof resolvedPrice === "number"
          ? await tx.slugRequest.updateMany({
            where: {
              slug,
              status: { in: ["new", "contacted", "paid"] },
            },
            data: { slugPrice: resolvedPrice },
          })
          : { count: 0 };

      return [
        updatedSlug,
        {
          slugRequestsUpdated: Number(slugRequestsResult?.count || 0),
          slugPurchasesUpdated: 0,
          effectiveSlugPrice: typeof resolvedPrice === "number" ? resolvedPrice : null,
          appliedToPurchasedSlug: false,
        },
      ];
    });

    res.json({
      slug: row.fullSlug,
      priceOverride: row.price,
      synced,
    });
  }),
);

router.get(
  "/testimonials",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const [total, rows] = await Promise.all([
      prisma.testimonial.count(),
      prisma.testimonial.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      items: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.post(
  "/testimonials",
  asyncHandler(async (req, res) => {
    const created = await prisma.testimonial.create({
      data: {
        name: String(req.body.name || "").trim(),
        slug: String(req.body.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
        tariff: normalizeTariff(req.body.tariff),
        text: String(req.body.text || "").trim(),
        isVisible: true,
        sortOrder: Number(req.body.sortOrder || 0) || 0,
      },
    });
    res.status(201).json(created);
  }),
);

router.patch(
  "/testimonials/:id",
  asyncHandler(async (req, res) => {
    const updated = await prisma.testimonial.update({
      where: { id: req.params.id },
      data: {
        name: String(req.body.name || "").trim(),
        slug: String(req.body.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
        tariff: normalizeTariff(req.body.tariff),
        text: String(req.body.text || "").trim(),
      },
    });
    res.json(updated);
  }),
);

router.patch(
  "/testimonials/:id/visibility",
  asyncHandler(async (req, res) => {
    const updated = await prisma.testimonial.update({
      where: { id: req.params.id },
      data: { isVisible: Boolean(req.body.isVisible) },
      select: { id: true, isVisible: true },
    });
    res.json(updated);
  }),
);

router.delete(
  "/testimonials/:id",
  asyncHandler(async (req, res) => {
    try {
      await prisma.testimonial.delete({ where: { id: req.params.id } });
    } catch (error) {
      // Idempotent delete: if record is already gone, treat as success.
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        res.json({ ok: true, deleted: false });
        return;
      }
      throw error;
    }
    res.json({ ok: true });
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const timezone = env.TIMEZONE;
    const now = new Date();
    const nowInZone = toZonedTime(now, timezone);
    const todayStart = fromZonedTime(startOfDay(nowInZone), timezone);
    const defaultFrom = subDays(todayStart, 29);
    const canUsePurchases = Boolean(prisma.purchase);
    const rawDateFrom = String(req.query.dateFrom || "").trim();
    const rawDateTo = String(req.query.dateTo || "").trim();
    const groupBy = ["day", "week", "month"].includes(String(req.query.groupBy || "").trim().toLowerCase())
      ? String(req.query.groupBy || "").trim().toLowerCase()
      : "day";

    const parseDateStart = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      return fromZonedTime(startOfDay(new Date(`${value}T00:00:00`)), timezone);
    };
    const parseDateEnd = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      return fromZonedTime(new Date(`${value}T23:59:59.999`), timezone);
    };

    let rangeFrom = parseDateStart(rawDateFrom) || defaultFrom;
    let rangeTo = parseDateEnd(rawDateTo) || now;
    if (rangeFrom > rangeTo) {
      const swap = rangeFrom;
      rangeFrom = rangeTo;
      rangeTo = swap;
    }
    if ((rangeTo.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24) > 365) {
      rangeFrom = subDays(rangeTo, 365);
    }

    const [
      purchasesTodayAgg,
      purchases30Agg,
      purchasesAllAgg,
      purchases30d,
      purchasesAll,
      checkerLogs,
      scoreRows,
      newOrdersToday,
      allOrdersForChecks,
      todayVisitorsStats,
    ] = await Promise.all([
      canUsePurchases
        ? prisma.purchase.aggregate({
          where: { purchasedAt: { gte: rangeFrom, lte: rangeTo } },
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.aggregate({
          where: { purchasedAt: { gte: rangeFrom, lte: rangeTo } },
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.aggregate({
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.findMany({
          where: { purchasedAt: { gte: rangeFrom, lte: rangeTo } },
          select: { purchasedAt: true, amount: true, type: true },
        })
        : Promise.resolve([]),
      canUsePurchases
        ? prisma.purchase.findMany({
          select: { amount: true, type: true },
        })
        : Promise.resolve([]),
      prisma.slugCheckerLog.findMany({
        where: { source: "hero", checkedAt: { gte: rangeFrom, lte: rangeTo } },
        orderBy: { checkedAt: "desc" },
        take: 1000,
        select: { slug: true, pattern: true, checkedAt: true },
      }),
      modelDelegateExists("UnqScore")
        ? prisma.unqScore.findMany({
          where: {
            user: {
              status: "active",
            },
          },
          select: { score: true },
        })
        : Promise.resolve([]),
      prisma.slugRequest.count({
        where: { createdAt: { gte: rangeFrom, lte: rangeTo } },
      }),
      prisma.slugRequest.findMany({
        where: { createdAt: { gte: rangeFrom, lte: rangeTo } },
        select: { slug: true, createdAt: true },
      }),
      getTodayVisitorsStats(now),
    ]);

    const revenueToday = Number(purchasesTodayAgg?._sum?.amount || 0);
    const revenue30Days = Number(purchases30Agg?._sum?.amount || 0);
    const revenueTotal = Number(purchasesAllAgg?._sum?.amount || 0);

    const breakdown = {
      slug: 0,
      basicPlan: 0,
      premiumPlan: 0,
    };
    for (const item of purchasesAll) {
      const amount = Number(item.amount || 0);
      if (item.type === "slug") breakdown.slug += amount;
      if (item.type === "basic_plan") breakdown.basicPlan += amount;
      if (item.type === "premium_plan" || item.type === "upgrade_to_premium") breakdown.premiumPlan += amount;
    }

    const keyFromLocalDate = (localDate) => {
      if (groupBy === "week") return format(localDate, "yyyy-'W'II");
      if (groupBy === "month") return format(localDate, "yyyy-MM");
      return format(localDate, "yyyy-MM-dd");
    };
    const orderedKeys = [];
    const seenKeys = new Set();
    let cursor = startOfDay(toZonedTime(rangeFrom, timezone));
    const endLocal = startOfDay(toZonedTime(rangeTo, timezone));
    while (cursor <= endLocal) {
      const key = keyFromLocalDate(cursor);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        orderedKeys.push(key);
      }
      cursor = addDays(cursor, 1);
    }

    const keys = orderedKeys;
    const revenueBuckets = new Map(keys.map((key) => [key, 0]));
    for (const row of purchases30d) {
      const key = keyFromLocalDate(toZonedTime(row.purchasedAt, timezone));
      if (revenueBuckets.has(key)) {
        revenueBuckets.set(key, (revenueBuckets.get(key) || 0) + Number(row.amount || 0));
      }
    }
    const revenueDaily = keys.map((date) => ({ date, amount: revenueBuckets.get(date) || 0 }));

    const bySlugOrders = new Map();
    for (const row of allOrdersForChecks) {
      if (!bySlugOrders.has(row.slug)) {
        bySlugOrders.set(row.slug, []);
      }
      bySlugOrders.get(row.slug).push(row.createdAt);
    }
    for (const times of bySlugOrders.values()) {
      times.sort((a, b) => a.getTime() - b.getTime());
    }

    const patternCounts = new Map();
    for (const log of checkerLogs) {
      const slug = log.slug || "";
      const candidateOrders = bySlugOrders.get(slug) || [];
      const deadline = addDays(log.checkedAt, 1);
      const bought = candidateOrders.some((time) => time >= log.checkedAt && time <= deadline);
      if (bought) {
        continue;
      }
      const pattern = normalizeAnalyticsPattern(log.pattern);
      if (!pattern) {
        continue;
      }
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }
    const topUnboughtPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const averageUnqScore = scoreRows.length
      ? Number((scoreRows.reduce((acc, row) => acc + Number(row.score || 0), 0) / scoreRows.length).toFixed(1))
      : 0;
    const scoreDistribution = Array.from({ length: 10 }).map((_, index) => {
      const start = index * 100;
      const end = index === 9 ? 999 : start + 99;
      const count = scoreRows.filter((row) => {
        const value = Number(row.score || 0);
        if (index === 9) {
          return value >= start && value <= end;
        }
        return value >= start && value < start + 100;
      }).length;
      return {
        range: `${start}-${end}`,
        count,
      };
    });

    res.json({
      meta: {
        dateFrom: format(toZonedTime(rangeFrom, timezone), "yyyy-MM-dd"),
        dateTo: format(toZonedTime(rangeTo, timezone), "yyyy-MM-dd"),
        groupBy,
      },
      kpis: {
        newOrdersToday,
        revenueToday,
        revenue30Days,
        revenueTotal,
        averageUnqScore,
        breakdown,
        todayVisitorsTotal: todayVisitorsStats.total,
        todayVisitorsRaw: todayVisitorsStats.raw,
        todayVisitorsManual: todayVisitorsStats.adjustment,
        todayVisitorsDate: todayVisitorsStats.dateKey,
      },
      revenueDaily,
      topUnboughtPatterns,
      scoreDistribution,
    });
  }),
);

router.post(
  "/analytics/today-visitors/increment",
  asyncHandler(async (req, res) => {
    const amount = parsePositiveInt(req.body?.amount, 0);
    if (!amount || amount > MAX_TODAY_VISITORS_INCREMENT) {
      res.status(400).json({
        error: `Укажите целое число от 1 до ${MAX_TODAY_VISITORS_INCREMENT.toLocaleString("ru-RU")}.`,
        code: "TODAY_VISITORS_INCREMENT_INVALID",
      });
      return;
    }

    const stats = await incrementTodayVisitorsAdjustment(amount, req.session?.admin?.login || "admin");
    res.json({ ok: true, stats });
  }),
);

router.get(
  "/platform-analytics",
  asyncHandler(async (req, res) => {
    const period = [7, 30, 90].includes(Number(req.query.period)) ? Number(req.query.period) : 7;
    const from = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const now = new Date();
    const todayStart = getUtcDayStart(now);
    const onlineFrom = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000);

    const [views, clicks, activeCards, todayCreated, todayActivated, onlineRows, topSlugRows, todayVisitorsStats] = await Promise.all([
      prisma.analyticsView ? prisma.analyticsView.findMany({ where: { visitedAt: { gte: from } } }) : Promise.resolve([]),
      prisma.analyticsClick ? prisma.analyticsClick.findMany({ where: { clickedAt: { gte: from } } }) : Promise.resolve([]),
      prisma.slug.count({ where: { status: "active" } }),
      prisma.slug.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.slug.count({ where: { activatedAt: { gte: todayStart } } }),
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { visitedAt: { gte: onlineFrom } }, select: { sessionId: true, fingerprint: true } })
        : Promise.resolve([]),
      prisma.analyticsView
        ? prisma.analyticsView.groupBy({
          by: ["slug", "sessionId"],
          where: { visitedAt: { gte: from } },
          _count: { _all: true },
        })
        : Promise.resolve([]),
      getTodayVisitorsStats(now),
    ]);

    const dailySessions = new Map();
    views.forEach((item) => {
      const key = item.visitedAt.toISOString().slice(0, 10);
      if (!dailySessions.has(key)) {
        dailySessions.set(key, new Set());
      }
      dailySessions.get(key).add(String(item.sessionId || ""));
    });
    const daily = new Map(Array.from(dailySessions.entries()).map(([date, sessions]) => [date, sessions.size]));
    const bySourceSessions = new Map();
    const byDeviceSessions = new Map();
    views.forEach((item) => {
      const sessionId = String(item.sessionId || "");
      const src = String(item.source || "direct");
      const dev = String(item.device || "desktop");
      if (!bySourceSessions.has(src)) bySourceSessions.set(src, new Set());
      if (!byDeviceSessions.has(dev)) byDeviceSessions.set(dev, new Set());
      bySourceSessions.get(src).add(sessionId);
      byDeviceSessions.get(dev).add(sessionId);
    });
    const bySource = Object.fromEntries(Array.from(bySourceSessions.entries()).map(([k, s]) => [k, s.size]));
    const byDevice = Object.fromEntries(Array.from(byDeviceSessions.entries()).map(([k, s]) => [k, s.size]));
    const byButton = {};
    clicks.forEach((item) => {
      const key = String(item.buttonType || "other");
      byButton[key] = (byButton[key] || 0) + 1;
    });

    const topSlugCounter = new Map();
    topSlugRows.forEach((row) => {
      const slug = String(row.slug || "").toUpperCase();
      if (!slug) return;
      topSlugCounter.set(slug, (topSlugCounter.get(slug) || 0) + 1);
    });
    const topSlugs = Array.from(topSlugCounter.entries())
      .map(([slug, views]) => ({ slug, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    res.json({
      period,
      totalViewsByDay: Array.from(daily.entries()).map(([date, value]) => ({ date, value })),
      topSlugs,
      breakdown: {
        source: bySource,
        device: byDevice,
        button: byButton,
      },
      realtime: {
        activeCards,
        todayCreated,
        todayActivated,
        todayVisitors: todayVisitorsStats.total,
        todayVisitorsRaw: todayVisitorsStats.raw,
        todayVisitorsManual: todayVisitorsStats.adjustment,
        onlineNow: new Set(
          onlineRows
            .filter((row) => !String(row.fingerprint || "").startsWith(SYNTHETIC_FINGERPRINT_PREFIX))
            .map((row) => String(row.sessionId || "").trim())
            .filter(Boolean),
        ).size,
      },
    });
  }),
);

router.get(
  "/pet-requests",
  asyncHandler(async (req, res) => {
    if (!prisma.petPurchaseRequest) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const managerScope = await getManagerScope(req);
    if (isManagerScopeBlocked(managerScope)) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }

    const status = String(req.query.status || "all").trim().toLowerCase();
    const petType = normalizePetType(req.query.petType);
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 20;

    const baseWhere = {};
    if (["pending", "approved", "rejected"].includes(status)) {
      baseWhere.status = status;
    }
    if (petType) {
      baseWhere.petType = petType;
    }

    const where = managerScope.isManager
      ? andWhere(baseWhere, { user: { createdByStaffId: managerScope.managerId } })
      : baseWhere;

    const [total, rows] = await Promise.all([
      prisma.petPurchaseRequest.count({ where }),
      prisma.petPurchaseRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              displayName: true,
              username: true,
              telegramUsername: true,
              email: true,
              login: true,
              slugs: {
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                take: 3,
                select: {
                  fullSlug: true,
                  isPrimary: true,
                },
              },
            },
          },
          profileCard: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      items: rows.map((row) => mapAdminPetRequestRow(row)).filter(Boolean),
      pagination: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.post(
  "/pet-requests/:id/approve",
  asyncHandler(async (req, res) => {
    if (!prisma.petPurchaseRequest || !prisma.profileCardPet) {
      res.status(503).json({ error: "Pets storage unavailable", code: "PETS_STORAGE_UNAVAILABLE" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsPetRequest = await managerOwnsPetRequest(req, req.params.id);
      if (!ownsPetRequest) {
        res.status(404).json({ error: "Request not found", code: "PET_REQUEST_NOT_FOUND" });
        return;
      }
    }

    const target = await prisma.petPurchaseRequest.findUnique({
      where: { id: String(req.params.id || "").trim() },
    });
    if (!target) {
      res.status(404).json({ error: "Request not found", code: "PET_REQUEST_NOT_FOUND" });
      return;
    }

    const now = new Date();
    const adminActor = String(req.session?.admin?.login || req.session?.admin?.id || "admin").trim() || "admin";
    const petLabel = getPetTypeLabel(target.petType);
    const petName = resolvePetDisplayName(target.displayName, target.petType);

    await prisma.$transaction(async (tx) => {
      const existingPet = await tx.profileCardPet.findFirst({
        where: {
          userId: target.userId,
          petType: target.petType,
        },
      });

      if (!existingPet) {
        await tx.profileCardPet.create({
          data: {
            profileCardId: target.profileCardId,
            userId: target.userId,
            petType: target.petType,
            displayName: petName,
            priceSnapshot: Number(target.priceSnapshot || 0),
            isVisible: true,
          },
        });
      }

      await tx.petPurchaseRequest.update({
        where: { id: target.id },
        data: {
          status: "approved",
          adminNote: null,
          reviewedAt: now,
        },
      });

      if (String(target.status || "").trim().toLowerCase() !== "approved") {
        await tx.purchase.create({
          data: {
            userId: target.userId,
            type: "pet",
            amount: Number(target.priceSnapshot || 0),
            purchasedAt: now,
            approvedByAdmin: adminActor,
            approvedAt: now,
            note: `${petLabel}: ${petName} · request:${target.id}`,
          },
        });
      }
    });

    res.json({ ok: true });
  }),
);

router.post(
  "/pet-requests/:id/reject",
  asyncHandler(async (req, res) => {
    if (!prisma.petPurchaseRequest) {
      res.status(503).json({ error: "Pets storage unavailable", code: "PETS_STORAGE_UNAVAILABLE" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsPetRequest = await managerOwnsPetRequest(req, req.params.id);
      if (!ownsPetRequest) {
        res.status(404).json({ error: "Request not found", code: "PET_REQUEST_NOT_FOUND" });
        return;
      }
    }

    const target = await prisma.petPurchaseRequest.findUnique({
      where: { id: String(req.params.id || "").trim() },
      select: {
        id: true,
        status: true,
      },
    });
    if (!target) {
      res.status(404).json({ error: "Request not found", code: "PET_REQUEST_NOT_FOUND" });
      return;
    }
    if (String(target.status || "").trim().toLowerCase() === "approved") {
      res.status(409).json({ error: "Approved request cannot be rejected", code: "PET_REQUEST_ALREADY_APPROVED" });
      return;
    }

    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
    await prisma.petPurchaseRequest.update({
      where: { id: target.id },
      data: {
        status: "rejected",
        adminNote: adminNote || null,
        reviewedAt: new Date(),
      },
    });

    res.json({ ok: true });
  }),
);

router.get(
  "/verification-requests",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const managerScope = await getManagerScope(req);
    if (isManagerScopeBlocked(managerScope)) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const status = String(req.query.status || "all").toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 20;
    const baseWhere = status === "all" ? {} : { status };
    const where = managerScope.isManager
      ? andWhere(baseWhere, { user: { createdByStaffId: managerScope.managerId } })
      : baseWhere;

    const [total, rows] = await Promise.all([
      prisma.verificationRequest.count({ where }),
      prisma.verificationRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      items: rows,
      pagination: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.post(
  "/verification-requests/:id/approve",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsVerification = await managerOwnsVerificationRequest(req, req.params.id);
      if (!ownsVerification) {
        res.status(404).json({ error: "Request not found" });
        return;
      }
    }
    const target = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: target.id },
        data: {
          status: "approved",
          reviewedAt: now,
          adminNote: null,
        },
      }),
      prisma.user.update({
        where: { id: target.userId },
        data: {
          isVerified: true,
          verifiedCompany: target.companyName,
          directorySector: normalizeDirectorySector(target.sector),
          verifiedAt: now,
        },
      }),
    ]);
    res.json({ ok: true });
  }),
);

router.post(
  "/verification-requests/:id/reject",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsVerification = await managerOwnsVerificationRequest(req, req.params.id);
      if (!ownsVerification) {
        res.status(404).json({ error: "Request not found" });
        return;
      }
    }
    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const target = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    await prisma.verificationRequest.update({
      where: { id: target.id },
      data: {
        status: "rejected",
        adminNote: adminNote || null,
        reviewedAt: new Date(),
      },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/verification-requests/:id/revoke",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    if (isManagerSession(req)) {
      const ownsVerification = await managerOwnsVerificationRequest(req, req.params.id);
      if (!ownsVerification) {
        res.status(404).json({ error: "Request not found" });
        return;
      }
    }
    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const target = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (target.status !== "approved") {
      res.status(409).json({ error: "Only approved verification can be revoked" });
      return;
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: target.id },
        data: {
          status: "revoked",
          adminNote: adminNote || null,
          reviewedAt: now,
        },
      }),
      prisma.user.update({
        where: { id: target.userId },
        data: {
          isVerified: false,
          verifiedCompany: null,
          directorySector: null,
          verifiedAt: null,
        },
      }),
    ]);
    res.json({ ok: true });
  }),
);

router.get(
  "/violation-reports",
  asyncHandler(async (req, res) => {
    const statusRaw = String(req.query.status || "all").trim().toLowerCase();
    const status = ["all", "new", "processed"].includes(statusRaw) ? statusRaw : "all";
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const whereSql = status === "all" ? Prisma.empty : Prisma.sql`WHERE vr.status = ${status}`;

    try {
      const [countRows, rows] = await Promise.all([
        prisma.$queryRaw`
          SELECT COUNT(*)::int AS total
          FROM violation_reports vr
          ${whereSql}
        `,
        prisma.$queryRaw`
          SELECT
            vr.id,
            vr.user_id,
            vr.violation_type,
            vr.message,
            vr.status,
            vr.user_snapshot,
            vr.reporter_ip,
            vr.user_agent,
            vr.created_at,
            vr.updated_at,
            u.display_name,
            u.first_name,
            u.login,
            u.email,
            u.telegram_username
          FROM violation_reports vr
          LEFT JOIN users u ON u.id = vr.user_id
          ${whereSql}
          ORDER BY vr.created_at DESC
          LIMIT ${pageSize}
          OFFSET ${offset}
        `,
      ]);

      const total = Number(Array.isArray(countRows) ? countRows[0]?.total || 0 : 0);
      const items = (Array.isArray(rows) ? rows : []).map((row) => {
        const snapshot = row?.user_snapshot && typeof row.user_snapshot === "object" ? row.user_snapshot : {};
        return {
          id: String(row?.id || ""),
          userId: String(row?.user_id || ""),
          type: String(row?.violation_type || "other"),
          message: String(row?.message || ""),
          status: String(row?.status || "new"),
          reporterIp: String(row?.reporter_ip || ""),
          userAgent: String(row?.user_agent || ""),
          createdAt: row?.created_at || null,
          updatedAt: row?.updated_at || null,
          user: {
            displayName: String(snapshot?.displayName || row?.display_name || row?.first_name || ""),
            login: String(snapshot?.login || row?.login || ""),
            email: String(snapshot?.email || row?.email || ""),
            telegramUsername: String(snapshot?.telegramUsername || row?.telegram_username || ""),
            city: String(snapshot?.city || ""),
            plan: String(snapshot?.plan || ""),
            status: String(snapshot?.status || ""),
          },
        };
      });

      res.json({
        items,
        pagination: {
          page,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    } catch (error) {
      if (isTableOrColumnMissing(error)) {
        res.json({ items: [], pagination: { page: 1, total: 0, totalPages: 1 } });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/violation-reports/:id/process",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!isUuid(id)) {
      res.status(400).json({ error: "Invalid report id", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        UPDATE violation_reports
        SET status = 'processed',
            updated_at = now()
        WHERE id = ${id}
        RETURNING id, status, updated_at
      `;
      const row = Array.isArray(rows) ? rows[0] || null : null;
      if (!row) {
        res.status(404).json({ error: "Report not found", code: "NOT_FOUND" });
        return;
      }

      res.json({
        ok: true,
        item: {
          id: String(row.id || ""),
          status: String(row.status || "processed"),
          updatedAt: row.updated_at || null,
        },
      });
    } catch (error) {
      if (isTableOrColumnMissing(error)) {
        res.status(503).json({ error: "Reports storage unavailable", code: "REPORTS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

// ── Badge applications ──────────────────────────────────────────────

router.get(
  "/badge-applications",
  asyncHandler(async (req, res) => {
    if (!prisma.badgeApplication) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const managerScope = await getManagerScope(req);
    if (isManagerScopeBlocked(managerScope)) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const statusRaw = String(req.query.status || "all").toLowerCase();
    const status = ["all", "pending", "approved", "rejected", "revoked"].includes(statusRaw) ? statusRaw : "all";
    const badgeTypeRaw = String(req.query.badgeType || "all").toLowerCase();
    const badgeType = ["all", "government", "unqx_staff"].includes(badgeTypeRaw) ? badgeTypeRaw : "all";
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 20;
    const baseWhere = {};
    if (status !== "all") baseWhere.status = status;
    if (badgeType !== "all") baseWhere.badgeType = badgeType;
    const where = managerScope.isManager
      ? andWhere(baseWhere, { user: { createdByStaffId: managerScope.managerId } })
      : baseWhere;
    const [total, rows] = await Promise.all([
      prisma.badgeApplication.count({ where }),
      prisma.badgeApplication.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      items: rows,
      pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  }),
);

router.post(
  "/badge-applications/:id/approve",
  asyncHandler(async (req, res) => {
    if (!prisma.badgeApplication) {
      res.status(503).json({ error: "Badge applications unavailable" });
      return;
    }
    const target = await prisma.badgeApplication.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (target.status !== "pending") {
      res.status(409).json({ error: "Only pending applications can be approved" });
      return;
    }
    await prisma.badgeApplication.update({
      where: { id: target.id },
      data: { status: "approved", reviewedAt: new Date(), adminNote: null },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/badge-applications/:id/reject",
  asyncHandler(async (req, res) => {
    if (!prisma.badgeApplication) {
      res.status(503).json({ error: "Badge applications unavailable" });
      return;
    }
    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const target = await prisma.badgeApplication.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (target.status !== "pending") {
      res.status(409).json({ error: "Only pending applications can be rejected" });
      return;
    }
    await prisma.badgeApplication.update({
      where: { id: target.id },
      data: { status: "rejected", adminNote: adminNote || null, reviewedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/badge-applications/:id/revoke",
  asyncHandler(async (req, res) => {
    if (!prisma.badgeApplication) {
      res.status(503).json({ error: "Badge applications unavailable" });
      return;
    }
    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const target = await prisma.badgeApplication.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (target.status !== "approved") {
      res.status(409).json({ error: "Only approved applications can be revoked" });
      return;
    }
    await prisma.badgeApplication.update({
      where: { id: target.id },
      data: { status: "revoked", adminNote: adminNote || null, reviewedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

router.get(
  "/directory-exclusions",
  asyncHandler(async (_req, res) => {
    if (!prisma.directoryExclusion) {
      res.json({ items: [] });
      return;
    }
    const items = await prisma.directoryExclusion.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.json({ items });
  }),
);

router.post(
  "/directory-exclusions",
  asyncHandler(async (req, res) => {
    if (!prisma.directoryExclusion) {
      res.status(503).json({ error: "Directory exclusions storage unavailable" });
      return;
    }
    const slug = String(req.body?.slug || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 20);
    if (!slug) {
      res.status(400).json({ error: "Invalid slug" });
      return;
    }
    const row = await prisma.directoryExclusion.upsert({
      where: { slug },
      create: {
        slug,
        reason: String(req.body?.reason || "").trim() || null,
        excludedBy: String(req.session?.admin?.login || "").trim() || null,
      },
      update: {
        reason: String(req.body?.reason || "").trim() || null,
        excludedBy: String(req.session?.admin?.login || "").trim() || null,
      },
    });
    res.json({ ok: true, item: row });
  }),
);

router.delete(
  "/directory-exclusions/:slug",
  asyncHandler(async (req, res) => {
    if (!prisma.directoryExclusion) {
      res.status(503).json({ error: "Directory exclusions storage unavailable" });
      return;
    }
    const slug = String(req.params.slug || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 20);
    await prisma.directoryExclusion.deleteMany({ where: { slug } });
    res.json({ ok: true });
  }),
);

router.get(
  "/user-activity",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSize = 50;
    const q      = typeof req.query.q      === "string" ? req.query.q.trim()      : "";
    const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom.trim() : "";
    const dateTo   = typeof req.query.dateTo   === "string" ? req.query.dateTo.trim()   : "";

    const where = {};
    if (userId) where.userId = userId;
    if (action && action !== "all") where.action = action;
    if (q) {
      where.OR = [
        { userLogin: { contains: q, mode: "insensitive" } },
        { detail:    { contains: q, mode: "insensitive" } },
        { ip:        { contains: q, mode: "insensitive" } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    const [total, items] = await Promise.all([
      prisma.userActivityLog.count({ where }),
      prisma.userActivityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          userLogin: true,
          action: true,
          detail: true,
          createdAt: true,
        },
      }),
    ]);

    const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean))];
    const isPaidSlug = (s) => /^[A-Za-z]{3}[0-9]{3}$/.test(String(s || ""));
    const [slugRows, userRows] = userIds.length
      ? await Promise.all([
          prisma.slug.findMany({
            where: { ownerId: { in: userIds }, status: { in: ["approved", "active", "paused", "private"] } },
            select: { ownerId: true, fullSlug: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          }),
          prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, freeProfileCode: true },
          }),
        ])
      : [[], []];
    const paidSlugByUser = {};
    for (const s of slugRows) {
      if (isPaidSlug(s.fullSlug) && !paidSlugByUser[s.ownerId]) paidSlugByUser[s.ownerId] = s.fullSlug;
    }
    const freeCodeByUser = {};
    for (const u of userRows) {
      if (u.freeProfileCode) freeCodeByUser[u.id] = u.freeProfileCode;
    }

    res.json({
      items: items.map((i) => ({
        ...i,
        userSlug: i.userId ? (paidSlugByUser[i.userId] || null) : null,
        userFreeSlug: i.userId ? (freeCodeByUser[i.userId] || null) : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const rawType = req.query.type || "all";
    const type = rawType === "not_found" || rawType === "server_error" ? rawType : "all";
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSize = 50;
    const where = type === "all" ? {} : { type };
    const [total, logs] = await Promise.all([
      prisma.errorLog.count({ where }),
      prisma.errorLog.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      items: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/cards/:id/stats",
  asyncHandler(async (req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const days = Math.min(parsePositiveInt(req.query.days || null, 30), 90);
    const stats = await getGlobalStats(env.TIMEZONE);
    const normalized = days === 30 ? stats : { ...stats, dailySeries: stats.dailySeries.slice(-days) };

    res.json(normalized);
  }),
);

router.post(
  "/slug/next",
  asyncHandler(async (_req, res) => {
    const slug = await generateNextSlug();
    res.json({ slug });
  }),
);

router.post(
  "/push/test-user",
  asyncHandler(async (req, res) => {
    const requestedUserId = String(req.body?.userId || "").trim();
    const requestedSlug = sanitizeSlug(req.body?.slug || "");

    if (!requestedUserId && !requestedSlug) {
      res.status(400).json({ error: "userId or slug is required", code: "VALIDATION_ERROR" });
      return;
    }

    let resolvedUserId = requestedUserId;
    if (!resolvedUserId && requestedSlug) {
      const row = await prisma.slug.findUnique({
        where: { fullSlug: requestedSlug },
        select: { ownerId: true },
      });
      if (!row?.ownerId) {
        res.status(404).json({ error: "Slug owner not found", code: "NOT_FOUND" });
        return;
      }
      resolvedUserId = String(row.ownerId);
    }

    const title = String(req.body?.title || "Тестовое уведомление").trim().slice(0, 120);
    const messageBody = String(req.body?.body || "Проверка доставки push-уведомления").trim().slice(0, 512);
    if (!title || !messageBody) {
      res.status(400).json({ error: "Title and body are required", code: "VALIDATION_ERROR" });
      return;
    }

    const includeInApp = req.body?.includeInApp !== false;
    const baseData = parseJsonObject(req.body?.data, {});
    const data = {
      type: String(baseData?.type || "admin_test"),
      ...(baseData || {}),
    };

    const result = await sendExpoPushToUser({
      userId: resolvedUserId,
      title,
      body: messageBody,
      data,
      sound: normalizePushSound(req.body?.sound),
      respectNotifications: false,
    });

    let tokenDebug = { total: 0, expo: 0, nonExpo: 0, notificationsEnabled: null };
    try {
      const [tokenRows, userRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT token
          FROM push_tokens
          WHERE user_id = ${resolvedUserId}
        `,
        prisma.$queryRaw`
          SELECT notifications_enabled
          FROM users
          WHERE id = ${resolvedUserId}
          LIMIT 1
        `,
      ]);

      const tokens = Array.isArray(tokenRows)
        ? tokenRows
          .map((row) => String(row?.token || '').trim())
          .filter(Boolean)
        : [];
      const expo = tokens.filter((value) => /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(value)).length;

      tokenDebug = {
        total: tokens.length,
        expo,
        nonExpo: Math.max(0, tokens.length - expo),
        notificationsEnabled:
          Array.isArray(userRows) && userRows.length > 0
            ? userRows[0]?.notifications_enabled ?? null
            : null,
      };
    } catch (error) {
      if (!isPushStorageError(error)) {
        throw error;
      }
    }

    let inAppInserted = 0;
    if (includeInApp) {
      try {
        inAppInserted = await insertInAppNotifications([resolvedUserId], title, messageBody, data, "system");
      } catch (error) {
        if (!isPushStorageError(error)) {
          throw error;
        }
      }
    }

    res.json({
      ok: true,
      userId: resolvedUserId,
      result,
      inAppInserted,
      tokenDebug,
    });
  }),
);

router.post(
  "/push/broadcast",
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || "").trim().slice(0, 120);
    const messageBody = String(req.body?.body || "").trim().slice(0, 512);
    if (!title || !messageBody) {
      res.status(400).json({ error: "Title and body are required", code: "VALIDATION_ERROR" });
      return;
    }

    const plan = normalizePlanFilter(req.body?.plan);
    const status = normalizeStatusFilter(req.body?.status);
    const dryRun = req.body?.dryRun === true;
    const includeInApp = req.body?.includeInApp !== false;
    const onlyWithPushTokens = req.body?.onlyWithPushTokens !== false;
    const rawLimit = Number(req.body?.limit || 0);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 20_000) : 20_000;
    const baseData = parseJsonObject(req.body?.data, {});
    const data = {
      type: String(baseData?.type || "admin_broadcast"),
      ...(baseData || {}),
    };

    const recipientIds = await listBroadcastRecipientIds({
      plan,
      status,
      onlyWithPushTokens,
      limit,
    });

    if (dryRun) {
      res.json({
        ok: true,
        dryRun: true,
        recipients: recipientIds.length,
        filters: { plan, status, limit, onlyWithPushTokens },
      });
      return;
    }

    const result = await sendExpoPushToUsers({
      userIds: recipientIds,
      title,
      body: messageBody,
      data,
      sound: normalizePushSound(req.body?.sound),
      priority: normalizePushPriority(req.body?.priority),
      respectNotifications: false,
    });

    let inAppInserted = 0;
    if (includeInApp && recipientIds.length) {
      try {
        inAppInserted = await insertInAppNotifications(recipientIds, title, messageBody, data, "system");
      } catch (error) {
        if (!isPushStorageError(error)) {
          throw error;
        }
      }
    }

    res.json({
      ok: true,
      recipients: recipientIds.length,
      result,
      inAppInserted,
      filters: { plan, status, limit, onlyWithPushTokens },
    });
  }),
);

router.post(
  "/push/broadcast/start",
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || "").trim().slice(0, 120);
    const messageBody = String(req.body?.body || "").trim().slice(0, 512);
    if (!title || !messageBody) {
      res.status(400).json({ error: "Title and body are required", code: "VALIDATION_ERROR" });
      return;
    }

    const plan = normalizePlanFilter(req.body?.plan);
    const status = normalizeStatusFilter(req.body?.status);
    const dryRun = req.body?.dryRun === true;
    const includeInApp = req.body?.includeInApp !== false;
    const onlyWithPushTokens = req.body?.onlyWithPushTokens !== false;
    const rawLimit = Number(req.body?.limit || 0);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 20_000) : 20_000;
    const baseData = parseJsonObject(req.body?.data, {});
    const data = {
      type: String(baseData?.type || "admin_broadcast"),
      ...(baseData || {}),
    };

    const recipientIds = await listBroadcastRecipientIds({
      plan,
      status,
      onlyWithPushTokens,
      limit,
    });

    const payload = {
      title,
      body: messageBody,
      data,
      sound: normalizePushSound(req.body?.sound),
      priority: normalizePushPriority(req.body?.priority),
      respectNotifications: false,
      includeInApp,
      dryRun,
      recipientIds,
      filters: { plan, status, limit, onlyWithPushTokens },
    };

    const job = makeBroadcastJob(payload);
    void runBroadcastJob(job.id);

    res.json({
      ok: true,
      job: getBroadcastJobView(job),
    });
  }),
);

router.get(
  "/push/broadcast/jobs/:jobId",
  asyncHandler(async (req, res) => {
    trimBroadcastJobs();
    const jobId = String(req.params?.jobId || "").trim();
    const job = broadcastJobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: "Broadcast job not found", code: "NOT_FOUND" });
      return;
    }

    res.json({
      ok: true,
      job: getBroadcastJobView(job),
    });
  }),
);

router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSize = 25;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rawPlan = typeof req.query.plan === "string" ? req.query.plan.trim() : "all";
    const planFilter = ["free", "premium"].includes(rawPlan) ? rawPlan : "all";

    const where = {};
    if (planFilter === "free") {
      where.plan = "none";
    } else if (planFilter === "premium") {
      where.plan = { in: ["premium", "basic"] };
    }
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { login: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          login: true,
          freeProfileCode: true,
          slugs: {
            where: { status: { in: ["free", "approved", "active", "paused", "private"] } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { fullSlug: true, isPrimary: true },
          },
        },
      }),
    ]);

    const isPaidSlug = (s) => /^[A-Za-z]{3}[0-9]{3}$/.test(String(s || ""));

    res.json({
      items: rows.map((u) => {
        const primarySlug = (u.slugs.find((s) => s.isPrimary) || u.slugs[0] || null)?.fullSlug || null;
        const paidSlug = u.slugs.find((s) => isPaidSlug(s.fullSlug))?.fullSlug || null;
        return {
          id: u.id,
          firstName: u.firstName,
          login: u.login,
          slug: paidSlug || primarySlug,
          freeSlug: u.freeProfileCode || null,
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.post(
  "/logs/cleanup",
  asyncHandler(async (_req, res) => {
    const threshold = subDays(new Date(), 30);
    const result = await prisma.errorLog.deleteMany({
      where: {
        occurredAt: { lt: threshold },
      },
    });

    res.json({ ok: true, deleted: result.count });
  }),
);

module.exports = {
  adminApiRouter: router,
};
