# UNQX App — Полный аудит и исправление всего функционала

Ты проводишь полный аудит UNQX приложения.
Проходишь по каждой странице и каждой функции.
Если что-то не работает, работает на моковых данных,
сломано, или не хватает API/таблиц в БД — сразу исправляешь.

Никаких TODO. Никаких заглушек. Всё должно работать реально.

---

## Как работать

Для каждой страницы:
1. Открой файл экрана
2. Проверь каждую функцию по чеклисту ниже
3. Найди проблему → сразу исправь
4. Переходи к следующей странице

Порядок: Home → NFC → People → Analytics → Profile → Notifications → Card Preview

---

## Что проверять для каждого API вызова

- Эндпоинт существует на сервере?
- Возвращает реальные данные или 404/500?
- Таблица в БД существует?
- Нужные поля в таблице есть?
- Авторизация работает (Bearer токен принимается)?
- Данные отображаются в UI или всё ещё мок?

Если эндпоинта нет на сервере — создай его.
Если таблицы нет в БД — создай миграцию.
Если данных нет — проверь что они записываются.

---

## СТРАНИЦА 1 — Home (Главная)

### Проверить:

**Hero карточка**
- [ ] Имя пользователя — из GET /api/me или мок?
- [ ] Слаг (unqx.uz/XXX) — реальный из БД?
- [ ] Тариф (Премиум/Базовый) — из БД?
- [ ] Статус NFC — из БД или хардкод?

**Счётчик тапов**
- [ ] GET /api/analytics/summary возвращает реальные данные?
- [ ] todayTaps считается реально (за сегодня)?
- [ ] totalTaps — общее число из БД?
- [ ] Анимация count-up работает?

**Последние тапы**
- [ ] GET /api/analytics/recent существует?
- [ ] Таблица tap_events (или аналог) существует в БД?
- [ ] Записывается ли тап когда кто-то открывает unqx.uz/SLUG?
- [ ] Возвращает имя/слаг посетителя или null?
- [ ] Список реально обновляется?

**Кнопка "Поделиться"**
- [ ] ShareSheet открывается?
- [ ] QR генерируется с реальным слагом?
- [ ] Telegram/WhatsApp ссылки открываются?
- [ ] Копирование работает через Clipboard?
- [ ] Скачивание QR работает?

**Кнопка "QR-код"**
- [ ] Открывает тот же ShareSheet или отдельный экран?
- [ ] QR реальный (ведёт на unqx.uz/SLUG)?

### Исправить:
Всё что на моке — подключить к реальному API.
Если нет таблицы tap_events — создать миграцию:

```sql
CREATE TABLE tap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_slug VARCHAR(6) NOT NULL,
  visitor_slug VARCHAR(6),
  visitor_ip VARCHAR(45),
  user_agent TEXT,
  source VARCHAR(20) DEFAULT 'direct', -- 'nfc', 'qr', 'direct'
  city VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON tap_events(owner_slug);
CREATE INDEX ON tap_events(created_at);
```

Если тапы не записываются при открытии визитки —
добавить запись в tap_events на сервере при GET /SLUG.

---

## СТРАНИЦА 2 — NFC

### Проверить:

**Вкладка "Читать"**
- [ ] useNFC().startRead() вызывается реально?
- [ ] На Android — Web NFC NDEFReader подключён?
- [ ] На iOS — нативный плагин подключён?
- [ ] После скана POST /api/nfc/scan выполняется?
- [ ] Таблица nfc_scans существует в БД?
- [ ] История GET /api/nfc/history возвращает реальные записи?
- [ ] Баннер "NFC не поддерживается" показывается на веб?

**Вкладка "Записать"**
- [ ] Инпут букв — только A-Z, автоматически uppercase?
- [ ] Инпут цифр — только 0-9?
- [ ] Автофокус переходит на цифры когда буквы заполнены?
- [ ] useNFC().writeURL() записывает реально?
- [ ] POST /api/nfc/write логируется?
- [ ] После записи — история обновляется?

