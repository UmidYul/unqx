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
    activeTab: "flash-sales",
    query: {},
    dashboardBasePath: "/admin/dashboard",
    assetVersion: "test",
    ...locals,
  });
}

describe("admin dashboard flash sales", () => {
  test("renders flash sale builder and full edit modal", async () => {
    const html = await renderAdminDashboard();

    expect(html).toContain('id="tab-flash-sales"');
    expect(html).toContain('id="flash-sales-create-form"');
    expect(html).toContain('name="conditionIncludeInput"');
    expect(html).toContain('name="conditionExcludeInput"');
    expect(html).toContain('name="conditionMatchMode"');
    expect(html).toContain('id="flash-sale-edit-modal"');
    expect(html).toContain('id="flash-sale-edit-form"');
    expect(html).toContain("Редактирование акции");
    expect(html).toContain("Текст баннера и модалки");
  });

  test("admin flash sale script binds modal editing instead of prompt-only flow", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "admin-features.js"), "utf-8");

    expect(source).toContain("flash-sale-edit-modal");
    expect(source).toContain("openFlashEditModal");
    expect(source).toContain("buildFlashSalePayload");
    expect(source).toContain('bindFlashForm(document.getElementById("flash-sales-create-form"))');
    expect(source).not.toContain("setupFlashCreateForm()");
  });
});
