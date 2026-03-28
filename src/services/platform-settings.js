const { prisma } = require("../db/prisma");
const { env } = require("../config/env");

const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_SETTINGS = [
  {
    key: "slug_pricing_custom_rules",
    group: "algorithm",
    type: "json",
    label: "РљР°СЃС‚РѕРјРЅС‹Рµ РїСЂР°РІРёР»Р° С†РµРЅРѕРѕР±СЂР°Р·РѕРІР°РЅРёСЏ slug (РјР°СЃСЃРёРІ РѕР±СЉРµРєС‚РѕРІ: {pattern, type, delta, label})",
    value: [
      // РџСЂРёРјРµСЂ: РµСЃР»Рё slug СЃРѕРґРµСЂР¶РёС‚ UZB, РґРѕР±Р°РІРёС‚СЊ 1 РјР»РЅ СЃСѓРј
      { pattern: "UZB", type: "contains", delta: 1000000, label: "+1 РјР»РЅ Р·Р° UZB" }
    ],
  },
  { key: "plan_basic_name", group: "pricing", type: "text", label: "РќР°Р·РІР°РЅРёРµ Р±Р°Р·РѕРІРѕРіРѕ С‚Р°СЂРёС„Р°", value: "Р‘Р°Р·РѕРІС‹Р№" },
  { key: "plan_basic_price", group: "pricing", type: "number", label: "Р¦РµРЅР° Р±Р°Р·РѕРІРѕРіРѕ С‚Р°СЂРёС„Р°", value: 130_000 },
  { key: "plan_basic_slug_limit", group: "pricing", type: "number", label: "Р›РёРјРёС‚ slug (Р±Р°Р·РѕРІС‹Р№)", value: 1 },
  { key: "plan_basic_button_limit", group: "pricing", type: "number", label: "Р›РёРјРёС‚ РєРЅРѕРїРѕРє (Р±Р°Р·РѕРІС‹Р№)", value: 3 },
  { key: "plan_basic_tag_limit", group: "pricing", type: "number", label: "Р›РёРјРёС‚ С‚РµРіРѕРІ (Р±Р°Р·РѕРІС‹Р№)", value: 3 },
  { key: "plan_basic_hide_branding", group: "pricing", type: "boolean", label: "РЎРєСЂС‹С‚СЊ Р±СЂРµРЅРґРёРЅРі (Р±Р°Р·РѕРІС‹Р№)", value: false },
  { key: "plan_basic_themes", group: "pricing", type: "boolean", label: "РўРµРјС‹ (Р±Р°Р·РѕРІС‹Р№)", value: false },
  { key: "plan_basic_analytics_days", group: "pricing", type: "number", label: "РђРЅР°Р»РёС‚РёРєР° РґРЅРµР№ (Р±Р°Р·РѕРІС‹Р№)", value: 7 },
  {
    key: "plan_basic_features",
    group: "pricing",
    type: "json",
    label: "Р¤РёС‡Рё Р±Р°Р·РѕРІРѕРіРѕ С‚Р°СЂРёС„Р°",
    value: ["1 С†РёС„СЂРѕРІР°СЏ РІРёР·РёС‚РєР°", "Р”Рѕ 3 РєРЅРѕРїРѕРє", "РЎС‚Р°РЅРґР°СЂС‚РЅС‹Р№ С€Р°Р±Р»РѕРЅ", "QR-РєРѕРґ", "Р‘Р°Р·РѕРІР°СЏ Р°РЅР°Р»РёС‚РёРєР°"],
  },
  {
    key: "plan_basic_excluded_features",
    group: "pricing",
    type: "json",
    label: "РќРµРґРѕСЃС‚СѓРїРЅРѕ РІ Р±Р°Р·РѕРІРѕРј С‚Р°СЂРёС„Рµ",
    value: ["Р’С‹Р±РѕСЂ С‚РµРјС‹", "РљР°СЃС‚РѕРјРЅС‹Рµ С†РІРµС‚Р°", "РЎРєСЂС‹С‚СЊ Р±СЂРµРЅРґРёРЅРі UNQX", "Р‘РѕР»СЊС€Рµ 3 РєРЅРѕРїРѕРє"],
  },
  { key: "plan_premium_name", group: "pricing", type: "text", label: "РќР°Р·РІР°РЅРёРµ РїСЂРµРјРёСѓРј С‚Р°СЂРёС„Р°", value: "РџСЂРµРјРёСѓРј" },
  { key: "plan_premium_price", group: "pricing", type: "number", label: "Р¦РµРЅР° РїСЂРµРјРёСѓРј С‚Р°СЂРёС„Р°", value: 130_000 },
  { key: "plan_premium_upgrade_price", group: "pricing", type: "number", label: "Р¦РµРЅР° Р°РїРіСЂРµР№РґР° РґРѕ РїСЂРµРјРёСѓРј", value: 130_000 },
  { key: "plan_premium_monthly_price_usd", group: "pricing", type: "number", label: "Premium monthly price USD", value: 2 },
  { key: "plan_premium_monthly_price_uzs", group: "pricing", type: "number", label: "Premium monthly price UZS", value: 130_000 },
  { key: "plan_premium_slug_limit", group: "pricing", type: "number", label: "Р›РёРјРёС‚ slug (РїСЂРµРјРёСѓРј)", value: 3 },
  { key: "plan_premium_button_limit", group: "pricing", type: "number", label: "Р›РёРјРёС‚ РєРЅРѕРїРѕРє (РїСЂРµРјРёСѓРј)", value: 9 },
  { key: "plan_premium_tag_limit", group: "pricing", type: "number", label: "Р›РёРјРёС‚ С‚РµРіРѕРІ (РїСЂРµРјРёСѓРј)", value: 5 },
  { key: "plan_premium_hide_branding", group: "pricing", type: "boolean", label: "РЎРєСЂС‹С‚СЊ Р±СЂРµРЅРґРёРЅРі (РїСЂРµРјРёСѓРј)", value: true },
  { key: "plan_premium_themes", group: "pricing", type: "boolean", label: "РўРµРјС‹ (РїСЂРµРјРёСѓРј)", value: true },
  { key: "plan_premium_analytics_days", group: "pricing", type: "number", label: "РђРЅР°Р»РёС‚РёРєР° РґРЅРµР№ (РїСЂРµРјРёСѓРј)", value: 90 },
  {
    key: "plan_premium_features",
    group: "pricing",
    type: "json",
    label: "Р¤РёС‡Рё РїСЂРµРјРёСѓРј С‚Р°СЂРёС„Р°",
    value: [
      "1 С†РёС„СЂРѕРІР°СЏ РІРёР·РёС‚РєР°",
      "Р’С‹Р±РѕСЂ С‚РµРјС‹ (5+ С‚РµРј)",
      "РљР°СЃС‚РѕРјРЅС‹Рµ С†РІРµС‚Р° Рё С„РѕРЅ",
      "Р”Рѕ 9 РєРЅРѕРїРѕРє",
      "Р Р°СЃС€РёСЂРµРЅРЅР°СЏ Р°РЅР°Р»РёС‚РёРєР° (РґРёРЅР°РјРёРєР° РїРѕ РґРЅСЏРј)",
      "РЎРєСЂС‹С‚СЊ Р±СЂРµРЅРґРёРЅРі UNQX",
      "QR-РєРѕРґ + NFC РїРѕРґРґРµСЂР¶РєР°",
      "РџСЂРёРѕСЂРёС‚РµС‚РЅР°СЏ РїРѕРґРґРµСЂР¶РєР°",
    ],
  },
  {
    key: "plan_premium_excluded_features",
    group: "pricing",
    type: "json",
    label: "РќРµРґРѕСЃС‚СѓРїРЅРѕ РІ РїСЂРµРјРёСѓРј С‚Р°СЂРёС„Рµ",
    value: [],
  },
  { key: "plan_premium_popular_badge", group: "pricing", type: "boolean", label: "Р‘РµР№РґР¶ РїРѕРїСѓР»СЏСЂРЅРѕРіРѕ", value: true },
  { key: "pricing_section_visible", group: "pricing", type: "boolean", label: "РџРѕРєР°Р·С‹РІР°С‚СЊ СЃРµРєС†РёСЋ С‚Р°СЂРёС„РѕРІ", value: true },
  {
    key: "pricing_footnote",
    group: "pricing",
    type: "textarea",
    label: "РџРѕРґРїРёСЃСЊ РїРѕРґ С‚Р°СЂРёС„Р°РјРё",
    value: "Premium-подписка оплачивается ежемесячно. Без автосписаний.",
  },
  {
    key: "payment_provider",
    group: "pricing",
    type: "text",
    label: "РџСЂРѕРІР°Р№РґРµСЂ РѕРїР»Р°С‚С‹",
    value: "manual_tg",
  },
  {
    key: "payment_manual_instructions",
    group: "pricing",
    type: "textarea",
    label: "РРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ СЂСѓС‡РЅРѕР№ РѕРїР»Р°С‚С‹",
    value: "РћРїР»Р°С‚Р° РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ Р°РґРјРёРЅРѕРј РІ Telegram. РџРѕСЃР»Рµ РїРµСЂРµРІРѕРґР° РѕС‚РїСЂР°РІСЊС‚Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РјРµРЅРµРґР¶РµСЂСѓ.",
  },
  {
    key: "payment_click_merchant_id",
    group: "pricing",
    type: "text",
    label: "Click merchant id",
    value: "",
  },
  {
    key: "payment_payme_merchant_id",
    group: "pricing",
    type: "text",
    label: "Payme merchant id",
    value: "",
  },
  { key: "slug_base_price", group: "algorithm", type: "number", label: "Р‘Р°Р·РѕРІР°СЏ С†РµРЅР° slug", value: 100_000 },
  { key: "slug_mult_letters_all_same", group: "algorithm", type: "number", label: "Р‘СѓРєРІС‹ РІСЃРµ РѕРґРёРЅР°РєРѕРІС‹Рµ", value: 5 },
  { key: "slug_mult_letters_sequential", group: "algorithm", type: "number", label: "Р‘СѓРєРІС‹ РїРѕ РїРѕСЂСЏРґРєСѓ", value: 3 },
  { key: "slug_mult_letters_palindrome", group: "algorithm", type: "number", label: "РџР°Р»РёРЅРґСЂРѕРј Р±СѓРєРІ", value: 2 },
  { key: "slug_mult_letters_random", group: "algorithm", type: "number", label: "РЎР»СѓС‡Р°Р№РЅС‹Рµ Р±СѓРєРІС‹", value: 1 },
  { key: "slug_mult_digits_zeros", group: "algorithm", type: "number", label: "000", value: 6 },
  { key: "slug_mult_digits_near_zero", group: "algorithm", type: "number", label: "001-009", value: 4 },
  { key: "slug_mult_digits_all_same", group: "algorithm", type: "number", label: "Р¦РёС„СЂС‹ РІСЃРµ РѕРґРёРЅР°РєРѕРІС‹Рµ", value: 4 },
  { key: "slug_mult_digits_sequential", group: "algorithm", type: "number", label: "Р¦РёС„СЂС‹ РїРѕ РїРѕСЂСЏРґРєСѓ", value: 3 },
  { key: "slug_mult_digits_round", group: "algorithm", type: "number", label: "РљСЂСѓРіР»С‹Рµ С‡РёСЃР»Р°", value: 2 },
  { key: "slug_mult_digits_palindrome", group: "algorithm", type: "number", label: "РџР°Р»РёРЅРґСЂРѕРј С†РёС„СЂ", value: 1.5 },
  { key: "slug_mult_digits_random", group: "algorithm", type: "number", label: "РЎР»СѓС‡Р°Р№РЅС‹Рµ С†РёС„СЂС‹", value: 1 },
  { key: "bracelet_name", group: "bracelet", type: "text", label: "РќР°Р·РІР°РЅРёРµ NFC-СЃС‚РёРєРµСЂР°", value: "NFC-СЃС‚РёРєРµСЂ" },
  { key: "bracelet_old_price", group: "bracelet", type: "number", label: "РЎС‚Р°СЂР°СЏ С†РµРЅР° (РґРѕ СЃРєРёРґРєРё)", value: 400_000 },
  { key: "bracelet_price", group: "bracelet", type: "number", label: "Р¦РµРЅР° СЃРѕ СЃРєРёРґРєРѕР№", value: 250_000 },
  { key: "bracelet_in_stock", group: "bracelet", type: "boolean", label: "РќР°Р»РёС‡РёРµ СЃС‚РёРєРµСЂР°", value: true },
  { key: "bracelet_cta_text", group: "bracelet", type: "text", label: "РљРЅРѕРїРєР° СЃС‚РёРєРµСЂР°", value: "Р—Р°РєР°Р·Р°С‚СЊ СЃС‚РёРєРµСЂ" },
  {
    key: "bracelet_features",
    group: "bracelet",
    type: "json",
    label: "РџСЂРµРёРјСѓС‰РµСЃС‚РІР° СЃС‚РёРєРµСЂР°",
    value: [
      "РўР°Рї РїРѕ СЃС‚РёРєРµСЂСѓ - РјРѕРјРµРЅС‚Р°Р»СЊРЅРѕ РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ unqx.uz/UNQ",
      "Р Р°Р±РѕС‚Р°РµС‚ СЃ Р»СЋР±С‹Рј СЃРјР°СЂС‚С„РѕРЅРѕРј - iOS Рё Android",
      "NFC СЂР°Р±РѕС‚Р°РµС‚ РїР°СЃСЃРёРІРЅРѕ Рё РЅРµ С‚СЂРµР±СѓРµС‚ Р·Р°СЂСЏРґРєРё",
      "РљР»РµРёС‚СЃСЏ РЅР° Р»СЋР±СѓСЋ РїРѕРІРµСЂС…РЅРѕСЃС‚СЊ",
    ],
  },
  {
    key: "bracelet_description",
    group: "bracelet",
    type: "textarea",
    label: "РћРїРёСЃР°РЅРёРµ СЃС‚РёРєРµСЂР°",
    value: "РљРѕРјРїР°РєС‚РЅС‹Р№ NFC-СЃС‚РёРєРµСЂ, РєРѕС‚РѕСЂС‹Р№ РєР»РµРёС‚СЃСЏ РЅР° Р»СЋР±СѓСЋ РїРѕРІРµСЂС…РЅРѕСЃС‚СЊ Рё РѕС‚РєСЂС‹РІР°РµС‚ С‚РІРѕСЋ С†РёС„СЂРѕРІСѓСЋ РІРёР·РёС‚РєСѓ РІ РѕРґРёРЅ С‚Р°Рї.",
  },
  {
    key: "bracelet_note",
    group: "bracelet",
    type: "text",
    label: "РџСЂРёРјРµС‡Р°РЅРёРµ СЃС‚РёРєРµСЂР°",
    value: "РЎС‚РёРєРµСЂ РїСЂРёРІСЏР·Р°РЅ Рє С‚РІРѕРµРјСѓ slug - СЂР°Р±РѕС‚Р°РµС‚ С‚РѕР»СЊРєРѕ СЃ Р°РєС‚РёРІРЅРѕР№ РІРёР·РёС‚РєРѕР№ UNQX",
  },
  { key: "contact_telegram_bot", group: "contacts", type: "text", label: "Telegram Р±РѕС‚", value: "@unqx_bot" },
  { key: "contact_telegram_channel", group: "contacts", type: "text", label: "Telegram РєР°РЅР°Р»", value: "@unqx_uz" },
  { key: "contact_telegram_chat_id", group: "contacts", type: "text", label: "Telegram chat id", value: env.TELEGRAM_CHAT_ID || "" },
  { key: "contact_support_telegram", group: "contacts", type: "text", label: "Telegram РїРѕРґРґРµСЂР¶РєР°", value: "@unqx_uz" },
  { key: "contact_phone", group: "contacts", type: "text", label: "РўРµР»РµС„РѕРЅ", value: "" },
  { key: "contact_email", group: "contacts", type: "text", label: "Email", value: "" },
  { key: "contact_address", group: "contacts", type: "text", label: "РђРґСЂРµСЃ", value: "РўР°С€РєРµРЅС‚, РЈР·Р±РµРєРёСЃС‚Р°РЅ" },
  { key: "contact_response_time", group: "contacts", type: "text", label: "Р’СЂРµРјСЏ РѕС‚РІРµС‚Р°", value: "РІ С‚РµС‡РµРЅРёРµ 15 РјРёРЅСѓС‚" },
  { key: "contact_error_fallback", group: "contacts", type: "text", label: "Р¤РѕР»Р»Р±РµРє РѕС€РёР±РєРё", value: "РќР°РїРёС€Рё РЅР°Рј РЅР°РїСЂСЏРјСѓСЋ: @unqx_uz" },
  { key: "platform_name", group: "platform", type: "text", label: "РќР°Р·РІР°РЅРёРµ РїР»Р°С‚С„РѕСЂРјС‹", value: "UNQX" },
  { key: "platform_tagline", group: "platform", type: "text", label: "РЎР»РѕРіР°РЅ", value: "РўРІРѕР№ UNQ. РўРІРѕР№ Р±СЂРµРЅРґ. РќР°РІСЃРµРіРґР°." },
  { key: "platform_hero_subtitle", group: "platform", type: "textarea", label: "РџРѕРґР·Р°РіРѕР»РѕРІРѕРє hero", value: "Р¦РёС„СЂРѕРІР°СЏ РІРёР·РёС‚РєР° Р·Р° 1 РјРёРЅСѓС‚Сѓ - РѕРґРЅР° СЃСЃС‹Р»РєР° РІРјРµСЃС‚Рѕ С‚С‹СЃСЏС‡Рё СЃР»РѕРІ." },
  { key: "platform_total_slugs", group: "platform", type: "number", label: "Р’СЃРµРіРѕ slug", value: 17_576 },
  { key: "feature_directory", group: "platform", type: "boolean", label: "Directory РІРєР»СЋС‡РµРЅ", value: true },
  { key: "feature_leaderboard", group: "platform", type: "boolean", label: "Р›РёРґРµСЂР±РѕСЂРґ РІРєР»СЋС‡РµРЅ", value: true },
  { key: "feature_referrals", group: "platform", type: "boolean", label: "Р РµС„РµСЂР°Р»С‹ РІРєР»СЋС‡РµРЅС‹", value: true },
  { key: "feature_promo_codes", group: "platform", type: "boolean", label: "РџСЂРѕРјРѕРєРѕРґС‹ РІРєР»СЋС‡РµРЅС‹", value: true },
  { key: "promo_codes_first_order_only", group: "platform", type: "boolean", label: "РџСЂРѕРјРѕРєРѕРґ С‚РѕР»СЊРєРѕ РґР»СЏ РїРµСЂРІРѕРіРѕ Р·Р°РєР°Р·Р°", value: true },
  { key: "referral_v1_referrer_reward", group: "platform", type: "number", label: "Р РµС„РµСЂР°Р»СЊРЅР°СЏ РЅР°РіСЂР°РґР° (СЃСѓРј)", value: 50_000 },
  { key: "referral_v1_invitee_discount", group: "platform", type: "number", label: "РЎРєРёРґРєР° РїСЂРёРіР»Р°С€РµРЅРЅРѕРјСѓ (СЃСѓРј)", value: 100_000 },
  { key: "referral_v1_discount_cap_percent", group: "platform", type: "number", label: "Р›РёРјРёС‚ РѕР±С‰РµР№ СЃРєРёРґРєРё (%)", value: 30 },
  { key: "referral_v1_tiers_enabled", group: "platform", type: "boolean", label: "Tier-СЂРµС„РµСЂР°Р»РєР° РІРєР»СЋС‡РµРЅР°", value: false },
  { key: "feature_score_public", group: "platform", type: "boolean", label: "UNQ Score РїСѓР±Р»РёС‡РЅС‹Р№", value: true },
  { key: "feature_verification", group: "platform", type: "boolean", label: "Р’РµСЂРёС„РёРєР°С†РёСЏ РІРєР»СЋС‡РµРЅР°", value: true },
  { key: "feature_drops", group: "platform", type: "boolean", label: "Р”СЂРѕРїС‹ Р°РєС‚РёРІРЅС‹", value: true },
  { key: "pending_expiry_hours", group: "platform", type: "number", label: "РЎСЂРѕРє pending (С‡Р°СЃС‹)", value: 24 },
  { key: "score_recalc_interval_hours", group: "platform", type: "number", label: "РРЅС‚РµСЂРІР°Р» Score (С‡Р°СЃС‹)", value: 24 },
  { key: "leaderboard_min_views", group: "platform", type: "number", label: "РњРёРЅРёРјСѓРј РїСЂРѕСЃРјРѕС‚СЂРѕРІ", value: 0 },
  { key: "leaderboard_public_count", group: "platform", type: "number", label: "РџСѓР±Р»РёС‡РЅС‹Р№ Р»РёРјРёС‚ Р»РёРґРµСЂРѕРІ", value: 20 },
  {
    key: "referral_tiers",
    group: "platform",
    type: "json",
    label: "РЈСЂРѕРІРЅРё СЂРµС„РµСЂР°Р»РѕРІ",
    value: [
      { friends: 1, reward: "discount_20", label: "РЎРєРёРґРєР° 20%" },
      { friends: 3, reward: "bonus_slug", label: "Р‘РѕРЅСѓСЃРЅС‹Р№ slug" },
      { friends: 5, reward: "bonus_slug", label: "Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ Р±РѕРЅСѓСЃРЅС‹Р№ slug" },
    ],
  },
  { key: "maintenance_mode", group: "platform", type: "boolean", label: "Р РµР¶РёРј РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ", value: false },
  {
    key: "maintenance_message",
    group: "platform",
    type: "textarea",
    label: "РўРµРєСЃС‚ РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ",
    value: "РњС‹ РЅР° С‚РµС…РЅРёС‡РµСЃРєРѕРј РѕР±СЃР»СѓР¶РёРІР°РЅРёРё. РЎРєРѕСЂРѕ РІРµСЂРЅС‘РјСЃСЏ.",
  },
  {
    key: "maintenance_release_report_mode",
    group: "platform",
    type: "boolean",
    label: "РџРѕРєР°Р·С‹РІР°С‚СЊ РѕС‚СЃС‡С‘С‚ РґРѕ СЂРµР»РёР·Р°",
    value: false,
  },
  {
    key: "maintenance_release_report_title",
    group: "platform",
    type: "text",
    label: "Р—Р°РіРѕР»РѕРІРѕРє РѕС‚СЃС‡С‘С‚Р° РґРѕ СЂРµР»РёР·Р°",
    value: "РћС‚СЃС‡С‘С‚ РґРѕ СЂРµР»РёР·Р°",
  },
  {
    key: "maintenance_release_report_message",
    group: "platform",
    type: "textarea",
    label: "РўРµРєСЃС‚ РѕС‚СЃС‡С‘С‚Р° РґРѕ СЂРµР»РёР·Р°",
    value: "РњС‹ РіРѕС‚РѕРІРёРј СЂРµР»РёР· Рё С„РёРЅР°Р»РёР·РёСЂСѓРµРј РїСЂРѕРІРµСЂРєСѓ.\n\nР’ СЌС‚РѕРј РѕС‚СЃС‡С‘С‚Рµ РјРѕР¶РЅРѕ СѓРєР°Р·Р°С‚СЊ С‚РµРєСѓС‰РёР№ СЃС‚Р°С‚СѓСЃ, С‡С‚Рѕ СѓР¶Рµ РіРѕС‚РѕРІРѕ Рё С‡С‚Рѕ РѕСЃС‚Р°Р»РѕСЃСЊ РґРѕ Р·Р°РїСѓСЃРєР°.",
  },
  {
    key: "maintenance_release_open_at",
    group: "platform",
    type: "text",
    label: "Р”Р°С‚Р° Рё РІСЂРµРјСЏ РѕС‚РєСЂС‹С‚РёСЏ СЃР°Р№С‚Р°",
    value: "",
  },
];

