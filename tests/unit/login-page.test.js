const path = require("node:path");
const fs = require("node:fs");

describe("login page", () => {
    test("shows account-state mapping and reactivation redirect", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "views", "public", "login.ejs"), "utf-8");
        expect(source).toContain("loginErrorByCode");
        expect(source).toContain('ACCOUNT_DISABLED: "Аккаунт отключен. Обратитесь в поддержку."');
        expect(source).toContain('ACCOUNT_DEACTIVATED: "Аккаунт деактивирован. Перейди к восстановлению."');
        expect(source).toContain('payload?.code === "ACCOUNT_DEACTIVATED"');
        expect(source).toContain('/reactivate-account?email=');
        expect(source).toContain("resolveLoginError(payload)");
    });
});
