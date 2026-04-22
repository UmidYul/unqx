const { timingSafeEqual } = require("node:crypto");

function safeSecretEqual(candidate, expected) {
  const left = Buffer.from(String(candidate || ""), "utf8");
  const right = Buffer.from(String(expected || ""), "utf8");
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function normalizeAuthorizationSecret(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const bearerMatch = raw.match(/^bearer\s+(.+)$/i);
  return bearerMatch ? String(bearerMatch[1] || "").trim() : raw;
}

module.exports = {
  safeSecretEqual,
  normalizeAuthorizationSecret,
};
