const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { sendTelegramMessage } = require("./telegram");
const { getActiveFlashSale, resolveConditionLabel } = require("./flash-sales");
const { processDropsSchedule } = require("./drops");
const { detectSuspiciousActivity } = require("./leaderboard");
const { markReferralPaidByReferredUserId } = require("./referrals");
const { ensureDailyRecalculation } = require("./unq-score");
const { reconcileAnalyticsViewCounters } = require("./analytics-reconciliation");
const {
  buildSubscriptionAutoRenewPatch,
  isSubscriptionAutoRenewEnabled,
} = require("./subscription");
const {
  sendAccountDeletedEmail,
  sendAccountReactivationReminderEmail,
} = require("./email");

const LOOP_MS = 60 * 1000;
const HOURLY_MS = 60 * 60 * 1000;

let started = false;
let timer = null;
let lastAnalyticsReconciliationAt = 0;

async function processFlashSalesSchedule() {
  const now = new Date();
  const active = await getActiveFlashSale();
  if (!active || active.startedNotificationSentAt || !active.notifyTelegram || !active.telegramTarget) {
    return;
  }

  if (active.startsAt > now || active.endsAt <= now) {
    return;
  }

  const untilLabel = active.endsAt.toLocaleString("ru-RU");
  const text = `⚡ FLASH SALE на UNQX\n${active.description || active.title}\nСкидка ${active.discountPercent}% на ${resolveConditionLabel(active)} · До ${untilLabel}\nunqx.uz`;

  try {
    await sendTelegramMessage({ chatId: active.telegramTarget, text, parseMode: "HTML" });
    await prisma.flashSale.update({
      where: { id: active.id },
      data: { startedNotificationSentAt: new Date() },
    });
  } catch (error) {
    console.error("[express-app] failed to send flash sale telegram notice", error);
  }
}

async function processReferralPaidSync() {
  const candidates = await prisma.slugRequest.findMany({
    where: {
      status: { in: ["paid", "approved"] },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const row of candidates) {
    try {
      await markReferralPaidByReferredUserId(row.userId);
    } catch (error) {
      console.error("[express-app] failed to sync referral paid status", error);
    }
  }
}

async function processExpiredSubscriptions() {
  const now = new Date();
  try {
    if (isSubscriptionAutoRenewEnabled()) {
      const renewableUsers = await prisma.user.findMany({
        where: {
          OR: [
            {
              plan: { in: ["basic", "premium"] },
              OR: [
                { subscriptionExpiresAt: null },
                { subscriptionExpiresAt: { lte: now } },
              ],
            },
            {
              plan: "none",
              subscriptionExpiresAt: { lte: now },
              purchases: {
                some: {
                  type: "premium_subscription_monthly",
                },
              },
            },
          ],
        },
        select: {
          id: true,
          plan: true,
          planPurchasedAt: true,
          subscriptionStartedAt: true,
          subscriptionExpiresAt: true,
          subscriptionRenewedAt: true,
        },
        take: 2000,
      });

      const updates = renewableUsers
        .map((user) => {
          const patch = buildSubscriptionAutoRenewPatch(user, {
            now,
            autoRenew: true,
            recoverPlan: user.plan === "none",
          });
          if (!patch) {
            return null;
          }
          return prisma.user.update({
            where: { id: user.id },
            data: patch,
          });
        })
        .filter(Boolean);

      if (!updates.length) {
        return;
      }

      await prisma.$transaction(updates);
      return;
    }

    const expiredUsers = await prisma.user.findMany({
      where: {
        plan: { in: ["basic", "premium"] },
        subscriptionExpiresAt: { lte: now },
      },
      select: { id: true },
      take: 2000,
    });

    const expiredUserIds = expiredUsers
      .map((item) => String(item.id || "").trim())
      .filter(Boolean);
    if (!expiredUserIds.length) {
      return;
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: {
          id: { in: expiredUserIds },
          plan: { in: ["basic", "premium"] },
          subscriptionExpiresAt: { lte: now },
        },
        data: {
          plan: "none",
        },
      }),
      prisma.slug.updateMany({
        where: {
          ownerId: { in: expiredUserIds },
          status: { in: ["approved", "active", "private"] },
        },
        data: {
          status: "paused",
        },
      }),
    ]);
  } catch (error) {
    const code = String(error?.code || "");
    if (code === "P2022" || code === "42703") {
      return;
    }
    throw error;
  }
}

async function cleanupStaleUnverifiedAccounts() {
  if (!env.UNVERIFIED_ACCOUNT_CLEANUP_ENABLED) {
    return;
  }

  const ttlHours = Number(env.UNVERIFIED_ACCOUNT_TTL_HOURS || 72);
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

  const result = await prisma.user.deleteMany({
    where: {
      emailVerified: false,
      createdAt: { lte: cutoff },
      profileCard: { is: null },
      unqScore: { is: null },
      slugs: { none: {} },
      slugRequests: { none: {} },
      slugWaitlistEntries: { none: {} },
      purchases: { none: {} },
      verificationRequests: { none: {} },
      referralsMade: { none: {} },
      referralsReceived: { none: {} },
      dropWaitlistEntries: { none: {} },
      scoreHistory: { none: {} },
    },
  });

  if (Number(result?.count || 0) > 0) {
    console.info(`[express-app] cleaned ${result.count} stale unverified account(s)`);
  }
}

