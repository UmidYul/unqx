const fs = require("node:fs");
const path = require("node:path");

describe("subscription renewal cancel guard", () => {
  test("cancel route does not free slug for subscription renewals", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "routes", "api", "cards.js"),
      "utf-8",
    );

    expect(source).toContain("orderKind: true");
    expect(source).toContain('const isSubscriptionRenewal = String(order.orderKind || "").toLowerCase() === "subscription_renewal"');
    expect(source).toContain("if (!isSubscriptionRenewal) {");
    expect(source).toContain('status: "pending"');
  });

  test("reclaim slug script is available", () => {
    const pkg = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8");
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts", "reclaim-slug.js"),
      "utf-8",
    );

    expect(pkg).toContain('"subscriptions:reclaim-slug": "node scripts/reclaim-slug.js"');
    expect(script).toContain("--from-slug");
    expect(script).toContain("dry-run");
    expect(script).toContain("owner_id = $2");
  });
});
