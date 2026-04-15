const fs = require("node:fs");
const path = require("node:path");

describe("private access url cleanup", () => {
  test("moves private access token from query string into cookie and redirects to a clean URL", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "public.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(source).toContain("setPrivateAccessCookie");
    expect(source).toContain("function buildPathWithoutQueryKeys");
    expect(source).toContain('if (typeof req.query?.accessToken === "string" && req.query.accessToken.trim()) {');
    expect(source).toContain('setPrivateAccessCookie(req, res, accessToken, accessPayload.exp);');
    expect(source).toContain('res.redirect(buildPathWithoutQueryKeys(`/${encodeURIComponent(slug)}`, req.query, ["accessToken"]))');
  });
});
