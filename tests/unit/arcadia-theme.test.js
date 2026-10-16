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

describe("Arcadia painted theme integration", () => {
  test("is selectable in the editor and accepted by server validation", () => {
    expect(getProfileEditorPresets().signatureThemes.find(item => item.id === "arcadia_painted"))
      .toMatchObject({ label: "АРКАДИЯ · Живописный сад", premiumRequired: true });
    expect(CardUpsertSchema.shape.theme.parse("arcadia_painted")).toBe("arcadia_painted");
    expect(normalizeThemeByPlan("arcadia_painted", "premium")).toBe("arcadia_painted");
    expect(normalizeThemeByPlan("arcadia_painted", "none")).toBe("default_dark");
  });

  test("renders painterly tokens and bounded falling leaves without affecting other themes", () => {
    const { renderer } = loadRenderer();
    const input = { name: "Alex", slug: "ABC123", tariff: "premium", theme: "arcadia_painted", buttons: [] };
    const html = renderer.renderCardView(input);
    expect(html).toContain('data-card-theme="arcadia_painted"');
    expect(html).toContain("--theme-accent-color:#476748");
    expect(html).toContain("arcadia-botanical-print");
    expect((html.match(/class="arcadia-leaf"/g) || []).length).toBe(18);
    expect(html).toContain("arcadia-landscape");
    expect(html).toContain("arcadia-leaf-field");
    expect(renderer.renderCardView({ ...input, theme: "default_dark" })).not.toContain('class="arcadia-effects"');
  });

  test("preserves theme on the public server-rendered page", async () => {
    const html = await ejs.renderFile(path.join(process.cwd(), "src/views/public/card.ejs"), {
      card: { slug: "ABC123", name: "Alex", tariff: "premium", theme: "arcadia_painted", buttons: [] },
      cspNonce: "test", csrfToken: "test", assetVersion: "test", publicSettings: {}, userSession: null,
    });
    expect(html).toContain('data-card-theme="arcadia_painted"');
    expect(html).toContain('"theme":"arcadia_painted"');
  });

  test("pauses leaf animations while the browser tab is hidden", () => {
    const { document, listeners, classList } = loadRenderer();
    expect(classList.toggle).toHaveBeenCalledWith("arcadia-motion-paused", false);
    document.hidden = true;
    listeners.visibilitychange();
    expect(classList.toggle).toHaveBeenCalledWith("arcadia-motion-paused", true);
  });
});
