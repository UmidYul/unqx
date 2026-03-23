const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

const { env } = require("../config/env");
const { resolveClientIp } = require("./request-ip");

const PRIVATE_ACCESS_COOKIE = "unqx.pacc";
const PRIVATE_ACCESS_TTL_MS = 5 * 60 * 1000;
const PRIVATE_PASSWORD_MIN_LENGTH = 4;
const PRIVATE_PASSWORD_MAX_COUNT = 10;
const PRIVATE_PASSWORD_MAX_LENGTH = 128;
const PRIVATE_PASSWORD_LABEL_MAX_LENGTH = 80;

const PASSWORD_ROUNDS = 10;

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : `${normalized}${"=".repeat(4 - padding)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payloadText) {
  return toBase64Url(
    crypto.createHmac("sha256", String(env.SESSION_SECRET || "unqx-private-access")).update(payloadText).digest(),
  );
}

function createPrivateAccessToken(payload) {
  const data = {
    slug: sanitizeSlug(payload.slug),
    ownerId: String(payload.ownerId || "").trim(),
    passwordId: payload.passwordId ? String(payload.passwordId) : null,
    iat: Number(payload.iat || Date.now()),
    exp: Number(payload.exp || Date.now() + PRIVATE_ACCESS_TTL_MS),
  };

  const serialized = JSON.stringify(data);
  const encoded = toBase64Url(serialized);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifyPrivateAccessToken(token, options = {}) {
  const input = String(token || "").trim();
  if (!input || !input.includes(".")) {
    return null;
  }

  const [encoded, signature] = input.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signPayload(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  let payload = null;
  try {
    payload = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const exp = Number(payload.exp || 0);
  if (!exp || exp <= Date.now()) {
    return null;
  }

  const slug = sanitizeSlug(payload.slug);
  const ownerId = String(payload.ownerId || "").trim();
  if (!slug || !ownerId) {
    return null;
  }

  if (options.slug && sanitizeSlug(options.slug) !== slug) {
    return null;
  }

  if (options.ownerId && String(options.ownerId) !== ownerId) {
    return null;
  }

  return {
    slug,
    ownerId,
    passwordId: payload.passwordId ? String(payload.passwordId) : null,
    exp,
    iat: Number(payload.iat || 0),
    token: input,
  };
}

function normalizePrivatePasswordLabel(value) {
  return String(value || "").trim().slice(0, PRIVATE_PASSWORD_LABEL_MAX_LENGTH);
}

function normalizePrivatePasswordValue(value) {
  return String(value || "").trim().slice(0, PRIVATE_PASSWORD_MAX_LENGTH);
}

function validatePrivatePasswordValue(value) {
  return value.length >= PRIVATE_PASSWORD_MIN_LENGTH;
}

async function hashPrivatePassword(value) {
  return bcrypt.hash(value, PASSWORD_ROUNDS);
}

async function comparePrivatePassword(plain, hash) {
  return bcrypt.compare(plain, String(hash || ""));
}

function resolveCookieSecure(req) {
  if (env.SESSION_COOKIE_SECURE === true) return true;
  if (env.SESSION_COOKIE_SECURE === false) return false;
  if (String(env.SESSION_COOKIE_SECURE).toLowerCase() === "auto") {
    const forwardedProto = String(req.get?.("x-forwarded-proto") || "").toLowerCase();
    return Boolean(req.secure) || forwardedProto.includes("https");
  }
  return false;
}

function setPrivateAccessCookie(req, res, token, expiresAt) {
  if (!res || typeof res.cookie !== "function") {
    return;
  }
  const expiresAtDate = new Date(Number(expiresAt || Date.now() + PRIVATE_ACCESS_TTL_MS));
  res.cookie(PRIVATE_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveCookieSecure(req),
    path: "/",
    expires: expiresAtDate,
  });
}

function clearPrivateAccessCookie(req, res) {
  if (!res || typeof res.clearCookie !== "function") {
    return;
  }
  res.clearCookie(PRIVATE_ACCESS_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveCookieSecure(req),
    path: "/",
  });
}

function readCookieMap(req) {
  const cookieHeader = String(req.get?.("cookie") || req.headers?.cookie || "");
  if (!cookieHeader) {
    return new Map();
  }

  const map = new Map();
  const parts = cookieHeader.split(";");
  for (const entry of parts) {
    const [rawKey, ...rawValue] = entry.split("=");
    const key = String(rawKey || "").trim();
    if (!key) continue;
    const value = rawValue.join("=").trim();
    map.set(key, value);
  }
  return map;
}

function extractPrivateAccessToken(req) {
  const headers = req.headers || {};
  const fromHeader =
    String(headers["x-card-access-token"] || "").trim() ||
    String(headers["x-private-access-token"] || "").trim();
  if (fromHeader) {
    return fromHeader;
  }

  const cookies = readCookieMap(req);
  const cookieToken = String(cookies.get(PRIVATE_ACCESS_COOKIE) || "").trim();
  if (cookieToken) {
    return cookieToken;
  }

  const queryToken = String(req.query?.accessToken || "").trim();
  if (queryToken) {
    return queryToken;
  }

  return "";
}

function parseViewerDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  const platform =
    ua.includes("android")
      ? "Android"
      : ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")
        ? "iOS"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("mac os") || ua.includes("macintosh")
            ? "macOS"
            : ua.includes("linux")
              ? "Linux"
              : "Unknown OS";

  const browser =
    ua.includes("edg/")
      ? "Edge"
      : ua.includes("chrome/") && !ua.includes("edg/")
        ? "Chrome"
        : ua.includes("safari/") && !ua.includes("chrome/")
          ? "Safari"
          : ua.includes("firefox/")
            ? "Firefox"
            : ua.includes("opr/") || ua.includes("opera")
              ? "Opera"
              : "Unknown browser";

  return `${browser} • ${platform}`;
}

function hashViewerIp(req) {
  const clientIp = resolveClientIp(req);
  if (!clientIp) return null;
  return crypto.createHash("sha256").update(clientIp).digest("hex");
}

module.exports = {
  PRIVATE_ACCESS_COOKIE,
  PRIVATE_ACCESS_TTL_MS,
  PRIVATE_PASSWORD_MIN_LENGTH,
  PRIVATE_PASSWORD_MAX_COUNT,
  PRIVATE_PASSWORD_LABEL_MAX_LENGTH,
  sanitizeSlug,
  createPrivateAccessToken,
  verifyPrivateAccessToken,
  normalizePrivatePasswordLabel,
  normalizePrivatePasswordValue,
  validatePrivatePasswordValue,
  hashPrivatePassword,
  comparePrivatePassword,
  setPrivateAccessCookie,
  clearPrivateAccessCookie,
  extractPrivateAccessToken,
  parseViewerDevice,
  hashViewerIp,
};