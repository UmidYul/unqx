[05.03.2026 0:02] Yuldashev: Add a new "Настройки" section to the admin panel sidebar.
This section controls all platform-wide configurable values.
No hardcoded values anywhere in the codebase — 
everything reads from the settings database table.
No design changes — follow existing admin design system.
Icons from lucide-react only. No emoji.

---

# DATABASE

platform_settings table:
  - key (unique string, e.g. "bracelet_price")
  - value (JSON — handles strings, numbers, arrays, objects)
  - group (e.g. "pricing" | "algorithm" | "plans" | "contacts" | "platform")
  - label (human-readable name shown in admin)
  - description (hint text shown under the field)
  - type ("number" | "text" | "boolean" | "json" | "textarea" | "color")
  - updated_at
  - updated_by (telegram_id of admin who last changed it)

On app startup: seed default values if table is empty.
All settings are cached in memory (or Redis if available)
and refreshed every 60 seconds or on manual save.

---

# SETTINGS PAGE — admin sidebar: "Настройки"

Icon: Settings

Single page with vertical tab navigation on the left,
content on the right.

Tabs:
  Тарифы
  Алгоритм цены slug
  Браслет
  Контакты
  Платформа
  Логи изменений

---

## TAB 1 — ТАРИФЫ

Controls all plan-related values.
Changes apply immediately across the entire platform
including the public landing page pricing section.

### Базовый тариф

Fields:
- Название тарифа
  key: plan_basic_name
  type: text
  default: "Базовый"

- Цена (сум/мес)
  key: plan_basic_price
  type: number
  default: 29000

- Макс. количество slug
  key: plan_basic_slug_limit
  type: number
  default: 1

- Макс. количество кнопок на визитке
  key: plan_basic_button_limit
  type: number
  default: 3

- Макс. количество тегов
  key: plan_basic_tag_limit
  type: number
  default: 3

- Скрыть брендинг UNQ+
  key: plan_basic_hide_branding
  type: boolean
  default: false

- Выбор темы
  key: plan_basic_themes
  type: boolean
  default: false

- Аналитика (дней истории)
  key: plan_basic_analytics_days
  type: number
  default: 7

- Список фич для отображения на сайте
  key: plan_basic_features
  type: json (array of strings)
  Each string = one feature line shown on pricing card
  Editable as dynamic list: add / remove / reorder rows

### Премиум тариф

Same fields as above but for premium:
  key prefix: plan_premium_*
  defaults:
  - Название: "Премиум"
  - Цена: 79000
  - Макс. slug: 3
  - Макс. кнопок: unlimited (0 = no limit)
  - Макс. тегов: 5
  - Скрыть брендинг: true
  - Выбор темы: true
  - Аналитика: 90
  - Список фич: editable array

- Показывать бейдж "ПОПУЛЯРНЫЙ"
  key: plan_premium_popular_badge
  type: boolean
  default: true

### Настройки отображения

- Показывать секцию тарифов на главной странице
  key: pricing_section_visible
  type: boolean
  default: true

- Текст под тарифами (сноска)
  key: pricing_footnote
  type: textarea
  default: "* Стоимость slug оплачивается единоразово при регистрации."

### Save behavior

"Сохранить тарифы" button at bottom of tab.
On save:
- Updates platform_settings table
- Invalidates settings cache
- Landing page pricing section re-renders with new values on next load
- Active user plans are NOT affected — only new purchases use new price
- Show success toast: "Тарифы обновлены"
- Show warning if price changed:
  "Изменение цены не затрагивает существующие подписки"

---

## TAB 2 — АЛГОРИТМ ЦЕНЫ SLUG

Controls the slug price calculation formula.
Changes apply immediately to:
- Hero slug checker
- Calculator section
- Order modal price display
- Admin orders table

### База

- Базовая цена slug (сум)
  key: slug_base_price
  type: number
  default: 100000

### Множители — Буквы

Each multiplier editable as a number input:

- Все буквы одинаковые (AAA, ZZZ)
  key: slug_mult_letters_all_same
  type: number (decimal allowed)
  default: 5

- Буквы по порядку (ABC, XYZ)
  key: slug_mult_letters_sequential
  type: number
  default: 3

- Палиндром букв (ABA, ZAZ)
  key: slug_mult_letters_palindrome
  type: number
  default: 2

- Случайные буквы
  key: slug_mult_letters_random
  type: number
  default: 1
