const { getPlanCharge, resolveRequestedPlanForOrder } = require("../../src/services/pricing-settings");

describe("pricing charge logic", () => {
  const pricing = {
    planBasicPrice: 50_000,
    planPremiumPrice: 130_000,
    premiumUpgradePrice: 80_000,
  };

  test("none -> basic charges basic", () => {
    expect(
      getPlanCharge({
        currentPlan: "none",
        requestedPlan: "basic",
        pricing,
      }),
    ).toBe(50_000);
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

  test("basic -> premium charges upgrade", () => {
    expect(
      getPlanCharge({
        currentPlan: "basic",
        requestedPlan: "premium",
        pricing,
      }),
    ).toBe(80_000);
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
    expect(resolveRequestedPlanForOrder({ currentPlan: "none", requestedPlan: "basic" })).toBe("basic");
  });
});
