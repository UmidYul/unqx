const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { requireAdminApi } = require("../../middleware/auth");
const { adminApiRateLimit } = require("../../middleware/rate-limit");
const { buildLeaderboard, normalizePeriod } = require("../../services/leaderboard");
const { getFeatureSetting, setFeatureSetting } = require("../../services/feature-settings");
const { buildDropSlugPool, reserveDropSlugs, getDropLiveStats, releaseUnsoldDropSlugs } = require("../../services/drops");
const { sendTelegramMessage } = require("../../services/telegram");

const router = express.Router();

router.use(adminApiRateLimit);
router.use(requireAdminApi);

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const board = await buildLeaderboard(normalizePeriod(req.query.period));
    res.json({
      period: board.period,
      settings: board.settings,
      items: board.items,
    });
  }),
);

router.patch(
  "/leaderboard/settings",
  asyncHandler(async (req, res) => {
    const current = await getFeatureSetting("leaderboard");
    const next = await setFeatureSetting("leaderboard", {
      ...current,
      enabled: req.body.enabled === undefined ? current.enabled : Boolean(req.body.enabled),
      publicLimit: Number(req.body.publicLimit || current.publicLimit || 20),
      suspiciousThreshold: Number(req.body.suspiciousThreshold || current.suspiciousThreshold || 50),
      suspiciousWindowMinutes: Number(req.body.suspiciousWindowMinutes || current.suspiciousWindowMinutes || 10),
    });
    res.json({ ok: true, settings: next });
  }),
);

router.patch(
  "/leaderboard/exclusions/:slug",
  asyncHandler(async (req, res) => {
    const fullSlug = String(req.params.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const excluded = Boolean(req.body.excluded);
    if (excluded) {
      await prisma.leaderboardExclusion.upsert({
        where: { fullSlug },
        create: {
          fullSlug,
          reason: String(req.body.reason || "").trim() || null,
          excludedBy: req.session?.admin?.login || "admin",
        },
        update: {
          reason: String(req.body.reason || "").trim() || null,
          excludedBy: req.session?.admin?.login || "admin",
        },
      });
    } else {
      await prisma.leaderboardExclusion.deleteMany({ where: { fullSlug } });
    }
    res.json({ ok: true });
  }),
);

router.post(
  "/leaderboard/reset-user/:telegramId",
  asyncHandler(async (req, res) => {
    const telegramId = String(req.params.telegramId || "");
    const slugs = await prisma.slug.findMany({
      where: { ownerTelegramId: telegramId },
      select: { fullSlug: true },
    });
    const targets = slugs.map((row) => row.fullSlug);
    if (targets.length) {
      await prisma.slugView.deleteMany({ where: { fullSlug: { in: targets } } });
    }
    res.json({ ok: true, removed: targets.length });
  }),
);

router.get(
  "/leaderboard/suspicious",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.leaderboardSuspiciousLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    res.json({ items: rows });
  }),
);

router.get(
  "/referrals/stats",
  asyncHandler(async (_req, res) => {
    const [total, paid, rewarded] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: { in: ["paid", "rewarded"] } } }),
      prisma.referral.count({ where: { status: "rewarded" } }),
    ]);
    res.json({
      totalRegistrations: total,
      conversionPaid: total > 0 ? Number(((paid / total) * 100).toFixed(2)) : 0,
      rewarded,
    });
  }),
);

router.get(
  "/referrals",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.referral.findMany({
      include: {
        referrer: { select: { telegramId: true, username: true, firstName: true } },
        referred: { select: { telegramId: true, username: true, firstName: true } },
        rewardedRule: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ items: rows });
  }),
);

