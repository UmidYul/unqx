const { computeDiscountAllocation } = require("../../src/services/referral-v1");

describe("referral-v1 computeDiscountAllocation", () => {
  it("applies invitee discount and bonus within cap", () => {
    const result = computeDiscountAllocation({
      slugBasePrice: 1_000_000,
      slugPriceAfterProductDiscount: 1_000_000,
      inviteeDiscountCandidate: 100_000,
      walletBalance: 50_000,
      discountCapPercent: 30,
    });
    expect(result.inviteeDiscountApplied).toBe(100_000);
    expect(result.bonusSpent).toBe(50_000);
    expect(result.discountCapApplied).toBe(0);
    expect(result.finalSlugPayable).toBe(850_000);
  });

  it("limits referral+bonus by cap after product discount", () => {
    const result = computeDiscountAllocation({
      slugBasePrice: 1_000_000,
      slugPriceAfterProductDiscount: 700_000,
      inviteeDiscountCandidate: 100_000,
      walletBalance: 300_000,
      discountCapPercent: 30,
    });
    expect(result.productDiscountAmount).toBe(300_000);
    expect(result.inviteeDiscountApplied).toBe(0);
    expect(result.bonusSpent).toBe(0);
    expect(result.discountCapApplied).toBe(400_000);
    expect(result.finalSlugPayable).toBe(700_000);
  });
});
