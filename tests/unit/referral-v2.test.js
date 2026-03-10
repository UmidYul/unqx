const { normalizePromoCode, chooseCampaign, buildCampaignSnapshot } = require("../../src/services/referral-v2");

describe("referral-v2", () => {
  it("normalizes promo code", () => {
    expect(normalizePromoCode(" promo-2026! ")).toBe("PROMO-2026");
  });

  it("prioritizes promo code campaign over source/offer", () => {
    const campaigns = [
      {
        id: "a",
        type: "source_offer",
        priority: 99,
        updatedAt: "2026-03-10T01:00:00.000Z",
      },
      {
        id: "b",
        type: "promo_code",
        priority: 1,
        updatedAt: "2026-03-10T00:00:00.000Z",
      },
    ];
    expect(chooseCampaign(campaigns)?.id).toBe("b");
  });

  it("builds campaign snapshot overrides", () => {
    const snapshot = buildCampaignSnapshot({
      campaign: {
        id: "c1",
        name: "Flash promo",
        type: "promo_code",
        promoCode: "FLASH50",
        rewardAmountOverride: 70000,
        inviteeDiscountOverride: 150000,
        discountCapPercentOverride: 35,
        perUserCap: 2,
        budgetAmount: 1_000_000,
      },
      referrerReward: 50000,
      inviteeDiscount: 100000,
      discountCapPercent: 30,
      normalizedPromoCode: "FLASH50",
    });

    expect(snapshot.campaignApplied).toBe(true);
    expect(snapshot.referrerReward).toBe(70000);
    expect(snapshot.inviteeDiscount).toBe(150000);
    expect(snapshot.discountCapPercent).toBe(35);
    expect(snapshot.perUserCap).toBe(2);
    expect(snapshot.budgetAmount).toBe(1_000_000);
    expect(snapshot.promoCodeApplied).toBe("FLASH50");
  });
});
