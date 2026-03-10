const { prisma } = require("../db/prisma");
const { getManySettings } = require("./platform-settings");
const { normalizeRefCode } = require("./referrals");

const DEFAULTS = {
  enabled: true,
  referrerReward: 50_000,
  inviteeDiscount: 100_000,
  discountCapPercent: 30,
  tiersEnabled: false,
};

function normalizeSource(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return normalized || "order_modal";
}

function normalizeOffer(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]/g, "")
    .slice(0, 80);
  return normalized || "default";
}

async function getReferralV1Settings() {
  const values = await getManySettings([
    "feature_referrals",
    "referral_v1_referrer_reward",
    "referral_v1_invitee_discount",
    "referral_v1_discount_cap_percent",
    "referral_v1_tiers_enabled",
  ]);
  return {
    enabled: values.feature_referrals === undefined ? DEFAULTS.enabled : Boolean(values.feature_referrals),
    referrerReward: Math.max(0, Math.round(Number(values.referral_v1_referrer_reward ?? DEFAULTS.referrerReward) || DEFAULTS.referrerReward)),
    inviteeDiscount: Math.max(0, Math.round(Number(values.referral_v1_invitee_discount ?? DEFAULTS.inviteeDiscount) || DEFAULTS.inviteeDiscount)),
    discountCapPercent: Math.max(0, Math.min(100, Number(values.referral_v1_discount_cap_percent ?? DEFAULTS.discountCapPercent) || DEFAULTS.discountCapPercent)),
    tiersEnabled: values.referral_v1_tiers_enabled === undefined ? DEFAULTS.tiersEnabled : Boolean(values.referral_v1_tiers_enabled),
  };
}

function computeDiscountAllocation({
  slugBasePrice,
  slugPriceAfterProductDiscount,
  inviteeDiscountCandidate,
  walletBalance,
  discountCapPercent,
}) {
  const base = Math.max(0, Math.round(Number(slugBasePrice || 0)));
  const afterProduct = Math.max(0, Math.round(Number(slugPriceAfterProductDiscount || 0)));
  const productDiscount = Math.max(0, base - afterProduct);
  const capAmount = Math.max(0, Math.floor((base * Number(discountCapPercent || 0)) / 100));
  const capRemaining = Math.max(0, capAmount - productDiscount);
  const inviteeWanted = Math.max(0, Math.round(Number(inviteeDiscountCandidate || 0)));
  const inviteeDiscountApplied = Math.min(inviteeWanted, capRemaining, afterProduct);
  const afterInvitee = Math.max(0, afterProduct - inviteeDiscountApplied);
  const bonusWanted = Math.max(0, Math.round(Number(walletBalance || 0)));
  const bonusLimitAfterCap = Math.max(0, capRemaining - inviteeDiscountApplied);
  const bonusSpent = Math.min(bonusWanted, bonusLimitAfterCap, afterInvitee);
  const finalSlugPayable = Math.max(0, afterInvitee - bonusSpent);
  const discountCapApplied = Math.max(
    0,
    (inviteeWanted - inviteeDiscountApplied) + Math.max(0, bonusWanted - bonusSpent),
  );

  return {
    slugBasePrice: base,
    slugPriceAfterProductDiscount: afterProduct,
    productDiscountAmount: productDiscount,
    discountCapPercent: Number(discountCapPercent || 0),
    discountCapAmount: capAmount,
    capRemainingAfterProduct: capRemaining,
    inviteeDiscountCandidate: inviteeWanted,
    inviteeDiscountApplied,
    bonusBalanceUsedForCalc: bonusWanted,
    bonusSpent,
    discountCapApplied,
    finalSlugPayable,
  };
}

async function getWalletBalance(userId, tx = prisma) {
  if (!userId || !tx.userBonusWallet) return 0;
  const wallet = await tx.userBonusWallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return Math.max(0, Number(wallet?.balance || 0));
}

async function hasApprovedSlugPurchase(userId, tx = prisma) {
  if (!userId) return false;
  if (tx.purchase) {
    const count = await tx.purchase.count({
      where: {
        userId,
        type: "slug",
        approvedAt: { not: null },
      },
    });
    if (count > 0) return true;
  }
  if (tx.slugRequest) {
    const count = await tx.slugRequest.count({
      where: {
        userId,
        status: "approved",
      },
    });
    return count > 0;
  }
  return false;
}

