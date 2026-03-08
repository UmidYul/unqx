const { applyFlashSaleToPrice, isSlugMatchedByFlashSale, resolveConditionLabel } = require("../../src/services/flash-sales");

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
    expect(label).toContain("2");
    expect(label).toContain("1");
  });
});

