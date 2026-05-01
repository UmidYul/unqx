const fs = require("node:fs");
const path = require("node:path");

const {
  analyzeCandidate,
} = require("../../scripts/restore-auto-paused-cards");

const DAY_MS = 24 * 60 * 60 * 1000;

describe("restore auto-paused cards", () => {
  test("restores candidate from subscription history even without purchases", () => {
    const result = analyzeCandidate({
      id: "user-1",
      plan: "none",
      hasPlanPurchase: false,
      hasPrivatePasswords: false,
      planPurchasedAt: null,
      planUpgradedAt: null,
      subscriptionStartedAt: new Date(Date.now() - 40 * DAY_MS),
      subscriptionExpiresAt: new Date(Date.now() - 10 * DAY_MS),
      subscriptionRenewedAt: null,
      slugs: [
        {
          fullSlug: "ABC123",
          status: "paused",
          pauseMessage: null,
          activatedAt: new Date(Date.now() - 35 * DAY_MS),
          approvedAt: new Date(Date.now() - 36 * DAY_MS),
          isPrimary: true,
        },
      ],
    });

    expect(result.reason).toBeNull();
    expect(result.candidate).not.toBeNull();
    expect(result.candidate.nextPlan).toBe("premium");
    expect(result.candidate.hasPlanPurchase).toBe(false);
    expect(result.candidate.hasSubscriptionEvidence).toBe(true);
    expect(result.candidate.subscription.effectivePlan).toBe("premium");
  });

  test("skips rows without purchases and without subscription history", () => {
    const result = analyzeCandidate({
      id: "user-2",
      plan: "none",
      hasPlanPurchase: false,
      hasPrivatePasswords: false,
      planPurchasedAt: null,
      planUpgradedAt: null,
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      subscriptionRenewedAt: null,
      slugs: [
        {
          fullSlug: "ABC124",
          status: "paused",
          pauseMessage: null,
          activatedAt: null,
          approvedAt: null,
          isPrimary: true,
        },
      ],
    });

    expect(result.candidate).toBeNull();
    expect(result.reason).toBe("no_purchase_or_subscription_history");
  });

  test("live jobs no longer depend on premium purchase history for recovery", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "services", "live-jobs.js"),
      "utf-8",
    );

    expect(source).toContain("hasSubscriptionHistoryEvidence");
    expect(source).not.toContain('type: "premium_subscription_monthly"');
  });
});
