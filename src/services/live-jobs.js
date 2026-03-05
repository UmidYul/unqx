const { prisma } = require("../db/prisma");
const { sendTelegramMessage } = require("./telegram");
const { getActiveFlashSale, resolveConditionLabel } = require("./flash-sales");
const { processDropsSchedule } = require("./drops");
const { detectSuspiciousActivity } = require("./leaderboard");
const { markReferralPaidByReferredUserId } = require("./referrals");
const { ensureDailyRecalculation } = require("./unq-score");

const LOOP_MS = 60 * 1000;

let started = false;
let timer = null;

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
  const text = `⚡ FLASH SALE на UNQ+\n${active.description || active.title}\nСкидка ${active.discountPercent}% на ${resolveConditionLabel(active)} · До ${untilLabel}\nunqx.uz`;

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

async function runJobsOnce() {
  await processFlashSalesSchedule();
  await processDropsSchedule();
  await detectSuspiciousActivity();
  await processReferralPaidSync();
  await ensureDailyRecalculation();
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
};
