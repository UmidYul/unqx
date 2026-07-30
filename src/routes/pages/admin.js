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
const { SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAMES, buildCookieOptions } = require("../../utils/cookies");
const { getProfileEditorPresetsWithDisplayNames } = require("../../services/profile-editor-presets");
const { ensureProfileCardExists } = require("../../services/public-handle");

const router = express.Router();

function resolveStaffHome(adminSession) {
  if (!adminSession) {
    return "/admin/login";
  }
  return adminSession.role === "manager" ? "/manager/dashboard" : "/admin/dashboard";
}

function getStaffRole(adminSession) {
  return String(adminSession?.role || "").trim().toLowerCase();
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

function buildAdminCardOwnerLabel(user) {
  const raw = [
    user?.displayName,
    user?.firstName,
    user?.username ? `@${user.username}` : "",
    user?.telegramUsername ? `@${user.telegramUsername}` : "",
    user?.email,
  ].find((value) => String(value || "").trim());
  return String(raw || "UNQX User").trim().slice(0, 120) || "UNQX User";
}

async function searchAdminCardOwners(query) {
  const term = String(query || "").trim();
  if (!term) {
    return [];
  }

  const or = [
    { firstName: { contains: term, mode: "insensitive" } },
    { displayName: { contains: term, mode: "insensitive" } },
    { username: { contains: term, mode: "insensitive" } },
    { telegramUsername: { contains: term, mode: "insensitive" } },
    { email: { contains: term, mode: "insensitive" } },
  ];
  if (/^[0-9a-f-]{12,}$/i.test(term)) {
    or.push({ id: term });
  }

  const users = await prisma.user.findMany({
    where: { OR: or },
    select: {
      id: true,
      firstName: true,
      displayName: true,
      username: true,
      telegramUsername: true,
      email: true,
      plan: true,
      status: true,
      createdAt: true,
      profileCard: {
        select: {
          id: true,
          name: true,
          updatedAt: true,
        },
      },
      slugs: {
        where: {
          status: { in: ["approved", "active", "paused", "private"] },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 3,
        select: {
          fullSlug: true,
          status: true,
          isPrimary: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
  });

  return users.map((user) => ({
    id: user.id,
    name: buildAdminCardOwnerLabel(user),
    username: String(user.username || "").trim(),
    telegramUsername: String(user.telegramUsername || "").trim(),
    email: String(user.email || "").trim(),
    plan: String(user.plan || "").trim().toLowerCase() === "premium" ? "premium" : "none",
    status: String(user.status || "").trim().toLowerCase() || "active",
    profileCardId: String(user.profileCard?.id || "").trim(),
    profileCardName: String(user.profileCard?.name || "").trim(),
    profileCardUpdatedAt: user.profileCard?.updatedAt || null,
    slugs: Array.isArray(user.slugs)
      ? user.slugs.map((slug) => ({
        fullSlug: String(slug.fullSlug || "").trim(),
        status: String(slug.status || "").trim().toLowerCase(),
        isPrimary: Boolean(slug.isPrimary),
      }))
      : [],
  }));
}

router.get(
  "/admin",
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (getStaffRole(adminSession) === "admin") {
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
    if (getStaffRole(adminSession) === "admin") {
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

    res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(req, { httpOnly: true }));
    for (const legacyName of LEGACY_SESSION_COOKIE_NAMES) {
      res.clearCookie(legacyName, buildCookieOptions(req, { httpOnly: true }));
      res.clearCookie(legacyName, {
        path: "/",
        sameSite: "lax",
        secure: buildCookieOptions(req).secure,
        httpOnly: true,
      });
    }
    res.redirect("/admin");
  }),
);

router.post(
  "/manager/logout",
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    if (req.session) {
      await logoutAdmin(req);
    }
    res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(req, { httpOnly: true }));
    for (const legacyName of LEGACY_SESSION_COOKIE_NAMES) {
      res.clearCookie(legacyName, buildCookieOptions(req, { httpOnly: true }));
      res.clearCookie(legacyName, {
        path: "/",
        sameSite: "lax",
        secure: buildCookieOptions(req).secure,
        httpOnly: true,
      });
    }
    res.redirect("/manager/login");
  }),
);

router.get(
  "/admin/dashboard",
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    const role = adminSession?.role || "admin";
    const managerTabs = new Set(["users", "orders", "credits", "payment-cards", "posts", "verification", "badges", "pets"]);
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
      "credits",
      "purchases",
      "payment-cards",
      "cards",
      "posts",
      "users",
      "accounts",
      "slugs",

      "score",
      "testimonials",
      "logs",
      "leaderboard",
      "referrals",
      "promocodes",
      "flash-sales",
      "auctions",
      "event-cards",
      "music",
      "banner",
      "drops",
      "directory",
      "verification",
      "badges",
      "pets",
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
    if (getStaffRole(adminSession) === "manager") {
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
    if (getStaffRole(adminSession) === "manager") {
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
    }).catch(() => { });

    res.redirect(resolveStaffHome(managerPayload));
  }),
);

