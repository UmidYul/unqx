const fs = require("node:fs");
const path = require("node:path");

describe("login next guard", () => {
  test("sanitizes login next redirect to local paths only", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "public.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(source).toContain("function normalizeSafeNextPath");
    expect(source).toContain('!raw.startsWith("/")');
    expect(source).toContain('raw.startsWith("//")');
    expect(source).toContain('raw.includes("\\\\")');
    expect(source).toContain('new URL(raw, "http://local.unqx")');
    expect(source).toContain('next: normalizeSafeNextPath(req.query.next, "/profile")');
  });
});
