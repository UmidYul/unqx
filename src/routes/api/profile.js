const express = require("express");
const multer = require("multer");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { requireUserApi, getUserSession, logoutUserSession } = require("../../middleware/auth");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const {
  getEffectivePlan,
  getSlugLimit,
  getTagLimit,
  getButtonLimit,
  canCreateCard,
  canAccessAnalytics,
  normalizeThemeByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  getPlanBadgeLabel,
} = require("../../services/profile");
const {
  isSupportedAvatarBuffer,
  saveAvatarFromBuffer,
  deleteAvatarByPublicPath,
  buildAvatarSlug,
} = require("../../services/avatar");
const { getProfileScoreByUserId, recalculateAndRefreshPercentiles } = require("../../services/unq-score");
const { getPricingSettings, getBraceletPrice } = require("../../services/pricing-settings");
const { sendVerificationRequestToAdmin } = require("../../services/telegram");
const { sendAccountDeactivatedEmail } = require("../../services/email");
const { resolveUzbekistanCity } = require("../../constants/uzbekistan-cities");
const { getSetting } = require("../../services/platform-settings");
const { getOrderPaymentReference, buildManualTelegramPaymentUrl, normalizeTelegramUsername } = require("../../services/payment-flow");
const {
  PRIVATE_PASSWORD_MIN_LENGTH,
  PRIVATE_PASSWORD_MAX_COUNT,
  normalizePrivatePasswordLabel,
  normalizePrivatePasswordValue,
  validatePrivatePasswordValue,
  hashPrivatePassword,
  comparePrivatePassword,
} = require("../../services/private-access");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const CARD_THEMES = new Set(["default_dark", "arctic", "linen", "marble", "forest", "sage_luxe", "midnight_obsidian", "golden_noir", "aurora_codex", "nebula_glass", "velours"]);
const normalizeCardThemeKey = (value) => {
  const raw = String(value || "").trim();
  if (raw === "royal_ivory") return "sage_luxe";
  return raw;
};
const DIRECTORY_SECTORS = new Set(["design", "sales", "marketing", "it", "other"]);
const ACCOUNT_REACTIVATION_WINDOW_DAYS = Number(env.ACCOUNT_REACTIVATION_WINDOW_DAYS || 30);
const UNKNOWN_CITY_LABEL = "Неизвестно";
const FALLBACK_SUPPORT_TELEGRAM = "unqx_uz";
const GEO_CITY_NOISE_ALIASES = new Set([
  "the dalles",
]);
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
  "show_branding",
];
const CARD_THEME_ENUM_CACHE_TTL_MS = 5 * 60 * 1000;
let cardThemeEnumCache = {
  checkedAt: 0,
  values: null,
};

function toSlugStatusLabel(status) {
  switch (status) {
    case "active":
      return "Активен";
    case "paused":
      return "Пауза";
    case "private":
      return "Приватный";
    case "approved":
      return "Одобрен";
    case "pending":
    case "reserved":
      return "В ожидании";
    case "blocked":
      return "Заблокирован";
    case "free":
      return "Свободен";
    default:
      return status;
  }
}

