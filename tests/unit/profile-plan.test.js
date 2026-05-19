const { getEffectivePlan, getSlugLimit, getTagLimit, getButtonLimit, canCreateCard } = require("../../src/services/profile");

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
    expect(getSlugLimit("basic")).toBe(3);
    expect(getSlugLimit("premium")).toBe(3);
    expect(getTagLimit("basic")).toBe(5);
    expect(getTagLimit("premium")).toBe(5);
    expect(getButtonLimit("basic")).toBe(6);
    expect(getButtonLimit("premium")).toBe(6);
  });

  test("free public profile can create a card without premium plan", () => {
    expect(
      canCreateCard({
        plan: "none",
        status: "active",
        freeProfileCode: "123456789012",
        freeProfileStatus: "active",
        freeProfileDisabledAt: null,
        slugs: [],
      }),
    ).toBe(true);
  });

  test("disabled free public profile does not unlock card access", () => {
    expect(
      canCreateCard({
        plan: "none",
        status: "active",
        freeProfileCode: "123456789012",
        freeProfileStatus: "active",
        freeProfileDisabledAt: new Date("2026-05-19T00:00:00.000Z"),
        slugs: [],
      }),
    ).toBe(false);
  });
});

