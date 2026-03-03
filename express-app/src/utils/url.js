const { env } = require("../config/env");

function getBaseUrl() {
  return env.APP_URL;
}

function absoluteUrl(pathname) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getBaseUrl()}${normalizedPath}`;
}

module.exports = {
  getBaseUrl,
  absoluteUrl,
};