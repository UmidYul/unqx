const { prisma } = require("../db/prisma");

const THEME_KEY_RE = /^[a-z][a-z0-9_]{1,79}$/;
const REQUIRED_CONFIG_KEYS = [
  "cardBg",
  "cardBgOverlay",
  "surfaceBg",
  "cardBorder",
  "surfaceBorder",
  "dividerColor",
  "nameColor",
  "roleColor",
  "mutedColor",
  "accentColor",
  "emailColor",
  "buttonPrimaryBg",
  "buttonPrimaryText",
  "buttonPrimaryBorder",
  "buttonSecondaryBg",
  "buttonSecondaryText",
  "buttonSecondaryBorder",
  "badgeText",
  "badgeBg",
  "badgeBorder",
  "topLineGradient",
  "avatarBg",
  "avatarText",
  "avatarBorder",
  "cardBorderRadius",
  "fontFamily",
  "nameFontStyle",
  "nameFontWeight",
  "roleLetterSpacing",
  "scoreLabelColor",
  "scoreValueColor",
  "scoreBarFill",
  "scoreBarTrack",
  "scorePercentileColor",
  "cardShadow",
  "buttonShineGradient",
];

const OPTIONAL_CONFIG_KEYS = [
  "pageBg",
  "pageBgMode",
  "pageBgAsset",
  "cardBgOpacity",
  "cardBgOverlayOpacity",
  "surfaceBorderRadius",
  "surfaceBorderWidth",
  "surfaceBorderStyle",
  "surfaceBorderColor",
  "buttonBorderRadius",
  "buttonBorderWidth",
  "buttonBorderStyle",
  "avatarBorderRadius",
  "avatarBorderWidth",
  "avatarBorderStyle",
  "badgeBorderRadius",
  "badgeBorderWidth",
  "badgeBorderStyle",
  "nameFontSize",
  "roleFontSize",
  "bioFontSize",
  "emailFontSize",
  "mutedFontSize",
  "roleFontWeight",
  "bioFontWeight",
  "emailFontWeight",
  "nameTextTransform",
  "roleTextTransform",
  "bioTextTransform",
  "emailTextTransform",
  "nameLetterSpacing",
  "bioLetterSpacing",
  "emailLetterSpacing",
  "primaryIconRecolor",
  "secondaryIconRecolor",
  "overlaySvgRecolor",
];

const PUBLIC_THEME_STATUSES = new Set(["active", "public"]);

function isThemeConfigStorageMissing(error) {
  const message = String(error?.message || "");
  return error?.code === "P2021" || error?.code === "P2022" || /unqx_theme_configs/i.test(message);
}

function normalizeThemeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeTitle(value, fallback) {
  const title = String(value || "").trim();
  return (title || fallback || "Custom Theme").slice(0, 160);
}