const DEFAULT_MAP = new Map(DEFAULT_SETTINGS.map((item) => [item.key, item]));
const cache = new Map();

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function valueEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isSchemaNotReady(error) {
  return Boolean(error) && (error.code === "P2021" || error.code === "P2022");
}

function cacheSet(key, value) {
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: cloneJson(value),
  });
}

function cacheGet(key) {
  const item = cache.get(key);
  if (!item) return undefined;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return cloneJson(item.value);
}

function normalizeType(value) {
  if (value === null) return "text";
  if (Array.isArray(value)) return "json";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object") return "json";
  return "text";
}

function getDefaultSettingDef(key) {
  return DEFAULT_MAP.get(String(key || "")) || null;
}

async function ensurePlatformSettingsSeeded() {
  if (!prisma.platformSetting || typeof prisma.platformSetting.count !== "function") {
    return false;
  }

  try {
    const count = await prisma.platformSetting.count();
    if (count > 0) {
      return false;
    }
    await prisma.$transaction(
      DEFAULT_SETTINGS.map((item) =>
        prisma.platformSetting.create({
          data: {
            key: item.key,
            value: cloneJson(item.value),
            group: item.group,
            label: item.label,
            description: item.description || null,
            type: item.type,
            updatedBy: "system",
          },
        }),
      ),
    );
    return true;
  } catch (error) {
    if (isSchemaNotReady(error)) {
      return false;
    }
    throw error;
  }
}

