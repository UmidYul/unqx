const { getFeatureSetting, setFeatureSetting, DEFAULTS } = require("./feature-settings");
const { getManySettings, setSettingsBatch, getSetting } = require("./platform-settings");

const BRACELET_PRICE = 300_000;

function normalizePlan(value) {
  if (value === "premium") return "premium";
  if (value === "basic") return "basic";
  return "none";
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
  return {
    planBasicPrice: toPrice(raw?.planBasicPrice, defaults.planBasicPrice || 50_000),
    planPremiumPrice: toPrice(raw?.planPremiumPrice, defaults.planPremiumPrice || 130_000),
    premiumUpgradePrice: toPrice(raw?.premiumUpgradePrice, defaults.premiumUpgradePrice || 80_000),
    pricingFootnote: String(raw?.pricingFootnote || defaults.pricingFootnote || "").trim(),
  };
}

async function getPricingSettings() {
  const values = await getManySettings([
    "plan_basic_price",
    "plan_premium_price",
    "plan_premium_upgrade_price",
    "pricing_footnote",
  ]);
  const raw = {
    planBasicPrice: values.plan_basic_price,
    planPremiumPrice: values.plan_premium_price,
    premiumUpgradePrice: values.plan_premium_upgrade_price,
    pricingFootnote: values.pricing_footnote,
  };
  const normalized = normalizePricingSettings(raw);
  if (normalized.pricingFootnote) {
    return normalized;
  }
  const legacy = await getFeatureSetting("pricing");
  return normalizePricingSettings(legacy);
}

async function setPricingSettings(nextPatch) {
  const current = await getPricingSettings();
  const next = normalizePricingSettings({
    ...current,
    ...(nextPatch && typeof nextPatch === "object" ? nextPatch : {}),
  });
  await setSettingsBatch("pricing", {
    plan_basic_price: next.planBasicPrice,
    plan_premium_price: next.planPremiumPrice,
    plan_premium_upgrade_price: next.premiumUpgradePrice,
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

function resolveRequestedPlanForOrder({ currentPlan, requestedPlan }) {
  const current = normalizePlan(currentPlan);
  const requested = requestedPlan === "premium" ? "premium" : "basic";

  if (current === "premium") {
    return "premium";
  }
  if (current === "none") {
    return requested;
  }
  if (current === "basic" && requested === "premium") {
    return "premium";
  }
  return "basic";
}

function getPlanCharge({ currentPlan, requestedPlan, pricing }) {
  const current = normalizePlan(currentPlan);
  const requested = resolveRequestedPlanForOrder({ currentPlan: current, requestedPlan });
  const settings = normalizePricingSettings(pricing || {});

  if (current === "none") {
    return requested === "premium" ? settings.planPremiumPrice : settings.planBasicPrice;
  }
  if (current === "basic" && requested === "premium") {
    return settings.premiumUpgradePrice;
  }
  return 0;
}

function getPlanPurchaseType({ currentPlan, requestedPlan }) {
  const current = normalizePlan(currentPlan);
  const requested = resolveRequestedPlanForOrder({ currentPlan: current, requestedPlan });
  if (current === "none" && requested === "basic") return "basic_plan";
  if (current === "none" && requested === "premium") return "premium_plan";
  if (current === "basic" && requested === "premium") return "upgrade_to_premium";
  return null;
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
