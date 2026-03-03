const { BASE_PRICE, calculateSlugPrice, getDigitMultiplier, getLetterMultiplier } = require("../../src/services/slug-pricing");

describe("slug pricing", () => {
  it("matches AAA000 multiplier case", () => {
    const result = calculateSlugPrice({ letters: "AAA", digits: "000" });
    expect(result.total).toBe(BASE_PRICE * 5 * 6);
  });

  it("matches ABC123 multiplier case", () => {
    const result = calculateSlugPrice({ letters: "ABC", digits: "123" });
    expect(result.total).toBe(BASE_PRICE * 3 * 3);
  });

  it("matches ABA121 multiplier case", () => {
    const result = calculateSlugPrice({ letters: "ABA", digits: "121" });
    expect(result.total).toBe(BASE_PRICE * 2 * 1.5);
  });

  it("returns x1/x1 for random value", () => {
    expect(getLetterMultiplier("ABX").multiplier).toBe(1);
    expect(getDigitMultiplier("374").multiplier).toBe(1);
  });
});
