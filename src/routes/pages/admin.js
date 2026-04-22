const express = require("express");

const { asyncHandler } = require("../../middleware/async");
const {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  requireStaffPage,
  requireManagerPage,
  verifyAdminCredentials,
  verifyManagerCredentials,
} = require("../../middleware/auth");
const { prisma } = require("../../db/prisma");
const { loginRateLimit } = require("../../middleware/rate-limit");
const { requireCsrfToken } = require("../../middleware/csrf");
const { getBaseUrl } = require("../../utils/url");

const router = express.Router();

function resolveStaffHome(adminSession) {
  if (!adminSession) {
    return "/admin/login";
  }
  return adminSession.role === "manager" ? "/manager/dashboard" : "/admin/dashboard";
}

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
    const adminSession = getAdminSession(req);
    if (adminSession) {
      res.redirect(resolveStaffHome(adminSession));
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
    const adminSession = getAdminSession(req);
    if (adminSession) {
      res.redirect(resolveStaffHome(adminSession));
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
    const adminPayload = await verifyAdminCredentials(loginInput, req.body.password);

    if (!adminPayload) {
      res.status(401).render("admin/login", {
        title: "Вход в админ-панель",
        error: "Неверный логин или пароль",
        adminSession: null,
      });
      return;
    }

    await loginAdmin(req, adminPayload);
    res.redirect(resolveStaffHome(adminPayload));
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
    const managerTabs = new Set(["users", "orders", "verification", "payment-cards"]);
    if (role === "manager") {
      const nextTab =
        typeof req.query.tab === "string" && managerTabs.has(req.query.tab)
          ? req.query.tab
          : "";
      res.redirect(nextTab ? `/manager/dashboard?tab=${encodeURIComponent(nextTab)}` : "/manager/dashboard");
      return;
    }
    const adminTabs = new Set([
      "analytics",
      "orders",
      "purchases",
      "payment-cards",
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
      "reports",
      "settings",
      "managers",
    ]);
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
      dashboardBasePath: "/admin/dashboard",
    });
  }),
);

router.get(
  ["/manager", "/manager/"],
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (adminSession) {
      res.redirect(resolveStaffHome(adminSession));
      return;
    }
    res.redirect("/manager/login");
  }),
);

router.get(
  ["/manager/login", "/manager/login/"],
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (adminSession) {
      res.redirect(resolveStaffHome(adminSession));
      return;
    }
    res.render("manager/login", {
      title: "Вход менеджера",
      error: "",
      adminSession: null,
    });
  }),
);

router.post(
  ["/manager/login", "/manager/login/"],
  loginRateLimit,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const loginInput = req.body.login || req.body.email;
    const managerPayload = await verifyManagerCredentials(loginInput, req.body.password);

    if (!managerPayload) {
      res.status(401).render("manager/login", {
        title: "Вход менеджера",
        error: "Неверный логин или пароль",
        adminSession: null,
      });
      return;
    }

    await loginAdmin(req, managerPayload);
    await prisma.staffUser.update({
      where: { id: managerPayload.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    res.redirect(resolveStaffHome(managerPayload));
  }),
);

router.get(
  ["/manager/dashboard", "/manager/dashboard/"],
  requireManagerPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    const role = adminSession?.role || "admin";
    if (role !== "manager") {
      res.redirect("/admin/dashboard");
      return;
    }
    const managerTabs = new Set(["users", "orders", "verification", "payment-cards"]);
    const tab =
      typeof req.query.tab === "string" && managerTabs.has(req.query.tab)
        ? req.query.tab
        : "users";
    res.render("manager/dashboard", {
      title: "Дашборд менеджера",
      adminSession,
      publicBaseUrl: getBaseUrl(),
      activeTab: tab,
      query: req.query || {},
      buildDashboardUrl: (next) => buildQuery("/manager/dashboard", next),
      dashboardBasePath: "/manager/dashboard",
    });
  }),
);

router.get(
  "/admin/users/:userId/card",
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (adminSession?.role === "manager") {
      res.redirect("/manager/users/" + encodeURIComponent(String(req.params.userId || "")) + "/card");
      return;
    }
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    res.render("admin/user-card", {
      title: "Визитка пользователя",
      adminSession,
      userId,
    });
  }),
);

router.get(
  "/manager/users/:userId/card",
  requireManagerPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (!adminSession || adminSession.role !== "manager") {
      res.redirect("/admin/users/" + encodeURIComponent(String(req.params.userId || "")) + "/card");
      return;
    }
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    res.render("admin/user-card", {
      title: "Визитка пользователя",
      adminSession,
      userId,
    });
  }),
);

router.get(
  "/admin/users/:userId/payment-cards",
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    const userId = encodeURIComponent(String(req.params.userId || ""));
    if (adminSession?.role === "manager") {
      res.redirect(`/manager/dashboard?tab=payment-cards&userId=${userId}`);
      return;
    }
    res.redirect(`/admin/dashboard?tab=payment-cards&userId=${userId}`);
  }),
);

router.get(
  "/manager/users/:userId/payment-cards",
  requireManagerPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    const userId = encodeURIComponent(String(req.params.userId || ""));
    if (!adminSession || adminSession.role !== "manager") {
      res.redirect(`/admin/dashboard?tab=payment-cards&userId=${userId}`);
      return;
    }
    res.redirect(`/manager/dashboard?tab=payment-cards&userId=${userId}`);
  }),
);

module.exports = {
  adminPagesRouter: router,
};