**Вкладка "Проверить"**
- [ ] useNFC().verify() работает?
- [ ] Показывает реальный тип метки (NTAG213 и т.д)?
- [ ] Показывает реальную ёмкость?

**Вкладка "Batch"**
- [ ] Счётчик инкрементируется после каждой успешной записи?
- [ ] Каждая запись логируется отдельно в POST /api/nfc/write?

**Вкладка "Защита"**
- [ ] POST /api/nfc/lock существует на сервере?
- [ ] Пароль передаётся безопасно (не в plaintext в логах)?

### Если нет таблиц — создать миграции:

```sql
CREATE TABLE nfc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  slug VARCHAR(6),
  uid VARCHAR(50),
  operation VARCHAR(10) NOT NULL, -- 'read', 'write', 'verify', 'lock'
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON nfc_history(user_id);

CREATE TABLE nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  uid VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) DEFAULT 'Метка',
  linked_slug VARCHAR(6),
  tap_count INT DEFAULT 0,
  last_tap_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## СТРАНИЦА 3 — People

### Проверить:

**Вкладка "Контакты"**
- [ ] GET /api/contacts возвращает реальные данные?
- [ ] Таблица contacts (или saved_contacts) существует?
- [ ] Контакты — это люди которые реально тапнули?
- [ ] Или сохранённые вручную? Определить и исправить.
- [ ] Поиск фильтрует реально (debounce 300ms)?
- [ ] Кнопка ★ — POST /api/contacts/:slug/save работает?
- [ ] saved поле обновляется в БД?
- [ ] Фильтр "Избранные" показывает только saved === true?
- [ ] Экспорт .vcf скачивает файл с реальными данными?
- [ ] Экспорт .csv скачивает файл с реальными данными?

**Вкладка "Резиденты"**
- [ ] GET /api/directory возвращает реальных пользователей?
- [ ] Поиск ?q= работает на сервере (не только клиент)?
- [ ] Пагинация ?page= работает?
- [ ] Infinite scroll подгружает следующую страницу?
- [ ] Кнопка 🔔 — POST /api/contacts/:slug/subscribe работает?
- [ ] subscribed поле обновляется в БД?

**Вкладка "Elite" (Лидерборд)**
- [ ] GET /api/leaderboard возвращает реальный рейтинг?
- [ ] Рейтинг считается по реальным tap_events?
- [ ] delta (тапов сегодня) считается реально?
- [ ] Обновляется в реальном времени или кэшируется?

### Если нет таблиц — создать:

```sql
CREATE TABLE user_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  contact_slug VARCHAR(6) NOT NULL,
  saved BOOLEAN DEFAULT FALSE,
  subscribed BOOLEAN DEFAULT FALSE,
  first_tap_at TIMESTAMPTZ DEFAULT NOW(),
  last_tap_at TIMESTAMPTZ DEFAULT NOW(),
  tap_count INT DEFAULT 1,
  UNIQUE(owner_id, contact_slug)
);

-- Автоматически добавлять контакт при тапе
-- Триггер или логика в API при записи tap_events
```

---

## СТРАНИЦА 4 — Analytics

### Проверить:

**Общий счётчик**
- [ ] GET /api/analytics/summary существует?
- [ ] totalTaps — SELECT COUNT(*) FROM tap_events WHERE owner_slug = ?
- [ ] todayTaps — WHERE created_at >= TODAY?
- [ ] growth — сравнение с прошлым месяцем реальное?

**График недели (barChart)**
- [ ] weekTaps — 7 значений за последние 7 дней из БД?
- [ ] Или хардкод [12,18,9,24,31,19,28]?
- [ ] Текущий день выделен правильно?

**Спарклайн (30 дней)**
- [ ] monthTaps — 30 значений из БД?
- [ ] Или мок данные?

**Карта тапов**
- [ ] GET /api/analytics/geo существует?
- [ ] city/country берётся из tap_events?
- [ ] Геолокация определяется при тапе (по IP)?
- [ ] Если нет геолокации — добавить ip-api.com или аналог при записи тапа

**Источники (NFC/QR/Прямая)**
- [ ] source поле в tap_events заполняется реально?
- [ ] При открытии через NFC — source = 'nfc'?
- [ ] При открытии через QR — source = 'qr'?
- [ ] При прямом переходе — source = 'direct'?
- [ ] GET /api/analytics/sources считает правильно?

**Устройства и города**
- [ ] user_agent парсится при записи тапа?
- [ ] iOS/Android определяется из user_agent?
- [ ] Город берётся из геолокации по IP?

### Исправить API:
Если /api/analytics/summary возвращает мок —
написать реальные SQL запросы:

```sql
-- totalTaps
SELECT COUNT(*) FROM tap_events WHERE owner_slug = $1;

