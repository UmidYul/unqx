const BASE_PRICE = 100_000;

function getLetterMultiplier(letters) {
  const upper = String(letters || "").toUpperCase();
  if (upper.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const [a, b, c] = upper.split("");

  if (a === b && b === c) {
    return { multiplier: 5, label: "Все одинаковые" };
  }

  const ca = a.charCodeAt(0);
  const cb = b.charCodeAt(0);
  const cc = c.charCodeAt(0);
  if (cb - ca === 1 && cc - cb === 1) {
    return { multiplier: 3, label: "По порядку" };
  }

  if (a === c && a !== b) {
    return { multiplier: 2, label: "Палиндром" };
  }

  return { multiplier: 1, label: "Обычные" };
}

function getDigitMultiplier(digits) {
  const normalized = String(digits || "");
  if (normalized.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const num = Number.parseInt(normalized, 10);
  const [d1, d2, d3] = normalized.split("");

  if (normalized === "000") {
    return { multiplier: 6, label: "Тройной ноль" };
  }

  if (num >= 1 && num <= 9 && normalized.startsWith("00")) {
    return { multiplier: 4, label: "Первые девять" };
  }

  if (d1 === d2 && d2 === d3) {
    return { multiplier: 4, label: "Все одинаковые" };
  }

  const n1 = Number.parseInt(d1, 10);
  const n2 = Number.parseInt(d2, 10);
  const n3 = Number.parseInt(d3, 10);
  if (n2 - n1 === 1 && n3 - n2 === 1) {
    return { multiplier: 3, label: "По порядку" };
  }

  if (num % 100 === 0 && num > 0) {
    return { multiplier: 2, label: "Круглое" };
  }

  if (d1 === d3 && d1 !== d2) {
    return { multiplier: 1.5, label: "Палиндром" };
  }

  return { multiplier: 1, label: "Обычные" };
}

function calculateSlugPrice({ letters, digits }) {
  const normalizedLetters = String(letters || "").toUpperCase();
  const normalizedDigits = String(digits || "");
  const letterMeta = getLetterMultiplier(normalizedLetters);
  const digitMeta = getDigitMultiplier(normalizedDigits);
  const total = BASE_PRICE * letterMeta.multiplier * digitMeta.multiplier;

  return {
    basePrice: BASE_PRICE,
    slug: `${normalizedLetters}${normalizedDigits}`,
    letters: letterMeta,
    digits: digitMeta,
    total,
  };
}

module.exports = {
  BASE_PRICE,
  getLetterMultiplier,
  getDigitMultiplier,
  calculateSlugPrice,
};