[05.03.2026 0:02] Yuldashev: ### Множители — Цифры

- "000"
  key: slug_mult_digits_zeros
  type: number
  default: 6

- "001"–"009"
  key: slug_mult_digits_near_zero
  type: number
  default: 4

- Все цифры одинаковые (111, 999)
  key: slug_mult_digits_all_same
  type: number
  default: 4

- Цифры по порядку (123, 456)
  key: slug_mult_digits_sequential
  type: number
  default: 3

- Круглые числа (100, 200, 500)
  key: slug_mult_digits_round
  type: number
  default: 2

- Палиндром цифр (121, 696)
  key: slug_mult_digits_palindrome
  type: number
  default: 1.5

- Случайные цифры
  key: slug_mult_digits_random
  type: number
  default: 1

### Live preview

Below all multiplier fields, show a live price preview table.
Updates instantly as admin changes any value.
Shows 6 example slugs with their calculated price:

Slug      | Буквы ×N | Цифры ×N | Итого
AAA000    | ×5       | ×6       | N сум
ZZZ999    | ×5       | ×4       | N сум
ABC123    | ×3       | ×3       | N сум
ABA001    | ×2       | ×4       | N сум
XYZ500    | ×1       | ×2       | N сум
ABX374    | ×1       | ×1       | N сум

### Save behavior

"Сохранить алгоритм" button.
On save:
- Updates platform_settings
- Invalidates cache
- Show warning:
  "Изменение алгоритма не пересчитывает уже одобренные заявки.
   Новые цены применяются только к новым заявкам."
- Show success toast: "Алгоритм обновлён"

---

## TAB 3 — БРАСЛЕТ

- Название товара
  key: bracelet_name
  type: text
  default: "NFC-браслет"

- Цена (сум)
  key: bracelet_price
  type: number
  default: 300000

- Статус наличия
  key: bracelet_in_stock
  type: boolean
  default: true
  Label shown on site when true: "В наличии"
  Label shown when false: "Нет в наличии"
  When false: bracelet checkbox in order modal is disabled
  with text "Временно нет в наличии"

- Текст кнопки заказа
  key: bracelet_cta_text
  type: text
  default: "Заказать браслет"

- Список преимуществ браслета
  key: bracelet_features
  type: json (array of strings)
  Editable as dynamic list: add / remove / reorder
  These render as the feature list in the WHOOP/bracelet section

- Описание (подзаголовок секции на сайте)
  key: bracelet_description
  type: textarea

- Примечание под кнопкой заказа
  key: bracelet_note
  type: text
  default: "Браслет привязан к твоему slug — работает только с активной визиткой UNQ+"

### Save behavior

"Сохранить" button.
On save → landing page bracelet section updates on next load.
Success toast: "Данные браслета обновлены"

---

## TAB 4 — КОНТАКТЫ

All organization contact info used across the platform.

- Telegram бот (username)
  key: contact_telegram_bot
  type: text
  default: "@unqx_bot"
  Used in: order notifications, user messages

- Telegram канал (username)
  key: contact_telegram_channel
  type: text
  default: "@unqx_uz"
  Used in: flash sale notifications, drop announcements

- Telegram для заказов (chat_id)
  key: contact_telegram_chat_id
  type: text
  Used in: sendMessage API calls for all order notifications

- Telegram поддержка (username)
  key: contact_support_telegram
  type: text
  Used in: error messages, fallback contact across site

- Email (если есть)
  key: contact_email
  type: text

- Адрес
  key: contact_address
  type: text
  default: "Ташкент, Узбекистан"
  Used in: footer, bracelet section delivery text

- Время ответа (текст)
  key: contact_response_time
  type: text
  default: "в течение 15 минут"
  Used in: order form subtitle
  "Заполни форму — мы свяжемся [contact_response_time]"

- Текст для ошибки отправки заявки
  key: contact_error_fallback
  type: text
  default: "Напиши нам напрямую: @unqx_uz"
  Shown when Telegram message fails to send

### Save behavior

"Сохранить контакты" button.
On save → all Telegram API calls across the platform
use new values immediately (no restart needed).
Success toast: "Контакты обновлены"

---

## TAB 5 — ПЛАТФОРМА

General platform-wide toggles and content.

### Основное

- Название платформы
  key: platform_name
  type: text
  default: "UNQ+"

- Слоган (tagline)
  key: platform_tagline
  type: text
  default: "Твой UNQ. Твой бренд. Навсегда."
