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
  canCreateCard,
  canAccessAnalytics,
  normalizeThemeByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  getPlanBadgeLabel,
} = require("../../services/profile");
const { isSupportedAvatarBuffer, saveAvatarFromBuffer, deleteAvatarByPublicPath } = require("../../services/avatar");
const { getProfileScoreByUserId, recalculateAndRefreshPercentiles } = require("../../services/unq-score");
const { getPricingSettings } = require("../../services/pricing-settings");
const { sendVerificationRequestToAdmin } = require("../../services/telegram");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const CARD_THEMES = new Set(["default_dark", "arctic", "linen", "marble", "forest"]);
const DIRECTORY_SECTORS = new Set(["design", "sales", "marketing", "it", "other"]);

function toSlugStatusLabel(status) {
  switch (status) {
    case "active":
      return "Активен";
    case "paused":
      return "Пауза";
    case "private":
      return "Приватный";
    case "approved":
      return "Одобрен";
    case "pending":
    case "reserved":
      return "В ожидании";
    case "blocked":
      return "Заблокирован";
    case "free":
      return "Свободен";
    default:
      return status;
  }
}

function toRequestStatusBadge(status) {
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

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeAnalyticsPeriod(value, isPremium) {
  const parsed = Number(value);
  if (parsed === 7) return 7;
  if (isPremium && (parsed === 30 || parsed === 90)) return parsed;
  return 7;
}

function normalizeDirectorySector(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return DIRECTORY_SECTORS.has(normalized) ? normalized : "other";
}

function parseProfileCardRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    role: row.role || "",
    bio: row.bio || "",
    email: row.email || "",
    avatarUrl: row.avatarUrl || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    buttons: Array.isArray(row.buttons) ? row.buttons : [],
    theme: typeof row.theme === "string" && CARD_THEMES.has(row.theme) ? row.theme : "default_dark",
    customColor: row.customColor || "",
    showBranding: Boolean(row.showBranding),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getCurrentUser(req) {
  const sessionUser = getUserSession(req);
  if (!sessionUser?.userId) {
    return null;
  }
  const row = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      emailVerified: true,
      firstName: true,
      lastName: true,
      username: true,
      telegramUsername: true,
      telegramChatId: true,
      displayName: true,
      plan: true,
      notificationsEnabled: true,
      status: true,
      isVerified: true,
      verifiedCompany: true,
      verifiedAt: true,
      showInDirectory: true,
      directorySector: true,
      welcomeDismissed: true,
      planPurchasedAt: true,
      planUpgradedAt: true,
    },
  });
  if (!row) return null;
  return {
    ...row,
    username: row.username || row.telegramUsername || null,
  };
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

function assertPlanAllowsCard(user, res) {
  if (!canCreateCard(user)) {
    res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
    return false;
  }
  return true;
}

function assertPlanAllowsSlugManagement(user, res) {
  const plan = getEffectivePlan(user).plan;
  if (plan === "none") {
    res.status(403).json({ error: "Тариф не активирован", code: "PLAN_REQUIRED" });
    return false;
  }
  return true;
}

async function safeRecalculateScore(userId) {
  try {
    await recalculateAndRefreshPercentiles(userId);
  } catch (error) {
    console.error("[express-app] failed to recalculate score", error);
  }
}

