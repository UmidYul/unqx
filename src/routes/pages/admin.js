const express = require("express");

const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, loginAdmin, logoutAdmin, requireStaffPage, verifyStaffCredentials } = require("../../middleware/auth");
const { prisma } = require("../../db/prisma");
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
    const loginInput = req.body.login || req.body.email;
    const staffPayload = await verifyStaffCredentials(loginInput, req.body.password);

    if (!staffPayload) {
      res.status(401).render("admin/login", {
        title: "Вход в админ-панель",
        error: "Неверный логин или пароль",
        adminSession: null,
      });
      return;
    }

    await loginAdmin(req, staffPayload);
    if (staffPayload.role === "manager") {
      await prisma.staffUser.update({
        where: { id: staffPayload.id },
        data: { lastLoginAt: new Date() },
      }).catch(() => {});
    }
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
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    const role = adminSession?.role || "admin";
    const adminTabs = new Set([
      "analytics",
      "orders",
      "purchases",
      "users",
      "slugs",
      "bracelets",
      "score",
      "testimonials",
      "logs",
      "leaderboard",
      "referrals",
      "promocodes",
      "flash-sales",
      "drops",
      "directory",
      "verification",
      "settings",
      "managers",
    ]);
    const managerTabs = new Set(["users"]);
    const allowedTabs = role === "manager" ? managerTabs : adminTabs;
    const tab =
      typeof req.query.tab === "string" && allowedTabs.has(req.query.tab)
        ? req.query.tab
        : (role === "manager" ? "users" : "analytics");

    res.render("admin/dashboard", {
      title: "Дашборд",
      adminSession,
      publicBaseUrl: getBaseUrl(),
      activeTab: tab,
      query: req.query || {},
      buildDashboardUrl: (next) => buildQuery("/admin/dashboard", next),
    });
  }),
);

router.get(
  "/admin/users/:userId/card",
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    res.render("admin/user-card", {
      title: "Визитка пользователя",
      adminSession: getAdminSession(req),
      userId,
    });
  }),
);

module.exports = {
  adminPagesRouter: router,
};
