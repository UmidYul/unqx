const { randomBytes } = require("node:crypto");

const { prisma } = require("../db/prisma");
const { getFeatureSetting } = require("./feature-settings");
const { getReferralV1Settings, getWalletBalance } = require("./referral-v1");
const { getActiveCampaignsSafe } = require("./referral-v2");
const { normalizeRefCode } = require("./referral-normalize");

function isMissingModelTable(error, modelName) {
  return (
    Boolean(error) &&
    error.code === "P2021" &&
    (!modelName || String(error?.meta?.modelName || "") === modelName)
  );
}

function isMissingModelColumn(error, modelName) {
  if (!error || error.code !== "P2022") return false;
  if (!modelName) return true;
  const targetModel = String(error?.meta?.modelName || "");
  if (!targetModel) return true;
  return targetModel === modelName;
}

function isMissingModelDelegateError(error) {
  if (!error || error.name !== "TypeError") return false;
  const message = String(error.message || "");
  return (
    message.includes("Cannot read properties of undefined") &&
    (message.includes("findMany") || message.includes("findUnique") || message.includes("count") || message.includes("aggregate") || message.includes("create"))
  );
}

function isMissingReferralBootstrapStorage(error, modelName) {
  return isMissingModelTable(error, modelName) || isMissingModelColumn(error, modelName) || isMissingModelDelegateError(error);
}

function generateRefCode() {
  return `U${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function ensureUserRefCode(userId) {
  if (!prisma.user || typeof prisma.user.findUnique !== "function") return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.refCode) return user.refCode;

  for (let i = 0; i < 10; i += 1) {
    const candidate = generateRefCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
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

async function linkReferralOnRegistration({ referredUserId, refCode }) {
  if (!prisma.referral || typeof prisma.referral.create !== "function") {
    return null;
  }
  const settings = await getFeatureSetting("referrals");
  if (!settings.enabled) {
    return null;
  }

  const normalized = normalizeRefCode(refCode);
  if (!normalized || !referredUserId) {
    return null;
  }

  const referrer = await prisma.user.findFirst({
    where: { refCode: normalized },
    select: { id: true, refCode: true },
  });
  if (!referrer || referrer.id === referredUserId) {
    return null;
  }

  const existing = await prisma.referral.findUnique({
    where: { referredId: referredUserId },
    select: { id: true },
  });
  if (existing) {
    return null;
  }

  return prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: referredUserId,
      refCode: referrer.refCode,
      status: "registered",
    },
  });
}

async function markReferralPaidByReferredUserId() {
  // Deprecated in referral v1 (conversion is finalized on approved order).
  return null;
}

async function getReferralBootstrap(userId) {
  if (!prisma.user || typeof prisma.user.findUnique !== "function") {
    return {
      refCode: "",
      refLink: "",
      stats: { invited: 0, paid: 0, rewarded: 0, rewardsAmount: 0 },
      bonus: { balance: 0, totalEarned: 0, totalSpent: 0, history: [] },
      referrals: [],
      campaigns: [],
      fraud: [],
      rewards: [],
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, refCode: true },
  });
  if (!user) return null;

  const refCode = user.refCode || (await ensureUserRefCode(user.id)) || "";
  const settings = await getReferralV1Settings();

  const [conversions, bonusHistory, bonusBalance, activeCampaigns, fraudChecks] = await Promise.all([
    prisma.referralConversion
      ? prisma.referralConversion
          .findMany({
            where: { referrerId: user.id },
            include: {
              referred: {
                select: {
                  firstName: true,
                  username: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 300,
          })
          .catch((error) => {
            if (isMissingReferralBootstrapStorage(error, "ReferralConversion")) return [];
            throw error;
          })
      : Promise.resolve([]),
    prisma.bonusLedger
      ? prisma.bonusLedger
          .findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
          .catch((error) => {
            if (isMissingReferralBootstrapStorage(error, "BonusLedger")) return [];
            throw error;
          })
      : Promise.resolve([]),
    getWalletBalance(user.id).catch((error) => {
      if (isMissingReferralBootstrapStorage(error, "UserBonusWallet")) return 0;
      throw error;
    }),
    getActiveCampaignsSafe(),
    prisma.referralFraudCheck
      ? prisma.referralFraudCheck
          .findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
          .catch((error) => {
            if (isMissingReferralBootstrapStorage(error, "ReferralFraudCheck")) return [];
            throw error;
          })
      : Promise.resolve([]),
  ]);

  const invited = conversions.length;
  const paid = conversions.filter((item) => item.status === "approved").length;
  const rewarded = paid;
  const rewardsAmount = conversions
    .filter((item) => item.status === "approved")
    .reduce((sum, item) => sum + Number(item.rewardAmount || 0), 0);
  const totalEarned = bonusHistory
    .filter((item) => String(item.direction || "") === "credit")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalSpent = bonusHistory
    .filter((item) => String(item.direction || "") === "debit")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    refCode,
    refLink: `unqx.uz/ref/${encodeURIComponent(refCode)}`,
    stats: {
      invited,
      paid,
      rewarded,
      rewardsAmount,
    },
    bonus: {
      balance: bonusBalance,
      totalEarned,
      totalSpent,
      history: bonusHistory.map((item) => ({
        id: item.id,
        direction: item.direction,
        kind: item.kind,
        amount: Number(item.amount || 0),
        balanceAfter: Number(item.balanceAfter || 0),
        note: item.note || "",
        createdAt: item.createdAt,
      })),
    },
    referrals: conversions.map((item) => ({
      id: item.id,
      name: item.referred?.firstName || item.referred?.username || "UNQX User",
      username: item.referred?.username || null,
      createdAt: item.createdAt,
      status: item.status === "approved" ? "approved" : "pending",
      rewardType: "bonus_balance",
      rewardAmount: Number(item.rewardAmount || 0),
      source: item.refSource || "",
      offer: item.refOffer || "",
    })),
    campaigns: (activeCampaigns || []).map((item) => ({
      id: item.id,
      name: item.name || "",
      type: item.type,
      source: item.source || "",
      offer: item.offer || "",
      promoCode: item.type === "promo_code" ? String(item.promoCode || "") : "",
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    })),
    fraud: (fraudChecks || []).map((item) => ({
      id: item.id,
      verdict: item.verdict,
      reason: item.reason || "",
      score: Number(item.score || 0),
      createdAt: item.createdAt,
    })),
    rewards: [
      {
        id: "referral_v1_fixed",
        threshold: 1,
        rewardType: "bonus_balance",
        rewardLabel: `+${Number(settings.referrerReward || 0).toLocaleString("ru-RU")} сум за подтверждённый заказ`,
        status: "received",
      },
    ],
  };
}

async function claimReferralReward() {
  const error = new Error("Manual reward claiming disabled in referral v1");
  error.code = "REWARD_CLAIM_DISABLED";
  throw error;
}

module.exports = {
  normalizeRefCode,
  ensureUserRefCode,
  linkReferralOnRegistration,
  markReferralPaidByReferredUserId,
  getReferralBootstrap,
  claimReferralReward,
};