function toRequestStatusBadge(status) {
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

function mapProfileRequest(item, options = {}) {
  const supportTelegram = normalizeTelegramUsername(options.supportTelegram || FALLBACK_SUPPORT_TELEGRAM);
  const fullName = String(options.fullName || "").trim();
  const email = String(options.email || "").trim();
  const braceletPrice = Math.max(0, Number(options.braceletPrice || 0));
  const slugPrice = Number(item.slugPrice || 0);
  const planPrice = Number(item.planPrice || 0);
  const hasBracelet = Boolean(item.bracelet);
  const inviteeDiscountApplied = Math.max(0, Number(item.inviteeDiscountApplied || 0));
  const promoDiscountApplied = Math.max(0, Number(item.promoDiscountApplied || 0));
  const promoCode = String(item.promoCode || "").trim();
  const bonusSpent = Math.max(0, Number(item.bonusSpent || 0));
  const slugPayable = Math.max(0, slugPrice);
  const totalAmount = slugPayable + planPrice + (hasBracelet ? braceletPrice : 0);
  const slugPriceBeforeDiscount = slugPayable + inviteeDiscountApplied + promoDiscountApplied + bonusSpent;
  const paymentReference = getOrderPaymentReference(item.id);
  return {
    id: item.id,
    slug: item.slug,
    requestedPlan: item.requestedPlan,
    planPrice: item.planPrice,
    bracelet: item.bracelet,
    status: item.status,
    statusBadge: toRequestStatusBadge(item.status),
    adminNote: item.adminNote,
    purchasedAt: item.status === "approved" ? item.updatedAt : null,
    createdAt: item.createdAt,
    paymentReference,
    paymentUrl: buildManualTelegramPaymentUrl({
      orderId: item.id,
      slug: item.slug,
      requestedPlan: item.requestedPlan,
      reference: paymentReference,
      telegramUsername: supportTelegram,
      fullName,
      email,
      slugPrice: slugPayable,
      slugPriceBeforeDiscount,
      inviteeDiscountApplied,
      promoDiscountApplied,
      promoCode,
      bonusSpent,
      planPrice,
      bracelet: hasBracelet,
      braceletPrice,
      totalAmount,
    }),
    promoCode,
    promoDiscountApplied,
    inviteeDiscountApplied,
    bonusSpent,
    slugPriceBeforeDiscount,
    slugPrice: slugPayable,
    totalOneTime: totalAmount,
  };
}

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeAnalyticsPeriod(value, isPremium) {
  const parsed = Number(value);
  if (parsed === 7) return 7;
  if (isPremium && (parsed === 30 || parsed === 90)) return parsed;
  return 7;
}

function normalizeDirectorySector(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return DIRECTORY_SECTORS.has(normalized) ? normalized : "other";
}

function normalizeAnalyticsCityLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return UNKNOWN_CITY_LABEL;

  const lower = raw.toLowerCase();
  if (
    lower === "unknown" ||
    lower === "неизвестно" ||
    lower === "null" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "-"
  ) {
    return UNKNOWN_CITY_LABEL;
  }

  const normalizedUzbekistanCity = resolveUzbekistanCity(raw);
  if (normalizedUzbekistanCity) {
    return normalizedUzbekistanCity;
  }

  if (GEO_CITY_NOISE_ALIASES.has(lower)) {
    return UNKNOWN_CITY_LABEL;
  }

  return raw.slice(0, 120);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
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
  const extraPhone = row.extraPhone ?? row.extra_phone ?? "";
  const createdAt = row.createdAt ?? row.created_at ?? null;
  const updatedAt = row.updatedAt ?? row.updated_at ?? null;
  const showBrandingRaw = row.showBranding ?? row.show_branding;
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
    theme: (() => {
      const nextTheme = normalizeCardThemeKey(row.theme);
      return CARD_THEMES.has(nextTheme) ? nextTheme : "default_dark";
    })(),
    customColor: customColor || "",
    showBranding: toBool(showBrandingRaw, true),
    createdAt,
    updatedAt,
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
  return "default_dark";
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

function isCardThemeEnumValueError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const mergedMessage = buildRawErrorText(error);
  const enumInputFailure =
    code === "P2010" || code === "22P02" || /invalid input value for enum/i.test(mergedMessage);
  return enumInputFailure && /cardtheme/i.test(mergedMessage);
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

async function getCurrentUser(req) {
  const sessionUser = getUserSession(req);
  if (!sessionUser?.userId) {
    return null;
  }
  const row = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: {
      id: true,
      email: true,
      login: true,
      pendingEmail: true,
      emailVerified: true,
      firstName: true,
      lastName: true,
      city: true,
      username: true,
      telegramUsername: true,
      telegramChatId: true,
      displayName: true,
      plan: true,
      notificationsEnabled: true,
      status: true,
      isVerified: true,
      verifiedCompany: true,
      verifiedAt: true,
      showInDirectory: true,
      directorySector: true,
      welcomeDismissed: true,
      planPurchasedAt: true,
      planUpgradedAt: true,
    },
  });
  if (!row) return null;
    return {
      ...row,
      username: row.username || row.telegramUsername || null,
    };
}

function assertUserActive(user, res) {
  if (!user) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    return false;
  }
  if (user.status === "blocked" || user.status === "deactivated" || user.status === "deleted") {
    res.status(403).json({ error: "Account is disabled", code: "ACCOUNT_DISABLED" });
    return false;
  }
  return true;
}

function assertPlanAllowsCard(user, res) {
  if (!canCreateCard(user)) {
    res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
    return false;
  }
  return true;
}

function assertPlanAllowsSlugManagement(user, res) {
  const plan = getEffectivePlan(user).plan;
  if (plan === "none") {
    res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
    return false;
  }
  return true;
}

async function safeRecalculateScore(userId) {
  try {
    await recalculateAndRefreshPercentiles(userId);
  } catch (error) {
    console.error("[express-app] failed to recalculate score", error);
  }
}

function isPrivateAccessStorageMissing(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  return code === "42P01" || code === "42703" || code === "P2021" || code === "P2022";
}

function mapPrivatePasswordRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    label: String(row.label || ""),
    createdAt: row.created_at || row.createdAt || null,
    lastUsedAt: row.last_used_at || row.lastUsedAt || null,
  };
}

