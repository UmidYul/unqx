const { env } = require("../config/env");

const allowedOrigin = new URL(env.APP_URL).origin;

function getFirstHeaderValue(value) {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value.split(",")[0].trim();
}

function parseOrigin(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === "null" || trimmed === "about:client") {
    // Some mobile/webview clients send opaque origins for same-site requests.
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin === "null") {
      // Custom-scheme mobile/webview clients (capacitor://, exp://, android-app://)
      // resolve to an opaque origin in Node. Treat them like other opaque origins.
      return null;
    }
    return parsed.origin;
  } catch {
    return "__invalid_origin__";
  }
}

function resolveRequestOrigin(req) {
  const forwardedHost = getFirstHeaderValue(req.get("x-forwarded-host"));
  const host = forwardedHost || getFirstHeaderValue(req.get("host"));
  if (!host) {
    return null;
  }

  const forwardedProto = getFirstHeaderValue(req.get("x-forwarded-proto"));
  const appProtocol = new URL(env.APP_URL).protocol.replace(":", "");
  const reqProtocol = String(req.protocol || "").trim();
  const protocol = forwardedProto || reqProtocol || appProtocol;
  if (protocol !== "http" && protocol !== "https") {
    return null;
  }

  return `${protocol}://${host}`;
}

function normalizeWwwOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (!parsed.hostname.startsWith("www.")) {
      return parsed.origin;
    }
    parsed.hostname = parsed.hostname.slice(4);
    return parsed.origin;
  } catch {
    return origin;
  }
}

function isSameOrigin(value, allowedOrigins, normalizedAllowedOrigins) {
  const parsedOrigin = parseOrigin(value);
  if (!parsedOrigin) {
    return true;
  }
  if (parsedOrigin === "__invalid_origin__") {
    return false;
  }

  if (allowedOrigins.has(parsedOrigin)) {
    return true;
  }

  return normalizedAllowedOrigins.has(normalizeWwwOrigin(parsedOrigin));
}

function isMobileClient(req) {
  const marker = String(req.get("x-unqx-mobile-client") || "").trim().toLowerCase();
  return marker === "1" || marker === "true" || marker === "yes" || marker === "on";
}

function requireSameOrigin(req, res, next) {
  const method = (req.method || "").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  // Mobile app clients don't send a browser Origin/Referer header.
  // They are already protected by bearer token + CSRF, so skip the
  // origin check to prevent WAF / header-mismatch false positives.
  if (isMobileClient(req)) {
    return next();
  }

  const requestOrigin = resolveRequestOrigin(req);
  const allowedOrigins = new Set([allowedOrigin]);
  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }
  const normalizedAllowedOrigins = new Set(Array.from(allowedOrigins, (item) => normalizeWwwOrigin(item)));

  const origin = req.get("origin");
  const referer = req.get("referer");

  if (
    !isSameOrigin(origin, allowedOrigins, normalizedAllowedOrigins) ||
    !isSameOrigin(referer, allowedOrigins, normalizedAllowedOrigins)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

module.exports = {
  requireSameOrigin,
};

