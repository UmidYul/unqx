const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, loginAdmin, logoutAdmin, requireAdminPage, verifyAdminCredentials } = require("../../middleware/auth");
const { listCards, getCardDetailsById } = require("../../services/cards");
const { getCardStats, getGlobalStats } = require("../../services/stats");
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
    const q = req.query.q || "";
    const status = req.query.status === "active" || req.query.status === "inactive" ? req.query.status : "all";
    const page = Math.max(1, Number(req.query.page || "1") || 1);

    const result = await listCards({
      query: q,
      status,
      page,
      pageSize: 20,
    });

    res.render("admin/dashboard", {
      title: "Дашборд",
      adminSession: getAdminSession(req),
      rows: result.items,
      pagination: result.pagination,
      filters: { q, status },
      publicBaseUrl: getBaseUrl(),
      buildDashboardUrl: (nextPage) => buildQuery("/admin/dashboard", { q, status, page: nextPage }),
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

router.get(
  "/admin/stats",
  requireAdminPage,
  asyncHandler(async (req, res) => {
    const stats = await getGlobalStats(env.TIMEZONE);

    res.render("admin/stats", {
      title: "Общая статистика",
      adminSession: getAdminSession(req),
      stats,
    });
  }),
);

router.get(
  "/admin/logs",
  requireAdminPage,
  asyncHandler(async (req, res) => {
    const rawType = req.query.type || "all";
    const type = rawType === "not_found" || rawType === "server_error" ? rawType : "all";
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSize = 50;

    const where = type === "all" ? {} : { type };

    const [total, logs] = await Promise.all([
      prisma.errorLog.count({ where }),
      prisma.errorLog.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.render("admin/logs", {
      title: "Логи ошибок",
      adminSession: getAdminSession(req),
      logs,
      type,
      page,
      total,
      totalPages,
      buildLogsUrl: (nextPage) => buildQuery("/admin/logs", { type: type === "all" ? undefined : type, page: nextPage }),
    });
  }),
);

module.exports = {
  adminPagesRouter: router,
};