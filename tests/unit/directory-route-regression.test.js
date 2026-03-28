const fs = require("node:fs");
const path = require("node:path");

describe("directory route regressions", () => {
  test("directory query selects owner status for public visibility filter", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "routes", "pages", "public.js"),
      "utf8",
    );
    const routeMatch = source.match(
      /router\.get\(\s*"\/directory"[\s\S]*?router\.get\(\s*"\/qr\/:slug"/m,
    );
    expect(routeMatch).not.toBeNull();

    const directoryBlock = routeMatch[0];
    expect(directoryBlock).toMatch(
      /owner:\s*\{\s*select:\s*\{[\s\S]*?id:\s*true,[\s\S]*?status:\s*true,/m,
    );
  });
});
