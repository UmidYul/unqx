const PROFILE_THEMES = new Set(["default_dark", "arctic", "linen", "marble", "forest"]);
const BUTTON_TYPES = new Set([
  "phone",
  "telegram",
  "instagram",
  "tiktok",
  "youtube",
  "website",
  "whatsapp",
  "email",
  "other",
]);

function getEffectivePlan(user) {
  const rawPlan = user && typeof user.plan === "string" ? user.plan : "none";
  const normalizedPlan = rawPlan === "premium" || rawPlan === "basic" ? rawPlan : "none";
  return {
    plan: normalizedPlan,
    isPremium: normalizedPlan === "premium",
    isExpiredPremium: false,
  };
}

function getSlugLimit(plan) {
  if (plan === "none") {
    return 0;
  }
  return plan === "premium" ? 3 : 1;
}

function getTagLimit(plan) {
  if (plan === "none") {
    return 0;
  }
  return plan === "premium" ? 5 : 3;
}

function getButtonLimit(plan) {
  if (plan === "none") {
    return 0;
  }
  return plan === "premium" ? null : 3;
}

function canCreateCard(user) {
  const plan = getEffectivePlan(user).plan;
  return plan === "basic" || plan === "premium";
}

function canAccessAnalytics(user) {
  return getEffectivePlan(user).plan !== "none";
}

function canAddSlug({ user, currentSlugCount = 0 }) {
  const plan = getEffectivePlan(user).plan;
  if (plan === "none") return false;
  if (plan === "basic") return Number(currentSlugCount || 0) < 1;
  return Number(currentSlugCount || 0) < 3;
}

function normalizeThemeByPlan(theme, effectivePlan) {
  if (effectivePlan !== "premium") {
    return "default_dark";
  }
  if (typeof theme !== "string" || !PROFILE_THEMES.has(theme)) {
    return "default_dark";
  }
  return theme;
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
    const label = String(item || "").trim().replace(/^#+/, "");
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
    const typeRaw = String(obj.type || "other").trim().toLowerCase();
    const type = BUTTON_TYPES.has(typeRaw) ? typeRaw : "other";
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
  if (plan === "premium") return "ПРЕМИУМ";
  if (plan === "basic") return "БАЗОВЫЙ";
  return "ТАРИФ НЕ ВЫБРАН";
}

module.exports = {
  PROFILE_THEMES,
  BUTTON_TYPES,
  getEffectivePlan,
  getSlugLimit,
  getTagLimit,
  getButtonLimit,
  canCreateCard,
  canAccessAnalytics,
  canAddSlug,
  normalizeThemeByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  getPlanBadgeLabel,
};
