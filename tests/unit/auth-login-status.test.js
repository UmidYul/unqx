const path = require("node:path");
const fs = require("node:fs");

describe("auth login status guards", () => {
    test("login API handles blocked/deactivated/deleted account states", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8");
        expect(source).toContain('if (user.status === "blocked")');
        expect(source).toContain('if (user.status === "deactivated")');
        expect(source).toContain('if (user.status === "deleted")');
        expect(source).toContain('code: "ACCOUNT_DISABLED"');
        expect(source).toContain('code: "ACCOUNT_DEACTIVATED"');
        expect(source).toContain('code: "ACCOUNT_DELETED"');
    });
});
