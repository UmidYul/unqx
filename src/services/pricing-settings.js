const { getFeatureSetting, setFeatureSetting, DEFAULTS } = require("./feature-settings");

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
  const raw = await getFeatureSetting("pricing");
  return normalizePricingSettings(raw);
}

async function setPricingSettings(nextPatch) {
  const current = await getPricingSettings();
  const next = normalizePricingSettings({
    ...current,
    ...(nextPatch && typeof nextPatch === "object" ? nextPatch : {}),
  });
  await setFeatureSetting("pricing", next);
  return next;
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
  resolveRequestedPlanForOrder,
  getPlanCharge,
  getPlanPurchaseType,
};

