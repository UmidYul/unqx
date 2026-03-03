const { OrderRequestSchema } = require("../../src/validation/order-request");

describe("order request validation", () => {
  const validPayload = {
    name: "Test User",
    letters: "AAA",
    digits: "001",
    tariff: "basic",
    products: {
      digitalCard: true,
      bracelet: false,
    },
  };

  it("validates a correct payload", () => {
    const result = OrderRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("fails when required fields are missing", () => {
    const result = OrderRequestSchema.safeParse({
      ...validPayload,
      name: "",
    });

    expect(result.success).toBe(false);
  });

  it("fails on malformed slug", () => {
    const result = OrderRequestSchema.safeParse({
      ...validPayload,
      letters: "AA",
      digits: "01",
    });

    expect(result.success).toBe(false);
  });

  it("fails on invalid tariff", () => {
    const result = OrderRequestSchema.safeParse({
      ...validPayload,
      tariff: "pro",
    });

    expect(result.success).toBe(false);
  });
});