async function getUserSlugsWithStats(userId) {
  const slugs = await prisma.slug.findMany({
    where: { ownerId: userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  const fullSlugs = slugs.map((item) => item.fullSlug);

  let viewsBySlug = new Map();
  if (fullSlugs.length > 0 && prisma.analyticsView) {
    const rows = await prisma.analyticsView.findMany({
      where: {
        slug: { in: fullSlugs },
      },
      select: {
        slug: true,
        visitedAt: true,
        sessionId: true,
      },
    });
    const bucket = new Map();
    for (const row of rows) {
      const key = row.slug;
      const current = bucket.get(key) || { since: row.visitedAt, sessions: new Set() };
      if (!current.since || row.visitedAt < current.since) {
        current.since = row.visitedAt;
      }
      current.sessions.add(row.sessionId);
      bucket.set(key, current);
    }
    viewsBySlug = new Map(
      Array.from(bucket.entries()).map(([slug, value]) => [
        slug,
        {
          views: value.sessions.size,
          since: value.since || null,
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

    const [slugs, card, requests, score, pricing] = await Promise.all([
      getUserSlugsWithStats(user.id),
      prisma.profileCard.findUnique({ where: { ownerId: user.id } }),
      prisma.slugRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      getProfileScoreByUserId(user.id),
      getPricingSettings(),
    ]);

    const effective = getEffectivePlan(user);

    res.json({
      user: {
        id: user.id,
        email: user.email || "",
        pendingEmail: user.pendingEmail || "",
        emailVerified: Boolean(user.emailVerified),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        displayName: normalizeDisplayName(user.displayName, user.firstName),
        plan: user.plan,
        effectivePlan: effective.plan,
        planPurchasedAt: user.planPurchasedAt,
        planUpgradedAt: user.planUpgradedAt,
        welcomeDismissed: Boolean(user.welcomeDismissed),
        planBadge: getPlanBadgeLabel(effective.plan),
        notificationsEnabled: Boolean(user.notificationsEnabled),
        status: user.status,
        isVerified: Boolean(user.isVerified),
        verifiedCompany: user.verifiedCompany || "",
        verifiedAt: user.verifiedAt || null,
        showInDirectory: typeof user.showInDirectory === "boolean" ? user.showInDirectory : true,
        directorySector: normalizeDirectorySector(user.directorySector),
      },
      limits: {
        slugs: getSlugLimit(effective.plan),
        tags: getTagLimit(effective.plan),
        buttons: getButtonLimit(effective.plan),
      },
      slugs: effective.plan === "none" ? [] : slugs,
      card: effective.plan === "none" ? null : parseProfileCardRow(card),
      requests: requests.map((item) => ({
        id: item.id,
        slug: item.slug,
        slugPrice: item.slugPrice,
        requestedPlan: item.requestedPlan,
        planPrice: item.planPrice,
        bracelet: item.bracelet,
        status: item.status,
        statusBadge: toRequestStatusBadge(item.status),
        adminNote: item.adminNote,
        purchasedAt: item.status === "approved" ? item.updatedAt : null,
        createdAt: item.createdAt,
      })),
      score,
      pricing,
      access: {
        canCreateCard: canCreateCard(user),
        canAccessAnalytics: canAccessAnalytics(user),
      },
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
    if (getEffectivePlan(user).plan === "none") {
      res.json({ items: [] });
      return;
    }

    const slugs = await getUserSlugsWithStats(user.id);
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
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const nextStatus = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "paused", "private"].includes(nextStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const updated = await prisma.slug.update({
      where: { fullSlug },
      data: { status: nextStatus },
    });
    await safeRecalculateScore(user.id);

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
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
    });
    if (!existing) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    await prisma.$transaction([
      prisma.slug.updateMany({
        where: { ownerId: user.id },
        data: { isPrimary: false },
      }),
      prisma.slug.update({
        where: { fullSlug },
        data: { isPrimary: true },
      }),
    ]);
    await safeRecalculateScore(user.id);

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
    if (!assertPlanAllowsSlugManagement(user, res)) {
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const message = String(req.body.message || "").trim().slice(0, 220);
    const existing = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
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
    if (!canCreateCard(user)) {
      res.json({ card: null });
      return;
    }
    const row = await prisma.profileCard.findUnique({
      where: { ownerId: user.id },
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
    if (!assertPlanAllowsCard(user, res)) {
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
    const email = String(body.email || "").trim().slice(0, 100) || null;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

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
        where: { ownerId: user.id },
        create: {
          ownerId: user.id,
          name,
          role,
          bio,
          email,
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
          email,
          tags,
          buttons,
          theme,
          customColor,
          showBranding,
        },
      });

      await tx.slug.updateMany({
        where: {
          ownerId: user.id,
          status: "approved",
        },
        data: {
          status: "active",
          activatedAt: new Date(),
        },
      });

      return cardRow;
    });
    await safeRecalculateScore(user.id);

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
    if (!assertPlanAllowsCard(user, res)) {
      return;
    }

    const card = await prisma.profileCard.findUnique({
      where: { ownerId: user.id },
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

    const avatarUrl = await saveAvatarFromBuffer(`profile_${String(user.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`, req.file.buffer);
    if (card.avatarUrl && card.avatarUrl !== avatarUrl) {
      await deleteAvatarByPublicPath(card.avatarUrl);
    }

    await prisma.profileCard.update({
      where: { ownerId: user.id },
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
    if (!assertPlanAllowsCard(user, res)) {
      return;
    }

    const card = await prisma.profileCard.findUnique({
      where: { ownerId: user.id },
    });
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    if (card.avatarUrl) {
      await deleteAvatarByPublicPath(card.avatarUrl);
    }
    await prisma.profileCard.update({
      where: { ownerId: user.id },
      data: { avatarUrl: null },
    });

    res.json({ ok: true, avatarUrl: null });
  }),
);

router.get(
  "/slugs/:slug/qr",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    if (getEffectivePlan(user).plan !== "premium") {
      res.status(403).json({ error: "Upgrade required", code: "UPGRADE_REQUIRED" });
      return;
    }

    const fullSlug = sanitizeSlug(req.params.slug);
    const slugRow = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
      select: {
        fullSlug: true,
        status: true,
        ownerId: true,
        owner: {
          select: {
            firstName: true,
            displayName: true,
            profileCard: { select: { name: true, role: true } },
          },
        },
      },
    });
    if (!slugRow) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const score = await getProfileScoreByUserId(user.id);
    const ownerName = slugRow.owner?.profileCard?.name || slugRow.owner?.displayName || slugRow.owner?.firstName || "UNQX User";
    const ownerRole = slugRow.owner?.profileCard?.role || "";
    res.json({
      slug: slugRow.fullSlug,
      url: `https://unqx.uz/${slugRow.fullSlug}`,
      ownerName,
      ownerRole,
      score: Number(score?.score || 0),
      isAvailableForPublicQr: ["active", "private"].includes(slugRow.status),
    });
  }),
);

router.get(
  "/analytics/bootstrap",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    const slugs = await prisma.slug.findMany({
      where: { ownerId: user.id, status: { in: ["active", "private", "paused", "approved"] } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { fullSlug: true, isPrimary: true, status: true },
    });
    const effectivePlan = getEffectivePlan(user).plan;
    const selectedSlug = slugs.find((item) => item.isPrimary)?.fullSlug || slugs[0]?.fullSlug || null;
    res.json({
      slugs,
      currentPlan: effectivePlan,
      selectedSlug,
      periods: effectivePlan === "premium" ? [7, 30, 90] : [7],
    });
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    const fullSlug = sanitizeSlug(req.query.slug);
    if (!fullSlug) {
      res.status(400).json({ error: "Slug is required" });
      return;
    }
    const owned = await prisma.slug.findFirst({
      where: { fullSlug, ownerId: user.id },
      select: { fullSlug: true },
    });
    if (!owned) {
      res.status(404).json({ error: "UNQ not found" });
      return;
    }

    const effectivePlan = getEffectivePlan(user).plan;
    const period = normalizeAnalyticsPeriod(req.query.period, effectivePlan === "premium");
    const now = new Date();
    const from = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousFrom = new Date(from.getTime() - period * 24 * 60 * 60 * 1000);

    const [views, prevViews, clicks, prevClicks, score] = await Promise.all([
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { slug: fullSlug, visitedAt: { gte: from } } })
        : Promise.resolve([]),
      prisma.analyticsView
        ? prisma.analyticsView.findMany({ where: { slug: fullSlug, visitedAt: { gte: previousFrom, lt: from } } })
        : Promise.resolve([]),
      prisma.analyticsClick
        ? prisma.analyticsClick.findMany({ where: { slug: fullSlug, clickedAt: { gte: from } } })
        : Promise.resolve([]),
      prisma.analyticsClick
        ? prisma.analyticsClick.findMany({ where: { slug: fullSlug, clickedAt: { gte: previousFrom, lt: from } } })
        : Promise.resolve([]),
      getProfileScoreByUserId(user.id),
    ]);

    const uniqueVisitors = new Set(views.map((item) => item.sessionId)).size;
    const prevUniqueVisitors = new Set(prevViews.map((item) => item.sessionId)).size;
    const ctr = views.length ? Number(((clicks.length / views.length) * 100).toFixed(1)) : 0;
    const prevCtr = prevViews.length ? Number(((prevClicks.length / prevViews.length) * 100).toFixed(1)) : 0;
    const byDay = new Map();
    views.forEach((item) => {
      const key = item.visitedAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + 1);
    });

    const bySource = {};
    views.forEach((item) => {
      const key = String(item.source || "direct");
      bySource[key] = (bySource[key] || 0) + 1;
    });
    const byCity = {};
    views.forEach((item) => {
      const key = String(item.city || "Неизвестно");
      byCity[key] = (byCity[key] || 0) + 1;
    });
    const byDevice = {};
    views.forEach((item) => {
      const key = String(item.device || "desktop");
      byDevice[key] = (byDevice[key] || 0) + 1;
    });
    const byButton = {};
    clicks.forEach((item) => {
      const key = String(item.buttonType || "other");
      byButton[key] = (byButton[key] || 0) + 1;
    });
    const byHour = {};
    views.forEach((item) => {
      const d = new Date(item.visitedAt);
      const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
      byHour[key] = (byHour[key] || 0) + 1;
    });

    res.json({
      slug: fullSlug,
      period,
      kpi: {
        views: views.length,
        uniqueVisitors,
        clicks: clicks.length,
        ctr,
        trends: {
          views: views.length - prevViews.length,
          uniqueVisitors: uniqueVisitors - prevUniqueVisitors,
          clicks: clicks.length - prevClicks.length,
          ctr: Number((ctr - prevCtr).toFixed(1)),
        },
      },
      chart: {
        viewsByDay: Array.from(byDay.entries()).map(([date, value]) => ({ date, value })),
        trafficSources: bySource,
        geography: byCity,
        devices: byDevice,
        buttonActivity: byButton,
        peakHours: byHour,
      },
      score,
      flags: {
        isPremium: effectivePlan === "premium",
        lockedPeriods: effectivePlan === "premium" ? [] : [30, 90],
      },
    });
  }),
);

router.get(
  "/verification",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    const latest = prisma.verificationRequest
      ? await prisma.verificationRequest.findFirst({
        where: { userId: user.id },
        orderBy: { requestedAt: "desc" },
      })
      : null;
    res.json({
      isVerified: Boolean(user.isVerified),
      latestRequest: latest,
    });
  }),
);