-- todayTaps
SELECT COUNT(*) FROM tap_events
WHERE owner_slug = $1 AND created_at >= CURRENT_DATE;

-- weekTaps (7 дней)
SELECT DATE(created_at), COUNT(*)
FROM tap_events
WHERE owner_slug = $1 AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at);

-- sources
SELECT source, COUNT(*) as count
FROM tap_events WHERE owner_slug = $1
GROUP BY source;
```

---

## СТРАНИЦА 5 — Profile

### Проверить:

**Информация пользователя**
- [ ] Имя, должность, телефон, telegram — из GET /api/me?
- [ ] Тариф (Премиум/Базовый) — из БД?
- [ ] Слаг — реальный?

**Редактор визитки**
- [ ] Форма заполняется реальными данными из GET /api/me?
- [ ] PATCH /api/me/card отправляет изменения?
- [ ] Сервер сохраняет в БД?
- [ ] После сохранения GET /api/me возвращает новые данные?
- [ ] Выбор темы визитки сохраняется?
- [ ] Кнопки визитки сохраняются в БД?

**ПРЕВЬЮ ВИЗИТКИ — исправить отдельно**

Превью не работает. Вот как исправить:

Проблема чаще всего в одном из:
1. Стейт card в редакторе не передаётся в CardPreview
2. CardPreview рендерится до загрузки данных
3. Модальное окно не получает актуальный стейт

Исправление:

```typescript
// В CardEditor — localState это копия card для редактирования
const [localCard, setLocalCard] = useState({ ...card });

// Превью показывает localCard (незасохранённые изменения видны сразу)
const [showPreview, setShowPreview] = useState(false);