async function listOwnerPrivatePasswords(ownerId) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, label, created_at, last_used_at
      FROM card_private_passwords
      WHERE owner_id = ${ownerId}
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ${PRIVATE_PASSWORD_MAX_COUNT}
    `;
    return (Array.isArray(rows) ? rows : [])
      .map((row) => mapPrivatePasswordRow(row))
      .filter(Boolean);
  } catch (error) {
    if (isPrivateAccessStorageMissing(error)) {
      return [];
    }
    throw error;
  }
}

async function getUserSlugsWithStats(userId) {
  const slugs = await prisma.slug.findMany({
    where: { ownerId: userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  const fullSlugs = slugs.map((item) => item.fullSlug);

  let viewsBySlug = new Map();
  if (fullSlugs.length > 0 && prisma.analyticsView) {
    const rows = await prisma.analyticsView.findMany({
      where: {
        slug: { in: fullSlugs },
      },
      select: {
        slug: true,
        visitedAt: true,
        sessionId: true,
      },
    });
    const bucket = new Map();
    for (const row of rows) {
      const key = row.slug;
      const current = bucket.get(key) || { since: row.visitedAt, sessions: new Set() };
      if (!current.since || row.visitedAt < current.since) {
        current.since = row.visitedAt;
      }
      current.sessions.add(row.sessionId);
      bucket.set(key, current);
    }
    viewsBySlug = new Map(
      Array.from(bucket.entries()).map(([slug, value]) => [
        slug,
        {
          views: value.sessions.size,
          since: value.since || null,
        },
      ]),
    );
  }

  return slugs.map((item) => {
    const stat = viewsBySlug.get(item.fullSlug) || { views: 0, since: item.createdAt };
    return {
      id: item.id,
      letters: item.letters,
      digits: item.digits,
      fullSlug: item.fullSlug,
      status: item.status,
      statusLabel: toSlugStatusLabel(item.status),
      isPrimary: item.isPrimary,
      pauseMessage: item.pauseMessage || "",
      requestedAt: item.requestedAt,
      approvedAt: item.approvedAt,
      activatedAt: item.activatedAt,
      createdAt: item.createdAt,
      stats: {
        views: stat.views,
        since: stat.since,
      },
    };
  });
}

router.use(requireUserApi);
router.use(requireSameOrigin);
router.use(requireCsrfToken);

router.get(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const [slugs, card, requests, score, pricing, supportTelegramRaw, braceletPrice, privatePasswords] = await Promise.all([
      getUserSlugsWithStats(user.id),
      findProfileCardByOwnerId(user.id),
      prisma.slugRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      getProfileScoreByUserId(user.id),
      getPricingSettings(),
      getSetting("contact_support_telegram", `@${FALLBACK_SUPPORT_TELEGRAM}`),
      getBraceletPrice(),
      listOwnerPrivatePasswords(user.id),
    ]);
    const supportTelegram = normalizeTelegramUsername(supportTelegramRaw);

    const effective = getEffectivePlan(user);

    res.json({
      user: {
        id: user.id,
        email: user.email || "",
        login: user.login || "",
        pendingEmail: user.pendingEmail || "",
        emailVerified: Boolean(user.emailVerified),
        firstName: user.firstName,
        lastName: user.lastName,
        city: user.city || "",
        username: user.username,
        displayName: normalizeDisplayName(user.displayName, user.firstName),
        plan: user.plan,
        effectivePlan: effective.plan,
        planPurchasedAt: user.planPurchasedAt,
        planUpgradedAt: user.planUpgradedAt,
        welcomeDismissed: Boolean(user.welcomeDismissed),
        planBadge: getPlanBadgeLabel(effective.plan),
        notificationsEnabled: Boolean(user.notificationsEnabled),
        status: user.status,
        isVerified: Boolean(user.isVerified),
        verifiedCompany: user.verifiedCompany || "",
        verifiedAt: user.verifiedAt || null,
        showInDirectory: typeof user.showInDirectory === "boolean" ? user.showInDirectory : true,
        directorySector: normalizeDirectorySector(user.directorySector),
      },
      limits: {
        slugs: getSlugLimit(effective.plan),
        tags: getTagLimit(effective.plan),
        buttons: getButtonLimit(effective.plan),
      },
      slugs: effective.plan === "none" ? [] : slugs,
      card: effective.plan === "none" ? null : parseProfileCardRow(card),
      requests: requests.map((item) =>
        mapProfileRequest(item, {
          supportTelegram,
          fullName: normalizeDisplayName(user.displayName, user.firstName),
          email: user.email || "",
          braceletPrice,
        }),
      ),
      score,
      pricing,
      access: {
        canCreateCard: canCreateCard(user),
        canAccessAnalytics: canAccessAnalytics(user),
      },
      privacy: {
        passwordMinLength: PRIVATE_PASSWORD_MIN_LENGTH,
        passwordLimit: PRIVATE_PASSWORD_MAX_COUNT,
        passwords: privatePasswords,
      },
    });
  }),
);

router.get(
  "/slugs",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (getEffectivePlan(user).plan === "none") {
      res.json({ items: [] });
      return;
    }

    const slugs = await getUserSlugsWithStats(user.id);
    res.json({ items: slugs });
  }),
);

router.patch(
  "/card/status",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const nextStatus = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "paused", "private"].includes(nextStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const ownedSlugs = await prisma.slug.findMany({
      where: {
        ownerId: user.id,
        status: { in: ["active", "private", "paused", "approved"] },
      },
      select: { fullSlug: true },
    });

    if (!ownedSlugs.length) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    await prisma.slug.updateMany({
      where: {
        ownerId: user.id,
        fullSlug: { in: ownedSlugs.map((item) => item.fullSlug) },
      },
      data: { status: nextStatus },
    });
    await safeRecalculateScore(user.id);

    res.json({
      ok: true,
      status: nextStatus,
      count: ownedSlugs.length,
      slugs: ownedSlugs.map((item) => item.fullSlug),
    });
  }),
);

router.patch(
  "/slugs/:slug/status",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const nextStatus = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "paused", "private"].includes(nextStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug },
      data: { status: nextStatus },
    });
    await safeRecalculateScore(user.id);

    res.json({ ok: true, slug: updated.fullSlug, status: updated.status });
  }),
);

router.patch(
  "/slugs/:slug/primary",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    await prisma.$transaction([
      prisma.slug.updateMany({
        where: { ownerId: user.id },
        data: { isPrimary: false },
      }),
      prisma.slug.update({
        where: { fullSlug },
        data: { isPrimary: true },
      }),
    ]);
    await safeRecalculateScore(user.id);

    res.json({ ok: true, slug: fullSlug, isPrimary: true });
  }),
);

router.patch(
  "/slugs/:slug/pause-message",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const message = String(req.body.message || "").trim().slice(0, 220);
    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug },
      data: { pauseMessage: message || null },
    });

    res.json({ ok: true, slug: updated.fullSlug, pauseMessage: updated.pauseMessage || "" });
  }),
);

router.get(
  "/privacy/passwords",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const items = await listOwnerPrivatePasswords(user.id);
    res.json({
      items,
      minLength: PRIVATE_PASSWORD_MIN_LENGTH,
      limit: PRIVATE_PASSWORD_MAX_COUNT,
    });
  }),
);

router.get(
  "/privacy/access-logs",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    res.json({ items: [] });
  }),
);

router.post(
  "/privacy/passwords",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const label = normalizePrivatePasswordLabel(req.body?.label);
    const password = normalizePrivatePasswordValue(req.body?.password);
    if (!validatePrivatePasswordValue(password)) {
      res.status(400).json({
        error: `Пароль должен содержать минимум ${PRIVATE_PASSWORD_MIN_LENGTH} символа`,
        code: "PRIVATE_PASSWORD_TOO_SHORT",
      });
      return;
    }

    try {
      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM card_private_passwords
        WHERE owner_id = ${user.id}
          AND deleted_at IS NULL
      `;
      const currentCount = Number(Array.isArray(countRows) ? countRows[0]?.count || 0 : 0);
      if (currentCount >= PRIVATE_PASSWORD_MAX_COUNT) {
        res.status(400).json({
          error: `Доступно максимум ${PRIVATE_PASSWORD_MAX_COUNT} паролей`,
          code: "PRIVATE_PASSWORD_LIMIT_REACHED",
        });
        return;
      }

      const passwordHash = await hashPrivatePassword(password);
      const inserted = await prisma.$queryRaw`
        INSERT INTO card_private_passwords (
          owner_id,
          label,
          password_hash,
          created_at,
          updated_at
        )
        VALUES (
          ${user.id},
          ${label || null},
          ${passwordHash},
          now(),
          now()
        )
        RETURNING id, label, created_at, last_used_at
      `;
      const row = Array.isArray(inserted) ? inserted[0] : null;
      res.status(201).json({
        ok: true,
        item: mapPrivatePasswordRow(row),
      });
    } catch (error) {
      if (isPrivateAccessStorageMissing(error)) {
        res.status(503).json({ error: "Хранилище приватного доступа недоступно", code: "PRIVATE_ACCESS_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/privacy/passwords/:passwordId/change",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const passwordId = String(req.params.passwordId || "").trim();
    if (!passwordId) {
      res.status(400).json({ error: "Пароль не найден", code: "PRIVATE_PASSWORD_INVALID_ID" });
      return;
    }

    const oldPassword = normalizePrivatePasswordValue(req.body?.oldPassword);
    const nextPassword = normalizePrivatePasswordValue(req.body?.newPassword);
    if (!validatePrivatePasswordValue(nextPassword)) {
      res.status(400).json({
        error: `Новый пароль должен содержать минимум ${PRIVATE_PASSWORD_MIN_LENGTH} символа`,
        code: "PRIVATE_PASSWORD_TOO_SHORT",
      });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        SELECT id, label, password_hash, created_at, last_used_at
        FROM card_private_passwords
        WHERE id = ${passwordId}
          AND owner_id = ${user.id}
          AND deleted_at IS NULL
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) {
        res.status(404).json({ error: "Пароль не найден", code: "PRIVATE_PASSWORD_NOT_FOUND" });
        return;
      }

      const oldMatches = await comparePrivatePassword(oldPassword, row.password_hash);
      if (!oldMatches) {
        res.status(400).json({ error: "Старый пароль неверный", code: "PRIVATE_PASSWORD_OLD_INVALID" });
        return;
      }

      const nextHash = await hashPrivatePassword(nextPassword);
      const updated = await prisma.$queryRaw`
        UPDATE card_private_passwords
        SET password_hash = ${nextHash},
            updated_at = now()
        WHERE id = ${passwordId}
          AND owner_id = ${user.id}
          AND deleted_at IS NULL
        RETURNING id, label, created_at, last_used_at
      `;
      const updatedRow = Array.isArray(updated) ? updated[0] : null;
      res.json({ ok: true, item: mapPrivatePasswordRow(updatedRow) });
    } catch (error) {
      if (isPrivateAccessStorageMissing(error)) {
        res.status(503).json({ error: "Хранилище приватного доступа недоступно", code: "PRIVATE_ACCESS_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.delete(
  "/privacy/passwords/:passwordId",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const passwordId = String(req.params.passwordId || "").trim();
    if (!passwordId) {
      res.status(400).json({ error: "Пароль не найден", code: "PRIVATE_PASSWORD_INVALID_ID" });
      return;
    }

    try {
      const rows = await prisma.$queryRaw`
        UPDATE card_private_passwords
        SET deleted_at = now(),
            updated_at = now()
        WHERE id = ${passwordId}
          AND owner_id = ${user.id}
          AND deleted_at IS NULL
        RETURNING id
      `;
      const deleted = Array.isArray(rows) ? rows[0] : null;
      if (!deleted) {
        res.status(404).json({ error: "Пароль не найден", code: "PRIVATE_PASSWORD_NOT_FOUND" });
        return;
      }
      res.json({ ok: true, id: String(deleted.id) });
    } catch (error) {
      if (isPrivateAccessStorageMissing(error)) {
        res.status(503).json({ error: "Хранилище приватного доступа недоступно", code: "PRIVATE_ACCESS_UNAVAILABLE" });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  "/card",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!canCreateCard(user)) {
      res.json({ card: null });
      return;
    }
    const row = await findProfileCardByOwnerId(user.id);
    res.json({ card: parseProfileCardRow(row) });
  }),
);

router.put(
  "/card",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsCard(user, res)) {
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
    if (effective.plan !== "premium" && rawTags.length > getTagLimit("basic")) {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }
    if (effective.plan !== "premium" && rawButtons.length > getButtonLimit("basic")) {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }
    const tags = normalizeTags(body.tags, effective.plan);
    const buttons = normalizeButtons(body.buttons, effective.plan);
    const theme = normalizeThemeByPlan(body.theme, effective.plan);
    const themeForDatabase = await normalizeCardThemeForDatabase(theme);
    const customColor = effective.plan === "premium" ? normalizeColor(body.customColor) : null;
    const showBranding =
      effective.plan === "premium"
        ? (typeof body.showBranding === "boolean" ? body.showBranding : true)
        : true;

    if (effective.plan !== "premium") {
      const requestedTheme = String(body.theme || "").trim();
      if (requestedTheme && requestedTheme !== "default_dark") {
        res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
        return;
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      await upsertProfileCardCompat(tx, {
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
        showBranding,
      });
      await patchOptionalProfileCardFields(tx, user.id, {
        hashtag,
        address,
        postcode,
        extraPhone,
      });

      await tx.slug.updateMany({
        where: {
          ownerId: user.id,
          status: "approved",
        },
        data: {
          status: "active",
          activatedAt: new Date(),
        },
      });

      return findProfileCardByOwnerId(user.id);
    });
    await safeRecalculateScore(user.id);

    res.json({ ok: true, card: parseProfileCardRow(saved) });
  }),
);

router.post(
  "/card/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsCard(user, res)) {
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
  "/card/avatar",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    if (!assertPlanAllowsCard(user, res)) {
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

    res.json({ ok: true, avatarUrl: null });
  }),
);

router.get(
  "/slugs/:slug/qr",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    if (getEffectivePlan(user).plan !== "premium") {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const slugRow = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
      select: {
        fullSlug: true,
        status: true,
        ownerId: true,
        owner: {
          select: {
            firstName: true,
            displayName: true,
            profileCard: { select: { name: true, role: true } },
          },
        },
      },
    });
    if (!slugRow) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const score = await getProfileScoreByUserId(user.id);
    const ownerName = slugRow.owner?.profileCard?.name || slugRow.owner?.displayName || slugRow.owner?.firstName || "UNQX User";
    const ownerRole = slugRow.owner?.profileCard?.role || "";
    res.json({
      slug: slugRow.fullSlug,
      url: `https://unqx.uz/${slugRow.fullSlug}`,
      ownerName,
      ownerRole,
      score: Number(score?.score || 0),
      isAvailableForPublicQr: ["active", "private"].includes(slugRow.status),
    });
  }),
);

