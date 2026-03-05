const express = require("express");
const { addDays, format, startOfDay, subDays } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { requireAdminApi } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/async");
const { adminApiRateLimit } = require("../../middleware/rate-limit");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { parsePositiveInt } = require("../../utils/http");
const { generateNextSlug } = require("../../services/cards");
const { getGlobalStats } = require("../../services/stats");
const { calculateSlugPrice, getSlugPricingConfig } = require("../../services/slug-pricing");
const { sendSlugApprovedToUser, sendSlugAwaitingPaymentToUser, sendSlugRejectedToUser, sendTelegramMessage } = require("../../services/telegram");
const { recalculateAndRefreshPercentiles } = require("../../services/unq-score");
const {
  getBraceletPrice,
  normalizePlan,
  resolveRequestedPlanForOrder,
  getPlanPurchaseType,
} = require("../../services/pricing-settings");

const router = express.Router();

function normalizeTariff(value) {
  return value === "premium" ? "premium" : "basic";
}

function normalizeUserPlan(value) {
  if (value === "premium") return "premium";
  if (value === "basic") return "basic";
  return "none";
}

function normalizeDirectorySector(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["design", "sales", "marketing", "it", "other"].includes(normalized) ? normalized : "other";
}

function modelDelegateExists(name) {
  const key = `${name.slice(0, 1).toLowerCase()}${name.slice(1)}`;
  return Boolean(prisma[key] && typeof prisma[key] === "object");
}

function isMissingModelError(error, modelName) {
  return Boolean(error) && error.code === "P2021" && String(error?.meta?.modelName || "") === modelName;
}

function ensureUsersStorageReady(res) {
  if (!modelDelegateExists("User")) {
    res.status(503).json({ error: "Users storage unavailable", code: "USERS_STORAGE_UNAVAILABLE" });
    return false;
  }
  return true;
}

function toOrderStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  switch (normalized) {
    case "new":
      return "new";
    case "contacted":
      return "contacted";
    case "paid":
      return "paid";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    default:
      return "new";
  }
}

function toSlugState(value, mode = "filter") {
  if (value === "blocked") {
    return "BLOCKED";
  }
  if (value === "taken") {
    return "TAKEN";
  }
  if (value === "free") {
    return "FREE";
  }
  return mode === "action" ? "FREE" : "ALL";
}

function toDeliveryStatus(value) {
  switch (value) {
    case "SHIPPED":
    case "DELIVERED":
      return value;
    default:
      return "ORDERED";
  }
}

function formatOrderStatusLabel(status) {
  switch (status) {
    case "new":
      return "Новая";
    case "contacted":
      return "Связались";
    case "paid":
      return "Оплачено";
    case "approved":
      return "Активировано";
    case "rejected":
      return "Отклонено";
    case "expired":
      return "Отклонено";
    default:
      return status;
  }
}

function orderStatusEventTitle(status) {
  switch (status) {
    case "new":
      return "Новая заявка";
    case "paid":
      return "Оплата подтверждена";
    case "approved":
      return "Заявка активирована";
    case "rejected":
      return "Заявка отклонена";
    case "contacted":
      return "Связались по заявке";
    case "expired":
      return "Заявка истекла";
    default:
      return "Обновление заявки";
  }
}

function braceletStatusEventTitle(status) {
  switch (status) {
    case "ORDERED":
      return "Браслет заказан";
    case "SHIPPED":
      return "Браслет отправлен";
    case "DELIVERED":
      return "Браслет доставлен";
    default:
      return "Обновление браслета";
  }
}

function computeDateRangeKey(timezone, days) {
  const nowInZone = toZonedTime(new Date(), timezone);
  const end = startOfDay(nowInZone);
  const start = subDays(end, days - 1);
  const keys = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(format(addDays(start, i), "yyyy-MM-dd"));
  }
  return {
    keys,
    startUtc: fromZonedTime(start, timezone),
  };
}

function encodeBlockedPauseMessage(previousStatus, originalPauseMessage) {
  const prev = String(previousStatus || "paused").toLowerCase();
  const safePrev = ["approved", "active", "paused", "private"].includes(prev) ? prev : "paused";
  const base = String(originalPauseMessage || "").trim();
  return base
    ? `[blocked_prev:${safePrev}] ${base}`
    : `[blocked_prev:${safePrev}]`;
}

function parseBlockedPauseMessage(value) {
  const raw = String(value || "");
  const match = raw.match(/^\[blocked_prev:(approved|active|paused|private)\]\s*/i);
  if (!match) {
    return null;
  }
  const previousStatus = String(match[1] || "paused").toLowerCase();
  const pauseMessage = raw.replace(match[0], "").trim();
  return {
    previousStatus,
    pauseMessage: pauseMessage || null,
  };
}

router.use(adminApiRateLimit);
router.use(requireAdminApi);
router.use(requireSameOrigin);
router.use(requireCsrfToken);

router.get(
  "/navigation-summary",
  asyncHandler(async (_req, res) => {
    const [newOrdersCount, orderedBraceletsCount, orderEvents, braceletEvents] = await Promise.all([
      prisma.slugRequest.count({
        where: { status: "new" },
      }),
      prisma.braceletOrder.count({
        where: { deliveryStatus: "ORDERED" },
      }),
      prisma.slugRequest.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.braceletOrder.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          deliveryStatus: true,
          updatedAt: true,
        },
      }),
    ]);

    const mergedEvents = [
      ...orderEvents.map((item) => ({
        id: `order:${item.id}`,
        title: orderStatusEventTitle(item.status),
        slug: item.slug,
        at: item.updatedAt,
        href: "/admin/dashboard?tab=orders",
      })),
      ...braceletEvents.map((item) => ({
        id: `bracelet:${item.id}`,
        title: braceletStatusEventTitle(item.deliveryStatus),
        slug: item.slug,
        at: item.updatedAt,
        href: "/admin/dashboard?tab=bracelets",
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);

    res.json({
      badges: {
        orders: newOrdersCount,
        bracelets: orderedBraceletsCount,
      },
      events: mergedEvents,
    });
  }),
);

function sendLegacyCardsDeprecated(res) {
  res.status(410).json({
    error: "Legacy cards API is deprecated",
    code: "LEGACY_CARDS_DEPRECATED",
  });
}

