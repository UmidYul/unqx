const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ejs = require("ejs");
const { normalizeThemeByPlan } = require("../../src/services/profile");
const { getProfileEditorPresets } = require("../../src/services/profile-editor-presets");
const { CardUpsertSchema } = require("../../src/validation/card");

function loadRenderer() {
  const listeners = {};
  const classList = { toggle: vi.fn() };
  const document = {
    hidden: false,
    documentElement: { classList },
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  const window = { location: { href: "https://unqx.uz/ABC123", origin: "https://unqx.uz" } };
  const context = vm.createContext({ window, document, URL, console });
  vm.runInContext(fs.readFileSync(path.join(process.cwd(), "public/js/card-view.js"), "utf8"), context);
  return { renderer: window.CardView, document, listeners, classList };
}

describe("Forged Carbon theme integration", () => {
  test("is selectable in the editor and accepted by server validation", () => {
    expect(getProfileEditorPresets().signatureThemes.find(item => item.id === "forged_carbon"))
      .toMatchObject({ label: "FORGED · Кованый карбон", premiumRequired: true });
    expect(CardUpsertSchema.shape.theme.parse("forged_carbon")).toBe("forged_carbon");
    expect(normalizeThemeByPlan("forged_carbon", "premium")).toBe("forged_carbon");
    expect(normalizeThemeByPlan("forged_carbon", "none")).toBe("default_dark");
  });

  test("renders carbon tokens and bounded background effects without affecting other themes", () => {
    const { renderer } = loadRenderer();
    const input = { name: "Alex", slug: "ABC123", tariff: "premium", theme: "forged_carbon", buttons: [] };
    const html = renderer.renderCardView(input);
    expect(html).toContain('data-card-theme="forged_carbon"');
    expect(html).toContain("--theme-accent-color:#aaaaaa");
    expect(html).toContain("forged-carbon-engraving");
    expect((html.match(/class="forged-carbon-fragment"/g) || []).length).toBe(14);
    expect(html).toContain("forged-carbon-texture--a");
    expect(html).toContain("forged-carbon-texture--b");
    expect(renderer.renderCardView({ ...input, theme: "default_dark" })).not.toContain('class="forged-carbon-effects"');
  });

  test("preserves theme on the public server-rendered page", async () => {
    const html = await ejs.renderFile(path.join(process.cwd(), "src/views/public/card.ejs"), {
      card: { slug: "ABC123", name: "Alex", tariff: "premium", theme: "forged_carbon", buttons: [] },
      cspNonce: "test", csrfToken: "test", assetVersion: "test", publicSettings: {}, userSession: null,
    });
    expect(html).toContain('data-card-theme="forged_carbon"');
    expect(html).toContain('"theme":"forged_carbon"');
  });

  test("pauses carbon animations while the browser tab is hidden", () => {
    const { document, listeners, classList } = loadRenderer();
    expect(classList.toggle).toHaveBeenCalledWith("forged-carbon-motion-paused", false);
    document.hidden = true;
    listeners.visibilitychange();
    expect(classList.toggle).toHaveBeenCalledWith("forged-carbon-motion-paused", true);
  });
});
