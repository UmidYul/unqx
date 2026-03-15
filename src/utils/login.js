const LOGIN_MIN_LENGTH = 3;
const LOGIN_MAX_LENGTH = 190;
const LOGIN_REGEX = /^[a-z0-9._@+-]+$/;

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidLogin(value) {
  const normalized = normalizeLogin(value);
  if (normalized.length < LOGIN_MIN_LENGTH || normalized.length > LOGIN_MAX_LENGTH) {
    return false;
  }
  return LOGIN_REGEX.test(normalized);
}

module.exports = {
  LOGIN_MIN_LENGTH,
  LOGIN_MAX_LENGTH,
  LOGIN_REGEX,
  normalizeLogin,
  isValidLogin,
};
