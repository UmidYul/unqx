const { createHash } = require("node:crypto");

const { prisma } = require("../db/prisma");
const { getManySettings } = require("./platform-settings");
const { normalizeRefCode, normalizeSource, normalizeOffer } = require("./referral-normalize");

const DEFAULTS = {
  velocityWindowHours: 24,
  velocityIpLimit: 5,
  velocityDeviceLimit: 4,
  reviewScoreThreshold: 60,
  blockScoreThreshold: 100,
  defaultPerUserCap: 1,
};

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

function isMissingReferralStorageError(error, modelName) {
  return isMissingModelTable(error, modelName) || isMissingModelColumn(error, modelName) || isMissingModelDelegateError(error);
}

function hashValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return createHash("sha256").update(raw).digest("hex");
}

function normalizePromoCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

async function getReferralV2Settings() {
  const values = await getManySettings([
    "referral_v2_velocity_window_hours",
    "referral_v2_velocity_ip_limit",
    "referral_v2_velocity_device_limit",
    "referral_v2_review_score_threshold",
    "referral_v2_block_score_threshold",
    "referral_v2_default_per_user_cap",
  ]);

  return {
    velocityWindowHours: Math.max(1, Math.min(168, Math.round(safeNumber(values.referral_v2_velocity_window_hours, DEFAULTS.velocityWindowHours)))),
    velocityIpLimit: Math.max(1, Math.round(safeNumber(values.referral_v2_velocity_ip_limit, DEFAULTS.velocityIpLimit))),
    velocityDeviceLimit: Math.max(1, Math.round(safeNumber(values.referral_v2_velocity_device_limit, DEFAULTS.velocityDeviceLimit))),
    reviewScoreThreshold: Math.max(1, Math.round(safeNumber(values.referral_v2_review_score_threshold, DEFAULTS.reviewScoreThreshold))),
    blockScoreThreshold: Math.max(1, Math.round(safeNumber(values.referral_v2_block_score_threshold, DEFAULTS.blockScoreThreshold))),
    defaultPerUserCap: Math.max(1, Math.round(safeNumber(values.referral_v2_default_per_user_cap, DEFAULTS.defaultPerUserCap))),
  };
}

function isCampaignActiveNow(campaign, now = new Date()) {
  if (!campaign || campaign.status !== "active") return false;
  const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  if (startsAt && Number.isFinite(startsAt.getTime()) && startsAt > now) return false;
  if (endsAt && Number.isFinite(endsAt.getTime()) && endsAt < now) return false;
  return true;
}

function chooseCampaign(campaigns = []) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return null;
  const sorted = [...campaigns].sort((a, b) => {
    const aPromo = String(a.type || "") === "promo_code" ? 1 : 0;
    const bPromo = String(b.type || "") === "promo_code" ? 1 : 0;
    if (aPromo !== bPromo) return bPromo - aPromo;
    const p = safeNumber(b.priority, 0) - safeNumber(a.priority, 0);
    if (p !== 0) return p;
    const aUpdated = new Date(a.updatedAt || 0).getTime();
    const bUpdated = new Date(b.updatedAt || 0).getTime();
    return bUpdated - aUpdated;
  });
  return sorted[0] || null;
}

async function getActiveCampaignsSafe() {
  if (!prisma.referralCampaign) return [];
  const now = new Date();
  try {
    const rows = await prisma.referralCampaign.findMany({
      where: { status: "active" },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });
    return rows.filter((item) => isCampaignActiveNow(item, now));
  } catch (error) {
    if (isMissingReferralStorageError(error, "ReferralCampaign")) {
      return [];
    }
    throw error;
  }
}

async function resolveCampaignForCheckout({
  source,
  offer,
  promoCode,
  now = new Date(),
}) {
  if (!prisma.referralCampaign) {
    return { campaign: null, normalizedPromoCode: normalizePromoCode(promoCode) };
  }
  const normalizedSource = normalizeSource(source);
  const normalizedOffer = normalizeOffer(offer);
  const normalizedPromoCode = normalizePromoCode(promoCode);
  const where = {
    status: "active",
    OR: [
      {
        type: "source_offer",
        source: normalizedSource,
        offer: normalizedOffer,
      },
      ...(normalizedPromoCode
        ? [
            {
              type: "promo_code",
              promoCode: normalizedPromoCode,
            },
          ]
        : []),
    ],
  };
  try {
    const rows = await prisma.referralCampaign.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 50,
    });
    const activeRows = rows.filter((item) => isCampaignActiveNow(item, now));
    return {
      campaign: chooseCampaign(activeRows),
      normalizedPromoCode,
    };
  } catch (error) {
    if (isMissingReferralStorageError(error, "ReferralCampaign")) {
      return { campaign: null, normalizedPromoCode };
    }
    throw error;
  }
}