router.get(
  "/cards",
  asyncHandler(async (_req, res) => {
    res.json({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
  }),
);

router.post(
  "/cards",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.get(
  "/cards/:id",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.patch(
  "/cards/:id",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.delete(
  "/cards/:id",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.patch(
  "/cards/:id/toggle-active",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.patch(
  "/cards/:id/tariff",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.post(
  "/cards/:id/avatar",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.delete(
  "/cards/:id/avatar",
  asyncHandler(async (_req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

function buildOrdersWhere(query) {
  const where = {};
  if (query.status && query.status !== "all") {
    where.status = toOrderStatus(query.status);
  }
  if (query.tariff && query.tariff !== "all") {
    where.requestedPlan = normalizeTariff(query.tariff);
  }
  if (query.bracelet === "yes") {
    where.bracelet = true;
  }
  if (query.bracelet === "no") {
    where.bracelet = false;
  }
  if (typeof query.dateFrom === "string" && query.dateFrom) {
    const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) {
      where.createdAt = { gte: from };
    }
  }
  if (typeof query.dateTo === "string" && query.dateTo) {
    const to = new Date(`${query.dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime())) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: to,
      };
    }
  }
  return where;
}

function buildPurchasesWhere(query) {
  const where = {};
  const allowedTypes = new Set(["slug", "basic_plan", "premium_plan", "upgrade_to_premium", "bracelet"]);

  if (typeof query.type === "string" && query.type !== "all" && allowedTypes.has(query.type)) {
    where.type = query.type;
  }
  if (typeof query.dateFrom === "string" && query.dateFrom) {
    const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) {
      where.purchasedAt = { gte: from };
    }
  }
  if (typeof query.dateTo === "string" && query.dateTo) {
    const to = new Date(`${query.dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime())) {
      where.purchasedAt = {
        ...(where.purchasedAt || {}),
        lte: to,
      };
    }
  }
  if (typeof query.user === "string" && query.user.trim()) {
    const term = query.user.trim();
    where.OR = [
      { userId: { contains: term, mode: "insensitive" } },
      { user: { username: { contains: term, mode: "insensitive" } } },
      { user: { firstName: { contains: term, mode: "insensitive" } } },
      { user: { displayName: { contains: term, mode: "insensitive" } } },
    ];
  }
  return where;
}

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const braceletPriceValue = await getBraceletPrice();
    const where = buildOrdersWhere(req.query);
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const [total, rows] = await Promise.all([
      prisma.slugRequest.count({ where }),
      prisma.slugRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              displayName: true,
              username: true,
              telegramChatId: true,
            },
          },
        },
      }),
    ]);

    const slugSet = new Set(rows.map((row) => row.slug));
    const slugMetaRows = slugSet.size
      ? await prisma.slug.findMany({
        where: { fullSlug: { in: Array.from(slugSet) } },
        select: { fullSlug: true, status: true, pendingExpiresAt: true },
      })
      : [];
    const slugMetaBySlug = new Map(slugMetaRows.map((row) => [row.fullSlug, row]));

    res.json({
      items: rows.map((row) => ({
        slugState: slugMetaBySlug.get(row.slug)?.status || null,
        pendingExpiresAt: slugMetaBySlug.get(row.slug)?.pendingExpiresAt || null,
        id: row.id,
        name: row.user?.displayName || row.user?.firstName || "UNQX User",
        slug: row.slug,
        slugPrice: row.slugPrice,
        planPrice: row.planPrice || 0,
        amount: Number(row.slugPrice || 0) + Number(row.planPrice || 0) + (row.bracelet ? braceletPriceValue : 0),
        tariff: row.requestedPlan,
        theme: null,
        bracelet: row.bracelet,
        contact: row.user?.username ? `@${row.user.username}` : row.user?.telegramChatId || row.user?.id || "",
        telegramId: row.userId,
        username: row.user?.username || null,
        tMeLink: row.user?.username ? `https://t.me/${row.user.username}` : null,
        status: row.status,
        adminNote: row.adminNote || null,
        createdAt: row.createdAt,
        statusLabel: formatOrderStatusLabel(row.status),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const braceletPriceValue = await getBraceletPrice();
    const status = toOrderStatus(req.body.status);
    const adminNote = String(req.body.adminNote || "").trim();
    const adminLogin = String(req.session?.admin?.login || "").trim() || null;

    const order = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, telegramChatId: true, firstName: true },
        },
      },
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.slugRequest.update({
        where: { id: order.id },
        data: {
          status,
          adminNote: adminNote || null,
        },
        select: {
          id: true,
          status: true,
          userId: true,
          slug: true,
          adminNote: true,
        },
      });

      if (status === "approved") {
        const now = new Date();
        await tx.slug.upsert({
          where: { fullSlug: row.slug },
          create: {
            letters: row.slug.slice(0, 3),
            digits: row.slug.slice(3),
            fullSlug: row.slug,
            ownerId: row.userId,
            status: "approved",
            approvedAt: now,
            requestedAt: order.createdAt,
            pendingExpiresAt: null,
            isPrimary: false,
            price: order.slugPrice,
          },
          update: {
            ownerId: row.userId,
            status: "approved",
            approvedAt: now,
            pendingExpiresAt: null,
            price: order.slugPrice,
          },
        });

        const existingUser = await tx.user.findUnique({
          where: { id: row.userId },
          select: {
            plan: true,
            planPurchasedAt: true,
            planUpgradedAt: true,
          },
        });
        const currentPlan = normalizePlan(existingUser?.plan);
        const nextPlan = resolveRequestedPlanForOrder({
          currentPlan,
          requestedPlan: order.requestedPlan,
        });
        const userPatch = { plan: nextPlan };
        if (currentPlan === "none" && (nextPlan === "basic" || nextPlan === "premium")) {
          userPatch.planPurchasedAt = existingUser?.planPurchasedAt || now;
        }
        if (currentPlan === "basic" && nextPlan === "premium") {
          userPatch.planUpgradedAt = now;
          userPatch.planPurchasedAt = existingUser?.planPurchasedAt || now;
        }
        await tx.user.update({
          where: { id: row.userId },
          data: userPatch,
        });

        const hasPrimary = await tx.slug.count({
          where: {
            ownerId: row.userId,
            isPrimary: true,
            status: { in: ["approved", "active", "paused", "private"] },
          },
        });
        if (!hasPrimary) {
          await tx.slug.update({
            where: { fullSlug: row.slug },
            data: { isPrimary: true },
          });
        }

        if (order.status !== "approved" && tx.purchase && typeof tx.purchase.create === "function") {
          await tx.purchase.create({
            data: {
              userId: row.userId,
              type: "slug",
              amount: Number(order.slugPrice || 0),
              slug: row.slug,
              purchasedAt: now,
              approvedByAdmin: adminLogin,
              approvedAt: now,
              note: `order:${row.id}`,
            },
          });

          const planPurchaseType = getPlanPurchaseType({
            currentPlan,
            requestedPlan: nextPlan,
          });
          const planPrice = Number(order.planPrice || 0);
          if (planPurchaseType && planPrice > 0) {
            await tx.purchase.create({
              data: {
                userId: row.userId,
                type: planPurchaseType,
                amount: planPrice,
                slug: null,
                purchasedAt: now,
                approvedByAdmin: adminLogin,
                approvedAt: now,
                note: `order:${row.id}`,
              },
            });
          }

          if (order.bracelet) {
            await tx.purchase.create({
              data: {
                userId: row.userId,
                type: "bracelet",
                amount: braceletPriceValue,
                slug: row.slug,
                purchasedAt: now,
                approvedByAdmin: adminLogin,
                approvedAt: now,
                note: `order:${row.id}`,
              },
            });
          }
        }
      }

      if (status === "rejected") {
        await tx.slug.upsert({
          where: { fullSlug: row.slug },
          create: {
            letters: row.slug.slice(0, 3),
            digits: row.slug.slice(3),
            fullSlug: row.slug,
            status: "free",
            ownerId: null,
            isPrimary: false,
            pendingExpiresAt: null,
            price: order.slugPrice,
          },
          update: {
            ownerId: null,
            status: "free",
            isPrimary: false,
            pauseMessage: null,
            pendingExpiresAt: null,
            approvedAt: null,
            requestedAt: null,
            activatedAt: null,
          },
        });
      }

      const userAfter =
        status === "approved"
          ? await tx.user.findUnique({
            where: { id: row.userId },
            select: { plan: true },
          })
          : null;
      return { ...row, approvedPlan: userAfter?.plan || null };
    });

    if (status === "approved") {
      try {
        await sendSlugApprovedToUser({
          telegramId: order.user?.telegramChatId || "",
          slug: updated.slug,
          plan: updated.approvedPlan || order.requestedPlan,
          hasBracelet: Boolean(order.bracelet),
        });
      } catch (error) {
        console.error("[express-app] failed to send approval notification", error);
      }
    }

    if (status === "paid") {
      try {
        await sendSlugAwaitingPaymentToUser({
          telegramId: order.user?.telegramChatId || "",
          slug: updated.slug,
        });
      } catch (error) {
        console.error("[express-app] failed to send payment-pending notification", error);
      }
    }

    if (status === "approved" || status === "rejected") {
      try {
        await recalculateAndRefreshPercentiles(updated.userId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after order status change", error);
      }
    }

    if (status === "rejected") {
      try {
        await sendSlugRejectedToUser({
          telegramId: order.user?.telegramChatId || "",
          slug: updated.slug,
          adminNote: updated.adminNote,
        });
      } catch (error) {
        console.error("[express-app] failed to send rejection notification", error);
      }
    }

    res.json({ id: updated.id, status: updated.status });
  }),
);

router.post(
  "/orders/:id/extend-pending",
  asyncHandler(async (req, res) => {
    const order = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, status: true },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.status === "expired") {
      res.status(409).json({ error: "Expired order cannot be extended" });
      return;
    }

    const slugRow = await prisma.slug.findUnique({
      where: { fullSlug: order.slug },
      select: { fullSlug: true, status: true, pendingExpiresAt: true },
    });

    if (!slugRow || slugRow.status !== "pending") {
      res.status(409).json({ error: "UNQ is not pending" });
      return;
    }

    const base = slugRow.pendingExpiresAt && slugRow.pendingExpiresAt.getTime() > Date.now() ? slugRow.pendingExpiresAt : new Date();
    const nextExpiry = addDays(base, 1);

    const updated = await prisma.slug.update({
      where: { fullSlug: slugRow.fullSlug },
      data: { pendingExpiresAt: nextExpiry },
      select: { fullSlug: true, pendingExpiresAt: true },
    });

    res.json({
      ok: true,
      slug: updated.fullSlug,
      pendingExpiresAt: updated.pendingExpiresAt,
    });
  }),
);

router.post(
  "/orders/:id/activate",
  asyncHandler(async (req, res) => {
    res.status(410).json({
      error: "Legacy activation flow is deprecated. Use slug request approval.",
      code: "LEGACY_ORDER_ACTIVATION_DEPRECATED",
    });
  }),
);

router.delete(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    await prisma.slugRequest.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }

    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const sort = req.query.sort === "score_desc" ? "score_desc" : "created_desc";
    const rawPlanFilter = typeof req.query.plan === "string" ? req.query.plan.trim() : "";
    const planFilter = ["none", "basic", "premium"].includes(rawPlanFilter) ? rawPlanFilter : "all";

    const where = {};
    if (planFilter !== "all") {
      where.plan = planFilter;
    }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    let total;
    let users;
    try {
      [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: sort === "created_desc" ? { createdAt: "desc" } : { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            firstName: true,
            displayName: true,
            username: true,
            plan: true,
            planPurchasedAt: true,
            planUpgradedAt: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);
    } catch (error) {
      if (isMissingModelError(error, "User")) {
        res.status(503).json({ error: "Users storage unavailable", code: "USERS_STORAGE_UNAVAILABLE" });
        return;
      }
      throw error;
    }

    const userIds = users.map((item) => item.id);
    const [slugs, cards, braceletRequests, unqScores] = await Promise.all([
      prisma.slug.findMany({
        where: { ownerId: { in: userIds } },
        select: {
          ownerId: true,
          fullSlug: true,
          status: true,
          isPrimary: true,
          pauseMessage: true,
        },
      }),
      prisma.profileCard.findMany({
        where: { ownerId: { in: userIds } },
        select: { ownerId: true, id: true, theme: true },
      }),
      prisma.slugRequest.findMany({
        where: {
          userId: { in: userIds },
          bracelet: true,
          status: "approved",
        },
        select: { userId: true, slug: true },
      }),
      modelDelegateExists("UnqScore")
        ? prisma.unqScore.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            score: true,
            percentile: true,
            calculatedAt: true,
            scoreViews: true,
            scoreSlugRarity: true,
            scoreTenure: true,
            scoreCtr: true,
            scoreBracelet: true,
            scorePlan: true,
          },
        })
        : Promise.resolve([]),
    ]);

    const slugsByUser = new Map();
    for (const row of slugs) {
      if (!slugsByUser.has(row.ownerId)) {
        slugsByUser.set(row.ownerId, []);
      }
      slugsByUser.get(row.ownerId).push({
        fullSlug: row.fullSlug,
        status: row.status,
        isPrimary: row.isPrimary,
        pauseMessage: row.pauseMessage || null,
      });
    }
    const cardsSet = new Set(cards.map((item) => item.ownerId));
    const cardThemeByUser = new Map(
      cards.map((item) => [item.ownerId, item.theme || "default_dark"]),
    );
    const braceletByUser = new Map();
    for (const row of braceletRequests) {
      if (!braceletByUser.has(row.userId)) {
        braceletByUser.set(row.userId, new Set());
      }
      braceletByUser.get(row.userId).add(row.slug);
    }
    const scoreByUser = new Map(unqScores.map((row) => [row.userId, row]));

    const items = users.map((user) => ({
      unqScore: scoreByUser.get(user.id)
        ? {
          score: scoreByUser.get(user.id).score,
          percentile: scoreByUser.get(user.id).percentile,
          calculatedAt: scoreByUser.get(user.id).calculatedAt,
          breakdown: {
            views: scoreByUser.get(user.id).scoreViews,
            slugRarity: scoreByUser.get(user.id).scoreSlugRarity,
            tenure: scoreByUser.get(user.id).scoreTenure,
            ctr: scoreByUser.get(user.id).scoreCtr,
            bracelet: scoreByUser.get(user.id).scoreBracelet,
            plan: scoreByUser.get(user.id).scorePlan,
          },
        }
        : null,
      telegramId: user.id,
      name: user.displayName || user.firstName,
      username: user.username || null,
      plan: user.plan,
      planPurchasedAt: user.planPurchasedAt,
      planUpgradedAt: user.planUpgradedAt,
      slugs: (slugsByUser.get(user.id) || []).map((slug) => ({
        ...slug,
        hasBracelet: Boolean(braceletByUser.get(user.id)?.has(slug.fullSlug)),
      })),
      activeSlugCount: (slugsByUser.get(user.id) || []).filter((slug) =>
        ["approved", "active", "paused", "private"].includes(slug.status),
      ).length,
      hasCard: cardsSet.has(user.id),
      theme: cardThemeByUser.get(user.id) || "default_dark",
      status: user.status,
      createdAt: user.createdAt,
    }));

    if (sort === "score_desc") {
      items.sort((a, b) => (Number(b.unqScore?.score || 0) - Number(a.unqScore?.score || 0)));
    }

    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.patch(
  "/users/:userId/plan",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    const plan = normalizeUserPlan(req.body.plan);
    const reason = String(req.body.reason || "").trim();
    const force = Boolean(req.body.force);
    const now = new Date();
    if (!reason) {
      res.status(400).json({ error: "Reason is required", code: "PLAN_CHANGE_REASON_REQUIRED" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          plan: true,
          planPurchasedAt: true,
          planUpgradedAt: true,
        },
      });
      if (!user) {
        return null;
      }

      const owned = await tx.slug.findMany({
        where: {
          ownerId: userId,
          status: { in: ["approved", "active", "paused", "private"] },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          fullSlug: true,
          status: true,
          isPrimary: true,
        },
      });

      if (plan === "basic" && owned.length > 1 && !force) {
        return {
          requiresConfirmation: true,
          activeSlugCount: owned.length,
        };
      }

      const currentPlan = normalizePlan(user.plan);
      const userPatch = { plan };
      if (currentPlan === "none" && (plan === "basic" || plan === "premium")) {
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
      }
      if (currentPlan === "basic" && plan === "premium") {
        userPatch.planUpgradedAt = now;
        userPatch.planPurchasedAt = user.planPurchasedAt || now;
      }
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: userPatch,
        select: { id: true, plan: true, planPurchasedAt: true, planUpgradedAt: true },
      });

      if (plan === "basic" && owned.length > 1) {
        const primary = owned.find((row) => row.isPrimary) || owned[0];
        const toPause = owned.filter((row) => row.fullSlug !== primary.fullSlug);
        if (toPause.length > 0) {
          await tx.slug.updateMany({
            where: {
              fullSlug: { in: toPause.map((row) => row.fullSlug) },
            },
            data: {
              status: "paused",
            },
          });
        }
      }
      if (plan === "none" && owned.length > 0) {
        await tx.slug.updateMany({
          where: { fullSlug: { in: owned.map((row) => row.fullSlug) } },
          data: { status: "paused" },
        });
      }

      return {
        ...updatedUser,
        requiresConfirmation: false,
      };
    });

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (result.requiresConfirmation) {
      res.status(409).json({
        error: "PLAN_DOWNGRADE_CONFIRMATION_REQUIRED",
        code: "PLAN_DOWNGRADE_CONFIRMATION_REQUIRED",
        activeSlugCount: result.activeSlugCount,
      });
      return;
    }

    try {
      await recalculateAndRefreshPercentiles(result.id);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after plan change", error);
    }

    res.json({
      telegramId: result.id,
      plan: result.plan,
      planPurchasedAt: result.planPurchasedAt,
      planUpgradedAt: result.planUpgradedAt,
    });
  }),
);

