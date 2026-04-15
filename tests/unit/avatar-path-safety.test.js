const fs = require("node:fs");
const path = require("node:path");

describe("avatar path safety", () => {
  test("only resolves avatar deletions inside /uploads/avatars", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "services", "avatar.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(source).toContain('if (!cleanPath.startsWith("/uploads/avatars/")) {');
    expect(source).toContain('const basename = path.basename(cleanPath);');
    expect(source).toContain('basename !== cleanPath.slice("/uploads/avatars/".length)');
    expect(source).toContain('const resolved = path.resolve(AVATAR_DIR, basename);');
    expect(source).toContain('const avatarRoot = `${path.resolve(AVATAR_DIR)}${path.sep}`;');
    expect(source).toContain('if (!resolved.startsWith(avatarRoot)) {');
    expect(source).toContain('const diskPath = getDiskPathFromPublicPath(publicPath);');
  });
});
