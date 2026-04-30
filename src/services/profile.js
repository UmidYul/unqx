const { getSubscriptionSnapshot, normalizeSubscriptionPlan } = require("./subscription");

const PROFILE_THEMES = new Set([
  "default_dark",
  "arctic",
  "linen",
  "marble",
  "forest",
  "sage_luxe",
  "midnight_obsidian",
  "golden_noir",
  "aurora_codex",
  "nebula_glass",
  "velours",
]);
const PROFILE_TYPES = new Set(["person", "company"]);
const BUTTON_TYPES = new Set([
  "phone",
  "telegram",
  "instagram",
  "tiktok",
  "youtube",
  "website",
  "map",
  "card",
  "whatsapp",
  "other",
]);

function getEffectivePlan(user) {
  const subscription = getSubscriptionSnapshot(user);
  const normalizedPlan = subscription.effectivePlan;
  return {
    plan: normalizedPlan,
    isPremium: normalizedPlan === "premium",
    isExpiredPremium: subscription.isExpired,
    subscription,
  };
}

function getSlugLimit(plan) {
  if (normalizeSubscriptionPlan(plan) !== "premium") {
    return 0;
  }
  return 3;
}

function getTagLimit(plan) {
  if (normalizeSubscriptionPlan(plan) !== "premium") {
    return 0;
  }
  return 5;
}

function getButtonLimit(plan) {
  if (normalizeSubscriptionPlan(plan) !== "premium") {
    return 0;
  }
  return 6;
}

function canCreateCard(user) {
  return getEffectivePlan(user).plan === "premium";
}

function canAccessAnalytics(user) {
  return Boolean(user);
}

function canAddSlug({ user, currentSlugCount = 0 }) {
  const plan = getEffectivePlan(user).plan;
  if (plan === "none") return false;
  return Number(currentSlugCount || 0) < 3;
}

function normalizeCardThemeKey(theme) {
  const raw = String(theme || "").trim();
  if (raw === "royal_ivory") {
    return "sage_luxe";
  }
  return raw;
}

function normalizeThemeByPlan(theme, effectivePlan) {
  if (effectivePlan !== "premium") {
    return "default_dark";
  }
  const normalized = normalizeCardThemeKey(theme);
  if (!PROFILE_THEMES.has(normalized)) {
    return "default_dark";
  }
  return normalized;
}

function normalizeColor(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : null;
}

function normalizeTags(rawTags, effectivePlan) {
  const max = getTagLimit(effectivePlan);
  const source = Array.isArray(rawTags) ? rawTags : [];
  const out = [];

  for (const item of source) {
    if (out.length >= max) {
      break;
    }
    const label = String(item || "")
      .trim()
      .replace(/^#+/, "");
    if (!label) {
      continue;
    }
    out.push(`#${label.slice(0, 30)}`);
  }

  return out;
}

function normalizeButtons(rawButtons, effectivePlan) {
  const source = Array.isArray(rawButtons) ? rawButtons : [];
  const max = getButtonLimit(effectivePlan);
  const out = [];

  for (const item of source) {
    if (Number.isFinite(max) && out.length >= max) {
      break;
    }
    const obj = item && typeof item === "object" ? item : {};
    const typeRaw = String(obj.type || "other")
      .trim()
      .toLowerCase();
    const typeAlias = typeRaw === "карта" ? "card" : typeRaw;
    const type = BUTTON_TYPES.has(typeAlias) ? typeAlias : "other";
    const label = String(obj.label || "").trim().slice(0, 40);
    const value = String(obj.value || obj.url || "").trim().slice(0, 300);
    const href = String(obj.href || obj.url || "").trim().slice(0, 400);

    if (!label || (!value && !href)) {
      continue;
    }

    out.push({
      id: String(obj.id || `${Date.now()}_${Math.random()}`).slice(0, 60),
      type,
      label,
      value,
      href,
    });
  }

  return out;
}

function normalizeDisplayName(value, fallback) {
  const next = String(value || "").trim().slice(0, 120);
  if (next) {
    return next;
  }
  return String(fallback || "").trim().slice(0, 120) || "UNQX User";
}

function getPlanBadgeLabel(plan) {
  if (normalizeSubscriptionPlan(plan) === "premium") return "ПРЕМИУМ";
  return "ТАРИФ НЕ ВЫБРАН";
}

function normalizeProfileType(value, options = {}) {
  const fallbackRaw = String(options.fallback || "person").trim().toLowerCase();
  const allowAll = Boolean(options.allowAll);
  const fallback =
    allowAll && fallbackRaw === "all"
      ? "all"
      : PROFILE_TYPES.has(fallbackRaw)
        ? fallbackRaw
        : "person";
  const normalized = String(value || "").trim().toLowerCase();
  if (allowAll && normalized === "all") {
    return "all";
  }
  return PROFILE_TYPES.has(normalized) ? normalized : fallback;
}

module.exports = {
  PROFILE_THEMES,
  PROFILE_TYPES,
  BUTTON_TYPES,
  getEffectivePlan,
  getSlugLimit,
  getTagLimit,
  getButtonLimit,
  canCreateCard,
  canAccessAnalytics,
  canAddSlug,
  normalizeCardThemeKey,
  normalizeThemeByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  normalizeProfileType,
  getPlanBadgeLabel,
};
