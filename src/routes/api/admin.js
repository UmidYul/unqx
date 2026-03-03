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
const { sendSlugApprovedToUser, sendSlugRejectedToUser } = require("../../services/telegram");

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
      return "🆕 Новая";
    case "contacted":
      return "💬 Связались";
    case "paid":
      return "💳 Ожидает оплаты";
    case "approved":
      return "✅ Одобрено";
    case "rejected":
      return "❌ Отклонено";
    default:
      return status;
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

    res.json({
      items: rows.map((row) => ({
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
          select: { telegramId: true },
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
        await tx.slug.upsert({
          where: { fullSlug: row.slug },
          create: {
            letters: row.slug.slice(0, 3),
            digits: row.slug.slice(3),
            fullSlug: row.slug,
            ownerTelegramId: row.telegramId,
            status: "approved",
            approvedAt: new Date(),
            requestedAt: order.createdAt,
            isPrimary: false,
            price: order.slugPrice,
          },
          update: {
            ownerTelegramId: row.telegramId,
            status: "approved",
            approvedAt: new Date(),
            price: order.slugPrice,
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
            price: order.slugPrice,
          },
          update: {
            ownerTelegramId: null,
            status: "free",
            isPrimary: false,
            pauseMessage: null,
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
          orderBy: { createdAt: "desc" },
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
    const [slugs, cards] = await Promise.all([
      prisma.slug.findMany({
        where: { ownerTelegramId: { in: telegramIds } },
        select: {
          ownerTelegramId: true,
          fullSlug: true,
          status: true,
        },
      }),
      prisma.profileCard.findMany({
        where: { ownerTelegramId: { in: telegramIds } },
        select: { ownerTelegramId: true, id: true },
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
      });
    }
    const cardsSet = new Set(cards.map((item) => item.ownerTelegramId));

    res.json({
      items: users.map((user) => ({
        telegramId: user.telegramId,
        name: user.displayName || user.firstName,
        username: user.username || null,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        slugs: slugsByUser.get(user.telegramId) || [],
        hasCard: cardsSet.has(user.telegramId),
        status: user.status,
        createdAt: user.createdAt,
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
  "/users/:telegramId/plan",
  asyncHandler(async (req, res) => {
    if (!ensureUsersStorageReady(res)) {
      return;
    }
    const telegramId = String(req.params.telegramId || "");
    const plan = normalizeTariff(req.body.plan);
    const updated = await prisma.user.update({
      where: { telegramId },
      data: { plan },
      select: { telegramId: true, plan: true },
    });
    res.json(updated);
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
    await prisma.$transaction([
      prisma.user.update({
        where: { telegramId },
        data: { status: "blocked" },
      }),
      prisma.slug.updateMany({
        where: { ownerTelegramId: telegramId },
        data: { status: "blocked", isPrimary: false },
      }),
    ]);
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
    const [cards, records] = await Promise.all([
      prisma.card.findMany({ select: { slug: true } }),
      prisma.slugRecord.findMany({ select: { slug: true, state: true } }),
    ]);
    const taken = new Set(cards.map((row) => row.slug));
    let blockedCount = 0;
    for (const row of records) {
      if (row.state === "BLOCKED") {
        blockedCount += 1;
      } else if (row.state === "TAKEN") {
        taken.add(row.slug);
      }
    }

    const total = env.SLUG_TOTAL_LIMIT;
    const free = Math.max(total - taken.size - blockedCount, 0);
    res.json({
      total,
      taken: taken.size,
      blocked: blockedCount,
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
    const stateFilter = toSlugState(req.query.state, "filter");
    const qRaw = typeof req.query.q === "string" ? req.query.q : "";
    const qUpper = qRaw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

    const [cards, records] = await Promise.all([
      prisma.card.findMany({
        select: {
          slug: true,
          name: true,
          createdAt: true,
        },
      }),
      prisma.slugRecord.findMany({
        select: {
          slug: true,
          state: true,
          ownerName: true,
          priceOverride: true,
          activationDate: true,
          cardId: true,
        },
      }),
    ]);

    const cardBySlug = new Map(cards.map((row) => [row.slug, row]));
    const recordBySlug = new Map(records.map((row) => [row.slug, row]));
    const slugSet = new Set([...cardBySlug.keys(), ...recordBySlug.keys()]);

    const rows = Array.from(slugSet).map((slug) => {
      const card = cardBySlug.get(slug);
      const record = recordBySlug.get(slug);
      const state = record?.state === "BLOCKED" ? "BLOCKED" : "TAKEN";
      const pricing = /^[A-Z]{3}[0-9]{3}$/.test(slug)
        ? calculateSlugPrice({ letters: slug.slice(0, 3), digits: slug.slice(3) })
        : null;
      const effectivePrice = typeof record?.priceOverride === "number" ? record.priceOverride : pricing ? pricing.total : null;
      return {
        slug,
        state,
        stateLabel: state === "BLOCKED" ? "Заблокирован" : "Занят",
        ownerName: card?.name || record?.ownerName || "",
        priceOverride: record?.priceOverride ?? null,
        effectivePrice,
        activationDate: record?.activationDate || card?.createdAt || null,
      };
    });

    let filtered = rows;
    if (qUpper) {
      filtered = filtered.filter((row) => String(row.slug || "").toUpperCase().includes(qUpper));
    }
    if (stateFilter === "TAKEN") {
      filtered = filtered.filter((row) => row.state === "TAKEN");
    } else if (stateFilter === "BLOCKED") {
      filtered = filtered.filter((row) => row.state === "BLOCKED");
    } else if (stateFilter === "FREE") {
      filtered = [];
      if (/^[A-Z]{3}[0-9]{3}$/.test(qUpper)) {
        const takenSet = await getTakenSlugSet();
        if (!takenSet.has(qUpper)) {
          const pricing = calculateSlugPrice({ letters: qUpper.slice(0, 3), digits: qUpper.slice(3) });
          filtered.push({
            slug: qUpper,
            state: "FREE",
            stateLabel: "Свободен",
            ownerName: "",
            priceOverride: null,
            effectivePrice: pricing.total,
            activationDate: null,
          });
        }
      }
    }

    filtered.sort((a, b) => (a.slug > b.slug ? 1 : -1));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    res.json({
      items: filtered.slice(start, start + pageSize),
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
    const nextState = toSlugState(req.body.state, "action");
    const card = await prisma.card.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (nextState === "BLOCKED") {
      const row = await prisma.slugRecord.upsert({
        where: { slug },
        create: {
          slug,
          state: "BLOCKED",
          ownerName: card?.name || null,
          cardId: card?.id || null,
        },
        update: {
          state: "BLOCKED",
          ownerName: card?.name || undefined,
          cardId: card?.id || undefined,
        },
      });
      res.json(row);
      return;
    }

    if (nextState === "TAKEN") {
      const row = await prisma.slugRecord.upsert({
        where: { slug },
        create: {
          slug,
          state: "TAKEN",
          ownerName: card?.name || null,
          cardId: card?.id || null,
        },
        update: {
          state: "TAKEN",
          ownerName: card?.name || undefined,
          cardId: card?.id || undefined,
        },
      });
      res.json(row);
      return;
    }

    if (card) {
      const row = await prisma.slugRecord.upsert({
        where: { slug },
        create: {
          slug,
          state: "TAKEN",
          ownerName: card.name,
          cardId: card.id,
        },
        update: {
          state: "TAKEN",
          ownerName: card.name,
          cardId: card.id,
        },
      });
      res.json(row);
      return;
    }

    await prisma.slugRecord.deleteMany({ where: { slug } });
    res.json({ ok: true, slug, state: "FREE" });
  }),
);

router.patch(
  "/slugs/:slug/price-override",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const value = req.body.priceOverride;
    const priceOverride = value === null || value === "" || Number.isNaN(Number(value)) ? null : Math.max(0, Math.round(Number(value)));

    const card = await prisma.card.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    const row = await prisma.slugRecord.upsert({
      where: { slug },
      create: {
        slug,
        state: card ? "TAKEN" : "BLOCKED",
        ownerName: card?.name || null,
        cardId: card?.id || null,
        priceOverride,
      },
      update: {
        priceOverride,
      },
    });

    res.json(row);
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
      select: { id: true, deliveryStatus: true },
    });
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

    const [orders, activeCards, dailyOrders, checkerLogs] = await Promise.all([
      prisma.orderRequest.findMany({
        where: {
          status: { in: ["PAID", "ACTIVATED"] },
        },
        select: {
          slug: true,
          createdAt: true,
          slugPrice: true,
          bracelet: true,
        },
      }),
      prisma.card.findMany({
        where: { isActive: true },
        select: { tariff: true },
      }),
      prisma.orderRequest.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { createdAt: true },
      }),
      prisma.slugCheckerLog.findMany({
        where: { source: "hero", checkedAt: { gte: monthStart } },
        orderBy: { checkedAt: "desc" },
        take: 1000,
        select: { slug: true, pattern: true, checkedAt: true },
      }),
    ]);

    const [newOrdersToday, allOrdersForChecks] = await Promise.all([
      prisma.orderRequest.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.orderRequest.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { slug: true, createdAt: true },
      }),
    ]);

    const oneTimeRevenue = {
      today: 0,
      week: 0,
      month: 0,
    };
    for (const row of orders) {
      const total = row.slugPrice + (row.bracelet ? 300_000 : 0);
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

    const recurring = activeCards.reduce(
      (acc, row) => acc + (row.tariff === "premium" ? 79_000 : 29_000),
      0,
    );

    const tariffSplit = activeCards.reduce(
      (acc, row) => {
        if (row.tariff === "premium") {
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

    res.json({
      kpis: {
        newOrdersToday,
        oneTimeRevenue,
        monthlyRecurringRevenue: recurring,
        activeCards: activeCards.length,
      },
      ordersDaily,
      tariffSplit,
      topUnboughtPatterns,
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
