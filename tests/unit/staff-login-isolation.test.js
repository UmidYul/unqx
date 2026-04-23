const fs = require("node:fs");
const path = require("node:path");

describe("staff login isolation", () => {
  test("staff login pages keep roles isolated and manager logout stays in manager realm", () => {
    const authSource = fs.readFileSync(path.join(process.cwd(), "src", "middleware", "auth.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const adminPagesSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "admin.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const layoutSource = fs.readFileSync(path.join(process.cwd(), "src", "views", "partials", "admin-layout-start.ejs"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(authSource).toContain("const admin = getAdminSession(req);");
    expect(authSource).toContain('if (!admin || admin.role !== "manager") {');

    expect(adminPagesSource).toContain('if (getStaffRole(adminSession) === "admin")');
    expect(adminPagesSource).toContain('if (getStaffRole(adminSession) === "manager")');
    expect(adminPagesSource).not.toContain('await require("../../middleware/auth").logoutUserSession(req);');

    expect(layoutSource).toContain('const logoutPath=adminRole==="manager" ? "/manager/logout" : "/admin/logout";');
    expect(layoutSource).toContain('action="<%= logoutPath %>"');
  });
});
