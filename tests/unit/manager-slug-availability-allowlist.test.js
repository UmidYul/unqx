const fs = require("node:fs");
const path = require("node:path");

describe("manager slug availability access", () => {
  test("keeps slug live-check route available for manager dashboard user creation", () => {
    const adminApiSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "admin.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(adminApiSource).toContain('{ method: "GET", re: /^\\/slugs\\/availability\\/check\\/?$/ },');
  });
});
