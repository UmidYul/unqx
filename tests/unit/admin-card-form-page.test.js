const path = require("node:path");
const ejs = require("ejs");

const { getProfileEditorPresets } = require("../../src/services/profile-editor-presets");

async function renderAdminCardFormTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "admin", "card-form.ejs");
  return ejs.renderFile(file, {
    title: "Редактор визитки",
    mode: "edit",
    cardId: "card_123",
    cspNonce: "nonce",
    csrfToken: "csrf",
    adminSession: { role: "admin" },
    dashboardBasePath: "/admin/dashboard",
    ownerSearchQuery: "",
    ownerSearchResults: [],
    ownerPickerError: "",
    themePresets: getProfileEditorPresets(),
    ...locals,
  });
}

describe("admin card form page", () => {
  test("renders emoji background picker in design section", async () => {
    const html = await renderAdminCardFormTemplate();

    expect(html).toContain("Фоновый emoji");
    expect(html).toContain('id="admin-card-emoji-background-options"');
    expect(html).toContain('data-emoji-background-pack="ghosts"');
    expect(html).toContain('"emojiBackgroundPacks"');
  });
});
