const { prisma } = require("../db/prisma");

const SLUG_PATTERN = /^[A-Z]{3}[0-9]{3}$/;
const SLUG_MASK_PATTERN = /^[A-Z0-9*?]{6}$/;
const SHORT_LETTER_MASK_PATTERN = /^[A-Z*?]{3}$/;
const SHORT_DIGIT_MASK_PATTERN = /^[0-9*?]{3}$/;
const LETTERS_PATTERN = /^[A-Z]{3}$/;
const DIGITS_PATTERN = /^[0-9]{3}$/;
const FLASH_MATCH_MODES = new Set(["any", "all"]);
const ALPHABET_SIZE = 26;
const DIGIT_VARIANTS = 1000;
const SEQUENTIAL_DIGITS = ["012", "123", "234", "345", "456", "567", "678", "789"];

function normalizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function normalizeLetters(value) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return LETTERS_PATTERN.test(cleaned) ? cleaned : "";
}

function normalizeDigits(value) {
  const cleaned = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 3);
  return DIGITS_PATTERN.test(cleaned) ? cleaned : "";
}

function hasSequentialDigits(digits) {
  if (!/^[0-9]{3}$/.test(digits)) return false;
  const a = Number(digits[0]);
  const b = Number(digits[1]);
  const c = Number(digits[2]);
  return b - a === 1 && c - b === 1;
}

function normalizeCustomPattern(value) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9*?]/g, "");
  if (!cleaned) return null;
  if (SLUG_MASK_PATTERN.test(cleaned)) return cleaned;
  if (SHORT_LETTER_MASK_PATTERN.test(cleaned)) return `${cleaned}***`;
  if (SHORT_DIGIT_MASK_PATTERN.test(cleaned)) return `***${cleaned}`;
  return null;
}

function isSlugMatchingMask(slug, mask) {
  const normalizedMask = normalizeCustomPattern(mask);
  if (!normalizedMask) return false;
  for (let index = 0; index < 6; index += 1) {
    const expected = normalizedMask[index];
    if (expected === "*" || expected === "?") continue;
    if (slug[index] !== expected) return false;
  }
  return true;
}

function normalizeRule(type, value) {
  const normalizedType = String(type || "").trim().toLowerCase();
  if (normalizedType === "slug") {
    const slug = normalizeSlug(value);
    return SLUG_PATTERN.test(slug) ? { type: "slug", value: slug } : null;
  }
  if (normalizedType === "mask") {
    const mask = normalizeCustomPattern(value);
    return mask ? { type: "mask", value: mask } : null;
  }
  if (normalizedType === "letters") {
    const letters = normalizeLetters(value);
    return letters ? { type: "letters", value: letters } : null;
  }
  if (normalizedType === "digits") {
    const digits = normalizeDigits(value);
    return digits ? { type: "digits", value: digits } : null;
  }
  return null;
}

