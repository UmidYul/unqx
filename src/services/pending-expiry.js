const { prisma } = require("../db/prisma");
const { sendSlugExpiredToUser } = require("./telegram");

const ONE_HOUR_MS = 60 * 60 * 1000;

let started = false;
let timer = null;

function isSchemaNotReady(error) {
  return Boolean(error) && (error.code === "P2021" || error.code === "P2022");
}

async function processPendingSlugExpirations() {
  const now = new Date();
  const expiredSlugs = await prisma.slug.findMany({
    where: {
      status: "pending",
      pendingExpiresAt: {
        lt: now,
      },
    },
    select: {
      fullSlug: true,
    },
  });

  if (!expiredSlugs.length) {
    return { slugs: 0, orders: 0 };
  }

  let expiredOrdersCount = 0;
  const notifications = [];

  await prisma.$transaction(async (tx) => {
    for (const slugRow of expiredSlugs) {
      const pendingOrders = await tx.slugRequest.findMany({
        where: {
          slug: slugRow.fullSlug,
          status: { in: ["new", "contacted", "paid"] },
        },
        select: {
          id: true,
          telegramId: true,
          createdAt: true,
        },
      });

      if (pendingOrders.length > 0) {
        await tx.slugRequest.updateMany({
          where: {
            id: { in: pendingOrders.map((item) => item.id) },
          },
          data: {
            status: "expired",
            adminNote: "Истекло автоматически через 24 часа ожидания",
          },
        });

        await tx.orderRequest.updateMany({
          where: {
            slug: slugRow.fullSlug,
            status: { in: ["NEW", "CONTACTED", "PAID"] },
          },
          data: {
            status: "REJECTED",
          },
        });
      }

      await tx.slug.update({
        where: { fullSlug: slugRow.fullSlug },
        data: {
          status: "free",
          ownerTelegramId: null,
          isPrimary: false,
          pendingExpiresAt: null,
          requestedAt: null,
          approvedAt: null,
          activatedAt: null,
          pauseMessage: null,
        },
      });

      expiredOrdersCount += pendingOrders.length;

      const latestOrder = pendingOrders
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (latestOrder && latestOrder.telegramId) {
        notifications.push({
          telegramId: latestOrder.telegramId,
          slug: slugRow.fullSlug,
        });
      }
    }
  });

  for (const item of notifications) {
    try {
      await sendSlugExpiredToUser({
        telegramId: item.telegramId,
        slug: item.slug,
      });
    } catch (error) {
      console.error("[express-app] failed to send expiration notification", error);
    }
  }

  return {
    slugs: expiredSlugs.length,
    orders: expiredOrdersCount,
  };
}

function startPendingExpiryJob() {
  if (started) {
    return;
  }
  started = true;

  const run = async () => {
    try {
      const result = await processPendingSlugExpirations();
      if (result.orders > 0) {
        console.log(`[express-app] pending expiry job: expired ${result.orders} orders across ${result.slugs} slugs`);
      }
    } catch (error) {
      if (isSchemaNotReady(error)) {
        console.warn("[express-app] skip pending expiry job: schema not migrated yet");
        return;
      }
      console.error("[express-app] pending expiry job failed", error);
    }
  };

  void run();
  timer = setInterval(() => {
    void run();
  }, ONE_HOUR_MS);
}

function stopPendingExpiryJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}

module.exports = {
  processPendingSlugExpirations,
  startPendingExpiryJob,
  stopPendingExpiryJob,
};
