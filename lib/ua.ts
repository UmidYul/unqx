const mobileRegex = /android|iphone|ipad|ipod|iemobile|opera mini|mobile|blackberry|webos/i;

export function detectDevice(userAgent?: string | null): "mobile" | "desktop" {
  if (!userAgent) {
    return "desktop";
  }

  return mobileRegex.test(userAgent) ? "mobile" : "desktop";
}
