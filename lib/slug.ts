const SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;

function prefixToNumber(prefix: string): number {
  return prefix.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 65), 0);
}

function numberToPrefix(value: number): string {
  const chars = [0, 0, 0];
  let n = value;

  for (let i = 2; i >= 0; i -= 1) {
    chars[i] = n % 26;
    n = Math.floor(n / 26);
  }

  return chars.map((v) => String.fromCharCode(65 + v)).join("");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export function slugToSequence(slug: string): number {
  if (!isValidSlug(slug)) {
    throw new Error("Invalid slug format");
  }

  const prefix = slug.slice(0, 3);
  const suffix = Number(slug.slice(3));
  return prefixToNumber(prefix) * 1000 + suffix;
}

export function getNextSlug(current: string | null): string {
  if (!current) {
    return "AAA001";
  }

  if (!isValidSlug(current)) {
    throw new Error("Invalid slug format");
  }

  const prefix = current.slice(0, 3);
  const number = Number(current.slice(3));

  if (number < 999) {
    return `${prefix}${String(number + 1).padStart(3, "0")}`;
  }

  const prefixNumber = prefixToNumber(prefix);
  if (prefixNumber >= 26 * 26 * 26 - 1) {
    throw new Error("Slug namespace exhausted");
  }

  return `${numberToPrefix(prefixNumber + 1)}001`;
}

export function compareSlugs(a: string, b: string): number {
  return slugToSequence(a) - slugToSequence(b);
}
