const { getManySettings } = require("./platform-settings");

const SETTING_KEYS = {
  prefixes: "official_unq_letter_prefixes",
  calculatorHint: "official_unq_calculator_hint",
  purchaseTitle: "official_unq_purchase_notice_title",
  purchaseBody: "official_unq_purchase_notice_body",
  profileTitle: "official_unq_profile_badge_title",
  profileLine: "official_unq_profile_badge_line",
};

const FALLBACK = {
  prefixes: ["DAV", "PPP", "PAA", "UZB"],
  calculatorHint:
    "Серии вроде госномеров (определённые три буквы латиницы) резервируются только по согласованию с администрацией и руководством проекта.",
  purchaseNoticeTitle: "Официальная серия",
  purchaseNoticeBody:
    "Такой UNQ можно приобрести только после согласования с администрацией и руководством UNQX. Эти буквенные комбинации предназначены для ограниченного круга владельцев.",
  profileBadgeTitle: "Официальная серия UNQ",
  profileBadgeLine:
    "Закрепление согласовано с администрацией и руководством платформы.",
};

function normalizeOfficialUnqPrefixes(raw) {
  const arr = Array.isArray(raw) ? raw : null;
  const source = arr && arr.length ? arr : FALLBACK.prefixes;
  const out = [];
  const seen = new Set();
  for (const item of source) {
    const L = String(item || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
    if (L.length === 3 && !seen.has(L)) {
      seen.add(L);
      out.push(L);
    }
  }
  return out.length ? out : [...FALLBACK.prefixes];
}

function isOfficialUnqSlugWithPrefixes(fullSlug, prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : FALLBACK.prefixes;
  const set = list instanceof Set ? list : new Set(list);
  const m = String(fullSlug || "")
    .toUpperCase()
    .replace(/\s/g, "")
    .match(/^([A-Z]{3})[0-9]{3}$/);
  return m ? set.has(m[1]) : false;
}

function nonEmptyOr(raw, fallback) {
  const s = String(raw ?? "").trim();
  return s || fallback;
}

async function getOfficialUnqClientConfig() {
  const raw = await getManySettings([
    SETTING_KEYS.prefixes,
    SETTING_KEYS.calculatorHint,
    SETTING_KEYS.purchaseTitle,
    SETTING_KEYS.purchaseBody,
    SETTING_KEYS.profileTitle,
    SETTING_KEYS.profileLine,
  ]);
  const prefixes = normalizeOfficialUnqPrefixes(raw[SETTING_KEYS.prefixes]);
  return {
    prefixes,
    calculatorHint: String(raw[SETTING_KEYS.calculatorHint] ?? FALLBACK.calculatorHint),
    purchaseNoticeTitle: String(raw[SETTING_KEYS.purchaseTitle] ?? FALLBACK.purchaseNoticeTitle),
    purchaseNoticeBody: String(raw[SETTING_KEYS.purchaseBody] ?? FALLBACK.purchaseNoticeBody),
    profileBadgeTitle: nonEmptyOr(raw[SETTING_KEYS.profileTitle], FALLBACK.profileBadgeTitle),
    profileBadgeLine: nonEmptyOr(raw[SETTING_KEYS.profileLine], FALLBACK.profileBadgeLine),
  };
}

module.exports = {
  SETTING_KEYS,
  FALLBACK,
  normalizeOfficialUnqPrefixes,
  isOfficialUnqSlugWithPrefixes,
  getOfficialUnqClientConfig,
};
