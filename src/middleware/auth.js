const bcrypt = require("bcryptjs");

const { env } = require("../config/env");

function getUserSession(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function getAdminSession(req) {
  return req.session && req.session.admin ? req.session.admin : null;
}

function requireUserPage(req, res, next) {
  if (!getUserSession(req)) {
    const nextPath = typeof req.originalUrl === "string" && req.originalUrl.startsWith("/") ? req.originalUrl : "/profile";
    return res.redirect(`/?auth=required&next=${encodeURIComponent(nextPath)}`);
  }

  return next();
}

function requireUserApi(req, res, next) {
  if (!getUserSession(req)) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }

  return next();
}

function requireAdminPage(req, res, next) {
  if (!getAdminSession(req)) {
    return res.redirect("/admin");
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

  if (normalizedLogin !== env.ADMIN_LOGIN.trim()) {
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
    login: env.ADMIN_LOGIN.trim(),
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

async function loginUserSession(req, userPayload) {
  const pendingRefCode = req.session?.pendingRefCode || null;
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
  requireUserApi,
  requireAdminPage,
  requireAdminApi,
  verifyAdminCredentials,
  loginAdmin,
  logoutAdmin,
  loginUserSession,
  logoutUserSession,
};
