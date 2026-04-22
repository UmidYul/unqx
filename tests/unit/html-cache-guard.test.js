const fs = require("node:fs");
const path = require("node:path");

describe("html cache guard", () => {
  test("marks dynamic html pages as private no-store", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "app.js"), "utf-8").replace(/\r\n/g, "\n");

    expect(source).toContain('const isHtmlPageRequest = acceptsHtml && !isStaticAssetRequest && !path.startsWith("/api/");');
    expect(source).toContain('if (isHtmlPageRequest || req.path.startsWith("/api/")) {');
    expect(source).toContain('res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");');
    expect(source).toContain('res.setHeader("Surrogate-Control", "no-store");');
    expect(source).toContain('res.vary("Cookie");');
    expect(source).toContain('res.vary("Authorization");');
  });
});
