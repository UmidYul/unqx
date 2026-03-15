const { prisma } = require("../db/prisma");
const { getManySettings } = require("./platform-settings");

const DEFAULT_POLICY = {
  enabled: true,
  firstOrderOnly: true,
};

function normalizePromoCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizePromoStatus(value, fallback = "draft") {
  const status = String(value || "").trim().toLowerCase();
  return ["draft", "active", "paused", "archived"].includes(status) ? status : fallback;
}

function normalizePromoDiscountType(value, fallback = "discount_amount") {
  const type = String(value || "").trim().toLowerCase();
  if (["discount", "discount_amount", "amount", "fixed_discount"].includes(type)) return "discount_amount";
  if (["fixed", "fixed_price", "price"].includes(type)) return "fixed_price";
  if (["percent", "percentage", "discount_percent", "percent_off"].includes(type)) return "discount_percent";
  return fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

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
    (message.includes("findMany") || message.includes("findUnique") || message.includes("count") || message.includes("aggregate"))
  );
}

function isMissingPromoStorageError(error, modelName) {
  return isMissingModelTable(error, modelName) || isMissingModelColumn(error, modelName) || isMissingModelDelegateError(error);
}

function isPromoActiveNow(promo, now = new Date()) {
  if (!promo || promo.status !== "active") return false;
  const startsAt = promo.startsAt ? new Date(promo.startsAt) : null;
  const endsAt = promo.endsAt ? new Date(promo.endsAt) : null;
  if (startsAt && Number.isFinite(startsAt.getTime()) && startsAt > now) return false;
  if (endsAt && Number.isFinite(endsAt.getTime()) && endsAt < now) return false;
  return true;
}

async function getPromoPolicySettings() {
  const values = await getManySettings([
    "feature_promo_codes",
    "promo_codes_first_order_only",
  ]);
  return {
    enabled: values.feature_promo_codes !== undefined ? Boolean(values.feature_promo_codes) : DEFAULT_POLICY.enabled,
    firstOrderOnly:
      values.promo_codes_first_order_only !== undefined
        ? Boolean(values.promo_codes_first_order_only)
        : DEFAULT_POLICY.firstOrderOnly,
  };
}

async function resolvePromoForCheckout({ promoCode, now = new Date() }) {
  const normalizedPromoCode = normalizePromoCode(promoCode);
  if (!prisma.promoCode) {
    return { promo: null, normalizedPromoCode };
  }
  if (!normalizedPromoCode) {
    return { promo: null, normalizedPromoCode: "" };
  }
  try {
    const promo = await prisma.promoCode.findFirst({
      where: {
        code: normalizedPromoCode,
        status: "active",
      },
    });
    if (!promo || !isPromoActiveNow(promo, now)) {
      return { promo: null, normalizedPromoCode };
    }
    return { promo, normalizedPromoCode };
  } catch (error) {
    if (isMissingPromoStorageError(error, "PromoCode")) {
      return { promo: null, normalizedPromoCode };
    }
    throw error;
  }
}

async function countPromoUsagesByUser({ promoCode, userId }) {
  if (!prisma.slugRequest || !promoCode || !userId) return 0;
  try {
    return await prisma.slugRequest.count({
      where: {
        userId,
        promoCode,
        status: { in: ["new", "contacted", "paid", "approved"] },
      },
    });
  } catch (error) {
    if (isMissingPromoStorageError(error, "SlugRequest")) {
      return 0;
    }
    throw error;
  }
}

async function sumPromoUsageAmount({ promoCode }) {
  if (!prisma.slugRequest || !promoCode) return 0;
  try {
    const agg = await prisma.slugRequest.aggregate({
      where: {
        promoCode,
        status: { in: ["new", "contacted", "paid", "approved"] },
      },
      _sum: { promoDiscountApplied: true },
    });
    return Math.max(0, Number(agg?._sum?.promoDiscountApplied || 0));
  } catch (error) {
    if (isMissingPromoStorageError(error, "SlugRequest")) {
      return 0;
    }
    throw error;
  }
}

async function evaluatePromoEligibility({
  promo,
  userId = null,
  firstApprovedOrderExists = false,
  policy = DEFAULT_POLICY,
}) {
  if (!promo) {
    return { allowed: false, reason: "promo_not_active", usedBudget: 0, usedByUser: 0 };
  }
  const policyEnabled = policy?.enabled !== undefined ? Boolean(policy.enabled) : DEFAULT_POLICY.enabled;
  if (!policyEnabled) {
    return { allowed: false, reason: "promo_disabled", usedBudget: 0, usedByUser: 0 };
  }
  const firstOrderOnly = policy?.firstOrderOnly !== undefined ? Boolean(policy.firstOrderOnly) : DEFAULT_POLICY.firstOrderOnly;
  if (firstOrderOnly && firstApprovedOrderExists && userId) {
    return { allowed: false, reason: "promo_first_order_only", usedBudget: 0, usedByUser: 0 };
  }

  const [usedBudget, usedByUser] = await Promise.all([
    sumPromoUsageAmount({ promoCode: promo.code }),
    userId ? countPromoUsagesByUser({ promoCode: promo.code, userId }) : Promise.resolve(0),
  ]);

  const perUserCap = Math.max(1, Math.round(safeNumber(promo.perUserCap, 1)));
  if (userId && usedByUser >= perUserCap) {
    return { allowed: false, reason: "per_user_cap_reached", usedBudget, usedByUser };
  }
  const budgetAmount = Math.max(0, Math.round(safeNumber(promo.budgetAmount, 0)));
  if (budgetAmount > 0 && usedBudget >= budgetAmount) {
    return { allowed: false, reason: "promo_budget_exhausted", usedBudget, usedByUser };
  }

  return { allowed: true, reason: "", usedBudget, usedByUser };
}

function applyPromoToPrice({ basePrice, promo }) {
  const price = Math.max(0, Math.round(Number(basePrice || 0)));
  if (!promo) {
    return { finalPrice: price, discountApplied: 0 };
  }
  const discountType = normalizePromoDiscountType(promo.discountType, "discount_amount");
  const discountValue = Math.max(0, Math.round(Number(promo.discountValue || 0)));
  if (discountType === "fixed_price") {
    const finalPrice = Math.max(0, Math.min(price, discountValue));
    return {
      finalPrice,
      discountApplied: Math.max(0, price - finalPrice),
    };
  }
  if (discountType === "discount_percent") {
    const percent = Math.max(0, Math.min(100, discountValue));
    const discountApplied = Math.min(price, Math.round((price * percent) / 100));
    return {
      finalPrice: Math.max(0, price - discountApplied),
      discountApplied,
    };
  }
  const discountApplied = Math.min(price, discountValue);
  return {
    finalPrice: Math.max(0, price - discountApplied),
    discountApplied,
  };
}

module.exports = {
  normalizePromoCode,
  normalizePromoStatus,
  normalizePromoDiscountType,
  getPromoPolicySettings,
  resolvePromoForCheckout,
  evaluatePromoEligibility,
  applyPromoToPrice,
};
