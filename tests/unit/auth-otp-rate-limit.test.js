const fs = require("node:fs");
const path = require("node:path");

describe("auth otp rate limits", () => {
  test("applies dedicated OTP verification rate limit to sensitive auth routes", () => {
    const rateLimitSource = fs.readFileSync(path.join(process.cwd(), "src", "middleware", "rate-limit.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const authSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(rateLimitSource).toContain("const authOtpVerifyRateLimit = rateLimit({");
    expect(rateLimitSource).toContain("function authSubjectKeyGenerator");
    expect(rateLimitSource).toContain('typeof req.session?.user?.userId === "string"');
    expect(rateLimitSource).toContain("keyGenerator: authSubjectKeyGenerator");
    expect(rateLimitSource).toContain("authOtpVerifyRateLimit");

    expect(authSource).toContain("authOtpVerifyRateLimit");
    expect(authSource).toContain('"/verify-email",\n  authOtpVerifyRateLimit,');
    expect(authSource).toContain('"/reactivate/confirm",\n  authOtpVerifyRateLimit,');
    expect(authSource).toContain('"/reset-password",\n  authOtpVerifyRateLimit,');
    expect(authSource).toContain('"/change-email/verify",\n  authOtpVerifyRateLimit,');
  });
});
