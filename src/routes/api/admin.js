const express = require("express");
const multer = require("multer");
const { subDays } = require("date-fns");

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
const { cleanupOrphanAvatars, deleteAvatarByPublicPath, isSupportedAvatarBuffer, renameAvatarBySlug, saveAvatarFromBuffer } = require("../../services/avatar");

const router = express.Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

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
