const {
  normalizeThemeByPlan,
  normalizeAvatarFrameByPlan,
  PROFILE_THEME_KEYS,
  PROFILE_AVATAR_FRAME_KEYS,
} = require("../../src/services/profile");

describe("profile theme and avatar frame normalization", () => {
  test("exposes newly added theme and frame keys", () => {
    expect(PROFILE_THEME_KEYS).toContain("graffiti_neon");
    expect(PROFILE_THEME_KEYS).toContain("color_blue");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("chrome_ring");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("orbit_dots");
  });

  test("keeps premium theme and frame for premium plan", () => {
    expect(normalizeThemeByPlan("graffiti_neon", "premium")).toBe("graffiti_neon");
    expect(normalizeAvatarFrameByPlan("orbit_dots", "premium")).toBe("orbit_dots");
  });

  test("forces non-premium users to default theme and no frame", () => {
    expect(normalizeThemeByPlan("graffiti_neon", "none")).toBe("default_dark");
    expect(normalizeAvatarFrameByPlan("orbit_dots", "none")).toBe("none");
  });
});
