const { env } = require("../config/env");

const SESSION_COOKIE_NAME = "unqx.sid.v2";
const LEGACY_SESSION_COOKIE_NAMES = ["unqx.sid"];

function resolveCookieSecure(req) {
  if (env.SESSION_COOKIE_SECURE === true) return true;
  if (env.SESSION_COOKIE_SECURE === false) return false;
  if (String(env.SESSION_COOKIE_SECURE).toLowerCase() === "auto") {
    const forwardedProto = String(req.get?.("x-forwarded-proto") || "").toLowerCase();
    return Boolean(req.secure) || forwardedProto.includes("https");
  }
  return false;
}

function buildCookieOptions(req, overrides = {}) {
  const base = {
    path: "/",
    sameSite: "lax",
    secure: resolveCookieSecure(req),
  };

  if (env.SESSION_COOKIE_DOMAIN) {
    base.domain = env.SESSION_COOKIE_DOMAIN;
  }

  return {
    ...base,
    ...overrides,
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAMES,
  resolveCookieSecure,
  buildCookieOptions,
};
