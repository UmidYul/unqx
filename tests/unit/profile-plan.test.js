const { getEffectivePlan, getSlugLimit, getTagLimit, getButtonLimit } = require("../../src/services/profile");

describe("profile plan helpers", () => {
  test("treats expired premium as basic", () => {
    const result = getEffectivePlan({
      plan: "premium",
      planExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(result.plan).toBe("basic");
    expect(result.isExpiredPremium).toBe(true);
  });

  test("keeps premium when active", () => {
    const result = getEffectivePlan({
      plan: "premium",
      planExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(result.plan).toBe("premium");
    expect(result.isPremium).toBe(true);
  });

  test("returns expected limits", () => {
    expect(getSlugLimit("basic")).toBe(1);
    expect(getSlugLimit("premium")).toBe(3);
    expect(getTagLimit("basic")).toBe(3);
    expect(getTagLimit("premium")).toBe(5);
    expect(getButtonLimit("basic")).toBe(3);
    expect(getButtonLimit("premium")).toBeNull();
  });
});
