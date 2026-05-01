const fs = require("node:fs");
const path = require("node:path");

describe("subscription auto-renew wiring", () => {
  test("auth and token payloads keep subscription dates", () => {
    const authSource = fs.readFileSync(
      path.join(process.cwd(), "src", "routes", "api", "auth.js"),
      "utf-8",
    );
    const tokenSource = fs.readFileSync(
      path.join(process.cwd(), "src", "services", "user-access-token.js"),
      "utf-8",
    );

    expect(authSource).toContain("subscriptionStartedAt: true");
    expect(authSource).toContain("subscriptionExpiresAt: true");
    expect(authSource).toContain("subscriptionRenewedAt: true");
    expect(authSource).toContain("subscriptionStartedAt: user.subscriptionStartedAt ? user.subscriptionStartedAt.toISOString() : null");
    expect(authSource).toContain("subscriptionExpiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null");
    expect(authSource).toContain("subscriptionRenewedAt: user.subscriptionRenewedAt ? user.subscriptionRenewedAt.toISOString() : null");

    expect(tokenSource).toContain("subscriptionStartedAt: userPayload.subscriptionStartedAt || null");
    expect(tokenSource).toContain("subscriptionExpiresAt: userPayload.subscriptionExpiresAt || null");
    expect(tokenSource).toContain("subscriptionRenewedAt: userPayload.subscriptionRenewedAt || null");
  });

  test("public live stats switch between auto-renew and raw expiry filters", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "routes", "api", "features.js"),
      "utf-8",
    );

    expect(source).toContain("env.SUBSCRIPTION_AUTO_RENEW_ENABLED");
    expect(source).toContain("const activeOwnerWhere = env.SUBSCRIPTION_AUTO_RENEW_ENABLED");
    expect(source).toContain("owner: activeOwnerWhere");
    expect(source).toContain('OR: [{ subscriptionExpiresAt: null }, { subscriptionExpiresAt: { gt: now } }]');
  });
});
