const { CardUpsertSchema } = require("../../src/validation/card");

function basePayload(overrides = {}) {
  return {
    slug: "AAA001",
    isActive: true,
    name: "Test User",
    phone: "+998901234567",
    verified: false,
    hashtag: "",
    address: "",
    postcode: "",
    email: "",
    extraPhone: "",
    tags: [],
    buttons: [],
    ...overrides,
  };
}

describe("card validation phone", () => {
  test("normalizes uz number from formatted value", () => {
    const parsed = CardUpsertSchema.parse(basePayload({ phone: "+998 (90) 123-45-67" }));
    expect(parsed.phone).toBe("+998901234567");
  });

  test("rejects invalid uz number", () => {
    const parsed = CardUpsertSchema.safeParse(basePayload({ phone: "+1234567890" }));
    expect(parsed.success).toBe(false);
  });

  test("allows optional extra phone to stay undefined", () => {
    const parsed = CardUpsertSchema.parse(basePayload({ extraPhone: "" }));
    expect(parsed.extraPhone).toBeUndefined();
  });

  test("normalizes optional extra phone", () => {
    const parsed = CardUpsertSchema.parse(basePayload({ extraPhone: "90 123 45 67" }));
    expect(parsed.extraPhone).toBe("+998901234567");
  });
});
