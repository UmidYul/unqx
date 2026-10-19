const { buildManualTelegramPaymentUrl, toTelegramPlanPriceLabel, toTelegramTotalPriceLabel } = require("../../src/services/payment-flow");

describe("Premium payment amounts", () => {
  test.each([26_000, 160_000, 130_000])("uses the actual stored charge %i in payment messages", (planPrice) => {
    const label = `${planPrice.toLocaleString("ru-RU")} сум`;
    expect(toTelegramPlanPriceLabel({ requestedPlan: "premium", planPrice })).toBe(label);
    expect(toTelegramTotalPriceLabel({ requestedPlan: "premium", planPrice })).toBe(label);
    const url = buildManualTelegramPaymentUrl({ orderId: "order-1", slug: "AAA001", requestedPlan: "premium", planPrice, telegramUsername: "unqx_support" });
    const message = new URL(url).searchParams.get("text");
    expect(message).toContain(label);
    expect(message).not.toContain("$2");
  });

  test("includes both the UNQ and subscription in the payment total", () => {
    expect(toTelegramTotalPriceLabel({ slugPrice: 100_000, planPrice: 160_000 })).toBe(`${(260_000).toLocaleString("ru-RU")} сум`);
  });
});