async function resolveReferrerByCode(refCode, excludedUserId, tx = prisma) {
  const normalized = normalizeRefCode(refCode);
  if (!normalized || !tx.user) return null;
  const user = await tx.user.findFirst({
    where: { refCode: normalized },
    select: { id: true, refCode: true },
  });
  if (!user || user.id === excludedUserId) return null;
  return { referrerId: user.id, refCode: user.refCode };
}

async function resolveReferrerForUser({ userId, explicitRefCode, sessionRefCode, tx = prisma }) {
  if (!userId) return null;
  if (tx.referralConversion) {
    const existing = await tx.referralConversion.findFirst({
      where: { referredId: userId },
      orderBy: { createdAt: "asc" },
      select: { referrerId: true, refCode: true },
    });
    if (existing?.referrerId) {
      return { referrerId: existing.referrerId, refCode: existing.refCode || "" };
    }
  }
  if (tx.referral) {
    const legacy = await tx.referral.findUnique({
      where: { referredId: userId },
      select: { referrerId: true, refCode: true },
    });
    if (legacy?.referrerId) {
      return { referrerId: legacy.referrerId, refCode: legacy.refCode || "" };
    }
  }
  return (
    (await resolveReferrerByCode(explicitRefCode, userId, tx)) ||
    (await resolveReferrerByCode(sessionRefCode, userId, tx))
  );
}

async function ensureWalletRow(userId, tx = prisma) {
  if (!userId || !tx.userBonusWallet) return null;
  return tx.userBonusWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

async function recordBonusLedger({
  tx,
  userId,
  delta,
  kind,
  idempotencyKey,
  orderId = null,
  purchaseId = null,
  conversionId = null,
  note = null,
}) {
  if (!tx.bonusLedger || !tx.userBonusWallet) return { applied: false, balanceAfter: 0 };
  const safeDelta = Math.round(Number(delta || 0));
  if (!safeDelta) return { applied: false, balanceAfter: await getWalletBalance(userId, tx) };
  const existing = await tx.bonusLedger.findUnique({
    where: { idempotencyKey },
    select: { id: true, balanceAfter: true },
  });
  if (existing) {
    return { applied: false, balanceAfter: Number(existing.balanceAfter || 0) };
  }

  const wallet = await ensureWalletRow(userId, tx);
  const currentBalance = Math.max(0, Number(wallet?.balance || 0));
  const nextBalanceRaw = currentBalance + safeDelta;
  const nextBalance = nextBalanceRaw < 0 ? 0 : nextBalanceRaw;
  const actualDelta = nextBalance - currentBalance;
  if (!actualDelta) {
    return { applied: false, balanceAfter: currentBalance };
  }

  await tx.userBonusWallet.update({
    where: { userId },
    data: { balance: nextBalance },
  });

  try {
    await tx.bonusLedger.create({
      data: {
        userId,
        direction: actualDelta > 0 ? "credit" : "debit",
        kind,
        amount: Math.abs(actualDelta),
        balanceAfter: nextBalance,
        idempotencyKey,
        orderId,
        purchaseId,
        conversionId,
        note: note || null,
      },
    });
    return { applied: true, balanceAfter: nextBalance, deltaApplied: actualDelta };
  } catch (error) {
    if (error?.code === "P2002") {
      return { applied: false, balanceAfter: nextBalance };
    }
    throw error;
  }
}

function resolveOrderAttribution({ body = {}, query = {}, path = "" }) {
  const sourceRaw = body.refSource || query.refSource || query.source || "";
  const offerRaw = body.refOffer || query.refOffer || query.offer || "";
  const safePath = String(path || "").toLowerCase();
  const sourceFallback = safePath.startsWith("/drops") ? "drops" : "order_modal";
  return {
    refCode: normalizeRefCode(body.refCode || query.ref || ""),
    refSource: normalizeSource(sourceRaw || sourceFallback),
    refOffer: normalizeOffer(offerRaw || "default"),
  };
}

module.exports = {
  DEFAULTS,
  getReferralV1Settings,
  computeDiscountAllocation,
  getWalletBalance,
  hasApprovedSlugPurchase,
  resolveReferrerForUser,
  ensureWalletRow,
  recordBonusLedger,
  normalizeSource,
  normalizeOffer,
  resolveOrderAttribution,
};