async function countCampaignUsagesByUser({
  campaignId,
  userId,
}) {
  if (!prisma.referralCampaignUsage || !campaignId || !userId) return 0;
  try {
    return await prisma.referralCampaignUsage.count({
      where: {
        campaignId,
        userId,
        status: { in: ["reserved", "finalized"] },
      },
    });
  } catch (error) {
    if (isMissingReferralStorageError(error, "ReferralCampaignUsage")) {
      return 0;
    }
    throw error;
  }
}

async function sumCampaignUsageAmount(campaignId) {
  if (!prisma.referralCampaignUsage || !campaignId) return 0;
  try {
    const agg = await prisma.referralCampaignUsage.aggregate({
      where: {
        campaignId,
        status: "finalized",
      },
      _sum: { amountSpent: true },
    });
    return Math.max(0, Number(agg?._sum?.amountSpent || 0));
  } catch (error) {
    if (isMissingReferralStorageError(error, "ReferralCampaignUsage")) {
      return 0;
    }
    throw error;
  }
}

function buildCampaignSnapshot({
  campaign,
  referrerReward,
  inviteeDiscount,
  discountCapPercent,
  normalizedPromoCode,
}) {
  if (!campaign) {
    return {
      campaignApplied: false,
      campaignType: null,
      campaignName: "",
      campaignId: null,
      promoCodeApplied: normalizedPromoCode || "",
      referrerReward,
      inviteeDiscount,
      discountCapPercent,
      perUserCap: DEFAULTS.defaultPerUserCap,
      budgetAmount: 0,
    };
  }
  return {
    campaignApplied: true,
    campaignType: campaign.type,
    campaignName: String(campaign.name || ""),
    campaignId: campaign.id,
    promoCodeApplied: campaign.type === "promo_code" ? String(campaign.promoCode || normalizedPromoCode || "") : "",
    referrerReward: Math.max(0, Math.round(safeNumber(campaign.rewardAmountOverride, referrerReward))),
    inviteeDiscount: Math.max(0, Math.round(safeNumber(campaign.inviteeDiscountOverride, inviteeDiscount))),
    discountCapPercent: Math.max(0, Math.min(100, safeNumber(campaign.discountCapPercentOverride, discountCapPercent))),
    perUserCap: Math.max(1, Math.round(safeNumber(campaign.perUserCap, DEFAULTS.defaultPerUserCap))),
    budgetAmount: Math.max(0, Math.round(safeNumber(campaign.budgetAmount, 0))),
  };
}

async function evaluateCampaignEligibility({
  campaign,
  userId,
  settings,
}) {
  if (!campaign) {
    return { allowed: true, reason: "", usedBudget: 0, usedByUser: 0 };
  }
  const [usedBudget, usedByUser] = await Promise.all([
    sumCampaignUsageAmount(campaign.id),
    countCampaignUsagesByUser({ campaignId: campaign.id, userId }),
  ]);
  const perUserCap = Math.max(1, Math.round(safeNumber(campaign.perUserCap, settings.defaultPerUserCap)));
  if (usedByUser >= perUserCap) {
    return { allowed: false, reason: "per_user_cap_reached", usedBudget, usedByUser };
  }
  const budgetAmount = Math.max(0, Math.round(safeNumber(campaign.budgetAmount, 0)));
  if (budgetAmount > 0 && usedBudget >= budgetAmount) {
    return { allowed: false, reason: "campaign_budget_exhausted", usedBudget, usedByUser };
  }
  return { allowed: true, reason: "", usedBudget, usedByUser };
}

