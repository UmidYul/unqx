const path = require("node:path");
const ejs = require("ejs");
const { THEME_CANVAS, opaqueColor, resolveBrowserTheme } = require("../../public/js/browser-theme");
const { PROFILE_THEME_KEYS } = require("../../src/services/profile");

describe("browser canvas colors", () => {
  test("covers every built-in theme with an opaque canvas", () => {
    for (const key of PROFILE_THEME_KEYS) {
      expect(THEME_CANVAS[key], key).toMatch(/^#[a-f0-9]{6}$/);
      expect(resolveBrowserTheme(key).color, key).toBe(THEME_CANVAS[key]);
    }
  });

  test.each(["midnight_obsidian", "golden_noir", "jade_luxe", "forged_carbon", "galaxy"])("keeps %s dark regardless of OS appearance", (key) => {
    expect(resolveBrowserTheme(key).scheme).toBe("dark");
    expect(resolveBrowserTheme(key).color).not.toBe("#ffffff");
  });

  test.each(["arctic", "linen", "sage_luxe", "ocean_2d", "sakura_blossom"])("uses the matching light canvas for %s", (key) => {
    expect(resolveBrowserTheme(key).scheme).toBe("light");
    expect(resolveBrowserTheme(key).color).toBe(THEME_CANVAS[key]);
  });

  test("custom gradients skip translucent highlights and image URLs", () => {
    expect(opaqueColor("radial-gradient(rgba(255,255,255,.12), transparent), linear-gradient(#123, #456)" )).toBe("#112233");
    expect(opaqueColor("url(https://example.com/#ffffff), rgb(18, 24, 32)")).toBe("#121820");
    expect(resolveBrowserTheme("custom", "#f1e3c8")).toEqual({ color: "#f1e3c8", scheme: "light" });
    expect(resolveBrowserTheme("custom", "url(/images/texture.png) #f1e3c8")).toEqual({ color: "#f1e3c8", scheme: "light" });
    expect(resolveBrowserTheme("__proto__")).toEqual({ color: "#111111", scheme: "dark" });
  });

  test("emits matching canvas and scheme before client scripts run", async () => {
    const html = await ejs.renderFile(path.join(process.cwd(), "src/views/partials/head.ejs"), {
      browserThemeKey: "golden_noir", resolveBrowserTheme, viewportFitCover: true,
      cspNonce: "test-nonce", assetVersion: "test",
    });
    expect(html).toContain('name="theme-color" content="#0b0e16"');
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).toContain("--unqx-browser-canvas: #0b0e16");
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain('src="/js/browser-theme.js?v=test" defer');
  });
});
