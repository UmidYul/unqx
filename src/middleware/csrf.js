const { randomBytes } = require("node:crypto");

function generateToken() {
  return randomBytes(32).toString("hex");
}

function ensureCsrfToken(req) {
  if (!req.session) {
    return null;
  }

  if (typeof req.session.csrfToken !== "string" || req.session.csrfToken.length < 32) {
    req.session.csrfToken = generateToken();
  }

  return req.session.csrfToken;
}

function getSubmittedToken(req) {
  const headerToken = req.get("x-csrf-token");
  if (headerToken) {
    return String(headerToken);
  }

  if (req.body && typeof req.body._csrf === "string") {
    return req.body._csrf;
  }

  return null;
}

function requireCsrfToken(req, res, next) {
  const method = (req.method || "").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const expected = ensureCsrfToken(req);
  const submitted = getSubmittedToken(req);

  if (!expected || !submitted || submitted !== expected) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }

    return res.status(403).render("public/error-500", {
      title: "Forbidden",
      noindex: true,
    });
  }

  return next();
}

module.exports = {
  ensureCsrfToken,
  requireCsrfToken,
};