router.get(
  "/analytics/bootstrap",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    const slugs = await prisma.slug.findMany({
      where: { ownerId: user.id, status: { in: ["active", "private", "paused", "approved"] } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { fullSlug: true, isPrimary: true, status: true },
    });
    const effectivePlan = getEffectivePlan(user).plan;
    const selectedSlug = slugs.find((item) => item.isPrimary)?.fullSlug || slugs[0]?.fullSlug || null;
    res.json({
      slugs,
      currentPlan: effectivePlan,
      selectedSlug,
      periods: effectivePlan === "premium" ? [7, 30, 90] : [7],
    });
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    const fullSlug = sanitizeSlug(req.query.slug);
    if (!fullSlug) {
      res.status(400).json({ error: "Slug is required" });
      return;
    }
    const owned = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
      select: { fullSlug: true },
    });
    if (!owned) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const effectivePlan = getEffectivePlan(user).plan;
    const period = normalizeAnalyticsPeriod(req.query.period, effectivePlan === "premium");
    const now = new Date();
    const from = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousFrom = new Date(from.getTime() - period * 24 * 60 * 60 * 1000);

    const [views, prevViews, clicks, prevClicks, score, tapGeoRows] = await Promise.all([
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { slug: fullSlug, visitedAt: { gte: from } } })
        : Promise.resolve([]),
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { slug: fullSlug, visitedAt: { gte: previousFrom, lt: from } } })
        : Promise.resolve([]),
      prisma.analyticsClick
        ? prisma.analyticsClick.findMany({ where: { slug: fullSlug, clickedAt: { gte: from } } })
        : Promise.resolve([]),
      prisma.analyticsClick
        ? prisma.analyticsClick.findMany({ where: { slug: fullSlug, clickedAt: { gte: previousFrom, lt: from } } })
        : Promise.resolve([]),
      getProfileScoreByUserId(user.id),
      (async () => {
        try {
          const rows = await prisma.$queryRaw`
            SELECT
              COALESCE(NULLIF(BTRIM(u.city), ''), NULLIF(BTRIM(te.city), '')) AS city,
              COALESCE(
                NULLIF(BTRIM(COALESCE(te.visitor_user_id::text, '')), ''),
                NULLIF(BTRIM(COALESCE(te.visitor_slug, '')), ''),
                NULLIF(BTRIM(COALESCE(te.visitor_ip, '')), ''),
                CONCAT('row:', te.id::text)
              ) AS visitor_key
            FROM tap_events te
            LEFT JOIN users u ON u.id = te.visitor_user_id
            WHERE te.owner_slug = ${fullSlug}
              AND te.created_at >= ${from}
          `;
          return Array.isArray(rows) ? rows : [];
        } catch (error) {
          if (isMissingStorageError(error)) {
            return [];
          }
          throw error;
        }
      })(),
    ]);

    const uniqueVisitors = new Set(views.map((item) => item.sessionId)).size;
    const prevUniqueVisitors = new Set(prevViews.map((item) => item.sessionId)).size;
    const uniqueClickers = new Set(
      clicks.map((item) => {
        const sessionId = String(item.sessionId || "").trim();
        return sessionId || `legacy:${item.id}`;
      }),
    ).size;
    const prevUniqueClickers = new Set(
      prevClicks.map((item) => {
        const sessionId = String(item.sessionId || "").trim();
        return sessionId || `legacy:${item.id}`;
      }),
    ).size;
    const ctr = uniqueVisitors ? Number(((uniqueClickers / uniqueVisitors) * 100).toFixed(1)) : 0;
    const prevCtr = prevUniqueVisitors ? Number(((prevUniqueClickers / prevUniqueVisitors) * 100).toFixed(1)) : 0;

    const byDaySessions = new Map();
    const bySourceSessions = new Map();
    const byCitySessions = new Map();
    const byDeviceSessions = new Map();

    views.forEach((item) => {
      const sessionId = String(item.sessionId || "");
      const dayKey = item.visitedAt.toISOString().slice(0, 10);
      if (!byDaySessions.has(dayKey)) byDaySessions.set(dayKey, new Set());
      byDaySessions.get(dayKey).add(sessionId);

      const sourceKey = String(item.source || "direct");
      if (!bySourceSessions.has(sourceKey)) bySourceSessions.set(sourceKey, new Set());
      bySourceSessions.get(sourceKey).add(sessionId);

      const cityKey = normalizeAnalyticsCityLabel(item.city);
      if (!byCitySessions.has(cityKey)) byCitySessions.set(cityKey, new Set());
      byCitySessions.get(cityKey).add(sessionId);

      const deviceKey = String(item.device || "desktop");
      if (!byDeviceSessions.has(deviceKey)) byDeviceSessions.set(deviceKey, new Set());
      byDeviceSessions.get(deviceKey).add(sessionId);
    });

    // NFC/mobile taps are written to tap_events, not analytics_views.
    // Merge known cities from tap_events so profile geography shows real locations.
    tapGeoRows.forEach((item) => {
      const visitorKey = String(item?.visitor_key || "").trim();
      if (!visitorKey) return;
      const cityKey = normalizeAnalyticsCityLabel(item?.city);
      if (cityKey === UNKNOWN_CITY_LABEL) return;
      if (!byCitySessions.has(cityKey)) byCitySessions.set(cityKey, new Set());
      byCitySessions.get(cityKey).add(`tap:${visitorKey}`);
    });

    const byDay = new Map(Array.from(byDaySessions.entries()).map(([k, s]) => [k, s.size]));
    const bySource = Object.fromEntries(Array.from(bySourceSessions.entries()).map(([k, s]) => [k, s.size]));
    const byCity = Object.fromEntries(Array.from(byCitySessions.entries()).map(([k, s]) => [k, s.size]));
    const byDevice = Object.fromEntries(Array.from(byDeviceSessions.entries()).map(([k, s]) => [k, s.size]));
    const byButton = {};
    clicks.forEach((item) => {
      const key = String(item.buttonType || "other");
      byButton[key] = (byButton[key] || 0) + 1;
    });
    const byHour = {};
    views.forEach((item) => {
      const d = new Date(item.visitedAt);
      const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
      byHour[key] = (byHour[key] || 0) + 1;
    });

    res.json({
      slug: fullSlug,
      period,
      kpi: {
        views: uniqueVisitors,
        uniqueVisitors,
        clicks: uniqueClickers,
        ctr,
        trends: {
          views: uniqueVisitors - prevUniqueVisitors,
          uniqueVisitors: uniqueVisitors - prevUniqueVisitors,
          clicks: uniqueClickers - prevUniqueClickers,
          ctr: Number((ctr - prevCtr).toFixed(1)),
        },
      },
      chart: {
        viewsByDay: Array.from(byDay.entries()).map(([date, value]) => ({ date, value })),
        trafficSources: bySource,
        geography: byCity,
        devices: byDevice,
        buttonActivity: byButton,
        peakHours: byHour,
      },
      score,
      flags: {
        isPremium: effectivePlan === "premium",
        lockedPeriods: effectivePlan === "premium" ? [] : [30, 90],
      },
    });
  }),
);