[05.03.2026 0:02] Yuldashev: - Подзаголовок hero
  key: platform_hero_subtitle
  type: textarea

- Всего slug на платформе
  key: platform_total_slugs
  type: number
  default: 17576
  Used in: hero counter, directory, leaderboard

### Функции (вкл/выкл)

Each is a toggle with label and description:

- Directory включён
  key: feature_directory
  default: true

- Лидерборд включён
  key: feature_leaderboard
  default: true

- Реферальная программа включена
  key: feature_referrals
  default: true

- UNQ Score показывается на визитках
  key: feature_score_public
  default: true

- Верификация принимает заявки
  key: feature_verification
  default: true

- Дропы активны
  key: feature_drops
  default: true

### Технические настройки

- Срок жизни pending заявки (часов)
  key: pending_expiry_hours
  type: number
  default: 24

- Интервал пересчёта Score (часов)
  key: score_recalc_interval_hours
  type: number
  default: 24

- Минимум просмотров для попадания в лидерборд
  key: leaderboard_min_views
  type: number
  default: 0

- Количество позиций в публичном лидерборде
  key: leaderboard_public_count
  type: number
  default: 20

- Реферальная программа — за N друзей (уровни)
  key: referral_tiers
  type: json
  default:
  [
    { "friends": 1, "reward": "discount_20", "label": "Скидка 20% на месяц" },
    { "friends": 3, "reward": "free_month",  "label": "1 месяц бесплатно" },
    { "friends": 5, "reward": "bonus_slug",  "label": "Бонусный slug" }
  ]
  Editable as structured list in admin

### Режим обслуживания

- Включить режим обслуживания
  key: maintenance_mode
  type: boolean
  default: false

- Текст на странице обслуживания
  key: maintenance_message
  type: textarea
  default: "Мы на техническом обслуживании. Скоро вернёмся."

When maintenance_mode = true:
  All public pages show maintenance screen
  Admin panel remains accessible
  Show red warning banner at top of admin:
  "Режим обслуживания включён — сайт недоступен для пользователей"
  with "Отключить" button inline

---

## TAB 6 — ЛОГ ИЗМЕНЕНИЙ

Read-only table of all settings changes.

Columns:
Дата | Настройка | Было | Стало | Кто изменил

- "Было" and "Стало" show the actual values (truncated if long)
- "Кто изменил" shows admin name + telegram username
- Filter by: группа настроек, дата
- Last 200 changes shown, paginated

---

# HOW SETTINGS ARE USED IN CODE

Replace every hardcoded value in the codebase
with a settings lookup:

Instead of:
  const BASE_PRICE = 100000

Use:
  const BASE_PRICE = await getSetting('slug_base_price')

Create a single getSetting(key) helper function:
  1. Check in-memory cache
  2. If cache miss or expired → query database
  3. Update cache
  4. Return value parsed from JSON

Cache TTL: 60 seconds
On admin save: immediately clear cache for updated keys

All components that display prices, plan features,
contact info, or platform toggles must read from settings,
never from hardcoded constants.

---

# LANDING PAGE SYNC

The following landing page sections must re-render
with values from settings on every page load:

Pricing section:
  Plan names, prices, features lists, footnote text
  Read from: plan_basic_*, plan_premium_*

Bracelet section:
  Price, features list, availability badge, CTA text, note
  Read from: bracelet_*

Hero section:
  Tagline, subtitle
  Read from: platform_tagline, platform_hero_subtitle

Slug checker counter:
  Total slugs number
  Read from: platform_total_slugs

Contact references:
  Support username, response time, error fallback
  Read from: contact_*

---

# NOTES
[05.03.2026 0:02] Yuldashev: - Settings page requires admin authentication
- Invalid values (negative prices, zero limits) show
  inline validation error and block save
- Number fields: min/max validation where logical
  e.g. pending_expiry_hours: min 1, max 168
  e.g. multipliers: min 0.1, max 100
- Boolean toggles use existing toggle/switch component
- Dynamic lists (features, referral tiers) have
  drag-to-reorder, add button at bottom, delete per row
- All settings have a reset to default button per field
  small "Сбросить" link below the input
- "Сохранить" is per-tab, not global
  Unsaved changes show a dot indicator on the tab label
- Navigating away with unsaved changes shows confirmation:
  "Есть несохранённые изменения. Уйти?"