async function getSettingRow(key) {
  if (!prisma.platformSetting || typeof prisma.platformSetting.findUnique !== "function") {
    return null;
  }
  return prisma.platformSetting.findUnique({ where: { key } });
}

async function getSetting(key, fallback) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    return fallback;
  }

  const cached = cacheGet(normalizedKey);
  if (cached !== undefined) {
    return cached;
  }

  const defaultDef = getDefaultSettingDef(normalizedKey);
  try {
    const row = await getSettingRow(normalizedKey);
    if (row) {
      const settingType = defaultDef?.type || row.type || normalizeType(row.value);
      const normalizedValue = normalizeValueForType(settingType, row.value);
      cacheSet(normalizedKey, normalizedValue);
      return cloneJson(normalizedValue);
    }
  } catch (error) {
    if (!isSchemaNotReady(error)) {
      throw error;
    }
  }

  const value = fallback !== undefined ? fallback : defaultDef ? cloneJson(defaultDef.value) : undefined;
  cacheSet(normalizedKey, value);
  return cloneJson(value);
}

async function getManySettings(keys) {
  const normalized = Array.isArray(keys) ? keys.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!normalized.length) {
    return {};
  }

  const result = {};
  const missing = [];
  for (const key of normalized) {
    const cached = cacheGet(key);
    if (cached !== undefined) {
      result[key] = cached;
    } else {
      missing.push(key);
    }
  }

  if (!missing.length) {
    return result;
  }

  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { in: missing } },
      select: { key: true, value: true },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    for (const key of missing) {
      const defaultDef = getDefaultSettingDef(key);
      const raw = byKey.has(key) ? byKey.get(key) : defaultDef ? cloneJson(defaultDef.value) : undefined;
      const settingType = defaultDef?.type || normalizeType(raw);
      const value = normalizeValueForType(settingType, raw);
      cacheSet(key, value);
      result[key] = cloneJson(value);
    }
  } catch (error) {
    if (!isSchemaNotReady(error)) {
      throw error;
    }
    for (const key of missing) {
      const defaultDef = getDefaultSettingDef(key);
      const value = defaultDef ? cloneJson(defaultDef.value) : undefined;
      cacheSet(key, value);
      result[key] = cloneJson(value);
    }
  }

  return result;
}