router.get(
  ["/manager/dashboard", "/manager/dashboard/"],
  requireManagerPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    const managerTabs = new Set(["users", "orders", "credits", "payment-cards", "posts", "verification", "badges", "pets"]);
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
  "/admin/cards/new",
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (adminSession?.role === "manager") {
      res.redirect("/manager/dashboard");
      return;
    }

    const ownerId = String(req.query.ownerId || "").trim();
    if (ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: {
          id: true,
          firstName: true,
          displayName: true,
          username: true,
          telegramUsername: true,
          email: true,
        },
      });

      if (!owner) {
        res.status(404).render("admin/card-form", {
          title: "Выбор владельца визитки",
          adminSession,
          dashboardBasePath: "/admin/dashboard",
          mode: "select-owner",
          cardId: "",
          ownerSearchQuery: String(req.query.q || "").trim(),
          ownerSearchResults: await searchAdminCardOwners(req.query.q),
          ownerPickerError: "Пользователь не найден",
          themePresets: await getProfileEditorPresetsWithDisplayNames(),
        });
        return;
      }

      const profileCard = await ensureProfileCardExists({
        tx: prisma,
        user: {
          id: owner.id,
          firstName: owner.firstName,
          displayName: buildAdminCardOwnerLabel(owner),
        },
      });

      res.redirect(`/admin/cards/${encodeURIComponent(profileCard.id)}/edit`);
      return;
    }

    res.render("admin/card-form", {
      title: "Выбор владельца визитки",
      adminSession,
      dashboardBasePath: "/admin/dashboard",
      mode: "select-owner",
      cardId: "",
      ownerSearchQuery: String(req.query.q || "").trim(),
      ownerSearchResults: await searchAdminCardOwners(req.query.q),
      ownerPickerError: "",
      themePresets: await getProfileEditorPresetsWithDisplayNames(),
    });
  }),
);

router.get(
  "/admin/cards/:id/edit",
  requireStaffPage,
  asyncHandler(async (req, res) => {
    const adminSession = getAdminSession(req);
    if (adminSession?.role === "manager") {
      res.redirect("/manager/dashboard");
      return;
    }

    const cardId = String(req.params.id || "").trim();
    const card = await prisma.profileCard.findUnique({
      where: { id: cardId },
      select: { id: true },
    });

    if (!card) {
      res.status(404).render("admin/card-form", {
        title: "Визитка не найдена",
        adminSession,
        dashboardBasePath: "/admin/dashboard",
        mode: "missing",
        cardId,
        ownerSearchQuery: "",
        ownerSearchResults: [],
        ownerPickerError: "",
        themePresets: await getProfileEditorPresetsWithDisplayNames(),
      });
      return;
    }

    res.render("admin/card-form", {
      title: "Редактор визитки",
      adminSession,
      dashboardBasePath: "/admin/dashboard",
      mode: "edit",
      cardId: card.id,
      ownerSearchQuery: "",
      ownerSearchResults: [],
      ownerPickerError: "",
      themePresets: await getProfileEditorPresetsWithDisplayNames(),
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