router.get(
  "/verification",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    const latest = prisma.verificationRequest
      ? await prisma.verificationRequest.findFirst({
        where: { userId: user.id },
        orderBy: { requestedAt: "desc" },
      })
      : null;
    const latestStatus = String(latest?.status || "").toLowerCase();
    const canSubmitRequest = latestStatus !== "pending";
    const canSendCorrection = latestStatus === "pending";
    res.json({
      isVerified: Boolean(user.isVerified),
      latestRequest: latest,
      canSubmitRequest,
      canSendCorrection,
    });
  }),
);

router.post(
  "/verification-request",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    const latest = await prisma.verificationRequest.findFirst({
      where: { userId: user.id },
      orderBy: { requestedAt: "desc" },
    });
    const latestStatus = String(latest?.status || "").toLowerCase();
    if (latest && latestStatus === "pending") {
      res.status(409).json({ error: "Verification request already submitted", code: "VERIFICATION_ALREADY_SUBMITTED" });
      return;
    }

    const companyName = String(req.body?.companyName || "").trim().slice(0, 160);
    const role = String(req.body?.role || "").trim().slice(0, 160);
    const sector = normalizeDirectorySector(req.body?.sector);
    const proofType = String(req.body?.proofType || "").trim().toLowerCase();
    const proofValue = String(req.body?.proofValue || "").trim().slice(0, 320);
    const comment = String(req.body?.comment || "").trim().slice(0, 1000);
    if (!companyName || !role || !["email", "linkedin", "website"].includes(proofType) || !proofValue) {
      res.status(400).json({ error: "Invalid request payload" });
      return;
    }

    const primarySlug = await prisma.slug.findFirst({
      where: {
        ownerId: user.id,
        status: { in: ["active", "private", "paused", "approved"] },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { fullSlug: true },
    });
    const verificationSlug = primarySlug?.fullSlug || "PROFILE";

    const request = await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        slug: verificationSlug,
        companyName,
        role,
        sector,
        proofType,
        proofValue,
        comment: comment || null,
      },
    });

    void sendVerificationRequestToAdmin({
      telegramId: user.telegramChatId || "",
      slug: verificationSlug,
      companyName,
      role,
      sector,
      proofType,
      proofValue,
      comment,
    }).catch((error) => {
      console.error("[express-app] failed to send verification request to telegram", error);
    });

    res.status(201).json({ ok: true, request });
  }),
);

