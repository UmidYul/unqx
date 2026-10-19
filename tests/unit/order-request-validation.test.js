const { OrderRequestSchema } = require("../../src/validation/order-request");

describe("order request validation", () => {
  const validPayload = {
    name: "Test User",
    letters: "AAA",
    digits: "001",
    tariff: "premium",
    products: {
      digitalCard: true,
      bracelet: false,
    },
  };

  it("validates a correct payload", () => {
    const result = OrderRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("validates payload with bracelet and optional theme", () => {
    const result = OrderRequestSchema.safeParse({
      ...validPayload,
      tariff: "premium",
      theme: "graffiti_neon",
      products: {
        digitalCard: true,
        bracelet: true,
      },
    });
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
  it("allows only the published monthly and annual terms", () => {
    for (const subscriptionMonths of [1, 12]) {
      expect(OrderRequestSchema.safeParse({ ...validPayload, subscriptionMonths }).success).toBe(true);
    }
    for (const subscriptionMonths of [0, 2, 6, 13]) {
      expect(OrderRequestSchema.safeParse({ ...validPayload, subscriptionMonths }).success).toBe(false);
    }
  });

});
