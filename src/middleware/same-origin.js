const { env } = require("../config/env");

const allowedOrigin = new URL(env.APP_URL).origin;

function isSameOrigin(value) {
  if (!value || typeof value !== "string") {
    return true;
  }

  try {
    return new URL(value).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function requireSameOrigin(req, res, next) {
  const method = (req.method || "").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  const origin = req.get("origin");
  const referer = req.get("referer");

  if (!isSameOrigin(origin) || !isSameOrigin(referer)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

module.exports = {
  requireSameOrigin,
};

