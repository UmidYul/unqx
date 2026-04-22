const fs = require("node:fs");
const path = require("node:path");

describe("cookie hardening", () => {
  test("uses shared cookie options for auth/session cleanup and auxiliary cookies", () => {
    const authSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const adminPagesSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "admin.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const tapTrackerSource = fs.readFileSync(path.join(process.cwd(), "src", "services", "tap-tracker.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const privateAccessSource = fs.readFileSync(path.join(process.cwd(), "src", "services", "private-access.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const cookieUtilsSource = fs.readFileSync(path.join(process.cwd(), "src", "utils", "cookies.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(cookieUtilsSource).toContain("function buildCookieOptions");
    expect(cookieUtilsSource).toContain("if (env.SESSION_COOKIE_DOMAIN)");
    expect(cookieUtilsSource).toContain('sameSite: "lax"');

    expect(authSource).toContain('res.clearCookie("unqx.sid", buildCookieOptions(req, { httpOnly: true }))');
    expect(authSource).toContain('res.clearCookie("unqx_owner_slugs", buildCookieOptions(req))');
    expect(authSource).toContain('res.cookie(\n    "unqx_owner_slugs"');

    expect(adminPagesSource).toContain('res.clearCookie("unqx.sid", buildCookieOptions(req, { httpOnly: true }))');
    expect(tapTrackerSource).toContain('res.cookie(\n      "unqx_sid"');
    expect(privateAccessSource).toContain("buildCookieOptions(req, {");
  });
});
