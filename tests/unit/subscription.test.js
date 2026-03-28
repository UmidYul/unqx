const { isPublicProfileVisible } = require("../../src/services/subscription");

describe("subscription visibility", () => {
  test("active non-premium users remain publicly visible", () => {
    const visible = isPublicProfileVisible({
      status: "active",
      plan: "none",
    });
    expect(visible).toBe(true);
  });

  test("active premium user with active period is visible", () => {
    const visible = isPublicProfileVisible({
      status: "active",
      plan: "premium",
      subscriptionExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    expect(visible).toBe(true);
  });

  test("active premium user with expired period is hidden", () => {
    const visible = isPublicProfileVisible({
      status: "active",
      plan: "premium",
      subscriptionExpiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    expect(visible).toBe(false);
  });

  test("blocked user is hidden", () => {
    const visible = isPublicProfileVisible({
      status: "blocked",
      plan: "none",
    });
    expect(visible).toBe(false);
  });
});
