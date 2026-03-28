const { setFeatureSetting, DEFAULTS } = require("./feature-settings");
const { getManySettings, setSettingsBatch, getSetting } = require("./platform-settings");
const { getSubscriptionSnapshot, normalizeSubscriptionPlan } = require("./subscription");

const BRACELET_PRICE = 250_000;

function normalizePlan(value) {
  return normalizeSubscriptionPlan(value);
}

function toPrice(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.round(parsed));
}

function normalizePricingSettings(raw) {
  const defaults = DEFAULTS.pricing || {};
  const legacyPremiumPrice = toPrice(raw?.planPremiumPrice, defaults.planPremiumPrice || 130_000);
  const monthlyUzs = toPrice(raw?.planPremiumMonthlyPriceUzs, legacyPremiumPrice);
  const monthlyUsd = Math.max(0, Number(raw?.planPremiumMonthlyPriceUsd ?? 2) || 2);
  return {
    // New monthly model
    planPremiumMonthlyPriceUsd: monthlyUsd,
    planPremiumMonthlyPriceUzs: monthlyUzs,
    // Backward-compatible aliases for old consumers
    planBasicPrice: monthlyUzs,
    planPremiumPrice: monthlyUzs,
    premiumUpgradePrice: monthlyUzs,
    pricingFootnote: String(
      raw?.pricingFootnote ??
        defaults.pricingFootnote ??
        "",
    ).trim(),
  };
}

async function getPricingSettings() {
  const values = await getManySettings([
    "plan_premium_monthly_price_usd",
    "plan_premium_monthly_price_uzs",
    "plan_premium_price",
    "pricing_footnote",
  ]);
  const raw = {
    planPremiumMonthlyPriceUsd: values.plan_premium_monthly_price_usd,
    planPremiumMonthlyPriceUzs: values.plan_premium_monthly_price_uzs,
    planPremiumPrice: values.plan_premium_price,
    pricingFootnote: values.pricing_footnote,
  };
  return normalizePricingSettings(raw);
}

async function setPricingSettings(nextPatch) {
  const current = await getPricingSettings();
  const next = normalizePricingSettings({
    ...current,
    ...(nextPatch && typeof nextPatch === "object" ? nextPatch : {}),
  });
  await setSettingsBatch("pricing", {
    plan_premium_monthly_price_usd: next.planPremiumMonthlyPriceUsd,
    plan_premium_monthly_price_uzs: next.planPremiumMonthlyPriceUzs,
    // Keep legacy key in sync to avoid breaking old dashboard widgets
    plan_premium_price: next.planPremiumMonthlyPriceUzs,
    pricing_footnote: next.pricingFootnote,
  });
  await setFeatureSetting("pricing", next);
  return next;
}

async function getBraceletPrice() {
  const value = await getSetting("bracelet_price", BRACELET_PRICE);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : BRACELET_PRICE;
}

function resolveRequestedPlanForOrder() {
  return "premium";
}

function getPlanCharge({
  currentPlan,
  pricing,
  user = null,
  forceSubscriptionCharge = false,
}) {
  const settings = normalizePricingSettings(pricing || {});
  if (forceSubscriptionCharge) {
    return settings.planPremiumMonthlyPriceUzs;
  }
  const snapshot = getSubscriptionSnapshot(
    user || {
      plan: currentPlan,
    },
  );
  if (snapshot.isActive) {
    return 0;
  }
  return settings.planPremiumMonthlyPriceUzs;
}

function getPlanPurchaseType({ forceSubscriptionCharge = false } = {}) {
  if (forceSubscriptionCharge) return "premium_subscription_monthly";
  return "premium_subscription_monthly";
}

module.exports = {
  BRACELET_PRICE,
  normalizePlan,
  normalizePricingSettings,
  getPricingSettings,
  setPricingSettings,
  getBraceletPrice,
  resolveRequestedPlanForOrder,
  getPlanCharge,
  getPlanPurchaseType,
};