async function getSettingsByGroup(group) {
  const normalizedGroup = String(group || "").trim();
  if (!normalizedGroup) return [];
  const defaults = DEFAULT_SETTINGS.filter((item) => item.group === normalizedGroup);
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { group: normalizedGroup },
      orderBy: [{ key: "asc" }],
    });
    if (rows.length) {
      rows.forEach((row) => cacheSet(row.key, row.value));
      const byKey = new Map(rows.map((row) => [row.key, row]));
      const merged = defaults.map((item) => {
        const existing = byKey.get(item.key);
        if (existing) {
          const canonicalType = item.type || existing.type || normalizeType(existing.value);
          return {
            ...existing,
            group: item.group || existing.group,
            type: canonicalType,
            label: item.label || existing.label,
            description: item.description || existing.description || null,
            value: normalizeValueForType(canonicalType, existing.value),
          };
        }
        return {
          key: item.key,
          value: cloneJson(item.value),
          group: item.group,
          label: item.label,
          description: item.description || null,
          type: item.type,
          updatedAt: null,
          updatedBy: "system",
        };
      });
      const extra = rows.filter((row) => !DEFAULT_MAP.has(row.key));
      return [...merged, ...extra];
    }
  } catch (error) {
    if (!isSchemaNotReady(error)) {
      throw error;
    }
  }

  return defaults.map((item) => ({
    key: item.key,
    value: cloneJson(item.value),
    group: item.group,
    label: item.label,
    description: item.description || null,
    type: item.type,
    updatedAt: null,
    updatedBy: "system",
  }));
}

