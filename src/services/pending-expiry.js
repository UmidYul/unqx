const { prisma } = require("../db/prisma");
const { sendSlugExpiredToUser } = require("./telegram");
const { getSetting } = require("./platform-settings");
const { logPaymentEvent } = require("./payment-events");
const { getOrderPaymentReference } = require("./payment-flow");
const { getBraceletPrice } = require("./pricing-settings");

const ONE_HOUR_MS = 60 * 60 * 1000;

let started = false;
let timer = null;

function isSchemaNotReady(error) {
  return Boolean(error) && (error.code === "P2021" || error.code === "P2022");
}

async function processPendingSlugExpirations() {
  const pendingHours = Math.max(1, Math.min(168, Number(await getSetting("pending_expiry_hours", 24)) || 24));
  const braceletPrice = await getBraceletPrice();
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
  const expiredOrders = [];

  await prisma.$transaction(async (tx) => {
    for (const slugRow of expiredSlugs) {
      const pendingOrders = await tx.slugRequest.findMany({
        where: {
          slug: slugRow.fullSlug,
          status: { in: ["new", "contacted", "paid"] },
        },
        select: {
          id: true,
          userId: true,
          slug: true,
          slugPrice: true,
          planPrice: true,
          bracelet: true,
          createdAt: true,
          user: {
            select: {
              telegramChatId: true,
            },
          },
        },
      });

      if (pendingOrders.length > 0) {
        await tx.slugRequest.updateMany({
          where: {
            id: { in: pendingOrders.map((item) => item.id) },
          },
          data: {
            status: "expired",
            adminNote: `Истекло автоматически через ${pendingHours} часа ожидания`,
          },
        });
      }

      await tx.slug.update({
        where: { fullSlug: slugRow.fullSlug },
        data: {
          status: "free",
          ownerId: null,
          isPrimary: false,
          pendingExpiresAt: null,
          requestedAt: null,
          approvedAt: null,
          activatedAt: null,
          pauseMessage: null,
        },
      });

      expiredOrdersCount += pendingOrders.length;
      expiredOrders.push(...pendingOrders);

      pendingOrders.forEach((orderItem) => {
        if (!orderItem?.user?.telegramChatId) {
          return;
        }
        notifications.push({
          telegramId: orderItem.user.telegramChatId,
          slug: slugRow.fullSlug,
          orderId: orderItem.id,
        });
      });
    }
  });

  for (const orderItem of expiredOrders) {
    try {
      const amount = Number(orderItem.slugPrice || 0) + Number(orderItem.planPrice || 0) + (orderItem.bracelet ? Number(braceletPrice || 0) : 0);
      await logPaymentEvent({
        orderId: orderItem.id,
        userId: orderItem.userId,
        status: "expired",
        provider: "manual_tg",
        reference: getOrderPaymentReference(orderItem.id),
        amount,
        actor: "system:pending-expiry",
        source: "pending_expiry_job",
        note: `Order expired automatically after ${pendingHours}h`,
      });
    } catch (error) {
      console.error("[express-app] failed to log pending expiry event", error);
    }
  }

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
    notifications: notifications.length,
    events: expiredOrders.length,
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
        console.log(`[express-app] pending expiry job: expired ${result.orders} orders across ${result.slugs} slugs; events=${result.events || 0}; notifications=${result.notifications || 0}`);
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