async function runFraudCheck({
  orderId = null,
  userId,
  ipRaw,
  userAgent,
  tx = prisma,
  persist = true,
}) {
  const settings = await getReferralV2Settings();
  const ipHash = hashValue(ipRaw || "");
  const deviceHash = hashValue(`${String(userAgent || "").slice(0, 400)}|${String(ipRaw || "")}`);
  const windowSince = new Date(Date.now() - settings.velocityWindowHours * 60 * 60 * 1000);

  const whereBase = {
    createdAt: { gte: windowSince },
  };
  const [ipCount, deviceCount] = await Promise.all([
    tx.referralFraudCheck
      ? tx.referralFraudCheck
          .count({
            where: { ...whereBase, ipHash: ipHash || "__none__" },
          })
          .catch((error) => {
            if (isMissingReferralStorageError(error, "ReferralFraudCheck")) return 0;
            throw error;
          })
      : Promise.resolve(0),
    tx.referralFraudCheck
      ? tx.referralFraudCheck
          .count({
            where: { ...whereBase, deviceHash: deviceHash || "__none__" },
          })
          .catch((error) => {
            if (isMissingReferralStorageError(error, "ReferralFraudCheck")) return 0;
            throw error;
          })
      : Promise.resolve(0),
  ]);

  let score = 0;
  const reasons = [];
  if (ipHash && ipCount >= settings.velocityIpLimit) {
    score += 65;
    reasons.push("ip_velocity_limit");
  }
  if (deviceHash && deviceCount >= settings.velocityDeviceLimit) {
    score += 55;
    reasons.push("device_velocity_limit");
  }
  const verdict =
    score >= settings.blockScoreThreshold
      ? "block"
      : score >= settings.reviewScoreThreshold
      ? "review"
      : "allow";

  const note = reasons.length ? reasons.join(",") : "ok";
  if (persist && tx.referralFraudCheck) {
    try {
      await tx.referralFraudCheck.create({
        data: {
          orderId: orderId || null,
          userId,
          ipHash: ipHash || null,
          deviceHash: deviceHash || null,
          velocityIpCount: ipCount,
          velocityDeviceCount: deviceCount,
          score,
          reason: note,
          verdict,
        },
      });
    } catch (error) {
      if (!isMissingReferralStorageError(error, "ReferralFraudCheck")) {
        throw error;
      }
    }
  }

  return {
    verdict,
    reason: note,
    score,
    ipHash,
    deviceHash,
    velocityIpCount: ipCount,
    velocityDeviceCount: deviceCount,
    settings,
  };
}

async function reserveCampaignUsage({
  tx,
  campaignId,
  userId,
  orderId,
  amountSpent = 0,
  idempotencyKey,
}) {
  if (!tx.referralCampaignUsage || !campaignId || !userId || !orderId || !idempotencyKey) return null;
  return tx.referralCampaignUsage.upsert({
    where: { idempotencyKey },
    create: {
      campaignId,
      userId,
      orderId,
      status: "reserved",
      amountSpent: Math.max(0, Math.round(safeNumber(amountSpent, 0))),
      idempotencyKey,
    },
    update: {},
  });
}

async function finalizeCampaignUsage({
  tx,
  orderId,
  purchaseId = null,
  amountSpent = 0,
}) {
  if (!tx.referralCampaignUsage || !orderId) return null;
  return tx.referralCampaignUsage.updateMany({
    where: {
      orderId,
      status: "reserved",
    },
    data: {
      status: "finalized",
      purchaseId: purchaseId || null,
      amountSpent: Math.max(0, Math.round(safeNumber(amountSpent, 0))),
      finalizedAt: new Date(),
    },
  });
}

async function releaseCampaignUsage({
  tx,
  orderId,
}) {
  if (!tx.referralCampaignUsage || !orderId) return null;
  return tx.referralCampaignUsage.updateMany({
    where: {
      orderId,
      status: "reserved",
    },
    data: {
      status: "released",
      releasedAt: new Date(),
    },
  });
}

module.exports = {
  DEFAULTS,
  normalizePromoCode,
  getReferralV2Settings,
  getActiveCampaignsSafe,
  resolveCampaignForCheckout,
  chooseCampaign,
  buildCampaignSnapshot,
  evaluateCampaignEligibility,
  runFraudCheck,
  reserveCampaignUsage,
  finalizeCampaignUsage,
  releaseCampaignUsage,
  hashValue,
  normalizeSource,
  normalizeOffer,
  normalizeRefCode,
};