router.post(
  "/verification-request/correction",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    const correction = String(req.body?.comment || "").trim().slice(0, 1000);
    if (correction.length < 5) {
      res.status(400).json({ error: "Correction text is too short" });
      return;
    }

    const pendingRequest = await prisma.verificationRequest.findFirst({
      where: {
        userId: user.id,
        status: "pending",
      },
      orderBy: { requestedAt: "desc" },
    });
    if (!pendingRequest) {
      res.status(409).json({ error: "No pending request to correct", code: "VERIFICATION_CORRECTION_NOT_ALLOWED" });
      return;
    }

    const correctionLabel = `[Исправление ${new Date().toISOString()}] ${correction}`;
    const nextComment = pendingRequest.comment
      ? `${pendingRequest.comment}\n\n${correctionLabel}`
      : correctionLabel;

    const updated = await prisma.verificationRequest.update({
      where: { id: pendingRequest.id },
      data: {
        comment: nextComment,
      },
    });

    res.json({ ok: true, request: updated });
  }),
);

router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const [rows, supportTelegramRaw, braceletPrice] = await Promise.all([
      prisma.slugRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      getSetting("contact_support_telegram", `@${FALLBACK_SUPPORT_TELEGRAM}`),
      getBraceletPrice(),
    ]);
    const supportTelegram = normalizeTelegramUsername(supportTelegramRaw);
    res.json({
      items: rows.map((item) =>
        mapProfileRequest(item, {
          supportTelegram,
          fullName: normalizeDisplayName(user.displayName, user.firstName),
          email: user.email || "",
          braceletPrice,
        }),
      ),
    });
  }),
);

