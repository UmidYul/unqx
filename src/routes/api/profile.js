const express = require("express");
const multer = require("multer");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { requireUserApi, getUserSession } = require("../../middleware/auth");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { requireCsrfToken } = require("../../middleware/csrf");
const {
  getEffectivePlan,
  getSlugLimit,
  getTagLimit,
  getButtonLimit,
  normalizeThemeByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  getPlanBadgeLabel,
} = require("../../services/profile");
const { isSupportedAvatarBuffer, saveAvatarFromBuffer, deleteAvatarByPublicPath } = require("../../services/avatar");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function toSlugStatusLabel(status) {
  switch (status) {
    case "active":
      return "🟢 Активен";
    case "paused":
      return "🟡 Пауза";
    case "private":
      return "🔴 Приватный";
    case "approved":
      return "✅ Одобрен";
    case "pending":
      return "⏳ В ожидании";
    case "blocked":
      return "⛔ Заблокирован";
    case "free":
      return "Свободен";
    default:
      return status;
  }
}

function toRequestStatusBadge(status) {
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
    case "expired":
      return "⬜ ИСТЕКЛА";
    default:
      return status;
  }
}

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function parseProfileCardRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    ownerTelegramId: row.ownerTelegramId,
    name: row.name,
    role: row.role || "",
    bio: row.bio || "",
    avatarUrl: row.avatarUrl || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    buttons: Array.isArray(row.buttons) ? row.buttons : [],
    theme: row.theme || "default_dark",
    customColor: row.customColor || "",
    showBranding: Boolean(row.showBranding),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getCurrentUser(req) {
  const sessionUser = getUserSession(req);
  if (!sessionUser || !sessionUser.telegramId) {
    return null;
  }
  return prisma.user.findUnique({
    where: { telegramId: sessionUser.telegramId },
  });
}

function assertUserActive(user, res) {
  if (!user) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    return false;
  }
  if (user.status === "blocked" || user.status === "deactivated") {
    res.status(403).json({ error: "Account is disabled", code: "ACCOUNT_DISABLED" });
    return false;
  }
  return true;
}

async function getUserSlugsWithStats(telegramId) {
  const slugs = await prisma.slug.findMany({
    where: { ownerTelegramId: telegramId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  const fullSlugs = slugs.map((item) => item.fullSlug);

  let viewsBySlug = new Map();
  if (fullSlugs.length > 0) {
    const grouped = await prisma.slugView.groupBy({
      by: ["fullSlug"],
      where: {
        fullSlug: { in: fullSlugs },
      },
      _count: { _all: true },
      _min: { viewedAt: true },
    });
    viewsBySlug = new Map(
      grouped.map((row) => [
        row.fullSlug,
        {
          views: row._count._all || 0,
          since: row._min.viewedAt || null,
        },
      ]),
    );
  }

  return slugs.map((item) => {
    const stat = viewsBySlug.get(item.fullSlug) || { views: 0, since: item.createdAt };
    return {
      id: item.id,
      letters: item.letters,
      digits: item.digits,
      fullSlug: item.fullSlug,
      status: item.status,
      statusLabel: toSlugStatusLabel(item.status),
      isPrimary: item.isPrimary,
      pauseMessage: item.pauseMessage || "",
      requestedAt: item.requestedAt,
      approvedAt: item.approvedAt,
      activatedAt: item.activatedAt,
      createdAt: item.createdAt,
      stats: {
        views: stat.views,
        since: stat.since,
      },
    };
  });
}

router.use(requireUserApi);
router.use(requireSameOrigin);
router.use(requireCsrfToken);

router.get(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const [slugs, card, requests] = await Promise.all([
      getUserSlugsWithStats(user.telegramId),
      prisma.profileCard.findUnique({ where: { ownerTelegramId: user.telegramId } }),
      prisma.slugRequest.findMany({
        where: { telegramId: user.telegramId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const effective = getEffectivePlan(user);

    res.json({
      user: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
        displayName: normalizeDisplayName(user.displayName, user.firstName),
        plan: user.plan,
        effectivePlan: effective.plan,
        isExpiredPremium: effective.isExpiredPremium,
        planExpiresAt: user.planExpiresAt,
        planBadge: getPlanBadgeLabel(effective.plan),
        notificationsEnabled: Boolean(user.notificationsEnabled),
        status: user.status,
      },
      limits: {
        slugs: getSlugLimit(effective.plan),
        tags: getTagLimit(effective.plan),
        buttons: getButtonLimit(effective.plan),
      },
      slugs,
      card: parseProfileCardRow(card),
      requests: requests.map((item) => ({
        id: item.id,
        slug: item.slug,
        slugPrice: item.slugPrice,
        requestedPlan: item.requestedPlan,
        bracelet: item.bracelet,
        contact: item.contact,
        status: item.status,
        statusBadge: toRequestStatusBadge(item.status),
        adminNote: item.adminNote,
        createdAt: item.createdAt,
      })),
    });
  }),
);

router.get(
  "/slugs",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const slugs = await getUserSlugsWithStats(user.telegramId);
    res.json({ items: slugs });
  }),
);

router.patch(
  "/slugs/:slug/status",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const nextStatus = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "paused", "private"].includes(nextStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerTelegramId: user.telegramId },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug },
      data: { status: nextStatus },
    });

    res.json({ ok: true, slug: updated.fullSlug, status: updated.status });
  }),
);