// CardPreview получает localCard, не card из API
{showPreview && (
  <CardPreview
    card={localCard}
    onClose={() => setShowPreview(false)}
  />
)}
```

CardPreview должен рендерить визитку точно так как
её видят другие на unqx.uz/SLUG:
- Имя крупно (Playfair Display)
- Должность
- Кнопки с реальными иконками и подписями
- Правильная тема (light/dark/gradient)
- QR код реального слага
- Не iframe — прямой рендер компонентом

```typescript
// components/CardPreview.tsx
export function CardPreview({ card, onClose }) {
  // card.theme определяет фон и цвета
  const bg = card.theme === 'dark' ? '#111' :
             card.theme === 'gradient' ? 'linear-gradient(...)' : '#fff';
  const textColor = card.theme === 'dark' ? '#f5f5f5' : '#0a0a0a';

  return (
    <Modal visible onRequestClose={onClose} transparent animationType="fade">
      <Pressable style={overlay} onPress={onClose}>
        <Pressable style={[container, { background: bg }]}>
          {/* Аватар с инициалом */}
          {/* Имя — Playfair Display */}
          {/* Должность */}
          {/* Слаг */}
          {/* Кнопки из card.buttons */}
          {/* QR код */}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

**Браслет и метки**
- [ ] GET /api/wristband/status возвращает реальный статус?
- [ ] Таблица wristbands существует?
- [ ] Последний тап берётся из tap_events?
- [ ] GET /api/nfc/tags возвращает реальные метки пользователя?
- [ ] PATCH /api/nfc/tags/:uid переименование сохраняется?

**Заказ браслета**
- [ ] POST /api/orders/wristband создаёт запись в БД?
- [ ] Таблица orders существует?
- [ ] GET /api/orders/:id/status возвращает реальный статус?
- [ ] После заказа — пользователь получает email/telegram уведомление?

### Если нет таблиц — создать:

```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  name VARCHAR(100),
  job VARCHAR(100),
  phone VARCHAR(20),
  telegram VARCHAR(50),
  email VARCHAR(100),
  theme VARCHAR(20) DEFAULT 'light',
  buttons JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wristbands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  linked_slug VARCHAR(6),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20) DEFAULT 'wristband',
  status VARCHAR(20) DEFAULT 'pending',
  address TEXT,
  recipient_name VARCHAR(100),
  phone VARCHAR(20),
  amount INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## СТРАНИЦА 6 — Notifications (Уведомления)

### Проверить:

- [ ] GET /api/notifications возвращает реальные уведомления?
- [ ] Таблица notifications существует?
- [ ] Уведомления создаются при тапе? (trigger или API)
- [ ] POST /api/notifications/read-all обновляет read = true?
- [ ] SSE /api/notifications/stream работает?
- [ ] Если SSE нет — polling каждые 30 сек реализован?
- [ ] Красная точка исчезает после открытия панели?
- [ ] POST /api/notifications/token сохраняет push токен?

### Если нет таблицы:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL, -- 'tap', 'write', 'report', 'elite', 'order'
  title VARCHAR(100) NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON notifications(user_id, read);
CREATE INDEX ON notifications(created_at);

-- Push токены
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token TEXT NOT NULL,
  platform VARCHAR(10), -- 'ios', 'android'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);
```

---

## ОБЩИЕ ПРОБЛЕМЫ — проверить везде

### Авторизация
- [ ] Все API эндпоинты проверяют Bearer токен?
- [ ] Нельзя получить чужие данные подменив slug?
- [ ] 401 при истёкшем токене возвращается корректно?

### Данные
- [ ] Нигде не остались моковые массивы типа const MOCK_DATA = [...]?
- [ ] Нигде нет setTimeout с фиктивной задержкой вместо реального запроса?
- [ ] Все useState с начальными данными заменены на useQuery?

### Ошибки
- [ ] Каждый экран показывает ErrorState при isError?
- [ ] Каждое действие показывает toast при ошибке?
- [ ] Никакой экран не остаётся пустым при ошибке загрузки?

### Загрузка
- [ ] Каждый экран показывает Skeleton при isLoading?
- [ ] Pull to refresh работает на каждом экране?
- [ ] Кнопки disabled во время isPending?

---

## Порядок работы

1. Открой HomeScreen — пройди по чеклисту — исправь всё
2. Открой NFCScreen — пройди по чеклисту — исправь всё
3. Открой PeopleScreen — пройди по чеклисту — исправь всё
4. Открой AnalyticsScreen — пройди по чеклисту — исправь всё
5. Открой ProfileScreen — исправь превью визитки первым, потом остальное
6. Открой NotificationsPanel — пройди по чеклисту — исправь всё
7. Проверь общие проблемы — убери все моки

После каждого экрана — сообщи что было сломано и что исправлено.

---

## Критерии готовности

Приложение готово когда:
- Ни одного мок-массива в коде
- Ни одного захардкоженного числа вместо данных из API
- Все таблицы в БД существуют
- Все API эндпоинты возвращают реальные данные
- Превью визитки показывает реальные данные пользователя
- Тапы записываются при каждом открытии визитки
- История NFC пишется при каждом скане/записи
- Контакты появляются автоматически при тапе
- Аналитика считается из реальных tap_events

## Важно
- Не трогай стили — только логику и данные
- Если не знаешь структуру БД проекта — спроси перед созданием миграций
- Миграции писать осторожно — не удалять существующие таблицы
- После каждого исправленного экрана жди подтверждения перед следующим
```
