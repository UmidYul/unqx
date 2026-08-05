const { applySlugPriceMarkup, getPlanCharge, resolveRequestedPlanForOrder } = require("../../src/services/pricing-settings");

describe("pricing charge logic", () => {
  const pricing = {
    planBasicPrice: 50_000,
    planPremiumPrice: 130_000,
    premiumUpgradePrice: 80_000,
  };

  test("none -> basic resolves to premium monthly charge", () => {
    expect(
      getPlanCharge({
        currentPlan: "none",
        requestedPlan: "basic",
        pricing,
      }),
    ).toBe(130_000);
  });

  test("none -> premium charges premium", () => {
    expect(
      getPlanCharge({
        currentPlan: "none",
        requestedPlan: "premium",
        pricing,
      }),
    ).toBe(130_000);
  });

  test("basic -> premium has no extra charge when subscription snapshot is active", () => {
    expect(
      getPlanCharge({
        currentPlan: "basic",
        requestedPlan: "premium",
        pricing,
      }),
    ).toBe(0);
  });

  test("premium stays premium with zero charge", () => {
    expect(
      getPlanCharge({
        currentPlan: "premium",
        requestedPlan: "premium",
        pricing,
      }),
    ).toBe(0);
  });

  test("requested plan normalized against current", () => {
    expect(resolveRequestedPlanForOrder({ currentPlan: "premium", requestedPlan: "basic" })).toBe("premium");
    expect(resolveRequestedPlanForOrder({ currentPlan: "none", requestedPlan: "basic" })).toBe("premium");
  });

  test("applies global slug markup percent to base prices", () => {
    expect(
      applySlugPriceMarkup(1_000_000, {
        slugPriceMarkupPercent: 10,
      }),
    ).toMatchObject({
      basePrice: 1_000_000,
      finalPrice: 1_100_000,
      markupPercent: 10,
      markupAmount: 100_000,
    });
  });
});
