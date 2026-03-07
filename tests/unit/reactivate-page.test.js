const path = require("node:path");
const fs = require("node:fs");

describe("reactivate account page", () => {
    test("renders recovery controls and API calls", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "views", "public", "reactivate-account.ejs"), "utf-8");
        expect(source).toContain('id="reactivate-form"');
        expect(source).toContain('id="reactivate-send-code"');
        expect(source).toContain('id="code"');
        expect(source).toContain('/api/auth/reactivate/request');
        expect(source).toContain('/api/auth/reactivate/confirm');
    });
});
