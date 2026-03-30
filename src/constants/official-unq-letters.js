/**
 * Латинские префиксы UNQ, совпадающие с узбекскими «гос»-сериями номеров (только буквы, без учёта цифр).
 * Список расширяйте при необходимости; фронтенд: public/js/official-unq-letters.js
 */
const OFFICIAL_UNQ_LETTER_PREFIXES = new Set(["DAV", "PPP", "PAA", "UZB"]);

function normalizeLettersThree(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function isOfficialUnqLetters(letters) {
  const L = normalizeLettersThree(letters);
  return L.length === 3 && OFFICIAL_UNQ_LETTER_PREFIXES.has(L);
}

function isOfficialUnqSlug(fullSlug) {
  const raw = String(fullSlug || "").toUpperCase().replace(/\s/g, "");
  const m = raw.match(/^([A-Z]{3})[0-9]{3}$/);
  return m ? OFFICIAL_UNQ_LETTER_PREFIXES.has(m[1]) : false;
}

module.exports = {
  OFFICIAL_UNQ_LETTER_PREFIXES,
  isOfficialUnqLetters,
  isOfficialUnqSlug,
};
