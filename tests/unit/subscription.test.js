const {
  buildSubscriptionAutoRenewPatch,
  getSubscriptionSnapshot,
  isPublicProfileVisible,
} = require("../../src/services/subscription");

const DAY_MS = 24 * 60 * 60 * 1000;

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
      subscriptionExpiresAt: new Date(Date.now() + 2 * DAY_MS),
    });
    expect(visible).toBe(true);
  });

  test("expired premium user is auto-renewed by default", () => {
    const snapshot = getSubscriptionSnapshot({
      status: "active",
      plan: "premium",
      subscriptionExpiresAt: new Date(Date.now() - 2 * DAY_MS),
    });
    expect(snapshot.isActive).toBe(true);
    expect(snapshot.isExpired).toBe(false);
    expect(snapshot.autoRenewed).toBe(true);
    expect(snapshot.expiresAt instanceof Date).toBe(true);
    expect(snapshot.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("expired premium user is hidden when auto-renew is disabled", () => {
    const visible = isPublicProfileVisible(
      {
        status: "active",
        plan: "premium",
        subscriptionExpiresAt: new Date(Date.now() - 2 * DAY_MS),
      },
      { autoRenew: false },
    );
    expect(visible).toBe(false);
  });

  test("auto-renew patch can recover previously downgraded premium users", () => {
    const patch = buildSubscriptionAutoRenewPatch(
      {
        plan: "none",
        subscriptionStartedAt: new Date(Date.now() - 40 * DAY_MS),
        subscriptionExpiresAt: new Date(Date.now() - 2 * DAY_MS),
      },
      { recoverPlan: true },
    );
    expect(patch).not.toBeNull();
    expect(patch.plan).toBe("premium");
    expect(patch.subscriptionExpiresAt instanceof Date).toBe(true);
    expect(patch.subscriptionExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("blocked user is hidden", () => {
    const visible = isPublicProfileVisible({
      status: "blocked",
      plan: "none",
    });
    expect(visible).toBe(false);
  });
});
