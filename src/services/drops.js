const { prisma } = require("../db/prisma");
const { sendTelegramMessage } = require("./telegram");

function normalizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function randomLetter() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function randomDigits() {
  return String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

function randomSlug() {
  return `${randomLetter()}${randomLetter()}${randomLetter()}${randomDigits()}`;
}

function buildSequentialSlug(baseLetters, index) {
  return `${baseLetters}${String(index + 1).padStart(3, "0")}`;
}

function buildDropSlugPool({ slugPatternType, slugCount, manualList }) {
  const count = Math.max(1, Math.min(500, Number(slugCount) || 1));
  if (slugPatternType === "manual") {
    return Array.from(new Set((manualList || []).map(normalizeSlug).filter((item) => /^[A-Z]{3}[0-9]{3}$/.test(item)))).slice(0, count);
  }

  if (slugPatternType === "sequential") {
    const baseLetters = "AAA";
    return Array.from({ length: count }, (_, index) => buildSequentialSlug(baseLetters, index));
  }

  const set = new Set();
  while (set.size < count) {
    set.add(randomSlug());
  }
  return Array.from(set);
}

async function reserveDropSlugs(pool) {
  if (!Array.isArray(pool) || !pool.length) return;
  const now = new Date();
  await prisma.$transaction(
    pool.map((slug) =>
      prisma.slug.upsert({
        where: { fullSlug: slug },
        create: {
          letters: slug.slice(0, 3),
          digits: slug.slice(3),
          fullSlug: slug,
          status: "reserved_drop",
          requestedAt: now,
        },
        update: {
          status: "reserved_drop",
          ownerTelegramId: null,
          isPrimary: false,
          pauseMessage: null,
          requestedAt: now,
          pendingExpiresAt: null,
          approvedAt: null,
          activatedAt: null,
        },
      }),
    ),
  );
}

async function getDropLiveStats(dropId) {
  const drop = await prisma.drop.findUnique({ where: { id: dropId } });
  if (!drop) return null;
  const pool = Array.isArray(drop.slugsPool) ? drop.slugsPool : [];
  const sold = Array.isArray(drop.soldSlugs) ? drop.soldSlugs : [];
  const waitlistCount = await prisma.dropWaitlist.count({ where: { dropId } });
  return {
    id: drop.id,
    title: drop.title,
    dropAt: drop.dropAt,
    isLive: drop.isLive,
    isSoldOut: drop.isSoldOut,
    isFinished: drop.isFinished,
    total: pool.length,
    sold: sold.length,
    remaining: Math.max(0, pool.length - sold.length),
    waitlistCount,
    slugsPool: pool,
    soldSlugs: sold,
  };
}

async function markDropSlugSold({ dropId, slug }) {
  const drop = await prisma.drop.findUnique({ where: { id: dropId } });
  if (!drop) return null;
  const pool = Array.isArray(drop.slugsPool) ? drop.slugsPool : [];
  const sold = Array.isArray(drop.soldSlugs) ? drop.soldSlugs : [];
  if (!pool.includes(slug) || sold.includes(slug)) {
    return drop;
  }
  const nextSold = [...sold, slug];
  const soldOut = nextSold.length >= pool.length;
  return prisma.drop.update({
    where: { id: dropId },
    data: {
      soldSlugs: nextSold,
      isSoldOut: soldOut,
      ...(soldOut ? { isLive: false, isFinished: true } : {}),
    },
  });
}

async function releaseUnsoldDropSlugs(dropId) {
  const drop = await prisma.drop.findUnique({ where: { id: dropId } });
  if (!drop) return;
  const pool = Array.isArray(drop.slugsPool) ? drop.slugsPool : [];
  const sold = new Set(Array.isArray(drop.soldSlugs) ? drop.soldSlugs : []);
  const freeSlugs = pool.filter((slug) => !sold.has(slug));
  if (!freeSlugs.length) return;
  await prisma.slug.updateMany({
    where: {
      fullSlug: { in: freeSlugs },
      status: "reserved_drop",
    },
    data: {
      status: "free",
      requestedAt: null,
    },
  });
}

async function sendDropMessageToWaitlist(drop, text, kind) {
  const waitlist = await prisma.dropWaitlist.findMany({ where: { dropId: drop.id } });
  for (const row of waitlist) {
    try {
      await sendTelegramMessage({ chatId: row.telegramId, text, parseMode: "HTML" });
      await prisma.dropWaitlist.update({
        where: { id: row.id },
        data:
          kind === "15m"
            ? { notified15mAt: new Date(), notifiedAt: new Date() }
            : { notifiedStartAt: new Date(), notifiedAt: new Date() },
      });
    } catch (error) {
      console.error("[express-app] failed to send drop waitlist message", error);
    }
  }
}

async function processDropsSchedule() {
  const now = new Date();
  const upcoming = await prisma.drop.findMany({
    where: {
      isFinished: false,
    },
    orderBy: { dropAt: "asc" },
  });

  for (const drop of upcoming) {
    if (!drop.notified15mAt && drop.dropAt.getTime() - now.getTime() <= 15 * 60 * 1000 && drop.dropAt > now) {
      await sendDropMessageToWaitlist(drop, `⏰ Через 15 минут стартует ${drop.title}! Успей занять slug: unqx.uz/drops`, "15m");
      await prisma.drop.update({ where: { id: drop.id }, data: { notified15mAt: new Date() } });
    }

    if (!drop.isLive && !drop.isFinished && drop.dropAt <= now) {
      await prisma.drop.update({ where: { id: drop.id }, data: { isLive: true } });
      await sendDropMessageToWaitlist(drop, `🔥 Дроп начался! Slug уже доступны: unqx.uz/drops`, "start");
      await prisma.drop.update({ where: { id: drop.id }, data: { notifiedStartAt: new Date() } });
    }

    const liveStats = await getDropLiveStats(drop.id);
    if (liveStats && liveStats.remaining <= 0 && !drop.isFinished) {
      await prisma.drop.update({ where: { id: drop.id }, data: { isLive: false, isFinished: true, isSoldOut: true } });
    }
  }
}

module.exports = {
  normalizeSlug,
  buildDropSlugPool,
  reserveDropSlugs,
  getDropLiveStats,
  markDropSlugSold,
  releaseUnsoldDropSlugs,
  processDropsSchedule,
};
