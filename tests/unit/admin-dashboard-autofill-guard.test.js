const path = require("node:path");
const fs = require("node:fs");

describe("admin dashboard autofill guard", () => {
    test("marks admin dashboard fields as ignored for password-manager overlays", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "admin-dashboard.js"), "utf-8");
        expect(source).toContain("autofillIgnoreSelectors");
        expect(source).toContain("data-bwignore");
        expect(source).toContain("MutationObserver");
        expect(source).toContain("markAutofillIgnored(document)");
    });
});
