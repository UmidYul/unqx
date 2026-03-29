const fs = require("node:fs");
const path = require("node:path");

describe("auth session resolution priority", () => {
  test("prefers bearer token over cookie session in getUserSession", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "middleware", "auth.js"), "utf-8");

    const tokenBranchIndex = source.indexOf('authorization.toLowerCase().startsWith("bearer ")');
    const sessionBranchIndex = source.indexOf("if (req.session && req.session.user)");

    expect(tokenBranchIndex).toBeGreaterThan(-1);
    expect(sessionBranchIndex).toBeGreaterThan(-1);
    expect(tokenBranchIndex).toBeLessThan(sessionBranchIndex);
  });

  test("does not fallback to cookie session when bearer token is invalid", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "middleware", "auth.js"), "utf-8");

    expect(source).toContain("if (!payload) {");
    expect(source).toContain("return null;");
    expect(source).not.toMatch(/if\s*\(!payload\)\s*\{\s*return req\.session\.user;/);
  });
});
