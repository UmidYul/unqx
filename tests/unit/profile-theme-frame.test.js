const {
  normalizeThemeByPlan,
  normalizeAvatarFrameByPlan,
  normalizeEmojiBackgroundByPlan,
  PROFILE_THEME_KEYS,
  PROFILE_AVATAR_FRAME_KEYS,
  PROFILE_EMOJI_BACKGROUND_KEYS,
} = require("../../src/services/profile");
const fs = require("node:fs");
const path = require("node:path");
const { getProfileEditorPresets } = require("../../src/services/profile-editor-presets");

describe("profile theme and avatar frame normalization", () => {
  test("exposes newly added theme, frame, and emoji background keys", () => {
    expect(PROFILE_THEME_KEYS).toContain("graffiti_neon");
    expect(PROFILE_THEME_KEYS).toContain("color_blue");
    expect(PROFILE_THEME_KEYS).toContain("heritage_crest");
    expect(PROFILE_THEME_KEYS).toContain("football_pitch");
    expect(PROFILE_THEME_KEYS).toContain("anime_blush");
    expect(PROFILE_THEME_KEYS).toContain("cheetah_spots");
    expect(PROFILE_THEME_KEYS).toContain("serpent_scale");
    expect(PROFILE_THEME_KEYS).toContain("nebula_glass");
    expect(PROFILE_THEME_KEYS).toContain("galaxy");
    expect(PROFILE_THEME_KEYS).toContain("uzbekistan_35");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("chrome_ring");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("orbit_dots");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("laurel_wreath");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("medal_ribbon");
    expect(PROFILE_AVATAR_FRAME_KEYS).not.toContain("comic_boom");
    expect(PROFILE_EMOJI_BACKGROUND_KEYS).toContain("ghosts");
    expect(PROFILE_EMOJI_BACKGROUND_KEYS).toContain("hearts");
  });

  test("keeps premium theme, frame, and emoji background for premium plan", () => {
    expect(normalizeThemeByPlan("graffiti_neon", "premium")).toBe("graffiti_neon");
    expect(normalizeThemeByPlan("nebula_glass", "premium")).toBe("nebula_glass");
    expect(normalizeThemeByPlan("galaxy", "premium")).toBe("galaxy");
    expect(normalizeThemeByPlan("uzbekistan_35", "premium")).toBe("uzbekistan_35");
    expect(normalizeThemeByPlan("heritage_crest", "premium")).toBe("heritage_crest");
    expect(normalizeThemeByPlan("anime_blush", "premium")).toBe("anime_blush");
    expect(normalizeAvatarFrameByPlan("orbit_dots", "premium")).toBe("orbit_dots");
    expect(normalizeAvatarFrameByPlan("laurel_wreath", "premium")).toBe("laurel_wreath");
    expect(normalizeEmojiBackgroundByPlan("ghosts", "premium")).toBe("ghosts");
  });

  test("forces non-premium users to default theme, no frame, and no emoji background", () => {
    expect(normalizeThemeByPlan("graffiti_neon", "none")).toBe("default_dark");
    expect(normalizeAvatarFrameByPlan("orbit_dots", "none")).toBe("none");
    expect(normalizeEmojiBackgroundByPlan("ghosts", "none")).toBe("none");
  });

  test("normalizes removed comic boom frame to none", () => {
    expect(normalizeAvatarFrameByPlan("comic_boom", "premium")).toBe("none");
  });

  test("normalizes unsupported emoji background pack to none", () => {
    expect(normalizeEmojiBackgroundByPlan("sparkles", "premium")).toBe("none");
  });

  test("exposes Apple Liquid Glass preset and animated glass CSS", () => {
    const presets = getProfileEditorPresets();
    const liquidGlass = presets.signatureThemes.find((theme) => theme.id === "nebula_glass");
    const styles = fs.readFileSync(path.join(process.cwd(), "public", "css", "public-card.css"), "utf-8");

    expect(liquidGlass).toMatchObject({
      label: "Apple Liquid Glass",
      description: "Animated frosted glass",
      premiumRequired: true,
    });
    expect(styles).toContain("@keyframes unqLiquidGlassGradient");
    expect(styles).toContain("@keyframes unqLiquidGlassIslands");
    expect(styles).toContain("background-size: 400% 400%;");
    expect(styles).toContain("animation: unqLiquidGlassGradient 10s ease-in-out infinite;");
    expect(styles).toContain("animation: unqLiquidGlassIslands 11s ease-in-out infinite;");
    expect(styles).toContain("backdrop-filter: blur(25px)");
    expect(styles).toContain("will-change: background-position;");
  });

  test("exposes Galaxy preset and neon cosmic CSS", () => {
    const presets = getProfileEditorPresets();
    const galaxy = presets.signatureThemes.find((theme) => theme.id === "galaxy");
    const styles = fs.readFileSync(path.join(process.cwd(), "public", "css", "public-card.css"), "utf-8");

    expect(galaxy).toMatchObject({
      label: "Galaxy",
      description: "Neon cosmic portals",
      premiumRequired: true,
    });
    expect(styles).toContain('body[data-card-theme="galaxy"]');
    expect(styles).not.toContain("/images/galaxy-theme-bg.png");
    expect(styles).toContain("linear-gradient(135deg, #12072B 0%, #2A085C 50%, #5E179B 100%)");
    expect(styles).toContain("box-shadow: 0 0 10px rgba(0, 229, 255, 0.5)");
  });
});
