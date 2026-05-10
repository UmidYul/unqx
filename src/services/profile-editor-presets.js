const { PET_PRESETS } = require("./pets");

const SIGNATURE_THEMES = [
  {
    id: "default_dark",
    label: "Obsidian Noir",
    description: "Signature black prestige",
    swatchStyle: "border-color:rgba(255,255,255,0.65);background:#0a0a0a;",
    premiumRequired: false,
  },
  {
    id: "arctic",
    label: "Glacier Platinum",
    description: "Cool silver premium",
    swatchStyle: "border-color:#7a9db8;background:linear-gradient(145deg,#f6fbff 0%,#dbeaf4 100%);",
    premiumRequired: true,
  },
  {
    id: "linen",
    label: "Imperial Linen",
    description: "Warm couture classic",
    swatchStyle: "border-color:#c8a882;background:linear-gradient(145deg,#faf4ea 0%,#eadbc6 100%);",
    premiumRequired: true,
  },
  {
    id: "marble",
    label: "Carrara Prestige",
    description: "Monochrome luxury stone",
    swatchStyle: "border-color:#7b7b7b;background:linear-gradient(145deg,#ffffff 0%,#ececec 100%);",
    premiumRequired: true,
  },
  {
    id: "forest",
    label: "Emerald Reserve",
    description: "Deep emerald heritage",
    swatchStyle: "border-color:#c7b58a;background:linear-gradient(145deg,#143823 0%,#0b2014 100%);",
    premiumRequired: true,
  },
  {
    id: "sage_luxe",
    label: "Sage Luxe",
    description: "Fresh premium minimal",
    swatchStyle: "border-color:#6f7f72;background:linear-gradient(145deg,#edf5ed 0%,#d7e5d7 100%);",
    premiumRequired: true,
  },
  {
    id: "midnight_obsidian",
    label: "Midnight Obsidian",
    description: "Dark premium depth",
    swatchStyle: "border-color:#5374a6;background:linear-gradient(145deg,#18273f 0%,#0f1829 100%);",
    premiumRequired: true,
  },
  {
    id: "golden_noir",
    label: "Golden Noir",
    description: "Gold on deep noir",
    swatchStyle: "border-color:#816f3f;background:linear-gradient(145deg,#1b2233 0%,#121725 100%);",
    premiumRequired: true,
  },
  {
    id: "aurora_codex",
    label: "Aurora Scriptum",
    description: "Renaissance parchment",
    swatchStyle: "border-color:#7a5736;background:linear-gradient(145deg,#f7efde 0%,#ead8b9 100%);",
    premiumRequired: true,
  },
  {
    id: "nebula_glass",
    label: "Liquid Glass",
    description: "Frosted iOS glass",
    swatchStyle: "border-color:#8f8f92;background:linear-gradient(145deg,#2a2a2d 0%,#1c1c1e 100%);",
    premiumRequired: true,
  },
  {
    id: "velours",
    label: "Velours Luxe",
    description: "Burgundy velvet luxe",
    swatchStyle: "border-width:1.5px;border-color:#c9a55a;background:linear-gradient(145deg,#3b0f1a 0%,#2d0a12 100%);",
    premiumRequired: true,
  },
  {
    id: "graffiti_neon",
    label: "Graffiti Neon",
    description: "Street neon, spray and drips",
    swatchStyle: "border-color:#5ef7ff;background:linear-gradient(145deg,#12111d 0%,#19142a 48%,#0f1220 100%);box-shadow:0 0 0 1px rgba(242,132,255,0.25) inset;",
    premiumRequired: true,
  },
];

const COLOR_THEMES = [
  {
    id: "color_red",
    label: "Red",
    description: "Classic red",
    swatchStyle: "border-color:#ff6b85;background:linear-gradient(145deg,#3c0710 0%,#8e1627 100%);",
    premiumRequired: true,
  },
  {
    id: "color_orange",
    label: "Orange",
    description: "Clean orange",
    swatchStyle: "border-color:#ffb957;background:linear-gradient(145deg,#4f2100 0%,#c85600 100%);",
    premiumRequired: true,
  },
  {
    id: "color_yellow",
    label: "Yellow",
    description: "Warm yellow",
    swatchStyle: "border-color:#fff3a6;background:linear-gradient(145deg,#5f4600 0%,#d1a800 100%);",
    premiumRequired: true,
  },
  {
    id: "color_green",
    label: "Green",
    description: "Bright green",
    swatchStyle: "border-color:#b4ff82;background:linear-gradient(145deg,#0d3317 0%,#1f8f47 100%);",
    premiumRequired: true,
  },
  {
    id: "color_teal",
    label: "Teal",
    description: "Fresh teal",
    swatchStyle: "border-color:#91f8ff;background:linear-gradient(145deg,#072f33 0%,#0f8c93 100%);",
    premiumRequired: true,
  },
  {
    id: "color_blue",
    label: "Blue",
    description: "Deep blue",
    swatchStyle: "border-color:#8fc8ff;background:linear-gradient(145deg,#0b234d 0%,#1d63d6 100%);",
    premiumRequired: true,
  },
  {
    id: "color_purple",
    label: "Purple",
    description: "Vivid purple",
    swatchStyle: "border-color:#d6adff;background:linear-gradient(145deg,#33124f 0%,#7a2fca 100%);",
    premiumRequired: true,
  },
  {
    id: "color_pink",
    label: "Pink",
    description: "Soft pink",
    swatchStyle: "border-color:#ffb6dc;background:linear-gradient(145deg,#57163b 0%,#d53c84 100%);",
    premiumRequired: true,
  },
];

