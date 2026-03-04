const { prisma } = require("../db/prisma");

const SLUG_PATTERN = /^[A-Z]{3}[0-9]{3}$/;
const ALPHABET_SIZE = 26;
const DIGIT_VARIANTS = 1000;
const SEQUENTIAL_DIGITS = ["012", "123", "234", "345", "456", "567", "678", "789"];

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

async function getFlashSaleSlotsLeft(sale) {
  if (!sale || !prisma.slug || typeof prisma.slug.count !== "function") {
    return null;
  }

  try {
    if (sale.conditionType === "custom") {
      const payload = sale.conditionValue && typeof sale.conditionValue === "object" ? sale.conditionValue : {};
      const allowed = Array.isArray(payload.allowedSlugs)
        ? Array.from(
            new Set(
              payload.allowedSlugs
                .map((item) => normalizeSlug(item))
                .filter((item) => SLUG_PATTERN.test(item)),
            ),
          )
        : [];
      if (!allowed.length) {
        return null;
      }
      const taken = await prisma.slug.count({
        where: {
          fullSlug: { in: allowed },
          status: { not: "free" },
        },
      });
      return Math.max(0, allowed.length - taken);
    }

    if (sale.conditionType === "pattern_000") {
      const total = ALPHABET_SIZE ** 3;
      const taken = await prisma.slug.count({
        where: {
          digits: "000",
          status: { not: "free" },
        },
      });
      return Math.max(0, total - taken);
    }

    if (sale.conditionType === "pattern_aaa") {
      const repeated = Array.from({ length: ALPHABET_SIZE }, (_, index) => {
        const letter = String.fromCharCode(65 + index);
        return `${letter}${letter}${letter}`;
      });
      const total = ALPHABET_SIZE * DIGIT_VARIANTS;
      const taken = await prisma.slug.count({
        where: {
          letters: { in: repeated },
          status: { not: "free" },
        },
      });
      return Math.max(0, total - taken);
    }

    if (sale.conditionType === "sequential_digits") {
      const total = ALPHABET_SIZE ** 3 * SEQUENTIAL_DIGITS.length;
      const taken = await prisma.slug.count({
        where: {
          digits: { in: SEQUENTIAL_DIGITS },
          status: { not: "free" },
        },
      });
      return Math.max(0, total - taken);
    }
  } catch (error) {
    console.error("[express-app] failed to resolve flash sale slots left", error);
    return null;
  }

  return null;
}

module.exports = {
  normalizeSlug,
  getActiveFlashSale,
  getFlashSaleSlotsLeft,
  isSlugMatchedByFlashSale,
  applyFlashSaleToPrice,
  resolveConditionLabel,
};