function normalizeFlashCustomPayload(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const includeRules = [];
  const excludeRules = [];
  const seen = new Set();

  const pushRule = (rawRule, fallbackTarget) => {
    const src = rawRule && typeof rawRule === "object" ? rawRule : {};
    const normalized = normalizeRule(src.type, src.value);
    if (!normalized) return;
    const target = src.exclude ? "exclude" : fallbackTarget;
    const dedupeKey = `${target}:${normalized.type}:${normalized.value}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (target === "exclude") excludeRules.push(normalized);
    else includeRules.push(normalized);
  };

  if (Array.isArray(payload.includeRules)) {
    payload.includeRules.forEach((rule) => pushRule(rule, "include"));
  }
  if (Array.isArray(payload.excludeRules)) {
    payload.excludeRules.forEach((rule) => pushRule(rule, "exclude"));
  }
  if (Array.isArray(payload.rules)) {
    payload.rules.forEach((rule) => {
      const op = String(rule?.op || "").trim().toLowerCase();
      pushRule(rule, op === "exclude" ? "exclude" : "include");
    });
  }

  const allowed = Array.isArray(payload.allowedSlugs)
    ? Array.from(
        new Set(
          payload.allowedSlugs
            .map((item) => normalizeSlug(item))
            .filter((item) => SLUG_PATTERN.test(item)),
        ),
      )
    : [];
  const patterns = Array.isArray(payload.slugPatterns)
    ? Array.from(new Set(payload.slugPatterns.map((item) => normalizeCustomPattern(item)).filter(Boolean)))
    : [];

  for (const slug of allowed) {
    pushRule({ type: "slug", value: slug }, "include");
  }
  for (const mask of patterns) {
    pushRule({ type: "mask", value: mask }, "include");
  }

  const matchMode = FLASH_MATCH_MODES.has(String(payload.matchMode || "").toLowerCase())
    ? String(payload.matchMode).toLowerCase()
    : "any";

  return {
    matchMode,
    includeRules,
    excludeRules,
  };
}

function isRuleMatched(slug, rule) {
  if (!rule || typeof rule !== "object") return false;
  if (rule.type === "slug") return slug === rule.value;
  if (rule.type === "mask") return isSlugMatchingMask(slug, rule.value);
  if (rule.type === "letters") return slug.slice(0, 3) === rule.value;
  if (rule.type === "digits") return slug.slice(3) === rule.value;
  return false;
}

function pluralizeRu(count, one, few, many) {
  const abs = Math.abs(Number(count) || 0);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function buildMaskExample(mask) {
  const normalizedMask = normalizeCustomPattern(mask);
  if (!normalizedMask) return "";
  const letterFallback = ["A", "B", "C"];
  const digitFallback = ["1", "2", "3"];
  return normalizedMask
    .split("")
    .map((char, index) => {
      if (char !== "*" && char !== "?") {
        return char;
      }
      return index < 3 ? letterFallback[index] : digitFallback[index - 3];
    })
    .join("");
}

function formatFlashRuleLabel(rule) {
  if (!rule || typeof rule !== "object") return "";
  switch (rule.type) {
    case "slug":
      return `Точный UNQ: ${rule.value}`;
    case "mask":
      return `Маска: ${rule.value}`;
    case "letters":
      return `Первые 3 буквы: ${rule.value}`;
    case "digits":
      return `Последние 3 цифры: ${rule.value}`;
    default:
      return "";
  }
}

function buildFlashRuleExample(rule) {
  if (!rule || typeof rule !== "object") return "";
  switch (rule.type) {
    case "slug":
      return rule.value;
    case "mask":
      return buildMaskExample(rule.value);
    case "letters":
      return `${rule.value}123`;
    case "digits":
      return `ABC${rule.value}`;
    default:
      return "";
  }
}

function resolveConditionLabel(sale) {
  if (!sale) return "";
  switch (sale.conditionType) {
    case "all":
      return "Все UNQ";
    case "pattern_000":
      return "UNQ с цифрами 000";
    case "pattern_aaa":
      return "UNQ с одинаковыми буквами (AAA)";
    case "sequential_digits":
      return "UNQ с последовательными цифрами";
    case "custom": {
      const payload = normalizeFlashCustomPayload(sale.conditionValue);
      const includeCount = payload.includeRules.length;
      const excludeCount = payload.excludeRules.length;
      if (includeCount > 0 && excludeCount > 0) {
        return `Кастом: ${includeCount} ${pluralizeRu(includeCount, "правило", "правила", "правил")}, ${excludeCount} ${pluralizeRu(excludeCount, "исключение", "исключения", "исключений")}`;
      }
      if (includeCount > 0) {
        return `Кастом: ${includeCount} ${pluralizeRu(includeCount, "правило", "правила", "правил")}`;
      }
      return "Кастомные правила";
    }
    default:
      return "Кастомные правила";
  }
}

function resolveFlashSalePresentation(sale) {
  if (!sale) {
    return {
      conditionLabel: "",
      explanation: "",
      purchaseHint: "",
      matchModeLabel: "",
      includeRules: [],
      excludeRules: [],
      examples: [],
      outcomeHint: "",
    };
  }

  const conditionLabel = resolveConditionLabel(sale);
  const payload = sale.conditionType === "custom" ? normalizeFlashCustomPayload(sale.conditionValue) : null;
  const includeRules = payload ? payload.includeRules.map(formatFlashRuleLabel).filter(Boolean) : [];
  const excludeRules = payload ? payload.excludeRules.map(formatFlashRuleLabel).filter(Boolean) : [];
  const baseExamples = [];
  let explanation = "";
  let matchModeLabel = "";

  switch (sale.conditionType) {
    case "all":
      explanation = "Скидка действует на любой свободный UNQ. Выберите понравившийся slug, и цена уменьшится автоматически.";
      baseExamples.push("ABC123", "UNQ777", "WOW000");
      break;
    case "pattern_000":
      explanation = "Скидка действует на свободные UNQ, у которых последние три цифры равны 000.";
      baseExamples.push("AAA000", "UNQ000", "WOW000");
      break;
    case "pattern_aaa":
      explanation = "Скидка действует на свободные UNQ, где первые три буквы одинаковые.";
      baseExamples.push("AAA123", "WOW777", "ZZZ010");
      break;
    case "sequential_digits":
      explanation = "Скидка действует на свободные UNQ, где последние три цифры идут по порядку: 123, 234, 345 и дальше до 789.";
      baseExamples.push("ABC123", "WOW456", "UNQ789");
      break;
    case "custom": {
      explanation = "Скидка действует только на UNQ, которые соответствуют правилам акции ниже.";
      if (payload?.matchMode === "all") {
        matchModeLabel = "UNQ должен одновременно совпасть со всеми правилами акции.";
      } else {
        matchModeLabel = "Достаточно совпасть хотя бы с одним правилом акции.";
      }
      payload?.includeRules.forEach((rule) => {
        const example = buildFlashRuleExample(rule);
        if (example) {
          baseExamples.push(example);
        }
      });
      break;
    }
    default:
      explanation = "Скидка действует на выбранные UNQ в рамках активной акции.";
      break;
  }

  if (!matchModeLabel && sale.conditionType !== "custom") {
    matchModeLabel = "Если ваш UNQ подходит под условие, скидка применяется автоматически на этапе покупки.";
  }

  const examples = Array.from(
    new Set(baseExamples.map((item) => normalizeSlug(item)).filter((item) => SLUG_PATTERN.test(item))),
  ).slice(0, 6);

  return {
    conditionLabel,
    explanation,
    purchaseHint: "Введите свой UNQ ниже. Если он участвует в акции, мы сразу покажем цену со скидкой.",
    matchModeLabel,
    includeRules,
    excludeRules,
    examples,
    outcomeHint: "Если UNQ не подходит под условия акции, останется обычная цена без скидки.",
  };
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
    const payload = normalizeFlashCustomPayload(sale.conditionValue);
    if (!payload.includeRules.length) return false;
    if (payload.excludeRules.some((rule) => isRuleMatched(normalized, rule))) {
      return false;
    }
    if (payload.matchMode === "all") {
      return payload.includeRules.every((rule) => isRuleMatched(normalized, rule));
    }
    return payload.includeRules.some((rule) => isRuleMatched(normalized, rule));
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

async function getActiveFlashSaleForSlug(slug) {
  if (!prisma.flashSale || typeof prisma.flashSale.findMany !== "function") {
    return null;
  }
  const normalized = normalizeSlug(slug);
  if (!SLUG_PATTERN.test(normalized)) {
    return null;
  }
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: [{ discountPercent: "desc" }, { startsAt: "desc" }],
    take: 50,
  });
  return selectBestFlashSaleForSlug(sales, normalized);
}

function selectBestFlashSaleForSlug(sales, slug) {
  const normalized = normalizeSlug(slug);
  if (!SLUG_PATTERN.test(normalized) || !Array.isArray(sales)) {
    return null;
  }
  return sales
    .filter((sale) => isSlugMatchedByFlashSale({ slug: normalized, sale }))
    .sort((a, b) => {
      const discountDelta = Number(b?.discountPercent || 0) - Number(a?.discountPercent || 0);
      if (discountDelta) return discountDelta;
      return new Date(b?.startsAt || 0).getTime() - new Date(a?.startsAt || 0).getTime();
    })[0] || null;
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
      const payload = normalizeFlashCustomPayload(sale.conditionValue);
      if (payload.matchMode !== "any" || payload.excludeRules.length > 0) {
        return null;
      }
      if (!payload.includeRules.length || !payload.includeRules.every((rule) => rule.type === "slug")) {
        return null;
      }
      const allowed = Array.from(new Set(payload.includeRules.map((rule) => rule.value))).filter((item) => SLUG_PATTERN.test(item));
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
  getActiveFlashSaleForSlug,
  selectBestFlashSaleForSlug,
  getFlashSaleSlotsLeft,
  isSlugMatchedByFlashSale,
  applyFlashSaleToPrice,
  resolveConditionLabel,
  resolveFlashSalePresentation,
};