function invalidateSettingsCache(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    cache.clear();
    return;
  }
  keys.forEach((key) => cache.delete(String(key || "")));
}

function normalizeValueForType(type, value) {
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "boolean") {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      if (["false", "0", "off", "no", "РЅРµС‚"].includes(normalized)) return false;
      if (["true", "1", "on", "yes", "РґР°"].includes(normalized)) return true;
    }
    return Boolean(value);
  }
  if (type === "json") {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value == null ? null : value;
  }
  if (type === "textarea" || type === "text" || type === "color") {
    return String(value == null ? "" : value);
  }
  return value;
}

async function setSettingsBatch(group, patch, updatedBy = "system") {
  const normalizedGroup = String(group || "").trim();
  const payload = patch && typeof patch === "object" ? patch : {};
  const keys = Object.keys(payload);
  if (!keys.length) {
    return [];
  }

  const changed = [];
  await prisma.$transaction(async (tx) => {
    for (const key of keys) {
      const defaultDef = getDefaultSettingDef(key);
      const existing = await tx.platformSetting.findUnique({ where: { key } });
      const settingType = defaultDef?.type || existing?.type || normalizeType(payload[key]);
      const nextValue = normalizeValueForType(settingType, payload[key]);
      const previousValue = existing ? existing.value : defaultDef ? defaultDef.value : null;
      const settingGroup = existing?.group || defaultDef?.group || normalizedGroup || "platform";
      const nextLabel = existing?.label || defaultDef?.label || key;
      const nextDescription = existing?.description || defaultDef?.description || null;

      await tx.platformSetting.upsert({
        where: { key },
        create: {
          key,
          value: cloneJson(nextValue),
          group: settingGroup,
          type: settingType,
          label: nextLabel,
          description: nextDescription,
          updatedBy: String(updatedBy || "system"),
        },
        update: {
          value: cloneJson(nextValue),
          group: settingGroup,
          type: settingType,
          label: nextLabel,
          description: nextDescription,
          updatedBy: String(updatedBy || "system"),
        },
      });

      if (!valueEquals(previousValue, nextValue)) {
        changed.push({ key, previousValue, nextValue, group: settingGroup });
        if (tx.platformSettingChange && typeof tx.platformSettingChange.create === "function") {
          await tx.platformSettingChange.create({
            data: {
              settingKey: key,
              group: settingGroup,
              oldValue: cloneJson(previousValue),
              newValue: cloneJson(nextValue),
              changedBy: String(updatedBy || "system"),
            },
          });
        }
      }
    }
  });

  invalidateSettingsCache(keys);
  return changed;
}

