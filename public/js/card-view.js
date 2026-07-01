(function initCardViewGlobal() {
  const COLOR_THEME_KEYS = [
    "color_red",
    "color_orange",
    "color_yellow",
    "color_green",
    "color_teal",
    "color_blue",
    "color_purple",
    "color_pink",
  ];
  const THEME_KEYS = [
    "default_dark",
    "arctic",
    "linen",
    "marble",
    "forest",
    "sage_luxe",
    "midnight_obsidian",
    "golden_noir",
    "aurora_codex",
    "nebula_glass",
    "galaxy",
    "velours",
    "graffiti_neon",
    "heritage_crest",
    "ivory_tennis",
    "grand_slam_clay",
    "racing_green",
    "polo_navy",
    "alpine_ski",
    "boxing_legend",
    "basketball_court",
    "football_pitch",
    "olympic_gold",
    "anime_blush",
    "cheetah_spots",
    "serpent_scale",
    ...COLOR_THEME_KEYS,
  ];
  const AVATAR_FRAME_KEYS = [
    "none",
    "chrome_ring",
    "neon_spray",
    "sticker_bubble",
    "chain_link",
    "pixel_glow",
    "starburst",
    "drip_outline",
    "tape_collage",
    "orbit_dots",
    "laurel_wreath",
    "trophy_gold",
    "tennis_lines",
    "racing_stripes",
    "varsity_patch",
    "boxing_rope",
    "basketball_arc",
    "football_stitch",
    "stopwatch_ring",
    "medal_ribbon",
  ];
  const EMOJI_BACKGROUND_PACK_KEYS = [
    "none",
    "ghosts",
    "stars",
    "lightning",
    "crowns",
    "webs",
    "hearts",
  ];
  const PET_TYPE_KEYS = ["kitten", "puppy", "snake"];
  const PET_TYPE_LABELS = {
    kitten: "Коала",
    puppy: "Котик",
    snake: "Леопард",
  };
  const PET_ASSET_URLS = {
    kitten: "/assets/pets/pet1.png",
    puppy: "/assets/pets/pet2.png",
    snake: "/assets/pets/pet3.png",
  };
  const PET_RENDER_PRIORITY = {
    kitten: 0,
    puppy: 1,
    snake: 2,
  };

  function hexToRgb(value) {
    const raw = String(value || "").trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(raw);
    if (!match) return null;
    const normalized = match[1];
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  function rgba(value, alpha) {
    const rgb = hexToRgb(value);
    if (!rgb) return value;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function createMonochromeTheme({
    surfaceBg,
    base,
    deep,
    accent,
    text,
    role,
    muted,
    buttonText,
    buttonSecondaryText,
    badgeText,
    border,
    fontFamily = "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
    nameFontWeight = "700",
    roleLetterSpacing = "0.12em",
    radius = "24px",
    isLight = false,
  }) {
    return {
      cardBg: `linear-gradient(165deg, ${deep} 0%, ${base} 54%, ${surfaceBg} 100%)`,
      cardBgOverlay: "monochrome_flow",
      surfaceBg: rgba(surfaceBg, isLight ? 0.88 : 0.74),
      cardBorder: `1px solid ${border}`,
      surfaceBorder: `1px solid ${rgba(accent, isLight ? 0.26 : 0.24)}`,
      dividerColor: rgba(accent, isLight ? 0.24 : 0.2),
      nameColor: text,
      roleColor: role,
      mutedColor: muted,
      accentColor: accent,
      emailColor: text,
      buttonPrimaryBg: `linear-gradient(135deg, ${accent}, ${base})`,
      buttonPrimaryText: buttonText,
      buttonPrimaryBorder: rgba(accent, 0.78),
      buttonSecondaryBg: isLight ? rgba("#ffffff", 0.44) : rgba(deep, 0.34),
      buttonSecondaryText: buttonSecondaryText || text,
      buttonSecondaryBorder: rgba(accent, isLight ? 0.36 : 0.28),
      badgeText,
      badgeBg: isLight ? rgba("#ffffff", 0.22) : rgba("#000000", 0.16),
      badgeBorder: `1px solid ${rgba(accent, isLight ? 0.3 : 0.24)}`,
      topLineGradient: `linear-gradient(90deg, transparent, ${rgba(accent, 0.7)}, transparent)`,
      avatarBg: `linear-gradient(135deg, ${base}, ${surfaceBg})`,
      avatarText: text,
      avatarBorder: `2px solid ${rgba(accent, isLight ? 0.42 : 0.28)}`,
      cardBorderRadius: radius,
      fontFamily,
      nameFontStyle: "normal",
      nameFontWeight,
      roleLetterSpacing,
      scoreLabelColor: role,
      scoreValueColor: text,
      scoreBarFill: accent,
      scoreBarTrack: rgba(base, isLight ? 0.18 : 0.4),
      scorePercentileColor: muted,
      cardShadow: isLight
        ? `0 18px 42px ${rgba(base, 0.16)}`
        : `0 18px 46px ${rgba(deep, 0.52)}`,
      buttonShineGradient: `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${rgba(text, 0.14)} 45%, ${rgba(
        text,
        0.24,
      )} 50%, ${rgba(text, 0.14)} 55%, rgba(255,255,255,0) 100%)`,
    };
  }

  function createGraffitiTheme() {
    return {
      cardBg: "linear-gradient(165deg, #12111d 0%, #19142a 48%, #0f1220 100%)",
      cardBgOverlay: "graffiti_chaos",
      surfaceBg: "rgba(15, 18, 31, 0.82)",
      cardBorder: "1px solid rgba(94, 247, 255, 0.28)",
      surfaceBorder: "1px solid rgba(242, 132, 255, 0.22)",
      dividerColor: "rgba(139, 255, 94, 0.24)",
      nameColor: "#f7fbff",
      roleColor: "#86f7ff",
      mutedColor: "#f284ff",
      accentColor: "#9bff62",
      emailColor: "#dffcff",
      buttonPrimaryBg: "linear-gradient(135deg, #5ef7ff 0%, #f54fff 52%, #b5ff5e 100%)",
      buttonPrimaryText: "#11131a",
      buttonPrimaryBorder: "rgba(94, 247, 255, 0.54)",
      buttonSecondaryBg: "rgba(16, 20, 32, 0.54)",
      buttonSecondaryText: "#f5fbff",
      buttonSecondaryBorder: "rgba(242, 132, 255, 0.34)",
      badgeText: "#f8a7ff",
      badgeBg: "rgba(30, 18, 45, 0.52)",
      badgeBorder: "1px solid rgba(242, 132, 255, 0.34)",
      topLineGradient: "linear-gradient(90deg, rgba(94,247,255,0), rgba(94,247,255,0.92), rgba(181,255,94,0.9), rgba(245,79,255,0))",
      avatarBg: "linear-gradient(135deg, #19142a, #10131f)",
      avatarText: "#f7fbff",
      avatarBorder: "2px solid rgba(94, 247, 255, 0.26)",
      cardBorderRadius: "26px",
      fontFamily: "'Trebuchet MS', 'Arial Black', 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "800",
      roleLetterSpacing: "0.16em",
      scoreLabelColor: "#86f7ff",
      scoreValueColor: "#f7fbff",
      scoreBarFill: "#9bff62",
      scoreBarTrack: "rgba(94, 247, 255, 0.18)",
      scorePercentileColor: "#f284ff",
      cardShadow: "0 22px 56px rgba(4, 8, 18, 0.7)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.18) 55%, rgba(255,255,255,0) 100%)",
    };
  }

  const THEME_CONFIG = {
    default_dark: {
      cardBg: "#ffffff",
      cardBgOverlay: "none",
      surfaceBg: "#f5f5f5",
      cardBorder: "1px solid #d8d8d8",
      surfaceBorder: "1px solid #e5e5e5",
      dividerColor: "#e6e6e6",
      nameColor: "#242424",
      roleColor: "#737373",
      mutedColor: "#a0a0a0",
      accentColor: "#202020",
      emailColor: "#4b5563",
      buttonPrimaryBg: "#151515",
      buttonPrimaryText: "#ffffff",
      buttonPrimaryBorder: "#151515",
      buttonSecondaryBg: "#151515",
      buttonSecondaryText: "#ffffff",
      buttonSecondaryBorder: "#151515",
      badgeText: "#5f6368",
      badgeBg: "#fafafa",
      badgeBorder: "#d6d6d6",
      topLineGradient: "none",
      avatarBg: "#ededed",
      avatarText: "#4a4a4a",
      avatarBorder: "1px solid #ececec",
      cardBorderRadius: "20px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "400",
      roleLetterSpacing: "normal",
      scoreLabelColor: "#737373",
      scoreValueColor: "#111111",
      scoreBarFill: "#171717",
      scoreBarTrack: "#e5e5e5",
      scorePercentileColor: "#737373",
      cardShadow: "0 1px 2px rgba(17, 17, 17, 0.08)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0.2) 55%, rgba(255,255,255,0) 100%)",
    },
    arctic: {
      cardBg: "linear-gradient(160deg, #f8fafc 0%, #eef2f7 100%)",
      cardBgOverlay: "none",
      surfaceBg: "#f0f5f9",
      cardBorder: "1px solid #dce4ed",
      surfaceBorder: "1px solid #dce4ed",
      dividerColor: "#dce4ed",
      nameColor: "#1a2a3a",
      roleColor: "#7a9db8",
      mutedColor: "#a0b8c8",
      accentColor: "#7a9db8",
      emailColor: "#4a6880",
      buttonPrimaryBg: "#1a2a3a",
      buttonPrimaryText: "#f0f6ff",
      buttonPrimaryBorder: "#1a2a3a",
      buttonSecondaryBg: "transparent",
      buttonSecondaryText: "#4a6880",
      buttonSecondaryBorder: "#c8d4de",
      badgeText: "#7a9db8",
      badgeBg: "transparent",
      badgeBorder: "transparent",
      topLineGradient: "linear-gradient(90deg, #b0c4d4, #7a9db8, #b0c4d4)",
      avatarBg: "linear-gradient(135deg, #e0eaf4, #c4d6e8)",
      avatarText: "#4a6880",
      avatarBorder: "2px solid #b0c4d4",
      cardBorderRadius: "24px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "300",
      roleLetterSpacing: "2px",
      scoreLabelColor: "#7a9db8",
      scoreValueColor: "#1a2a3a",
      scoreBarFill: "#1a2a3a",
      scoreBarTrack: "#dce4ed",
      scorePercentileColor: "#a0b8c8",
      cardShadow: "0 1px 2px rgba(17, 17, 17, 0.08)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.16) 55%, rgba(255,255,255,0) 100%)",
    },
    linen: {
      cardBg: "linear-gradient(160deg, #faf8f4 0%, #f2ede6 100%)",
      cardBgOverlay: "none",
      surfaceBg: "#f5f0ea",
      cardBorder: "1px solid #e0d8ce",
      surfaceBorder: "1px solid #e0d4c8",
      dividerColor: "#d4c4b0",
      nameColor: "#3a2e24",
      roleColor: "#a08060",
      mutedColor: "#b0a090",
      accentColor: "#c8a882",
      emailColor: "#8a7060",
      buttonPrimaryBg: "#3a2e24",
      buttonPrimaryText: "#f2ede6",
      buttonPrimaryBorder: "#3a2e24",
      buttonSecondaryBg: "transparent",
      buttonSecondaryText: "#8a7060",
      buttonSecondaryBorder: "#d4c4b0",
      badgeText: "#b09070",
      badgeBg: "transparent",
      badgeBorder: "transparent",
      topLineGradient: "linear-gradient(90deg, transparent, #c8a882, transparent)",
      avatarBg: "linear-gradient(135deg, #ede8e0, #d8cfc4)",
      avatarText: "#7a6650",
      avatarBorder: "2px solid #c8bdb0",
      cardBorderRadius: "20px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      nameFontStyle: "italic",
      nameFontWeight: "400",
      roleLetterSpacing: "2px",
      scoreLabelColor: "#b09070",
      scoreValueColor: "#3a2e24",
      scoreBarFill: "#c8a882",
      scoreBarTrack: "#e0d8ce",
      scorePercentileColor: "#b0a090",
      cardShadow: "0 1px 2px rgba(58, 46, 36, 0.08)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.24) 50%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0) 100%)",
    },
    marble: {
      cardBg: "#ffffff",
      cardBgOverlay: "marble_veins",
      surfaceBg: "#ffffff",
      cardBorder: "1px solid #ebebeb",
      surfaceBorder: "1px solid #ebebeb",
      dividerColor: "#ebebeb",
      nameColor: "#0a0a0a",
      roleColor: "#aaaaaa",
      mutedColor: "#cccccc",
      accentColor: "#0a0a0a",
      emailColor: "#999999",
      buttonPrimaryBg: "#0a0a0a",
      buttonPrimaryText: "#ffffff",
      buttonPrimaryBorder: "#0a0a0a",
      buttonSecondaryBg: "#ffffff",
      buttonSecondaryText: "#333333",
      buttonSecondaryBorder: "#ebebeb",
      badgeText: "#bbbbbb",
      badgeBg: "transparent",
      badgeBorder: "transparent",
      topLineGradient: "none",
      topLineSolid: "#0a0a0a",
      avatarBg: "linear-gradient(135deg, #f5f5f5, #e8e8e8)",
      avatarText: "#555555",
      avatarBorder: "2px solid #dddddd",
      cardBorderRadius: "0px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "800",
      roleLetterSpacing: "3px",
      scoreLabelColor: "#aaaaaa",
      scoreValueColor: "#0a0a0a",
      scoreBarFill: "#0a0a0a",
      scoreBarTrack: "#ebebeb",
      scorePercentileColor: "#cccccc",
      cardShadow: "0 1px 2px rgba(10, 10, 10, 0.06)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.16) 55%, rgba(255,255,255,0) 100%)",
    },
    forest: {
      cardBg: "linear-gradient(170deg, #153c27 0%, #1f5335 56%, #112f20 100%)",
      cardBgOverlay: "forest_grain",
      surfaceBg: "#103320",
      cardBorder: "1px solid #2f6b47",
      surfaceBorder: "1px solid #285d3d",
      dividerColor: "#3b7c56",
      nameColor: "#e7dbbf",
      roleColor: "#e7dbbf",
      mutedColor: "#e7dbbf",
      accentColor: "#e7dbbf",
      emailColor: "#e7dbbf",
      buttonPrimaryBg: "linear-gradient(135deg, #18472d, #245f3d)",
      buttonPrimaryText: "#e7dbbf",
      buttonPrimaryBorder: "#3b7c56",
      buttonSecondaryBg: "transparent",
      buttonSecondaryText: "#e7dbbf",
      buttonSecondaryBorder: "#2f6b47",
      badgeText: "#e7dbbf",
      badgeBg: "transparent",
      badgeBorder: "transparent",
      topLineGradient: "linear-gradient(90deg, transparent, #e7dbbf55, transparent)",
      avatarBg: "linear-gradient(135deg, #18472d, #235b3a)",
      avatarText: "#e7dbbf",
      avatarBorder: "2px solid rgba(231, 219, 191, 0.24)",
      cardBorderRadius: "20px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      nameFontStyle: "italic",
      nameFontWeight: "400",
      roleLetterSpacing: "2px",
      scoreLabelColor: "#e7dbbf",
      scoreValueColor: "#e7dbbf",
      scoreBarFill: "#e7dbbf",
      scoreBarTrack: "#2a6040",
      scorePercentileColor: "#e7dbbf",
      cardShadow: "0 1px 2px rgba(10, 28, 18, 0.6)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(231,219,191,0) 0%, rgba(231,219,191,0.11) 45%, rgba(231,219,191,0.18) 50%, rgba(231,219,191,0.11) 55%, rgba(231,219,191,0) 100%)",
    },
    sage_luxe: {
      cardBg: "linear-gradient(165deg, #f7faf7 0%, #edf2ee 54%, #e6ece7 100%)",
      cardBgOverlay: "sage_geometry",
      surfaceBg: "#f3f7f3",
      cardBorder: "1px solid #cfd8cf",
      surfaceBorder: "1px solid #d8e0d8",
      dividerColor: "#c9d3c9",
      nameColor: "#1f2a23",
      roleColor: "#667569",
      mutedColor: "#8a988d",
      accentColor: "#7f927f",
      emailColor: "#4f5e54",
      buttonPrimaryBg: "linear-gradient(135deg, #243129, #33443a)",
      buttonPrimaryText: "#f1f6f2",
      buttonPrimaryBorder: "#2e3e34",
      buttonSecondaryBg: "rgba(249, 252, 249, 0.72)",
      buttonSecondaryText: "#425245",
      buttonSecondaryBorder: "#c6d0c6",
      badgeText: "#5f6d62",
      badgeBg: "rgba(245, 250, 245, 0.85)",
      badgeBorder: "1px solid rgba(122, 140, 124, 0.28)",
      topLineGradient: "linear-gradient(90deg, transparent, #94a492, transparent)",
      avatarBg: "linear-gradient(135deg, #dce5dd, #c7d3c9)",
      avatarText: "#3f5143",
      avatarBorder: "2px solid rgba(109, 126, 110, 0.3)",
      cardBorderRadius: "24px",
      fontFamily: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "600",
      roleLetterSpacing: "1.2px",
      scoreLabelColor: "#627164",
      scoreValueColor: "#243228",
      scoreBarFill: "#758976",
      scoreBarTrack: "#d9e2d9",
      scorePercentileColor: "#7d8d80",
      cardShadow: "0 16px 40px rgba(58, 76, 63, 0.14)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(241,246,242,0) 0%, rgba(241,246,242,0.18) 45%, rgba(241,246,242,0.32) 50%, rgba(241,246,242,0.18) 55%, rgba(241,246,242,0) 100%)",
    },
    midnight_obsidian: {
      cardBg: "linear-gradient(160deg, #0c1118 0%, #111927 45%, #0a0f15 100%)",
      cardBgOverlay: "midnight_constellation",
      surfaceBg: "#101827",
      cardBorder: "1px solid #2b3547",
      surfaceBorder: "1px solid #273245",
      dividerColor: "#2f3b52",
      nameColor: "#d5e4ff",
      roleColor: "#8ea7cf",
      mutedColor: "#7084a5",
      accentColor: "#7fb3ff",
      emailColor: "#b8c8e6",
      buttonPrimaryBg: "linear-gradient(135deg, #1b2f4f, #284c78)",
      buttonPrimaryText: "#ecf3ff",
      buttonPrimaryBorder: "#3f5f8e",
      buttonSecondaryBg: "transparent",
      buttonSecondaryText: "#c2d6f7",
      buttonSecondaryBorder: "#3a5379",
      badgeText: "#9db6da",
      badgeBg: "rgba(45, 60, 90, 0.26)",
      badgeBorder: "1px solid rgba(141, 170, 213, 0.38)",
      topLineGradient: "linear-gradient(90deg, transparent, #6ea3f3, transparent)",
      avatarBg: "linear-gradient(135deg, #172238, #0f1829)",
      avatarText: "#d6e6ff",
      avatarBorder: "2px solid rgba(123, 157, 211, 0.34)",
      cardBorderRadius: "20px",
      fontFamily: "'Sora', 'Avenir Next', 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "500",
      roleLetterSpacing: "1.5px",
      scoreLabelColor: "#8ea7cf",
      scoreValueColor: "#d7e7ff",
      scoreBarFill: "#7fb3ff",
      scoreBarTrack: "#273245",
      scorePercentileColor: "#7f97bc",
      cardShadow: "0 18px 42px rgba(3, 7, 13, 0.6)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(205,225,255,0) 0%, rgba(205,225,255,0.16) 45%, rgba(205,225,255,0.28) 50%, rgba(205,225,255,0.16) 55%, rgba(205,225,255,0) 100%)",
    },
    golden_noir: {
      cardBg: "linear-gradient(160deg, #0f121b 0%, #161b28 46%, #0d1018 100%)",
      cardBgOverlay: "noir_gold_dust",
      surfaceBg: "#121724",
      cardBorder: "1px solid #2e3444",
      surfaceBorder: "1px solid #30384a",
      dividerColor: "#394257",
      nameColor: "#d8c184",
      roleColor: "#bba56f",
      mutedColor: "#8b7c57",
      accentColor: "#c9ad6a",
      emailColor: "#cdb67f",
      buttonPrimaryBg: "linear-gradient(135deg, #b89d63, #d8c184)",
      buttonPrimaryText: "#11151f",
      buttonPrimaryBorder: "#cdb375",
      buttonSecondaryBg: "transparent",
      buttonSecondaryText: "#cdb67f",
      buttonSecondaryBorder: "#6e603f",
      badgeText: "#d6bf85",
      badgeBg: "rgba(36, 29, 16, 0.38)",
      badgeBorder: "1px solid rgba(201, 173, 106, 0.36)",
      topLineGradient: "linear-gradient(90deg, transparent, #c9ad6a, transparent)",
      avatarBg: "linear-gradient(135deg, #2a2f3e, #171b26)",
      avatarText: "#d9c184",
      avatarBorder: "2px solid rgba(201, 173, 106, 0.3)",
      cardBorderRadius: "20px",
      fontFamily: "'DM Serif Display', 'Cormorant Garamond', Georgia, serif",
      nameFontStyle: "normal",
      nameFontWeight: "500",
      roleLetterSpacing: "1.4px",
      scoreLabelColor: "#bba56f",
      scoreValueColor: "#dfc98e",
      scoreBarFill: "#c9ad6a",
      scoreBarTrack: "#2e3444",
      scorePercentileColor: "#8b7c57",
      cardShadow: "0 18px 42px rgba(6, 8, 13, 0.62)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(234,214,161,0) 0%, rgba(234,214,161,0.18) 45%, rgba(234,214,161,0.3) 50%, rgba(234,214,161,0.18) 55%, rgba(234,214,161,0) 100%)",
    },
    aurora_codex: {
      cardBg: "linear-gradient(166deg, #fbf4e6 0%, #f4ead3 50%, #fcf7ea 100%)",
      cardBgOverlay: "codex_corner_lines",
      surfaceBg: "rgba(255, 251, 243, 0.86)",
      cardBorder: "1px solid #bfa781",
      surfaceBorder: "1px solid #c6af88",
      dividerColor: "#b69a73",
      nameColor: "#1f1711",
      roleColor: "#5c4636",
      mutedColor: "#866a54",
      accentColor: "#8f2820",
      emailColor: "#4a382c",
      buttonPrimaryBg: "linear-gradient(135deg, rgba(143, 40, 32, 0.92), rgba(173, 58, 41, 0.9))",
      buttonPrimaryText: "#fff7ea",
      buttonPrimaryBorder: "#8f2820",
      buttonSecondaryBg: "rgba(143, 40, 32, 0.07)",
      buttonSecondaryText: "#61241e",
      buttonSecondaryBorder: "#b89f79",
      badgeText: "#6f5440",
      badgeBg: "rgba(255, 250, 241, 0.86)",
      badgeBorder: "1px solid rgba(122, 86, 58, 0.24)",
      topLineGradient: "linear-gradient(90deg, #7e1f1d, #c54e3d, #7e1f1d)",
      avatarBg: "linear-gradient(135deg, #4d3222, #2f2017)",
      avatarText: "#f4e3cb",
      avatarBorder: "1px solid rgba(120, 76, 48, 0.66)",
      cardBorderRadius: "3px",
      fontFamily: "'Cormorant Garamond', 'Iowan Old Style', 'Times New Roman', serif",
      nameFontStyle: "normal",
      nameFontWeight: "700",
      roleLetterSpacing: "0.05em",
      scoreLabelColor: "#7e624d",
      scoreValueColor: "#2d1f15",
      scoreBarFill: "#8f2820",
      scoreBarTrack: "#e8dcc6",
      scorePercentileColor: "#8f7258",
      cardShadow: "0 18px 34px rgba(86, 59, 33, 0.18)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,248,232,0) 0%, rgba(255,248,232,0.2) 45%, rgba(255,248,232,0.36) 50%, rgba(255,248,232,0.2) 55%, rgba(255,248,232,0) 100%)",
    },
    nebula_glass: {
      cardBg: "rgba(10, 15, 30, 0.55)",
      cardBgOverlay: "none",
      surfaceBg: "rgba(255, 255, 255, 0.045)",
      cardBorder: "1px solid rgba(255, 255, 255, 0.08)",
      surfaceBorder: "1px solid rgba(255, 255, 255, 0.12)",
      dividerColor: "rgba(255, 255, 255, 0.08)",
      nameColor: "#ffffff",
      roleColor: "rgba(225, 235, 255, 0.7)",
      mutedColor: "rgba(225, 235, 255, 0.58)",
      accentColor: "#a9c7ff",
      emailColor: "rgba(229, 239, 255, 0.82)",
      buttonPrimaryBg: "rgba(255, 255, 255, 0.04)",
      buttonPrimaryText: "#ffffff",
      buttonPrimaryBorder: "rgba(255, 255, 255, 0.12)",
      buttonSecondaryBg: "rgba(255, 255, 255, 0.04)",
      buttonSecondaryText: "#ffffff",
      buttonSecondaryBorder: "rgba(255, 255, 255, 0.12)",
      badgeText: "#ffffff",
      badgeBg: "rgba(255, 255, 255, 0.055)",
      badgeBorder: "1px solid rgba(255, 255, 255, 0.14)",
      topLineGradient: "linear-gradient(90deg, rgba(255,255,255,0), rgba(168,199,255,0.38), rgba(255,255,255,0))",
      avatarBg: "rgba(255, 255, 255, 0.06)",
      avatarText: "#ffffff",
      avatarBorder: "1px solid rgba(255, 255, 255, 0.18)",
      cardBorderRadius: "28px",
      fontFamily: "'SF Pro Display', 'Helvetica Neue', 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "600",
      roleLetterSpacing: "0.08em",
      scoreLabelColor: "rgba(255, 255, 255, 0.62)",
      scoreValueColor: "#ffffff",
      scoreBarFill: "rgba(255, 255, 255, 0.68)",
      scoreBarTrack: "rgba(255, 255, 255, 0.18)",
      scorePercentileColor: "rgba(255, 255, 255, 0.6)",
      cardShadow: "0 28px 70px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      buttonShineGradient: "none",
    },
    galaxy: {
      cardBg: "rgba(26, 11, 54, 0.75)",
      cardBgOverlay: "none",
      surfaceBg: "rgba(26, 11, 54, 0.75)",
      cardBorder: "2px solid #000000",
      surfaceBorder: "2px solid #000000",
      dividerColor: "rgba(0, 229, 255, 0.38)",
      nameColor: "#ffffff",
      roleColor: "#f1eaff",
      mutedColor: "rgba(241, 234, 255, 0.72)",
      accentColor: "#00e5ff",
      emailColor: "#f1eaff",
      buttonPrimaryBg: "linear-gradient(135deg, #00e5ff, #00a3ff)",
      buttonPrimaryText: "#061123",
      buttonPrimaryBorder: "#000000",
      buttonSecondaryBg: "rgba(26, 11, 54, 0.75)",
      buttonSecondaryText: "#f1eaff",
      buttonSecondaryBorder: "#000000",
      badgeText: "#061123",
      badgeBg: "linear-gradient(135deg, #00e5ff, #00a3ff)",
      badgeBorder: "2px solid #000000",
      topLineGradient: "linear-gradient(90deg, transparent, #00e5ff, transparent)",
      avatarBg: "linear-gradient(135deg, #12072b, #2a085c 56%, #00a3ff)",
      avatarText: "#ffffff",
      avatarBorder: "2px solid #000000",
      cardBorderRadius: "32px",
      fontFamily: "'Sora', 'Inter', 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "700",
      roleLetterSpacing: "0.08em",
      scoreLabelColor: "rgba(241, 234, 255, 0.72)",
      scoreValueColor: "#ffffff",
      scoreBarFill: "#00e5ff",
      scoreBarTrack: "rgba(241, 234, 255, 0.16)",
      scorePercentileColor: "#00e5ff",
      cardShadow: "0 0 10px rgba(0, 229, 255, 0.5), 0 28px 70px rgba(6, 2, 20, 0.55)",
      buttonShineGradient:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0) 100%)",
    },
    velours: {
      cardBg: "linear-gradient(165deg, #2d0a12 0%, #2a0911 52%, #380d18 100%)",
      cardBgOverlay: "velvet_weave",
      surfaceBg: "#14040a",
      cardBorder: "1px solid #5a1828",
      surfaceBorder: "1px solid #4a1220",
      dividerColor: "#5a1828",
      nameColor: "#f5e8e8",
      roleColor: "#d8b6bf",
      mutedColor: "#b58a94",
      accentColor: "#c9a55a",
      emailColor: "#e6cfd4",
      buttonPrimaryBg: "linear-gradient(135deg, #5a1828, #3a0e18)",
      buttonPrimaryText: "#f5e8e8",
      buttonPrimaryBorder: "#8b2a3a",
      buttonSecondaryBg: "transparent",
      buttonSecondaryText: "#d9be82",
      buttonSecondaryBorder: "rgba(201, 165, 90, 0.44)",
      badgeText: "#c9a55a",
      badgeBg: "transparent",
      badgeBorder: "1px solid rgba(201, 165, 90, 0.26)",
      topLineGradient: "linear-gradient(90deg, transparent, rgba(201, 165, 90, 0.5), transparent)",
      avatarBg: "linear-gradient(135deg, #3a0e18, #220609)",
      avatarText: "#c9a55a",
      avatarBorder: "2px solid rgba(201, 165, 90, 0.19)",
      cardBorderRadius: "22px",
      fontFamily: "'Cormorant Garamond', 'Iowan Old Style', 'Times New Roman', serif",
      nameFontStyle: "normal",
      nameFontWeight: "600",
      roleLetterSpacing: "1.4px",
      scoreLabelColor: "#c9a0a9",
      scoreValueColor: "#f5e8e8",
      scoreBarFill: "#c9a55a",
      scoreBarTrack: "#3a0e18",
      scorePercentileColor: "#c9a0a9",
      cardShadow: "0 18px 44px rgba(24, 3, 9, 0.62)",
      buttonShineGradient: "none",
    },
    graffiti_neon: createGraffitiTheme(),
    heritage_crest: createMonochromeTheme({
      surfaceBg: "#ffe6f0",
      base: "#ffc6dd",
      deep: "#fff5f9",
      accent: "#ff6fae",
      text: "#6d2447",
      role: "#b34d78",
      muted: "#c97899",
      buttonText: "#fff7fb",
      badgeText: "#9d3b66",
      border: "#ff9fca",
      isLight: true,
    }),
    ivory_tennis: createMonochromeTheme({
      surfaceBg: "#15171c",
      base: "#2b2f36",
      deep: "#050608",
      accent: "#f0c84b",
      text: "#f4f4f5",
      role: "#b8bdc6",
      muted: "#858b96",
      buttonText: "#07080a",
      badgeText: "#f0c84b",
      border: "#3d424c",
    }),
    grand_slam_clay: createMonochromeTheme({
      surfaceBg: "#123b86",
      base: "#cf1f2d",
      deep: "#0a1f4d",
      accent: "#6bb7ff",
      text: "#ffffff",
      role: "#cfe4ff",
      muted: "#8fb8ea",
      buttonText: "#ffffff",
      badgeText: "#d7eaff",
      border: "#224b9c",
    }),
    racing_green: createMonochromeTheme({
      surfaceBg: "#ffeaf3",
      base: "#ffc8df",
      deep: "#f5f9ff",
      accent: "#8ab7ff",
      text: "#6a2a4b",
      role: "#956082",
      muted: "#ba7fa0",
      buttonText: "#ffffff",
      badgeText: "#7f4a73",
      border: "#ffb7d1",
      isLight: true,
    }),
    polo_navy: createMonochromeTheme({
      surfaceBg: "#0a3a52",
      base: "#082033",
      deep: "#061422",
      accent: "#4df7ff",
      text: "#eaffff",
      role: "#91f8ff",
      muted: "#65b9cf",
      buttonText: "#041019",
      badgeText: "#9ffaff",
      border: "#1d6f87",
    }),
    alpine_ski: createMonochromeTheme({
      surfaceBg: "#f3f5ff",
      base: "#d8c7ff",
      deep: "#fff8fe",
      accent: "#74d9ff",
      text: "#4a3f7a",
      role: "#7562a8",
      muted: "#8b7fb8",
      buttonText: "#ffffff",
      badgeText: "#6d5ea0",
      border: "#c7b5ff",
      isLight: true,
    }),
    boxing_legend: createMonochromeTheme({
      surfaceBg: "#6f1c08",
      base: "#d94818",
      deep: "#2b0900",
      accent: "#ffd15a",
      text: "#fff5e8",
      role: "#ffd0a4",
      muted: "#e99569",
      buttonText: "#2b0900",
      badgeText: "#ffe0a0",
      border: "#a43512",
    }),
    basketball_court: createMonochromeTheme({
      surfaceBg: "#4d1457",
      base: "#cf2b9f",
      deep: "#180821",
      accent: "#61f7ff",
      text: "#fff3fb",
      role: "#ffd1f1",
      muted: "#d889c6",
      buttonText: "#180821",
      badgeText: "#bffcff",
      border: "#9933a8",
    }),
    football_pitch: createMonochromeTheme({
      surfaceBg: "#0b5845",
      base: "#1ba879",
      deep: "#07251d",
      accent: "#a8ffd6",
      text: "#f0fff8",
      role: "#c9ffe7",
      muted: "#8ad9bb",
      buttonText: "#06241b",
      badgeText: "#d8ffef",
      border: "#35bd8e",
    }),
    olympic_gold: createMonochromeTheme({
      surfaceBg: "#3a176b",
      base: "#6732bd",
      deep: "#180825",
      accent: "#ffd36e",
      text: "#fff6d8",
      role: "#e7d4ff",
      muted: "#b99ee8",
      buttonText: "#1b0d25",
      badgeText: "#ffe6a6",
      border: "#8b61d8",
    }),
    anime_blush: createMonochromeTheme({
      surfaceBg: "#ffe6f4",
      base: "#ff9ed1",
      deep: "#fff1fa",
      accent: "#a874ff",
      text: "#69264d",
      role: "#a54b7b",
      muted: "#c66f9a",
      buttonText: "#ffffff",
      badgeText: "#873c68",
      border: "#ff8fc7",
      isLight: true,
    }),
    cheetah_spots: createMonochromeTheme({
      surfaceBg: "#b66a20",
      base: "#f5c46b",
      deep: "#5a2b0d",
      accent: "#2b1608",
      text: "#fff0cf",
      role: "#ffe2a6",
      muted: "#d8984e",
      buttonText: "#fff4d8",
      badgeText: "#ffe3a6",
      border: "#7b3f13",
    }),
    serpent_scale: createMonochromeTheme({
      surfaceBg: "#0b2a1a",
      base: "#155332",
      deep: "#07190f",
      accent: "#8ee6a8",
      text: "#ecfff1",
      role: "#b7f6c4",
      muted: "#7fcf93",
      buttonText: "#06160d",
      badgeText: "#caffd4",
      border: "#236f43",
    }),
    color_red: createMonochromeTheme({
      surfaceBg: "#5d0d18",
      base: "#8e1627",
      deep: "#3c0710",
      accent: "#ff6b85",
      text: "#fff2f5",
      role: "#ffc5d1",
      muted: "#ff9eb1",
      buttonText: "#2b050c",
      badgeText: "#ffd2db",
      border: "#8f2438",
    }),
    color_orange: createMonochromeTheme({
      surfaceBg: "#7b3403",
      base: "#c85600",
      deep: "#4f2100",
      accent: "#ffb957",
      text: "#fff4e5",
      role: "#ffd39d",
      muted: "#f5bd6d",
      buttonText: "#301200",
      badgeText: "#ffe0b8",
      border: "#aa4f10",
    }),
    color_yellow: createMonochromeTheme({
      surfaceBg: "#8b6a07",
      base: "#d1a800",
      deep: "#5f4600",
      accent: "#fff3a6",
      text: "#fffbea",
      role: "#ffefb7",
      muted: "#e5ce6e",
      buttonText: "#332500",
      badgeText: "#fff7c5",
      border: "#b18f12",
      isLight: true,
    }),
    color_green: createMonochromeTheme({
      surfaceBg: "#145726",
      base: "#1f8f47",
      deep: "#0d3317",
      accent: "#b4ff82",
      text: "#f2fff4",
      role: "#d7ffd5",
      muted: "#a7e0a7",
      buttonText: "#0d2814",
      badgeText: "#d8ffcc",
      border: "#2a7d44",
    }),
    color_teal: createMonochromeTheme({
      surfaceBg: "#0b4e54",
      base: "#0f8c93",
      deep: "#072f33",
      accent: "#91f8ff",
      text: "#ecffff",
      role: "#c6fbff",
      muted: "#9ad6da",
      buttonText: "#07282c",
      badgeText: "#c8feff",
      border: "#17727a",
    }),
    color_blue: createMonochromeTheme({
      surfaceBg: "#123d8a",
      base: "#1d63d6",
      deep: "#0b234d",
      accent: "#8fc8ff",
      text: "#eef6ff",
      role: "#cde3ff",
      muted: "#9bbbe5",
      buttonText: "#0b1f3f",
      badgeText: "#d4e8ff",
      border: "#2d5ea8",
    }),
    color_purple: createMonochromeTheme({
      surfaceBg: "#5b2290",
      base: "#7a2fca",
      deep: "#33124f",
      accent: "#d6adff",
      text: "#fbf4ff",
      role: "#ecd7ff",
      muted: "#c8a7e8",
      buttonText: "#241036",
      badgeText: "#f0dfff",
      border: "#6d3ba8",
    }),
    color_pink: createMonochromeTheme({
      surfaceBg: "#8a235f",
      base: "#d53c84",
      deep: "#57163b",
      accent: "#ffb6dc",
      text: "#fff3f9",
      role: "#ffd3e8",
      muted: "#f0aad0",
      buttonText: "#360d22",
      badgeText: "#ffdced",
      border: "#ab3d72",
    }),
  };

  const EMOJI_BACKGROUND_VIEWBOX_WIDTH = 360;
  const EMOJI_BACKGROUND_VIEWBOX_HEIGHT = 280;
  const EMOJI_BACKGROUND_AVATAR_HOLE = { cx: 180, cy: 104, r: 58 };
  const EMOJI_BACKGROUND_TEXT_HOLE = { cx: 180, cy: 190, rx: 118, ry: 42 };
  const EMOJI_BACKGROUND_PACK_LAYOUTS = {
    ghosts: {
      smallCount: 18,
      accentCount: 8,
      largeCount: 5,
      blobCount: 8,
      smallSize: [10, 15],
      accentSize: [13, 18],
      largeSize: [18, 24],
      blobRadius: [12, 22],
      rotation: [-8, 8],
    },
    stars: {
      smallCount: 20,
      accentCount: 9,
      largeCount: 6,
      blobCount: 4,
      smallSize: [9, 14],
      accentSize: [12, 18],
      largeSize: [16, 22],
      blobRadius: [10, 18],
      rotation: [-14, 14],
    },
    lightning: {
      smallCount: 16,
      accentCount: 8,
      largeCount: 5,
      blobCount: 4,
      smallSize: [10, 16],
      accentSize: [14, 20],
      largeSize: [18, 25],
      blobRadius: [11, 20],
      rotation: [-22, 22],
    },
    crowns: {
      smallCount: 18,
      accentCount: 8,
      largeCount: 6,
      blobCount: 5,
      smallSize: [12, 17],
      accentSize: [15, 21],
      largeSize: [20, 26],
      blobRadius: [10, 18],
      rotation: [-8, 8],
    },
    webs: {
      smallCount: 12,
      accentCount: 7,
      largeCount: 6,
      blobCount: 0,
      smallSize: [13, 18],
      accentSize: [18, 24],
      largeSize: [24, 32],
      blobRadius: [0, 0],
      rotation: [-10, 10],
    },
    hearts: {
      smallCount: 17,
      accentCount: 8,
      largeCount: 5,
      blobCount: 6,
      smallSize: [10, 15],
      accentSize: [13, 19],
      largeSize: [18, 24],
      blobRadius: [10, 18],
      rotation: [-16, 16],
    },
  };
  const EMOJI_BACKGROUND_PACK_SYMBOLS = {
    ghosts: `
      <path fill="currentColor" d="M24 5.5c-8.7 0-15.5 6.8-15.5 15.6V40l5.3-4.1 4.2 4.1 5.1-4.7 4.8 4.7 4.4-4.1 5.3 4.1V21.1C39.5 12.3 32.7 5.5 24 5.5Zm-5.5 16a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm11 0a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z"/>
    `,
    stars: `
      <path fill="currentColor" d="m24 6.5 4.9 10.2 11.3 1.6-8.2 7.9 1.9 11.3L24 32.2l-9.9 5.3 1.9-11.3-8.2-7.9 11.3-1.6L24 6.5Z"/>
      <circle cx="11" cy="11" r="2.2" fill="currentColor" opacity="0.72"/>
      <circle cx="37" cy="15" r="1.8" fill="currentColor" opacity="0.58"/>
    `,
    lightning: `
      <path fill="currentColor" d="M28 4 11 26.5h11.2L18 44l19-24.6H25.8L28 4Z"/>
    `,
    crowns: `
      <path d="M8 34h32L36 15l-8 7-4-11-4 11-8-7-4 19Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M12 38h24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="12" cy="14" r="2.1" fill="currentColor"/>
      <circle cx="24" cy="9.5" r="2.1" fill="currentColor"/>
      <circle cx="36" cy="14" r="2.1" fill="currentColor"/>
    `,
    webs: `
      <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M24 8v32M8 24h32M13 13l22 22M35 13 13 35" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    `,
    hearts: `
      <path fill="currentColor" d="M24 38 9 24.4C5.8 21.5 4 18.3 4 14.8 4 9.9 7.9 6 12.8 6c3.1 0 6 1.4 7.9 3.8C22.6 7.4 25.5 6 28.6 6 33.5 6 37.4 9.9 37.4 14.8c0 3.5-1.8 6.7-5 9.6L24 38Z"/>
    `,
  };

  const EMOJI_BACKGROUND_ZONES = {
    top: {
      xMin: -26,
      xMax: EMOJI_BACKGROUND_VIEWBOX_WIDTH - 10,
      yMin: -14,
      yMax: 92,
    },
    left: {
      xMin: -28,
      xMax: 78,
      yMin: 36,
      yMax: EMOJI_BACKGROUND_VIEWBOX_HEIGHT - 28,
    },
    right: {
      xMin: EMOJI_BACKGROUND_VIEWBOX_WIDTH - 78,
      xMax: EMOJI_BACKGROUND_VIEWBOX_WIDTH + 24,
      yMin: 36,
      yMax: EMOJI_BACKGROUND_VIEWBOX_HEIGHT - 28,
    },
    bottom: {
      xMin: -8,
      xMax: EMOJI_BACKGROUND_VIEWBOX_WIDTH - 20,
      yMin: EMOJI_BACKGROUND_VIEWBOX_HEIGHT - 78,
      yMax: EMOJI_BACKGROUND_VIEWBOX_HEIGHT + 16,
    },
    field: {
      xMin: 20,
      xMax: EMOJI_BACKGROUND_VIEWBOX_WIDTH - 44,
      yMin: 22,
      yMax: EMOJI_BACKGROUND_VIEWBOX_HEIGHT - 24,
    },
  };

  const EMOJI_BACKGROUND_ZONE_WEIGHTS = {
    small: [
      ["top", 0.36],
      ["left", 0.22],
      ["right", 0.22],
      ["bottom", 0.12],
      ["field", 0.08],
    ],
    accent: [
      ["top", 0.28],
      ["left", 0.24],
      ["right", 0.24],
      ["bottom", 0.1],
      ["field", 0.14],
    ],
    large: [
      ["left", 0.34],
      ["right", 0.34],
      ["top", 0.16],
      ["bottom", 0.08],
      ["field", 0.08],
    ],
    blob: [
      ["top", 0.24],
      ["left", 0.28],
      ["right", 0.28],
      ["bottom", 0.12],
      ["field", 0.08],
    ],
  };

  function hashStringSeed(value) {
    const input = String(value || "emoji-pack");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRandom(seedValue) {
    let state = hashStringSeed(seedValue) || 1;
    return () => {
      state += 0x6d2b79f5;
      let result = Math.imul(state ^ (state >>> 15), 1 | state);
      result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomBetween(rng, min, max) {
    return min + (max - min) * rng();
  }

  function roundCoordinate(value) {
    return Number(value.toFixed(1));
  }

  function roundOpacity(value) {
    return Number(value.toFixed(3));
  }

  function pickWeightedZone(rng, weights) {
    const pool = Array.isArray(weights) && weights.length > 0 ? weights : EMOJI_BACKGROUND_ZONE_WEIGHTS.small;
    const total = pool.reduce((sum, [, weight]) => sum + Number(weight || 0), 0) || 1;
    let cursor = rng() * total;
    for (const [zoneKey, weightValue] of pool) {
      cursor -= Number(weightValue || 0);
      if (cursor <= 0) {
        return EMOJI_BACKGROUND_ZONES[zoneKey] || EMOJI_BACKGROUND_ZONES.top;
      }
    }
    const fallbackZone = pool[pool.length - 1]?.[0];
    return EMOJI_BACKGROUND_ZONES[fallbackZone] || EMOJI_BACKGROUND_ZONES.top;
  }

  function intersectsEmojiHole(centerX, centerY, radius = 0) {
    const avatarDx = centerX - EMOJI_BACKGROUND_AVATAR_HOLE.cx;
    const avatarDy = centerY - EMOJI_BACKGROUND_AVATAR_HOLE.cy;
    if (avatarDx * avatarDx + avatarDy * avatarDy < (EMOJI_BACKGROUND_AVATAR_HOLE.r + radius) ** 2) {
      return true;
    }
    const textDx = (centerX - EMOJI_BACKGROUND_TEXT_HOLE.cx) / Math.max(1, EMOJI_BACKGROUND_TEXT_HOLE.rx + radius * 0.82);
    const textDy = (centerY - EMOJI_BACKGROUND_TEXT_HOLE.cy) / Math.max(1, EMOJI_BACKGROUND_TEXT_HOLE.ry + radius * 0.58);
    return textDx * textDx + textDy * textDy < 1;
  }

  function collidesWithPlacedItems(placedItems, centerX, centerY, visualSize, spacingFactor = 0.44) {
    return placedItems.some((item) => {
      const dx = item.cx - centerX;
      const dy = item.cy - centerY;
      const minDistance = item.size * 0.46 + visualSize * spacingFactor;
      return dx * dx + dy * dy < minDistance * minDistance;
    });
  }

  function createProceduralEmojiItems(rng, layout, typeKey, placedItems) {
    const countKey = `${typeKey}Count`;
    const sizeKey = `${typeKey}Size`;
    const count = Math.max(0, Number(layout?.[countKey] || 0));
    const sizeRange = Array.isArray(layout?.[sizeKey]) ? layout[sizeKey] : [12, 18];
    const [minSize, maxSize] = sizeRange;
    const weights = EMOJI_BACKGROUND_ZONE_WEIGHTS[typeKey] || EMOJI_BACKGROUND_ZONE_WEIGHTS.small;
    const items = [];
    const maxAttempts = Math.max(20, count * 28);
    const baseOpacity =
      typeKey === "small" ? [0.08, 0.19] : typeKey === "accent" ? [0.06, 0.13] : [0.035, 0.08];
    const spacingFactor = typeKey === "small" ? 0.4 : typeKey === "accent" ? 0.46 : 0.54;
    const rotationRange = Array.isArray(layout?.rotation) ? layout.rotation : [-10, 10];

    for (let attempt = 0; attempt < maxAttempts && items.length < count; attempt += 1) {
      const zone = pickWeightedZone(rng, weights);
      const size = randomBetween(rng, minSize, maxSize);
      const x = randomBetween(rng, zone.xMin, zone.xMax);
      const y = randomBetween(rng, zone.yMin, zone.yMax);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      if (intersectsEmojiHole(centerX, centerY, size * 0.64)) {
        continue;
      }
      if (collidesWithPlacedItems(placedItems, centerX, centerY, size, spacingFactor)) {
        continue;
      }
      const rotate =
        typeKey === "large" && rng() > 0.6
          ? 0
          : randomBetween(rng, rotationRange[0], rotationRange[1]);
      const opacity = randomBetween(rng, baseOpacity[0], baseOpacity[1]);
      items.push({
        x: roundCoordinate(x),
        y: roundCoordinate(y),
        size: roundCoordinate(size),
        opacity: roundOpacity(opacity),
        rotate: Math.abs(rotate) < 1 ? 0 : roundCoordinate(rotate),
      });
      placedItems.push({ cx: centerX, cy: centerY, size });
    }

    return items;
  }

  function createProceduralEmojiBlobs(rng, layout, placedItems) {
    const count = Math.max(0, Number(layout?.blobCount || 0));
    if (!count) {
      return [];
    }
    const [minRadius, maxRadius] = Array.isArray(layout?.blobRadius) ? layout.blobRadius : [10, 18];
    const weights = EMOJI_BACKGROUND_ZONE_WEIGHTS.blob;
    const blobs = [];
    const maxAttempts = Math.max(16, count * 24);

    for (let attempt = 0; attempt < maxAttempts && blobs.length < count; attempt += 1) {
      const zone = pickWeightedZone(rng, weights);
      const radius = randomBetween(rng, minRadius, maxRadius);
      const centerX = randomBetween(rng, zone.xMin + radius, zone.xMax + radius * 0.5);
      const centerY = randomBetween(rng, zone.yMin + radius, zone.yMax + radius * 0.5);
      if (intersectsEmojiHole(centerX, centerY, radius * 1.18)) {
        continue;
      }
      if (collidesWithPlacedItems(placedItems, centerX, centerY, radius * 2, 0.7)) {
        continue;
      }
      const opacity = randomBetween(rng, 0.016, 0.038);
      blobs.push({
        cx: roundCoordinate(centerX),
        cy: roundCoordinate(centerY),
        r: roundCoordinate(radius),
        opacity: roundOpacity(opacity),
      });
      placedItems.push({ cx: centerX, cy: centerY, size: radius * 2 });
    }

    return blobs;
  }

  function buildEmojiBackgroundScene(packKey, seedInput) {
    const layout = EMOJI_BACKGROUND_PACK_LAYOUTS[packKey] || EMOJI_BACKGROUND_PACK_LAYOUTS.ghosts;
    const rng = createSeededRandom(`emoji-background:${packKey}:${seedInput || "default"}`);
    const placedItems = [];
    const small = createProceduralEmojiItems(rng, layout, "small", placedItems);
    const accent = createProceduralEmojiItems(rng, layout, "accent", placedItems);
    const large = createProceduralEmojiItems(rng, layout, "large", placedItems);
    const blobs = createProceduralEmojiBlobs(rng, layout, placedItems);
    return { small, accent, large, blobs };
  }

  function renderEmojiBackgroundUses(symbolId, items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const x = Number(item?.x || 0);
        const y = Number(item?.y || 0);
        const size = Number(item?.size || 24);
        const opacity = Number(item?.opacity || 1);
        const rotate = Number(item?.rotate || 0);
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const transform = rotate ? ` transform="rotate(${rotate} ${centerX} ${centerY})"` : "";
        return `<use href="#${symbolId}" x="${x}" y="${y}" width="${size}" height="${size}" opacity="${opacity}"${transform}></use>`;
      })
      .join("");
  }

  function renderEmojiBackgroundOverlay(packKey, seedInput = "") {
    const normalizedKey = String(packKey || "").trim().toLowerCase();
    if (!normalizedKey || normalizedKey === "none") {
      return "";
    }
    const symbolMarkup = EMOJI_BACKGROUND_PACK_SYMBOLS[normalizedKey];
    if (!symbolMarkup) {
      return "";
    }
    const scene = buildEmojiBackgroundScene(normalizedKey, seedInput);
    const symbolId = `emoji-pack-${normalizedKey}-glyph`;
    const glowFilterId = `emoji-pack-${normalizedKey}-glow`;
    const blurFilterId = `emoji-pack-${normalizedKey}-blur`;
    return `<span class="unq-ref-profile-emoji-pack unq-ref-profile-emoji-pack--${esc(normalizedKey)}" aria-hidden="true">
      <svg class="unq-ref-profile-emoji-pack-svg" viewBox="0 0 ${EMOJI_BACKGROUND_VIEWBOX_WIDTH} ${EMOJI_BACKGROUND_VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMin slice">
        <defs>
          <radialGradient id="emoji-pack-${normalizedKey}-fade" cx="50%" cy="34%" r="76%">
            <stop offset="0%" stop-color="white" stop-opacity="1"></stop>
            <stop offset="54%" stop-color="white" stop-opacity="0.95"></stop>
            <stop offset="78%" stop-color="white" stop-opacity="0.68"></stop>
            <stop offset="100%" stop-color="white" stop-opacity="0"></stop>
          </radialGradient>
          <mask id="emoji-pack-${normalizedKey}-mask">
            <rect width="${EMOJI_BACKGROUND_VIEWBOX_WIDTH}" height="${EMOJI_BACKGROUND_VIEWBOX_HEIGHT}" fill="url(#emoji-pack-${normalizedKey}-fade)"></rect>
            <circle cx="${EMOJI_BACKGROUND_AVATAR_HOLE.cx}" cy="${EMOJI_BACKGROUND_AVATAR_HOLE.cy}" r="${EMOJI_BACKGROUND_AVATAR_HOLE.r}" fill="black"></circle>
            <ellipse cx="${EMOJI_BACKGROUND_TEXT_HOLE.cx}" cy="${EMOJI_BACKGROUND_TEXT_HOLE.cy}" rx="${EMOJI_BACKGROUND_TEXT_HOLE.rx}" ry="${EMOJI_BACKGROUND_TEXT_HOLE.ry}" fill="black"></ellipse>
          </mask>
          <filter id="${glowFilterId}">
            <feGaussianBlur stdDeviation="1.3"></feGaussianBlur>
          </filter>
          <filter id="${blurFilterId}">
            <feGaussianBlur stdDeviation="2.7"></feGaussianBlur>
          </filter>
          <symbol id="${symbolId}" viewBox="0 0 48 48">
            ${symbolMarkup}
          </symbol>
        </defs>
        <g mask="url(#emoji-pack-${normalizedKey}-mask)">
          ${(scene.blobs || []).map(
            (blob) =>
              `<circle cx="${blob.cx}" cy="${blob.cy}" r="${blob.r}" fill="var(--theme-accent-color)" opacity="${blob.opacity}" filter="url(#${blurFilterId})"></circle>`,
          ).join("")}
          <g style="color:var(--theme-role-color)">
            ${renderEmojiBackgroundUses(symbolId, scene.small)}
          </g>
          <g style="color:var(--theme-accent-color)" filter="url(#${glowFilterId})">
            ${renderEmojiBackgroundUses(symbolId, scene.accent)}
          </g>
          <g style="color:var(--theme-role-color)" filter="url(#${blurFilterId})">
            ${renderEmojiBackgroundUses(symbolId, scene.large)}
          </g>
        </g>
      </svg>
    </span>`;
  }

  function resolveTheme(themeKey) {
    const resolvedKey = themeKey === "royal_ivory" ? "sage_luxe" : themeKey;
    const key = typeof resolvedKey === "string" && THEME_KEYS.includes(resolvedKey) ? resolvedKey : "default_dark";
    return { key, tokens: THEME_CONFIG[key] || THEME_CONFIG.default_dark };
  }

  function renderThemeOverlay(themeKey) {
    if (themeKey === "default_dark") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dd-flow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#b0bbcb"></stop>
            <stop offset="100%" stop-color="#dfe4ec"></stop>
          </linearGradient>
          <radialGradient id="dd-halo" cx="50%" cy="38%" r="68%">
            <stop offset="0%" stop-color="#f8fbff"></stop>
            <stop offset="100%" stop-color="#d7deea"></stop>
          </radialGradient>
        </defs>
        <circle cx="286" cy="130" r="164" fill="url(#dd-halo)" opacity="0.2"></circle>
        <path d="M0 112C78 94 150 98 222 118C282 136 324 136 360 126" stroke="url(#dd-flow)" stroke-width="0.88" fill="none"></path>
        <path d="M0 324C74 306 146 312 216 332C278 350 322 352 360 342" stroke="url(#dd-flow)" stroke-width="0.78" fill="none"></path>
        <path d="M0 522C80 504 152 510 224 530C286 548 326 550 360 540" stroke="url(#dd-flow)" stroke-width="0.68" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "arctic") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="ar-frost-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <linearGradient id="ar-frost-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#9cb8cf"></stop>
            <stop offset="100%" stop-color="#d3e0ec"></stop>
          </linearGradient>
          <radialGradient id="ar-frost-glow" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#e8f3fd"></stop>
            <stop offset="100%" stop-color="#cfdcea"></stop>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#ar-frost-noise)" opacity="0.18"></rect>
        <circle cx="302" cy="104" r="160" fill="url(#ar-frost-glow)" opacity="0.34"></circle>
        <path d="M0 58C74 42 146 52 216 76C278 96 322 98 360 86" stroke="#c6d7e6" stroke-width="0.56" fill="none"></path>
        <path d="M0 188C74 170 146 180 216 202C278 222 322 224 360 212" stroke="#c6d7e6" stroke-width="0.5" fill="none"></path>
        <path d="M0 420C72 402 144 410 214 432C278 450 322 452 360 440" stroke="#c6d7e6" stroke-width="0.48" fill="none"></path>
        <path d="M0 94C64 72 130 78 198 102C262 124 316 124 360 112" stroke="url(#ar-frost-line)" stroke-width="0.84" fill="none"></path>
        <path d="M0 284C62 262 128 268 196 292C262 316 316 318 360 304" stroke="url(#ar-frost-line)" stroke-width="0.74" fill="none"></path>
        <path d="M0 488C64 466 132 472 198 496C262 518 316 522 360 508" stroke="url(#ar-frost-line)" stroke-width="0.68" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "linen") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="ln-stitch" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M0 13H26" stroke="#c5a07a" stroke-width="0.28" stroke-dasharray="3 6"></path>
          </pattern>
          <linearGradient id="ln-wave" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#97704a"></stop>
            <stop offset="100%" stop-color="#c9ab87"></stop>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#ln-stitch)"></rect>
        <path d="M0 96C72 70 146 78 214 98C278 116 322 116 360 104" stroke="url(#ln-wave)" stroke-width="0.82" fill="none"></path>
        <path d="M0 288C70 262 140 270 208 290C274 308 322 310 360 296" stroke="url(#ln-wave)" stroke-width="0.72" fill="none"></path>
        <path d="M0 500C72 474 146 484 214 504C278 522 322 526 360 514" stroke="url(#ln-wave)" stroke-width="0.66" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "marble") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="mb-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#mb-noise)" opacity="0.28"></rect>
        <path d="M0 84C88 50 164 64 236 100C286 124 330 126 360 110" stroke="#5f5f5f" stroke-width="1.2" fill="none"></path>
        <path d="M0 222C78 192 150 204 222 236C286 264 328 264 360 252" stroke="#4a4a4a" stroke-width="0.95" fill="none"></path>
        <path d="M0 402C84 374 160 388 234 418C294 444 334 446 360 434" stroke="#616161" stroke-width="0.86" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "forest") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="fr-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.84" numOctaves="3" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <linearGradient id="fr-vein" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#7fa283"></stop>
            <stop offset="100%" stop-color="#cad6b5"></stop>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#fr-grain)" opacity="0.34"></rect>
        <path d="M0 118C70 98 140 104 210 126C272 146 318 146 360 132" stroke="url(#fr-vein)" stroke-width="0.94" fill="none"></path>
        <path d="M0 326C72 302 144 308 214 330C276 350 322 350 360 338" stroke="url(#fr-vein)" stroke-width="0.86" fill="none"></path>
        <path d="M0 530C70 506 142 514 212 536C272 554 320 556 360 544" stroke="url(#fr-vein)" stroke-width="0.76" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "sage_luxe") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="sg-silk-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <linearGradient id="sg-flow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8b9d8e"></stop>
            <stop offset="100%" stop-color="#c3cdc4"></stop>
          </linearGradient>
          <radialGradient id="sg-glow" cx="50%" cy="38%" r="72%">
            <stop offset="0%" stop-color="#f7fbf7"></stop>
            <stop offset="100%" stop-color="#dfe8e1"></stop>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#sg-silk-noise)" opacity="0.16"></rect>
        <circle cx="288" cy="124" r="154" fill="url(#sg-glow)" opacity="0.3"></circle>
        <rect x="24" y="70" width="146" height="20" rx="10" fill="#dce6dd" opacity="0.34"></rect>
        <rect x="8" y="312" width="186" height="18" rx="9" fill="#d2ddd3" opacity="0.28"></rect>
        <rect x="122" y="472" width="202" height="16" rx="8" fill="#d7e1d8" opacity="0.26"></rect>
        <path d="M0 46C70 32 142 38 212 56C276 74 320 78 360 68" stroke="#b6c4b8" stroke-width="0.5" fill="none"></path>
        <path d="M0 238C72 224 144 232 214 248C276 266 320 270 360 260" stroke="#b6c4b8" stroke-width="0.48" fill="none"></path>
        <path d="M0 422C74 408 146 416 216 434C278 450 320 454 360 446" stroke="#b6c4b8" stroke-width="0.46" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "midnight_obsidian") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="mo-mist">
            <feTurbulence type="fractalNoise" baseFrequency="0.96" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <radialGradient id="mo-star" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#9bc2ff"></stop>
            <stop offset="100%" stop-color="#1a2740"></stop>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#mo-mist)" opacity="0.16"></rect>
        <path d="M0 72C78 54 150 60 222 82C284 100 324 100 360 90" stroke="#3e5b86" stroke-width="0.46" fill="none"></path>
        <path d="M0 264C76 246 148 254 220 274C284 292 324 294 360 282" stroke="#3e5b86" stroke-width="0.44" fill="none"></path>
        <path d="M0 468C76 450 148 458 220 478C284 496 324 498 360 486" stroke="#3e5b86" stroke-width="0.42" fill="none"></path>
        <circle cx="52" cy="92" r="1.8" fill="url(#mo-star)"></circle>
        <circle cx="128" cy="144" r="1.4" fill="url(#mo-star)"></circle>
        <circle cx="214" cy="110" r="1.6" fill="url(#mo-star)"></circle>
        <circle cx="296" cy="164" r="1.5" fill="url(#mo-star)"></circle>
        <circle cx="62" cy="334" r="1.7" fill="url(#mo-star)"></circle>
        <circle cx="142" cy="300" r="1.4" fill="url(#mo-star)"></circle>
        <circle cx="224" cy="346" r="1.5" fill="url(#mo-star)"></circle>
        <circle cx="308" cy="320" r="1.7" fill="url(#mo-star)"></circle>
      </svg>`;
    }
    if (themeKey === "golden_noir") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="gn-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <linearGradient id="gn-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8e7847"></stop>
            <stop offset="100%" stop-color="#d2b777"></stop>
          </linearGradient>
          <radialGradient id="gn-glow" cx="50%" cy="50%" r="68%">
            <stop offset="0%" stop-color="#d7c086"></stop>
            <stop offset="100%" stop-color="#191e2b"></stop>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#gn-grain)" opacity="0.18"></rect>
        <circle cx="286" cy="132" r="164" fill="url(#gn-glow)" opacity="0.16"></circle>
        <rect x="18" y="74" width="134" height="14" rx="7" fill="#362f22" opacity="0.34"></rect>
        <rect x="202" y="220" width="140" height="12" rx="6" fill="#342d20" opacity="0.3"></rect>
        <rect x="48" y="438" width="186" height="14" rx="7" fill="#362f22" opacity="0.28"></rect>
        <path d="M0 110C74 88 148 94 220 116C284 136 324 136 360 124" stroke="url(#gn-line)" stroke-width="0.78" fill="none"></path>
        <path d="M0 322C72 300 146 308 216 330C280 350 322 350 360 338" stroke="url(#gn-line)" stroke-width="0.7" fill="none"></path>
        <path d="M0 536C74 514 148 522 218 544C282 562 324 566 360 552" stroke="url(#gn-line)" stroke-width="0.64" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "aurora_codex") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="ac-paper-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <linearGradient id="ac-red-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#a93225"></stop>
            <stop offset="100%" stop-color="#8f2820"></stop>
          </linearGradient>
          <linearGradient id="ac-ink-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#6d533d"></stop>
            <stop offset="100%" stop-color="#b09066"></stop>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#ac-paper-noise)" opacity="0.14"></rect>
        <rect x="0" y="0" width="360" height="3" fill="url(#ac-red-line)" opacity="0.88"></rect>
        <path d="M24 62h22v10M24 62v22" stroke="#9f7b54" stroke-width="1.1" fill="none"></path>
        <path d="M336 62h-22v10M336 62v22" stroke="#9f7b54" stroke-width="1.1" fill="none"></path>
        <path d="M24 538h22v-10M24 538v-22" stroke="#9f7b54" stroke-width="1.1" fill="none"></path>
        <path d="M336 538h-22v-10M336 538v-22" stroke="#9f7b54" stroke-width="1.1" fill="none"></path>
        <path d="M0 106C78 90 154 96 226 118C286 136 326 136 360 126" stroke="url(#ac-ink-line)" stroke-width="0.76" fill="none"></path>
        <path d="M0 320C80 304 154 312 226 334C288 352 326 352 360 342" stroke="url(#ac-ink-line)" stroke-width="0.68" fill="none"></path>
        <path d="M0 526C80 510 154 518 226 540C288 558 326 560 360 550" stroke="url(#ac-ink-line)" stroke-width="0.62" fill="none"></path>
      </svg>`;
    }
    if (themeKey === "nebula_glass" || themeKey === "galaxy") {
      return "";
    }
    if (themeKey === "graffiti_neon") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="gr-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.84" numOctaves="2" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
          </filter>
          <linearGradient id="gr-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#5ef7ff" stop-opacity="0"></stop>
            <stop offset="50%" stop-color="#5ef7ff" stop-opacity="0.88"></stop>
            <stop offset="100%" stop-color="#5ef7ff" stop-opacity="0"></stop>
          </linearGradient>
          <linearGradient id="gr-lime" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#b5ff5e"></stop>
            <stop offset="100%" stop-color="#5ef7ff"></stop>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" filter="url(#gr-noise)" opacity="0.14"></rect>
        <path d="M26 84c52-42 122-46 176-10" stroke="#f284ff" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.34"></path>
        <path d="M22 96c56-30 126-34 190 2" stroke="url(#gr-cyan)" stroke-width="2.2" stroke-linecap="round" fill="none"></path>
        <path d="M248 126c18 7 34 18 44 30" stroke="#b5ff5e" stroke-width="3.6" stroke-linecap="round" fill="none" opacity="0.38"></path>
        <path d="M40 262c72-22 150-12 226 26" stroke="#5ef7ff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.28"></path>
        <path d="M74 468c72-28 146-30 212-4" stroke="#f284ff" stroke-width="2.1" stroke-linecap="round" fill="none" opacity="0.24"></path>
        <path d="M294 84c-12 26-14 48-4 70" stroke="#f54fff" stroke-width="3.4" stroke-linecap="round" fill="none" opacity="0.34"></path>
        <path d="M300 136v34M312 140v22M324 144v30" stroke="url(#gr-lime)" stroke-width="2.5" stroke-linecap="round" opacity="0.55"></path>
        <path d="M58 168l22-14 14 14 20-20" stroke="#b5ff5e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.3"></path>
        <circle cx="54" cy="142" r="5" fill="#5ef7ff" opacity="0.42"></circle>
        <circle cx="74" cy="138" r="3" fill="#f284ff" opacity="0.5"></circle>
        <circle cx="90" cy="144" r="2.4" fill="#b5ff5e" opacity="0.52"></circle>
        <circle cx="286" cy="402" r="3.2" fill="#5ef7ff" opacity="0.44"></circle>
        <circle cx="304" cy="414" r="2.6" fill="#f284ff" opacity="0.48"></circle>
        <circle cx="322" cy="398" r="2.4" fill="#b5ff5e" opacity="0.5"></circle>
        <text x="206" y="96" fill="#f8a7ff" opacity="0.28" font-size="28" font-family="Trebuchet MS, Arial, sans-serif" transform="rotate(-10 206 96)">UNQX</text>
      </svg>`;
    }
    if (themeKey === "heritage_crest") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="sr-soft-glow" cx="50%" cy="28%" r="76%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72"></stop>
            <stop offset="100%" stop-color="#ffc6dd" stop-opacity="0"></stop>
          </radialGradient>
          <pattern id="sr-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="2.1" fill="#ff6fae" opacity="0.16"></circle>
            <circle cx="21" cy="18" r="1.7" fill="#ffffff" opacity="0.36"></circle>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sr-dots)"></rect>
        <circle cx="292" cy="112" r="170" fill="url(#sr-soft-glow)"></circle>
        <path d="M36 88c22-22 48-18 64 8 18-26 44-30 66-8-10 28-36 38-66 14-30 24-56 14-64-14Z" fill="#ff6fae" opacity="0.24"></path>
        <path d="M96 96h8v8h-8z" fill="#ffffff" opacity="0.48"></path>
        <path d="M272 378c18-18 38-14 50 6 14-20 34-24 52-6-8 23-28 31-52 12-24 19-44 11-50-12Z" fill="#ff9fca" opacity="0.2"></path>
        <path d="M62 218l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3 9-18Z" fill="#ffffff" opacity="0.22"></path>
        <path d="M292 124c8-14 28-14 36 0 8 14-2 32-36 50-34-18-44-36-36-50 8-14 28-14 36 0Z" fill="#ff6fae" opacity="0.18"></path>
      </svg>`;
    }
    if (themeKey === "ivory_tennis") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="gs-signal" cx="72%" cy="16%" r="44%">
            <stop offset="0%" stop-color="#f0c84b" stop-opacity="0.32"></stop>
            <stop offset="100%" stop-color="#f0c84b" stop-opacity="0"></stop>
          </radialGradient>
          <linearGradient id="gs-steel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#5f6672" stop-opacity="0.26"></stop>
            <stop offset="100%" stop-color="#0b0c10" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#gs-steel)"></rect>
        <circle cx="272" cy="96" r="120" fill="url(#gs-signal)"></circle>
        <path d="M0 428h360v172H0z" fill="#050608" opacity="0.24"></path>
        <path d="M28 428h32v-74h34v74h28v-112h42v112h32v-92h36v92h30v-132h46v132h24" fill="#050608" opacity="0.34"></path>
        <path d="M112 118c28-30 54-30 80 0 26-30 52-30 80 0-32-8-54 4-80 34-26-30-48-42-80-34Z" fill="#f0c84b" opacity="0.18"></path>
        <path d="M34 104C96 80 156 82 214 110M18 222c72-30 142-28 210 6M94 520c78-20 154-18 228 4" stroke="#f0c84b" stroke-width="0.9" fill="none" opacity="0.22"></path>
      </svg>`;
    }
    if (themeKey === "grand_slam_clay") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="ws-red" cx="22%" cy="16%" r="50%">
            <stop offset="0%" stop-color="#ff4052" stop-opacity="0.28"></stop>
            <stop offset="100%" stop-color="#cf1f2d" stop-opacity="0"></stop>
          </radialGradient>
          <radialGradient id="ws-blue" cx="82%" cy="78%" r="56%">
            <stop offset="0%" stop-color="#6bb7ff" stop-opacity="0.24"></stop>
            <stop offset="100%" stop-color="#123b86" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <circle cx="72" cy="92" r="162" fill="url(#ws-red)"></circle>
        <circle cx="294" cy="470" r="184" fill="url(#ws-blue)"></circle>
        <g stroke="#ffffff" stroke-width="0.8" fill="none" opacity="0.18">
          <path d="M180 0v600M0 150h360M0 300h360M0 450h360"></path>
          <path d="M180 0C80 130 72 312 180 600M180 0c100 130 108 312 0 600"></path>
          <path d="M0 72c118 84 238 84 360 0M0 528c118-84 238-84 360 0"></path>
        </g>
        <path d="M0 122C84 98 166 112 246 146C292 166 330 168 360 158" stroke="#6bb7ff" stroke-width="1.3" fill="none" opacity="0.28"></path>
        <path d="M30 492C112 462 194 472 278 506" stroke="#ffffff" stroke-width="1" fill="none" opacity="0.18"></path>
      </svg>`;
    }
    if (themeKey === "racing_green") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="sd-blush" cx="50%" cy="22%" r="72%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6"></stop>
            <stop offset="100%" stop-color="#ffc8df" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <circle cx="188" cy="110" r="190" fill="url(#sd-blush)"></circle>
        <path d="M0 118C70 96 140 104 214 130C280 154 324 154 360 142" stroke="#8ab7ff" stroke-width="0.86" fill="none" opacity="0.32"></path>
        <path d="M0 370C72 344 146 354 218 382C284 406 326 410 360 398" stroke="#ff8fbd" stroke-width="0.82" fill="none" opacity="0.26"></path>
        <g fill="#ff8fbd" opacity="0.24">
          <path d="M70 92c10 2 18 10 20 20-10-2-18-10-20-20Z"></path>
          <path d="M92 96c-2 10-10 18-20 20 2-10 10-18 20-20Z"></path>
          <path d="M282 254c12 2 21 11 23 23-12-2-21-11-23-23Z"></path>
          <path d="M308 258c-2 12-11 21-23 23 2-12 11-21 23-23Z"></path>
          <path d="M122 472c9 2 16 9 18 18-9-2-16-9-18-18Z"></path>
          <path d="M142 476c-2 9-9 16-18 18 2-9 9-16 18-18Z"></path>
        </g>
      </svg>`;
    }
    if (themeKey === "polo_navy") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="nm-circuit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4df7ff" stop-opacity="0.06"></stop>
            <stop offset="52%" stop-color="#4df7ff" stop-opacity="0.34"></stop>
            <stop offset="100%" stop-color="#4df7ff" stop-opacity="0.04"></stop>
          </linearGradient>
        </defs>
        <path d="M32 86h104v40h72v36h86M52 252h82v-34h72v54h116M28 454h128v-42h64v32h112" stroke="url(#nm-circuit)" stroke-width="2" fill="none"></path>
        <g fill="#4df7ff" opacity="0.24">
          <rect x="118" y="78" width="22" height="22" rx="4"></rect>
          <rect x="196" y="152" width="18" height="18" rx="4"></rect>
          <rect x="126" y="208" width="18" height="18" rx="4"></rect>
          <rect x="214" y="404" width="20" height="20" rx="4"></rect>
        </g>
        <path d="M70 122l34 18 34-18v54l-34 18-34-18V122ZM236 318l42 22 42-22v66l-42 22-42-22v-66Z" stroke="#91f8ff" stroke-width="1.2" fill="none" opacity="0.2"></path>
      </svg>`;
    }
    if (themeKey === "alpine_ski") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="mp-glow" cx="52%" cy="24%" r="70%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72"></stop>
            <stop offset="100%" stop-color="#d8c7ff" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <circle cx="184" cy="128" r="184" fill="url(#mp-glow)"></circle>
        <path d="M180 58l10 30 31 1-25 18 9 30-25-18-25 18 9-30-25-18 31-1 10-30Z" fill="#74d9ff" opacity="0.18"></path>
        <path d="M62 328l7 21 22 1-18 13 7 21-18-13-18 13 7-21-18-13 22-1 7-21ZM298 218l6 18 19 1-15 11 6 18-16-11-15 11 6-18-15-11 19-1 5-18Z" fill="#b99cff" opacity="0.2"></path>
        <path d="M0 160C78 130 154 138 226 166C288 190 328 192 360 180M0 438C82 408 158 416 232 444" stroke="#74d9ff" stroke-width="0.92" fill="none" opacity="0.26"></path>
        <circle cx="268" cy="94" r="34" fill="none" stroke="#d8c7ff" stroke-width="4" opacity="0.18"></circle>
      </svg>`;
    }
    if (themeKey === "boxing_legend") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="sf-fire" cx="50%" cy="88%" r="74%">
            <stop offset="0%" stop-color="#ffd15a" stop-opacity="0.28"></stop>
            <stop offset="100%" stop-color="#d94818" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <circle cx="180" cy="526" r="220" fill="url(#sf-fire)"></circle>
        <path d="M58 540c34-84-16-110 42-176-8 54 54 60 28 132 40-42 24-90 82-138-18 78 80 112 18 196" fill="#ffd15a" opacity="0.12"></path>
        <path d="M0 102C70 84 138 92 204 118C274 146 322 148 360 136" stroke="#ffd15a" stroke-width="1.1" fill="none" opacity="0.3"></path>
        <path d="M24 284c70-32 142-22 216 30M114 420c72-22 144-14 216 24" stroke="#fff5e8" stroke-width="0.8" fill="none" opacity="0.18"></path>
        <path d="M290 84l14 28 31 5-22 22 5 31-28-15-28 15 5-31-22-22 31-5 14-28Z" fill="#ffd15a" opacity="0.16"></path>
      </svg>`;
    }
    if (themeKey === "basketball_court") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ci-neon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#61f7ff" stop-opacity="0.08"></stop>
            <stop offset="50%" stop-color="#ff7ddb" stop-opacity="0.32"></stop>
            <stop offset="100%" stop-color="#61f7ff" stop-opacity="0.08"></stop>
          </linearGradient>
        </defs>
        <path d="M0 92h360M0 186h360M0 280h360M0 374h360M0 468h360" stroke="#61f7ff" stroke-width="0.7" opacity="0.12"></path>
        <path d="M42 78l74 74-74 74M318 78l-74 74 74 74M80 432l58-58 58 58 58-58 58 58" stroke="url(#ci-neon)" stroke-width="2.3" fill="none"></path>
        <circle cx="286" cy="138" r="44" fill="none" stroke="#61f7ff" stroke-width="2" opacity="0.2"></circle>
        <circle cx="76" cy="344" r="36" fill="none" stroke="#ff9be5" stroke-width="2" opacity="0.18"></circle>
        <path d="M180 104l8 22 24 1-19 14 7 23-20-13-20 13 7-23-19-14 24-1 8-22Z" fill="#61f7ff" opacity="0.16"></path>
      </svg>`;
    }
    if (themeKey === "football_pitch") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="fs-mist" cx="50%" cy="22%" r="72%">
            <stop offset="0%" stop-color="#a8ffd6" stop-opacity="0.24"></stop>
            <stop offset="100%" stop-color="#07251d" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <circle cx="178" cy="130" r="190" fill="url(#fs-mist)"></circle>
        <path d="M0 126C72 96 142 104 212 132C276 156 322 160 360 148" stroke="#a8ffd6" stroke-width="0.9" fill="none" opacity="0.28"></path>
        <path d="M30 492C106 462 184 468 264 496" stroke="#c9ffe7" stroke-width="0.8" fill="none" opacity="0.18"></path>
        <g fill="#a8ffd6" opacity="0.16">
          <path d="M76 92c26 18 30 44 12 76-24-22-28-48-12-76Z"></path>
          <path d="M278 254c30 12 42 38 34 72-30-14-42-40-34-72Z"></path>
          <path d="M120 418c22 10 31 30 24 56-23-11-32-31-24-56Z"></path>
        </g>
        <circle cx="262" cy="118" r="8" fill="#a8ffd6" opacity="0.18"></circle>
        <circle cx="286" cy="130" r="4" fill="#ffffff" opacity="0.2"></circle>
      </svg>`;
    }
    if (themeKey === "olympic_gold") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="da-aura" cx="54%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#ffd36e" stop-opacity="0.22"></stop>
            <stop offset="100%" stop-color="#6732bd" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <circle cx="190" cy="162" r="210" fill="url(#da-aura)"></circle>
        <path d="M44 172c52-78 132-86 196-24 26 25 36 54 30 88 28-20 48-18 64 6-44 2-74 24-90 66-12-74-66-112-152-114 40-12 80-10 118 8-38-56-96-64-166-30Z" fill="#ffd36e" opacity="0.12"></path>
        <path d="M0 118C80 90 158 98 232 130C292 156 330 158 360 148" stroke="#ffd36e" stroke-width="1" fill="none" opacity="0.28"></path>
        <path d="M38 412c82-34 164-26 246 22" stroke="#e7d4ff" stroke-width="0.86" fill="none" opacity="0.2"></path>
        <path d="M282 82l10 30 31 1-25 18 9 30-25-18-25 18 9-30-25-18 31-1 10-30Z" fill="#ffd36e" opacity="0.16"></path>
      </svg>`;
    }
    if (themeKey === "anime_blush") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="ab-glow" cx="50%" cy="20%" r="74%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.76"></stop>
            <stop offset="100%" stop-color="#ff9ed1" stop-opacity="0"></stop>
          </radialGradient>
          <linearGradient id="ab-hair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#a874ff" stop-opacity="0.36"></stop>
            <stop offset="100%" stop-color="#ff62ac" stop-opacity="0.22"></stop>
          </linearGradient>
        </defs>
        <circle cx="182" cy="112" r="190" fill="url(#ab-glow)"></circle>
        <g transform="translate(246 86)" opacity="0.3">
          <path d="M30 0c28 0 50 20 50 48 0 26-20 48-50 48S-20 74-20 48C-20 20 2 0 30 0Z" fill="#fff8fc"></path>
          <path d="M-6 46c8-34 30-50 62-40 22 8 32 24 28 48-24-22-50-28-90-8Z" fill="url(#ab-hair)"></path>
          <circle cx="15" cy="48" r="4" fill="#69264d"></circle>
          <circle cx="47" cy="48" r="4" fill="#69264d"></circle>
          <path d="M22 66c8 6 16 6 24 0" stroke="#ff62ac" stroke-width="3" stroke-linecap="round" fill="none"></path>
          <path d="M4 30l-18-18M56 24l18-20" stroke="#a874ff" stroke-width="4" stroke-linecap="round"></path>
        </g>
        <path d="M54 132c12-18 34-18 46 0 12-18 34-18 46 0-18 34-54 46-92 0Z" fill="#ff62ac" opacity="0.18"></path>
        <path d="M0 306C78 278 154 288 226 316C288 340 328 342 360 330" stroke="#a874ff" stroke-width="0.9" fill="none" opacity="0.28"></path>
        <path d="M74 454l8 22 24 1-19 14 7 23-20-13-20 13 7-23-19-14 24-1 8-22Z" fill="#ffffff" opacity="0.28"></path>
        <circle cx="52" cy="226" r="5" fill="#ff62ac" opacity="0.26"></circle>
        <circle cx="82" cy="248" r="3" fill="#a874ff" opacity="0.28"></circle>
      </svg>`;
    }
    if (themeKey === "cheetah_spots") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="cs-fur">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"></feTurbulence>
            <feColorMatrix type="saturate" values="0.55"></feColorMatrix>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#cs-fur)" opacity="0.2"></rect>
        <g fill="#2b1608" opacity="0.36">
          <path d="M38 62c18-16 42-6 40 16-2 22-34 28-48 12-9-10-4-20 8-28Z"></path>
          <path d="M132 116c24-12 50 3 42 24-8 22-44 20-56 0-7-12 0-20 14-24Z"></path>
          <path d="M274 84c20-14 46-2 42 20-4 24-40 26-52 8-8-12-2-20 10-28Z"></path>
          <path d="M62 286c24-18 58-4 52 22-6 26-48 30-64 8-10-14-2-22 12-30Z"></path>
          <path d="M238 258c22-16 52-3 48 22-4 24-42 28-58 8-10-12-4-22 10-30Z"></path>
          <path d="M128 430c20-14 48-2 44 22-4 22-40 24-54 6-8-12-2-20 10-28Z"></path>
          <path d="M282 482c22-14 50 0 44 24-6 22-42 24-54 4-8-12-2-20 10-28Z"></path>
        </g>
        <g stroke="#fff0cf" stroke-width="0.8" fill="none" opacity="0.16">
          <path d="M0 170c70-24 140-18 210 18 62 30 112 34 150 18"></path>
          <path d="M0 382c74-28 148-20 222 20 58 30 106 32 138 18"></path>
        </g>
      </svg>`;
    }
    if (themeKey === "serpent_scale") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="ss-scales" width="42" height="36" patternUnits="userSpaceOnUse">
            <path d="M0 18C10 2 32 2 42 18C32 34 10 34 0 18Z" fill="none" stroke="#8ee6a8" stroke-width="1" opacity="0.3"></path>
            <path d="M21 0C31 16 31 20 21 36C11 20 11 16 21 0Z" fill="#8ee6a8" opacity="0.055"></path>
          </pattern>
          <linearGradient id="ss-shine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8ee6a8" stop-opacity="0"></stop>
            <stop offset="45%" stop-color="#8ee6a8" stop-opacity="0.24"></stop>
            <stop offset="100%" stop-color="#8ee6a8" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#ss-scales)" opacity="0.72"></rect>
        <path d="M-20 126C68 78 146 96 220 142C282 180 326 180 382 132" stroke="url(#ss-shine)" stroke-width="18" fill="none" opacity="0.4"></path>
        <path d="M-18 418C74 364 150 382 226 430C288 468 330 468 382 422" stroke="url(#ss-shine)" stroke-width="14" fill="none" opacity="0.34"></path>
        <path d="M284 92c22 0 38 16 38 38 0 20-16 36-38 36-20 0-36-16-36-36 0-22 16-38 36-38Z" fill="#07190f" opacity="0.32"></path>
        <path d="M270 126l24-10 24 10-24 12-24-12Z" fill="#8ee6a8" opacity="0.22"></path>
      </svg>`;
    }
    if (COLOR_THEME_KEYS.includes(themeKey)) {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="mc-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--theme-accent-color)" stop-opacity="0.14"></stop>
            <stop offset="100%" stop-color="var(--theme-name-color)" stop-opacity="0.36"></stop>
          </linearGradient>
        </defs>
        <circle cx="286" cy="128" r="166" fill="var(--theme-accent-color)" opacity="0.08"></circle>
        <circle cx="66" cy="498" r="112" fill="var(--theme-name-color)" opacity="0.05"></circle>
        <path d="M0 100C74 84 150 92 220 116C282 136 322 138 360 126" stroke="url(#mc-line)" stroke-width="0.88" fill="none"></path>
        <path d="M0 300C72 284 146 292 214 316C278 338 320 340 360 328" stroke="url(#mc-line)" stroke-width="0.78" fill="none"></path>
        <path d="M0 514C72 498 148 506 216 530C280 552 322 556 360 544" stroke="url(#mc-line)" stroke-width="0.7" fill="none"></path>
        <rect x="28" y="76" width="138" height="16" rx="8" fill="var(--theme-accent-color)" opacity="0.08"></rect>
        <rect x="194" y="432" width="134" height="14" rx="7" fill="var(--theme-name-color)" opacity="0.06"></rect>
      </svg>`;
    }
    if (themeKey === "velours") {
      return `<svg class="unq-ref-overlay-svg" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="vl-fiber-light" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" stroke-opacity="0.08" stroke-width="0.42"></line>
          </pattern>
          <pattern id="vl-fiber-dark" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#000000" stroke-opacity="0.11" stroke-width="0.46"></line>
          </pattern>
          <linearGradient id="vl-sheen-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0"></stop>
            <stop offset="52%" stop-color="#ffffff" stop-opacity="0.06"></stop>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
          </linearGradient>
          <linearGradient id="vl-sheen-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4a1220" stop-opacity="0"></stop>
            <stop offset="50%" stop-color="#4a1220" stop-opacity="0.08"></stop>
            <stop offset="100%" stop-color="#4a1220" stop-opacity="0"></stop>
          </linearGradient>
          <radialGradient id="vl-crush-a" cx="0%" cy="0%" r="70%">
            <stop offset="0%" stop-color="#c4354a" stop-opacity="0.12"></stop>
            <stop offset="100%" stop-color="#c4354a" stop-opacity="0"></stop>
          </radialGradient>
          <radialGradient id="vl-crush-b" cx="100%" cy="100%" r="72%">
            <stop offset="0%" stop-color="#8b1a2a" stop-opacity="0.1"></stop>
            <stop offset="100%" stop-color="#8b1a2a" stop-opacity="0"></stop>
          </radialGradient>
          <pattern id="vl-avatar-fiber-light" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(34)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" stroke-opacity="0.06" stroke-width="0.34"></line>
          </pattern>
          <pattern id="vl-avatar-fiber-dark" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-36)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#000000" stroke-opacity="0.08" stroke-width="0.36"></line>
          </pattern>
          <clipPath id="vl-avatar-clip">
            <circle cx="180" cy="206" r="52"></circle>
          </clipPath>
        </defs>
        <rect width="100%" height="100%" fill="url(#vl-fiber-light)" opacity="0.34"></rect>
        <rect width="100%" height="100%" fill="url(#vl-fiber-dark)" opacity="0.28"></rect>
        <rect width="100%" height="100%" fill="url(#vl-sheen-a)"></rect>
        <rect width="100%" height="100%" fill="url(#vl-sheen-b)"></rect>
        <circle cx="76" cy="84" r="178" fill="url(#vl-crush-a)"></circle>
        <circle cx="292" cy="518" r="184" fill="url(#vl-crush-b)"></circle>
        <g clip-path="url(#vl-avatar-clip)">
          <rect x="128" y="154" width="104" height="104" fill="url(#vl-avatar-fiber-light)" opacity="0.26"></rect>
          <rect x="128" y="154" width="104" height="104" fill="url(#vl-avatar-fiber-dark)" opacity="0.22"></rect>
        </g>
      </svg>`;
    }
    return "";
  }

  function renderAvatarFrame(frameKey, themeKey) {
    const key = AVATAR_FRAME_KEYS.includes(frameKey) ? frameKey : "none";
    if (key === "none") {
      return "";
    }
    const themeLabel = String(themeKey || "default_dark").replace(/_/g, "-");
    const frameLabel = key.replace(/_/g, "-");
    const start = `<span class="unq-ref-avatar-frame unq-ref-avatar-frame--${frameLabel}" data-avatar-frame="${esc(
      key,
    )}" data-avatar-frame-theme="${esc(themeLabel)}" aria-hidden="true">`;
    const end = "</span>";

    if (key === "chrome_ring") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="61" class="frame-fill-subtle"></circle>
          <circle cx="70" cy="70" r="58" class="frame-stroke-thick frame-stroke-metal"></circle>
          <circle cx="70" cy="70" r="48" class="frame-stroke-thin frame-stroke-glow"></circle>
          <path d="M28 42c16-12 34-18 54-18" class="frame-stroke-thin frame-stroke-white"></path>
        </svg>
      ${end}`;
    }
    if (key === "neon_spray") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="58" class="frame-stroke-thick frame-stroke-glow"></circle>
          <circle cx="20" cy="66" r="4" class="frame-fill-accent"></circle>
          <circle cx="28" cy="52" r="3.2" class="frame-fill-secondary"></circle>
          <circle cx="32" cy="76" r="2.8" class="frame-fill-primary"></circle>
          <circle cx="110" cy="26" r="3.6" class="frame-fill-primary"></circle>
          <circle cx="122" cy="38" r="2.4" class="frame-fill-secondary"></circle>
          <circle cx="116" cy="52" r="2" class="frame-fill-accent"></circle>
          <circle cx="104" cy="114" r="4.2" class="frame-fill-secondary"></circle>
          <circle cx="118" cy="104" r="2.4" class="frame-fill-primary"></circle>
          <path d="M20 82c9 7 18 11 28 12" class="frame-stroke-thin frame-stroke-primary"></path>
        </svg>
      ${end}`;
    }
    if (key === "sticker_bubble") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <path class="frame-fill-white" fill-rule="evenodd" d="M70 12c28 0 50 8 58 28 7 18 6 42-2 58-10 18-32 32-58 32-26 0-48-10-58-28-11-20-8-47 6-64C28 22 47 12 70 12Z M70 20c14 0 27 4 36 11 10 8 17 22 17 39 0 16-6 29-16 38-10 9-23 14-37 14-15 0-28-5-38-14-10-9-16-22-16-38 0-18 7-32 18-40 10-7 22-10 36-10Z"></path>
          <path class="frame-stroke-thin frame-stroke-primary" d="M70 14c27 0 47 8 55 26 8 17 7 40-1 56-10 18-31 30-54 30-24 0-46-9-56-27C3 80 6 53 20 37 32 22 49 14 70 14Z"></path>
          <circle cx="70" cy="70" r="52.5" class="frame-stroke-thin frame-stroke-white"></circle>
          <path class="frame-stroke-thin frame-stroke-secondary" d="M24 104c8 8 18 14 30 18"></path>
        </svg>
      ${end}`;
    }
    if (key === "chain_link") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="54" class="frame-stroke-thin frame-stroke-primary frame-dash-chain"></circle>
          <g class="frame-chain-links">
            <ellipse cx="70" cy="14" rx="10" ry="6" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
            <ellipse cx="118" cy="42" rx="10" ry="6" transform="rotate(48 118 42)" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
            <ellipse cx="126" cy="96" rx="10" ry="6" transform="rotate(90 126 96)" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
            <ellipse cx="70" cy="126" rx="10" ry="6" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
            <ellipse cx="18" cy="98" rx="10" ry="6" transform="rotate(130 18 98)" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
            <ellipse cx="18" cy="42" rx="10" ry="6" transform="rotate(45 18 42)" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
          </g>
        </svg>
      ${end}`;
    }
    if (key === "pixel_glow") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <path class="frame-stroke-thick frame-stroke-primary" d="M38 20h64v10h10v18h10v44h-10v18h-10v10H38v-10H28V92H18V48h10V30h10Z"></path>
          <path class="frame-stroke-thin frame-stroke-glow" d="M44 26h52v8h10v16h8v40h-8v16H96v8H44v-8H34V90h-8V50h8V34h10Z"></path>
        </svg>
      ${end}`;
    }
    if (key === "starburst") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <path class="frame-stroke-thick frame-stroke-secondary" d="M70 6L84 29L111 20L104 47L132 54L113 72L132 90L104 97L111 124L84 115L70 138L56 115L29 124L36 97L8 90L27 72L8 54L36 47L29 20L56 29Z"></path>
          <path class="frame-stroke-thin frame-stroke-primary" d="M70 6L84 29L111 20L104 47L132 54L113 72L132 90L104 97L111 124L84 115L70 138L56 115L29 124L36 97L8 90L27 72L8 54L36 47L29 20L56 29Z"></path>
          <circle cx="70" cy="70" r="51.5" class="frame-stroke-thin frame-stroke-white"></circle>
        </svg>
      ${end}`;
    }
    if (key === "drip_outline") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <path class="frame-stroke-thick frame-stroke-secondary" d="M70 14c28 0 50 21 54 47 2 15-2 29-11 40-8 10-10 18-10 26 0 9-7 15-14 15s-12-6-12-13v-14c0-5-3-8-7-8s-7 3-7 8v19c0 6-5 10-11 10s-11-5-11-11c0-13-4-23-11-31C12 92 8 79 10 66c4-30 29-52 60-52Z"></path>
          <path class="frame-stroke-thin frame-stroke-primary" d="M28 40c12-14 26-20 42-20"></path>
        </svg>
      ${end}`;
    }
    if (key === "tape_collage") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <rect x="18" y="18" width="38" height="12" rx="3" transform="rotate(-18 18 18)" class="frame-fill-white frame-tape-shadow"></rect>
          <rect x="92" y="22" width="30" height="12" rx="3" transform="rotate(18 92 22)" class="frame-fill-secondary frame-tape-shadow"></rect>
          <rect x="18" y="106" width="34" height="12" rx="3" transform="rotate(14 18 106)" class="frame-fill-secondary frame-tape-shadow"></rect>
          <rect x="92" y="106" width="34" height="12" rx="3" transform="rotate(-12 92 106)" class="frame-fill-white frame-tape-shadow"></rect>
          <circle cx="70" cy="70" r="54" class="frame-stroke-thin frame-stroke-primary"></circle>
        </svg>
      ${end}`;
    }
    if (key === "orbit_dots") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <ellipse cx="70" cy="70" rx="58" ry="44" class="frame-stroke-thin frame-stroke-primary"></ellipse>
          <ellipse cx="70" cy="70" rx="44" ry="58" class="frame-stroke-thin frame-stroke-secondary"></ellipse>
          <circle cx="22" cy="70" r="5" class="frame-fill-primary"></circle>
          <circle cx="118" cy="70" r="4.4" class="frame-fill-secondary"></circle>
          <circle cx="70" cy="18" r="4.6" class="frame-fill-accent"></circle>
          <circle cx="70" cy="122" r="4" class="frame-fill-white"></circle>
        </svg>
      ${end}`;
    }
    if (key === "laurel_wreath") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="54" class="frame-stroke-thin frame-stroke-secondary"></circle>
          <path d="M42 118c-18-24-18-58 0-86" class="frame-stroke-thin frame-stroke-primary"></path>
          <path d="M98 118c18-24 18-58 0-86" class="frame-stroke-thin frame-stroke-primary"></path>
          <g class="frame-fill-primary"><ellipse cx="36" cy="100" rx="4" ry="8" transform="rotate(-32 36 100)"></ellipse><ellipse cx="31" cy="84" rx="4" ry="8" transform="rotate(-58 31 84)"></ellipse><ellipse cx="31" cy="66" rx="4" ry="8" transform="rotate(-76 31 66)"></ellipse><ellipse cx="36" cy="48" rx="4" ry="8" transform="rotate(-106 36 48)"></ellipse><ellipse cx="104" cy="100" rx="4" ry="8" transform="rotate(32 104 100)"></ellipse><ellipse cx="109" cy="84" rx="4" ry="8" transform="rotate(58 109 84)"></ellipse><ellipse cx="109" cy="66" rx="4" ry="8" transform="rotate(76 109 66)"></ellipse><ellipse cx="104" cy="48" rx="4" ry="8" transform="rotate(106 104 48)"></ellipse></g>
        </svg>
      ${end}`;
    }
    if (key === "trophy_gold") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="56" class="frame-stroke-thick frame-stroke-secondary"></circle>
          <path d="M55 17h30v12c0 13-6 22-15 22S55 42 55 29V17Z" class="frame-stroke-thin frame-stroke-primary"></path>
          <path d="M55 24H42c0 12 6 18 15 18M85 24h13c0 12-6 18-15 18M70 51v14M58 65h24M54 72h32" class="frame-stroke-thin frame-stroke-primary"></path>
        </svg>
      ${end}`;
    }
    if (key === "tennis_lines") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="58" class="frame-stroke-thick frame-stroke-primary"></circle>
          <path d="M30 38h80v64H30zM70 38v64M30 70h80M48 38v64M92 38v64" class="frame-stroke-thin frame-stroke-white"></path>
        </svg>
      ${end}`;
    }
    if (key === "racing_stripes") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="55" class="frame-stroke-thin frame-stroke-secondary"></circle>
          <path d="M18 52h104M18 70h104M18 88h104" class="frame-stroke-thick frame-stroke-primary"></path>
          <path d="M28 43h84M28 97h84" class="frame-stroke-thin frame-stroke-white"></path>
        </svg>
      ${end}`;
    }
    if (key === "varsity_patch") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <path d="M70 10l52 22v42c0 27-20 45-52 58-32-13-52-31-52-58V32l52-22Z" class="frame-stroke-thick frame-stroke-primary"></path>
          <path d="M70 21l41 17v35c0 21-15 35-41 46-26-11-41-25-41-46V38l41-17Z" class="frame-stroke-thin frame-stroke-white"></path>
        </svg>
      ${end}`;
    }
    if (key === "boxing_rope") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <rect x="20" y="20" width="100" height="100" rx="14" class="frame-stroke-thick frame-stroke-primary"></rect>
          <path d="M20 44h100M20 70h100M20 96h100M44 20v100M96 20v100" class="frame-stroke-thin frame-stroke-secondary"></path>
        </svg>
      ${end}`;
    }
    if (key === "basketball_arc") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="70" r="58" class="frame-stroke-thick frame-stroke-primary"></circle>
          <path d="M70 12v116M18 70h104M34 28c24 18 24 66 0 84M106 28c-24 18-24 66 0 84" class="frame-stroke-thin frame-stroke-secondary"></path>
        </svg>
      ${end}`;
    }
    if (key === "football_stitch") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <ellipse cx="70" cy="70" rx="58" ry="44" class="frame-stroke-thick frame-stroke-primary"></ellipse>
          <path d="M48 70h44M56 60v20M64 58v24M72 58v24M80 58v24M88 60v20" class="frame-stroke-thin frame-stroke-white"></path>
        </svg>
      ${end}`;
    }
    if (key === "stopwatch_ring") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <circle cx="70" cy="76" r="52" class="frame-stroke-thick frame-stroke-primary"></circle>
          <path d="M58 14h24M70 14v12M98 30l10-10M70 76V46M70 76l20 14" class="frame-stroke-thin frame-stroke-secondary"></path>
        </svg>
      ${end}`;
    }
    if (key === "medal_ribbon") {
      return `${start}
        <svg class="unq-ref-avatar-frame-svg" viewBox="0 0 140 140" preserveAspectRatio="none">
          <path d="M48 8h44l-12 42H60L48 8Z" class="frame-fill-secondary"></path>
          <circle cx="70" cy="76" r="54" class="frame-stroke-thick frame-stroke-primary"></circle>
          <circle cx="70" cy="76" r="45" class="frame-stroke-thin frame-stroke-white"></circle>
        </svg>
      ${end}`;
    }

    return "";
  }

  function normalizeHexColor(value) {
    const raw = String(value || "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(raw) ? raw : "";
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isSupportedButtonHref(value) {
    return /^(https?:\/\/|mailto:|tel:|card:)/i.test(String(value || "").trim());
  }

  function parseCardDigits(rawValue) {
    const digits = String(rawValue || "").replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) {
      return "";
    }
    return digits;
  }

  function detectCardBrand(digits) {
    const value = String(digits || "");
    if (!value) return "Карта";
    if (/^(?:8600|5614)\d{12}$/.test(value)) return "Uzcard";
    if (/^9860\d{12}$/.test(value)) return "Humo";
    if (/^220[0-4]\d{12}$/.test(value)) return "Mir";
    if (/^4\d{12}(\d{3})?(\d{3})?$/.test(value)) return "Visa";
    if (/^(5[1-5]\d{14}|2(?:2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(value)) return "Mastercard";
    if (/^3[47]\d{13}$/.test(value)) return "American Express";
    if (/^62\d{14,17}$/.test(value)) return "UnionPay";
    if (/^(?:2131|1800|35\d{3})\d{11,14}$/.test(value)) return "JCB";
    if (/^(?:50|5[6-9]|6\d)\d{10,17}$/.test(value)) return "Maestro";
    return "Карта";
  }

  function normalizeButtonUrl(rawUrl, type, label) {
    const input = String(rawUrl || "").trim();
    const kind = String(type || "other")
      .trim()
      .toLowerCase();
    const labelRaw = String(label || "").trim().toLowerCase();
    const cardLikeLabel = /(карта|card)/i.test(labelRaw);
    const mapLikeLabel = /(map|maps|geo|location|локац)/i.test(labelRaw);
    if (!input) return "";

    if (isSupportedButtonHref(input)) {
      return input;
    }

    if (kind === "card" || cardLikeLabel) {
      const digits = parseCardDigits(input);
      return digits ? `card:${digits}` : "";
    }

    if (kind === "map" || mapLikeLabel) {
      return `https://maps.google.com/?q=${encodeURIComponent(input)}`;
    }

    if (kind === "phone") {
      const compact = input.replace(/\s+/g, "");
      return compact ? `tel:${compact}` : "";
    }

    if (kind === "email") {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
        return `mailto:${input}`;
      }
      return "";
    }

    if (kind === "website" || kind === "other") {
      if (/^[^\s]+\.[^\s]+$/.test(input) && !input.startsWith("@")) {
        return `https://${input}`;
      }
    }

    if (kind === "telegram") {
      const normalized = input
        .replace(/^@+/, "")
        .replace(/^(?:https?:\/\/)?(?:www\.)?(?:t(?:elegram)?\.me)\//i, "")
        .trim();
      return normalized ? `https://t.me/${normalized}` : "";
    }

    if (kind === "instagram") {
      const normalized = input
        .replace(/^@+/, "")
        .replace(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i, "")
        .replace(/\/+$/, "")
        .trim();
      return normalized ? `https://instagram.com/${normalized}` : "";
    }

    if (kind === "tiktok") {
      const normalized = input
        .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, "")
        .replace(/^@+/, "")
        .replace(/\/+$/, "")
        .trim();
      if (!normalized) return "";
      return normalized.startsWith("@") ? `https://tiktok.com/${normalized}` : `https://tiktok.com/@${normalized}`;
    }

    if (kind === "youtube") {
      if (/^(?:@[\w.-]+)$/i.test(input)) {
        return `https://youtube.com/${input}`;
      }
      if (/^[\w.-]+$/i.test(input)) {
        return `https://youtube.com/@${input}`;
      }
    }

    if (kind === "whatsapp") {
      const digits = input.replace(/[^\d]/g, "");
      return digits ? `https://wa.me/${digits}` : "";
    }

    return input;
  }

  function normalizeCard(input) {
    const card = input && typeof input === "object" ? input : {};
    const plan = card.tariff === "premium" ? "premium" : "none";
    const buttonLimit = 9;
    const tags = Array.isArray(card.tags)
      ? card.tags
        .map((tag) => String((tag && typeof tag === "object" ? tag.label : tag) || "").trim())
        .filter(Boolean)
      : [];
    const buttons = Array.isArray(card.buttons)
      ? card.buttons
        .map((button) => {
          const rawType = String(button?.type || "other")
            .trim()
            .toLowerCase();
          const normalizedType = rawType === "карта" ? "card" : rawType;
          const label = String(button?.label || "").trim();
          const url = normalizeButtonUrl(button?.href || button?.value || button?.url || "", normalizedType, label);
          const type = url.startsWith("card:") ? "card" : normalizedType;
          return { type, label, url };
        })
        .filter((button) => button.label && isSupportedButtonHref(button.url))
        .slice(0, buttonLimit)
      : [];
    const name = String(card.name || "").trim() || "UNQX User";
    const avatarUrl = String(card.avatarUrl || "").trim();
    const pets = Array.isArray(card.pets)
      ? card.pets
        .map((pet) => {
          const petType = String(pet?.petType || "").trim().toLowerCase();
          if (!PET_TYPE_KEYS.includes(petType)) {
            return null;
          }
          const displayName = String(pet?.displayName || "").trim();
          if (!displayName) {
            return null;
          }
          return {
            id: String(pet?.id || "").trim(),
            petType,
            label: String(pet?.label || PET_TYPE_LABELS[petType] || petType).trim(),
            assetUrl: String(pet?.assetUrl || PET_ASSET_URLS[petType] || "").trim(),
            displayName,
            priceSnapshot: Number.isFinite(Number(pet?.priceSnapshot)) ? Number(pet.priceSnapshot) : 0,
            isVisible: pet?.isVisible !== false,
            createdAt: pet?.createdAt || null,
          };
        })
        .filter(Boolean)
      : [];
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => (part[0] ? part[0].toUpperCase() : ""))
      .join("");
    return {
      slug: String(card.slug || "").toUpperCase(),
      slugs: Array.isArray(card.slugs)
        ? card.slugs
          .map((value) => String(value || "").trim().toUpperCase())
          .filter(Boolean)
        : [],
      slugPrice: Number.isFinite(Number(card.slugPrice)) ? Number(card.slugPrice) : null,
      tariff: plan,
      theme: (() => {
        const rawTheme = typeof card.theme === "string" ? card.theme : "";
        const normalizedTheme = rawTheme === "royal_ivory" ? "sage_luxe" : rawTheme;
        return THEME_KEYS.includes(normalizedTheme) ? normalizedTheme : "default_dark";
      })(),
      avatarFrame: (() => {
        const rawFrame = String(card.avatarFrame || "").trim().toLowerCase();
        return AVATAR_FRAME_KEYS.includes(rawFrame) ? rawFrame : "none";
      })(),
      emojiBackgroundPack: (() => {
        const rawPack = String(card.emojiBackgroundPack || "").trim().toLowerCase();
        return EMOJI_BACKGROUND_PACK_KEYS.includes(rawPack) ? rawPack : "none";
      })(),
      customColor: normalizeHexColor(card.customColor),
      name,
      wallAuthorLabel: String(card.wallAuthorLabel || name).trim() || name,
      role: String(card.role || "").trim(),
      bio: String(card.bio || "").trim(),
      phone: String(card.phone || "").trim(),
      avatarUrl: avatarUrl || null,
      initials: initials || "UN",
      tags,
      buttons,
      verified: Boolean(card.verified),
      verifiedCompany: String(card.verifiedCompany || "").trim(),
      hashtag: String(card.hashtag || "").trim(),
      address: String(card.address || "").trim(),
      postcode: String(card.postcode || "").trim(),
      email: String(card.email || "").trim(),
      extraPhone: String(card.extraPhone || "").trim(),
      showBranding: card.showBranding !== false,
      viewsLabel: String(card.viewsLabel || "").trim(),
      pets,
    };
  }

  function getVisibleCardPets(card) {
    const items = Array.isArray(card?.pets) ? card.pets.filter((item) => item && item.isVisible !== false) : [];
    items.sort((left, right) => {
      const slotA = Number.isFinite(PET_RENDER_PRIORITY[left?.petType]) ? PET_RENDER_PRIORITY[left.petType] : 99;
      const slotB = Number.isFinite(PET_RENDER_PRIORITY[right?.petType]) ? PET_RENDER_PRIORITY[right.petType] : 99;
      if (slotA !== slotB) {
        return slotA - slotB;
      }
      const timeA = new Date(left?.createdAt || 0).getTime();
      const timeB = new Date(right?.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });
    return items.slice(0, 3);
  }

  function getPetSlotNames(count) {
    if (count >= 3) return ["left", "top-right", "bottom-right"];
    if (count === 2) return ["left", "top-right"];
    if (count === 1) return ["top-right"];
    return [];
  }

  function renderPetDecorations(card) {
    const pets = getVisibleCardPets(card);
    if (!pets.length) return "";
    const slotNames = getPetSlotNames(pets.length);
    return `<div class="unq-ref-pets" data-pet-count="${esc(String(pets.length))}" aria-label="Питомцы визитки">
      ${pets
        .map((pet, index) => {
          const slot = slotNames[index] || "right";
          return `<figure class="unq-ref-pet unq-ref-pet--${esc(slot)}" data-pet-type="${esc(pet.petType)}">
            <div class="unq-ref-pet-visual">
              <img src="${esc(pet.assetUrl)}" alt="${esc(pet.displayName)}" class="unq-ref-pet-image" loading="lazy" />
            </div>
            <figcaption class="unq-ref-pet-meta">
              <span class="unq-ref-pet-name">${esc(pet.displayName)}</span>
            </figcaption>
          </figure>`;
        })
        .join("")}
    </div>`;
  }

  function iconSvg(name) {
    const map = {
      share:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.25"></circle><circle cx="6" cy="12" r="2.25"></circle><circle cx="18" cy="19" r="2.25"></circle><path d="m8 11 7.5-4.3M8 13l7.5 4.3"></path></svg>',
      verified:
        '<svg class="h-4 w-4 text-neutral-500" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.5l2.2 1.8 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L21.5 12l-1.8 2.2.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 21.5l-2.2-1.8-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2.5 12l1.8-2.2-.3-2.8 2.5-1.2 1.2-2.5 2.8.3L12 2.5Zm-1.1 13.1 5-5-1.1-1.1-3.9 3.9-1.8-1.8-1.1 1.1 2.9 2.9Z"></path></svg>',
      phone: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.7 1.9Z"></path></svg>',
      telegram:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3 2.7 10.4a1 1 0 0 0 .1 1.9l4.6 1.4 1.7 5.3a1 1 0 0 0 1.7.4l2.6-3 4.8 3.6a1 1 0 0 0 1.6-.6L22 4a1 1 0 0 0-1.4-1Z"></path><path d="m7.5 13.5 10.1-7.3"></path></svg>',
      message: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5A8.7 8.7 0 0 1 8 19.2L3 21l1.8-5A8.7 8.7 0 0 1 3.5 12 8.5 8.5 0 1 1 21 12Z"></path></svg>',
      instagram:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="0.8"></circle></svg>',
      discord:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="6"></rect><circle cx="10" cy="12" r="1"></circle><circle cx="14" cy="12" r="1"></circle><path d="M9 15c1 1 2 1 3 0"></path></svg>',
      github:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9 4 12l4 3M16 9l4 3-4 3M10 19l4-14"></path></svg>',
      facebook:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 9h4M14 9v11M14 9h-3a3 3 0 0 1 3-3h3"></path></svg>',
      x: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 16M19 4L5 20"></path></svg>',
      steam:
        '<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="16.6" cy="7.4" r="2.7"></circle><circle cx="7.6" cy="16.4" r="2.9"></circle><path d="M9.1 14.9 15 9a3.9 3.9 0 0 0 0 5.6l-3.3 3.3a3.9 3.9 0 0 1-5.6 0l3-3z" opacity="0.35"></path></svg>',
      click:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7M12 2v4M12 18v4M2 12h4M18 12h4"></path></svg>',
      globe: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>',
      arrow: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"></path></svg>',
      location:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.8"></circle></svg>',
      email: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"></path><path d="m4 7 8 6 8-6"></path></svg>',
      hashtag: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3-2 18M16 3l-2 18M4 9h16M3 15h16"></path></svg>',
      heart:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.75 4.9 13.86a5.56 5.56 0 0 1 0-7.94 5.39 5.39 0 0 1 7.67 0L12 6.49l-.57-.57a5.39 5.39 0 0 1 7.67 0 5.56 5.56 0 0 1 0 7.94L12 20.75Z"></path></svg>',
      heartFilled:
        '<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M11.457 20.78a.75.75 0 0 0 1.086 0l6.558-6.36a5.56 5.56 0 0 0 0-7.94 5.39 5.39 0 0 0-7.67 0L12 7.05l-.57-.57a5.39 5.39 0 0 0-7.67 0 5.56 5.56 0 0 0 0 7.94l6.558 6.36Z"></path></svg>',
      comment:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>',
      image:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="8.2" cy="9" r="1.6"></circle><path d="m6 17 4.6-4.8 3.1 3.1 2.8-2.8L18 14"></path></svg>',
      expand:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h5v5M20 4l-7 7M9 20H4v-5M4 20l7-7"></path></svg>',
      send:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7Z"></path></svg>',
      linkedin:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M8 10v6M8 8.2v.1M12 16v-3.2c0-1.2.9-2.1 2-2.1 1.2 0 2 .9 2 2.1V16"></path></svg>',
      tiktok:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4v8.8a4 4 0 1 1-2.8-3.8"></path><path d="M14.5 4c.8 1.7 2.2 2.8 4 3.1"></path></svg>',
      youtube:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="3.4"></rect><path d="m10 9.2 5.8 2.8-5.8 2.8z"></path></svg>',
      save: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 11l4 4 4-4M4 20h16"></path></svg>',
      card:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path d="M3 10h18"></path></svg>',
    };

    return map[name] || map.arrow;
  }

  function classifyButton(button) {
    switch (button.type) {
      case "phone":
        return "phone";
      case "telegram":
        return "telegram";
      case "instagram":
        return "instagram";
      case "tiktok":
        return "tiktok";
      case "youtube":
        return "youtube";
      case "website":
        return "globe";
      case "map":
        return "location";
      case "card":
        return "card";
      case "email":
        return "email";
      case "whatsapp":
        return "message";
      default:
        break;
    }

    const signature = `${button.label} ${button.url}`.toLowerCase();
    if (/(steam|steamcommunity|steampowered)/.test(signature)) {
      return "steam";
    }
    if (/(discord|discord\.gg)/.test(signature)) {
      return "discord";
    }
    if (/(github|gitlab|bitbucket)/.test(signature)) {
      return "github";
    }
    if (/(facebook|fb\.com)/.test(signature)) {
      return "facebook";
    }
    if (/(twitter|x\.com)/.test(signature)) {
      return "x";
    }
    if (/(whatsapp|wa\.me)/.test(signature)) {
      return "message";
    }
    if (/(linkedin)/.test(signature)) {
      return "linkedin";
    }
    if (/(telegram|t\.me|message|chat)/.test(signature)) {
      return "telegram";
    }
    if (/(instagram|insta)/.test(signature)) {
      return "instagram";
    }
    if (/(youtube|youtu\.be)/.test(signature)) {
      return "youtube";
    }
    if (/(tiktok|tik tok)/.test(signature)) {
      return "tiktok";
    }
    if (/(phone|call|tel)/.test(signature)) {
      return "phone";
    }
    if (/(mail|email)/.test(signature)) {
      return "email";
    }
    if (/(site|web|link|globe|www)/.test(signature)) {
      return "globe";
    }
    if (/(карта|map|maps|geo|location|loc)/.test(signature)) {
      return "location";
    }
    if (/(click|pay|payment|card|merchant)/.test(signature)) {
      return "click";
    }
    if (/(steam|trade|shop|store|market)/.test(signature)) {
      return "arrow";
    }
    return "arrow";
  }

  function findSocialUrl(buttons, patterns) {
    const found = buttons.find((button) => patterns.some((pattern) => pattern.test(`${button.label} ${button.url}`)));
    return found ? found.url : "";
  }

  function renderSocialLink(link) {
    const active = /^https?:\/\//i.test(link.url);
    if (!active) return "";

    return `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" class="unq-ref-social-link" aria-label="${esc(link.label)}">${iconSvg(link.icon)}</a>`;
  }

  function formatWallDateTime(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = Object.create(null);
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }
    }
    return `${parts.hour || "00"}:${parts.minute || "00"} ${parts.day || "00"}.${parts.month || "00"}.${parts.year || "0000"}`;
  }

  function renderWallPostContent(value) {
    return esc(String(value || "")).replace(/\n/g, "<br>");
  }

  function renderWallAuthorIdentity({ label, verified = false, href = "", nameClass = "", verifiedClass = "", dataAttr = "" } = {}) {
    const normalizedLabel = String(label || "").trim() || "UNQX User";
    const nameHtml = `<span class="${esc(nameClass)}">${esc(normalizedLabel)}</span>`;
    const verifiedHtml = verified ? `<span class="${esc(verifiedClass)}">${iconSvg("verified")}</span>` : "";
    const contentHtml = `${nameHtml}${verifiedHtml}`;
    const normalizedHref = String(href || "").trim();
    if (!normalizedHref) {
      return contentHtml;
    }
    const attributeSuffix = dataAttr ? ` ${dataAttr}` : "";
    return `<a href="${esc(normalizedHref)}" class="unq-wall-author-link"${attributeSuffix}>${contentHtml}</a>`;
  }

  const WALL_SCROLLABLE_COMMENT_COUNT = 5;
  const WALL_COMMENT_CONTENT_MAX = 1000;

  function normalizeWallForRender(rawWall) {
    if (!rawWall || typeof rawWall !== "object" || rawWall.enabled === false) {
      return null;
    }
    const items = Array.isArray(rawWall.items)
      ? rawWall.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const comments = Array.isArray(item.comments)
            ? item.comments
              .map((comment) => {
                if (!comment || typeof comment !== "object") return null;
                const author = comment.author && typeof comment.author === "object" ? comment.author : {};
                return {
                  id: String(comment.id || "").trim(),
                  postId: String(comment.postId || "").trim(),
                  userId: String(comment.userId || "").trim(),
                  content: String(comment.content || ""),
                  createdAt: comment.createdAt || null,
                  updatedAt: comment.updatedAt || null,
                  viewerCanDelete: Boolean(comment.viewerCanDelete),
                  isBusyDelete: Boolean(comment.isBusyDelete),
                  author: {
                    id: String(author.id || comment.userId || "").trim(),
                    name: String(author.name || "UNQX User").trim() || "UNQX User",
                    wallAuthorLabel: String(author.wallAuthorLabel || author.name || "UNQX User").trim() || "UNQX User",
                    verified: Boolean(author.verified),
                    profileHref: String(author.profileHref || "").trim() || null,
                    avatarUrl: String(author.avatarUrl || "").trim() || null,
                    initials: String(author.initials || "").trim() || "UN",
                  },
                };
              })
              .filter((comment) => comment && comment.id)
            : [];
          return {
            id: String(item.id || "").trim(),
            content: String(item.content || ""),
            commentsEnabled: item.commentsEnabled !== false,
            createdAt: item.createdAt || null,
            updatedAt: item.updatedAt || null,
            likesCount: Number(item.likesCount || 0),
            commentsCount: Math.max(0, Number(item.commentsCount || comments.length)),
            comments,
            viewerHasLiked: Boolean(item.viewerHasLiked),
            viewerCanLike: Boolean(item.viewerCanLike),
            isEdited: Boolean(item.isEdited),
            isBusy: Boolean(item.isBusy),
            commentDraft: String(item.commentDraft || ""),
            isCommentBusy: Boolean(item.isCommentBusy),
            isCommentsExpanded: Boolean(item.isCommentsExpanded),
          };
        })
        .filter((item) => item && item.id)
      : [];
    const pagination = rawWall.pagination && typeof rawWall.pagination === "object" ? rawWall.pagination : {};
    return {
      activeTab: rawWall.activeTab === "posts" ? "posts" : "card",
      hasUnreadPosts: Boolean(rawWall.hasUnreadPosts),
      items,
      pagination: {
        page: Math.max(1, Number(pagination.page || 1)),
        pageSize: Math.max(1, Number(pagination.pageSize || 10)),
        total: Math.max(0, Number(pagination.total || items.length)),
        hasMore: Boolean(pagination.hasMore),
        isLoadingMore: Boolean(pagination.isLoadingMore),
      },
    };
  }

  function getFollowInitials(name) {
    const initials = String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => (part[0] ? part[0].toUpperCase() : ""))
      .join("");
    return initials || "UN";
  }

  function normalizeFollowItemForRender(item) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const name = String(item.name || "UNQX User").trim() || "UNQX User";
    const primarySlug = String(item.primarySlug || "").trim().toUpperCase() || null;
    const profileHref =
      String(item.profileHref || "").trim() || (primarySlug ? `/${encodeURIComponent(primarySlug)}` : null);
    return {
      userId: String(item.userId || "").trim(),
      name,
      initials: String(item.initials || "").trim() || getFollowInitials(name),
      avatarUrl: String(item.avatarUrl || "").trim() || null,
      primarySlug,
      role: String(item.role || "").trim(),
      verified: Boolean(item.verified),
      followedAt: item.followedAt || null,
      isFollowing: Boolean(item.isFollowing),
      canFollow: item.canFollow !== false && Boolean(primarySlug),
      requiresAuth: Boolean(item.requiresAuth),
      isPubliclyReachable: item.isPubliclyReachable !== false && Boolean(profileHref),
      profileHref,
    };
  }

  function normalizeFollowSummaryForRender(rawSummary) {
    const summary = rawSummary && typeof rawSummary === "object" ? rawSummary : {};
    const counts = summary.counts && typeof summary.counts === "object" ? summary.counts : {};
    const viewer = summary.viewer && typeof summary.viewer === "object" ? summary.viewer : {};
    const previews = summary.previews && typeof summary.previews === "object" ? summary.previews : {};
    return {
      counts: {
        followers: Math.max(0, Number(counts.followers || 0)),
        following: Math.max(0, Number(counts.following || 0)),
      },
      viewer: {
        isFollowing: Boolean(viewer.isFollowing),
        canFollow: Boolean(viewer.canFollow),
        requiresAuth: Boolean(viewer.requiresAuth),
      },
      unreadFollowersCount: Math.max(0, Number(summary.unreadFollowersCount || 0)),
      previews: {
        following: Array.isArray(previews.following)
          ? previews.following.map(normalizeFollowItemForRender).filter(Boolean)
          : [],
      },
    };
  }

  function normalizeFollowDialogForRender(rawDialog) {
    const dialog = rawDialog && typeof rawDialog === "object" ? rawDialog : {};
    const type = dialog.type === "followers" ? "followers" : "following";
    const pagination = dialog.pagination && typeof dialog.pagination === "object" ? dialog.pagination : {};
    return {
      open: Boolean(dialog.open),
      type,
      title: type === "followers" ? "Подписчики" : "Подписки",
      loading: Boolean(dialog.loading),
      error: String(dialog.error || "").trim(),
      items: Array.isArray(dialog.items)
        ? dialog.items.map(normalizeFollowItemForRender).filter(Boolean)
        : [],
      pagination: {
        page: Math.max(1, Number(pagination.page || 1)),
        pageSize: Math.max(1, Number(pagination.pageSize || 20)),
        total: Math.max(0, Number(pagination.total || 0)),
        hasMore: Boolean(pagination.hasMore),
      },
    };
  }

  function renderCardView(input, options = {}) {
    const card = normalizeCard(input);
    const theme = resolveTheme(card.theme);
    const shareUrl = String(options.shareUrl || "").trim() || window.location.href;
    const showPausedBanner = Boolean(options.showPausedBanner);
    const pausedText = String(options.pausedText || "Визитка на паузе - посетители видят заглушку");
    const viewsLabel = String(options.viewsLabel || card.viewsLabel || "0 просмотров");
    const viewerCommentComposerRaw =
      options.viewerCommentComposer && typeof options.viewerCommentComposer === "object"
        ? options.viewerCommentComposer
        : null;
    const viewerCommentComposer = {
      avatarUrl: String(viewerCommentComposerRaw?.avatarUrl || "").trim() || "/brand/profile-user.svg",
      initials: String(viewerCommentComposerRaw?.initials || "").trim() || "UN",
      placeholder: String(viewerCommentComposerRaw?.placeholder || "").trim() || "Добавьте ответ...",
    };
    const slugPriceLabel =
      Number.isFinite(Number(card.slugPrice)) && Number(card.slugPrice) > 0
        ? `${Number(card.slugPrice).toLocaleString("ru-RU")} сум`
        : "";
    const slugItems = card.slugs.length > 0 ? card.slugs : [card.slug];
    const score = options.score && typeof options.score === "object" ? options.score : null;
    const topBadge = options.topBadge && typeof options.topBadge === "object" ? options.topBadge : null;
    const officialUnqBadge = options.officialUnqBadge && typeof options.officialUnqBadge === "object" ? options.officialUnqBadge : null;
    const staffBadge = options.staffBadge && typeof options.staffBadge === "object" ? options.staffBadge : null;
    const wall = normalizeWallForRender(options.wall);
    const followSummary = normalizeFollowSummaryForRender(options.followSummary);
    const followDialog = normalizeFollowDialogForRender(options.followDialog);
    const busyFollowSlugs = new Set(
      Array.isArray(options.followBusySlugs)
        ? options.followBusySlugs.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)
        : [],
    );
    const ownerProfileHrefRaw = card.slug ? `/${encodeURIComponent(card.slug)}` : "";
    const ownerProfileHref = ownerProfileHrefRaw;
    const isOwnerFollowBusy = busyFollowSlugs.has(String(card.slug || "").trim().toUpperCase());
    const followToggleLabel = followSummary.viewer.isFollowing ? "Отписаться" : "Подписаться";
    const followButtonHtml = followSummary.viewer.canFollow
      ? `
          <button
            type="button"
            class="unq-ref-follow-toggle unq-ref-follow-toggle--hero${followSummary.viewer.isFollowing ? " is-active" : ""}"
            data-follow-toggle
            data-follow-slug="${esc(card.slug)}"
            data-following="${followSummary.viewer.isFollowing ? "true" : "false"}"
            data-login-next="${esc(ownerProfileHref || "/")}"
            aria-pressed="${followSummary.viewer.isFollowing ? "true" : "false"}"
            ${isOwnerFollowBusy ? "disabled" : ""}
          >
            ${esc(isOwnerFollowBusy ? "..." : followToggleLabel)}
          </button>
        `
      : "";
    const followStatsHtml = `
      <div class="unq-ref-social-stats" aria-label="Подписки и подписчики">
        <button type="button" class="unq-ref-social-stat" data-follow-open="followers">
          <span class="unq-ref-social-value">${Number(followSummary.counts.followers || 0).toLocaleString("ru-RU")}</span>
          <span class="unq-ref-social-label">Подписчики</span>
        </button>
        <button type="button" class="unq-ref-social-stat" data-follow-open="following">
          <span class="unq-ref-social-value">${Number(followSummary.counts.following || 0).toLocaleString("ru-RU")}</span>
          <span class="unq-ref-social-label">Подписки</span>
        </button>
      </div>
    `;

    const tagsHtml =
      card.tags.length > 0
        ? `<div class="unq-ref-tags">${card.tags.map((tag) => `<span class="unq-ref-tag">${esc(tag)}</span>`).join("")}</div>`
        : "";

    const buttonsHtml =
      card.buttons.length > 0
        ? card.buttons
          .map((button, index) => {
            const buttonKind = classifyButton(button);
            const toneClass = "is-secondary";
            if (button.type === "card") {
              const cardDigits = parseCardDigits(String(button.url || "").replace(/^card:/i, ""));
              if (!cardDigits) {
                return "";
              }
              const brand = detectCardBrand(cardDigits);
              const rawLabel = String(button.label || "").trim();
              const labelLower = rawLabel.toLowerCase();
              const useDefaultLabel = !rawLabel || labelLower === "карта" || labelLower === "card";
              const brandUpper = brand ? String(brand).toUpperCase() : "";
              const buttonLabel = useDefaultLabel
                ? brand && brand !== "Карта"
                  ? `Карта (${brandUpper})`
                  : "Карта"
                : rawLabel;
              return `<button type="button" data-track-action data-button-type="card" data-copy-card="${esc(cardDigits)}" class="public-card-button unq-ref-action-btn ${toneClass}">${iconSvg("card")}<span>${esc(buttonLabel)}</span></button>`;
            }
            return `<a href="${esc(button.url)}" target="_blank" rel="noopener noreferrer" data-track-action data-button-type="${esc(button.type || "other")}" class="public-card-button unq-ref-action-btn ${toneClass}">${iconSvg(buttonKind)}<span>${esc(button.label)}</span></a>`;
          })
          .filter(Boolean)
          .join("")
        : '<p class="unq-ref-empty-buttons">Владелец пока не добавил контактные кнопки.</p>';
    const scoreBlock = score
      ? `<div class="unq-score-block">
          <div class="unq-score-head">
            <span class="unq-score-label">UNQ SCORE</span>
            ${score.rarityLabel ? `<span class="unq-rarity-badge">${esc(score.rarityLabel)}</span>` : ""}
          </div>
          <div class="unq-score-row">
            <span class="unq-score-value">${Number(score.score || 0)}</span>
            <span class="unq-score-top">Топ ${Number(score.topPercent || 100)}%</span>
          </div>
          ${score.isForming
        ? '<p class="unq-score-note">UNQ Score формируется · обновляется каждые 24ч</p>'
        : `<div class="unq-score-progress"><span style="width:${Math.max(0, Math.min(100, (Number(score.score || 0) / 999) * 100)).toFixed(2)}%"></span></div>`
      }
        </div>`
      : "";

    const socialLinks = [
      { label: "Telegram", url: findSocialUrl(card.buttons, [/telegram/i, /t\.me/i]), icon: "telegram" },
      { label: "WhatsApp", url: findSocialUrl(card.buttons, [/whatsapp/i, /wa\.me/i]), icon: "message" },
      { label: "Instagram", url: findSocialUrl(card.buttons, [/instagram/i, /insta/i]), icon: "instagram" },
      { label: "LinkedIn", url: findSocialUrl(card.buttons, [/linkedin/i]), icon: "linkedin" },
      { label: "TikTok", url: findSocialUrl(card.buttons, [/tiktok/i, /tik tok/i]), icon: "tiktok" },
      { label: "YouTube", url: findSocialUrl(card.buttons, [/youtube/i, /youtu\.be/i]), icon: "youtube" },
    ];
    const activeSocialLinks = socialLinks.filter((link) => /^https?:\/\//i.test(link.url));

    const mainHashtag = card.hashtag ? (card.hashtag.startsWith("#") ? card.hashtag : `#${card.hashtag}`) : "#UnqPower2026";
    const aboutAddress = card.address;
    const aboutEmail = card.email;
    const aboutPhone = card.extraPhone;
    const aboutPostcode = card.postcode;
    const aboutItems = [
      aboutAddress ? `<p>${iconSvg("location")}<span>${esc(aboutAddress)}</span></p>` : "",
      aboutEmail ? `<p>${iconSvg("email")}<span>${esc(aboutEmail)}</span></p>` : "",
      aboutPhone ? `<p>${iconSvg("phone")}<span>${esc(aboutPhone)}</span></p>` : "",
      aboutPostcode ? `<p>${iconSvg("hashtag")}<span>Postcode: ${esc(aboutPostcode)}</span></p>` : "",
    ].filter(Boolean);
    const aboutHtml =
      aboutItems.length > 0
        ? `<div class="unq-ref-about">
            <p class="unq-ref-about-title">КОНТАКТЫ</p>
            ${aboutItems.join("")}
          </div>`
        : "";
    const topBadgeHtml =
      topBadge && Number.isFinite(Number(topBadge.rank)) && Number(topBadge.rank) > 0
        ? `<div class="unq-ref-top-badge">Топ #${Math.round(Number(topBadge.rank))} этой недели</div>`
        : "";
    const shellMetaHtml =
      topBadgeHtml || followButtonHtml
        ? `
            <div class="unq-ref-shell-meta${topBadgeHtml ? "" : " is-follow-only"}">
              ${topBadgeHtml || '<span class="unq-ref-shell-meta-spacer" aria-hidden="true"></span>'}
              ${followButtonHtml}
            </div>
          `
        : "";
    const officialUnqLine = officialUnqBadge ? String(officialUnqBadge.line || "").trim() : "";
    const officialUnqTitle = officialUnqBadge ? String(officialUnqBadge.title || "").trim() : "";
    const officialUnqHtml =
      officialUnqLine || officialUnqTitle
        ? `<div class="unq-ref-official-unq" role="status">
            ${officialUnqTitle ? `<p class="unq-ref-official-unq-kicker">${esc(officialUnqTitle)}</p>` : ""}
            ${officialUnqLine ? `<p class="unq-ref-official-unq-line">${esc(officialUnqLine)}</p>` : ""}
          </div>`
        : "";
    const staffBadgeLine = staffBadge ? String(staffBadge.line || "").trim() : "";
    const staffBadgeTitle = staffBadge ? String(staffBadge.title || "").trim() : "";
    const staffBadgeHtml =
      staffBadgeLine || staffBadgeTitle
        ? `<div class="unq-ref-staff-badge" role="status">
            ${staffBadgeTitle ? `<p class="unq-ref-staff-badge-kicker">${esc(staffBadgeTitle)}</p>` : ""}
            ${staffBadgeLine ? `<p class="unq-ref-staff-badge-line">${esc(staffBadgeLine)}</p>` : ""}
          </div>`
        : "";
    const useCustomColor = Boolean(card.customColor);
    const topLineValue =
      theme.tokens.topLineGradient === "none"
        ? theme.tokens.topLineSolid || theme.tokens.accentColor
        : theme.tokens.topLineGradient;
    const styleTokens = [
      `--theme-card-bg:${esc(theme.tokens.cardBg)}`,
      `--theme-surface-bg:${esc(theme.tokens.surfaceBg)}`,
      `--theme-card-border:${esc(theme.tokens.cardBorder)}`,
      `--theme-surface-border:${esc(theme.tokens.surfaceBorder)}`,
      `--theme-divider-color:${esc(theme.tokens.dividerColor)}`,
      `--theme-name-color:${esc(theme.tokens.nameColor)}`,
      `--theme-role-color:${esc(theme.tokens.roleColor)}`,
      `--theme-muted-color:${esc(theme.tokens.mutedColor)}`,
      `--theme-accent-color:${esc(theme.tokens.accentColor)}`,
      `--theme-email-color:${esc(theme.tokens.emailColor)}`,
      `--theme-button-primary-bg:${esc(useCustomColor ? card.customColor : theme.tokens.buttonPrimaryBg)}`,
      `--theme-button-primary-text:${esc(theme.tokens.buttonPrimaryText)}`,
      `--theme-button-primary-border:${esc(theme.tokens.buttonPrimaryBorder)}`,
      `--theme-button-secondary-bg:${esc(theme.tokens.buttonSecondaryBg)}`,
      `--theme-button-secondary-text:${esc(theme.tokens.buttonSecondaryText)}`,
      `--theme-button-secondary-border:${esc(theme.tokens.buttonSecondaryBorder)}`,
      `--theme-badge-text:${esc(theme.tokens.badgeText)}`,
      `--theme-badge-bg:${esc(theme.tokens.badgeBg)}`,
      `--theme-badge-border:${esc(theme.tokens.badgeBorder)}`,
      `--theme-top-line:${esc(topLineValue)}`,
      `--theme-avatar-bg:${esc(theme.tokens.avatarBg)}`,
      `--theme-avatar-text:${esc(theme.tokens.avatarText)}`,
      `--theme-avatar-border:${esc(theme.tokens.avatarBorder)}`,
      `--theme-card-radius:${esc(theme.tokens.cardBorderRadius)}`,
      `--theme-font-family:${esc(theme.tokens.fontFamily)}`,
      `--theme-name-font-style:${esc(theme.tokens.nameFontStyle)}`,
      `--theme-name-font-weight:${esc(theme.tokens.nameFontWeight)}`,
      `--theme-role-letter-spacing:${esc(theme.tokens.roleLetterSpacing)}`,
      `--theme-score-label:${esc(theme.tokens.scoreLabelColor)}`,
      `--theme-score-value:${esc(theme.tokens.scoreValueColor)}`,
      `--theme-score-fill:${esc(theme.tokens.scoreBarFill)}`,
      `--theme-score-track:${esc(theme.tokens.scoreBarTrack)}`,
      `--theme-score-percentile:${esc(theme.tokens.scorePercentileColor)}`,
      `--theme-card-shadow:${esc(theme.tokens.cardShadow)}`,
      `--theme-button-shine:${esc(theme.tokens.buttonShineGradient)}`,
    ];
    const rootStyle = ` style="${styleTokens.join(";")};"`;
    const companyHtml =
      card.verifiedCompany || card.verified
        ? `<p class="unq-ref-verified-company"><span class="unq-ref-verified-text">${esc(card.verifiedCompany)}</span>${card.verified ? `<span class="unq-ref-verified-icon">${iconSvg("verified")}</span>` : ""}</p>`
        : "";
    const roleHtml = card.role ? `<p class="unq-ref-role">${esc(card.role)}</p>` : "";
    const footBrandingLabel = card.showBranding ? (theme.key === "velours" ? "◆ UNQX" : "• UNQX") : "";
    const detailSections = [
      tagsHtml,
      scoreBlock,
      `<div class="unq-ref-actions">${buttonsHtml}</div>`,
      `<p class="unq-ref-hashtag">${esc(mainHashtag)}</p>`,
      aboutHtml,
      activeSocialLinks.length ? `<div class="unq-ref-social">${activeSocialLinks.map(renderSocialLink).join("")}</div>` : "",
      `<button type="button" class="unq-ref-save interactive-btn" data-save-contact>${iconSvg("save")}<span>Сохранить контакт (.vcf)</span></button>`,
    ].filter((section) => String(section || "").trim());
    const cardDetailsHtml = detailSections.join('<div class="unq-ref-divider"></div>');
    const wallPostsHtml = wall
      ? wall.items.length > 0
        ? wall.items
          .map((item) => {
            const likeIcon = item.viewerHasLiked ? iconSvg("heartFilled") : iconSvg("heart");
            const likeLabel = item.viewerHasLiked ? "Убрать лайк" : "Поставить лайк";
            const comments = Array.isArray(item.comments) ? item.comments : [];
            const commentsEnabled = item.commentsEnabled !== false;
            const postAuthorHtml = renderWallAuthorIdentity({
              label: card.wallAuthorLabel || card.name,
              verified: card.verified,
              href: ownerProfileHref,
              nameClass: "unq-wall-post-name",
              verifiedClass: "unq-wall-post-verified",
              dataAttr: "data-wall-post-author-link",
            });
            const commentsHtml = comments.length
              ? comments
                .map((comment) => {
                  const commentAuthorHtml = renderWallAuthorIdentity({
                    label: comment.author?.wallAuthorLabel || comment.author?.name || "UNQX User",
                    verified: comment.author?.verified,
                    href: comment.author?.profileHref || "",
                    nameClass: "unq-wall-comment-name",
                    verifiedClass: "unq-wall-comment-verified",
                    dataAttr: "data-wall-comment-author-link",
                  });
                  return `
                  <article class="unq-wall-comment" data-wall-comment="${esc(comment.id)}">
                    <span class="unq-wall-comment-thread" aria-hidden="true"></span>
                    <div class="unq-wall-comment-avatar">
                      ${comment.author?.avatarUrl
                    ? `<img src="${esc(comment.author.avatarUrl)}" alt="${esc(comment.author?.wallAuthorLabel || comment.author?.name || "UNQX User")}" class="unq-wall-comment-avatar-img" />`
                    : `<span>${esc(comment.author?.initials || "UN")}</span>`}
                    </div>
                    <div class="unq-wall-comment-body">
                      <div class="unq-wall-comment-line">
                        ${commentAuthorHtml}
                        <span class="unq-wall-comment-date">${esc(formatWallDateTime(comment.createdAt))}</span>
                      </div>
                      <div class="unq-wall-comment-content">${renderWallPostContent(comment.content)}</div>
                    </div>
                    ${comment.viewerCanDelete
                  ? `<button type="button" class="unq-wall-comment-delete" data-wall-comment-delete data-wall-post-id="${esc(item.id)}" data-wall-comment-id="${esc(comment.id)}" ${comment.isBusyDelete ? "disabled" : ""}>${comment.isBusyDelete ? "..." : "Удалить"}</button>`
                  : ""}
                  </article>
                `;
                })
                .join("")
              : `<div class="unq-wall-comment-empty">${commentsEnabled ? "Комментариев пока нет." : "Комментарии отключены автором."}</div>`;
            const commentCount = Number(item.commentsCount || comments.length).toLocaleString("ru-RU");
            const commentsComposeHtml = commentsEnabled
              ? `
                  <div class="unq-wall-comments-compose">
                    <span class="unq-wall-compose-avatar" aria-hidden="true">
                      <img src="${esc(viewerCommentComposer.avatarUrl)}" alt="" class="unq-wall-compose-avatar-img" />
                    </span>
                    <label class="sr-only" for="wall-comment-inline-${esc(item.id)}">Комментарий</label>
                    <textarea
                      id="wall-comment-inline-${esc(item.id)}"
                      class="unq-wall-compose-input"
                      data-wall-comment-inline-input
                      data-wall-post-id="${esc(item.id)}"
                      rows="1"
                      maxlength="${esc(String(WALL_COMMENT_CONTENT_MAX))}"
                      placeholder="${esc(viewerCommentComposer.placeholder)}"
                      ${item.isCommentBusy ? "disabled" : ""}
                    >${esc(item.commentDraft || "")}</textarea>
                    <button
                      type="button"
                      class="interactive-btn unq-wall-compose-submit"
                      data-wall-comment-compose
                      data-wall-post-id="${esc(item.id)}"
                      aria-label="Отправить комментарий"
                      title="Отправить комментарий"
                      ${item.isCommentBusy ? "disabled" : ""}
                    >
                      ${iconSvg("send")}
                    </button>
                  </div>
                `
              : "";
            const commentsPanelHtml = item.isCommentsExpanded
              ? `
                <div class="unq-wall-comments">
                  ${commentsComposeHtml}
                  <div class="unq-wall-comments-list${comments.length > WALL_SCROLLABLE_COMMENT_COUNT ? " is-scrollable" : ""}">${commentsHtml}</div>
                </div>
              `
              : "";
            const likeCountLabel = Number(item.likesCount || 0).toLocaleString("ru-RU");
            const hasLikeCount = Number(item.likesCount || 0) > 0;
            const hasCommentCount = Number(item.commentsCount || comments.length) > 0;
            const postAnchorId = `wall-post-${encodeURIComponent(String(item.id || "").trim())}`;
            return `
              <article class="unq-wall-post" id="${esc(postAnchorId)}" data-wall-post="${esc(item.id)}">
                <div class="unq-wall-post-head">
                  <div class="unq-wall-post-avatar">${card.avatarUrl ? `<img src="${esc(card.avatarUrl)}" alt="${esc(card.name)}" class="unq-wall-post-avatar-img" />` : `<span>${esc(card.initials)}</span>`}</div>
                  <div class="unq-wall-post-meta">
                    <div class="unq-wall-post-top">
                      <div class="unq-wall-post-author">
                        ${postAuthorHtml}
                      </div>
                      <span class="unq-wall-post-date">${esc(formatWallDateTime(item.createdAt))}</span>
                    </div>
                    ${item.isEdited ? '<p class="unq-wall-post-edited">изменено</p>' : ""}
                    <div class="unq-wall-post-content">${renderWallPostContent(item.content)}</div>
                    <div class="unq-wall-post-actions">
                      <span class="unq-wall-action-group">
                        <button type="button" class="unq-wall-action-btn unq-wall-like-btn${item.viewerHasLiked ? " is-liked" : ""}" data-wall-like data-post-id="${esc(item.id)}" aria-pressed="${item.viewerHasLiked ? "true" : "false"}" aria-label="${likeLabel}" ${item.isBusy ? "disabled" : ""}>
                          ${likeIcon}
                        </button>
                        ${hasLikeCount ? `<span class="unq-wall-action-count unq-wall-like-count">${likeCountLabel}</span>` : ""}
                      </span>
                      <span class="unq-wall-action-group">
                        <button type="button" class="unq-wall-action-btn unq-wall-comment-pill" data-wall-comment-open data-wall-post-id="${esc(item.id)}" aria-expanded="${item.isCommentsExpanded ? "true" : "false"}" aria-label="${item.isCommentsExpanded ? "Скрыть комментарии" : "Показать комментарии"}">
                          ${iconSvg("comment")}
                        </button>
                        ${hasCommentCount ? `<span class="unq-wall-action-count unq-wall-comment-count">${commentCount}</span>` : ""}
                      </span>
                      <span class="unq-wall-action-group">
                        <button type="button" class="unq-wall-action-btn unq-wall-share-btn" data-wall-share data-wall-post-id="${esc(item.id)}" aria-label="Поделиться постом">
                          ${iconSvg("share")}
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
                ${commentsPanelHtml}
              </article>
            `;
          })
          .join("")
        : '<div class="unq-wall-empty">Пока здесь нет постов. Первый пост появится сразу после публикации.</div>'
      : "";
    const wallTabsHtml = wall
      ? `
          <div class="unq-wall-tabs" role="tablist" aria-label="Вкладки визитки">
            <button type="button" class="unq-wall-tab${wall.activeTab === "card" ? " is-active" : ""}" data-card-tab="card" role="tab" aria-selected="${wall.activeTab === "card" ? "true" : "false"}">Визитка</button>
            <button type="button" class="unq-wall-tab${wall.activeTab === "posts" ? " is-active" : ""}" data-card-tab="posts" role="tab" aria-selected="${wall.activeTab === "posts" ? "true" : "false"}">
              <span class="unq-wall-tab-label">Посты</span>
              ${wall.hasUnreadPosts && wall.activeTab !== "posts" ? '<span class="unq-wall-tab-dot" data-wall-posts-unread-dot aria-hidden="true"></span>' : ""}
            </button>
          </div>
          <section class="unq-wall-panel${wall.activeTab === "card" ? " is-active" : ""}" data-card-tab-panel="card" ${wall.activeTab === "card" ? "" : "hidden"}>
            ${cardDetailsHtml}
          </section>
          <section class="unq-wall-panel${wall.activeTab === "posts" ? " is-active" : ""}" data-card-tab-panel="posts" ${wall.activeTab === "posts" ? "" : "hidden"}>
            <div class="unq-wall-posts">${wallPostsHtml}</div>
            ${wall.pagination.hasMore
              ? `<button type="button" class="interactive-btn unq-wall-more-btn" data-wall-load-more ${wall.pagination.isLoadingMore ? "disabled" : ""}>${wall.pagination.isLoadingMore ? "Загрузка..." : "Показать ещё"}</button>`
              : ""
            }
          </section>
        `
      : cardDetailsHtml;

    const overlayHtml = renderThemeOverlay(theme.key);
    const visiblePetCount = getVisibleCardPets(card).length;

    return `
      <div data-card-view data-card-theme="${esc(theme.key)}" data-emoji-background-pack="${esc(card.emojiBackgroundPack)}" data-slug="${esc(card.slug)}" data-share-url="${esc(shareUrl)}"${rootStyle}>
        ${showPausedBanner ? `<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${esc(pausedText)}</div>` : ""}
        <div class="unq-ref-top">
          <div class="unq-ref-slug-wrap">
                <div class="unq-ref-slugs">
              ${slugItems
        .map((value) => {
          const active = value === card.slug;
          return `<a href="/${encodeURIComponent(value)}" class="unq-ref-slug-chip${active ? " is-active" : ""}"># ${esc(value)}</a>`;
        })
        .join("")}
            </div>
            ${slugPriceLabel ? `<span class="unq-ref-slug-price">${esc(slugPriceLabel)}</span>` : ""}
          </div>
          <div class="unq-ref-top-actions">
            <button type="button" data-share-card class="unq-ref-share" aria-label="Поделиться">
              ${iconSvg("share")}
              <span class="sr-only" data-share-label>Поделиться</span>
            </button>
          </div>
        </div>
        <div class="public-card-shell unq-ref-shell">
          <div class="unq-ref-card-overlay">${overlayHtml}</div>
          ${shellMetaHtml}
          ${officialUnqHtml}
          ${staffBadgeHtml}
          ${card.showBranding
        ? `<div class="unq-ref-brand">
            <h2>UNQX</h2>
            <p>POWERED BY SCXR</p>
          </div>`
        : ""
      }
          <div class="unq-ref-profile${card.emojiBackgroundPack !== "none" ? " has-emoji-pack" : ""}${visiblePetCount ? ` has-pets has-pets-${visiblePetCount}` : ""}">
            ${card.emojiBackgroundPack !== "none" ? renderEmojiBackgroundOverlay(card.emojiBackgroundPack, card.slug || card.name || "") : ""}
            ${renderPetDecorations(card)}
            <div class="unq-ref-avatar-wrap">
              ${card.avatarUrl ? `<img src="${esc(card.avatarUrl)}" alt="${esc(card.name)}" class="unq-ref-avatar-img" data-avatar-image />` : ""}
              <div class="unq-ref-avatar-fallback ${card.avatarUrl ? "hidden" : ""}" data-avatar-fallback aria-hidden="${card.avatarUrl ? "true" : "false"}" ${card.avatarUrl ? "hidden" : ""} style="${card.avatarUrl ? "display:none;" : ""}">${esc(card.initials)}</div>
              ${renderAvatarFrame(card.avatarFrame, theme.key)}
            </div>
            <div class="unq-ref-name-wrap">
              <h1 class="unq-ref-name">${esc(card.name)}</h1>
              ${companyHtml}
              ${roleHtml}
              ${card.bio ? `<p class="unq-ref-bio">${esc(card.bio)}</p>` : ""}
              ${followStatsHtml}
              ${card.phone ? `<a href="tel:${esc(card.phone.replace(/\s+/g, ""))}" class="unq-ref-phone">${iconSvg("phone")}<span>${esc(card.phone)}</span></a>` : ""}
            </div>
          </div>
          ${wallTabsHtml}
        </div>
        <div class="unq-ref-footline">
          <div>© ${esc(viewsLabel)}</div>
          <div>${footBrandingLabel}</div>
        </div>
        <div class="unq-follow-dialog${followDialog.open ? " is-open" : ""}" data-follows-dialog ${followDialog.open ? "" : "hidden"}>
          <button type="button" class="unq-follow-dialog-backdrop" data-follow-close aria-label="Закрыть список"></button>
          <div class="unq-follow-dialog-card" role="dialog" aria-modal="true" aria-label="${esc(followDialog.title)}" tabindex="-1">
            <div class="unq-follow-dialog-head">
              <div>
                <p class="unq-follow-dialog-kicker">UNQX</p>
                <h3 class="unq-follow-dialog-title">${esc(followDialog.title)}</h3>
              </div>
              <button type="button" class="unq-follow-dialog-close" data-follow-close aria-label="Закрыть">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            ${followDialog.error ? `<div class="unq-follow-dialog-error">${esc(followDialog.error)}</div>` : ""}
            <div class="unq-follow-dialog-body">
              ${followDialog.loading
                ? '<div class="unq-follow-dialog-empty">Загрузка списка...</div>'
                : followDialog.items.length
                  ? `<div class="unq-follow-dialog-list">
                      ${followDialog.items
                        .map((item) => `
                          <article class="unq-follow-dialog-item">
                            <div class="unq-follow-dialog-user">
                              <span class="unq-follow-dialog-avatar">
                                ${item.avatarUrl
                                  ? `<img src="${esc(item.avatarUrl)}" alt="${esc(item.name)}" class="unq-follow-dialog-avatar-img" />`
                                  : `<span>${esc(item.initials)}</span>`}
                              </span>
                              <span class="unq-follow-dialog-text">
                                ${item.profileHref
                                  ? `<a href="${esc(item.profileHref)}" class="unq-follow-dialog-name">${esc(item.name)}</a>`
                                  : `<span class="unq-follow-dialog-name">${esc(item.name)}</span>`}
                                <span class="unq-follow-dialog-meta">
                                  ${esc(item.primarySlug ? `unqx.uz/${item.primarySlug}` : "Визитка недоступна")}
                                  ${item.role ? ` · ${esc(item.role)}` : ""}
                                </span>
                                ${!item.isPubliclyReachable ? '<span class="unq-follow-dialog-badge">Визитка недоступна</span>' : ""}
                              </span>
                            </div>
                            ${item.canFollow
                              ? `<button
                                  type="button"
                                  class="unq-follow-dialog-action${item.isFollowing ? " is-active" : ""}"
                                  data-follow-toggle
                                  data-follow-slug="${esc(item.primarySlug || "")}"
                                  data-following="${item.isFollowing ? "true" : "false"}"
                                  data-login-next="${esc(item.profileHref || ownerProfileHref || "/")}"
                                  aria-pressed="${item.isFollowing ? "true" : "false"}"
                                  ${busyFollowSlugs.has(String(item.primarySlug || "").trim().toUpperCase()) ? "disabled" : ""}
                                >
                                  ${busyFollowSlugs.has(String(item.primarySlug || "").trim().toUpperCase()) ? "..." : item.isFollowing ? "Отписаться" : "Подписаться"}
                                </button>`
                              : ""}
                          </article>
                        `)
                        .join("")}
                    </div>`
                  : '<div class="unq-follow-dialog-empty">Список пока пуст.</div>'}
            </div>
            ${followDialog.pagination.hasMore
              ? '<div class="unq-follow-dialog-foot"><button type="button" class="unq-follow-dialog-more" data-follow-load-more>Показать ещё</button></div>'
              : ""}
          </div>
        </div>
      </div>
    `;
  }

  function mountCardView(container, input, options = {}) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }
    container.innerHTML = renderCardView(input, options);
    return container.querySelector("[data-card-view]");
  }

  window.CardView = {
    renderCardView,
    mountCardView,
  };
})();
