const fs = require("node:fs");
const path = require("node:path");

describe("change email hardening", () => {
  test("rate limits email change requests and validates/restricts OTP verification flow", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    const requestStart = source.indexOf('router.post(\n  "/change-email/request"');
    const verifyStart = source.indexOf('router.post(\n  "/change-email/verify"');
    const changePasswordStart = source.indexOf('router.post(\n  "/change-password"');
    const requestSource = source.slice(requestStart, verifyStart);
    const verifySource = source.slice(verifyStart, changePasswordStart);

    expect(requestStart).toBeGreaterThan(-1);
    expect(verifyStart).toBeGreaterThan(requestStart);
    expect(changePasswordStart).toBeGreaterThan(verifyStart);

    expect(requestSource).toContain("authSendOtpRateLimit");
    expect(requestSource).toContain("!newEmail || !isValidEmailAddress(newEmail)");
    expect(requestSource).toContain('normalizeEmail(user.email) === newEmail');
    expect(requestSource).toContain('code: "EMAIL_UNCHANGED"');

    expect(verifySource).toContain("const attempts = Number(user.otpAttempts || 0) + 1;");
    expect(verifySource).toContain('code: attempts >= MAX_OTP_ATTEMPTS ? "OTP_INVALIDATED" : "OTP_INVALID"');
    expect(verifySource).toContain("const emailTaken = await prisma.user.findFirst({");
    expect(verifySource).toContain('code: "EMAIL_TAKEN"');
  });
});
