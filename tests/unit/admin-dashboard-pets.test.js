const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderAdminDashboard(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "admin", "dashboard.ejs");
  return ejs.renderFile(file, {
    title: "Дашборд",
    cspNonce: "nonce",
    csrfToken: "csrf",
    adminSession: { role: "admin", name: "Admin" },
    publicBaseUrl: "https://unqx.uz",
    activeTab: "pets",
    query: {},
    dashboardBasePath: "/admin/dashboard",
    assetVersion: "test",
    ...locals,
  });
}

describe("admin dashboard pets", () => {
  test("renders pets queue tab and filters", async () => {
    const html = await renderAdminDashboard();

    expect(html).toContain('id="tab-pets"');
    expect(html).toContain('id="pets-filters"');
    expect(html).toContain('id="pets-table"');
    expect(html).toContain('id="pets-pagination"');
    expect(html).toContain('name="petType"');
    expect(html).toContain("Животные");
  });

  test("dashboard script wires pet requests queue actions", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "admin-dashboard.js"), "utf-8");

    expect(source).toContain("loadPetRequests");
    expect(source).toContain("/api/admin/pet-requests?");
    expect(source).toContain('data-act="pr-approve"');
    expect(source).toContain('data-act="pr-reject"');
    expect(source).toContain("syncPetFiltersFromLocation");
  });
});
