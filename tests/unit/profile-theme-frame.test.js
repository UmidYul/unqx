const {
  normalizeThemeByPlan,
  normalizeAvatarFrameByPlan,
  normalizeEmojiBackgroundByPlan,
  PROFILE_THEME_KEYS,
  PROFILE_AVATAR_FRAME_KEYS,
  PROFILE_EMOJI_BACKGROUND_KEYS,
} = require("../../src/services/profile");

describe("profile theme and avatar frame normalization", () => {
  test("exposes newly added theme, frame, and emoji background keys", () => {
    expect(PROFILE_THEME_KEYS).toContain("graffiti_neon");
    expect(PROFILE_THEME_KEYS).toContain("color_blue");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("chrome_ring");
    expect(PROFILE_AVATAR_FRAME_KEYS).toContain("orbit_dots");
    expect(PROFILE_AVATAR_FRAME_KEYS).not.toContain("comic_boom");
    expect(PROFILE_EMOJI_BACKGROUND_KEYS).toContain("ghosts");
    expect(PROFILE_EMOJI_BACKGROUND_KEYS).toContain("hearts");
  });

  test("keeps premium theme, frame, and emoji background for premium plan", () => {
    expect(normalizeThemeByPlan("graffiti_neon", "premium")).toBe("graffiti_neon");
    expect(normalizeAvatarFrameByPlan("orbit_dots", "premium")).toBe("orbit_dots");
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
});
