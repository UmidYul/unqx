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

describe("JADE theme integration", () => {
  test("is selectable in the editor and accepted by server validation", () => {
    expect(getProfileEditorPresets().signatureThemes.find(item => item.id === "jade_luxe"))
      .toMatchObject({ label: "JADE · Нефрит", premiumRequired: true });
    expect(CardUpsertSchema.shape.theme.parse("jade_luxe")).toBe("jade_luxe");
    expect(normalizeThemeByPlan("jade_luxe", "premium")).toBe("jade_luxe");
    expect(normalizeThemeByPlan("jade_luxe", "none")).toBe("default_dark");
  });

  test("renders jade tokens and bounded leaf effects without affecting other themes", () => {
    const { renderer } = loadRenderer();
    const input = { name: "Alex", slug: "ABC123", tariff: "premium", theme: "jade_luxe", buttons: [] };
    const html = renderer.renderCardView(input);
    expect(html).toContain('data-card-theme="jade_luxe"');
    expect(html).toContain("--theme-accent-color:#00a86b");
    expect(html).toContain("jade-brushwork");
    expect((html.match(/class="jade-leaf"/g) || []).length).toBe(8);
    expect(renderer.renderCardView({ ...input, theme: "default_dark" })).not.toContain('class="jade-effects"');
  });

  test("preserves theme on the public server-rendered page", async () => {
    const html = await ejs.renderFile(path.join(process.cwd(), "src/views/public/card.ejs"), {
      card: { slug: "ABC123", name: "Alex", tariff: "premium", theme: "jade_luxe", buttons: [] },
      cspNonce: "test", csrfToken: "test", assetVersion: "test", publicSettings: {}, userSession: null,
    });
    expect(html).toContain('data-card-theme="jade_luxe"');
    expect(html).toContain('"theme":"jade_luxe"');
  });

  test("pauses leaf animations while the browser tab is hidden", () => {
    const { document, listeners, classList } = loadRenderer();
    expect(classList.toggle).toHaveBeenLastCalledWith("jade-motion-paused", false);
    document.hidden = true;
    listeners.visibilitychange();
    expect(classList.toggle).toHaveBeenLastCalledWith("jade-motion-paused", true);
  });
});
