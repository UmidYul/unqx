const path = require("node:path");
const ejs = require("ejs");

function buildThemePresets() {
  return {
    signatureThemes: [
      {
        id: "default_dark",
        label: "Obsidian Noir",
        description: "Signature black prestige",
        swatchStyle: "background:#0a0a0a;",
        premiumRequired: false,
      },
      {
        id: "graffiti_neon",
        label: "Graffiti Neon",
        description: "Street neon",
        swatchStyle: "background:#19142a;",
        premiumRequired: true,
      },
    ],
    colorThemes: [
      {
        id: "color_blue",
        label: "Blue",
        description: "Deep blue",
        swatchStyle: "background:#1d63d6;",
        premiumRequired: true,
      },
    ],
    avatarFrames: [
      {
        id: "none",
        label: "Без рамки",
        description: "Чистый круглый аватар",
        premiumRequired: false,
      },
      {
        id: "chrome_ring",
        label: "Chrome Ring",
        description: "Металлическое кольцо",
        premiumRequired: true,
      },
    ],
    emojiBackgroundPacks: [
      {
        id: "none",
        label: "Без фона",
        description: "Только текущая тема",
        swatchStyle: "background:#fff;",
        glyphLabel: "OFF",
        premiumRequired: false,
      },
      {
        id: "ghosts",
        label: "Ghosts",
        description: "Мягкие силуэты",
        swatchStyle: "background:#222;",
        glyphLabel: "GH",
        premiumRequired: true,
      },
    ],
    petPresets: [
      {
        id: "kitten",
        label: "Котенок",
        description: "Маленький спутник",
        assetUrl: "/assets/pets/kitten.svg",
        defaultPrice: 2000000,
      },
    ],
  };
}

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
    themePresets: buildThemePresets(),
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

  test("renders pets category in admin card editor", async () => {
    const html = await renderAdminCardFormTemplate();

    expect(html).toContain('data-card-category="pets"');
    expect(html).toContain('data-card-panel="pets"');
    expect(html).toContain('id="admin-card-pets-list"');
    expect(html).toContain("Животные");
  });
});
