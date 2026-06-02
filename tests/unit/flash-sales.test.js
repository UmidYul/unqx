process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "test-admin-hash";

const {
  applyFlashSaleToPrice,
  isSlugMatchedByFlashSale,
  resolveConditionLabel,
  resolveFlashSalePresentation,
} = require("../../src/services/flash-sales");

describe("flash sale custom patterns", () => {
  test("matches explicit slug from allowedSlugs", () => {
    const sale = {
      conditionType: "custom",
      conditionValue: {
        allowedSlugs: ["abc123", "ZZZ999"],
      },
    };
    expect(isSlugMatchedByFlashSale({ slug: "ABC123", sale })).toBe(true);
    expect(isSlugMatchedByFlashSale({ slug: "AAA123", sale })).toBe(false);
  });

  test("matches wildcard masks from slugPatterns", () => {
    const sale = {
      conditionType: "custom",
      conditionValue: {
        slugPatterns: ["AAA***", "***777", "A*A12?"],
      },
    };
    expect(isSlugMatchedByFlashSale({ slug: "AAA123", sale })).toBe(true);
    expect(isSlugMatchedByFlashSale({ slug: "XYZ777", sale })).toBe(true);
    expect(isSlugMatchedByFlashSale({ slug: "ABA129", sale })).toBe(true);
    expect(isSlugMatchedByFlashSale({ slug: "BBB111", sale })).toBe(false);
  });

  test("supports short masks (letters/digits) for backward compatibility", () => {
    const sale = {
      conditionType: "custom",
      conditionValue: {
        slugPatterns: ["AAA", "000"],
      },
    };
    expect(isSlugMatchedByFlashSale({ slug: "AAA987", sale })).toBe(true);
    expect(isSlugMatchedByFlashSale({ slug: "XYZ000", sale })).toBe(true);
    expect(isSlugMatchedByFlashSale({ slug: "XYZ111", sale })).toBe(false);
  });

  test("applies discount when custom condition matches", () => {
    const sale = {
      conditionType: "custom",
      discountPercent: 15,
      conditionValue: {
        slugPatterns: ["UZ*123"],
      },
    };
    const matched = applyFlashSaleToPrice({ slug: "UZA123", basePrice: 1_000_000, sale });
    const notMatched = applyFlashSaleToPrice({ slug: "ABC123", basePrice: 1_000_000, sale });
    expect(matched.hasDiscount).toBe(true);
    expect(matched.finalPrice).toBe(850_000);
    expect(notMatched.hasDiscount).toBe(false);
  });

  test("builds readable label for custom condition", () => {
    const label = resolveConditionLabel({
      conditionType: "custom",
      conditionValue: {
        allowedSlugs: ["AAA111", "BBB222"],
        slugPatterns: ["***000"],
      },
    });
    expect(label).toBe("Кастом: 3 правила");
  });

  test("localizes custom label with exclusions in russian", () => {
    const label = resolveConditionLabel({
      conditionType: "custom",
      conditionValue: {
        allowedSlugs: ["AAA111"],
        excludeRules: [
          { type: "slug", value: "AAA222" },
          { type: "slug", value: "AAA333" },
        ],
      },
    });
    expect(label).toBe("Кастом: 1 правило, 2 исключения");
  });

  test("builds public flash presentation with rules, exclusions and examples", () => {
    const presentation = resolveFlashSalePresentation({
      conditionType: "custom",
      conditionValue: {
        includeRules: [
          { type: "mask", value: "***000" },
          { type: "slug", value: "AAA111" },
        ],
        excludeRules: [
          { type: "slug", value: "BBB000" },
        ],
      },
    });
    expect(presentation.includeRules).toContain("Маска: ***000");
    expect(presentation.includeRules).toContain("Точный UNQ: AAA111");
    expect(presentation.excludeRules).toContain("Точный UNQ: BBB000");
    expect(presentation.examples).toContain("ABC000");
    expect(presentation.examples).toContain("AAA111");
  });
});

