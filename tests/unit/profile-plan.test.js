const { getEffectivePlan, getSlugLimit, getTagLimit, getButtonLimit } = require("../../src/services/profile");

describe("profile plan helpers", () => {
  test("keeps premium forever", () => {
    const result = getEffectivePlan({
      plan: "premium",
    });
    expect(result.plan).toBe("premium");
    expect(result.isPremium).toBe(true);
    expect(result.isExpiredPremium).toBe(false);
  });

  test("supports no purchased plan", () => {
    const result = getEffectivePlan({
      plan: "none",
    });
    expect(result.plan).toBe("none");
    expect(result.isPremium).toBe(false);
  });

  test("returns expected limits", () => {
    expect(getSlugLimit("none")).toBe(0);
    expect(getSlugLimit("basic")).toBe(1);
    expect(getSlugLimit("premium")).toBe(3);
    expect(getTagLimit("basic")).toBe(3);
    expect(getTagLimit("premium")).toBe(5);
    expect(getButtonLimit("basic")).toBe(3);
    expect(getButtonLimit("premium")).toBeNull();
  });
});

