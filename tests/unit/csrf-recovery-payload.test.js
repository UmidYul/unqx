const fs = require("node:fs");
const path = require("node:path");

describe("csrf recovery payload", () => {
  test("api csrf failures return a machine-readable code and fresh csrf token", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "middleware", "csrf.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(source).toContain('error: "Invalid CSRF token"');
    expect(source).toContain('code: "CSRF_INVALID"');
    expect(source).toContain("csrfToken: expected || null");
  });
});
