const fs = require("node:fs");
const path = require("node:path");

describe("order status transition", () => {
  test("approved transition ensures a profile card exists for the owner", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "services", "order-status-transition.js"),
      "utf-8",
    );

    expect(source).toContain('const { ensureProfileCardExists } = require("./public-handle");');
    expect(source).toContain("await ensureProfileCardExists({");
    expect(source).toContain("const profileCardOwner = await tx.user.findUnique({");
  });
});
