const mobileRegex = /android|iphone|ipad|ipod|iemobile|opera mini|mobile|blackberry|webos/i;

function detectDevice(userAgent) {
  if (!userAgent) {
    return "desktop";
  }

  return mobileRegex.test(userAgent) ? "mobile" : "desktop";
}

module.exports = {
  detectDevice,
};