router.patch(
  "/users/:userId/block",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    await prisma.$transaction(async (tx) => {
      const owned = await tx.slug.findMany({
        where: { ownerId: userId },
        select: {
          fullSlug: true,
          status: true,
          pauseMessage: true,
        },
      });
      for (const row of owned) {
        if (row.status === "blocked") {
          continue;
        }
        await tx.slug.update({
          where: { fullSlug: row.fullSlug },
          data: {
            status: "blocked",
            pauseMessage: encodeBlockedPauseMessage(row.status, row.pauseMessage),
          },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { status: "blocked" },
      });
    });
    try {
      await recalculateAndRefreshPercentiles(userId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after user block", error);
    }
    res.json({ ok: true });
  }),
);

router.patch(
  "/users/:userId/unblock",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const userId = String(req.params.userId || "");
    await prisma.$transaction(async (tx) => {
      const blocked = await tx.slug.findMany({
        where: {
          ownerId: userId,
          status: "blocked",
        },
        select: {
          fullSlug: true,
          pauseMessage: true,
        },
      });

      for (const row of blocked) {
        const parsed = parseBlockedPauseMessage(row.pauseMessage);
        await tx.slug.update({
          where: { fullSlug: row.fullSlug },
          data: {
            status: parsed?.previousStatus || "paused",
            pauseMessage: parsed?.pauseMessage || null,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { status: "active" },
      });
    });
    try {
      await recalculateAndRefreshPercentiles(userId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after user unblock", error);
    }

    res.json({ ok: true });
  }),
);

router.get(
  "/orders/export.csv",
  asyncHandler(async (req, res) => {
    const braceletPriceValue = await getBraceletPrice();
    const where = buildOrdersWhere(req.query);
    const rows = await prisma.slugRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            firstName: true,
            displayName: true,
            username: true,
            telegramChatId: true,
          },
        },
      },
    });

    const lines = [
      "Дата,Имя,Slug,Цена slug,Цена тарифа,Браслет,Сумма,Контакт,Статус",
      ...rows.map((row) =>
        [
          `"${new Date(row.createdAt).toLocaleString("ru-RU")}"`,
          `"${String(row.user?.displayName || row.user?.firstName || "UNQX User").replace(/"/g, '""')}"`,
          `"${row.slug}"`,
          row.slugPrice,
          Number(row.planPrice || 0),
          `"${row.bracelet ? "Да" : "Нет"}"`,
          Number(row.slugPrice || 0) + Number(row.planPrice || 0) + (row.bracelet ? braceletPriceValue : 0),
          `"${String(row.user?.username ? `@${row.user.username}` : row.user?.telegramChatId || row.userId || "").replace(/"/g, '""')}"`,
          `"${formatOrderStatusLabel(row.status)}"`,
        ].join(","),
      ),
    ];

    const csv = `\uFEFF${lines.join("\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
    res.send(csv);
  }),
);

router.get(
  "/purchases",
  asyncHandler(async (req, res) => {
    if (!prisma.purchase) {
      res.json({
        totalRevenue: 0,
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
      return;
    }

    const where = buildPurchasesWhere(req.query);
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));

    const [total, rows, sum] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              displayName: true,
              username: true,
            },
          },
        },
      }),
      prisma.purchase.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalRevenue: Number(sum?._sum?.amount || 0),
      items: rows.map((row) => ({
        id: row.id,
        purchasedAt: row.purchasedAt,
        telegramId: row.userId,
        userName: row.user?.displayName || row.user?.firstName || "UNQX User",
        username: row.user?.username || null,
        type: row.type,
        slug: row.slug || null,
        amount: row.amount,
        approvedByAdmin: row.approvedByAdmin || null,
        approvedAt: row.approvedAt || null,
        note: row.note || null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/purchases/export.csv",
  asyncHandler(async (req, res) => {
    if (!prisma.purchase) {
      res.status(503).json({ error: "Purchases storage unavailable" });
      return;
    }
    const where = buildPurchasesWhere(req.query);
    const rows = await prisma.purchase.findMany({
      where,
      orderBy: { purchasedAt: "desc" },
      include: {
        user: {
          select: {
            firstName: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    const lines = [
      "Дата,Пользователь,Telegram,Тип,Slug,Сумма,Одобрил,Одобрено,Примечание",
      ...rows.map((row) =>
        [
          `"${new Date(row.purchasedAt).toLocaleString("ru-RU")}"`,
          `"${String(row.user?.displayName || row.user?.firstName || "UNQX User").replace(/"/g, '""')}"`,
          `"${String(row.user?.username ? `@${row.user.username}` : row.userId).replace(/"/g, '""')}"`,
          `"${String(row.type)}"`,
          `"${String(row.slug || "").replace(/"/g, '""')}"`,
          Number(row.amount || 0),
          `"${String(row.approvedByAdmin || "").replace(/"/g, '""')}"`,
          `"${row.approvedAt ? new Date(row.approvedAt).toLocaleString("ru-RU") : ""}"`,
          `"${String(row.note || "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ];

    const csv = `\uFEFF${lines.join("\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=purchases.csv");
    res.send(csv);
  }),
);

