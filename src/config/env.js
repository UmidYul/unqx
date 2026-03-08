const path = require("node:path");
const dotenv = require("dotenv");
const { z } = require("zod");
const bcrypt = require("bcryptjs");

function parseBoolean(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseTrustProxy(value) {
  if (typeof value !== "string" || !value.trim()) {
    return 1;
  }

  const booleanValue = parseBoolean(value);
  if (typeof booleanValue === "boolean") {
    // express-rate-limit rejects permissive trust proxy=true.
    // Normalize "true" to first-hop proxy trust (1), keep explicit false.
    return booleanValue ? 1 : false;
  }

  const numericValue = Number(value);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return value;
}

function parseSessionCookieSecure(value, nodeEnv) {
  if (typeof value !== "string" || !value.trim()) {
    return nodeEnv === "production" ? "auto" : false;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "auto") {
    return "auto";
  }

  const booleanValue = parseBoolean(value);
  if (typeof booleanValue === "boolean") {
    return booleanValue;
  }

  return nodeEnv === "production" ? "auto" : false;
}

function decodeB64(value) {
  if (!value) {
    return undefined;
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function normalizeBcryptHash(value) {
  return value.trim().replace(/^['\"]|['\"]$/g, "").replace(/\\\$/g, "$");
}

function normalizeTelegramBotUsername(value) {
  if (typeof value !== "string") {
    return value;
  }

  const raw = value.trim();
  if (!raw) {
    return raw;
  }

  const withoutUrl = raw.replace(/^https?:\/\/t\.me\//i, "");
  return withoutUrl.replace(/^@+/, "").trim();
}

const rootDirDefault = path.resolve(__dirname, "../../..");
const expressAppDirDefault = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(expressAppDirDefault, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(rootDirDefault, ".env"), override: false, quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:55432/unqplus"),
  DIRECT_URL: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(8).optional(),
  SESSION_SECRET: z.string().min(8).optional(),
  ADMIN_LOGIN: z.string().min(1).default("admin"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z
    .string()
    .transform(normalizeBcryptHash)
    .refine((value) => {
      try {
        bcrypt.getRounds(value);
        return true;
      } catch {
        return false;
      }
    }, "ADMIN_PASSWORD_HASH must be a bcrypt hash"),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  EXPO_PUSH_ACCESS_TOKEN: z.string().min(1).optional(),
  EXPO_PUSH_ENABLED: z.string().optional(),
  FCM_PUSH_ENABLED: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_B64: z.string().min(1).optional(),
  SLUG_TOTAL_LIMIT: z.coerce.number().int().positive().default(17_576),
  TIMEZONE: z.string().min(1).default("Asia/Tashkent"),
  ROOT_DIR: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  SESSION_COOKIE_SECURE: z.string().optional(),
  SESSION_MAX_AGE_MINUTES: z.coerce.number().int().positive().max(60 * 24 * 30).default(120),
  SESSION_ROLLING: z.string().optional(),
  DISABLE_HTTPS_ENFORCEMENT: z.string().optional(),
  UNVERIFIED_ACCOUNT_CLEANUP_ENABLED: z.string().optional(),
  UNVERIFIED_ACCOUNT_TTL_HOURS: z.coerce.number().int().positive().max(24 * 365).default(72),
  ACCOUNT_REACTIVATION_WINDOW_DAYS: z.coerce.number().int().positive().max(365).default(30),
  ACCOUNT_REACTIVATION_OTP_TTL_MINUTES: z.coerce.number().int().positive().max(60 * 24).default(10),
  ACCOUNT_REACTIVATION_REMINDER_DAYS_BEFORE: z.coerce.number().int().positive().max(180).default(7),
  ACCOUNT_REACTIVATION_LAST_REMINDER_HOURS: z.coerce.number().int().positive().max(24 * 30).default(24),
});

const parsed = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_URL: process.env.APP_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD_HASH: decodeB64(process.env.ADMIN_PASSWORD_HASH_B64) ?? process.env.ADMIN_PASSWORD_HASH,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_USERNAME: normalizeTelegramBotUsername(process.env.TELEGRAM_BOT_USERNAME),
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EXPO_PUSH_ACCESS_TOKEN: process.env.EXPO_PUSH_ACCESS_TOKEN,
  EXPO_PUSH_ENABLED: process.env.EXPO_PUSH_ENABLED,
  FCM_PUSH_ENABLED: process.env.FCM_PUSH_ENABLED,
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  FIREBASE_SERVICE_ACCOUNT_B64: process.env.FIREBASE_SERVICE_ACCOUNT_B64,
  SLUG_TOTAL_LIMIT: process.env.SLUG_TOTAL_LIMIT,
  TIMEZONE: process.env.TIMEZONE,
  ROOT_DIR: process.env.ROOT_DIR,
  TRUST_PROXY: process.env.TRUST_PROXY,
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
  SESSION_MAX_AGE_MINUTES: process.env.SESSION_MAX_AGE_MINUTES,
  SESSION_ROLLING: process.env.SESSION_ROLLING,
  DISABLE_HTTPS_ENFORCEMENT: process.env.DISABLE_HTTPS_ENFORCEMENT,
  UNVERIFIED_ACCOUNT_CLEANUP_ENABLED: process.env.UNVERIFIED_ACCOUNT_CLEANUP_ENABLED,
  UNVERIFIED_ACCOUNT_TTL_HOURS: process.env.UNVERIFIED_ACCOUNT_TTL_HOURS,
  ACCOUNT_REACTIVATION_WINDOW_DAYS: process.env.ACCOUNT_REACTIVATION_WINDOW_DAYS,
  ACCOUNT_REACTIVATION_OTP_TTL_MINUTES: process.env.ACCOUNT_REACTIVATION_OTP_TTL_MINUTES,
  ACCOUNT_REACTIVATION_REMINDER_DAYS_BEFORE: process.env.ACCOUNT_REACTIVATION_REMINDER_DAYS_BEFORE,
  ACCOUNT_REACTIVATION_LAST_REMINDER_HOURS: process.env.ACCOUNT_REACTIVATION_LAST_REMINDER_HOURS,
});

const ROOT_DIR = parsed.ROOT_DIR ? path.resolve(parsed.ROOT_DIR) : rootDirDefault;
const EXPRESS_APP_DIR = expressAppDirDefault;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const APP_URL = (parsed.APP_URL ?? parsed.NEXT_PUBLIC_APP_URL ?? parsed.NEXTAUTH_URL ?? `http://127.0.0.1:${parsed.PORT}`).replace(/\/$/, "");
const SESSION_SECRET = parsed.SESSION_SECRET ?? parsed.NEXTAUTH_SECRET ?? "change-me-dev-secret";
const TRUST_PROXY = parseTrustProxy(parsed.TRUST_PROXY);
const SESSION_COOKIE_SECURE = parseSessionCookieSecure(parsed.SESSION_COOKIE_SECURE, parsed.NODE_ENV);
const SESSION_ROLLING = parseBoolean(parsed.SESSION_ROLLING) ?? true;
const DISABLE_HTTPS_ENFORCEMENT = parseBoolean(parsed.DISABLE_HTTPS_ENFORCEMENT) ?? false;
const SMTP_SECURE = parseBoolean(parsed.SMTP_SECURE) ?? (Number(parsed.SMTP_PORT || 0) === 465);
const UNVERIFIED_ACCOUNT_CLEANUP_ENABLED = parseBoolean(parsed.UNVERIFIED_ACCOUNT_CLEANUP_ENABLED) ?? true;

const env = {
  ...parsed,
  ROOT_DIR,
  EXPRESS_APP_DIR,
  PUBLIC_DIR,
  APP_URL,
  SESSION_SECRET,
  TRUST_PROXY,
  SESSION_COOKIE_SECURE,
  SESSION_ROLLING,
  DISABLE_HTTPS_ENFORCEMENT,
  SMTP_SECURE,
  UNVERIFIED_ACCOUNT_CLEANUP_ENABLED,
};

module.exports = { env };
