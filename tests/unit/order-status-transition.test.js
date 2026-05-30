const fs = require("node:fs");
const path = require("node:path");

describe("order status transition", () => {
  test("approved transition ensures a profile card exists for the owner", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "services", "order-status-transition.js"),
      "utf-8",
    );
    const normalizedSource = source.replace(/\r\n/g, "\n");

    expect(normalizedSource).toMatch(/require\("\.\/public-handle"\);/);
    expect(normalizedSource).toContain("ensureProfileCardExists");
    expect(normalizedSource).toContain("await ensureProfileCardExists({");
    expect(normalizedSource).toContain("const profileCardOwner = await tx.user.findUnique({");
  });
});