router.post(
  "/verification-request",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) return;
    if (!prisma.verificationRequest) {
      res.status(503).json({ error: "Verification storage unavailable" });
      return;
    }

    const companyName = String(req.body?.companyName || "").trim().slice(0, 160);
    const role = String(req.body?.role || "").trim().slice(0, 160);
    const sector = normalizeDirectorySector(req.body?.sector);
    const proofType = String(req.body?.proofType || "").trim().toLowerCase();
    const proofValue = String(req.body?.proofValue || "").trim().slice(0, 320);
    const comment = String(req.body?.comment || "").trim().slice(0, 1000);
    if (!companyName || !role || !["email", "linkedin", "website"].includes(proofType) || !proofValue) {
      res.status(400).json({ error: "Invalid request payload" });
      return;
    }

    const primarySlug = await prisma.slug.findFirst({
      where: {
        ownerId: user.id,
        status: { in: ["active", "private", "paused", "approved"] },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { fullSlug: true },
    });
    const verificationSlug = primarySlug?.fullSlug || "PROFILE";

    const request = await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        slug: verificationSlug,
        companyName,
        role,
        sector,
        proofType,
        proofValue,
        comment: comment || null,
      },
    });

    void sendVerificationRequestToAdmin({
      telegramId: user.telegramChatId || "",
      slug: verificationSlug,
      companyName,
      role,
      sector,
      proofType,
      proofValue,
      comment,
    }).catch((error) => {
      console.error("[express-app] failed to send verification request to telegram", error);
    });

    res.status(201).json({ ok: true, request });
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
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      items: rows.map((item) => ({
        id: item.id,
        slug: item.slug,
        slugPrice: item.slugPrice,
        requestedPlan: item.requestedPlan,
        planPrice: item.planPrice,
        bracelet: item.bracelet,
        status: item.status,
        statusBadge: toRequestStatusBadge(item.status),
        adminNote: item.adminNote,
        purchasedAt: item.status === "approved" ? item.updatedAt : null,
        createdAt: item.createdAt,
      })),
    });
  }),
);