function sanitizeSvg(input, options = {}) {
  const recolor = options.recolor !== false;
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (!/^<svg[\s>]/i.test(raw) || !/<\/svg>$/i.test(raw)) {
    const error = new Error("SVG должен начинаться с <svg> и заканчиваться </svg>.");
    error.status = 400;
    throw error;
  }
  if (/<script[\s>]/i.test(raw) || /<foreignObject[\s>]/i.test(raw) || /\son[a-z]+\s*=/i.test(raw)) {
    const error = new Error("SVG содержит небезопасный код.");
    error.status = 400;
    throw error;
  }
  const withoutUnsafeStyles = raw.replace(/\sstyle=(".*?"|'.*?'|[^\s>]+)/gi, "");
  const normalized = recolor
    ? withoutUnsafeStyles
      .replace(/\s(?:fill|stroke)=(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/<svg\b([^>]*)>/i, '<svg$1 fill="currentColor" stroke="currentColor">')
    : withoutUnsafeStyles;
  return normalized.slice(0, 20000);
}

function normalizeThemeConfig(config, themeKey) {
  const source = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  const output = {};
  for (const key of REQUIRED_CONFIG_KEYS) {
    const value = source[key];
    output[key] = String(value === undefined || value === null ? "" : value).trim();
  }
  output.cardBgOverlay = output.cardBgOverlay || themeKey || "none";
  output.nameFontStyle = output.nameFontStyle === "italic" ? "italic" : "normal";
  output.nameFontWeight = String(Math.max(100, Math.min(900, Math.round(Number(output.nameFontWeight || 700) / 100) * 100)));
  output.cardBorderRadius = output.cardBorderRadius || "24px";
  output.fontFamily = output.fontFamily || "'Sora', 'Inter', 'Segoe UI', sans-serif";
  for (const key of OPTIONAL_CONFIG_KEYS) {
    if (source[key] === undefined || source[key] === null) continue;
    output[key] = String(source[key]).trim();
  }
  const missing = REQUIRED_CONFIG_KEYS.filter((key) => !output[key]);
  if (missing.length) {
    const error = new Error(`Заполните поля темы: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
  return output;
}

function mapThemeRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    key: String(row.themeKey || row.theme_key || ""),
    title: String(row.title || ""),
    cardBgOverlay: String(row.cardBgOverlay || row.card_bg_overlay || ""),
    config: row.configJson || row.config_json || {},
    overlaySvg: String(row.overlaySvg || row.overlay_svg || ""),
    primaryIconSvg: String(row.primaryIconSvg || row.primary_icon_svg || ""),
    secondaryIconSvg: String(row.secondaryIconSvg || row.secondary_icon_svg || ""),
    status: String(row.status || "active"),
    cacheVersion: Number(row.cacheVersion || row.cache_version || 1) || 1,
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

function normalizeThemeStatus(value) {
  const status = String(value || "active").trim().toLowerCase();
  return PUBLIC_THEME_STATUSES.has(status) ? status : "active";
}

async function listThemeConfigs({ limit = 100, publicOnly = false } = {}) {
  const take = Math.max(1, Math.min(500, Number(limit || 100)));
  try {
    const rows = publicOnly
      ? await prisma.$queryRaw`
        SELECT id, theme_key AS "themeKey", title, card_bg_overlay AS "cardBgOverlay",
               config_json AS "configJson", overlay_svg AS "overlaySvg",
               primary_icon_svg AS "primaryIconSvg", secondary_icon_svg AS "secondaryIconSvg",
               status, cache_version AS "cacheVersion",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM unqx_theme_configs
        WHERE status IN ('active', 'public')
        ORDER BY updated_at DESC, id DESC
        LIMIT ${take}
      `
      : await prisma.$queryRaw`
        SELECT id, theme_key AS "themeKey", title, card_bg_overlay AS "cardBgOverlay",
               config_json AS "configJson", overlay_svg AS "overlaySvg",
               primary_icon_svg AS "primaryIconSvg", secondary_icon_svg AS "secondaryIconSvg",
               status, cache_version AS "cacheVersion",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM unqx_theme_configs
        ORDER BY updated_at DESC, id DESC
        LIMIT ${take}
      `;
    return (Array.isArray(rows) ? rows : []).map(mapThemeRow).filter(Boolean);
  } catch (error) {
    if (isThemeConfigStorageMissing(error)) return [];
    throw error;
  }
}

async function findPublicThemeConfigByKey(themeKey) {
  const key = normalizeThemeKey(themeKey);
  if (!THEME_KEY_RE.test(key)) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, theme_key AS "themeKey", title, card_bg_overlay AS "cardBgOverlay",
             config_json AS "configJson", overlay_svg AS "overlaySvg",
             primary_icon_svg AS "primaryIconSvg", secondary_icon_svg AS "secondaryIconSvg",
             status, cache_version AS "cacheVersion",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM unqx_theme_configs
      WHERE theme_key = ${key}
        AND status IN ('active', 'public')
      LIMIT 1
    `;
    return mapThemeRow(Array.isArray(rows) ? rows[0] : null);
  } catch (error) {
    if (isThemeConfigStorageMissing(error)) return null;
    throw error;
  }
}

async function upsertThemeConfig(input) {
  const key = normalizeThemeKey(input?.key || input?.themeKey);
  if (!THEME_KEY_RE.test(key)) {
    const error = new Error("Ключ темы должен быть в формате latin_key_123 и начинаться с буквы.");
    error.status = 400;
    throw error;
  }
  const config = normalizeThemeConfig(input?.config, key);
  const title = normalizeTitle(input?.title, key);
  const status = normalizeThemeStatus(input?.status);
  const cardBgOverlay = String(config.cardBgOverlay || key).trim().slice(0, 120);
  const overlaySvg = sanitizeSvg(input?.overlaySvg, { recolor: input?.overlaySvgRecolor !== false });
  const primaryIconSvg = sanitizeSvg(input?.primaryIconSvg, { recolor: input?.primaryIconRecolor !== false });
  const secondaryIconSvg = sanitizeSvg(input?.secondaryIconSvg, { recolor: input?.secondaryIconRecolor !== false });
  const configJson = JSON.stringify(config);
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_theme_configs
      (theme_key, title, card_bg_overlay, config_json, overlay_svg, primary_icon_svg, secondary_icon_svg, status, cache_version)
    VALUES
      (${key}, ${title}, ${cardBgOverlay}, ${configJson}::jsonb, ${overlaySvg || null}, ${primaryIconSvg || null}, ${secondaryIconSvg || null}, ${status}, 1)
    ON CONFLICT (theme_key)
    DO UPDATE SET
      title = EXCLUDED.title,
      card_bg_overlay = EXCLUDED.card_bg_overlay,
      config_json = EXCLUDED.config_json,
      overlay_svg = EXCLUDED.overlay_svg,
      primary_icon_svg = EXCLUDED.primary_icon_svg,
      secondary_icon_svg = EXCLUDED.secondary_icon_svg,
      status = EXCLUDED.status,
      cache_version = unqx_theme_configs.cache_version + 1,
      updated_at = now()
    RETURNING id, theme_key AS "themeKey", title, card_bg_overlay AS "cardBgOverlay",
              config_json AS "configJson", overlay_svg AS "overlaySvg",
              primary_icon_svg AS "primaryIconSvg", secondary_icon_svg AS "secondaryIconSvg",
              status, cache_version AS "cacheVersion",
              created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return mapThemeRow(Array.isArray(rows) ? rows[0] : null);
}

async function deleteThemeConfig(id) {
  const numericId = Math.trunc(Number(id || 0));
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
  const rows = await prisma.$queryRaw`
    DELETE FROM unqx_theme_configs
    WHERE id = ${numericId}
    RETURNING id, theme_key AS "themeKey", title, card_bg_overlay AS "cardBgOverlay",
              config_json AS "configJson", overlay_svg AS "overlaySvg",
              primary_icon_svg AS "primaryIconSvg", secondary_icon_svg AS "secondaryIconSvg",
              status, cache_version AS "cacheVersion",
              created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return mapThemeRow(Array.isArray(rows) ? rows[0] : null);
}

async function updateThemeConfigTitle(id, displayName) {
  const numericId = Math.trunc(Number(id || 0));
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
  const title = normalizeTitle(displayName, "");
  const rows = await prisma.$queryRaw`
    UPDATE unqx_theme_configs
    SET title = ${title},
        cache_version = cache_version + 1,
        updated_at = now()
    WHERE id = ${numericId}
    RETURNING id, theme_key AS "themeKey", title, card_bg_overlay AS "cardBgOverlay",
              config_json AS "configJson", overlay_svg AS "overlaySvg",
              primary_icon_svg AS "primaryIconSvg", secondary_icon_svg AS "secondaryIconSvg",
              status, cache_version AS "cacheVersion",
              created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return mapThemeRow(Array.isArray(rows) ? rows[0] : null);
}

module.exports = {
  REQUIRED_CONFIG_KEYS,
  deleteThemeConfig,
  findPublicThemeConfigByKey,
  listThemeConfigs,
  normalizeThemeConfig,
  sanitizeSvg,
  updateThemeConfigTitle,
  upsertThemeConfig,
};
