const bcrypt = require("bcryptjs");

const { env } = require("../config/env");

const SESSION_MAX_AGE_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getUserSession(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function getAdminSession(req) {
  return req.session && req.session.admin ? req.session.admin : null;
}

function requireUserPage(req, res, next) {
  if (!getUserSession(req)) {
    const nextPath = typeof req.originalUrl === "string" && req.originalUrl.startsWith("/") ? req.originalUrl : "/profile";
    return res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return next();
}

function requireVerifiedUserPage(req, res, next) {
  const user = getUserSession(req);
  if (!user) {
    const nextPath = typeof req.originalUrl === "string" && req.originalUrl.startsWith("/") ? req.originalUrl : "/profile";
    return res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.emailVerified) {
    return res.redirect("/verify-email");
  }
  return next();
}

function requireUserApi(req, res, next) {
  const user = getUserSession(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }
  if (user.emailVerified === false) {
    return res.status(403).json({ error: "Сначала подтверди email.", code: "EMAIL_UNVERIFIED" });
  }

  return next();
}

function requireAdminPage(req, res, next) {
  if (!getAdminSession(req)) {
    return res.redirect("/admin/login");
  }

  return next();
}

function requireAdminApi(req, res, next) {
  if (!getAdminSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

async function verifyAdminCredentials(login, password) {
  const normalizedLogin = typeof login === "string" ? login.trim() : "";
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedLogin || !normalizedPassword) {
    return false;
  }

  const expectedAdminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (expectedAdminEmail) {
    if (normalizedLogin.toLowerCase() !== expectedAdminEmail) {
      return false;
    }
  } else if (normalizedLogin !== env.ADMIN_LOGIN.trim()) {
    return false;
  }

  try {
    return bcrypt.compare(normalizedPassword, env.ADMIN_PASSWORD_HASH);
  } catch {
    return false;
  }
}

async function loginAdmin(req) {
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  req.session.admin = {
    id: "admin",
    login: (env.ADMIN_EMAIL || env.ADMIN_LOGIN).trim(),
  };

  await new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function logoutAdmin(req) {
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function loginUserSession(req, userPayload, options = {}) {
  const pendingRefCode = req.session?.pendingRefCode || null;
  const rememberMe = Boolean(options.rememberMe);
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  req.session.user = userPayload;
  req.session.cookie.maxAge = rememberMe ? SESSION_MAX_AGE_30_DAYS_MS : SESSION_MAX_AGE_7_DAYS_MS;
  if (pendingRefCode) {
    req.session.pendingRefCode = pendingRefCode;
  }

  await new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function logoutUserSession(req) {
  if (!req.session || !req.session.user) {
    return;
  }

  delete req.session.user;

  await new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

module.exports = {
  getUserSession,
  getAdminSession,
  requireUserPage,
  requireVerifiedUserPage,
  requireUserApi,
  requireAdminPage,
  requireAdminApi,
  verifyAdminCredentials,
  loginAdmin,
  logoutAdmin,
  loginUserSession,
  logoutUserSession,
  SESSION_MAX_AGE_7_DAYS_MS,
  SESSION_MAX_AGE_30_DAYS_MS,
};
