const LEGACY_SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;
const MANAGED_NUMERIC_USERNAME_REGEX = /^(0|[1-9][0-9]{0,2})$/;
const MANAGED_ALPHA_USERNAME_REGEX = /^[A-Z]{1,3}$/;

const RESERVED_SLUG_PATHS = new Set([
  "ADMIN",
  "API",
  "AUTH",
  "BADGES",
  "CHILD-SAFETY",
  "DIRECTORY",
  "DROPS",
  "FAQ",
  "FORGOT-PASSWORD",
  "GUIDES",
  "LEADERBOARD",
  "LOGIN",
  "LOGOUT",
  "MANAGER",
  "MAINTENANCE",
  "PAYMENT",
  "PAYMENTS",
  "POLICY",
  "PROFILE",
  "QR",
  "REGISTER",
  "RESET-PASSWORD",
  "ROBOTS",
  "ROBOTS.TXT",
  "SITEMAP",
  "SITEMAP.XML",
  "TERMS",
  "UNQX-GAME",
  "VERIFY-EMAIL",
]);

function normalizeSlugInput(value, maxLength = 20) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, maxLength);
}

function normalizeAssignableSlug(value) {
  return normalizeSlugInput(value);
}

function prefixToNumber(prefix) {
  return prefix.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 65), 0);
}

function numberToPrefix(value) {
  const chars = [0, 0, 0];
  let n = value;

  for (let i = 2; i >= 0; i -= 1) {
    chars[i] = n % 26;
    n = Math.floor(n / 26);
  }

  return chars.map((v) => String.fromCharCode(65 + v)).join("");
}

function isLegacySlug(slug) {
  return LEGACY_SLUG_REGEX.test(String(slug || ""));
}

function isValidSlug(slug) {
  return isLegacySlug(slug);
}

function isReservedSlugPath(slug) {
  return RESERVED_SLUG_PATHS.has(String(slug || "").toUpperCase());
}

function isManagedUsernameSlug(slug) {
  const normalized = String(slug || "").toUpperCase();
  if (isReservedSlugPath(normalized)) return false;
  return MANAGED_NUMERIC_USERNAME_REGEX.test(normalized) || MANAGED_ALPHA_USERNAME_REGEX.test(normalized);
}

function isAssignableSlug(slug) {
  const normalized = String(slug || "").toUpperCase();
  if (isReservedSlugPath(normalized)) return false;
  return isLegacySlug(normalized) || isManagedUsernameSlug(normalized);
}

function getAssignableSlugType(slug) {
  const normalized = String(slug || "").toUpperCase();
  if (!isAssignableSlug(normalized)) return "";
  return isLegacySlug(normalized) ? "legacy" : "username";
}

function getSlugStorageParts(slug) {
  const normalized = normalizeAssignableSlug(slug);
  if (isLegacySlug(normalized)) {
    return {
      letters: normalized.slice(0, 3),
      digits: normalized.slice(3),
    };
  }
  if (MANAGED_ALPHA_USERNAME_REGEX.test(normalized) && !isReservedSlugPath(normalized)) {
    return {
      letters: normalized,
      digits: "",
    };
  }
  if (MANAGED_NUMERIC_USERNAME_REGEX.test(normalized)) {
    return {
      letters: "",
      digits: normalized,
    };
  }
  return {
    letters: "",
    digits: "",
  };
}

function slugToSequence(slug) {
  if (!isValidSlug(slug)) {
    throw new Error("Invalid slug format");
  }

  const prefix = slug.slice(0, 3);
  const suffix = Number(slug.slice(3));
  return prefixToNumber(prefix) * 1000 + suffix;
}

function getNextSlug(current) {
  if (!current) {
    return "AAA001";
  }

  if (!isValidSlug(current)) {
    throw new Error("Invalid slug format");
  }

  const prefix = current.slice(0, 3);
  const number = Number(current.slice(3));

  if (number < 999) {
    return `${prefix}${String(number + 1).padStart(3, "0")}`;
  }

  const prefixNumber = prefixToNumber(prefix);
  if (prefixNumber >= 26 * 26 * 26 - 1) {
    throw new Error("Slug namespace exhausted");
  }

  return `${numberToPrefix(prefixNumber + 1)}001`;
}

function compareSlugs(a, b) {
  return slugToSequence(a) - slugToSequence(b);
}

module.exports = {
  LEGACY_SLUG_REGEX,
  RESERVED_SLUG_PATHS,
  getAssignableSlugType,
  getSlugStorageParts,
  isValidSlug,
  isLegacySlug,
  isManagedUsernameSlug,
  isAssignableSlug,
  isReservedSlugPath,
  normalizeSlugInput,
  normalizeAssignableSlug,
  slugToSequence,
  getNextSlug,
  compareSlugs,
};
