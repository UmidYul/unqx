const fs = require("node:fs");
const path = require("node:path");

describe("auth register guard", () => {
  test("does not overwrite an existing pending account during registration", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8");
    const normalizedSource = source.replace(/\r\n/g, "\n");

    const registerStart = normalizedSource.indexOf('router.post(\n  "/register"');
    const registerEnd = normalizedSource.indexOf('router.post(\n  "/send-otp"', registerStart);
    const registerSource = normalizedSource.slice(registerStart, registerEnd);

    expect(registerStart).toBeGreaterThan(-1);
    expect(registerEnd).toBeGreaterThan(registerStart);
    expect(normalizedSource).toContain("function canResumePendingRegistration");
    expect(registerSource).toContain("canResumePendingRegistration(existing, email)");
    expect(registerSource).toContain("resumedPendingRegistration: true");
    expect(registerSource).toContain("const user = await prisma.user.create({");
    expect(registerSource).not.toContain("user = await prisma.user.update({");
  });
});
