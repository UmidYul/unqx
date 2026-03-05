const express = require("express");

const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, loginAdmin, logoutAdmin, requireAdminPage, verifyAdminCredentials } = require("../../middleware/auth");
const { loginRateLimit } = require("../../middleware/rate-limit");
const { requireCsrfToken } = require("../../middleware/csrf");
const { getCardDetailsById } = require("../../services/cards");
const { getCardStats } = require("../../services/stats");
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

router.post(
  "/admin/login",
  loginRateLimit,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const ok = await verifyAdminCredentials(req.body.login, req.body.password);

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
    const allowedTabs = new Set(["analytics", "orders", "purchases", "users", "slugs", "cards", "bracelets", "score", "testimonials", "logs", "leaderboard", "referrals", "flash-sales", "drops", "directory", "verification"]);
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

router.get(
  "/admin/cards/new",
  requireAdminPage,
  asyncHandler(async (req, res) => {
    res.render("admin/card-form", {
      title: "Создать визитку",
      adminSession: getAdminSession(req),
      mode: "create",
      cardId: null,
      initialAvatarUrl: null,
      initialValues: {
        slug: "",
        isActive: true,
        name: "",
        phone: "",
        verified: false,
        hashtag: "",
        address: "",
        postcode: "",
        email: "",
        extraPhone: "",
        tags: [],
        buttons: [],
      },
      stats: null,
    });
  }),
);

router.get(
  "/admin/cards/:id/edit",
  requireAdminPage,
  asyncHandler(async (req, res) => {
    const [card, stats] = await Promise.all([getCardDetailsById(req.params.id), getCardStats(req.params.id, env.TIMEZONE)]);

    if (!card) {
      res.status(404).render("public/not-found", {
        title: "Визитка не найдена",
        slug: req.params.id,
        adminSession: getAdminSession(req),
      });
      return;
    }

    res.render("admin/card-form", {
      title: `Редактирование #${card.slug}`,
      adminSession: getAdminSession(req),
      mode: "edit",
      cardId: card.id,
      initialAvatarUrl: card.avatarUrl,
      initialValues: {
        slug: card.slug,
        isActive: card.isActive,
        name: card.name,
        phone: card.phone,
        verified: card.verified,
        hashtag: card.hashtag || "",
        address: card.address || "",
        postcode: card.postcode || "",
        email: card.email || "",
        extraPhone: card.extraPhone || "",
        tags: card.tags.map((tag) => ({
          id: tag.id,
          label: tag.label,
          url: tag.url || "",
          sortOrder: tag.sortOrder,
        })),
        buttons: card.buttons.map((button) => ({
          id: button.id,
          label: button.label,
          url: button.url,
          isActive: button.isActive,
          sortOrder: button.sortOrder,
        })),
      },
      stats: {
        totalViews: stats.totalViews,
        totalUniqueViews: stats.totalUniqueViews,
        series7d: stats.series7d,
        lastViewAt: stats.lastViewAt ? stats.lastViewAt.toISOString() : null,
        deviceSplit: stats.deviceSplit,
      },
    });
  }),
);

module.exports = {
  adminPagesRouter: router,
};
