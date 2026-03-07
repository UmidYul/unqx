const path = require("node:path");
const fs = require("node:fs");

describe("login page", () => {
    test("shows dedicated account disabled login message mapping", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "views", "public", "login.ejs"), "utf-8");
        expect(source).toContain("loginErrorByCode");
        expect(source).toContain('ACCOUNT_DISABLED: "Аккаунт отключен. Обратитесь в поддержку."');
        expect(source).toContain("resolveLoginError(payload)");
    });
});
