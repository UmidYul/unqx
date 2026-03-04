const { prisma } = require("../db/prisma");

const SLUG_PATTERN = /^[A-Z]{3}[0-9]{3}$/;

function normalizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function hasSequentialDigits(digits) {
  if (!/^[0-9]{3}$/.test(digits)) return false;
  const a = Number(digits[0]);
  const b = Number(digits[1]);
  const c = Number(digits[2]);
  return b - a === 1 && c - b === 1;
}

function resolveConditionLabel(sale) {
  if (!sale) return "";
  switch (sale.conditionType) {
    case "all":
      return "все slug";
    case "pattern_000":
      return "slug с 000";
    case "pattern_aaa":
      return "slug с одинаковыми буквами";
    case "sequential_digits":
      return "slug с последовательными цифрами";
    default:
      return "выбранные slug";
  }
}

function isSlugMatchedByFlashSale({ slug, sale }) {
  if (!sale) return false;
  const normalized = normalizeSlug(slug);
  if (!SLUG_PATTERN.test(normalized)) return false;
  const letters = normalized.slice(0, 3);
  const digits = normalized.slice(3);

  if (sale.conditionType === "all") return true;
  if (sale.conditionType === "pattern_000") return digits === "000";
  if (sale.conditionType === "pattern_aaa") return letters[0] === letters[1] && letters[1] === letters[2];
  if (sale.conditionType === "sequential_digits") return hasSequentialDigits(digits);
  if (sale.conditionType === "custom") {
    const payload = sale.conditionValue && typeof sale.conditionValue === "object" ? sale.conditionValue : {};
    if (Array.isArray(payload.allowedSlugs)) {
      const set = new Set(payload.allowedSlugs.map((item) => normalizeSlug(item)));
      return set.has(normalized);
    }
    return false;
  }

  return false;
}

async function getActiveFlashSale() {
  if (!prisma.flashSale || typeof prisma.flashSale.findFirst !== "function") {
    return null;
  }
  const now = new Date();
  return prisma.flashSale.findFirst({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: [{ startsAt: "desc" }],
  });
}

function applyFlashSaleToPrice({ slug, basePrice, sale }) {
  if (!sale || !isSlugMatchedByFlashSale({ slug, sale })) {
    return {
      hasDiscount: false,
      basePrice,
      finalPrice: basePrice,
      discountAmount: 0,
      discountPercent: 0,
    };
  }

  const percent = Math.max(1, Math.min(95, Number(sale.discountPercent) || 0));
  const discountAmount = Math.floor((basePrice * percent) / 100);
  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    hasDiscount: true,
    basePrice,
    finalPrice,
    discountAmount,
    discountPercent: percent,
  };
}

module.exports = {
  normalizeSlug,
  getActiveFlashSale,
  isSlugMatchedByFlashSale,
  applyFlashSaleToPrice,
  resolveConditionLabel,
};
