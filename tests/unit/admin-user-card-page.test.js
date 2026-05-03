const path = require("node:path");
const ejs = require("ejs");

async function renderAdminUserCardTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "admin", "user-card.ejs");
  return ejs.renderFile(file, {
    title: "Визитка пользователя",
    userId: "user_123",
    cspNonce: "nonce",
    csrfToken: "csrf",
    adminSession: { role: "admin" },
    ...locals,
  });
}

describe("admin user card page", () => {
  test("renders wall moderation section", async () => {
    const html = await renderAdminUserCardTemplate();
    expect(html).toContain(">Стена<");
    expect(html).toContain('id="admin-wall-list"');
    expect(html).toContain('id="admin-wall-editor-body"');
    expect(html).toContain("Редактировать пост");
  });
});
