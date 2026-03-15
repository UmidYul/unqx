const bcrypt = require("bcryptjs");

const { env } = require("../config/env");
const { prisma } = require("../db/prisma");
const { normalizeLogin, isValidLogin } = require("../utils/login");

const SESSION_MAX_AGE_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getUserSession(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function getAdminSession(req) {
  const session = req.session && req.session.admin ? req.session.admin : null;
  if (session && !session.role) {
    session.role = "admin";
  }
  if (session && !session.name) {
    session.name = session.role === "manager" ? "Manager" : "Admin";
  }
  return session;
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
  if (user.email && !user.emailVerified) {
    return res.redirect("/verify-email");
  }
  return next();
}

function requireUserApi(req, res, next) {
  const user = getUserSession(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }
  if (user.email && user.emailVerified === false) {
    return res.status(403).json({ error: "Сначала подтверди email.", code: "EMAIL_UNVERIFIED" });
  }

  return next();
}

function requireAdminPage(req, res, next) {
  const admin = getAdminSession(req);
  if (!admin || admin.role !== "admin") {
    return res.redirect("/admin/login");
  }

  return next();
}

function requireAdminApi(req, res, next) {
  const admin = getAdminSession(req);
  if (!admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (admin.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

function requireStaffPage(req, res, next) {
  if (!getAdminSession(req)) {
    return res.redirect("/admin/login");
  }

  return next();
}

function requireStaffApi(req, res, next) {
  if (!getAdminSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

function resolveAdminLogin() {
  const raw = String(env.ADMIN_EMAIL || env.ADMIN_LOGIN || "").trim();
  return raw;
}

async function verifyStaffCredentials(login, password) {
  const normalizedLogin = normalizeLogin(login);
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedLogin || !isValidLogin(normalizedLogin) || !normalizedPassword) {
    return null;
  }

  const adminLogin = resolveAdminLogin();
  if (adminLogin) {
    const adminLoginNormalized = normalizeLogin(adminLogin) || adminLogin.trim().toLowerCase();
    if (normalizedLogin === adminLoginNormalized) {
      try {
        const ok = await bcrypt.compare(normalizedPassword, env.ADMIN_PASSWORD_HASH);
        if (ok) {
          return {
            id: "admin",
            login: adminLogin,
            role: "admin",
            name: "Admin",
          };
        }
      } catch {
        return null;
      }
    }
  }

  try {
    const staff = await prisma.staffUser.findFirst({
      where: { login: normalizedLogin },
      select: {
        id: true,
        login: true,
        role: true,
        name: true,
        isActive: true,
        passwordHash: true,
      },
    });
    if (!staff || !staff.isActive || !staff.passwordHash) {
      return null;
    }
    const ok = await bcrypt.compare(normalizedPassword, staff.passwordHash);
    if (!ok) {
      return null;
    }
    return {
      id: staff.id,
      login: staff.login,
      role: staff.role || "manager",
      name: staff.name || "Manager",
    };
  } catch {
    return null;
  }
}

async function loginAdmin(req, adminPayload) {
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const fallbackLogin = resolveAdminLogin() || "admin";
  const payload = adminPayload || {
    id: "admin",
    login: fallbackLogin,
    role: "admin",
    name: "Admin",
  };

  req.session.admin = {
    id: payload.id,
    login: payload.login,
    role: payload.role || "admin",
    name: payload.name || (payload.role === "manager" ? "Manager" : "Admin"),
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
  requireStaffPage,
  requireStaffApi,
  verifyStaffCredentials,
  loginAdmin,
  logoutAdmin,
  loginUserSession,
  logoutUserSession,
  SESSION_MAX_AGE_7_DAYS_MS,
  SESSION_MAX_AGE_30_DAYS_MS,
};
