(function initCardViewGlobal() {
  const THEME_KEYS = ["default_dark", "arctic", "linen", "marble", "forest", "sage_luxe", "midnight_obsidian", "golden_noir", "aurora_codex", "nebula_glass"];
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
      cardBg: "rgba(255, 255, 255, 0.09)",
      cardBgOverlay: "none",
      surfaceBg: "rgba(255, 255, 255, 0.08)",
      cardBorder: "1px solid rgba(255, 255, 255, 0.15)",
      surfaceBorder: "1px solid rgba(255, 255, 255, 0.1)",
      dividerColor: "rgba(255, 255, 255, 0.08)",
      nameColor: "#ffffff",
      roleColor: "rgba(255, 255, 255, 0.62)",
      mutedColor: "rgba(255, 255, 255, 0.5)",
      accentColor: "#ffffff",
      emailColor: "rgba(255, 255, 255, 0.76)",
      buttonPrimaryBg: "rgba(255, 255, 255, 0.07)",
      buttonPrimaryText: "#ffffff",
      buttonPrimaryBorder: "rgba(255, 255, 255, 0.1)",
      buttonSecondaryBg: "rgba(255, 255, 255, 0.06)",
      buttonSecondaryText: "#ffffff",
      buttonSecondaryBorder: "rgba(255, 255, 255, 0.1)",
      badgeText: "#ffffff",
      badgeBg: "rgba(255, 255, 255, 0.08)",
      badgeBorder: "1px solid rgba(255, 255, 255, 0.15)",
      topLineGradient: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.34), rgba(255,255,255,0))",
      avatarBg: "rgba(255, 255, 255, 0.08)",
      avatarText: "#ffffff",
      avatarBorder: "1px solid rgba(255, 255, 255, 0.25)",
      cardBorderRadius: "21px",
      fontFamily: "'SF Pro Display', 'Helvetica Neue', 'Segoe UI', sans-serif",
      nameFontStyle: "normal",
      nameFontWeight: "600",
      roleLetterSpacing: "0.08em",
      scoreLabelColor: "rgba(255, 255, 255, 0.62)",
      scoreValueColor: "#ffffff",
      scoreBarFill: "rgba(255, 255, 255, 0.68)",
      scoreBarTrack: "rgba(255, 255, 255, 0.18)",
      scorePercentileColor: "rgba(255, 255, 255, 0.6)",
      cardShadow: "0 18px 48px rgba(0, 0, 0, 0.44)",
      buttonShineGradient: "none",
    },
  };

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
    if (themeKey === "nebula_glass") {
      return "";
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
    const plan = card.tariff === "premium" ? "premium" : "basic";
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
      customColor: normalizeHexColor(card.customColor),
      name,
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
    };
  }

  function iconSvg(name) {
    const map = {
      share:
        '<svg class="icon-stroke h-[15px] w-[15px]" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.25"></circle><circle cx="6" cy="12" r="2.25"></circle><circle cx="18" cy="19" r="2.25"></circle><path d="m8 11 7.5-4.3M8 13l7.5 4.3"></path></svg>',
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
      linkedin:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M8 10v6M8 8.2v.1M12 16v-3.2c0-1.2.9-2.1 2-2.1 1.2 0 2 .9 2 2.1V16"></path></svg>',
      tiktok:
        '<svg class="icon-stroke h-[16px] w-[16px]" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4v8.8a4 4 0 1 1-2.8-3.8"></path><path d="M14.5 4c.8 1.7 2.2 2.8 4 3.1"></path></svg>',
      youtube:
        '<svg class="icon-stroke h-[16px] w-[16px]" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="3.4"></rect><path d="m10 9.2 5.8 2.8-5.8 2.8z"></path></svg>',
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

  function renderCardView(input, options = {}) {
    const card = normalizeCard(input);
    const theme = resolveTheme(card.theme);
    const shareUrl = String(options.shareUrl || "").trim() || window.location.href;
    const showPausedBanner = Boolean(options.showPausedBanner);
    const pausedText = String(options.pausedText || "Визитка на паузе - посетители видят заглушку");
    const viewsLabel = String(options.viewsLabel || card.viewsLabel || "0 просмотров");
    const slugPriceLabel =
      Number.isFinite(Number(card.slugPrice)) && Number(card.slugPrice) > 0
        ? `${Number(card.slugPrice).toLocaleString("ru-RU")} сум`
        : "";
    const slugItems = card.slugs.length > 0 ? card.slugs : [card.slug];
    const score = options.score && typeof options.score === "object" ? options.score : null;
    const topBadge = options.topBadge && typeof options.topBadge === "object" ? options.topBadge : null;

    const tagsHtml =
      card.tags.length > 0
        ? `<div class="unq-ref-tags">${card.tags.map((tag) => `<span class="unq-ref-tag">${esc(tag)}</span>`).join("")}</div>`
        : "";

    const buttonsHtml =
      card.buttons.length > 0
        ? card.buttons
          .map((button, index) => {
            const buttonKind = classifyButton(button);
            const toneClass = index === 0 && buttonKind !== "telegram" ? "is-primary" : "is-secondary";
            if (button.type === "card") {
              const cardDigits = parseCardDigits(String(button.url || "").replace(/^card:/i, ""));
              if (!cardDigits) {
                return "";
              }
              const brand = detectCardBrand(cardDigits);
              const rawLabel = String(button.label || "").trim();
              const localizedBrand = brand === "Humo" ? "Хумо" : brand;
              const buttonLabel = rawLabel
                ? rawLabel
                : brand && brand !== "Карта"
                  ? `Карта ${localizedBrand}`
                  : "Карта";
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
    const useCustomColor = card.tariff === "premium" && Boolean(card.customColor);
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

    return `
      <div data-card-view data-card-theme="${esc(theme.key)}" data-slug="${esc(card.slug)}" data-share-url="${esc(shareUrl)}"${rootStyle}>
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
          <button type="button" data-share-card class="unq-ref-share" aria-label="Поделиться">
            ${iconSvg("share")}
            <span class="sr-only" data-share-label>Поделиться</span>
          </button>
        </div>
        <div class="public-card-shell unq-ref-shell">
          <div class="unq-ref-card-overlay">${renderThemeOverlay(theme.key)}</div>
          ${topBadgeHtml}
          ${card.showBranding
        ? `<div class="unq-ref-brand">
            <h2>UNQX</h2>
            <p>POWERED BY SCXR</p>
          </div>`
        : ""
      }
          <div class="unq-ref-profile">
            <div class="unq-ref-avatar-wrap">
              ${card.avatarUrl ? `<img src="${esc(card.avatarUrl)}" alt="${esc(card.name)}" class="unq-ref-avatar-img" data-avatar-image />` : ""}
              <div class="unq-ref-avatar-fallback ${card.avatarUrl ? "hidden" : ""}" data-avatar-fallback aria-hidden="${card.avatarUrl ? "true" : "false"}" ${card.avatarUrl ? "hidden" : ""} style="${card.avatarUrl ? "display:none;" : ""}">${esc(card.initials)}</div>
            </div>
            <div class="unq-ref-name-wrap">
              <h1 class="unq-ref-name">${esc(card.name)}</h1>
              ${companyHtml}
              ${roleHtml}
              ${card.bio ? `<p class="unq-ref-bio">${esc(card.bio)}</p>` : ""}
              ${card.phone ? `<a href="tel:${esc(card.phone.replace(/\s+/g, ""))}" class="unq-ref-phone">${iconSvg("phone")}<span>${esc(card.phone)}</span></a>` : ""}
            </div>
          </div>
          ${tagsHtml}
          ${scoreBlock}
          <div class="unq-ref-divider"></div>
          <div class="unq-ref-actions">${buttonsHtml}</div>
          <div class="unq-ref-divider"></div>
          <p class="unq-ref-hashtag">${esc(mainHashtag)}</p>
          ${aboutHtml}
          ${activeSocialLinks.length ? `<div class="unq-ref-social">${activeSocialLinks.map(renderSocialLink).join("")}</div>` : ""}
          <button type="button" class="unq-ref-save interactive-btn" data-save-contact>${iconSvg("save")}<span>Сохранить контакт (.vcf)</span></button>
        </div>
        <div class="unq-ref-footline">
          <div>© ${esc(viewsLabel)}</div>
          <div>${card.showBranding ? "• UNQX" : ""}</div>
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
