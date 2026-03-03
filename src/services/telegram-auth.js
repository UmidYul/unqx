const { createHash, createHmac, timingSafeEqual } = require("node:crypto");

const { env } = require("../config/env");

class TelegramAuthError extends Error {
  constructor(message, code = "TELEGRAM_AUTH_FAILED") {
    super(message);
    this.name = "TelegramAuthError";
    this.code = code;
  }
}

function toStringValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function normalizeTelegramPayload(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    id: toStringValue(source.id),
    first_name: toStringValue(source.first_name),
    last_name: toStringValue(source.last_name),
    username: toStringValue(source.username),
    photo_url: toStringValue(source.photo_url),
    auth_date: toStringValue(source.auth_date),
    hash: toStringValue(source.hash),
  };
}

function createDataCheckString(payload) {
  const entries = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && typeof value === "string" && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([key, value]) => `${key}=${value}`).join("\n");
}

function verifyTelegramLoginPayload(rawPayload) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new TelegramAuthError("Telegram bot token is not configured", "TELEGRAM_NOT_CONFIGURED");
  }

  const payload = normalizeTelegramPayload(rawPayload);

  if (!payload.id || !payload.first_name || !payload.auth_date || !payload.hash) {
    throw new TelegramAuthError("Telegram payload is incomplete", "TELEGRAM_PAYLOAD_INVALID");
  }

  const authDateSec = Number.parseInt(payload.auth_date, 10);
  if (!Number.isFinite(authDateSec)) {
    throw new TelegramAuthError("Telegram auth_date is invalid", "TELEGRAM_PAYLOAD_INVALID");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const maxAge = Number.isFinite(env.TELEGRAM_AUTH_MAX_AGE_SECONDS)
    ? Number(env.TELEGRAM_AUTH_MAX_AGE_SECONDS)
    : 86_400;
  if (Math.abs(nowSec - authDateSec) > maxAge) {
    throw new TelegramAuthError("Telegram payload is expired", "TELEGRAM_AUTH_EXPIRED");
  }

  const dataCheckString = createDataCheckString(payload);
  const secretKey = createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expected = Buffer.from(calculatedHash, "hex");
  const received = Buffer.from(payload.hash, "hex");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new TelegramAuthError("Telegram hash validation failed", "TELEGRAM_HASH_INVALID");
  }

  return {
    telegramId: payload.id,
    firstName: payload.first_name,
    lastName: payload.last_name || null,
    username: payload.username || null,
    photoUrl: payload.photo_url || null,
    authDate: new Date(authDateSec * 1000),
  };
}

module.exports = {
  TelegramAuthError,
  verifyTelegramLoginPayload,
};
