const express = require("express");

const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, loginAdmin, logoutAdmin, requireAdminPage, verifyAdminCredentials } = require("../../middleware/auth");
const { loginRateLimit } = require("../../middleware/rate-limit");
const { requireCsrfToken } = require("../../middleware/csrf");
const { getBaseUrl } = require("../../utils/url");

const router = express.Router();

function buildQuery(basePath, params) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

router.get(
  "/admin",
  asyncHandler(async (req, res) => {
    if (getAdminSession(req)) {
      res.redirect("/admin/dashboard");
      return;
    }

    res.render("admin/login", {
      title: "Вход в админ-панель",
      error: "",
      adminSession: null,
    });
  }),
);

router.get(
  "/admin/login",
  asyncHandler(async (req, res) => {
    if (getAdminSession(req)) {
      res.redirect("/admin/dashboard");
      return;
    }
    res.render("admin/login", {
      title: "Вход в админ-панель",
      error: "",
      adminSession: null,
    });
  }),
);

router.post(
  "/admin/login",
  loginRateLimit,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const loginInput = req.body.email || req.body.login;
    const ok = await verifyAdminCredentials(loginInput, req.body.password);

    if (!ok) {
      res.status(401).render("admin/login", {
        title: "Вход в админ-панель",
        error: "Неверный логин или пароль",
        adminSession: null,
      });
      return;
    }

    await loginAdmin(req);
    res.redirect("/admin/dashboard");
  }),
);

router.post(
  "/admin/logout",
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    if (req.session) {
      await logoutAdmin(req);
    }

    res.clearCookie("unqx.sid");
    res.redirect("/admin");
  }),
);

router.get(
  "/admin/dashboard",
  requireAdminPage,
  asyncHandler(async (req, res) => {
    const allowedTabs = new Set(["analytics", "orders", "purchases", "users", "slugs", "bracelets", "score", "testimonials", "logs", "leaderboard", "referrals", "flash-sales", "drops", "directory", "verification", "settings"]);
    const tab = typeof req.query.tab === "string" && allowedTabs.has(req.query.tab) ? req.query.tab : "analytics";

    res.render("admin/dashboard", {
      title: "Дашборд",
      adminSession: getAdminSession(req),
      publicBaseUrl: getBaseUrl(),
      activeTab: tab,
      query: req.query || {},
      buildDashboardUrl: (next) => buildQuery("/admin/dashboard", next),
    });
  }),
);

module.exports = {
  adminPagesRouter: router,
};
