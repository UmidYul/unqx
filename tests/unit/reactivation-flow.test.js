const path = require("node:path");
const fs = require("node:fs");

describe("account reactivation flow", () => {
    test("auth API exposes reactivation request and confirm endpoints", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8");
        expect(source).toContain('"/reactivate/request"');
        expect(source).toContain('"/reactivate/confirm"');
        expect(source).toContain("setReactivationOtp");
        expect(source).toContain("sendAccountReactivationOtp");
        expect(source).toContain("sendAccountReactivatedEmail");
    });

    test("public router exposes account reactivation page", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "public.js"), "utf-8");
        expect(source).toContain('"/reactivate-account"');
        expect(source).toContain('"public/reactivate-account"');
    });

    test("lifecycle job processes deactivated accounts", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "services", "live-jobs.js"), "utf-8");
        expect(source).toContain("processDeactivatedAccountLifecycle");
        expect(source).toContain("finalizeDeletedAccount");
        expect(source).toContain("sendAccountReactivationReminderEmail");
        expect(source).toContain("sendAccountDeletedEmail");
    });
});
