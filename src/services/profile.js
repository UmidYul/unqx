const { getSubscriptionSnapshot, normalizeSubscriptionPlan } = require("./subscription");
const { hasActivePublicProfile } = require("./public-handle");

// Временный флаг: все пользователи получают премиум функционал.
// Чтобы вернуть обратно — поменяй на false.
const PREMIUM_FOR_ALL = true;

const PROFILE_THEME_KEYS = [
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
  "galaxy",
  "volt_sport",
  "minion_yellow",
  "soviet_carpet",
  "vintage_mickey",
  "rick_morty_portal",
  "gravity_falls",
  "venom_symbiote",
  "snow_leopard",
  "shinobi_path",
  "shinobi_way",
  "samarkand_heritage",
  "turtle_power",
  "egypt_nile",
  "sakura_blossom",
  "starry_night",
  "velours",
  "graffiti",
  "graffiti_neon",
  "heritage_crest",
  "ivory_tennis",
  "grand_slam_clay",
  "racing_green",
  "polo_navy",
  "alpine_ski",
  "boxing_legend",
  "basketball_court",
  "football_pitch",
  "olympic_gold",
  "anime_blush",
  "cheetah_spots",
  "serpent_scale",
  "color_red",
  "color_orange",
  "color_yellow",
  "color_green",
  "color_teal",
  "color_blue",
  "color_purple",
  "color_pink",
];
const PROFILE_THEMES = new Set(PROFILE_THEME_KEYS);
const PROFILE_AVATAR_FRAME_KEYS = [
  "none",
  "chrome_ring",
  "neon_spray",
  "sticker_bubble",
  "chain_link",
  "pixel_glow",
  "starburst",
  "drip_outline",
  "tape_collage",
  "orbit_dots",
  "laurel_wreath",
  "trophy_gold",
  "tennis_lines",
  "racing_stripes",
  "varsity_patch",
  "boxing_rope",
  "basketball_arc",
  "football_stitch",
  "stopwatch_ring",
  "medal_ribbon",
  "dragon_orbit",
];
const PROFILE_AVATAR_FRAMES = new Set(PROFILE_AVATAR_FRAME_KEYS);
const PROFILE_EMOJI_BACKGROUND_KEYS = [
  "none",
  "ghosts",
  "stars",
  "lightning",
  "crowns",
  "webs",
  "hearts",
];
const PROFILE_EMOJI_BACKGROUNDS = new Set(PROFILE_EMOJI_BACKGROUND_KEYS);
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
  const normalizedPlan = PREMIUM_FOR_ALL ? "premium" : subscription.effectivePlan;
  return {
    plan: normalizedPlan,
    isPremium: normalizedPlan === "premium",
    isExpiredPremium: PREMIUM_FOR_ALL ? false : subscription.isExpired,
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
  return getEffectivePlan(user).plan === "premium" || hasActivePublicProfile(user);
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

function normalizeAvatarFrameByPlan(frame, effectivePlan) {
  if (effectivePlan !== "premium") {
    return "none";
  }
  const normalized = String(frame || "").trim().toLowerCase() || "none";
  if (!PROFILE_AVATAR_FRAMES.has(normalized)) {
    return "none";
  }
  return normalized;
}

function normalizeEmojiBackgroundByPlan(pack, effectivePlan) {
  if (effectivePlan !== "premium") {
    return "none";
  }
  const normalized = String(pack || "").trim().toLowerCase() || "none";
  if (!PROFILE_EMOJI_BACKGROUNDS.has(normalized)) {
    return "none";
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
  PROFILE_THEME_KEYS,
  PROFILE_THEMES,
  PROFILE_AVATAR_FRAME_KEYS,
  PROFILE_AVATAR_FRAMES,
  PROFILE_EMOJI_BACKGROUND_KEYS,
  PROFILE_EMOJI_BACKGROUNDS,
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
  normalizeAvatarFrameByPlan,
  normalizeEmojiBackgroundByPlan,
  normalizeColor,
  normalizeTags,
  normalizeButtons,
  normalizeDisplayName,
  normalizeProfileType,
  getPlanBadgeLabel,
};