const AVATAR_FRAMES = [
  { id: "none", label: "Без рамки", description: "Чистый круглый аватар", premiumRequired: false },
  { id: "chrome_ring", label: "Chrome Ring", description: "Металлическое кольцо", premiumRequired: true },
  { id: "neon_spray", label: "Neon Spray", description: "Неоновый spray glow", premiumRequired: true },
  { id: "sticker_bubble", label: "Sticker Bubble", description: "Виниловый стикер", premiumRequired: true },
  { id: "chain_link", label: "Chain Link", description: "Цепной контур", premiumRequired: true },
  { id: "pixel_glow", label: "Pixel Glow", description: "Пиксельная аура", premiumRequired: true },
  { id: "starburst", label: "Starburst", description: "Звёздный взрыв", premiumRequired: true },
  { id: "drip_outline", label: "Drip Outline", description: "Краска с потёками", premiumRequired: true },
  { id: "tape_collage", label: "Tape Collage", description: "Коллаж из лент", premiumRequired: true },
  { id: "orbit_dots", label: "Orbit Dots", description: "Орбиты и точки", premiumRequired: true },
];

const EMOJI_BACKGROUND_PACKS = [
  {
    id: "none",
    label: "Без фона",
    description: "Только текущая тема",
    swatchStyle: "border-color:#d4d4d8;background:linear-gradient(145deg,#ffffff 0%,#f5f5f5 100%);",
    glyphLabel: "OFF",
    premiumRequired: false,
  },
  {
    id: "ghosts",
    label: "Ghosts",
    description: "Мягкие силуэты",
    swatchStyle: "border-color:#b7bdd1;background:linear-gradient(145deg,#1a1d27 0%,#2a3040 100%);",
    glyphLabel: "GH",
    premiumRequired: true,
  },
  {
    id: "stars",
    label: "Stars",
    description: "Звёздная сетка",
    swatchStyle: "border-color:#b9c3d4;background:linear-gradient(145deg,#181d28 0%,#2a3344 100%);",
    glyphLabel: "ST",
    premiumRequired: true,
  },
  {
    id: "lightning",
    label: "Lightning",
    description: "Электрический узор",
    swatchStyle: "border-color:#d9c58b;background:linear-gradient(145deg,#1b1a19 0%,#37312b 100%);",
    glyphLabel: "LT",
    premiumRequired: true,
  },
  {
    id: "crowns",
    label: "Crowns",
    description: "Короны и prestige",
    swatchStyle: "border-color:#c5b17c;background:linear-gradient(145deg,#211b13 0%,#3a2f1d 100%);",
    glyphLabel: "CR",
    premiumRequired: true,
  },
  {
    id: "webs",
    label: "Webs",
    description: "Тонкие web-lines",
    swatchStyle: "border-color:#bcbec6;background:linear-gradient(145deg,#17181d 0%,#2d3038 100%);",
    glyphLabel: "WB",
    premiumRequired: true,
  },
  {
    id: "hearts",
    label: "Hearts",
    description: "Ритм и soft luxe",
    swatchStyle: "border-color:#d4b0ba;background:linear-gradient(145deg,#24161b 0%,#4a2932 100%);",
    glyphLabel: "HT",
    premiumRequired: true,
  },
];

function getProfileEditorPresets() {
  return {
    signatureThemes: SIGNATURE_THEMES,
    colorThemes: COLOR_THEMES,
    avatarFrames: AVATAR_FRAMES,
    emojiBackgroundPacks: EMOJI_BACKGROUND_PACKS,
    petPresets: PET_PRESETS,
  };
}

module.exports = {
  SIGNATURE_THEMES,
  COLOR_THEMES,
  AVATAR_FRAMES,
  EMOJI_BACKGROUND_PACKS,
  PET_PRESETS,
  getProfileEditorPresets,
};
