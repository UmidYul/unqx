function normalizeRefCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 40);
}

function normalizeSource(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return normalized || "order_modal";
}

function normalizeOffer(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]/g, "")
    .slice(0, 80);
  return normalized || "default";
}

module.exports = {
  normalizeRefCode,
  normalizeSource,
  normalizeOffer,
};