async function finalizeDeletedAccount(user) {
  const userId = String(user.id || "");
  if (!userId) return;

  const existingEmail = user.email ? String(user.email) : null;
  const firstName = user.firstName ? String(user.firstName) : "";

  await prisma.$transaction(async (tx) => {
    await tx.slug.updateMany({
      where: { ownerId: userId },
      data: {
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

    await tx.profileCard.deleteMany({ where: { ownerId: userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        status: "deleted",
        deletedAt: new Date(),
        deactivatedAt: null,
        reactivationDeadlineAt: null,
        reactivationOtpCode: null,
        reactivationOtpExpiresAt: null,
        reactivationOtpSentAt: null,
        deletionReminder7SentAt: null,
        deletionReminder1SentAt: null,
        email: null,
        login: null,
        pendingEmail: null,
        passwordHash: null,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        lockedUntil: null,
        loginAttempts: 0,
        firstName: "Deleted User",
        lastName: null,
        city: null,
        username: null,
        telegramUsername: null,
        telegramChatId: null,
        displayName: null,
        notificationsEnabled: false,
        showInDirectory: false,
        isVerified: false,
        verifiedCompany: null,
        verifiedAt: null,
        directorySector: null,
        plan: "none",
        planPurchasedAt: null,
        planUpgradedAt: null,
      },
    });
  });

  await prisma.$executeRawUnsafe(
    `
    DELETE FROM user_sessions
    WHERE (sess::jsonb #>> '{user,userId}') = $1
    `,
    userId,
  );

  if (existingEmail) {
    try {
      await sendAccountDeletedEmail({ email: existingEmail, firstName });
    } catch (error) {
      console.error("[express-app] failed to send account deleted email", error);
    }
  }
}

async function processDeactivatedAccountLifecycle() {
  const now = new Date();
  const reminderHours = Number(env.ACCOUNT_REACTIVATION_REMINDER_DAYS_BEFORE || 7) * 24;
  const lastReminderHours = Number(env.ACCOUNT_REACTIVATION_LAST_REMINDER_HOURS || 24);

  const users = await prisma.user.findMany({
    where: {
      status: "deactivated",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      deactivatedAt: true,
      reactivationDeadlineAt: true,
      deletionReminder7SentAt: true,
      deletionReminder1SentAt: true,
    },
    take: 500,
  });

  for (const user of users) {
    let deadline = user.reactivationDeadlineAt ? new Date(user.reactivationDeadlineAt) : null;
    if (!deadline || Number.isNaN(deadline.getTime())) {
      const base = user.deactivatedAt ? new Date(user.deactivatedAt) : now;
      deadline = new Date(base.getTime() + Number(env.ACCOUNT_REACTIVATION_WINDOW_DAYS || 30) * 24 * 60 * 60 * 1000);
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { reactivationDeadlineAt: deadline },
        });
      } catch (error) {
        console.error("[express-app] failed to backfill reactivation deadline", { userId: user.id, error });
        continue;
      }
    }
    const hoursLeft = Math.ceil((deadline.getTime() - now.getTime()) / (60 * 60 * 1000));

    if (hoursLeft <= 0) {
      try {
        await finalizeDeletedAccount(user);
      } catch (error) {
        console.error("[express-app] failed to finalize deleted account", { userId: user.id, error });
      }
      continue;
    }

    if (!user.email) continue;

    if (hoursLeft <= reminderHours && !user.deletionReminder7SentAt) {
      try {
        await sendAccountReactivationReminderEmail({
          email: user.email,
          firstName: user.firstName,
          restoreUntil: deadline,
          hoursLeft,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { deletionReminder7SentAt: new Date() },
        });
      } catch (error) {
        console.error("[express-app] failed to send account reminder (T-7d)", { userId: user.id, error });
      }
    }

    if (hoursLeft <= lastReminderHours && !user.deletionReminder1SentAt) {
      try {
        await sendAccountReactivationReminderEmail({
          email: user.email,
          firstName: user.firstName,
          restoreUntil: deadline,
          hoursLeft,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { deletionReminder1SentAt: new Date() },
        });
      } catch (error) {
        console.error("[express-app] failed to send account reminder (last day)", { userId: user.id, error });
      }
    }
  }
}

async function runJobsOnce() {
  await processFlashSalesSchedule();
  await processDropsSchedule();
  await detectSuspiciousActivity();
  await processExpiredSubscriptions();
  await processReferralPaidSync();
  await cleanupStaleUnverifiedAccounts();
  await processDeactivatedAccountLifecycle();
  await ensureDailyRecalculation();
  if (Date.now() - lastAnalyticsReconciliationAt >= HOURLY_MS) {
    const updated = await reconcileAnalyticsViewCounters();
    lastAnalyticsReconciliationAt = Date.now();
    if (updated > 0) {
      console.info(`[express-app] reconciled analytics_views_count for ${updated} slug(s)`);
    }
  }
}

function startLiveJobs() {
  if (started) return;
  started = true;

  const run = async () => {
    try {
      await runJobsOnce();
    } catch (error) {
      if (error && (error.code === "P2021" || error.code === "P2022")) {
        console.warn("[express-app] skip live jobs: schema not migrated yet");
        return;
      }
      console.error("[express-app] live jobs failed", error);
    }
  };

  void run();
  timer = setInterval(() => {
    void run();
  }, LOOP_MS);
}

function stopLiveJobs() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}

module.exports = {
  startLiveJobs,
  stopLiveJobs,
  runJobsOnce,
  cleanupStaleUnverifiedAccounts,
  processDeactivatedAccountLifecycle,
  processExpiredSubscriptions,
};
