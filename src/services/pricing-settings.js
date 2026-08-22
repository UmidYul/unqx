const { setFeatureSetting, DEFAULTS } = require("./feature-settings");
const { getManySettings, setSettingsBatch, getSetting } = require("./platform-settings");
const { getSubscriptionSnapshot, normalizeSubscriptionPlan } = require("./subscription");

const BRACELET_PRICE = 200_000;

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

function toMarkupPercent(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(500, Math.round(parsed * 100) / 100));
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
    slugPriceMarkupPercent: toMarkupPercent(
      raw?.slugPriceMarkupPercent,
      defaults.slugPriceMarkupPercent || 0,
    ),
    slugPriceMarkupComment: String(
      raw?.slugPriceMarkupComment ??
        defaults.slugPriceMarkupComment ??
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
    "pricing_slug_markup_percent",
    "pricing_slug_markup_comment",
  ]);
  const raw = {
    planPremiumMonthlyPriceUsd: values.plan_premium_monthly_price_usd,
    planPremiumMonthlyPriceUzs: values.plan_premium_monthly_price_uzs,
    planPremiumPrice: values.plan_premium_price,
    pricingFootnote: values.pricing_footnote,
    slugPriceMarkupPercent: values.pricing_slug_markup_percent,
    slugPriceMarkupComment: values.pricing_slug_markup_comment,
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
    pricing_slug_markup_percent: next.slugPriceMarkupPercent,
    pricing_slug_markup_comment: next.slugPriceMarkupComment,
  });
  await setFeatureSetting("pricing", next);
  return next;
}

function applySlugPriceMarkup(basePrice, pricing) {
  const normalizedBase = Math.max(0, Math.round(Number(basePrice || 0)));
  const settings = normalizePricingSettings(pricing || {});
  const percent = settings.slugPriceMarkupPercent;
  if (!percent) {
    return {
      basePrice: normalizedBase,
      finalPrice: normalizedBase,
      markupPercent: 0,
      markupAmount: 0,
      comment: settings.slugPriceMarkupComment,
    };
  }
  const markupAmount = Math.max(0, Math.round((normalizedBase * percent) / 100));
  return {
    basePrice: normalizedBase,
    finalPrice: normalizedBase + markupAmount,
    markupPercent: percent,
    markupAmount,
    comment: settings.slugPriceMarkupComment,
  };
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
  applySlugPriceMarkup,
  getBraceletPrice,
  resolveRequestedPlanForOrder,
  getPlanCharge,
  getPlanPurchaseType,
};
