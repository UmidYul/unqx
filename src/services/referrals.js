const { randomBytes } = require("node:crypto");

const { prisma } = require("../db/prisma");
const { getFeatureSetting } = require("./feature-settings");
const { sendTelegramMessage } = require("./telegram");

function normalizeRefCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 40);
}

function generateRefCode() {
  return `U${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function ensureUserRefCode(telegramId) {
  if (!prisma.user || typeof prisma.user.findUnique !== "function") return null;
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return null;
  if (user.refCode) return user.refCode;

  for (let i = 0; i < 10; i += 1) {
    const candidate = generateRefCode();
    try {
      const updated = await prisma.user.update({
        where: { telegramId },
        data: { refCode: candidate },
        select: { refCode: true },
      });
      return updated.refCode;
    } catch (error) {
      if (error && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  return null;
}

async function linkReferralOnRegistration({ referredTelegramId, refCode }) {
  if (!prisma.referral || typeof prisma.referral.create !== "function") {
    return null;
  }
  const settings = await getFeatureSetting("referrals");
  if (!settings.enabled) {
    return null;
  }

  const normalized = normalizeRefCode(refCode);
  if (!normalized || !referredTelegramId) {
    return null;
  }

  const referrer = await prisma.user.findFirst({
    where: { refCode: normalized },
    select: { telegramId: true, refCode: true },
  });
  if (!referrer || referrer.telegramId === referredTelegramId) {
    return null;
  }

  const existing = await prisma.referral.findUnique({
    where: { referredTelegramId },
    select: { id: true },
  });
  if (existing) {
    return null;
  }

  return prisma.referral.create({
    data: {
      referrerTelegramId: referrer.telegramId,
      referredTelegramId,
      refCode: referrer.refCode,
      status: "registered",
    },
  });
}

async function markReferralPaidByReferredTelegramId(referredTelegramId) {
  if (!prisma.referral || typeof prisma.referral.findUnique !== "function") {
    return null;
  }
  const settings = await getFeatureSetting("referrals");
  if (!settings.enabled || !settings.requirePaid) {
    return null;
  }

  const referral = await prisma.referral.findUnique({
    where: { referredTelegramId },
    include: {
      referrer: {
        select: { telegramId: true, username: true },
      },
      referred: {
        select: { username: true },
      },
    },
  });
  if (!referral || referral.status === "paid" || referral.status === "rewarded") {
    return referral;
  }

  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: "paid",
      rewardType: "discount",
    },
  });

  try {
    const refUsername = referral.referred?.username ? `@${referral.referred.username}` : "твой друг";
    await sendTelegramMessage({
      chatId: referral.referrerTelegramId,
      text: `🎉 ${refUsername} оплатил slug! Ты получаешь бонус по реферальной программе.`,
      parseMode: "HTML",
    });
  } catch (error) {
    console.error("[express-app] failed to send referral paid telegram", error);
  }

  return updated;
}

async function getRewardRules() {
  if (!prisma.referralRewardRule || typeof prisma.referralRewardRule.findMany !== "function") {
    return [];
  }
  return prisma.referralRewardRule.findMany({
    where: { isActive: true },
    orderBy: { requiredPaidFriends: "asc" },
  });
}

function getRewardLabel(rule) {
  if (rule.rewardType === "discount") {
    return `Скидка ${Number(rule.rewardValue || 0)}%`;
  }
  if (rule.rewardType === "free_month") {
    return `${Number(rule.rewardValue || 1)} месяц бесплатно`;
  }
  return "Бонусный slug";
}

async function getReferralBootstrap(telegramId) {
  if (!prisma.user || typeof prisma.user.findUnique !== "function" || !prisma.referral || typeof prisma.referral.findMany !== "function") {
    return {
      refCode: "",
      refLink: "",
      stats: { invited: 0, paid: 0, rewarded: 0 },
      referrals: [],
      rewards: [],
    };
  }
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { telegramId: true, refCode: true, username: true },
  });
  if (!user) return null;

  const refCode = user.refCode || (await ensureUserRefCode(user.telegramId));
  const [items, rules] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerTelegramId: user.telegramId },
      include: {
        referred: {
          select: {
            firstName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getRewardRules(),
  ]);

  const invited = items.length;
  const paid = items.filter((item) => item.status === "paid" || item.status === "rewarded").length;
  const rewarded = items.filter((item) => item.status === "rewarded").length;

  const ruleCards = rules.map((rule) => {
    const eligible = paid >= rule.requiredPaidFriends;
    const got = items.some((item) => item.rewardedRuleId === rule.id && item.status === "rewarded");
    return {
      id: rule.id,
      threshold: rule.requiredPaidFriends,
      rewardType: rule.rewardType,
      rewardLabel: getRewardLabel(rule),
      status: got ? "received" : eligible ? "available" : "pending",
    };
  });

  return {
    refCode,
    refLink: `unqx.uz/?ref=${encodeURIComponent(refCode)}`,
    stats: {
      invited,
      paid,
      rewarded,
    },
    referrals: items.map((item) => ({
      id: item.id,
      name: item.referred?.firstName || item.referred?.username || "UNQ+ User",
      username: item.referred?.username || null,
      createdAt: item.createdAt,
      status: item.status,
      rewardType: item.rewardType,
    })),
    rewards: ruleCards,
  };
}

async function claimReferralReward({ telegramId, ruleId }) {
  if (!prisma.referral || typeof prisma.referral.findMany !== "function") {
    const error = new Error("Referral storage is not ready");
    error.code = "REFERRAL_STORAGE_UNAVAILABLE";
    throw error;
  }
  const rules = await getRewardRules();
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) {
    const error = new Error("Reward rule not found");
    error.code = "RULE_NOT_FOUND";
    throw error;
  }

  const rows = await prisma.referral.findMany({
    where: { referrerTelegramId: telegramId },
    orderBy: { createdAt: "asc" },
  });
  const paid = rows.filter((item) => item.status === "paid" || item.status === "rewarded");
  if (paid.length < rule.requiredPaidFriends) {
    const error = new Error("Reward is not available yet");
    error.code = "REWARD_NOT_AVAILABLE";
    throw error;
  }

  const already = rows.some((item) => item.rewardedRuleId === rule.id && item.status === "rewarded");
  if (already) {
    const error = new Error("Reward already claimed");
    error.code = "ALREADY_CLAIMED";
    throw error;
  }

  const candidate = paid.find((item) => item.status === "paid" && !item.rewardedRuleId);
  if (!candidate) {
    const error = new Error("No paid referral available to attach reward");
    error.code = "NO_PAID_REFERRAL";
    throw error;
  }

  const updated = await prisma.referral.update({
    where: { id: candidate.id },
    data: {
      status: "rewarded",
      rewardType: rule.rewardType,
      rewardedRuleId: rule.id,
      rewardedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    rewardType: updated.rewardType,
    rewardedAt: updated.rewardedAt,
  };
}

module.exports = {
  normalizeRefCode,
  ensureUserRefCode,
  linkReferralOnRegistration,
  markReferralPaidByReferredTelegramId,
  getReferralBootstrap,
  claimReferralReward,
};