router.patch(
  "/referrals/:id/status",
  asyncHandler(async (req, res) => {
    const status = String(req.body.status || "");
    if (!["registered", "paid", "rewarded"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const updated = await prisma.referral.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === "rewarded" ? { rewardedAt: new Date() } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.post(
  "/referrals/:id/reward",
  asyncHandler(async (req, res) => {
    const rewardType = String(req.body.rewardType || "discount");
    const updated = await prisma.referral.update({
      where: { id: req.params.id },
      data: {
        status: "rewarded",
        rewardType,
        rewardedAt: new Date(),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.patch(
  "/referrals/settings",
  asyncHandler(async (req, res) => {
    const current = await getFeatureSetting("referrals");
    const next = await setFeatureSetting("referrals", {
      ...current,
      enabled: req.body.enabled === undefined ? current.enabled : Boolean(req.body.enabled),
      requirePaid: req.body.requirePaid === undefined ? current.requirePaid : Boolean(req.body.requirePaid),
    });
    res.json({ ok: true, settings: next });
  }),
);

router.get(
  "/referrals/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getFeatureSetting("referrals");
    res.json({ settings });
  }),
);

router.patch(
  "/referrals/rules",
  asyncHandler(async (req, res) => {
    const rules = Array.isArray(req.body.rules) ? req.body.rules : [];
    const normalized = rules
      .map((item) => ({
        requiredPaidFriends: Number(item.requiredPaidFriends || 0),
        rewardType: String(item.rewardType || "discount"),
        rewardValue: item.rewardValue == null ? null : Number(item.rewardValue),
      }))
      .filter((item) => item.requiredPaidFriends > 0);

    await prisma.$transaction(async (tx) => {
      await tx.referralRewardRule.updateMany({ data: { isActive: false } });
      for (const item of normalized) {
        await tx.referralRewardRule.upsert({
          where: { requiredPaidFriends: item.requiredPaidFriends },
          create: { ...item, isActive: true },
          update: { ...item, isActive: true },
        });
      }
    });

    const updated = await prisma.referralRewardRule.findMany({
      where: { isActive: true },
      orderBy: { requiredPaidFriends: "asc" },
    });
    res.json({ ok: true, rules: updated });
  }),
);

router.get(
  "/flash-sales",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.flashSale.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ items: rows });
  }),
);

router.post(
  "/flash-sales",
  asyncHandler(async (req, res) => {
    const created = await prisma.flashSale.create({
      data: {
        title: String(req.body.title || "Flash sale").trim(),
        description: String(req.body.description || "").trim() || null,
        discountPercent: Number(req.body.discountPercent || 0),
        conditionType: String(req.body.conditionType || "all"),
        conditionValue: req.body.conditionValue && typeof req.body.conditionValue === "object" ? req.body.conditionValue : null,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
        isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
        notifyTelegram: Boolean(req.body.notifyTelegram),
        telegramTarget: String(req.body.telegramTarget || "").trim() || null,
        createdByAdmin: req.session?.admin?.login || "admin",
      },
    });
    res.status(201).json({ ok: true, item: created });
  }),
);

router.patch(
  "/flash-sales/:id",
  asyncHandler(async (req, res) => {
    const updated = await prisma.flashSale.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title || "") } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || "") || null } : {}),
        ...(req.body.discountPercent !== undefined ? { discountPercent: Number(req.body.discountPercent || 0) } : {}),
        ...(req.body.conditionType !== undefined ? { conditionType: String(req.body.conditionType || "all") } : {}),
        ...(req.body.conditionValue !== undefined ? { conditionValue: req.body.conditionValue || null } : {}),
        ...(req.body.startsAt !== undefined ? { startsAt: new Date(req.body.startsAt) } : {}),
        ...(req.body.endsAt !== undefined ? { endsAt: new Date(req.body.endsAt) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
        ...(req.body.notifyTelegram !== undefined ? { notifyTelegram: Boolean(req.body.notifyTelegram) } : {}),
        ...(req.body.telegramTarget !== undefined ? { telegramTarget: String(req.body.telegramTarget || "") || null } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.post(
  "/flash-sales/:id/stop",
  asyncHandler(async (req, res) => {
    const updated = await prisma.flashSale.update({
      where: { id: req.params.id },
      data: { isActive: false, endsAt: new Date() },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.get(
  "/flash-sales/:id/stats",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [requests, sale] = await Promise.all([
      prisma.slugRequest.findMany({ where: { flashSaleId: id } }),
      prisma.flashSale.findUnique({ where: { id } }),
    ]);
    if (!sale) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const discountSum = requests.reduce((sum, row) => sum + Number(row.flashDiscountAmount || 0), 0);
    res.json({
      requestsCount: requests.length,
      discountSum,
    });
  }),
);

router.get(
  "/drops",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.drop.findMany({
      orderBy: { dropAt: "desc" },
      take: 200,
    });
    res.json({ items: rows });
  }),
);

router.post(
  "/drops",
  asyncHandler(async (req, res) => {
    const slugPatternType = String(req.body.slugPatternType || "random");
    const slugCount = Number(req.body.slugCount || 1);
    const manualList = String(req.body.manualSlugs || "")
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const pool = buildDropSlugPool({
      slugPatternType,
      slugCount,
      manualList,
    });

    const created = await prisma.drop.create({
      data: {
        title: String(req.body.title || "Drop").trim(),
        description: String(req.body.description || "").trim() || null,
        dropAt: new Date(req.body.dropAt),
        slugCount: pool.length,
        slugPatternType,
        slugsPool: pool,
        notifyTelegram: Boolean(req.body.notifyTelegram),
        telegramTarget: String(req.body.telegramTarget || "").trim() || null,
      },
    });

    await reserveDropSlugs(pool);

    if (created.notifyTelegram && created.telegramTarget) {
      try {
        await sendTelegramMessage({
          chatId: created.telegramTarget,
          text: `🔥 Новый дроп: ${created.title}\nДата: ${created.dropAt.toLocaleString("ru-RU")}\nunqx.uz/drops`,
          parseMode: "HTML",
        });
        await prisma.drop.update({ where: { id: created.id }, data: { isAnnounced: true } });
      } catch (error) {
        console.error("[express-app] failed to announce drop", error);
      }
    }

    res.status(201).json({ ok: true, item: created, pool });
  }),
);

router.patch(
  "/drops/:id",
  asyncHandler(async (req, res) => {
    const updated = await prisma.drop.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title || "") } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || "") || null } : {}),
        ...(req.body.dropAt !== undefined ? { dropAt: new Date(req.body.dropAt) } : {}),
        ...(req.body.notifyTelegram !== undefined ? { notifyTelegram: Boolean(req.body.notifyTelegram) } : {}),
        ...(req.body.telegramTarget !== undefined ? { telegramTarget: String(req.body.telegramTarget || "") || null } : {}),
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

router.patch(
  "/drops/:id/slugs",
  asyncHandler(async (req, res) => {
    const pool = Array.from(
      new Set(
        (Array.isArray(req.body.slugs) ? req.body.slugs : [])
          .map((item) => String(item || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
          .filter((item) => /^[A-Z]{3}[0-9]{3}$/.test(item)),
      ),
    );

    const updated = await prisma.drop.update({
      where: { id: req.params.id },
      data: {
        slugsPool: pool,
        slugCount: pool.length,
      },
    });
    await reserveDropSlugs(pool);
    res.json({ ok: true, item: updated });
  }),
);

router.post(
  "/drops/:id/finish",
  asyncHandler(async (req, res) => {
    const updated = await prisma.drop.update({
      where: { id: req.params.id },
      data: {
        isLive: false,
        isFinished: true,
      },
    });
    await releaseUnsoldDropSlugs(updated.id);
    res.json({ ok: true, item: updated });
  }),
);

router.get(
  "/drops/:id/live",
  asyncHandler(async (req, res) => {
    const stats = await getDropLiveStats(req.params.id);
    if (!stats) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const buyers = await prisma.slugRequest.findMany({
      where: { dropId: req.params.id, status: { in: ["paid", "approved"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { telegramId: true, slug: true, createdAt: true },
    });
    res.json({ ...stats, buyers });
  }),
);

router.get(
  "/drops/:id/waitlist",
  asyncHandler(async (req, res) => {
    const items = await prisma.dropWaitlist.findMany({
      where: { dropId: req.params.id },
      include: { user: { select: { telegramId: true, username: true, firstName: true } } },
      orderBy: { joinedAt: "desc" },
    });
    res.json({ items });
  }),
);

router.post(
  "/drops/:id/notify-manual",
  asyncHandler(async (req, res) => {
    const drop = await prisma.drop.findUnique({ where: { id: req.params.id } });
    if (!drop) {
      res.status(404).json({ error: "Drop not found" });
      return;
    }

    const waitlist = await prisma.dropWaitlist.findMany({ where: { dropId: drop.id } });
    for (const row of waitlist) {
      try {
        await sendTelegramMessage({
          chatId: row.telegramId,
          text: `🔔 Напоминание о дропе: ${drop.title}\nunqx.uz/drops`,
          parseMode: "HTML",
        });
        await prisma.dropWaitlist.update({ where: { id: row.id }, data: { notifiedAt: new Date() } });
      } catch (error) {
        console.error("[express-app] manual drop notify failed", error);
      }
    }

    res.json({ ok: true, sent: waitlist.length });
  }),
);

module.exports = {
  adminFeaturesApiRouter: router,
};
