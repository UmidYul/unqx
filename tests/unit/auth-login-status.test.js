const path = require("node:path");
const fs = require("node:fs");

describe("auth login status guards", () => {
    test("login API blocks disabled accounts before session creation", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8");
        expect(source).toContain('if (user.status === "blocked" || user.status === "deactivated")');
        expect(source).toContain('code: "ACCOUNT_DISABLED"');
    });
});
