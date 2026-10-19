(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.UNQBrowserTheme = api;
    api.mount(document);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Solid canvas beneath each theme's gradients, including the Safari safe areas.
  const THEME_CANVAS = Object.freeze({
    default_dark: "#f7f8fa",
    arctic: "#e8f3f9",
    linen: "#f3ecdf",
    marble: "#ffffff",
    forest: "#071a10",
    sage_luxe: "#eef4ef",
    midnight_obsidian: "#090f16",
    golden_noir: "#0b0e16",
    black_gold_leaf: "#000000",
    jade_luxe: "#020403",
    comic_fire: "#3b160e",
    forged_carbon: "#050505",
    arcadia_painted: "#34402a",
    ocean_2d: "#dff7ff",
    greek_olympus_2d: "#0f1a14",
    aurora_codex: "#f4ead2",
    codex_da_vinci: "#dfd0b8",
    nebula_glass: "#0a0f24",
    galaxy: "#12072b",
    volt_sport: "#b6ff00",
    minion_yellow: "#ffe45c",
    casino_royale: "#073b2e",
    soviet_carpet: "#800000",
    vintage_mickey: "#f5e6ca",
    looney_tunes: "#98d4e7",
    rick_morty_portal: "#0b001a",
    gravity_falls: "#1a2e22",
    venom_symbiote: "#050508",
    snow_leopard: "#e2e8f0",
    shinobi_path: "#c84b31",
    shinobi_way: "#d15f47",
    samarkand_heritage: "#c5a07a",
    uzbekistan_35: "#0a192f",
    uzbekistan_2d: "#08121e",
    turtle_power: "#151d24",
    egypt_nile: "#c17a44",
    kawaii_kitty: "#ffc0cb",
    sakura_blossom: "#eadbc8",
    starry_night: "#0b1528",
    velours: "#2d0a12",
    graffiti: "#050506",
    graffiti_neon: "#12111d",
    heritage_crest: "#fff5f9",
    ivory_tennis: "#050608",
    grand_slam_clay: "#0a1f4d",
    racing_green: "#f5f9ff",
    polo_navy: "#061422",
    alpine_ski: "#fff8fe",
    boxing_legend: "#2b0900",
    basketball_court: "#180821",
    football_pitch: "#07251d",
    olympic_gold: "#180825",
    anime_blush: "#fff1fa",
    cheetah_spots: "#5a2b0d",
    serpent_scale: "#07190f",
    color_red: "#3c0710",
    color_orange: "#4f2100",
    color_yellow: "#5f4600",
    color_green: "#0d3317",
    color_teal: "#072f33",
    color_blue: "#0b234d",
    color_purple: "#33124f",
    color_pink: "#57163b",
  });

  function opaqueColor(background) {
    // Ignore image URLs and transparent highlights; use an actual opaque paint color.
    const source = String(background || "").replace(/url\([^)]*\)/gi, "");
    const colors = source.match(/#[a-f0-9]{6}\b|#[a-f0-9]{3}\b|rgba?\([^)]*\)/gi) || [];
    for (const color of colors) {
      if (color.startsWith("#")) {
        return (color.length === 4 ? "#" + color.slice(1).split("").map((c) => c + c).join("") : color).toLowerCase();
      }
      const parts = color.match(/[\d.]+/g)?.map(Number) || [];
      if (parts.length < 3 || (parts.length > 3 && parts[3] < 1)) continue;
      return "#" + parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
    }
    return "";
  }

  function resolveBrowserTheme(key, background = "") {
    const color = opaqueColor(background) || (Object.prototype.hasOwnProperty.call(THEME_CANVAS, key) ? THEME_CANVAS[key] : "#111111");
    const rgb = [1, 3, 5].map((i) => {
      const c = Number.parseInt(color.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return { color, scheme: luminance > 0.179 ? "light" : "dark" };
  }

  function mount(doc) {
    const root = doc.documentElement;
    const body = doc.body;
    if (!body?.hasAttribute("data-card-theme")) return;
    const initialKey = body.dataset.cardTheme;
    const sync = () => {
      const key = body.dataset.cardTheme;
      const customBg = root.style.getPropertyValue("--unqx-public-page-bg");
      const initialBg = doc.defaultView.getComputedStyle(root).getPropertyValue("--unqx-browser-initial-bg");
      const customColor = opaqueColor(customBg);
      const fallback = key === initialKey ? initialBg : "";
      const theme = resolveBrowserTheme(key, customColor || fallback);
      if (root.style.getPropertyValue("--unqx-browser-canvas") !== theme.color) root.style.setProperty("--unqx-browser-canvas", theme.color);
      if (root.style.colorScheme !== theme.scheme) root.style.colorScheme = theme.scheme;
      for (const [name, value] of [["theme-color", theme.color], ["color-scheme", theme.scheme]]) {
        const meta = doc.querySelector(`meta[name="${name}"]`);
        if (meta && meta.content !== value) meta.content = value;
      }
    };
    sync();
    const observer = new doc.defaultView.MutationObserver(sync);
    observer.observe(body, { attributes: true, attributeFilter: ["data-card-theme"] });
    observer.observe(root, { attributes: true, attributeFilter: ["style"] });
    doc.defaultView.addEventListener("pageshow", sync);
  }

  return { THEME_CANVAS, opaqueColor, resolveBrowserTheme, mount };
});
