const { getManySettings } = require("./platform-settings");

const DEFAULTS = {
  basePrice: 100_000,
  lettersAllSame: 5,
  lettersSequential: 3,
  lettersPalindrome: 2,
  lettersRandom: 1,
  digitsZeros: 6,
  digitsNearZero: 4,
  digitsAllSame: 4,
  digitsSequential: 3,
  digitsRound: 2,
  digitsPalindrome: 1.5,
  digitsRandom: 1,
};

function normalizeConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  const getNum = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0.1, Math.min(100, parsed));
  };
  return {
    basePrice: Math.max(0, Math.round(Number(source.basePrice ?? DEFAULTS.basePrice) || DEFAULTS.basePrice)),
    lettersAllSame: getNum(source.lettersAllSame, DEFAULTS.lettersAllSame),
    lettersSequential: getNum(source.lettersSequential, DEFAULTS.lettersSequential),
    lettersPalindrome: getNum(source.lettersPalindrome, DEFAULTS.lettersPalindrome),
    lettersRandom: getNum(source.lettersRandom, DEFAULTS.lettersRandom),
    digitsZeros: getNum(source.digitsZeros, DEFAULTS.digitsZeros),
    digitsNearZero: getNum(source.digitsNearZero, DEFAULTS.digitsNearZero),
    digitsAllSame: getNum(source.digitsAllSame, DEFAULTS.digitsAllSame),
    digitsSequential: getNum(source.digitsSequential, DEFAULTS.digitsSequential),
    digitsRound: getNum(source.digitsRound, DEFAULTS.digitsRound),
    digitsPalindrome: getNum(source.digitsPalindrome, DEFAULTS.digitsPalindrome),
    digitsRandom: getNum(source.digitsRandom, DEFAULTS.digitsRandom),
  };
}

async function getSlugPricingConfig() {
  const values = await getManySettings([
    "slug_base_price",
    "slug_mult_letters_all_same",
    "slug_mult_letters_sequential",
    "slug_mult_letters_palindrome",
    "slug_mult_letters_random",
    "slug_mult_digits_zeros",
    "slug_mult_digits_near_zero",
    "slug_mult_digits_all_same",
    "slug_mult_digits_sequential",
    "slug_mult_digits_round",
    "slug_mult_digits_palindrome",
    "slug_mult_digits_random",
  ]);
  return normalizeConfig({
    basePrice: values.slug_base_price,
    lettersAllSame: values.slug_mult_letters_all_same,
    lettersSequential: values.slug_mult_letters_sequential,
    lettersPalindrome: values.slug_mult_letters_palindrome,
    lettersRandom: values.slug_mult_letters_random,
    digitsZeros: values.slug_mult_digits_zeros,
    digitsNearZero: values.slug_mult_digits_near_zero,
    digitsAllSame: values.slug_mult_digits_all_same,
    digitsSequential: values.slug_mult_digits_sequential,
    digitsRound: values.slug_mult_digits_round,
    digitsPalindrome: values.slug_mult_digits_palindrome,
    digitsRandom: values.slug_mult_digits_random,
  });
}

function getLetterMultiplier(letters, config = DEFAULTS) {
  const upper = String(letters || "").toUpperCase();
  if (upper.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const [a, b, c] = upper.split("");

  if (a === b && b === c) {
    return { multiplier: config.lettersAllSame, label: "Все одинаковые" };
  }

  const ca = a.charCodeAt(0);
  const cb = b.charCodeAt(0);
  const cc = c.charCodeAt(0);
  if (cb - ca === 1 && cc - cb === 1) {
    return { multiplier: config.lettersSequential, label: "По порядку" };
  }

  if (a === c && a !== b) {
    return { multiplier: config.lettersPalindrome, label: "Палиндром" };
  }

  return { multiplier: config.lettersRandom, label: "Обычные" };
}

function getDigitMultiplier(digits, config = DEFAULTS) {
  const normalized = String(digits || "");
  if (normalized.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const num = Number.parseInt(normalized, 10);
  const [d1, d2, d3] = normalized.split("");

  if (normalized === "000") {
    return { multiplier: config.digitsZeros, label: "Тройной ноль" };
  }

  if (num >= 1 && num <= 9 && normalized.startsWith("00")) {
    return { multiplier: config.digitsNearZero, label: "Первые девять" };
  }

  if (d1 === d2 && d2 === d3) {
    return { multiplier: config.digitsAllSame, label: "Все одинаковые" };
  }

  const n1 = Number.parseInt(d1, 10);
  const n2 = Number.parseInt(d2, 10);
  const n3 = Number.parseInt(d3, 10);
  if (n2 - n1 === 1 && n3 - n2 === 1) {
    return { multiplier: config.digitsSequential, label: "По порядку" };
  }

  if (num % 100 === 0 && num > 0) {
    return { multiplier: config.digitsRound, label: "Круглое" };
  }

  if (d1 === d3 && d1 !== d2) {
    return { multiplier: config.digitsPalindrome, label: "Палиндром" };
  }

  return { multiplier: config.digitsRandom, label: "Обычные" };
}

function calculateSlugPrice({ letters, digits, config }) {
  const resolvedConfig = normalizeConfig(config || DEFAULTS);
  const normalizedLetters = String(letters || "").toUpperCase();
  const normalizedDigits = String(digits || "");
  const letterMeta = getLetterMultiplier(normalizedLetters, resolvedConfig);
  const digitMeta = getDigitMultiplier(normalizedDigits, resolvedConfig);
  const total = resolvedConfig.basePrice * letterMeta.multiplier * digitMeta.multiplier;

  return {
    basePrice: resolvedConfig.basePrice,
    slug: `${normalizedLetters}${normalizedDigits}`,
    letters: letterMeta,
    digits: digitMeta,
    total,
  };
}

async function calculateSlugPriceFromSettings({ letters, digits }) {
  const config = await getSlugPricingConfig();
  return calculateSlugPrice({ letters, digits, config });
}

module.exports = {
  BASE_PRICE: DEFAULTS.basePrice,
  DEFAULTS,
  normalizeConfig,
  getSlugPricingConfig,
  getLetterMultiplier,
  getDigitMultiplier,
  calculateSlugPrice,
  calculateSlugPriceFromSettings,
};
