const express = require("express");
const multer = require("multer");
const { addDays, format, startOfDay, subDays } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { requireAdminApi } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/async");
const { adminApiRateLimit } = require("../../middleware/rate-limit");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const { CardUpsertSchema } = require("../../validation/card");
const { parsePositiveInt } = require("../../utils/http");
const { listCards, createCard, getCardDetailsById, updateCard, generateNextSlug } = require("../../services/cards");
const { getCardStats, getGlobalStats } = require("../../services/stats");
const { calculateSlugPrice } = require("../../services/slug-pricing");
const { cleanupOrphanAvatars, deleteAvatarByPublicPath, isSupportedAvatarBuffer, renameAvatarBySlug, saveAvatarFromBuffer } = require("../../services/avatar");
const { sendSlugApprovedToUser, sendSlugAwaitingPaymentToUser, sendSlugRejectedToUser, sendTelegramMessage } = require("../../services/telegram");
const { recalculateAndRefreshPercentiles } = require("../../services/unq-score");

const router = express.Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function normalizeTariff(value) {
  return value === "premium" ? "premium" : "basic";
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

function normalizeTheme(value) {
  return ["default_dark", "light_minimal", "gradient", "neon", "corporate"].includes(value) ? value : "default_dark";
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
      return "Ожидает оплаты";
    case "approved":
      return "Одобрено";
    case "rejected":
      return "Отклонено";
    case "expired":
      return "Истекла";
    default:
      return status;
  }
}

