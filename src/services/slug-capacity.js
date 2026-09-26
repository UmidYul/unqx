const LEGACY_SLUG_TOTAL_LIMIT = 17_576;
const CURRENT_SLUG_TOTAL_LIMIT = 17_576_000;

function resolveSlugTotalLimit(value, fallback = CURRENT_SLUG_TOTAL_LIMIT) {
  const parsed = Number(value);
  if (parsed === LEGACY_SLUG_TOTAL_LIMIT) {
    return CURRENT_SLUG_TOTAL_LIMIT;
  }
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  const fallbackParsed = Number(fallback);
  if (fallbackParsed === LEGACY_SLUG_TOTAL_LIMIT) {
    return CURRENT_SLUG_TOTAL_LIMIT;
  }
  return Number.isFinite(fallbackParsed) && fallbackParsed > 0 ? fallbackParsed : CURRENT_SLUG_TOTAL_LIMIT;
}

module.exports = {
  CURRENT_SLUG_TOTAL_LIMIT,
  LEGACY_SLUG_TOTAL_LIMIT,
  resolveSlugTotalLimit,
};
