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

describe("Comic Fire theme integration", () => {
  test("is selectable in the editor and accepted by server validation", () => {
    expect(getProfileEditorPresets().signatureThemes.find(item => item.id === "comic_fire"))
      .toMatchObject({ label: "FIRE · Огненный комикс", premiumRequired: true });
    expect(CardUpsertSchema.shape.theme.parse("comic_fire")).toBe("comic_fire");
    expect(normalizeThemeByPlan("comic_fire", "premium")).toBe("comic_fire");
    expect(normalizeThemeByPlan("comic_fire", "none")).toBe("default_dark");
  });

  test("renders comic tokens and both continuous flame layers without affecting other themes", () => {
    const { renderer } = loadRenderer();
    const input = { name: "Alex", slug: "ABC123", tariff: "premium", theme: "comic_fire", buttons: [] };
    const html = renderer.renderCardView(input);
    expect(html).toContain('data-card-theme="comic_fire"');
    expect(html).toContain("--theme-accent-color:#e73823");
    expect(html).toContain("comic-fire-print");
    expect(html).toContain('class="comic-fire-background"');
    expect(html).toContain('class="comic-fire-foreground"');
    expect((html.match(/class="comic-flame /g) || []).length).toBe(6);
    expect(renderer.renderCardView({ ...input, theme: "default_dark" })).not.toContain('class="comic-fire-effects"');
  });

  test("preserves theme on the public server-rendered page", async () => {
    const html = await ejs.renderFile(path.join(process.cwd(), "src/views/public/card.ejs"), {
      card: { slug: "ABC123", name: "Alex", tariff: "premium", theme: "comic_fire", buttons: [] },
      cspNonce: "test", csrfToken: "test", assetVersion: "test", publicSettings: {}, userSession: null,
    });
    expect(html).toContain('data-card-theme="comic_fire"');
    expect(html).toContain('"theme":"comic_fire"');
  });

  test("pauses fire animations while the browser tab is hidden", () => {
    const { document, listeners, classList } = loadRenderer();
    expect(classList.toggle).toHaveBeenCalledWith("comic-fire-motion-paused", false);
    document.hidden = true;
    listeners.visibilitychange();
    expect(classList.toggle).toHaveBeenCalledWith("comic-fire-motion-paused", true);
  });
});