router.patch(
  "/slugs/:slug/primary",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerTelegramId: user.telegramId },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    await prisma.$transaction([
      prisma.slug.updateMany({
        where: { ownerTelegramId: user.telegramId },
        data: { isPrimary: false },
      }),
      prisma.slug.update({
        where: { fullSlug },
        data: { isPrimary: true },
      }),
    ]);

    res.json({ ok: true, slug: fullSlug, isPrimary: true });
  }),
);

router.patch(
  "/slugs/:slug/pause-message",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const message = String(req.body.message || "").trim().slice(0, 220);
    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerTelegramId: user.telegramId },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug },
      data: { pauseMessage: message || null },
    });

    res.json({ ok: true, slug: updated.fullSlug, pauseMessage: updated.pauseMessage || "" });
  }),
);

router.get(
  "/card",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }
    const row = await prisma.profileCard.findUnique({
      where: { ownerTelegramId: user.telegramId },
    });
    res.json({ card: parseProfileCardRow(row) });
  }),
);

router.put(
  "/card",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const effective = getEffectivePlan(user);
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const role = String(body.role || "").trim().slice(0, 120) || null;
    const bio = String(body.bio || "").trim().slice(0, 120) || null;
    const rawTags = Array.isArray(body.tags) ? body.tags : [];
    const rawButtons = Array.isArray(body.buttons) ? body.buttons : [];
    if (effective.plan !== "premium" && rawTags.length > getTagLimit("basic")) {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }
    if (effective.plan !== "premium" && rawButtons.length > getButtonLimit("basic")) {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }
    const tags = normalizeTags(body.tags, effective.plan);
    const buttons = normalizeButtons(body.buttons, effective.plan);
    const theme = normalizeThemeByPlan(body.theme, effective.plan);
    const customColor = effective.plan === "premium" ? normalizeColor(body.customColor) : null;
    const showBranding = effective.plan === "premium" ? Boolean(body.showBranding) : true;

    if (effective.plan !== "premium") {
      const requestedTheme = String(body.theme || "").trim();
      if (requestedTheme && requestedTheme !== "default_dark") {
        res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
        return;
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      const cardRow = await tx.profileCard.upsert({
        where: { ownerTelegramId: user.telegramId },
        create: {
          ownerTelegramId: user.telegramId,
          name,
          role,
          bio,
          tags,
          buttons,
          theme,
          customColor,
          showBranding,
        },
        update: {
          name,
          role,
          bio,
          tags,
          buttons,
          theme,
          customColor,
          showBranding,
        },
      });

      await tx.slug.updateMany({
        where: {
          ownerTelegramId: user.telegramId,
          status: "approved",
        },
        data: {
          status: "active",
          activatedAt: new Date(),
        },
      });

      return cardRow;
    });

    res.json({ ok: true, card: parseProfileCardRow(saved) });
  }),
);

router.post(
  "/card/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const card = await prisma.profileCard.findUnique({
      where: { ownerTelegramId: user.telegramId },
    });

    if (!card) {
      res.status(400).json({ error: "Сначала сохрани визитку" });
      return;
    }

    if (!req.file || !ALLOWED_MIME.has(req.file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const okBuffer = await isSupportedAvatarBuffer(req.file.buffer);
    if (!okBuffer) {
      res.status(400).json({ error: "Invalid image payload" });
      return;
    }

    const avatarUrl = await saveAvatarFromBuffer(`profile_${user.telegramId.replace(/\D/g, "").slice(0, 24)}`, req.file.buffer);
    if (card.avatarUrl && card.avatarUrl !== avatarUrl) {
      await deleteAvatarByPublicPath(card.avatarUrl);
    }

    await prisma.profileCard.update({
      where: { ownerTelegramId: user.telegramId },
      data: { avatarUrl },
    });

    res.json({ ok: true, avatarUrl });
  }),
);

router.delete(
  "/card/avatar",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const card = await prisma.profileCard.findUnique({
      where: { ownerTelegramId: user.telegramId },
    });
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    if (card.avatarUrl) {
      await deleteAvatarByPublicPath(card.avatarUrl);
    }
    await prisma.profileCard.update({
      where: { ownerTelegramId: user.telegramId },
      data: { avatarUrl: null },
    });

    res.json({ ok: true, avatarUrl: null });
  }),
);

router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const rows = await prisma.slugRequest.findMany({
      where: { telegramId: user.telegramId },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      items: rows.map((item) => ({
        id: item.id,
        slug: item.slug,
        slugPrice: item.slugPrice,
        requestedPlan: item.requestedPlan,
        bracelet: item.bracelet,
        status: item.status,
        statusBadge: toRequestStatusBadge(item.status),
        adminNote: item.adminNote,
        createdAt: item.createdAt,
      })),
    });
  }),
);

router.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    const displayName = normalizeDisplayName(req.body.displayName, user.firstName);
    const notificationsEnabled = Boolean(req.body.notificationsEnabled);

    const updated = await prisma.user.update({
      where: { telegramId: user.telegramId },
      data: {
        displayName,
        notificationsEnabled,
      },
    });

    res.json({
      ok: true,
      user: {
        displayName: updated.displayName,
        notificationsEnabled: updated.notificationsEnabled,
      },
    });
  }),
);

router.post(
  "/deactivate",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { telegramId: user.telegramId },
        data: { status: "deactivated" },
      }),
      prisma.slug.updateMany({
        where: { ownerTelegramId: user.telegramId },
        data: { status: "paused" },
      }),
    ]);

    res.json({ ok: true });
  }),
);

module.exports = {
  profileApiRouter: router,
};