async function resetSettingToDefault(key, updatedBy = "system") {
  const normalizedKey = String(key || "").trim();
  const defaultDef = getDefaultSettingDef(normalizedKey);
  if (!defaultDef) {
    return null;
  }
  await setSettingsBatch(defaultDef.group, { [normalizedKey]: cloneJson(defaultDef.value) }, updatedBy);
  const row = await getSettingRow(normalizedKey);
  return row || { ...defaultDef, updatedBy };
}

async function getSettingsChanges({ group, dateFrom, dateTo, page = 1, pageSize = 20 } = {}) {
  if (!prisma.platformSettingChange || typeof prisma.platformSettingChange.findMany !== "function") {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
  const where = {};
  if (group) {
    where.group = String(group);
  }
  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(dateTo) : null;
  if (fromDate || toDate) {
    where.changedAt = {};
    if (fromDate && Number.isFinite(fromDate.getTime())) where.changedAt.gte = fromDate;
    if (toDate && Number.isFinite(toDate.getTime())) where.changedAt.lte = toDate;
  }

  const take = Math.max(1, Math.min(200, Number(pageSize) || 20));
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * take;
  const [total, items] = await Promise.all([
    prisma.platformSettingChange.count({ where }),
    prisma.platformSettingChange.findMany({
      where,
      orderBy: [{ changedAt: "desc" }],
      take,
      skip,
    }),
  ]);
  return {
    items,
    total,
    page: currentPage,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

module.exports = {
  CACHE_TTL_MS,
  DEFAULT_SETTINGS,
  ensurePlatformSettingsSeeded,
  getDefaultSettingDef,
  getSetting,
  getManySettings,
  getSettingsByGroup,
  setSettingsBatch,
  resetSettingToDefault,
  getSettingsChanges,
  invalidateSettingsCache,
};

