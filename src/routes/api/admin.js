const express = require("express");
const multer = require("multer");
const { addDays, format, startOfDay, subDays } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");
const { Prisma } = require("@prisma/client");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { requireAdminApi } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/async");
const { adminApiRateLimit } = require("../../middleware/rate-limit");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { parsePositiveInt } = require("../../utils/http");
const { generateNextSlug } = require("../../services/cards");
const { getGlobalStats } = require("../../services/stats");
const { calculateSlugPrice, getSlugPricingConfig } = require("../../services/slug-pricing");
const { sendTelegramMessage, sendPaymentAlertsToAdmin } = require("../../services/telegram");
const { recalculateAndRefreshPercentiles } = require("../../services/unq-score");
const { sendExpoPushToUser, sendExpoPushToUsers } = require("../../services/push");
const { applyOrderStatusTransition } = require("../../services/order-status-transition");
const {
  getBraceletPrice,
  normalizePlan,
} = require("../../services/pricing-settings");
const { buildOrderPaymentDraft } = require("../../services/payment-flow");
const {
  PROFILE_THEMES,
  getEffectivePlan,
  getSlugLimit,
  getTagLimit,
  getButtonLimit,
  canCreateCard,
  normalizeThemeByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
} = require("../../services/profile");
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

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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
const PUSH_PRIORITY_SET = new Set(["default", "normal", "high"]);
const PUSH_SOUND_SET = new Set(["default", "none"]);
const BROADCAST_CHUNK_USERS = 400;
const BROADCAST_JOB_LIMIT = 50;
const BROADCAST_JOB_TTL_MS = 1000 * 60 * 30;
const broadcastJobs = new Map();
const USER_COLUMN_MAP = {
  id: "id",
  firstName: "first_name",
  displayName: "display_name",
  city: "city",
  username: "username",
  isVerified: "is_verified",
  verifiedCompany: "verified_company",
  plan: "plan",
  planPurchasedAt: "plan_purchased_at",
  planUpgradedAt: "plan_upgraded_at",
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

async function getUserColumns() {
  const now = Date.now();
  if (cachedUserColumns && now - cachedUserColumnsAt < 1000 * 60 * 5) {
    return cachedUserColumns;
  }
  try {
    const rows = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
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
    theme: typeof row.theme === "string" && PROFILE_THEMES.has(row.theme) ? row.theme : "default_dark",
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
  return ["all", "none", "basic", "premium"].includes(plan) ? plan : "all";
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
      WHERE (${plan} = 'all' OR coalesce(u.plan, 'none') = ${plan})
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
  return value === "premium" ? "premium" : "basic";
}

function normalizeUserPlan(value) {
  if (value === "premium") return "premium";
  if (value === "basic") return "basic";
  return "none";
}

function normalizeShortSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function isShortSlug(value) {
  return /^[A-Z]{3}[0-9]{3}$/.test(String(value || ""));
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

function braceletStatusEventTitle(status) {
  switch (status) {
    case "ORDERED":
      return "Браслет заказан";
    case "SHIPPED":
      return "Браслет отправлен";
    case "DELIVERED":
      return "Браслет доставлен";
    default:
      return "Обновление браслета";
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
router.use(requireAdminApi);
router.use(requireSameOrigin);
router.use(requireCsrfToken);

router.get(
  "/navigation-summary",
  asyncHandler(async (_req, res) => {
    const [newOrdersCount, orderedBraceletsCount, orderEvents, braceletEvents] = await Promise.all([
      prisma.slugRequest.count({
        where: { status: "new" },
      }),
      prisma.braceletOrder.count({
        where: { deliveryStatus: "ORDERED" },
      }),
      prisma.slugRequest.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.braceletOrder.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          deliveryStatus: true,
          updatedAt: true,
        },
      }),
    ]);

    const mergedEvents = [
      ...orderEvents.map((item) => ({
        id: `order:${item.id}`,
        title: orderStatusEventTitle(item.status),
        slug: item.slug,
        at: item.updatedAt,
        href: "/admin/dashboard?tab=orders",
      })),
      ...braceletEvents.map((item) => ({
        id: `bracelet:${item.id}`,
        title: braceletStatusEventTitle(item.deliveryStatus),
        slug: item.slug,
        at: item.updatedAt,
        href: "/admin/dashboard?tab=bracelets",
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);

    res.json({
      badges: {
        orders: newOrdersCount,
        bracelets: orderedBraceletsCount,
      },
      events: mergedEvents,
    });
  }),
);

function sendLegacyCardsDeprecated(res) {
  res.status(410).json({
    error: "Legacy cards API is deprecated",
    code: "LEGACY_CARDS_DEPRECATED",
  });
}

router.get(
  "/cards",
  asyncHandler(async (_req, res) => {
    res.json({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
  }),
);

router.post(
  "/cards",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.get(
  "/cards/:id",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.patch(
  "/cards/:id",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.delete(
  "/cards/:id",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.patch(
  "/cards/:id/toggle-active",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.patch(
  "/cards/:id/tariff",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.post(
  "/cards/:id/avatar",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.delete(
  "/cards/:id/avatar",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

function buildOrdersWhere(query) {
  const where = {};
  if (query.status && query.status !== "all") {
    where.status = toOrderStatus(query.status);
  }
  if (query.tariff && query.tariff !== "all") {
    where.requestedPlan = normalizeTariff(query.tariff);
  }
  if (query.bracelet === "yes") {
    where.bracelet = true;
  }
  if (query.bracelet === "no") {
    where.bracelet = false;
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
  const allowedTypes = new Set(["slug", "basic_plan", "premium_plan", "upgrade_to_premium", "bracelet"]);

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
    where.OR = [
      { userId: { contains: term, mode: "insensitive" } },
      { user: { username: { contains: term, mode: "insensitive" } } },
      { user: { firstName: { contains: term, mode: "insensitive" } } },
      { user: { displayName: { contains: term, mode: "insensitive" } } },
    ];
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
    const braceletPriceValue = await getBraceletPrice();
    const where = buildOrdersWhere(req.query);
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
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
        const totalAmount = Number(row.slugPrice || 0) + Number(row.planPrice || 0) + (row.bracelet ? braceletPriceValue : 0);
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
        amount: Number(row.slugPrice || 0) + Number(row.planPrice || 0) + (row.bracelet ? braceletPriceValue : 0),
        tariff: row.requestedPlan,
        theme: null,
        bracelet: row.bracelet,
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
    const planFilter = ["none", "basic", "premium"].includes(rawPlanFilter) ? rawPlanFilter : "all";

    const where = {};
    if (planFilter !== "all" && hasUserColumn(userColumns, "plan")) {
      where.plan = planFilter;
    }
    if (q) {
      const or = [];
      if (hasUserColumn(userColumns, "id")) {
        or.push({ id: { contains: q, mode: "insensitive" } });
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
      if (hasUserColumn(userColumns, "displayName")) {
        or.push({ displayName: { contains: q, mode: "insensitive" } });
      }
      if (or.length) {
        where.OR = or;
      }
    }

    let total;
    let users;
    try {
      const select = { id: true };
      if (hasUserColumn(userColumns, "firstName")) select.firstName = true;
      if (hasUserColumn(userColumns, "displayName")) select.displayName = true;
      if (hasUserColumn(userColumns, "city")) select.city = true;
      if (hasUserColumn(userColumns, "username")) select.username = true;
      if (hasUserColumn(userColumns, "isVerified")) select.isVerified = true;
      if (hasUserColumn(userColumns, "verifiedCompany")) select.verifiedCompany = true;
      if (hasUserColumn(userColumns, "plan")) select.plan = true;
      if (hasUserColumn(userColumns, "planPurchasedAt")) select.planPurchasedAt = true;
      if (hasUserColumn(userColumns, "planUpgradedAt")) select.planUpgradedAt = true;
      if (hasUserColumn(userColumns, "status")) select.status = true;
      if (hasUserColumn(userColumns, "createdAt")) select.createdAt = true;

      [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: sort === "created_desc" ? { createdAt: "desc" } : { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select,
        }),
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
    const [slugs, cards, braceletRequests, unqScores] = await Promise.all([
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
        select: { ownerId: true, id: true, theme: true },
      }),
      prisma.slugRequest.findMany({
        where: {
          userId: { in: userIds },
          bracelet: true,
          status: "approved",
        },
        select: { userId: true, slug: true },
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
    const braceletByUser = new Map();
    for (const row of braceletRequests) {
      if (!braceletByUser.has(row.userId)) {
        braceletByUser.set(row.userId, new Set());
      }
      braceletByUser.get(row.userId).add(row.slug);
    }
    const scoreByUser = new Map(unqScores.map((row) => [row.userId, row]));

    const items = users.map((user) => ({
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
            bracelet: scoreByUser.get(user.id).scoreBracelet,
            plan: scoreByUser.get(user.id).scorePlan,
          },
        }
        : null,
      telegramId: user.id,
      name: user.displayName || user.firstName,
      city: user.city || "",
      username: user.username || null,
      isVerified: Boolean(user.isVerified),
      verifiedCompany: user.verifiedCompany || "",
      plan: user.plan,
      planPurchasedAt: user.planPurchasedAt,
      planUpgradedAt: user.planUpgradedAt,
      slugs: (slugsByUser.get(user.id) || []).map((slug) => ({
        ...slug,
        hasBracelet: Boolean(braceletByUser.get(user.id)?.has(slug.fullSlug)),
      })),
      activeSlugCount: (slugsByUser.get(user.id) || []).filter((slug) =>
        ["approved", "active", "paused", "private"].includes(slug.status),
      ).length,
      hasCard: cardsSet.has(user.id),
      theme: cardThemeByUser.get(user.id) || "default_dark",
      status: user.status,
      createdAt: user.createdAt,
    }));

    if (sort === "score_desc") {
      items.sort((a, b) => (Number(b.unqScore?.score || 0) - Number(a.unqScore?.score || 0)));
    }

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
  "/users/:userId/card",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        displayName: true,
        username: true,
        email: true,
        plan: true,
        status: true,
        isVerified: true,
        verifiedCompany: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

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

    const effective = getEffectivePlan(user);
    res.json({
      user,
      card: parseProfileCardRow(card),
      limits: {
        tags: getTagLimit(effective.plan),
        buttons: getButtonLimit(effective.plan),
      },
      themes: Array.from(PROFILE_THEMES),
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

    const nextSlug = normalizeShortSlug(req.body?.slug);
    if (!isShortSlug(nextSlug)) {
      res.status(400).json({ error: "Slug must be in AAA000 format" });
      return;
    }

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
                letters: nextSlug.slice(0, 3),
                digits: nextSlug.slice(3),
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
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (error?.code === "SLUG_ALREADY_OWNED") {
        res.status(409).json({ error: "User already owns this slug" });
        return;
      }
      if (error?.code === "SLUG_TAKEN") {
        res.status(409).json({ error: "Slug is already assigned to another user" });
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

    const currentSlug = normalizeShortSlug(req.params.slug);
    const nextSlug = normalizeShortSlug(req.body?.slug);
    if (!isShortSlug(currentSlug) || !isShortSlug(nextSlug)) {
      res.status(400).json({ error: "Slug must be in AAA000 format" });
      return;
    }
    if (currentSlug === nextSlug) {
      res.status(400).json({ error: "New slug must differ from current slug" });
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
                letters: nextSlug.slice(0, 3),
                digits: nextSlug.slice(3),
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

        if (tx.analyticsView && typeof tx.analyticsView.updateMany === "function") {
          await tx.analyticsView.updateMany({
            where: { slug: currentSlug },
            data: { slug: replacement.fullSlug },
          });
        }
        if (tx.analyticsClick && typeof tx.analyticsClick.updateMany === "function") {
          await tx.analyticsClick.updateMany({
            where: { slug: currentSlug },
            data: { slug: replacement.fullSlug },
          });
        }
        if (typeof tx.$executeRaw === "function") {
          try {
            await tx.$executeRaw`UPDATE slug_views SET slug = ${replacement.fullSlug} WHERE slug = ${currentSlug}`;
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "slug_views" does not exist')) {
              throw rawError;
            }
          }
          try {
            await tx.$executeRaw`UPDATE slug_clicks SET slug = ${replacement.fullSlug} WHERE slug = ${currentSlug}`;
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "slug_clicks" does not exist')) {
              throw rawError;
            }
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

      await safeRecalculateScore(userId);
      res.json({
        ok: true,
        previousSlug: currentSlug,
        slug: result,
      });
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (error?.code === "CURRENT_SLUG_NOT_OWNED") {
        res.status(404).json({ error: "Current slug is not owned by this user" });
        return;
      }
      if (error?.code === "TARGET_SLUG_TAKEN") {
        res.status(409).json({ error: "New slug is already assigned to another user" });
        return;
      }
      if (error?.code === "TARGET_SLUG_ALREADY_OWNED") {
        res.status(409).json({ error: "User already owns target slug" });
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

    const targetSlug = normalizeShortSlug(req.params.slug);
    if (!isShortSlug(targetSlug)) {
      res.status(400).json({ error: "Slug must be in AAA000 format" });
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
        if (typeof tx.$executeRaw === "function") {
          try {
            rawCleanup.slugViewsLegacy = Number(
              await tx.$executeRaw`DELETE FROM slug_views WHERE slug = ${targetSlug}`,
            );
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "slug_views" does not exist')) {
              throw rawError;
            }
          }
          try {
            rawCleanup.slugClicksLegacy = Number(
              await tx.$executeRaw`DELETE FROM slug_clicks WHERE slug = ${targetSlug}`,
            );
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "slug_clicks" does not exist')) {
              throw rawError;
            }
          }
          try {
            rawCleanup.viewsLogLegacy = Number(
              await tx.$executeRaw`DELETE FROM views_log WHERE slug = ${targetSlug}`,
            );
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "views_log" does not exist')) {
              throw rawError;
            }
          }
          try {
            rawCleanup.directoryExclusions = Number(
              await tx.$executeRaw`DELETE FROM directory_exclusions WHERE slug = ${targetSlug}`,
            );
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "directory_exclusions" does not exist')) {
              throw rawError;
            }
          }
          try {
            rawCleanup.leaderboardExclusions = Number(
              await tx.$executeRaw`DELETE FROM leaderboard_exclusions WHERE full_slug = ${targetSlug}`,
            );
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "leaderboard_exclusions" does not exist')) {
              throw rawError;
            }
          }
          try {
            rawCleanup.leaderboardSuspicious = Number(
              await tx.$executeRaw`DELETE FROM leaderboard_suspicious_log WHERE full_slug = ${targetSlug}`,
            );
          } catch (rawError) {
            const message = buildRawErrorText(rawError).toLowerCase();
            if (!message.includes('relation "leaderboard_suspicious_log" does not exist')) {
              throw rawError;
            }
          }
        }

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

      await safeRecalculateScore(userId);
      res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      if (error?.code === "USER_NOT_FOUND") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (error?.code === "TARGET_SLUG_NOT_OWNED") {
        res.status(404).json({ error: "Target slug is not owned by this user" });
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        status: true,
      },
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
    const customColor = effective.plan === "premium" ? normalizeColor(body.customColor) : null;
    const showBranding = effective.plan === "premium" ? Boolean(body.showBranding) : true;

    if (effective.plan !== "premium") {
      const requestedTheme = String(body.theme || "").trim();
      if (requestedTheme && requestedTheme !== "default_dark") {
        res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
        return;
      }
    }

    let saved;
    try {
      saved = await prisma.$transaction(async (tx) => {
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
          theme,
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
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.status(503).json({ error: "Cards storage unavailable", code: "CARDS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }

    await safeRecalculateScore(user.id);
    res.json({ ok: true, card: parseProfileCardRow(saved) });
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, status: true },
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, status: true },
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

router.patch(
  "/users/:userId/plan",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    const plan = normalizeUserPlan(req.body.plan);
    const reason = String(req.body.reason || "").trim();
    const force = Boolean(req.body.force);
    const now = new Date();
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

      if (plan === "basic" && owned.length > 1 && !force) {
        return {
          requiresConfirmation: true,
          activeSlugCount: owned.length,
        };
      }

      const currentPlan = normalizePlan(user.plan);
      const userPatch = { plan };
      if (currentPlan === "none" && (plan === "basic" || plan === "premium")) {
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
      }
      if (currentPlan === "basic" && plan === "premium") {
        userPatch.planUpgradedAt = now;
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
      }
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: userPatch,
        select: { id: true, plan: true, planPurchasedAt: true, planUpgradedAt: true },
      });

      if (plan === "basic" && owned.length > 1) {
        const primary = owned.find((row) => row.isPrimary) || owned[0];
        const toPause = owned.filter((row) => row.fullSlug !== primary.fullSlug);
        if (toPause.length > 0) {
          await tx.slug.updateMany({
            where: {
              fullSlug: { in: toPause.map((row) => row.fullSlug) },
            },
            data: {
              status: "paused",
            },
          });
        }
      }
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
    if (result.requiresConfirmation) {
      res.status(409).json({
        error: "PLAN_DOWNGRADE_CONFIRMATION_REQUIRED",
        code: "PLAN_DOWNGRADE_CONFIRMATION_REQUIRED",
        activeSlugCount: result.activeSlugCount,
      });
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
    });
  }),
);

router.patch(
  "/users/:userId/unverify",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
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
    const braceletPriceValue = await getBraceletPrice();
    const where = buildOrdersWhere(req.query);
    const rows = await prisma.slugRequest.findMany({
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
      "Дата,Имя,Slug,Цена slug,Цена тарифа,Браслет,Сумма,Контакт,Статус",
      ...rows.map((row) =>
        [
          `"${new Date(row.createdAt).toLocaleString("ru-RU")}"`,
          `"${String(row.user?.displayName || row.user?.firstName || "UNQX User").replace(/"/g, '""')}"`,
          `"${row.slug}"`,
          row.slugPrice,
          Number(row.planPrice || 0),
          `"${row.bracelet ? "Да" : "Нет"}"`,
          Number(row.slugPrice || 0) + Number(row.planPrice || 0) + (row.bracelet ? braceletPriceValue : 0),
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
        /^[A-Z]{3}[0-9]{3}$/.test(row.fullSlug) &&
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

router.patch(
  "/slugs/:slug/state",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
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
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
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
    const MAX_DB_INT = 2_147_483_647;
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const parsed = /^([A-Z]{3})([0-9]{3})$/.exec(slug);
    if (!parsed) {
      res.status(400).json({ error: "Slug must be in AAA000 format" });
      return;
    }
    const value = req.body.priceOverride;
    let priceOverride = null;
    if (!(value === null || value === "")) {
      const numeric = Number(value);
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
          status: true,
          price: true,
        },
      });
      const hasPurchasedOwner = Boolean(
        existingSlug && ["approved", "active", "paused", "private"].includes(existingSlug.status),
      );

      const updatedSlug = existingSlug
        ? hasPurchasedOwner
          ? existingSlug
          : await tx.slug.update({
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
        !hasPurchasedOwner && typeof resolvedPrice === "number"
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
          appliedToPurchasedSlug: hasPurchasedOwner,
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
  "/bracelet-orders",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const where = {};
    if (req.query.status === "ORDERED" || req.query.status === "SHIPPED" || req.query.status === "DELIVERED") {
      where.deliveryStatus = req.query.status;
    }
    const [total, rows] = await Promise.all([
      prisma.braceletOrder.count({ where }),
      prisma.braceletOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          name: true,
          slug: true,
          deliveryStatus: true,
        },
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

router.patch(
  "/bracelet-orders/:id/status",
  asyncHandler(async (req, res) => {
    const updated = await prisma.braceletOrder.update({
      where: { id: req.params.id },
      data: { deliveryStatus: toDeliveryStatus(req.body.deliveryStatus) },
      select: { id: true, deliveryStatus: true, slug: true },
    });
    const owner = await prisma.slug.findUnique({
      where: { fullSlug: updated.slug },
      select: { ownerId: true },
    });
    if (owner?.ownerId) {
      try {
        await recalculateAndRefreshPercentiles(owner.ownerId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after bracelet update", error);
      }
    }
    res.json(updated);
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
  asyncHandler(async (_req, res) => {
    const timezone = env.TIMEZONE;
    const now = new Date();
    const nowInZone = toZonedTime(now, timezone);
    const todayStart = fromZonedTime(startOfDay(nowInZone), timezone);
    const monthStart = subDays(todayStart, 29);
    const canUsePurchases = Boolean(prisma.purchase);

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
    ] = await Promise.all([
      canUsePurchases
        ? prisma.purchase.aggregate({
          where: { purchasedAt: { gte: todayStart } },
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.aggregate({
          where: { purchasedAt: { gte: monthStart } },
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
          where: { purchasedAt: { gte: monthStart } },
          select: { purchasedAt: true, amount: true, type: true },
        })
        : Promise.resolve([]),
      canUsePurchases
        ? prisma.purchase.findMany({
          select: { amount: true, type: true },
        })
        : Promise.resolve([]),
      prisma.slugCheckerLog.findMany({
        where: { source: "hero", checkedAt: { gte: monthStart } },
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
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.slugRequest.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { slug: true, createdAt: true },
      }),
    ]);

    const revenueToday = Number(purchasesTodayAgg?._sum?.amount || 0);
    const revenue30Days = Number(purchases30Agg?._sum?.amount || 0);
    const revenueTotal = Number(purchasesAllAgg?._sum?.amount || 0);

    const breakdown = {
      slug: 0,
      basicPlan: 0,
      premiumPlan: 0,
      bracelet: 0,
    };
    for (const item of purchasesAll) {
      const amount = Number(item.amount || 0);
      if (item.type === "slug") breakdown.slug += amount;
      if (item.type === "basic_plan") breakdown.basicPlan += amount;
      if (item.type === "premium_plan" || item.type === "upgrade_to_premium") breakdown.premiumPlan += amount;
      if (item.type === "bracelet") breakdown.bracelet += amount;
    }

    const { keys } = computeDateRangeKey(timezone, 30);
    const revenueBuckets = new Map(keys.map((key) => [key, 0]));
    for (const row of purchases30d) {
      const key = format(toZonedTime(row.purchasedAt, timezone), "yyyy-MM-dd");
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
      kpis: {
        newOrdersToday,
        revenueToday,
        revenue30Days,
        revenueTotal,
        averageUnqScore,
        breakdown,
      },
      revenueDaily,
      topUnboughtPatterns,
      scoreDistribution,
    });
  }),
);

router.get(
  "/platform-analytics",
  asyncHandler(async (req, res) => {
    const period = [7, 30, 90].includes(Number(req.query.period)) ? Number(req.query.period) : 7;
    const from = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const onlineFrom = new Date(Date.now() - 5 * 60 * 1000);

    const [views, clicks, activeCards, todayCreated, todayActivated, onlineRows, topSlugRows] = await Promise.all([
      prisma.analyticsView ? prisma.analyticsView.findMany({ where: { visitedAt: { gte: from } } }) : Promise.resolve([]),
      prisma.analyticsClick ? prisma.analyticsClick.findMany({ where: { clickedAt: { gte: from } } }) : Promise.resolve([]),
      prisma.slug.count({ where: { status: "active" } }),
      prisma.slug.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.slug.count({ where: { activatedAt: { gte: todayStart } } }),
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { visitedAt: { gte: onlineFrom } }, select: { sessionId: true } })
        : Promise.resolve([]),
      prisma.analyticsView
        ? prisma.analyticsView.groupBy({
          by: ["slug", "sessionId"],
          where: { visitedAt: { gte: from } },
          _count: { _all: true },
        })
        : Promise.resolve([]),
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
        onlineNow: new Set(onlineRows.map((row) => row.sessionId)).size,
      },
    });
  }),
);

router.get(
  "/verification-requests",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const status = String(req.query.status || "all").toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 20;
    const where = status === "all" ? {} : { status };

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
