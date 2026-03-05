# Техническое задание — UNQX Digital Business Card Platform
**Версия:** 1.1 | **Обновлено:** 2026

---

## 1. Обзор проекта

**UNQX** — платформа для создания цифровых визиток.

- Администратор создаёт визитки через панель управления
- Каждая визитка доступна по уникальному URL: `unqx.uz/AAA001`
- Страница содержит аватар, имя, телефон, теги-ссылки и анимированные кнопки

---

## 2. Маршруты приложения

| URL | Описание | Доступ |
|---|---|---|
| `unqx.uz/:slug` | Публичная визитка клиента | Все |
| `unqx.uz/admin` | Вход в панель | Только админ |
| `unqx.uz/admin/dashboard` | Список всех визиток | Только админ |
| `unqx.uz/admin/cards/new` | Создать визитку | Только админ |
| `unqx.uz/admin/cards/:id/edit` | Редактировать визитку | Только админ |
| `unqx.uz/admin/stats` | Общая статистика | Только админ |

---

## 3. База данных (PostgreSQL + Prisma)

### Таблица `cards` — Визитки

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `id` | UUID | ✅ | Primary key |
| `slug` | VARCHAR(20) UNIQUE | ✅ | Код визитки (AAA001) |
| `is_active` | BOOLEAN | ✅ | Включена / выключена |
| `avatar_url` | TEXT | — | Путь к файлу на сервере `/uploads/avatars/...` |
| `name` | VARCHAR(100) | ✅ | Имя клиента |
| `phone` | VARCHAR(30) | ✅ | Основной телефон |
| `verified` | BOOLEAN | ✅ | Синяя галочка ✓ |
| `hashtag` | VARCHAR(50) | — | Нижний хэштег (#UnqPower2026) |
| `address` | TEXT | — | Адрес |
| `postcode` | VARCHAR(20) | — | Индекс |
| `email` | VARCHAR(100) | — | Email |
| `extra_phone` | VARCHAR(30) | — | Доп. телефон |
| `views_count` | INTEGER | ✅ | Счётчик просмотров (default 0) |
| `created_at` | TIMESTAMP | ✅ | Дата создания |
| `updated_at` | TIMESTAMP | ✅ | Дата последнего изменения |

### Таблица `tags` — Теги-ссылки под именем

> ⚠️ Это не «tagline» (просто текст), а кликабельные теги-ссылки.
> На визитке отображаются как: `*Top Dawg · ALBLAK 52 · ICEGERGERT`
> Каждый тег — отдельная кликабельная ссылка.

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `id` | UUID | ✅ | Primary key |
| `card_id` | UUID | ✅ | FK → cards.id |
| `label` | VARCHAR(50) | ✅ | Текст тега (Top Dawg) |
| `url` | TEXT | — | Ссылка (если нет — тег не кликабелен) |
| `sort_order` | INTEGER | ✅ | Порядок отображения |

### Таблица `buttons` — Кнопки на визитке

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `id` | UUID | ✅ | Primary key |
| `card_id` | UUID | ✅ | FK → cards.id |
| `label` | VARCHAR(50) | ✅ | Текст кнопки (TELEGRAM, CLICK...) |
| `url` | TEXT | ✅ | Произвольная ссылка |
| `sort_order` | INTEGER | ✅ | Порядок отображения |
| `is_active` | BOOLEAN | ✅ | Показывать / скрывать |

### Таблица `views_log` — Лог просмотров

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID | Primary key |
| `card_id` | UUID | FK → cards.id |
| `viewed_at` | TIMESTAMP | Время просмотра |
| `device` | VARCHAR(20) | mobile / desktop |

---

## 4. Хранилище файлов — Локальное

Аватары хранятся на сервере в папке `/public/uploads/avatars/`.

- При загрузке: файл сохраняется на диск, в БД пишется путь `/uploads/avatars/{slug}.jpg`
- При замене аватара: старый файл удаляется
- При удалении визитки: файл аватара удаляется вместе с записью
- Разрешённые форматы: JPG, PNG, WEBP
- Максимальный размер: 5MB
- После обрезки сохранять в WEBP 400×400px (оптимально для web)

**Структура папок на сервере:**
```
/public
  /uploads
    /avatars
      AAA001.webp
      BBB002.webp
      ...
```

---

## 5. Публичная визитка `/:slug`

### Структура страницы (сверху вниз)
1. Код визитки `#AAA001` — серый, мелкий шрифт
2. Логотип **UNQX** / *powered by scxr*
3. Декоративные SVG молнии по углам
4. Аватар — круглый, с синей галочкой если `verified = true`
5. Имя + основной телефон
6. **Теги-ссылки** — строка кликабельных тегов через `·` (из таблицы `tags`)
7. **Анимированные кнопки-ссылки** (см. раздел 5.1)
8. Нижний хэштег
9. Блок **About info** — адрес, индекс, email, доп. телефон

### 5.1 Анимация кнопок — «Блик»

На каждой кнопке — **постоянная бегущая анимация блика** (shimmer/glare effect).

**Описание эффекта:**
- Полупрозрачная белая полоса (~20% ширины кнопки) скользит слева направо
- Анимация бесконечная, зацикленная
- Угол полосы ~30–45 градусов (как отблеск на стекле)
- Скорость: 2.5–3 секунды на один проход
- Задержка между проходами: 1–1.5 секунды (пауза после каждого цикла)

**CSS-реализация:**
```css
@keyframes shimmer {
  0%   { transform: translateX(-100%) skewX(-20deg); }
  100% { transform: translateX(400%) skewX(-20deg); }
}

.btn-shimmer {
  position: relative;
  overflow: hidden;
}

.btn-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 25%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.18) 50%,
    transparent 100%
  );
  animation: shimmer 2.5s ease-in-out infinite;
  animation-delay: 1s;
}
```

### 5.2 Теги-ссылки

```
*Top Dawg · ALBLAK 52 · ICEGERGERT
```

- Каждый тег — отдельный элемент из таблицы `tags`
- Разделяются символом ` · ` (средняя точка)
- Если у тега есть `url` → кликабелен, открывается в новой вкладке
- Если `url` пустой → просто текст, не кликабелен
- Первый тег может иметь `*` в начале (звёздочка) — хранить как часть `label`

### 5.3 Общая функциональность
- При загрузке страницы: `views_count + 1`, запись в `views_log`
- Определение устройства (mobile/desktop) по User-Agent
- Кнопка **«Сохранить контакт»** → генерация `.vcf` файла
- Кнопка **«Поделиться»** → Web Share API
- Если `is_active = false` → страница «Визитка недоступна»
- Meta OG теги: `og:title` = имя, `og:image` = аватар, `og:description` = телефон

---

## 6. Панель администратора `/admin`

### 6.1 Авторизация — NextAuth.js

- **Provider:** Credentials (логин + пароль)
- Один аккаунт администратора, данные в `.env`:
  ```
  ADMIN_LOGIN=admin
  ADMIN_PASSWORD_HASH=bcrypt_hash
  ```
- JWT-сессия в httpOnly cookie
- Все `/admin/*` маршруты закрыты через NextAuth middleware
- Страница входа: `/admin` — форма логин/пароль
- Кнопка «Выйти» → `signOut()`

---

### 6.2 Дашборд — Список визиток

**Таблица:**

| Столбец | Описание |
|---|---|
| Slug | Кликабельный, открывает визитку в новой вкладке |
| Имя клиента | — |
| Статус | Toggle: Активна / Неактивна |
| Просмотры | Число из `views_count` |
| Создана | Дата |
| Действия | Редактировать · QR-код · Удалить |

**Инструменты:**
- Поиск по slug или имени
- Фильтр: Все / Активные / Неактивные
- Кнопка **«+ Создать визитку»**
- Пагинация по 20 записей

---

### 6.3 Форма создания / редактирования визитки

#### Блок «Основные данные»
- **Slug** — текстовое поле + кнопка «Авто-генерировать» (уникальный код)
- **Статус** — toggle «Активна»
- **Аватар** — drag & drop загрузка → обрезка по кругу → сохранение локально
- **Имя клиента** — обязательное
- **Телефон** — обязательное
- **Верифицирован** — чекбокс
- **Нижний хэштег** — необязательное

#### Блок «Теги-ссылки» (под именем на визитке)
- Список тегов с drag-and-drop сортировкой
- Каждый тег:
  - Поле **«Текст тега»** (Top Dawg, ALBLAK 52...)
  - Поле **«Ссылка»** — необязательное (если пусто — тег без ссылки)
  - Кнопка удалить ✕
- Кнопка **«+ Добавить тег»**
- Предпросмотр строки: `*Top Dawg · ALBLAK 52 · ICEGERGERT`

#### Блок «Кнопки»
- Список кнопок с drag-and-drop сортировкой
- Каждая кнопка:
  - Поле **«Текст кнопки»** (TELEGRAM, INSTAGRAM, CLICK — любой)
  - Поле **«Ссылка»** (любой URL)
  - Toggle «Показывать»
  - Кнопка удалить ✕
- Кнопка **«+ Добавить кнопку»**

#### Блок «Контактная информация»
- Адрес
- Индекс (Postcode)
- Email
- Дополнительный телефон

#### Панель действий
- **«Сохранить»** — валидация + сохранение
- **«Предпросмотр»** — открывает визитку в новой вкладке
- **«Отмена»** — возврат к списку

---

### 6.4 QR-код (модальное окно)

- QR кодирует URL: `https://unqx.uz/AAA001`
- Логотип **UNQX** поверх QR-кода в центре
- Скачать **PNG** (1000×1000px)
- Скачать **SVG**

---

### 6.5 Статистика визитки

Блок внутри формы редактирования:
- Всего просмотров
- За последние 7 дней — бар-чарт (Recharts)
- Последний просмотр — дата и время
- Разбивка: mobile / desktop (если есть данные в `views_log`)

---

### 6.6 Общая статистика `/admin/stats`

- Итого визиток / активных
- Итого просмотров по всем визиткам
- Топ-10 визиток по просмотрам
- График просмотров по дням за последние 30 дней (Recharts, все визитки)

---

## 7. Технический стек

| Компонент | Инструмент |
|---|---|
| Framework | Next.js 14 (App Router) |
| Язык | TypeScript |
| БД | PostgreSQL |
| ORM | Prisma |
| Стили | Tailwind CSS |
| Авторизация | **NextAuth.js** (Credentials) |
| Хранилище файлов | **Локальное** (`/public/uploads/`) |
| Drag & Drop | @dnd-kit/sortable |
| QR-коды | qrcode.react |
| Обрезка фото | react-image-crop |
| Графики | Recharts |
| Анимации кнопок | CSS `@keyframes shimmer` (без JS) |

---

## 8. Переменные окружения `.env`

```env
# База данных
DATABASE_URL="postgresql://user:password@localhost:5432/unqplus"

# NextAuth
NEXTAUTH_URL="https://unqx.uz"
NEXTAUTH_SECRET="your-secret-key"

# Логин администратора
ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH="$2b$10$..."  # bcrypt hash
```

---

## 9. Промпт для AI-разработки

```
Создай full-stack веб-приложение "UNQX Digital Business Cards" на Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + Tailwind CSS.

=== ПУБЛИЧНАЯ ВИЗИТКА (GET /[slug]) ===
- SSR страница, данные из БД по slug
- Элементы сверху вниз:
  1. Код #SLUG серым
  2. Логотип UNQX / powered by scxr
  3. SVG молнии по углам
  4. Круглый аватар (синяя галочка если verified=true)
  5. Имя + телефон
  6. Теги-ссылки через · (кликабельные если есть url, иначе просто текст)
  7. Кнопки-ссылки с анимацией блика
  8. Нижний хэштег
  9. About info: адрес, индекс, email, доп.телефон
- При загрузке: views_count++ + запись в views_log (device из User-Agent)
- Кнопка «Сохранить контакт» → .vcf файл
- Кнопка «Поделиться» → Web Share API
- Meta OG теги: og:title=имя, og:image=аватар, og:description=телефон
- Если is_active=false → страница «Визитка недоступна»

=== АНИМАЦИЯ КНОПОК (Shimmer/Блик) ===
- На каждой кнопке — постоянная бегущая анимация блика через CSS ::after псевдоэлемент
- Белая полупрозрачная полоса скользит слева направо под углом ~30°
- Бесконечная зацикленная анимация, 2.5s + пауза 1s между проходами
- Реализовать через @keyframes shimmer в globals.css, класс .btn-shimmer

=== ТЕГИ-ССЫЛКИ ===
- Отдельная таблица tags: id, card_id, label, url (опционально), sort_order
- На визитке рендерятся через · разделитель
- Если url есть → <a target="_blank">, если нет → <span>

=== АВТОРИЗАЦИЯ (NextAuth.js Credentials) ===
- Один администратор, логин/хэш пароля из .env
- JWT сессия в httpOnly cookie
- Middleware защищает все /admin/* маршруты
- Страница /admin — форма входа

=== ПАНЕЛЬ АДМИНИСТРАТОРА ===
/admin/dashboard:
- Таблица визиток: slug (ссылка в новой вкладке), имя, toggle is_active, views_count, created_at, кнопки (редактировать, QR, удалить)
- Поиск по slug/имени, фильтр по статусу, пагинация по 20

/admin/cards/new и /admin/cards/:id/edit:
- Форма с блоками: Основные данные, Теги-ссылки, Кнопки, Контакты
- Загрузка аватара: drag&drop → react-image-crop (круг) → сохранение в /public/uploads/avatars/{slug}.webp (400x400px)
- При замене/удалении визитки — удалять файл аватара с диска
- Drag-and-drop сортировка тегов и кнопок (@dnd-kit/sortable)
- Блок статистики: просмотры всего, за 7 дней (Recharts бар-чарт), последний просмотр, mobile/desktop разбивка

/admin/stats:
- Суммарная статистика по всем визиткам
- Топ-10 по просмотрам
- График за 30 дней (Recharts)

QR-код (модальное окно из кнопки в таблице):
- qrcode.react, кодирует https://unqx.uz/{slug}
- Логотип UNQX в центре
- Скачать PNG 1000x1000 и SVG

=== PRISMA SCHEMA ===
model Card {
  id         String    @id @default(uuid())
  slug       String    @unique
  isActive   Boolean   @default(true)
  avatarUrl  String?
  name       String
  phone      String
  verified   Boolean   @default(false)
  hashtag    String?
  address    String?
  postcode   String?
  email      String?
  extraPhone String?
  viewsCount Int       @default(0)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  buttons    Button[]
  tags       Tag[]
  viewsLog   ViewLog[]
}

model Tag {
  id        String  @id @default(uuid())
  cardId    String
  card      Card    @relation(fields: [cardId], references: [id], onDelete: Cascade)
  label     String
  url       String?
  sortOrder Int
}

model Button {
  id        String  @id @default(uuid())
  cardId    String
  card      Card    @relation(fields: [cardId], references: [id], onDelete: Cascade)
  label     String
  url       String
  sortOrder Int
  isActive  Boolean @default(true)
}

model ViewLog {
  id       String   @id @default(uuid())
  cardId   String
  card     Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  viewedAt DateTime @default(now())
  device   String?
}

=== .ENV ===
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://unqx.uz"
NEXTAUTH_SECRET="..."
ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH="$2b$10$..."
```

---

*UNQX Platform · Техническое задание v1.1*