router.get(
  "/slugs/stats",
  asyncHandler(async (_req, res) => {
    const [free, blocked, taken] = await Promise.all([
      prisma.slug.count({ where: { status: "free" } }),
      prisma.slug.count({ where: { status: "blocked" } }),
      prisma.slug.count({ where: { status: { not: "free" } } }),
    ]);
    const total = free + taken;
    res.json({
      total,
      taken,
      blocked,
      free,
    });
  }),
);

router.get(
  "/slugs",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
    const stateRaw = String(req.query.state || "all");
    const qRaw = typeof req.query.q === "string" ? req.query.q : "";
    const qUpper = qRaw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const where = {};
    if (qUpper) {
      where.fullSlug = { contains: qUpper };
    }
    if (stateRaw === "free") {
      where.status = "free";
    } else if (stateRaw === "blocked") {
      where.status = "blocked";
    } else if (stateRaw === "taken") {
      where.status = { not: "free" };
    }

    const [total, rows] = await Promise.all([
      prisma.slug.count({ where }),
      prisma.slug.findMany({
        where,
        orderBy: { fullSlug: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: {
            select: {
              firstName: true,
              displayName: true,
              username: true,
              id: true,
              telegramChatId: true,
            },
          },
        },
      }),
    ]);
    const slugPricingConfig = await getSlugPricingConfig();

    const items = rows.map((row) => {
      const calcPrice =
        /^[A-Z]{3}[0-9]{3}$/.test(row.fullSlug) &&
          (row.price === null || row.price === undefined)
          ? calculateSlugPrice({ letters: row.fullSlug.slice(0, 3), digits: row.fullSlug.slice(3), config: slugPricingConfig }).total
          : null;
      const effectivePrice = typeof row.price === "number" ? row.price : calcPrice;
      return {
        slug: row.fullSlug,
        state: row.status.toUpperCase(),
        stateLabel:
          row.status === "free"
            ? "Свободен"
            : row.status === "blocked"
              ? "Заблокирован"
              : "Занят",
        ownerName: row.owner?.displayName || row.owner?.firstName || "",
        ownerId: row.ownerId || null,
        ownerUsername: row.owner?.username || null,
        effectivePrice,
        priceOverride: typeof row.price === "number" ? row.price : null,
        requestedAt: row.requestedAt,
        approvedAt: row.approvedAt,
        activatedAt: row.activatedAt,
        isPrimary: Boolean(row.isPrimary),
      };
    });

    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.patch(
  "/slugs/:slug/state",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const next = String(req.body.state || "").trim().toLowerCase();
    if (!["blocked", "free", "active", "paused", "private", "approved"].includes(next)) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true, ownerId: true, status: true, pauseMessage: true, owner: { select: { telegramChatId: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }

    const data = { status: next };
    if (next === "free") {
      data.ownerId = null;
      data.isPrimary = false;
      data.pauseMessage = null;
      data.requestedAt = null;
      data.approvedAt = null;
      data.activatedAt = null;
      data.pendingExpiresAt = null;
    }
    if (next === "blocked") {
      data.pauseMessage = encodeBlockedPauseMessage(existing.status, existing.pauseMessage);
      data.pendingExpiresAt = null;
    }
    if (next === "approved" || next === "active" || next === "paused" || next === "private") {
      data.pendingExpiresAt = null;
    }
    const updated = await prisma.slug.update({
      where: { fullSlug: slug },
      data,
    });

    if (next === "blocked" && existing.owner?.telegramChatId) {
      try {
        await sendTelegramMessage({
          chatId: existing.owner.telegramChatId,
          text: `Твой slug ${updated.fullSlug} был временно заблокирован администратором.`,
        });
      } catch (error) {
        console.error("[express-app] failed to send slug blocked notification", error);
      }
    }
    if (updated.ownerId) {
      try {
        await recalculateAndRefreshPercentiles(updated.ownerId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after slug state change", error);
      }
    }

    res.json({
      slug: updated.fullSlug,
      status: updated.status,
      ownerId: updated.ownerId,
      isPrimary: updated.isPrimary,
      requestedAt: updated.requestedAt,
      approvedAt: updated.approvedAt,
      activatedAt: updated.activatedAt,
      pauseMessage: updated.pauseMessage,
    });
  }),
);

router.patch(
  "/slugs/:slug/activate",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug: slug },
      data: {
        status: "active",
        activatedAt: new Date(),
        pendingExpiresAt: null,
      },
      select: { fullSlug: true, status: true, activatedAt: true, ownerId: true },
    });
    if (updated.ownerId) {
      try {
        await recalculateAndRefreshPercentiles(updated.ownerId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after slug activation", error);
      }
    }
    res.json({ ok: true, slug: updated.fullSlug, status: updated.status, activatedAt: updated.activatedAt });
  }),
);

