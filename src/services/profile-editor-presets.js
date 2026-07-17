const { PET_PRESETS } = require("./pets");
const { listThemeConfigs } = require("./theme-configs");
const { getVisualStyleLabelMap } = require("./visual-style-labels");

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
    label: "Apple Liquid Glass",
    description: "Animated frosted glass",
    swatchStyle: "border-color:rgba(255,255,255,0.35);background:radial-gradient(circle at 20% 20%,rgba(75,126,218,0.62),transparent 34%),radial-gradient(circle at 80% 18%,rgba(132,91,190,0.5),transparent 32%),linear-gradient(125deg,#0a0f24 0%,#151a3d 22%,#0d2540 42%,#1e112a 62%,#102c4d 78%,#24143b 100%);box-shadow:inset 0 0 18px rgba(118,169,255,0.24);",
    premiumRequired: true,
  },
  {
    id: "galaxy",
    label: "Galaxy",
    description: "Neon cosmic portals",
    swatchStyle: "border-color:#00e5ff;background:radial-gradient(circle at 18% 18%,rgba(0,229,255,0.28),transparent 34%),linear-gradient(135deg,#12072B 0%,#2A085C 50%,#5E179B 100%);box-shadow:0 0 10px rgba(0,229,255,0.5);",
    premiumRequired: true,
  },
  {
    id: "volt_sport",
    label: "Volt Sport",
    description: "Acid athletic accessories",
    swatchStyle: "border-color:#000000;background:radial-gradient(circle at 72% 28%,rgba(0,0,0,0.2),transparent 20%),linear-gradient(145deg,#B6FF00 0%,#9DFF00 54%,#E8FF5B 100%);box-shadow:inset 0 0 0 2px rgba(0,0,0,0.14);",
    premiumRequired: true,
  },
  {
    id: "minion_yellow",
    label: "Yellow Crew",
    description: "Playful yellow goggles",
    swatchStyle: "border-color:#1b1b1b;background:radial-gradient(circle at 28% 32%,#ffffff 0 9%,#1b1b1b 10% 13%,transparent 14%),radial-gradient(circle at 58% 32%,#ffffff 0 9%,#1b1b1b 10% 13%,transparent 14%),linear-gradient(145deg,#FFE45C 0%,#FFD42A 54%,#F6B900 100%);box-shadow:inset 0 -12px 0 rgba(37,82,176,0.32);",
    premiumRequired: true,
  },
  {
    id: "soviet_carpet",
    label: "Бабушкин ковёр 🧶",
    description: "Deep red vintage carpet",
    swatchStyle: "border-color:#D4AF37;background:radial-gradient(circle at 50% 50%,rgba(212,175,55,0.36) 0 9%,transparent 10%),radial-gradient(circle at 20% 20%,rgba(253,245,230,0.22) 0 6%,transparent 7%),linear-gradient(145deg,#800000 0%,#4b0909 58%,#250a0a 100%);box-shadow:inset 0 0 0 2px rgba(212,175,55,0.2);",
    premiumRequired: true,
  },
  {
    id: "vintage_mickey",
    label: "Ретро Микки 🐭",
    description: "Vintage stripes and toon stars",
    swatchStyle: "border-color:#D35252;background:repeating-linear-gradient(45deg,#8ECAA5 0 12px,#D35252 12px 24px,#F4D068 24px 36px,#F5E6CA 36px 48px);box-shadow:inset 0 0 0 2px rgba(43,43,43,0.18);",
    premiumRequired: true,
  },
  {
    id: "rick_morty_portal",
    label: "Портал Рика 🧪",
    description: "Neon sci-fi portal bubbles",
    swatchStyle: "border-color:#39FF14;background:radial-gradient(circle at 46% 44%,#A6FF96 0 12%,#39FF14 13% 34%,rgba(57,255,20,0.24) 35% 48%,transparent 49%),linear-gradient(145deg,#0B001A 0%,#120524 58%,#050014 100%);box-shadow:0 0 12px rgba(57,255,20,0.55);",
    premiumRequired: true,
  },
  {
    id: "gravity_falls",
    label: "Гравити Фолз 🌲",
    description: "Mystic forest journal glow",
    swatchStyle: "border-color:#E5A93C;background:radial-gradient(circle at 50% 34%,rgba(229,169,60,0.34) 0 12%,transparent 13%),linear-gradient(145deg,#1A2E22 0%,#2B1F19 58%,#120f0d 100%);box-shadow:0 0 12px rgba(229,169,60,0.35);",
    premiumRequired: true,
  },
  {
    id: "venom_symbiote",
    label: "Симбиот Веном 🧬",
    description: "Electric neon symbiote",
    swatchStyle: "border-color:#E53E6D;background:radial-gradient(circle at 18% 22%,rgba(0,240,255,0.35),transparent 34%),radial-gradient(circle at 84% 70%,rgba(229,62,109,0.38),transparent 38%),linear-gradient(145deg,#15040A 0%,#08080C 58%,#020205 100%);box-shadow:0 0 12px rgba(0,240,255,0.42),0 0 16px rgba(229,62,109,0.3);",
    premiumRequired: true,
  },
  {
    id: "snow_leopard",
    label: "Снежный Барс 🐆",
    description: "Frosted wild snow rosettes",
    swatchStyle: "border-color:#CBD5E1;background:radial-gradient(circle at 28% 30%,rgba(15,23,42,0.22) 0 8%,transparent 9%),radial-gradient(circle at 72% 62%,rgba(30,41,59,0.18) 0 10%,transparent 11%),linear-gradient(145deg,#F8FAFC 0%,#E2E8F0 54%,#CBD5E1 100%);box-shadow:0 0 12px rgba(148,163,184,0.3),inset 0 0 0 2px rgba(255,255,255,0.45);",
    premiumRequired: true,
  },
  {
    id: "shinobi_path",
    label: "Путь Шиноби 🦊",
    description: "Seigaiha clouds and chakra",
    swatchStyle: "border-color:#00F0FF;background:radial-gradient(circle at 50% 46%,rgba(20,255,236,0.32),transparent 34%),repeating-radial-gradient(circle at 50% 100%,transparent 0 8px,rgba(176,62,39,0.58) 9px 12px,transparent 13px 24px),linear-gradient(145deg,#C84B31 0%,#1D2637 68%);box-shadow:0 0 12px rgba(20,255,236,0.42);",
    premiumRequired: true,
  },
  {
    id: "shinobi_way",
    label: "Путь Ниндзя 🍃",
    description: "Denim scroll, Konoha leaves",
    swatchStyle: "border-color:#009793;background:radial-gradient(circle at 18% 20%,rgba(0,151,147,0.32),transparent 38%),repeating-radial-gradient(circle at 100% 150%,transparent 0 24px,rgba(238,137,59,0.72) 24px 28px,transparent 29px 60px),linear-gradient(145deg,#D15F47 0%,#2C364D 68%);box-shadow:0 0 12px rgba(238,137,59,0.4);",
    premiumRequired: true,
  },
  {
    id: "samarkand_heritage",
    label: "Величие Самарканда 🕌",
    description: "Majolica gold and lapis",
    swatchStyle: "border-color:#A87E43;background:radial-gradient(circle at 50% 18%,rgba(32,138,133,0.34),transparent 38%),url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpath d='M18 0 36 18 18 36 0 18Z' fill='none' stroke='%23208A85' stroke-width='1' opacity='.55'/%3E%3C/svg%3E\"),linear-gradient(145deg,#C5A07A 0%,#1E4D9C 68%);box-shadow:0 0 14px rgba(168,126,67,0.38);",
    premiumRequired: true,
  },
  {
    id: "sakura_blossom",
    label: "Цветущая Сакура 🌸",
    description: "Watercolor silk petals",
    swatchStyle: "border-color:#D2A298;background:radial-gradient(ellipse at 20% 40%,rgba(162,172,147,0.22),transparent 48%),radial-gradient(circle at 50% 10%,rgba(255,131,151,0.22),transparent 48%),linear-gradient(145deg,#F3EAD8 0%,#FDFAF2 72%);box-shadow:0 0 12px rgba(176,75,75,0.18);",
    premiumRequired: true,
  },
  {
    id: "starry_night",
    label: "Звездная Ночь 🌌",
    description: "Impressionist night swirls",
    swatchStyle: "border-color:#FFD500;background:radial-gradient(circle at 18% 18%,#FFF4D0 0 8%,#ECC128 9% 16%,transparent 17%),radial-gradient(ellipse at 64% 42%,rgba(33,61,104,0.62),transparent 48%),linear-gradient(145deg,#0B1528 0%,#0C1A30 62%,#040817 100%);box-shadow:0 0 14px rgba(255,213,0,0.36);",
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
    id: "graffiti",
    label: "Граффити 🎨",
    description: "YES MONEY street spray",
    swatchStyle: "border-color:#0F52BA;background:radial-gradient(circle at 20% 30%,rgba(15,82,186,0.35),transparent 40%),radial-gradient(circle at 80% 70%,rgba(255,69,0,0.3),transparent 44%),linear-gradient(135deg,rgba(236,72,153,0.28),rgba(254,230,0,0.24)),#000000;box-shadow:0 0 16px rgba(236,72,153,0.45),inset 0 0 0 2px rgba(254,230,0,0.22);",
    premiumRequired: true,
  },
  {
    id: "graffiti_neon",
    label: "Graffiti Neon",
    description: "Street neon, spray and drips",
    swatchStyle: "border-color:#5ef7ff;background:linear-gradient(145deg,#12111d 0%,#19142a 48%,#0f1220 100%);box-shadow:0 0 0 1px rgba(242,132,255,0.25) inset;",
    premiumRequired: true,
  },
  {
    id: "heritage_crest",
    label: "Sweet Ribbon",
    description: "Soft pink kawaii accessories",
    swatchStyle: "border-color:#ff9fca;background:linear-gradient(145deg,#fff1f7 0%,#ffc6dd 54%,#ffdce9 100%);",
    premiumRequired: true,
  },
  {
    id: "ivory_tennis",
    label: "Gotham Shadow",
    description: "Black and grey vigilante mood",
    swatchStyle: "border-color:#f0c84b;background:linear-gradient(145deg,#050608 0%,#2b2f36 62%,#111318 100%);",
    premiumRequired: true,
  },
  {
    id: "grand_slam_clay",
    label: "Web Swing",
    description: "Red blue web energy",
    swatchStyle: "border-color:#6bb7ff;background:linear-gradient(145deg,#cf1f2d 0%,#123b86 100%);",
    premiumRequired: true,
  },
  {
    id: "racing_green",
    label: "Sakura Dream",
    description: "Soft anime blossom haze",
    swatchStyle: "border-color:#ffb7d1;background:linear-gradient(145deg,#fff3f8 0%,#ffc8df 52%,#b7d7ff 100%);",
    premiumRequired: true,
  },
  {
    id: "polo_navy",
    label: "Neon Mecha",
    description: "Cyan cockpit anime tech",
    swatchStyle: "border-color:#4df7ff;background:linear-gradient(145deg,#061422 0%,#0a3a52 52%,#0ef0ff 100%);",
    premiumRequired: true,
  },
  {
    id: "alpine_ski",
    label: "Moon Prism",
    description: "Pastel magical anime glow",
    swatchStyle: "border-color:#d9c7ff;background:linear-gradient(145deg,#fff8fe 0%,#bfe9ff 48%,#d8c7ff 100%);",
    premiumRequired: true,
  },
  {
    id: "boxing_legend",
    label: "Shonen Flame",
    description: "Orange battle aura",
    swatchStyle: "border-color:#ffd15a;background:linear-gradient(145deg,#2b0900 0%,#d94818 55%,#ffb13b 100%);",
    premiumRequired: true,
  },
  {
    id: "basketball_court",
    label: "Cyber Idol",
    description: "Magenta stage anime pop",
    swatchStyle: "border-color:#61f7ff;background:linear-gradient(145deg,#180821 0%,#cf2b9f 56%,#38e8ff 100%);",
    premiumRequired: true,
  },
  {
    id: "football_pitch",
    label: "Forest Spirit",
    description: "Mint nature anime calm",
    swatchStyle: "border-color:#a8ffd6;background:linear-gradient(145deg,#07251d 0%,#1ba879 52%,#b7ffe4 100%);",
    premiumRequired: true,
  },
  {
    id: "olympic_gold",
    label: "Dragon Aura",
    description: "Violet gold anime power",
    swatchStyle: "border-color:#ffd36e;background:linear-gradient(145deg,#180825 0%,#6732bd 54%,#ffd36e 100%);",
    premiumRequired: true,
  },
  {
    id: "anime_blush",
    label: "Anime Blush",
    description: "Pink anime character cameo",
    swatchStyle: "border-color:#ff8fc7;background:radial-gradient(circle at 72% 28%,#ffffff 0 12%,transparent 13%),linear-gradient(145deg,#fff1fa 0%,#ff9ed1 54%,#caa7ff 100%);",
    premiumRequired: true,
  },
  {
    id: "cheetah_spots",
    label: "Cheetah Skin",
    description: "Wild spotted fur pattern",
    swatchStyle: "border-color:#2b1608;background:radial-gradient(circle at 28% 32%,#2b1608 0 9%,transparent 10%),radial-gradient(circle at 68% 58%,#2b1608 0 8%,transparent 9%),linear-gradient(145deg,#f5c46b 0%,#b66a20 100%);",
    premiumRequired: true,
  },
  {
    id: "serpent_scale",
    label: "Serpent Scale",
    description: "Deep snake scale armor",
    swatchStyle: "border-color:#8ee6a8;background:radial-gradient(circle at 50% 16%,rgba(142,230,168,.45) 0 9%,transparent 10%),linear-gradient(145deg,#07190f 0%,#155332 56%,#0b2a1a 100%);",
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
  { id: "laurel_wreath", label: "Laurel Wreath", description: "Лавровый венок", premiumRequired: true },
  { id: "trophy_gold", label: "Trophy Gold", description: "Кубок и золото", premiumRequired: true },
  { id: "tennis_lines", label: "Tennis Lines", description: "Линии корта", premiumRequired: true },
  { id: "racing_stripes", label: "Racing Stripes", description: "Гоночные полосы", premiumRequired: true },
  { id: "varsity_patch", label: "Varsity Patch", description: "Университетский патч", premiumRequired: true },
  { id: "boxing_rope", label: "Boxing Rope", description: "Ринг и канаты", premiumRequired: true },
  { id: "basketball_arc", label: "Basketball Arc", description: "Дуга площадки", premiumRequired: true },
  { id: "football_stitch", label: "Football Stitch", description: "Швы мяча", premiumRequired: true },
  { id: "stopwatch_ring", label: "Stopwatch Ring", description: "Секундомер", premiumRequired: true },
  { id: "medal_ribbon", label: "Medal Ribbon", description: "Медальная лента", premiumRequired: true },
  { id: "dragon_orbit", label: "Круглый Дракон", description: "Анимированный дракон вокруг аватарки", premiumRequired: true },
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

function applyStyleLabel(item, kind, labels) {
  const key = String(item?.id || "").trim();
  const metadata = labels instanceof Map ? labels.get(`${kind}:${key}`) : null;
  const displayName = metadata?.displayName || "";
  return {
    ...item,
    ...(displayName ? { label: displayName } : {}),
    isActive: metadata?.isActive ?? item?.isActive ?? true,
  };
}

function styleIsSelectable(item, selectedKey) {
  const key = String(item?.id || "").trim();
  return item?.isActive !== false || (selectedKey && key === selectedKey);
}

async function getProfileEditorPresetsWithDisplayNames(options = {}) {
  const selectedTheme = String(options.selectedTheme || "").trim();
  const selectedFrame = String(options.selectedFrame || "").trim();
  const labels = await getVisualStyleLabelMap();
  const customThemes = await listThemeConfigs({ limit: 500 });
  const existingThemeKeys = new Set([...SIGNATURE_THEMES, ...COLOR_THEMES].map((item) => item.id));
  const customThemePresets = customThemes
    .filter((item) => item?.key && !existingThemeKeys.has(item.key) && ["active", "public"].includes(String(item.status || "active")))
    .map((item) => ({
      id: item.key,
      label: labels.get(`theme:${item.key}`)?.displayName || item.title || item.key,
      description: "Кастомная тема",
      swatchStyle: `border-color:#000000;background:${String(item.config?.cardBg || "#111111")};`,
      premiumRequired: true,
      custom: true,
      isActive: item.isActive !== false,
    }));

  const signatureThemes = [
    ...SIGNATURE_THEMES.map((item) => applyStyleLabel(item, "theme", labels)),
    ...customThemePresets,
  ].filter((item) => styleIsSelectable(item, selectedTheme));
  const colorThemes = COLOR_THEMES
    .map((item) => applyStyleLabel(item, "theme", labels))
    .filter((item) => styleIsSelectable(item, selectedTheme));
  const avatarFrames = AVATAR_FRAMES
    .map((item) => applyStyleLabel(item, "frame", labels))
    .filter((item) => styleIsSelectable(item, selectedFrame));

  return {
    signatureThemes,
    colorThemes,
    avatarFrames,
    emojiBackgroundPacks: EMOJI_BACKGROUND_PACKS,
    petPresets: PET_PRESETS,
  };
}

async function listAdminVisualStyles() {
  const labels = await getVisualStyleLabelMap();
  const customThemes = await listThemeConfigs({ limit: 500 });
  const existingThemeKeys = new Set([...SIGNATURE_THEMES, ...COLOR_THEMES].map((item) => item.id));
  const customThemePresets = customThemes
    .filter((item) => item?.key && !existingThemeKeys.has(item.key) && ["active", "public"].includes(String(item.status || "active")))
    .map((item) => ({
      kind: "theme",
      id: item.key,
      key: item.key,
      displayName: labels.get(`theme:${item.key}`)?.displayName || item.title || item.key,
      description: "Кастомная тема",
      custom: true,
      premiumRequired: true,
      isActive: item.isActive !== false,
      themeId: item.id,
    }));
  const staticThemePresets = [...SIGNATURE_THEMES, ...COLOR_THEMES].map((item) => applyStyleLabel(item, "theme", labels));
  return {
    themes: [
      ...staticThemePresets.map((item) => ({
        kind: "theme",
        id: item.id,
        key: item.id,
        displayName: item.label,
        description: item.description || "",
        custom: Boolean(item.custom),
        premiumRequired: Boolean(item.premiumRequired),
        isActive: item.isActive !== false,
        themeId: "",
      })),
      ...customThemePresets,
    ],
    frames: AVATAR_FRAMES.map((item) => applyStyleLabel(item, "frame", labels)).map((item) => ({
      kind: "frame",
      id: item.id,
      key: item.id,
      displayName: item.label,
      description: item.description || "",
      premiumRequired: Boolean(item.premiumRequired),
      isActive: item.isActive !== false,
    })),
  };
}

function findStaticThemePreset(themeKey) {
  const key = String(themeKey || "").trim();
  return [...SIGNATURE_THEMES, ...COLOR_THEMES].find((item) => item.id === key) || null;
}

function findStaticFramePreset(frameKey) {
  const key = String(frameKey || "").trim();
  return AVATAR_FRAMES.find((item) => item.id === key) || null;
}

module.exports = {
  SIGNATURE_THEMES,
  COLOR_THEMES,
  AVATAR_FRAMES,
  EMOJI_BACKGROUND_PACKS,
  PET_PRESETS,
  getProfileEditorPresets,
  getProfileEditorPresetsWithDisplayNames,
  findStaticFramePreset,
  findStaticThemePreset,
  listAdminVisualStyles,
};
