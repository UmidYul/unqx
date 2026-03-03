const bcrypt = require("bcryptjs");

const { env } = require("../config/env");

function getAdminSession(req) {
  return req.session && req.session.admin ? req.session.admin : null;
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

module.exports = {
  getAdminSession,
  requireAdminPage,
  requireAdminApi,
  verifyAdminCredentials,
  loginAdmin,
  logoutAdmin,
};
