const { prisma } = require("../db/prisma");
const { env } = require("../config/env");

const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_SETTINGS = [
  {
    key: "slug_pricing_custom_rules",
    group: "algorithm",
    type: "json",
    label: "Кастомные правила ценообразования slug (массив объектов: {pattern, type, delta, label})",
    value: [
      // Пример: если slug содержит UZB, добавить 1 млн сум
      { pattern: "UZB", type: "contains", delta: 1000000, label: "+1 млн за UZB" }
    ],
  },
  { key: "plan_basic_name", group: "pricing", type: "text", label: "Название базового тарифа", value: "Базовый" },
  { key: "plan_basic_price", group: "pricing", type: "number", label: "Цена базового тарифа", value: 130_000 },
  { key: "plan_basic_slug_limit", group: "pricing", type: "number", label: "Лимит slug (базовый)", value: 1 },
  { key: "plan_basic_button_limit", group: "pricing", type: "number", label: "Лимит кнопок (базовый)", value: 3 },
  { key: "plan_basic_tag_limit", group: "pricing", type: "number", label: "Лимит тегов (базовый)", value: 3 },
  { key: "plan_basic_hide_branding", group: "pricing", type: "boolean", label: "Скрыть брендинг (базовый)", value: false },
  { key: "plan_basic_themes", group: "pricing", type: "boolean", label: "Темы (базовый)", value: false },
  { key: "plan_basic_analytics_days", group: "pricing", type: "number", label: "Аналитика дней (базовый)", value: 7 },
  {
    key: "plan_basic_features",
    group: "pricing",
    type: "json",
    label: "Фичи базового тарифа",
    value: ["1 цифровая визитка", "До 3 кнопок", "Стандартный шаблон", "QR-код", "Базовая аналитика"],
  },
  {
    key: "plan_basic_excluded_features",
    group: "pricing",
    type: "json",
    label: "Недоступно в базовом тарифе",
    value: ["Выбор темы", "Кастомные цвета", "Скрыть брендинг UNQX", "Больше 3 кнопок"],
  },
  { key: "plan_premium_name", group: "pricing", type: "text", label: "Название премиум тарифа", value: "Премиум" },
  { key: "plan_premium_price", group: "pricing", type: "number", label: "Цена премиум тарифа", value: 130_000 },
  { key: "plan_premium_upgrade_price", group: "pricing", type: "number", label: "Цена апгрейда до премиум", value: 130_000 },
  { key: "plan_premium_monthly_price_usd", group: "pricing", type: "number", label: "Premium monthly price USD", value: 2 },
  { key: "plan_premium_monthly_price_uzs", group: "pricing", type: "number", label: "Premium monthly price UZS", value: 130_000 },
  { key: "plan_premium_slug_limit", group: "pricing", type: "number", label: "Лимит slug (премиум)", value: 3 },
  { key: "plan_premium_button_limit", group: "pricing", type: "number", label: "Лимит кнопок (премиум)", value: 9 },
  { key: "plan_premium_tag_limit", group: "pricing", type: "number", label: "Лимит тегов (премиум)", value: 5 },
  { key: "plan_premium_hide_branding", group: "pricing", type: "boolean", label: "Скрыть брендинг (премиум)", value: true },
  { key: "plan_premium_themes", group: "pricing", type: "boolean", label: "Темы (премиум)", value: true },
  { key: "plan_premium_analytics_days", group: "pricing", type: "number", label: "Аналитика дней (премиум)", value: 90 },
  {
    key: "plan_premium_features",
    group: "pricing",
    type: "json",
    label: "Фичи премиум тарифа",
    value: [
      "1 цифровая визитка",
      "Выбор темы (5+ тем)",
      "Кастомные цвета и фон",
      "До 9 кнопок",
      "Расширенная аналитика (динамика по дням)",
      "Скрыть брендинг UNQX",
      "QR-код + NFC поддержка",
      "Приоритетная поддержка",
    ],
  },
  {
    key: "plan_premium_excluded_features",
    group: "pricing",
    type: "json",
    label: "Недоступно в премиум тарифе",
    value: [],
  },
  { key: "plan_premium_popular_badge", group: "pricing", type: "boolean", label: "Бейдж популярного", value: true },
  { key: "pet_kitten_price", group: "pricing", type: "number", label: "Цена питомца: Котенок", value: 2_000_000 },
  { key: "pet_puppy_price", group: "pricing", type: "number", label: "Цена питомца: Песик", value: 5_000_000 },
  { key: "pet_snake_price", group: "pricing", type: "number", label: "Цена питомца: Змея", value: 7_000_000 },
  { key: "pricing_section_visible", group: "pricing", type: "boolean", label: "Показывать секцию тарифов", value: true },
  {
    key: "pricing_footnote",
    group: "pricing",
    type: "textarea",
    label: "Подпись под тарифами",
    value: "Premium-подписка оплачивается ежемесячно. Без автосписаний.",
  },
  {
    key: "payment_provider",
    group: "pricing",
    type: "text",
    label: "Провайдер оплаты",
    value: "manual_tg",
  },
  {
    key: "payment_manual_instructions",
    group: "pricing",
    type: "textarea",
    label: "Инструкции для ручной оплаты",
    value: "Оплата обрабатывается админом в Telegram. После перевода отправьте подтверждение менеджеру.",
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
  { key: "slug_base_price", group: "algorithm", type: "number", label: "Базовая цена slug", value: 100_000 },
  { key: "slug_mult_letters_all_same", group: "algorithm", type: "number", label: "Буквы все одинаковые", value: 5 },
  { key: "slug_mult_letters_sequential", group: "algorithm", type: "number", label: "Буквы по порядку", value: 3 },
  { key: "slug_mult_letters_palindrome", group: "algorithm", type: "number", label: "Палиндром букв", value: 2 },
  { key: "slug_mult_letters_random", group: "algorithm", type: "number", label: "Случайные буквы", value: 1 },
  { key: "slug_mult_digits_zeros", group: "algorithm", type: "number", label: "000", value: 6 },
  { key: "slug_mult_digits_near_zero", group: "algorithm", type: "number", label: "001-009", value: 4 },
  { key: "slug_mult_digits_all_same", group: "algorithm", type: "number", label: "Цифры все одинаковые", value: 4 },
  { key: "slug_mult_digits_sequential", group: "algorithm", type: "number", label: "Цифры по порядку", value: 3 },
  { key: "slug_mult_digits_round", group: "algorithm", type: "number", label: "Круглые числа", value: 2 },
  { key: "slug_mult_digits_palindrome", group: "algorithm", type: "number", label: "Палиндром цифр", value: 1.5 },
  { key: "slug_mult_digits_random", group: "algorithm", type: "number", label: "Случайные цифры", value: 1 },
  { key: "bracelet_name", group: "bracelet", type: "text", label: "Название NFC-стикера", value: "NFC-стикер" },
  { key: "bracelet_old_price", group: "bracelet", type: "number", label: "Старая цена (до скидки)", value: 400_000 },
  { key: "bracelet_price", group: "bracelet", type: "number", label: "Цена со скидкой", value: 250_000 },
  { key: "bracelet_in_stock", group: "bracelet", type: "boolean", label: "Наличие стикера", value: true },
  { key: "bracelet_cta_text", group: "bracelet", type: "text", label: "Кнопка стикера", value: "Заказать стикер" },
  {
    key: "bracelet_features",
    group: "bracelet",
    type: "json",
    label: "Преимущества стикера",
    value: [
      "Тап по стикеру - моментально открывается unqx.uz/UNQ",
      "Работает с любым смартфоном - iOS и Android",
      "NFC работает пассивно и не требует зарядки",
      "Клеится на любую поверхность",
    ],
  },
  {
    key: "bracelet_description",
    group: "bracelet",
    type: "textarea",
    label: "Описание стикера",
    value: "Компактный NFC-стикер, который клеится на любую поверхность и открывает твою цифровую визитку в один тап.",
  },
  {
    key: "bracelet_note",
    group: "bracelet",
    type: "text",
    label: "Примечание стикера",
    value: "Стикер привязан к твоему slug - работает только с активной визиткой UNQX",
  },
  { key: "contact_telegram_bot", group: "contacts", type: "text", label: "Telegram бот", value: "@unqx_bot" },
  { key: "contact_telegram_channel", group: "contacts", type: "text", label: "Telegram канал", value: "@unqx_uz" },
  { key: "contact_telegram_chat_id", group: "contacts", type: "text", label: "Telegram chat id", value: env.TELEGRAM_CHAT_ID || "" },
  { key: "contact_support_telegram", group: "contacts", type: "text", label: "Telegram поддержка", value: "@unqx_uz" },
  { key: "contact_phone", group: "contacts", type: "text", label: "Телефон", value: "" },
  { key: "contact_email", group: "contacts", type: "text", label: "Email", value: "" },
  { key: "contact_address", group: "contacts", type: "text", label: "Адрес", value: "Ташкент, Узбекистан" },
  { key: "contact_response_time", group: "contacts", type: "text", label: "Время ответа", value: "в течение 15 минут" },
  { key: "contact_error_fallback", group: "contacts", type: "text", label: "Фоллбек ошибки", value: "Напиши нам напрямую: @unqx_uz" },
  { key: "platform_name", group: "platform", type: "text", label: "Название платформы", value: "UNQX" },
  { key: "platform_tagline", group: "platform", type: "text", label: "Слоган", value: "Твой UNQ. Твой бренд. Навсегда." },
  { key: "platform_hero_subtitle", group: "platform", type: "textarea", label: "Подзаголовок hero", value: "Цифровая визитка за 1 минуту - одна ссылка вместо тысячи слов." },
  { key: "platform_total_slugs", group: "platform", type: "number", label: "Всего slug", value: 17_576 },
  {
    key: "platform_today_visitors_adjustment",
    group: "platform",
    type: "json",
    label: "Служебная надбавка к посетителям сегодня",
    description: "Системное поле для ручной корректировки счётчика посетителей за текущие UTC-сутки.",
    value: { date: "", amount: 0 },
  },
  { key: "feature_directory", group: "platform", type: "boolean", label: "Directory включен", value: true },
  { key: "feature_leaderboard", group: "platform", type: "boolean", label: "Лидерборд включен", value: true },
  { key: "feature_referrals", group: "platform", type: "boolean", label: "Рефералы включены", value: true },
  { key: "feature_promo_codes", group: "platform", type: "boolean", label: "Промокоды включены", value: true },
  { key: "promo_codes_first_order_only", group: "platform", type: "boolean", label: "Промокод только для первого заказа", value: true },
  { key: "referral_v1_referrer_reward", group: "platform", type: "number", label: "Реферальная награда (сум)", value: 50_000 },
  { key: "referral_v1_invitee_discount", group: "platform", type: "number", label: "Скидка приглашенному (сум)", value: 100_000 },
  { key: "referral_v1_discount_cap_percent", group: "platform", type: "number", label: "Лимит общей скидки (%)", value: 30 },
  { key: "referral_v1_tiers_enabled", group: "platform", type: "boolean", label: "Tier-рефералка включена", value: false },
  { key: "feature_score_public", group: "platform", type: "boolean", label: "UNQ Score публичный", value: true },
  { key: "feature_verification", group: "platform", type: "boolean", label: "Верификация включена", value: true },
  { key: "feature_drops", group: "platform", type: "boolean", label: "Дропы активны", value: true },
  { key: "pending_expiry_hours", group: "platform", type: "number", label: "Срок pending (часы)", value: 24 },
  { key: "score_recalc_interval_hours", group: "platform", type: "number", label: "Интервал Score (часы)", value: 24 },
  { key: "leaderboard_min_views", group: "platform", type: "number", label: "Минимум просмотров", value: 0 },
  { key: "leaderboard_public_count", group: "platform", type: "number", label: "Публичный лимит лидеров", value: 20 },
  {
    key: "referral_tiers",
    group: "platform",
    type: "json",
    label: "Уровни рефералов",
    value: [
      { friends: 1, reward: "discount_20", label: "Скидка 20%" },
      { friends: 3, reward: "bonus_slug", label: "Бонусный slug" },
      { friends: 5, reward: "bonus_slug", label: "Дополнительный бонусный slug" },
    ],
  },
  { key: "maintenance_mode", group: "platform", type: "boolean", label: "Режим обслуживания", value: false },
  {
    key: "maintenance_message",
    group: "platform",
    type: "textarea",
    label: "Текст обслуживания",
    value: "Мы на техническом обслуживании. Скоро вернёмся.",
  },
  {
    key: "maintenance_release_report_mode",
    group: "platform",
    type: "boolean",
    label: "Показывать отсчёт до релиза",
    value: false,
  },
  {
    key: "maintenance_release_report_title",
    group: "platform",
    type: "text",
    label: "Заголовок отсчёта до релиза",
    value: "Отсчёт до релиза",
  },
  {
    key: "maintenance_release_report_message",
    group: "platform",
    type: "textarea",
    label: "Текст отсчёта до релиза",
    value: "Мы готовим релиз и финализируем проверку.\n\nВ этом отсчёте можно указать текущий статус, что уже готово и что осталось до запуска.",
  },
  {
    key: "maintenance_release_open_at",
    group: "platform",
    type: "text",
    label: "Дата и время открытия сайта",
    value: "",
  },
  {
    key: "official_unq_letter_prefixes",
    group: "official_unq",
    type: "json",
    label: "Префиксы букв UNQ (официальный / гос сегмент)",
    description: "Три латинские буквы на элемент (DAV, UZB, ...). Учитываются только буквы, цифры любые.",
    value: ["DAV", "PPP", "PAA", "UZB"],
  },
  {
    key: "official_unq_calculator_hint",
    group: "official_unq",
    type: "textarea",
    label: "Подсказка под калькулятором на главной",
    description: "Пустое значение скрывает блок.",
    value:
      "Серии вроде госномеров (определённые три буквы латиницы) резервируются только по согласованию с администрацией и руководством проекта.",
  },
  {
    key: "official_unq_purchase_notice_title",
    group: "official_unq",
    type: "text",
    label: "Заголовок предупреждения перед покупкой",
    value: "Официальная серия",
  },
  {
    key: "official_unq_purchase_notice_body",
    group: "official_unq",
    type: "textarea",
    label: "Текст предупреждения перед покупкой",
    value:
      "Такой UNQ можно приобрести только после согласования с администрацией и руководством UNQX. Эти буквенные комбинации предназначены для ограниченного круга владельцев.",
  },
  {
    key: "official_unq_profile_badge_title",
    group: "official_unq",
    type: "text",
    label: "Заголовок пометки на визитке",
    value: "Официальная серия UNQ",
  },
  {
    key: "official_unq_profile_badge_line",
    group: "official_unq",
    type: "textarea",
    label: "Текст пометки на визитке",
    value: "Закрепление согласовано с администрацией и руководством платформы.",
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
      if (["false", "0", "off", "no", "нет"].includes(normalized)) return false;
      if (["true", "1", "on", "yes", "да"].includes(normalized)) return true;
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