router.patch(
  "/slugs/:slug/price-override",
  asyncHandler(async (req, res) => {
    const MAX_DB_INT = 2_147_483_647;
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const value = req.body.priceOverride;
    let priceOverride = null;
    if (!(value === null || value === "")) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        res.status(400).json({ error: "Invalid price override" });
        return;
      }
      const normalized = Math.max(0, Math.round(numeric));
      if (normalized > MAX_DB_INT) {
        res.status(400).json({ error: `Price override is too large (max: ${MAX_DB_INT})` });
        return;
      }
      priceOverride = normalized;
    }
    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }
    const parsed = /^([A-Z]{3})([0-9]{3})$/.exec(slug);
    const effectiveSlugPrice = (() => {
      if (typeof priceOverride === "number") {
        return priceOverride;
      }
      if (!parsed) {
        return null;
      }
      return null;
    })();

    let resolvedPrice = effectiveSlugPrice;
    if (resolvedPrice === null && parsed) {
      const slugPricingConfig = await getSlugPricingConfig();
      resolvedPrice = calculateSlugPrice({
        letters: parsed[1],
        digits: parsed[2],
        config: slugPricingConfig,
      }).total;
    }
    if (typeof resolvedPrice === "number") {
      if (!Number.isFinite(resolvedPrice)) {
        resolvedPrice = null;
      } else {
        resolvedPrice = Math.max(0, Math.min(MAX_DB_INT, Math.round(resolvedPrice)));
      }
    }

    const [row, synced] = await prisma.$transaction(async (tx) => {
      const updatedSlug = await tx.slug.update({
        where: { fullSlug: slug },
        data: { price: priceOverride },
        select: {
          fullSlug: true,
          price: true,
        },
      });

      // Keep order/purchase amounts in sync with effective slug price so analytics reflects override updates.
      const slugRequestsResult =
        typeof resolvedPrice === "number"
          ? await tx.slugRequest.updateMany({
              where: { slug },
              data: { slugPrice: resolvedPrice },
            })
          : { count: 0 };
      const purchasesResult =
        typeof resolvedPrice === "number" && tx.purchase
          ? await tx.purchase.updateMany({
              where: {
                slug,
                type: "slug",
              },
              data: { amount: resolvedPrice },
            })
          : { count: 0 };

      return [
        updatedSlug,
        {
          slugRequestsUpdated: Number(slugRequestsResult?.count || 0),
          slugPurchasesUpdated: Number(purchasesResult?.count || 0),
          effectiveSlugPrice: typeof resolvedPrice === "number" ? resolvedPrice : null,
        },
      ];
    });

    res.json({
      slug: row.fullSlug,
      priceOverride: row.price,
      synced,
    });
  }),
);