router.patch(
  "/welcome-dismiss",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeDismissed: true },
    });

    res.json({ ok: true, welcomeDismissed: true });
  }),
);

router.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const displayName = normalizeDisplayName(req.body.displayName, user.firstName);
    const notificationsEnabled = Boolean(req.body.notificationsEnabled);
    const showInDirectory =
      typeof req.body.showInDirectory === "boolean" ? req.body.showInDirectory : Boolean(user.showInDirectory);
    const telegramUsername = String(req.body.telegramUsername || "")
      .replace(/^@+/, "")
      .trim()
      .slice(0, 120);
    const city = resolveUzbekistanCity(req.body.city);

    if (!city) {
      res.status(400).json({ error: "Город обязателен" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        city,
        telegramUsername: telegramUsername || null,
        notificationsEnabled,
        showInDirectory,
      },
    });

    res.json({
      ok: true,
      user: {
        displayName: updated.displayName,
        city: updated.city || "",
        notificationsEnabled: updated.notificationsEnabled,
        showInDirectory: updated.showInDirectory,
      },
    });
  }),
);

router.post(
  "/telegram/link/start",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const botUsername = String(env.TELEGRAM_BOT_USERNAME || "")
      .replace(/^@+/, "")
      .trim();
    if (!botUsername) {
      res.status(400).json({
        error: "Telegram bot is not configured",
        code: "TELEGRAM_BOT_NOT_CONFIGURED",
      });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { notificationsEnabled: true },
    });

    res.json({
      ok: true,
      url: `https://t.me/${encodeURIComponent(botUsername)}?start=notify`,
      notificationsEnabled: true,
    });
  }),
);

