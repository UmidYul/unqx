const crypto = require("node:crypto");

const { env } = require("../config/env");

const SESSION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

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
    crypto.createHmac("sha256", String(env.SESSION_SECRET || "unqx-session-token")).update(payloadText).digest(),
  );
}

function sanitizeUserPayload(userPayload) {
  if (!userPayload || typeof userPayload !== "object") {
    return null;
  }

  const userId = String(userPayload.userId || "").trim();
  if (!userId) {
    return null;
  }

  return {
    userId,
    email: userPayload.email || null,
    login: userPayload.login || null,
    emailVerified: Boolean(userPayload.emailVerified),
    firstName: userPayload.firstName || null,
    lastName: userPayload.lastName || null,
    city: userPayload.city || null,
    username: userPayload.username || null,
    displayName: userPayload.displayName || null,
    plan: userPayload.plan || "none",
    planPurchasedAt: userPayload.planPurchasedAt || null,
    planUpgradedAt: userPayload.planUpgradedAt || null,
    subscriptionStartedAt: userPayload.subscriptionStartedAt || null,
    subscriptionExpiresAt: userPayload.subscriptionExpiresAt || null,
    subscriptionRenewedAt: userPayload.subscriptionRenewedAt || null,
    profileType: userPayload.profileType || "person",
    status: userPayload.status || "active",
  };
}

function createUserAccessToken(userPayload, options = {}) {
  const user = sanitizeUserPayload(userPayload);
  if (!user) {
    return null;
  }

  const now = Date.now();
  const rememberMe = Boolean(options.rememberMe);
  const exp = now + (rememberMe ? SESSION_TOKEN_TTL_REMEMBER_MS : SESSION_TOKEN_TTL_MS);
  const body = {
    v: 1,
    iat: now,
    exp,
    user,
  };

  const encoded = toBase64Url(JSON.stringify(body));
  const signature = signPayload(encoded);
  return {
    token: `${encoded}.${signature}`,
    expiresAt: exp,
  };
}

function verifyUserAccessToken(token) {
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

  const user = sanitizeUserPayload(payload.user);
  if (!user) {
    return null;
  }

  return {
    ...user,
    iat: Number(payload.iat || 0),
    exp,
  };
}

module.exports = {
  SESSION_TOKEN_TTL_MS,
  SESSION_TOKEN_TTL_REMEMBER_MS,
  createUserAccessToken,
  verifyUserAccessToken,
};