function orderStatusEventTitle(status) {
  switch (status) {
    case "new":
      return "Новая заявка";
    case "paid":
      return "Заявка оплачена";
    case "approved":
      return "Заявка одобрена";
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

function normalizePhoneFromContact(contact) {
  const raw = String(contact || "").trim();
  if (!raw) {
    return "+998000000000";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+998${digits.slice(1)}`;
  }
  return "+998000000000";
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

async function getTakenSlugSet() {
  const [cards, records] = await Promise.all([
    prisma.card.findMany({ select: { slug: true } }),
    prisma.slugRecord.findMany({
      where: { state: { in: ["TAKEN", "BLOCKED"] } },
      select: { slug: true },
    }),
  ]);

  const set = new Set();
  cards.forEach((row) => set.add(row.slug));
  records.forEach((row) => set.add(row.slug));
  return set;
}

function avatarUploadMiddleware(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File exceeds 5MB" });
      return;
    }

    next(error);
  });
}

async function cleanupOrphanAvatarsFromDb() {
  const rows = await prisma.card.findMany({
    select: { avatarUrl: true },
  });

  await cleanupOrphanAvatars(rows.map((row) => row.avatarUrl).filter(Boolean));
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

router.get(
  "/cards",
  asyncHandler(async (req, res) => {
    const q = req.query.q || undefined;
    const page = Number(req.query.page || "1");
    const rawStatus = req.query.status || "all";
    const status = rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";

    const result = await listCards({
      query: q,
      status,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: 20,
    });

    res.json(result);
  }),
);

router.post(
  "/cards",
  asyncHandler(async (req, res) => {
    const parsed = CardUpsertSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        issues: parsed.error.flatten(),
      });
      return;
    }

    try {
      const card = await createCard(parsed.data);
      res.status(201).json({ id: card.id, slug: card.slug });
    } catch (error) {
      if (error && error.code === "P2002") {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }

      throw error;
    }
  }),
);

router.get(
  "/cards/:id",
  asyncHandler(async (req, res) => {
    const [card, stats] = await Promise.all([getCardDetailsById(req.params.id), getCardStats(req.params.id, env.TIMEZONE)]);

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    res.json({ card, stats });
  }),
);

router.patch(
  "/cards/:id",
  asyncHandler(async (req, res) => {
    const parsed = CardUpsertSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        issues: parsed.error.flatten(),
      });
      return;
    }

    const existing = await prisma.card.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        avatarUrl: true,
      },
    });

    if (!existing) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    try {
      const updated = await updateCard(req.params.id, parsed.data);

      if (existing.slug !== parsed.data.slug && existing.avatarUrl) {
        const moved = await renameAvatarBySlug(existing.slug, parsed.data.slug);

        await prisma.card.update({
          where: { id: updated.id },
          data: {
            avatarUrl: moved,
          },
        });

        if (!moved) {
          await deleteAvatarByPublicPath(existing.avatarUrl);
        }
      }

      await cleanupOrphanAvatarsFromDb();

      res.json({ id: updated.id, slug: parsed.data.slug });
    } catch (error) {
      if (error && error.code === "P2002") {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }

      throw error;
    }
  }),
);

router.delete(
  "/cards/:id",
  asyncHandler(async (req, res) => {
    const card = await prisma.card.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    await prisma.card.delete({ where: { id: req.params.id } });
    await deleteAvatarByPublicPath(card.avatarUrl);
    await cleanupOrphanAvatarsFromDb();

    res.json({ ok: true });
  }),
);

router.patch(
  "/cards/:id/toggle-active",
  asyncHandler(async (req, res) => {
    if (typeof req.body.isActive !== "boolean") {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const card = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        isActive: req.body.isActive,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    res.json(card);
  }),
);

router.patch(
  "/cards/:id/tariff",
  asyncHandler(async (req, res) => {
    const tariff = normalizeTariff(req.body.tariff);
    const theme = normalizeTheme(req.body.theme);

    const updated = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        tariff,
        ...(tariff === "premium" ? { theme } : { theme: "default_dark" }),
      },
      select: {
        id: true,
        tariff: true,
        theme: true,
      },
    });

    res.json(updated);
  }),
);

router.post(
  "/cards/:id/avatar",
  avatarUploadMiddleware,
  asyncHandler(async (req, res) => {
    const card = await prisma.card.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        avatarUrl: true,
      },
    });

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "File is required" });
      return;
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const hasSupportedSignature = await isSupportedAvatarBuffer(file.buffer);
    if (!hasSupportedSignature) {
      res.status(400).json({ error: "Invalid image payload" });
      return;
    }

    const avatarUrl = await saveAvatarFromBuffer(card.slug, file.buffer);

    if (card.avatarUrl && card.avatarUrl !== avatarUrl) {
      await deleteAvatarByPublicPath(card.avatarUrl);
    }

    await prisma.card.update({
      where: { id: card.id },
      data: {
        avatarUrl,
      },
    });

    await cleanupOrphanAvatarsFromDb();

    res.json({ avatarUrl });
  }),
);

router.delete(
  "/cards/:id/avatar",
  asyncHandler(async (req, res) => {
    const card = await prisma.card.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    await deleteAvatarByPublicPath(card.avatarUrl);

    await prisma.card.update({
      where: { id: card.id },
      data: {
        avatarUrl: null,
      },
    });

    await cleanupOrphanAvatarsFromDb();

    res.json({ ok: true, avatarUrl: null });
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

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
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
              telegramId: true,
              firstName: true,
              displayName: true,
              username: true,
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
        name: row.user?.displayName || row.user?.firstName || "UNQ+ User",
        slug: row.slug,
        slugPrice: row.slugPrice,
        tariff: row.requestedPlan,
        theme: null,
        bracelet: row.bracelet,
        contact: row.contact,
        telegramId: row.telegramId,
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
    const status = toOrderStatus(req.body.status);
    const adminNote = String(req.body.adminNote || "").trim();

    const order = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { telegramId: true, firstName: true },
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
          telegramId: true,
          slug: true,
          adminNote: true,
        },
      });

      const legacyStatus =
        status === "new"
          ? "NEW"
          : status === "contacted"
            ? "CONTACTED"
            : status === "paid"
              ? "PAID"
              : status === "approved"
                ? "ACTIVATED"
                : "REJECTED";
      await tx.orderRequest.updateMany({
        where: {
          slug: row.slug,
          contact: order.contact,
        },
        data: {
          status: legacyStatus,
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
            ownerTelegramId: row.telegramId,
            status: "approved",
            approvedAt: now,
            requestedAt: order.createdAt,
            pendingExpiresAt: null,
            isPrimary: false,
            price: order.slugPrice,
          },
          update: {
            ownerTelegramId: row.telegramId,
            status: "approved",
            approvedAt: now,
            pendingExpiresAt: null,
            price: order.slugPrice,
          },
        });

        await tx.user.update({
          where: { telegramId: row.telegramId },
          data: {
            plan: order.requestedPlan,
            planExpiresAt: addDays(now, 30),
          },
        });

        const hasPrimary = await tx.slug.count({
          where: {
            ownerTelegramId: row.telegramId,
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

        if (order.bracelet) {
          const legacyOrder = await tx.orderRequest.findFirst({
            where: {
              slug: row.slug,
              contact: order.contact,
            },
            select: { id: true },
          });
          if (legacyOrder) {
            const legacyBracelet = await tx.braceletOrder.findUnique({
              where: { orderId: legacyOrder.id },
              select: { id: true },
            });
            if (!legacyBracelet) {
              await tx.braceletOrder.create({
                data: {
                  orderId: legacyOrder.id,
                  name: order.user?.firstName || "UNQ+ User",
                  slug: row.slug,
                  contact: order.contact,
                  deliveryStatus: "ORDERED",
                },
              });
            }
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
            ownerTelegramId: null,
            isPrimary: false,
            pendingExpiresAt: null,
            price: order.slugPrice,
          },
          update: {
            ownerTelegramId: null,
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

      return row;
    });

    if (status === "approved") {
      try {
        await sendSlugApprovedToUser({
          telegramId: updated.telegramId,
          slug: updated.slug,
        });
      } catch (error) {
        console.error("[express-app] failed to send approval notification", error);
      }
    }

    if (status === "paid") {
      try {
        await sendSlugAwaitingPaymentToUser({
          telegramId: updated.telegramId,
          slug: updated.slug,
        });
      } catch (error) {
        console.error("[express-app] failed to send payment-pending notification", error);
      }
    }

    if (status === "approved" || status === "rejected") {
      try {
        await recalculateAndRefreshPercentiles(updated.telegramId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after order status change", error);
      }
    }

    if (status === "rejected") {
      try {
        await sendSlugRejectedToUser({
          telegramId: updated.telegramId,
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
    const order = await prisma.orderRequest.findUnique({
      where: { id: req.params.id },
      include: { braceletOrder: true },
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const tariff = normalizeTariff(req.body.tariff || order.tariff);
    const theme = tariff === "premium" ? normalizeTheme(req.body.theme || order.theme || "default_dark") : "default_dark";

    const existingBySlug = await prisma.card.findUnique({
      where: { slug: order.slug },
      select: { id: true },
    });

    if (existingBySlug && order.cardId && existingBySlug.id !== order.cardId) {
      res.status(409).json({ error: "Slug already linked to another card" });
      return;
    }

    const card =
      existingBySlug ||
      (await prisma.card.create({
        data: {
          slug: order.slug,
          isActive: true,
          tariff,
          theme,
          name: order.name,
          phone: normalizePhoneFromContact(order.contact),
          verified: false,
          hashtag: null,
          address: null,
          postcode: null,
          email: null,
          extraPhone: null,
        },
        select: { id: true },
      }));

    await prisma.$transaction(async (tx) => {
      await tx.card.update({
        where: { id: card.id },
        data: {
          isActive: true,
          tariff,
          theme,
        },
      });

      await tx.slugRecord.upsert({
        where: { slug: order.slug },
        create: {
          slug: order.slug,
          state: "TAKEN",
          ownerName: order.name,
          cardId: card.id,
          activationDate: new Date(),
        },
        update: {
          state: "TAKEN",
          ownerName: order.name,
          cardId: card.id,
          activationDate: new Date(),
        },
      });

      await tx.orderRequest.update({
        where: { id: order.id },
        data: {
          status: "ACTIVATED",
          tariff,
          theme,
          cardId: card.id,
        },
      });

      if (order.bracelet && !order.braceletOrder) {
        await tx.braceletOrder.create({
          data: {
            orderId: order.id,
            name: order.name,
            slug: order.slug,
            contact: order.contact,
            deliveryStatus: "ORDERED",
          },
        });
      }
    });

    res.json({ ok: true, cardId: card.id });
  }),
);

router.delete(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.slugRequest.findUnique({
      where: { id: req.params.id },
      select: { slug: true, contact: true },
    });
    await prisma.slugRequest.delete({ where: { id: req.params.id } });
    if (row) {
      await prisma.orderRequest.deleteMany({
        where: {
          slug: row.slug,
          contact: row.contact,
        },
      });
    }
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

    const where = q
      ? {
          OR: [
            { telegramId: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

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
            telegramId: true,
            firstName: true,
            displayName: true,
            username: true,
            plan: true,
            planExpiresAt: true,
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

    const telegramIds = users.map((item) => item.telegramId);
    const [slugs, cards, braceletRequests, unqScores] = await Promise.all([
      prisma.slug.findMany({
        where: { ownerTelegramId: { in: telegramIds } },
        select: {
          ownerTelegramId: true,
          fullSlug: true,
          status: true,
          isPrimary: true,
          pauseMessage: true,
        },
      }),
      prisma.profileCard.findMany({
        where: { ownerTelegramId: { in: telegramIds } },
        select: { ownerTelegramId: true, id: true },
      }),
      prisma.slugRequest.findMany({
        where: {
          telegramId: { in: telegramIds },
          bracelet: true,
          status: "approved",
        },
        select: { telegramId: true, slug: true },
      }),
      prisma.unqScore.findMany({
        where: { telegramId: { in: telegramIds } },
        select: {
          telegramId: true,
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
      }),
    ]);

    const slugsByUser = new Map();
    for (const row of slugs) {
      if (!slugsByUser.has(row.ownerTelegramId)) {
        slugsByUser.set(row.ownerTelegramId, []);
      }
      slugsByUser.get(row.ownerTelegramId).push({
        fullSlug: row.fullSlug,
        status: row.status,
        isPrimary: row.isPrimary,
        pauseMessage: row.pauseMessage || null,
      });
    }
    const cardsSet = new Set(cards.map((item) => item.ownerTelegramId));
    const braceletByUser = new Map();
    for (const row of braceletRequests) {
      if (!braceletByUser.has(row.telegramId)) {
        braceletByUser.set(row.telegramId, new Set());
      }
      braceletByUser.get(row.telegramId).add(row.slug);
    }
    const scoreByUser = new Map(unqScores.map((row) => [row.telegramId, row]));

    const items = users.map((user) => ({
        unqScore: scoreByUser.get(user.telegramId)
          ? {
              score: scoreByUser.get(user.telegramId).score,
              percentile: scoreByUser.get(user.telegramId).percentile,
              calculatedAt: scoreByUser.get(user.telegramId).calculatedAt,
              breakdown: {
                views: scoreByUser.get(user.telegramId).scoreViews,
                slugRarity: scoreByUser.get(user.telegramId).scoreSlugRarity,
                tenure: scoreByUser.get(user.telegramId).scoreTenure,
                ctr: scoreByUser.get(user.telegramId).scoreCtr,
                bracelet: scoreByUser.get(user.telegramId).scoreBracelet,
                plan: scoreByUser.get(user.telegramId).scorePlan,
              },
            }
          : null,
        telegramId: user.telegramId,
        name: user.displayName || user.firstName,
        username: user.username || null,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        slugs: (slugsByUser.get(user.telegramId) || []).map((slug) => ({
          ...slug,
          hasBracelet: Boolean(braceletByUser.get(user.telegramId)?.has(slug.fullSlug)),
        })),
        activeSlugCount: (slugsByUser.get(user.telegramId) || []).filter((slug) =>
          ["approved", "active", "paused", "private"].includes(slug.status),
        ).length,
        isExpiredPlan: Boolean(user.planExpiresAt && user.planExpiresAt.getTime() <= Date.now()),
        hasCard: cardsSet.has(user.telegramId),
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
  "/users/:telegramId/plan",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const telegramId = String(req.params.telegramId || "");
    const plan = normalizeTariff(req.body.plan);
    const force = Boolean(req.body.force);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { telegramId },
        select: {
          telegramId: true,
          plan: true,
          planExpiresAt: true,
        },
      });
      if (!user) {
        return null;
      }

      const owned = await tx.slug.findMany({
        where: {
          ownerTelegramId: telegramId,
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

      const nextPlanExpiresAt =
        plan === "premium"
          ? user.planExpiresAt && user.planExpiresAt.getTime() > now.getTime()
            ? user.planExpiresAt
            : addDays(now, 30)
          : user.planExpiresAt;

      const updatedUser = await tx.user.update({
        where: { telegramId },
        data: {
          plan,
          planExpiresAt: nextPlanExpiresAt,
        },
        select: { telegramId: true, plan: true, planExpiresAt: true },
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
      await recalculateAndRefreshPercentiles(result.telegramId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after plan change", error);
    }

    res.json({
      telegramId: result.telegramId,
      plan: result.plan,
      planExpiresAt: result.planExpiresAt,
    });
  }),
);

router.patch(
  "/users/:telegramId/plan-expiry",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const telegramId = String(req.params.telegramId || "");
    const rawDate = String(req.body.planExpiresAt || "").trim();
    const parsedDate = rawDate ? new Date(rawDate) : null;
    if (rawDate && (!parsedDate || Number.isNaN(parsedDate.getTime()))) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }
    const updated = await prisma.user.update({
      where: { telegramId },
      data: { planExpiresAt: parsedDate },
      select: { telegramId: true, planExpiresAt: true },
    });
    try {
      await recalculateAndRefreshPercentiles(updated.telegramId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after plan expiry update", error);
    }
    res.json(updated);
  }),
);

router.patch(
  "/users/:telegramId/block",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const telegramId = String(req.params.telegramId || "");
    await prisma.$transaction(async (tx) => {
      const owned = await tx.slug.findMany({
        where: { ownerTelegramId: telegramId },
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
        where: { telegramId },
        data: { status: "blocked" },
      });
    });
    try {
      await recalculateAndRefreshPercentiles(telegramId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after user block", error);
    }
    res.json({ ok: true });
  }),
);

router.patch(
  "/users/:telegramId/unblock",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const telegramId = String(req.params.telegramId || "");
    await prisma.$transaction(async (tx) => {
      const blocked = await tx.slug.findMany({
        where: {
          ownerTelegramId: telegramId,
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
        where: { telegramId },
        data: { status: "active" },
      });
    });
    try {
      await recalculateAndRefreshPercentiles(telegramId);
    } catch (error) {
      console.error("[express-app] failed to recalculate score after user unblock", error);
    }

    res.json({ ok: true });
  }),
);

router.get(
  "/orders/export.csv",
  asyncHandler(async (req, res) => {
    const where = buildOrdersWhere(req.query);
    const rows = await prisma.slugRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            firstName: true,
            displayName: true,
          },
        },
      },
    });

    const lines = [
      "Дата,Имя,Slug,Цена slug,Тариф,Браслет,Контакт,Статус",
      ...rows.map((row) =>
        [
          `"${new Date(row.createdAt).toLocaleString("ru-RU")}"`,
          `"${String(row.user?.displayName || row.user?.firstName || "UNQ+ User").replace(/"/g, '""')}"`,
          `"${row.slug}"`,
          row.slugPrice,
          `"${row.requestedPlan === "premium" ? "Премиум" : "Базовый"}"`,
          `"${row.bracelet ? "Да" : "Нет"}"`,
          `"${String(row.contact).replace(/"/g, '""')}"`,
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
              telegramId: true,
            },
          },
        },
      }),
    ]);

    const items = rows.map((row) => {
      const calcPrice =
        /^[A-Z]{3}[0-9]{3}$/.test(row.fullSlug) &&
        (row.price === null || row.price === undefined)
          ? calculateSlugPrice({ letters: row.fullSlug.slice(0, 3), digits: row.fullSlug.slice(3) }).total
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
        ownerTelegramId: row.ownerTelegramId || null,
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
      select: { fullSlug: true, ownerTelegramId: true, status: true, pauseMessage: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }

    const data = { status: next };
    if (next === "free") {
      data.ownerTelegramId = null;
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

    if (next === "blocked" && updated.ownerTelegramId) {
      try {
        await sendTelegramMessage({
          chatId: updated.ownerTelegramId,
          text: `⛔ Твой slug ${updated.fullSlug} был временно заблокирован администратором.`,
        });
      } catch (error) {
        console.error("[express-app] failed to send slug blocked notification", error);
      }
    }
    if (updated.ownerTelegramId) {
      try {
        await recalculateAndRefreshPercentiles(updated.ownerTelegramId);
      } catch (error) {
        console.error("[express-app] failed to recalculate score after slug state change", error);
      }
    }

    res.json({
      slug: updated.fullSlug,
      status: updated.status,
      ownerTelegramId: updated.ownerTelegramId,
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
      select: { fullSlug: true, status: true, activatedAt: true, ownerTelegramId: true },
    });
    if (updated.ownerTelegramId) {
      try {
        await recalculateAndRefreshPercentiles(updated.ownerTelegramId);
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
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const value = req.body.priceOverride;
    const priceOverride = value === null || value === "" || Number.isNaN(Number(value)) ? null : Math.max(0, Math.round(Number(value)));
    const existing = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      select: { fullSlug: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Slug not found" });
      return;
    }
    const row = await prisma.slug.update({
      where: { fullSlug: slug },
      data: { price: priceOverride },
      select: {
        fullSlug: true,
        price: true,
      },
    });

    res.json({
      slug: row.fullSlug,
      priceOverride: row.price,
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
          contact: true,
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
      select: { ownerTelegramId: true },
    });
    if (owner?.ownerTelegramId) {
      try {
        await recalculateAndRefreshPercentiles(owner.ownerTelegramId);
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
    const weekStart = subDays(todayStart, 6);
    const monthStart = subDays(todayStart, 29);

    const [approvedOrders, braceletOrders, activePlans, dailyOrders, checkerLogs, scoreRows] = await Promise.all([
      prisma.slugRequest.findMany({
        where: { status: "approved" },
        select: { slug: true, createdAt: true, slugPrice: true },
      }),
      prisma.braceletOrder.findMany({
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: {
          status: { in: ["active", "blocked"] },
          planExpiresAt: { gt: now },
        },
        select: { plan: true },
      }),
      prisma.slugRequest.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { createdAt: true },
      }),
      prisma.slugCheckerLog.findMany({
        where: { source: "hero", checkedAt: { gte: monthStart } },
        orderBy: { checkedAt: "desc" },
        take: 1000,
        select: { slug: true, pattern: true, checkedAt: true },
      }),
      prisma.unqScore.findMany({
        where: {
          user: {
            status: "active",
          },
        },
        select: { score: true },
      }),
    ]);

    const [newOrdersToday, allOrdersForChecks] = await Promise.all([
      prisma.slugRequest.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.slugRequest.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { slug: true, createdAt: true },
      }),
    ]);

    const oneTimeRevenue = {
      today: 0,
      week: 0,
      month: 0,
    };
    for (const row of approvedOrders) {
      const total = row.slugPrice;
      if (row.createdAt >= monthStart) {
        oneTimeRevenue.month += total;
      }
      if (row.createdAt >= weekStart) {
        oneTimeRevenue.week += total;
      }
      if (row.createdAt >= todayStart) {
        oneTimeRevenue.today += total;
      }
    }
    for (const row of braceletOrders) {
      if (row.createdAt >= monthStart) {
        oneTimeRevenue.month += 300_000;
      }
      if (row.createdAt >= weekStart) {
        oneTimeRevenue.week += 300_000;
      }
      if (row.createdAt >= todayStart) {
        oneTimeRevenue.today += 300_000;
      }
    }

    const recurring = activePlans.reduce(
      (acc, row) => acc + (row.plan === "premium" ? 79_000 : 29_000),
      0,
    );

    const tariffSplit = activePlans.reduce(
      (acc, row) => {
        if (row.plan === "premium") {
          acc.premium += 1;
        } else {
          acc.basic += 1;
        }
        return acc;
      },
      { basic: 0, premium: 0 },
    );

    const { keys } = computeDateRangeKey(timezone, 30);
    const orderBuckets = new Map(keys.map((key) => [key, 0]));
    for (const row of dailyOrders) {
      const key = format(toZonedTime(row.createdAt, timezone), "yyyy-MM-dd");
      if (orderBuckets.has(key)) {
        orderBuckets.set(key, (orderBuckets.get(key) || 0) + 1);
      }
    }
    const ordersDaily = keys.map((date) => ({ date, count: orderBuckets.get(date) || 0 }));

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
        oneTimeRevenue,
        monthlyRecurringRevenue: recurring,
        activeCards: activePlans.length,
        averageUnqScore,
      },
      ordersDaily,
      tariffSplit,
      topUnboughtPatterns,
      scoreDistribution,
    });
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
    const daysRaw = Number(req.query.days || "7");
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, daysRaw)) : 7;
    const stats = await getCardStats(req.params.id, env.TIMEZONE, days);
    res.json(stats);
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