router.get(
  "/bracelet-orders",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const where = {};
    if (req.query.status === "ORDERED" || req.query.status === "SHIPPED" || req.query.status === "DELIVERED") {
      where.deliveryStatus = req.query.status;
    }
    const [total, rows] = await Promise.all([
      prisma.braceletOrder.count({ where }),
      prisma.braceletOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          name: true,
          slug: true,
          deliveryStatus: true,
        },
      }),
    ]);
    res.json({
      items: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.patch(
  "/bracelet-orders/:id/status",
  asyncHandler(async (req, res) => {
    const updated = await prisma.braceletOrder.update({
      where: { id: req.params.id },
      data: { deliveryStatus: toDeliveryStatus(req.body.deliveryStatus) },
      select: { id: true, deliveryStatus: true, slug: true },
    });
    const owner = await prisma.slug.findUnique({
      where: { fullSlug: updated.slug },
      select: { ownerId: true },
    });
    if (owner?.ownerId) {
      try {
        await recalculateAndRefreshPercentiles(owner.ownerId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after bracelet update", error);
      }
    }
    res.json(updated);
  }),
);

router.get(
  "/testimonials",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || "1") || 1);
    const pageSizeRaw = Number(req.query.pageSize || "20") || 20;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));
    const [total, rows] = await Promise.all([
      prisma.testimonial.count(),
      prisma.testimonial.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      items: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.post(
  "/testimonials",
  asyncHandler(async (req, res) => {
    const created = await prisma.testimonial.create({
      data: {
        name: String(req.body.name || "").trim(),
        slug: String(req.body.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
        tariff: normalizeTariff(req.body.tariff),
        text: String(req.body.text || "").trim(),
        isVisible: true,
        sortOrder: Number(req.body.sortOrder || 0) || 0,
      },
    });
    res.status(201).json(created);
  }),
);

router.patch(
  "/testimonials/:id",
  asyncHandler(async (req, res) => {
    const updated = await prisma.testimonial.update({
      where: { id: req.params.id },
      data: {
        name: String(req.body.name || "").trim(),
        slug: String(req.body.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
        tariff: normalizeTariff(req.body.tariff),
        text: String(req.body.text || "").trim(),
      },
    });
    res.json(updated);
  }),
);

router.patch(
  "/testimonials/:id/visibility",
  asyncHandler(async (req, res) => {
    const updated = await prisma.testimonial.update({
      where: { id: req.params.id },
      data: { isVisible: Boolean(req.body.isVisible) },
      select: { id: true, isVisible: true },
    });
    res.json(updated);
  }),
);

router.delete(
  "/testimonials/:id",
  asyncHandler(async (req, res) => {
    await prisma.testimonial.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const timezone = env.TIMEZONE;
    const now = new Date();
    const nowInZone = toZonedTime(now, timezone);
    const todayStart = fromZonedTime(startOfDay(nowInZone), timezone);
    const monthStart = subDays(todayStart, 29);
    const canUsePurchases = Boolean(prisma.purchase);

    const [
      purchasesTodayAgg,
      purchases30Agg,
      purchasesAllAgg,
      purchases30d,
      purchasesAll,
      checkerLogs,
      scoreRows,
      newOrdersToday,
      allOrdersForChecks,
    ] = await Promise.all([
      canUsePurchases
        ? prisma.purchase.aggregate({
          where: { purchasedAt: { gte: todayStart } },
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.aggregate({
          where: { purchasedAt: { gte: monthStart } },
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.aggregate({
          _sum: { amount: true },
        })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canUsePurchases
        ? prisma.purchase.findMany({
          where: { purchasedAt: { gte: monthStart } },
          select: { purchasedAt: true, amount: true, type: true },
        })
        : Promise.resolve([]),
      canUsePurchases
        ? prisma.purchase.findMany({
          select: { amount: true, type: true },
        })
        : Promise.resolve([]),
      prisma.slugCheckerLog.findMany({
        where: { source: "hero", checkedAt: { gte: monthStart } },
        orderBy: { checkedAt: "desc" },
        take: 1000,
        select: { slug: true, pattern: true, checkedAt: true },
      }),
      modelDelegateExists("UnqScore")
        ? prisma.unqScore.findMany({
          where: {
            user: {
              status: "active",
            },
          },
          select: { score: true },
        })
        : Promise.resolve([]),
      prisma.slugRequest.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.slugRequest.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { slug: true, createdAt: true },
      }),
    ]);

    const revenueToday = Number(purchasesTodayAgg?._sum?.amount || 0);
    const revenue30Days = Number(purchases30Agg?._sum?.amount || 0);
    const revenueTotal = Number(purchasesAllAgg?._sum?.amount || 0);

    const breakdown = {
      slug: 0,
      basicPlan: 0,
      premiumPlan: 0,
      bracelet: 0,
    };
    for (const item of purchasesAll) {
      const amount = Number(item.amount || 0);
      if (item.type === "slug") breakdown.slug += amount;
      if (item.type === "basic_plan") breakdown.basicPlan += amount;
      if (item.type === "premium_plan" || item.type === "upgrade_to_premium") breakdown.premiumPlan += amount;
      if (item.type === "bracelet") breakdown.bracelet += amount;
    }

    const { keys } = computeDateRangeKey(timezone, 30);
    const revenueBuckets = new Map(keys.map((key) => [key, 0]));
    for (const row of purchases30d) {
      const key = format(toZonedTime(row.purchasedAt, timezone), "yyyy-MM-dd");
      if (revenueBuckets.has(key)) {
        revenueBuckets.set(key, (revenueBuckets.get(key) || 0) + Number(row.amount || 0));
      }
    }
    const revenueDaily = keys.map((date) => ({ date, amount: revenueBuckets.get(date) || 0 }));

    const bySlugOrders = new Map();
    for (const row of allOrdersForChecks) {
      if (!bySlugOrders.has(row.slug)) {
        bySlugOrders.set(row.slug, []);
      }
      bySlugOrders.get(row.slug).push(row.createdAt);
    }
    for (const times of bySlugOrders.values()) {
      times.sort((a, b) => a.getTime() - b.getTime());
    }

    const patternCounts = new Map();
    for (const log of checkerLogs) {
      const slug = log.slug || "";
      const candidateOrders = bySlugOrders.get(slug) || [];
      const deadline = addDays(log.checkedAt, 1);
      const bought = candidateOrders.some((time) => time >= log.checkedAt && time <= deadline);
      if (bought) {
        continue;
      }
      patternCounts.set(log.pattern, (patternCounts.get(log.pattern) || 0) + 1);
    }
    const topUnboughtPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const averageUnqScore = scoreRows.length
      ? Number((scoreRows.reduce((acc, row) => acc + Number(row.score || 0), 0) / scoreRows.length).toFixed(1))
      : 0;
    const scoreDistribution = Array.from({ length: 10 }).map((_, index) => {
      const start = index * 100;
      const end = index === 9 ? 999 : start + 99;
      const count = scoreRows.filter((row) => {
        const value = Number(row.score || 0);
        if (index === 9) {
          return value >= start && value <= end;
        }
        return value >= start && value < start + 100;
      }).length;
      return {
        range: `${start}-${end}`,
        count,
      };
    });

    res.json({
      kpis: {
        newOrdersToday,
        revenueToday,
        revenue30Days,
        revenueTotal,
        averageUnqScore,
        breakdown,
      },
      revenueDaily,
      topUnboughtPatterns,
      scoreDistribution,
    });
  }),
);

router.get(
  "/platform-analytics",
  asyncHandler(async (req, res) => {
    const period = [7, 30, 90].includes(Number(req.query.period)) ? Number(req.query.period) : 7;
    const from = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const onlineFrom = new Date(Date.now() - 5 * 60 * 1000);

    const [views, clicks, activeCards, todayCreated, todayActivated, onlineRows, topSlugs] = await Promise.all([
      prisma.analyticsView ? prisma.analyticsView.findMany({ where: { visitedAt: { gte: from } } }) : Promise.resolve([]),
      prisma.analyticsClick ? prisma.analyticsClick.findMany({ where: { clickedAt: { gte: from } } }) : Promise.resolve([]),
      prisma.slug.count({ where: { status: "active" } }),
      prisma.slug.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.slug.count({ where: { activatedAt: { gte: todayStart } } }),
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { visitedAt: { gte: onlineFrom } }, select: { sessionId: true } })
        : Promise.resolve([]),
      prisma.slug.findMany({
        where: { status: "active" },
        orderBy: [{ analyticsViewsCount: "desc" }],
        take: 10,
        select: { fullSlug: true, analyticsViewsCount: true },
      }),
    ]);

    const daily = new Map();
    views.forEach((item) => {
      const key = item.visitedAt.toISOString().slice(0, 10);
      daily.set(key, (daily.get(key) || 0) + 1);
    });
    const bySource = {};
    const byDevice = {};
    views.forEach((item) => {
      const src = String(item.source || "direct");
      const dev = String(item.device || "desktop");
      bySource[src] = (bySource[src] || 0) + 1;
      byDevice[dev] = (byDevice[dev] || 0) + 1;
    });
    const byButton = {};
    clicks.forEach((item) => {
      const key = String(item.buttonType || "other");
      byButton[key] = (byButton[key] || 0) + 1;
    });

    res.json({
      period,
      totalViewsByDay: Array.from(daily.entries()).map(([date, value]) => ({ date, value })),
      topSlugs: topSlugs.map((row) => ({ slug: row.fullSlug, views: Number(row.analyticsViewsCount || 0) })),
      breakdown: {
        source: bySource,
        device: byDevice,
        button: byButton,
      },
      realtime: {
        activeCards,
        todayCreated,
        todayActivated,
        onlineNow: new Set(onlineRows.map((row) => row.sessionId)).size,
      },
    });
  }),
);

router.get(
  "/verification-requests",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.json({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }
    const status = String(req.query.status || "all").toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 20;
    const where = status === "all" ? {} : { status };

    const [total, rows] = await Promise.all([
      prisma.verificationRequest.count({ where }),
      prisma.verificationRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      items: rows,
      pagination: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.post(
  "/verification-requests/:id/approve",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    const target = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: target.id },
        data: {
          status: "approved",
          reviewedAt: now,
          adminNote: null,
        },
      }),
      prisma.user.update({
        where: { id: target.userId },
        data: {
          isVerified: true,
          verifiedCompany: target.companyName,
          directorySector: normalizeDirectorySector(target.sector),
          verifiedAt: now,
        },
      }),
    ]);
    res.json({ ok: true });
  }),
);

router.post(
  "/verification-requests/:id/reject",
  asyncHandler(async (req, res) => {
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }
    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const target = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    await prisma.verificationRequest.update({
      where: { id: target.id },
      data: {
        status: "rejected",
        adminNote: adminNote || null,
        reviewedAt: new Date(),
      },
    });
    res.json({ ok: true });
  }),
);

