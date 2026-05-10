const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderAdminUserCardPage(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "admin", "user-card.ejs");
  return ejs.renderFile(file, {
    title: "Визитка пользователя",
    userId: "user_123",
    cspNonce: "nonce",
    csrfToken: "csrf",
    adminSession: { role: "admin", name: "Admin" },
    ...locals,
  });
}

describe("admin user card pets", () => {
  test("renders pets management section", async () => {
    const html = await renderAdminUserCardPage();

    expect(html).toContain('id="user-card-pets-list"');
    expect(html).toContain("Животные");
    expect(html).toContain("Ручная выдача");
  });

  test("legacy user card script supports pets payloads", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "admin-user-card.js"), "utf-8");

    expect(source).toContain("PET_TYPES");
    expect(source).toContain("renderPetsEditor");
    expect(source).toContain('data-pet-grant');
    expect(source).toContain('verifiedCompany: el.company?.value || ""');
    expect(source).toContain("state.petCatalog");
  });
});