router.post(
  "/telegram/link/unlink",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: null,
        notificationsEnabled: false,
      },
    });
    res.json({ ok: true, notificationsEnabled: false });
  }),
);

router.post(
  "/deactivate",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const deadline = new Date(Date.now() + ACCOUNT_REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          status: "deactivated",
          deactivatedAt: new Date(),
          reactivationDeadlineAt: deadline,
          reactivationOtpCode: null,
          reactivationOtpExpiresAt: null,
          reactivationOtpSentAt: null,
          deletionReminder7SentAt: null,
          deletionReminder1SentAt: null,
          deletedAt: null,
        },
      }),
      prisma.slug.updateMany({
        where: { ownerId: user.id },
        data: { status: "paused" },
      }),
    ]);
    await safeRecalculateScore(user.id);
    await logoutUserSession(req);

    if (user.email) {
      void sendAccountDeactivatedEmail({
        email: user.email,
        firstName: user.firstName,
        restoreUntil: deadline,
      }).catch((error) => {
        console.error("[express-app] failed to send deactivation email", error);
      });
    }

    res.json({ ok: true, restoreUntil: deadline.toISOString(), reactivationWindowDays: ACCOUNT_REACTIVATION_WINDOW_DAYS });
  }),
);

module.exports = {
  profileApiRouter: router,
};



