function detectDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) {
    return "desktop";
  }

  if (/(iphone|ipad|ipod|ios)/i.test(ua)) {
    return "ios";
  }
  if (/android/i.test(ua)) {
    return "android";
  }
  return "desktop";
}

module.exports = {
  detectDevice,
};