router.patch(
  "/welcome-dismiss",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeDismissed: true },
    });

    res.json({ ok: true, welcomeDismissed: true });
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
    const showInDirectory =
      typeof req.body.showInDirectory === "boolean" ? req.body.showInDirectory : Boolean(user.showInDirectory);
    const telegramUsername = String(req.body.telegramUsername || "")
      .replace(/^@+/, "")
      .trim()
      .slice(0, 120);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        telegramUsername: telegramUsername || null,
        notificationsEnabled,
        showInDirectory,
      },
    });

    res.json({
      ok: true,
      user: {
        displayName: updated.displayName,
        notificationsEnabled: updated.notificationsEnabled,
        showInDirectory: updated.showInDirectory,
      },
    });
  }),
);

router.post(
  "/telegram/link/start",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    res.status(410).json({
      error: "Telegram linking flow is deprecated",
      code: "TELEGRAM_LINK_DEPRECATED",
    });
  }),
);

router.post(
  "/telegram/link/unlink",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    if (!assertUserActive(user, res)) {
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: null,
      },
    });
    res.json({ ok: true });
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
        where: { id: user.id },
        data: { status: "deactivated" },
      }),
      prisma.slug.updateMany({
        where: { ownerId: user.id },
        data: { status: "paused" },
      }),
    ]);
    await safeRecalculateScore(user.id);

    res.json({ ok: true });
  }),
);

module.exports = {
  profileApiRouter: router,
};