router.get(
  "/directory-exclusions",
  asyncHandler(async (_req, res) => {
    if (!prisma.directoryExclusion) {
      res.json({ items: [] });
      return;
    }
    const items = await prisma.directoryExclusion.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.json({ items });
  }),
);

router.post(
  "/directory-exclusions",
  asyncHandler(async (req, res) => {
    if (!prisma.directoryExclusion) {
      res.status(503).json({ error: "Directory exclusions storage unavailable" });
      return;
    }
    const slug = String(req.body?.slug || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 20);
    if (!slug) {
      res.status(400).json({ error: "Invalid slug" });
      return;
    }
    const row = await prisma.directoryExclusion.upsert({
      where: { slug },
      create: {
        slug,
        reason: String(req.body?.reason || "").trim() || null,
        excludedBy: String(req.session?.admin?.login || "").trim() || null,
      },
      update: {
        reason: String(req.body?.reason || "").trim() || null,
        excludedBy: String(req.session?.admin?.login || "").trim() || null,
      },
    });
    res.json({ ok: true, item: row });
  }),
);

router.delete(
  "/directory-exclusions/:slug",
  asyncHandler(async (req, res) => {
    if (!prisma.directoryExclusion) {
      res.status(503).json({ error: "Directory exclusions storage unavailable" });
      return;
    }
    const slug = String(req.params.slug || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 20);
    await prisma.directoryExclusion.deleteMany({ where: { slug } });
    res.json({ ok: true });
  }),
);

router.get(
  "/logs",
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
    res.json({
      items: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  }),
);

router.get(
  "/cards/:id/stats",
  asyncHandler(async (req, res) => {
    sendLegacyCardsDeprecated(res);
  }),
);

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const days = Math.min(parsePositiveInt(req.query.days || null, 30), 90);
    const stats = await getGlobalStats(env.TIMEZONE);
    const normalized = days === 30 ? stats : { ...stats, dailySeries: stats.dailySeries.slice(-days) };

    res.json(normalized);
  }),
);

router.post(
  "/slug/next",
  asyncHandler(async (_req, res) => {
    const slug = await generateNextSlug();
    res.json({ slug });
  }),
);

router.post(
  "/logs/cleanup",
  asyncHandler(async (_req, res) => {
    const threshold = subDays(new Date(), 30);
    const result = await prisma.errorLog.deleteMany({
      where: {
        occurredAt: { lt: threshold },
      },
    });

    res.json({ ok: true, deleted: result.count });
  }),
);

module.exports = {
  adminApiRouter: router,
};
