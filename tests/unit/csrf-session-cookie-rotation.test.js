const fs = require("node:fs");
const path = require("node:path");

describe("csrf session cookie rotation", () => {
  test("uses a versioned session cookie name and clears legacy session cookies", () => {
    const appSource = fs.readFileSync(path.join(process.cwd(), "src", "app.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const authSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "auth.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const adminPagesSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "admin.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const cookieUtilsSource = fs.readFileSync(path.join(process.cwd(), "src", "utils", "cookies.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(cookieUtilsSource).toContain('const SESSION_COOKIE_NAME = "unqx.sid.v2"');
    expect(cookieUtilsSource).toContain('const LEGACY_SESSION_COOKIE_NAMES = ["unqx.sid"]');

    expect(appSource).toContain("name: SESSION_COOKIE_NAME");
    expect(appSource).toContain("for (const legacyName of LEGACY_SESSION_COOKIE_NAMES)");
    expect(appSource).toContain("res.clearCookie(legacyName, buildCookieOptions(req, { httpOnly: true }))");

    expect(authSource).toContain('res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(req, { httpOnly: true }))');
    expect(authSource).toContain("for (const legacyName of LEGACY_SESSION_COOKIE_NAMES)");

    expect(adminPagesSource).toContain('res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(req, { httpOnly: true }))');
  });
});
