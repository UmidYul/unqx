# UNQX NFC Manager — Production-Ready App Prompt

## Контекст

Ты создаёшь **UNQX NFC Manager** — мобильное приложение (Next.js / React, TypeScript) для платформы **unqx.uz**. Приложение будет размещено в директории сайта (`/app/nfc` или `/pages/nfc`), поэтому имеет прямой доступ ко всем API, middleware, хукам, контексту авторизации и типам, которые уже существуют в проекте.

**Референс дизайна:** Используй приложённый `unqx-nfc-app.tsx` как pixel-perfect референс UI. Все экраны, компоненты, анимации и цвета должны точно соответствовать референсу.

**API контракты:** Приложены отдельным файлом. Все запросы должны использовать реальные эндпоинты.

---

## Технический стек

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + CSS Modules для сложных анимаций
- **State:** Zustand (если уже используется в проекте) или React Context + useReducer
- **Auth:** Переиспользуй существующий auth контекст проекта (`useAuth`, `useUser`, `getSession`)
- **HTTP:** Используй существующий `fetcher` / `apiClient` из проекта, либо `fetch` с базовым URL из env
- **NFC Web API:** `navigator.nfc` (Web NFC API) с fallback-состояниями для неподдерживаемых браузеров
- **QR:** `qrcode.react` или `qrcode` npm пакет
- **Export:** Нативный Blob API для `.vcf` и `.csv`

---

## Структура файлов

```
app/nfc/                          # или pages/nfc/
├── page.tsx                      # Точка входа, shell приложения
├── layout.tsx                    # Layout с метатегами
├── loading.tsx                   # Skeleton загрузки
│
├── components/
│   ├── AppShell.tsx               # Телефонный frame, nav, статус-бар
│   ├── BottomNav.tsx              # Навигация (Главная, NFC, Люди, Аналитика, Профиль)
│   ├── NotificationPanel.tsx      # Панель уведомлений
│   ├── ShareSheet.tsx             # Share bottom sheet (QR + соцсети)
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── NFCPage.tsx
│   │   ├── PeoplePage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   └── ProfilePage.tsx
│   │
│   ├── nfc/
│   │   ├── NFCRings.tsx           # Анимированные кольца
│   │   ├── ScanArea.tsx           # Область сканирования
│   │   ├── ReadTab.tsx            # Чтение метки
│   │   ├── WriteTab.tsx           # Запись метки
│   │   ├── VerifyTab.tsx          # Проверка метки
│   │   ├── BatchTab.tsx           # Batch запись
│   │   └── LockTab.tsx            # Защита паролем
│   │
│   ├── people/
│   │   ├── ContactsTab.tsx        # Мои контакты
│   │   ├── DirectoryTab.tsx       # Каталог резидентов
│   │   └── LeaderboardTab.tsx     # UNQ Elite
│   │
│   ├── profile/
│   │   ├── CardEditor.tsx         # Редактор визитки
│   │   ├── CardPreview.tsx        # Предпросмотр
│   │   ├── WristbandPage.tsx      # Браслет и метки
│   │   └── WidgetPreview.tsx      # Виджеты
│   │
│   └── ui/
│       ├── QRDisplay.tsx
│       ├── Sparkline.tsx
│       ├── TapMap.tsx
│       └── shared.tsx             # Pill, Label, Row, Chevron, Divider
│
├── hooks/
│   ├── useNFC.ts                  # Web NFC API хук
│   ├── useTheme.ts                # Тема + авто-тема по расписанию
│   ├── useNotifications.ts        # Real-time уведомления
│   └── useExport.ts               # VCF / CSV экспорт
│
├── store/
│   └── nfcStore.ts                # Глобальный стейт (тема, страница, история)
│
└── types/
    └── index.ts                   # Все TypeScript типы
```

---

## Дизайн-система (точно по референсу)

### Цвета — Светлая тема (основная, 1:1 с unqx.uz)
```typescript
const LIGHT = {
  bg:            '#ffffff',
  phoneBg:       '#ffffff',
  surface:       '#f5f5f5',
  border:        '#e8e8e8',
  borderStrong:  '#111111',
  text:          '#0a0a0a',
  textSub:       '#555555',
  textMuted:     '#999999',
  accent:        '#000000',
  accentText:    '#ffffff',
  green:         '#16a34a',
  greenBg:       '#f0fdf4',
  amber:         '#d97706',
  amberBg:       '#fffbeb',
  red:           '#dc2626',
  blue:          '#2563eb',
  blueBg:        '#eff6ff',
};
```

### Цвета — Тёмная тема
```typescript
const DARK = {
  bg:            '#0a0a0a',
  phoneBg:       '#111111',
  surface:       'rgba(255,255,255,0.06)',
  border:        'rgba(255,255,255,0.09)',
  borderStrong:  '#e8dfc8',
  text:          '#f5f5f5',
  textSub:       'rgba(255,255,255,0.55)',
  textMuted:     'rgba(255,255,255,0.28)',
  accent:        '#e8dfc8',
  accentText:    '#111111',
  green:         '#4ade80',
  amber:         '#fbbf24',
  red:           '#f87171',
};
```

### Шрифты
```css
/* Заголовки страниц, имена, слаги */
font-family: 'Playfair Display', serif;

/* Весь остальной UI */
font-family: 'Inter', sans-serif;
```

### Анимации (CSS keyframes)
```css
@keyframes nfcPulse {
  0%   { transform: scale(0.6); opacity: 0.6; }
  100% { transform: scale(1);   opacity: 0; }
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes successPop {
  0%   { transform: scale(0.75); opacity: 0; }
  65%  { transform: scale(1.05); }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes barGrow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes dotBlink {
  0%, 80%, 100% { opacity: 0.18; transform: scale(0.78); }
  40%           { opacity: 1;    transform: scale(1); }
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

---

## Хук useNFC — Web NFC API

```typescript
// hooks/useNFC.ts
import { useState, useCallback, useRef } from 'react';

export type NFCState =
  | 'idle' | 'scanning' | 'success'
  | 'writing' | 'written'
  | 'verifying' | 'verified'
  | 'locking' | 'locked';

export interface NFCTag {
  uid?: string;
  type?: string;
  capacity?: number;
  used?: number;
  url?: string;
  isLocked?: boolean;
}

export interface UseNFCReturn {
  isSupported: boolean;
  state: NFCState;
  tag: NFCTag | null;
  error: string | null;
  startRead: () => Promise<void>;
  writeURL: (url: string) => Promise<void>;
  verify: () => Promise<void>;
  lock: (password: string) => Promise<void>;
  reset: () => void;
}

export function useNFC(): UseNFCReturn {
  const [state, setState] = useState<NFCState>('idle');
  const [tag, setTag] = useState<NFCTag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<NDEFReader | null>(null);

  const isSupported = typeof window !== 'undefined' && 'NDEFReader' in window;

  const reset = useCallback(() => {
    readerRef.current?.abort?.();
    setState('idle');
    setTag(null);
    setError(null);
  }, []);

  const startRead = useCallback(async () => {
    if (!isSupported) {
      setError('Web NFC не поддерживается на этом устройстве');
      return;
    }
    try {
      setState('scanning');
      const reader = new NDEFReader();
      readerRef.current = reader;
      await reader.scan();
      reader.onreading = ({ message, serialNumber }) => {
        const urlRecord = message.records.find(r => r.recordType === 'url');
        const url = urlRecord
          ? new TextDecoder().decode(urlRecord.data)
          : undefined;
        setTag({ uid: serialNumber, url });
        setState('success');
        // POST /api/nfc/scan — логируем скан
        fetch('/api/nfc/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: serialNumber, url }),
        }).catch(() => {});
      };
      reader.onreadingerror = () => {
        setError('Ошибка чтения метки');
        setState('idle');
      };
    } catch (e: any) {
      setError(e.message);
      setState('idle');
    }
  }, [isSupported]);

  const writeURL = useCallback(async (url: string) => {
    if (!isSupported) {
      setError('Web NFC не поддерживается');
      return;
    }
    try {
      setState('writing');
      const writer = new NDEFReader();
      readerRef.current = writer;
      await writer.write({ records: [{ recordType: 'url', data: url }] });
      setState('written');
      // POST /api/nfc/write — логируем запись
      await fetch('/api/nfc/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    } catch (e: any) {
      setError(e.message);
      setState('idle');
    }
  }, [isSupported]);

  const verify = useCallback(async () => {
    if (!isSupported) { setError('Web NFC не поддерживается'); return; }
    try {
      setState('verifying');
      const reader = new NDEFReader();
      readerRef.current = reader;
      await reader.scan();
      reader.onreading = ({ message, serialNumber }) => {
        const urlRecord = message.records.find(r => r.recordType === 'url');
        setTag({
          uid: serialNumber,
          type: 'NTAG213',
          capacity: 137,
          used: message.records.reduce((acc, r) => acc + (r.data?.byteLength ?? 0), 0),
          url: urlRecord ? new TextDecoder().decode(urlRecord.data) : undefined,
          isLocked: false,
        });
        setState('verified');
      };
    } catch (e: any) {
      setError(e.message);
      setState('idle');
    }
  }, [isSupported]);

  const lock = useCallback(async (password: string) => {
    if (!isSupported) { setError('Web NFC не поддерживается'); return; }
    // Web NFC API не поддерживает установку пароля напрямую —
    // это делается через проприетарные команды.
    // Отправляем запрос на бэкенд, который через mDL / relay сделает это.
    try {
      setState('locking');
      await fetch('/api/nfc/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      setState('locked');
    } catch (e: any) {
      setError(e.message);
      setState('idle');
    }
  }, [isSupported]);

  return { isSupported, state, tag, error, startRead, writeURL, verify, lock, reset };
}
```

---

## Хук useTheme — Авто-тема по расписанию

```typescript
// hooks/useTheme.ts
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

function getAutoTheme(): Theme {
  const h = new Date().getHours();
  return h >= 20 || h < 8 ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme]     = useState<Theme>('light');
  const [autoTheme, setAutoTheme] = useState(false);

  // Авто-тема: проверяем каждую минуту
  useEffect(() => {
    if (!autoTheme) return;
    const apply = () => setTheme(getAutoTheme());
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [autoTheme]);

  // Сохраняем предпочтение в localStorage
  useEffect(() => {
    const saved = localStorage.getItem('unqx-theme');
    const savedAuto = localStorage.getItem('unqx-auto-theme');
    if (savedAuto === 'true') { setAutoTheme(true); return; }
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  const toggleTheme = () => {
    if (autoTheme) return;
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('unqx-theme', next);
  };

  const toggleAuto = () => {
    const next = !autoTheme;
    setAutoTheme(next);
    localStorage.setItem('unqx-auto-theme', String(next));
    if (next) setTheme(getAutoTheme());
  };

  return { theme, autoTheme, toggleTheme, toggleAuto, T: theme === 'light' ? LIGHT : DARK };
}
```

---

## Хук useExport — VCF и CSV

```typescript
// hooks/useExport.ts
export function useExport() {
  const exportVCF = (contacts: Contact[]) => {
    const vcf = contacts.map(c =>
      `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\nURL:https://unqx.uz/${c.slug}\nNOTE:UNQX Contact\nEND:VCARD`
    ).join('\n\n');
    download(new Blob([vcf], { type: 'text/vcard' }), 'unqx-contacts.vcf');
  };

  const exportCSV = (contacts: Contact[]) => {
    const rows = [
      ['Имя', 'Телефон', 'UNQ', 'Тапов'],
      ...contacts.map(c => [c.name, c.phone, c.slug, String(c.taps)]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'unqx-contacts.csv');
  };

  return { exportVCF, exportCSV };

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
```

---

## API интеграция

Все запросы используют существующий `apiClient` из проекта. Если его нет — используй `fetch` с базовым URL из `process.env.NEXT_PUBLIC_API_URL`.

### Эндпоинты (из приложённых API контрактов)

```typescript
// types/index.ts

// ─── Пользователь ───
GET  /api/me                         → User
PATCH /api/me                        → User          // обновить профиль
PATCH /api/me/card                   → Card          // обновить визитку

// ─── Аналитика ───
GET  /api/analytics/summary          → AnalyticsSummary
GET  /api/analytics/taps?period=7d   → TapPoint[]
GET  /api/analytics/sources          → TapSource[]
GET  /api/analytics/geo              → GeoPoint[]
GET  /api/analytics/recent           → RecentTap[]

// ─── NFC ───
POST /api/nfc/scan    { uid, url }   → { ok: true }
POST /api/nfc/write   { url }        → { ok: true }
POST /api/nfc/lock    { password }   → { ok: true }
GET  /api/nfc/history                → NFCHistoryItem[]
GET  /api/nfc/tags                   → NFCTag[]
PATCH /api/nfc/tags/:uid { name }    → NFCTag       // переименование

// ─── Контакты ───
GET  /api/contacts                   → Contact[]
POST /api/contacts/:slug/save        → { saved: boolean }
POST /api/contacts/:slug/subscribe   → { subscribed: boolean }
GET  /api/contacts/export/vcf        → Blob          // сервер-сайд альтернатива

// ─── Директория ───
GET  /api/directory?q=&page=1        → { residents: Resident[], total: number }

// ─── Лидерборд ───
GET  /api/leaderboard?period=all     → LeaderboardEntry[]

// ─── Браслет и заказы ───
GET  /api/wristband/status           → WristbandStatus
POST /api/orders/wristband           → Order        // оформить заказ
GET  /api/orders/:id/status          → OrderStatus

// ─── Уведомления ───
GET  /api/notifications              → Notification[]
POST /api/notifications/read-all     → { ok: true }

// ─── Real-time тапы (SSE или WebSocket) ───
GET  /api/notifications/stream       → EventSource  // SSE: { event: 'tap', data: Tap }
```

### Типы

```typescript
// types/index.ts

export interface User {
  id: string;
  name: string;
  slug: string;
  plan: 'basic' | 'premium';
  nfcActive: boolean;
  card: Card;
}

export interface Card {
  name: string;
  job: string;
  phone: string;
  telegram: string;
  email: string;
  theme: 'light' | 'dark' | 'gradient';
  buttons: CardButton[];
}

export interface CardButton {
  icon: string;
  label: string;
  url: string;
}

export interface AnalyticsSummary {
  totalTaps: number;
  todayTaps: number;
  weekTaps: number[];   // 7 значений
  monthTaps: number[];  // 30 значений
  growth: number;       // процент
  sources: TapSource[];
  geo: GeoPoint[];
}

export interface TapSource {
  label: string;
  count: number;
  percent: number;
}

export interface GeoPoint {
  city: string;
  lat: number;
  lng: number;
  count: number;
}

export interface NFCHistoryItem {
  id: string;
  slug: string;
  uid?: string;
  type: 'read' | 'write';
  timestamp: string;
}

export interface NFCTag {
  uid: string;
  name: string;
  linkedSlug: string;
  lastTap: string;
  taps: number;
  status: 'ok' | 'warn' | 'error';
  history: NFCHistoryItem[];
}

export interface Contact {
  name: string;
  slug: string;
  phone: string;
  taps: number;
  tag: 'premium' | 'basic';
  lastSeen: string;
  saved: boolean;
  subscribed: boolean;
}

export interface Resident {
  name: string;
  slug: string;
  city: string;
  tag: 'premium' | 'basic';
  taps: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  slug: string;
  taps: number;
  delta: number; // тапов сегодня
}

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'building' | 'shipping' | 'delivered';
  slug: string;
  address: string;
  createdAt: string;
  estimatedAt: string;
}

export interface WristbandStatus {
  active: boolean;
  linkedSlug: string;
  lastTap: string;
  totalTaps: number;
}

export interface Notification {
  id: string;
  type: 'tap' | 'write' | 'report' | 'elite';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}
```

---

## Real-time уведомления (SSE)

```typescript
// hooks/useNotifications.ts
import { useEffect, useState } from 'react';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Загружаем историю
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((data: Notification[]) => {
        setNotifications(data);
        setHasUnread(data.some(n => !n.read));
      });
  }, []);

  // SSE для реал-тайм тапов
  useEffect(() => {
    const es = new EventSource('/api/notifications/stream');

    es.addEventListener('tap', (e) => {
      const tap = JSON.parse(e.data);
      const notif: Notification = {
        id: Date.now().toString(),
        type: 'tap',
        title: 'Новый тап',
        body: `${tap.visitorName ?? 'Кто-то'} открыл вашу визитку`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications(prev => [notif, ...prev]);
      setHasUnread(true);
    });

    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setHasUnread(false);
  };

  return { notifications, hasUnread, markAllRead };
}
```

---

## Функциональные требования по страницам

### Главная (HomePage)
- `useEffect` → `GET /api/me` + `GET /api/analytics/summary`
- Счётчик тапов с анимацией count-up
- Список последних тапов → `GET /api/analytics/recent`
- Кнопки "QR-код" и "Поделиться" → открывают ShareSheet с реальным QR

### NFC (NFCPage)
**Вкладка "Читать":**
- Использует `useNFC().startRead()`
- На устройствах без Web NFC → показывает info-баннер с инструкцией
- После успешного скана → `POST /api/nfc/scan` для логирования
- История → `GET /api/nfc/history`

**Вкладка "Записать":**
- Два инпута: буквы (только `[A-Z]`, макс 3) + цифры (только `[0-9]`, макс 3)
- Автофокус на цифры после заполнения букв
- `useNFC().writeURL(`https://unqx.uz/${letters}${digits}`)`
- Результат → `POST /api/nfc/write`

**Вкладка "Проверить":**
- `useNFC().verify()` → показывает тип метки, ёмкость, данные

**Вкладка "Batch":**
- Те же инпуты, счётчик записанных меток
- Каждый успешный `writeURL()` инкрементирует счётчик
- `POST /api/nfc/write` для каждой метки

**Вкладка "Защита":**
- `useNFC().lock(password)` → `POST /api/nfc/lock`

### Люди (PeoplePage)

**Контакты:**
- `GET /api/contacts` → список
- Звёздочка → `POST /api/contacts/:slug/save` (toggle)
- Фильтр "Избранные" — клиентская фильтрация
- "↓ .vcf" / "↓ .csv" → `useExport()` на клиенте

**Резиденты:**
- `GET /api/directory?q=&page=1` с debounced поиском
- Бесконечный скролл или пагинация
- Кнопка 🔔 → `POST /api/contacts/:slug/subscribe` (toggle)

**Elite:**
- `GET /api/leaderboard` → список с медалями и дельтой

### Аналитика (AnalyticsPage)
- `GET /api/analytics/summary` → все данные за раз
- Барчарт → `summary.weekTaps` (7 дней)
- Спарклайн → `summary.monthTaps` (30 дней)
- Карта → `summary.geo` (точки на SVG-карте Узбекистана)
- Источники → `summary.sources`

### Профиль (ProfilePage)

**Редактор визитки:**
- Загружает данные из `useUser()` (auth контекст)
- `PATCH /api/me/card` при сохранении
- Предпросмотр — рендерит `<CardPreview card={localState} />`

**Браслет и метки:**
- `GET /api/wristband/status` → статус браслета
- `GET /api/nfc/tags` → список меток
- `PATCH /api/nfc/tags/:uid { name }` → переименование
- История по UID → фильтрация из `GET /api/nfc/history`

**Заказ браслета:**
- Форма → `POST /api/orders/wristband`
- Трекинг → `GET /api/orders/:id/status`

**Настройки:**
- Тема → `useTheme()` (localStorage)
- Авто-тема → `useTheme().toggleAuto()`
- Уведомления → localStorage toggle

---

## QR Code

```typescript
// components/ui/QRDisplay.tsx
import QRCode from 'qrcode.react';
// npm install qrcode.react

export function QRDisplay({ slug, size = 150 }: { slug: string; size?: number }) {
  return (
    <QRCode
      value={`https://unqx.uz/${slug}`}
      size={size}
      bgColor="#ffffff"
      fgColor="#000000"
      level="M"
      includeMargin
    />
  );
}
```

---

## Share Sheet

Использует нативный `navigator.share` если доступен, иначе показывает кастомный bottom sheet с:
- QR-код (`<QRDisplay />`)
- Telegram → `https://t.me/share/url?url=https://unqx.uz/${slug}`
- WhatsApp → `https://wa.me/?text=https://unqx.uz/${slug}`
- Копировать → `navigator.clipboard.writeText(url)`
- Скачать QR → конвертируй canvas в PNG через `canvas.toDataURL()`

---

## Error Handling

```typescript
// Каждый API вызов оборачивается в try/catch
// Показывай toast / inline error, но не крашь UI
// Если NFC не поддерживается — показывай info-баннер:

const NFCUnsupportedBanner = ({ T }: { T: ThemeTokens }) => (
  <div style={{ background: T.blueBg, border: `1px solid ${T.blue}30`, borderRadius: 12, padding: '14px 16px' }}>
    <div style={{ fontSize: 12, color: T.blue, fontWeight: 600, marginBottom: 3 }}>
      ℹ Web NFC недоступен
    </div>
    <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>
      Web NFC работает только в Chrome на Android с NFC-чипом.
      На iOS и десктопе — используй QR-код.
    </div>
  </div>
);
```

---

## Чеклист production ready

- [ ] `loading.tsx` — skeleton для каждой страницы
- [ ] `error.tsx` — error boundary
- [ ] `metadata` в `layout.tsx` (title, description, og:image)
- [ ] Все строки на русском через `const t = { ... }` объект (готово к i18n)
- [ ] Все API вызовы с AbortController (отмена при unmount)
- [ ] Debounce на поиск в директории (300ms)
- [ ] Infinite scroll в директории (Intersection Observer)
- [ ] `<Image>` из next/image для всех изображений
- [ ] `use client` только там где нужно (минимизируй)
- [ ] Всё что можно — серверные компоненты
- [ ] Оптимистичные обновления для toggle (сохранить, подписаться)
- [ ] `localStorage` через хук с SSR-safe проверкой (`typeof window !== 'undefined'`)
- [ ] Правильный z-index стеккинг: модалки > overlays > nav > content
- [ ] `overflow: hidden` на телефонном frame, `overflow-y: auto` на контенте
- [ ] Плавные transition при смене темы (0.4s на все цветовые свойства)
- [ ] Анимация смены страниц (`pageIn` keyframe)
- [ ] Правильный `aria-label` на всех кнопках
- [ ] `disabled` состояние на кнопках во время загрузки

---

## Важные детали реализации

1. **NFC fallback:** Web NFC работает только в Chrome Android. На iOS/десктоп — показывай баннер с объяснением и альтернативой (QR).

2. **Авторизация:** Используй `getServerSession()` в серверных компонентах для проверки. Если пользователь не авторизован — редирект на `/login`.

3. **Оптимистичные обновления:** При нажатии "Сохранить" / "Подписаться" — сразу меняй UI, затем делай запрос. При ошибке — откатывай.

4. **Переименование метки:** Inline редактирование — клик на иконку карандаша, input появляется на месте названия, Enter / кнопка OK → `PATCH /api/nfc/tags/:uid`.

5. **Карта тапов:** SVG с упрощённым контуром Узбекистана. Точки из `geo` API — масштабируй координаты lat/lng в SVG viewBox.

6. **Виджеты:** Статичные превью (не настоящие виджеты ОС). Добавь кнопку "Скачать скриншот" через `html2canvas` или просто инструкцию.

7. **Заказ браслета:** После `POST /api/orders/wristband` — показывай confirmation с order ID и переключайся на tracking view.

8. **SSE тапы:** Если сервер не отдаёт SSE эндпоинт — используй polling каждые 30 секунд как fallback.

9. **Slug validation:** При вводе в write tab — только `[A-Z]` для букв (автоматически uppercase), только `[0-9]` для цифр. Автофокус переходит на второй инпут когда первый заполнен.

10. **Тема в localStorage:** При первом рендере на сервере — всегда light. На клиенте — читаем из localStorage и обновляем.

---

## Референс файлы

- `unqx-nfc-app.tsx` — полный pixel-perfect UI референс
- `api-contracts.md` / `api-contracts.yaml` — все эндпоинты с типами запроса/ответа

Приложи оба файла в начале диалога с разработчиком.

---

---

# ДОПОЛНЕНИЕ К ПРОМТУ

---

## Часть 2 — Иконки, App Store / Google Play, Порядок разработки

---

## 1. Иконки — только SVG, только тёмные, без эмодзи

### Полный запрет

Нигде в приложении **не должно быть**:
- Эмодзи (📞 ✉ 🌐 📸 ⊕ ⊙ ⊞ ✈ ✆ ◈ ★ 📟 📦 и любые другие)
- Цветных иконок (синих Telegram, зелёных WhatsApp, розовых Instagram)
- Unicode-символов вместо иконок (◎ ○ ⊕ ⊙ ⊞ и т.п.)
- Любых иконок из emoji-шрифта системы

### Библиотека иконок

Используй **Lucide React** (`npm install lucide-react`) — строгий, минималистичный набор, точно совпадающий со стилем unqx.uz.

```typescript
import {
  // Навигация
  Home, Wifi, Users, BarChart2, User,
  // NFC действия
  Scan, PenLine, CheckCircle2, Layers, Lock, Unlock,
  // Общие действия
  Share2, QrCode, Copy, Download, ChevronRight,
  ArrowLeft, X, Plus, Pencil, Bell, BellOff,
  // Контакты / люди
  Star, UserPlus, UserCheck, Search, Filter,
  // Аналитика
  TrendingUp, TrendingDown, MapPin, Clock,
  // Браслет / заказ
  Watch, Package, Truck, CheckCheck,
  // Профиль / настройки
  Settings, Sun, Moon, LogOut, Camera, Globe,
  Phone, Mail, MessageCircle, Link,
  // Статусы
  AlertTriangle, Info, CheckCircle, XCircle,
} from 'lucide-react';
```

### Правила применения иконок

```typescript
// ✅ ПРАВИЛЬНО — все иконки одного цвета (T.text или T.textMuted)
<Home size={20} color={T.text} strokeWidth={1.5} />
<Wifi size={20} color={T.accent} strokeWidth={1.5} />

// ✅ ПРАВИЛЬНО — иконка в круглом контейнере с нейтральным фоном
<div style={{ width: 38, height: 38, borderRadius: '50%',
  background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <Share2 size={17} color={T.text} strokeWidth={1.5} />
</div>

// ❌ НЕПРАВИЛЬНО — цветной круг под иконку соцсети
<div style={{ background: '#2aabee' }}>
  <span>✈</span>
</div>

// ❌ НЕПРАВИЛЬНО — эмодзи как иконка кнопки
<button>📞 Позвонить</button>

// ❌ НЕПРАВИЛЬНО — unicode вместо иконки
<div style={{ fontSize: 18 }}>◎</div>
```

### Замена всех эмодзи в UI

| Было (эмодзи/unicode) | Заменить на Lucide |
|---|---|
| ◎ (NFC в nav) | `<Wifi />` |
| ⊞ (Главная) | `<Home />` |
| ⊙ (Аналитика) | `<BarChart2 />` |
| ○ (Профиль) | `<User />` |
| ⊕ (Записать) | `<PenLine />` |
| ↗ (Поделиться) | `<Share2 />` |
| ⬛ (QR) | `<QrCode />` |
| ⧉ (Копировать) | `<Copy />` |
| ✓ (Скопировано) | `<Check />` |
| ★ (Избранное) | `<Star />` |
| 🔔 (Подписка) | `<Bell />` |
| ✎ (Редактировать) | `<Pencil size={14} />` |
| × (Закрыть) | `<X />` |
| ← (Назад) | `<ArrowLeft />` |
| ↑ (Рост) | `<TrendingUp size={12} />` |
| 📟 (Браслет) | `<Watch />` |
| 📦 (Заказ) | `<Package />` |
| ⚠ (Предупреждение) | `<AlertTriangle />` |
| ℹ (Инфо) | `<Info />` |
| 📞 (Телефон в кнопках) | `<Phone />` |
| ✉ (Email) | `<Mail />` |
| 🔗 (Ссылка) | `<Link />` |
| 💬 (Telegram) | `<MessageCircle />` |
| 🌐 (Сайт) | `<Globe />` |
| 📍 (Адрес) | `<MapPin />` |
| 📸 (Фото) | `<Camera />` |

### Share Sheet — без цветных фонов

```typescript
// ❌ НЕПРАВИЛЬНО — цветные круги соцсетей
const shareOptions = [
  { label: 'Telegram', icon: '✈', color: '#2aabee', bg: '#e8f6fd' },
];

// ✅ ПРАВИЛЬНО — единый стиль, нейтральные цвета
const shareOptions = [
  {
    label: 'Telegram',
    Icon: Send,         // Lucide Send icon
    href: `https://t.me/share/url?url=${url}`,
  },
  {
    label: 'WhatsApp',
    Icon: MessageCircle,
    href: `https://wa.me/?text=${url}`,
  },
  {
    label: 'Скопировать',
    Icon: copied ? Check : Copy,
    action: handleCopy,
  },
  {
    label: 'Скачать QR',
    Icon: Download,
    action: handleDownloadQR,
  },
];

// Рендер — все иконки одинакового стиля
{shareOptions.map(({ label, Icon, href, action }) => (
  <a
    key={label}
    href={href}
    target="_blank"
    onClick={action}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      cursor: 'pointer', textDecoration: 'none',
    }}
  >
    <div style={{
      width: 52, height: 52, borderRadius: '50%',
      background: T.surface, border: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={20} color={T.text} strokeWidth={1.5} />
    </div>
    <span style={{ fontSize: 11, color: T.textSub }}>{label}</span>
  </a>
))}
```

### Иконки в кнопках визитки (CardEditor)

```typescript
// Выбор иконки для кнопок — только Lucide, без эмодзи
const BUTTON_ICONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: 'phone',    Icon: Phone,          label: 'Телефон'  },
  { key: 'mail',     Icon: Mail,           label: 'Email'    },
  { key: 'link',     Icon: Link,           label: 'Ссылка'   },
  { key: 'work',     Icon: Briefcase,      label: 'Работа'   },
  { key: 'camera',   Icon: Camera,         label: 'Фото'     },
  { key: 'globe',    Icon: Globe,          label: 'Сайт'     },
  { key: 'map',      Icon: MapPin,         label: 'Адрес'    },
  { key: 'message',  Icon: MessageCircle,  label: 'Telegram' },
];

// Выбор иконки — сетка кнопок
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
  {BUTTON_ICONS.map(({ key, Icon, label }) => (
    <div
      key={key}
      onClick={() => selectIcon(key)}
      style={{
        padding: '10px 0', borderRadius: 10, cursor: 'pointer',
        background: selected === key ? T.accent : T.surface,
        border: `1px solid ${selected === key ? T.accent : T.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      }}
    >
      <Icon size={18} color={selected === key ? T.accentText : T.text} strokeWidth={1.5} />
      <span style={{ fontSize: 10, color: selected === key ? T.accentText : T.textMuted }}>{label}</span>
    </div>
  ))}
</div>
```

### Иконки статусов

```typescript
// Только strokeWidth: 1.5 везде для консистентности
// Размеры: nav=20, кнопки=17, строки=16, маленькие=14

// Статус браслета
<div style={{ background: T.greenBg, borderRadius: '50%', width: 40, height: 40,
  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <Watch size={18} color={T.green} strokeWidth={1.5} />
</div>

// Предупреждение
<div style={{ background: T.amberBg, borderRadius: '50%', width: 40, height: 40, ... }}>
  <AlertTriangle size={18} color={T.amber} strokeWidth={1.5} />
</div>

// Успех (вместо эмодзи ✓)
<div style={{ background: T.greenBg, borderRadius: '50%', width: 40, height: 40, ... }}>
  <CheckCircle2 size={18} color={T.green} strokeWidth={1.5} />
</div>
```

---

## 2. Подготовка к App Store и Google Play

Приложение строится как **PWA + Capacitor** (или **React Native WebView** если в проекте уже есть RN). Основной стек — Next.js PWA, обёрнутый в Capacitor для нативных сборок.

### 2.1 PWA конфигурация

```typescript
// next.config.ts — добавить PWA
import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/unqx\.uz\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 300 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 31536000 } },
    },
  ],
})({
  // остальной next.config
});

export default config;
```

```json
// public/manifest.json
{
  "name": "UNQX NFC Manager",
  "short_name": "UNQX",
  "description": "Цифровая визитка нового поколения — читай и записывай NFC-метки",
  "start_url": "/nfc",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "lang": "ru",
  "icons": [
    { "src": "/icons/icon-72.png",   "sizes": "72x72",   "type": "image/png" },
    { "src": "/icons/icon-96.png",   "sizes": "96x96",   "type": "image/png" },
    { "src": "/icons/icon-128.png",  "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png",  "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png",  "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png",  "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384.png",  "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png",  "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Главная страница UNQX"
    },
    {
      "src": "/screenshots/nfc.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "NFC сканирование"
    }
  ],
  "share_target": {
    "action": "/nfc/share",
    "method": "GET",
    "params": { "url": "url" }
  },
  "categories": ["business", "utilities"],
  "shortcuts": [
    {
      "name": "Сканировать NFC",
      "short_name": "Скан",
      "url": "/nfc?tab=read",
      "icons": [{ "src": "/icons/shortcut-scan.png", "sizes": "96x96" }]
    },
    {
      "name": "Моя визитка",
      "short_name": "Визитка",
      "url": "/nfc?page=profile",
      "icons": [{ "src": "/icons/shortcut-card.png", "sizes": "96x96" }]
    }
  ]
}
```

### 2.2 Capacitor — нативные сборки

```bash
# Установка
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npm install @capacitor/nfc  # нативный NFC (важно для iOS!)
npm install @capacitor/share @capacitor/clipboard @capacitor/haptics

npx cap init "UNQX" "uz.unqx.nfc" --web-dir=out
```

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.unqx.nfc',
  appName: 'UNQX',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // В dev режиме — указывай на локальный Next.js
    // url: 'http://192.168.x.x:3000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  android: {
    buildOptions: {
      keystorePath: 'unqx.keystore',
      keystoreAlias: 'unqx',
    },
  },
  ios: {
    scheme: 'UNQX',
  },
};

export default config;
```

### 2.3 NFC хук — нативный + web fallback

```typescript
// hooks/useNFC.ts — финальная версия с Capacitor fallback

import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Нативный NFC через Capacitor (iOS + Android)
let NativeNFC: any = null;
if (Capacitor.isNativePlatform()) {
  import('@capacitor-community/nfc').then(m => { NativeNFC = m.NFC; });
}

export function useNFC() {
  const isWebNFCSupported = typeof window !== 'undefined' && 'NDEFReader' in window;
  const isNativePlatform  = Capacitor.isNativePlatform();
  const isSupported = isWebNFCSupported || isNativePlatform;

  // ... остальная логика хука из Части 1
  // При isNativePlatform — используй NativeNFC.read() / NativeNFC.write()
  // При isWebNFCSupported — используй NDEFReader
  // Иначе — setState('unsupported')
}
```

### 2.4 App Store метаданные (iOS)

Создай файл `store/ios-metadata.md`:

```markdown
## App Store Connect

**Название:** UNQX — NFC Визитка
**Subtitle:** Читай и записывай NFC-метки
**Категория:** Business
**Возраст:** 4+

**Описание (RU):**
UNQX — приложение для управления цифровой визиткой нового поколения.

— Читай NFC-метки одним касанием
— Записывай свой UNQ-адрес на браслет, наклейку или визитку
— Смотри аналитику: кто и когда тапнул твою карточку
— Управляй контактами и следи за лидербордом резидентов
— Заказывай NFC-браслеты прямо из приложения

Для пользователей unqx.uz — требуется активный UNQ.

**Ключевые слова:**
nfc, визитка, цифровая визитка, бизнес карта, nfc браслет, unqx, контакты, qr код

**Privacy Policy URL:** https://unqx.uz/privacy
**Support URL:** https://t.me/unqx_uz

**Скриншоты:** 6.7" (iPhone 15 Pro Max), 6.5" (iPhone 11 Pro Max), iPad Pro 12.9"

**Разрешения (Info.plist):**
- NFCReaderUsageDescription: "Для чтения и записи NFC-меток вашей визитки UNQX"
- CameraUsageDescription: "Для сканирования QR-кодов"
- PhotoLibraryUsageDescription: "Для загрузки фото профиля"
```

### 2.5 Google Play метаданные (Android)

Создай файл `store/android-metadata.md`:

```markdown
## Google Play Console

**Название:** UNQX — NFC Менеджер
**Краткое описание (80 симв.):**
Цифровая визитка с NFC. Тапни — и ты уже в телефоне собеседника.

**Полное описание:**
[аналогично iOS]

**Категория:** Business
**Теги:** NFC, Digital Business Card, Networking
**Рейтинг контента:** Everyone
**Целевая аудитория:** 18+

**AndroidManifest.xml — разрешения:**
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />

**android/app/build.gradle:**
minSdkVersion 23
targetSdkVersion 34
versionCode: семантически из package.json
```

### 2.6 Splash Screen и иконки

```bash
# Генерация всех размеров иконок
npm install -g @capacitor/assets

# Требуемые исходники:
# assets/icon.png       — 1024x1024, без скруглений, белый фон, чёрный логотип UNQX
# assets/splash.png     — 2732x2732, белый фон, центрированный логотип
# assets/icon-dark.png  — для тёмной темы (тёмный фон, светлый логотип)

npx @capacitor/assets generate \
  --iconBackgroundColor '#ffffff' \
  --iconBackgroundColorDark '#000000' \
  --splashBackgroundColor '#ffffff' \
  --splashBackgroundColorDark '#000000'
```

### 2.7 Хаптика (тактильная отдача)

```typescript
// При успешном скане/записи NFC — добавить вибрацию
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// После успешного NFC scan
await Haptics.impact({ style: ImpactStyle.Medium });

// После успешной записи
await Haptics.impact({ style: ImpactStyle.Heavy });

// При ошибке
await Haptics.notification({ type: NotificationType.Error });

// Fallback для web
if (!Capacitor.isNativePlatform() && 'vibrate' in navigator) {
  navigator.vibrate(100);
}
```

### 2.8 Deep Links

```typescript
// iOS — apple-app-site-association (уже на сервере unqx.uz)
// public/.well-known/apple-app-site-association
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.uz.unqx.nfc",
      "paths": ["/nfc*", "/:slug"]
    }]
  }
}

// Android — assetlinks.json
// public/.well-known/assetlinks.json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "uz.unqx.nfc",
    "sha256_cert_fingerprints": ["YOUR_CERT_FINGERPRINT"]
  }
}]

// Обработка deep link в приложении
import { App } from '@capacitor/app';

useEffect(() => {
  App.addListener('appUrlOpen', ({ url }) => {
    const slug = new URL(url).pathname.replace('/', '');
    if (slug) router.push(`/nfc?page=people&slug=${slug}`);
  });
}, []);
```

---

## 3. Порядок разработки — строго по очереди, без полумер

Разрабатывай приложение в строго заданном порядке. **Не переходи к следующему шагу, пока текущий не завершён полностью.** Каждый шаг сдаётся с полностью рабочим кодом, подключёнными API, анимациями и обработкой ошибок.

---

### Шаг 0 — Фундамент (выполни первым, до любой страницы)

**Что сделать:**
1. Установить все зависимости: `lucide-react`, `qrcode.react`, `next-pwa`, `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/haptics`, `@capacitor/share`
2. Настроить `next.config.ts` с PWA
3. Создать `public/manifest.json` со всеми полями
4. Создать `capacitor.config.ts`
5. Создать `types/index.ts` — все TypeScript интерфейсы из этого промта
6. Создать `hooks/useTheme.ts` — полная реализация с localStorage и авто-режимом
7. Создать `hooks/useNFC.ts` — полная реализация с web + native fallback
8. Создать `hooks/useNotifications.ts` — SSE + polling fallback
9. Создать `hooks/useExport.ts` — VCF и CSV
10. Создать `components/ui/shared.tsx` — Pill, Label, Row, Chevron, Divider, ScanArea, NFCRings, DotsLoader, CheckCircle, Sparkline, QRDisplay
11. Создать `components/AppShell.tsx` — телефонный frame, статус-бар, top bar с уведомлениями, bottom nav
12. Создать `store/nfcStore.ts` — Zustand стор с состоянием всего приложения
13. Создать `app/nfc/layout.tsx` с метатегами, подключением шрифтов Google Fonts, manifest

**Критерии готовности:** приложение запускается, тема переключается, навигация работает, типы не имеют ошибок, шрифты Inter + Playfair Display загружены.

---

### Шаг 1 — Главная страница (HomePage) — полностью

**Что сделать:**
1. `GET /api/me` — загрузить данные пользователя, показать имя, слаг, тариф
2. `GET /api/analytics/summary` — загрузить счётчик тапов
3. Реализовать анимацию count-up для общего счётчика (0 → реальное значение за 1.5с)
4. `GET /api/analytics/recent` — последние тапы, с реальными именами и временем
5. Hero-карточка с именем из API, кнопки "Поделиться" и "QR-код" → открывают ShareSheet
6. ShareSheet — полностью рабочий: QR через `qrcode.react`, ссылки Telegram/WhatsApp открываются, копирование через `navigator.clipboard`, скачивание QR через canvas `toDataURL()`
7. Skeleton loading — пока данные грузятся, показывай placeholder'ы нужной формы
8. Обработка ошибок — если API недоступен, показывай inline сообщение

**Критерии готовности:** реальные данные, работающий QR, работающий шаринг, skeleton при загрузке.

---

### Шаг 2 — NFC страница (NFCPage) — полностью

**Что сделать, по вкладкам:**

**Вкладка "Читать":**
1. `useNFC().startRead()` — запуск Web NFC
2. Если устройство не поддерживает — баннер с Lucide `<Info />` и текстом (без эмодзи)
3. После успешного скана → `POST /api/nfc/scan` → показать данные метки
4. `GET /api/nfc/history` — история внизу с реальными данными
5. Хаптика при успехе

**Вкладка "Записать":**
1. Два инпута (буквы + цифры), автофокус, только допустимые символы
2. `useNFC().writeURL()` — запись
3. `POST /api/nfc/write` — логирование
4. Хаптика при успехе

**Вкладка "Проверить":**
1. `useNFC().verify()` — чтение метаданных
2. Показ типа, ёмкости, данных

**Вкладка "Batch":**
1. Счётчик, цикл записи, каждый успех → `POST /api/nfc/write`

**Вкладка "Защита":**
1. Инпут пароля (type="password"), `useNFC().lock()` → `POST /api/nfc/lock`

**Критерии готовности:** все 5 вкладок работают, реальный NFC (или красивый fallback), история из API.

---

### Шаг 3 — Люди (PeoplePage) — полностью

**Вкладка "Контакты":**
1. `GET /api/contacts` — список контактов
2. Поиск с debounce 300ms (клиентская фильтрация)
3. Фильтр "Избранные" — кнопка с `<Star />` в заголовке
4. Кнопка ★ у каждого контакта → `POST /api/contacts/:slug/save` (toggle, оптимистичное обновление)
5. `useExport().exportVCF()` — кнопка с `<Download />`, реальное скачивание
6. `useExport().exportCSV()` — то же

**Вкладка "Резиденты":**
1. `GET /api/directory?q=&page=1` — список
2. Debounced поиск 300ms → `GET /api/directory?q=query`
3. Infinite scroll (Intersection Observer) — подгрузка следующей страницы
4. Кнопка `<Bell />` / `<BellOff />` → `POST /api/contacts/:slug/subscribe` (toggle, оптимистично)

**Вкладка "Elite":**
1. `GET /api/leaderboard` — список
2. Медали через условный рендер (1=gold, 2=silver, 3=bronze) — используй Lucide `<Award />` или простые числа с разными цветами, без эмодзи
3. Дельта — `<TrendingUp size={12} />` перед числом

**Критерии готовности:** реальные данные, debounce, infinite scroll, оптимистичные обновления, экспорт работает.

---

### Шаг 4 — Аналитика (AnalyticsPage) — полностью

**Что сделать:**
1. `GET /api/analytics/summary` — один запрос, все данные
2. Общий счётчик + sparkline за 30 дней
3. Барчарт за неделю — `transformOrigin: 'bottom'`, анимация `barGrow`, текущий день выделен
4. SVG-карта Узбекистана — точки из `summary.geo`, масштабируй `lat/lng` → SVG координаты
5. Источники тапов — progress bars с анимацией ширины при mount
6. Устройства и города — те же progress bars
7. Skeleton пока грузится

**Критерии готовности:** все секции с реальными данными из API, анимации при появлении на экране.

---

### Шаг 5 — Профиль (ProfilePage) — полностью

**Редактор визитки:**
1. Загрузить `GET /api/me` → заполнить форму
2. Инлайн редактирование имени, должности, телефона, Telegram, email
3. Выбор темы визитки (3 варианта карточек)
4. Добавление/удаление кнопок — иконки через сетку Lucide (из BUTTON_ICONS)
5. Кнопка "Превью" → `<CardPreview />` — рендерит визитку как видят другие (без iframe, прямой рендер)
6. `PATCH /api/me/card` при сохранении — с loading состоянием на кнопке

**Браслет и метки:**
1. `GET /api/wristband/status` — статус
2. `GET /api/nfc/tags` — список меток
3. Inline переименование → `PATCH /api/nfc/tags/:uid { name }` — Enter сохраняет
4. История по каждой метке — фильтрация из `GET /api/nfc/history` по uid
5. Форма заказа → `POST /api/orders/wristband` → показать order id
6. `GET /api/orders/:id/status` — трекинг с timeline

**Виджеты:**
1. Статичные превью (3 варианта) с реальными данными пользователя
2. Кнопка "Скопировать скриншот" — `html2canvas` или инструкция

**Настройки:**
1. Тема — переключатель → `useTheme().toggleTheme()`
2. Авто-тема — переключатель → `useTheme().toggleAuto()`
3. Уведомления — localStorage toggle
4. Все переключатели анимированы (transition на transform)

**QR + Поделиться:**
1. QR через `qrcode.react` — реальный слаг пользователя
2. Скачивание PNG — `canvas.toDataURL()` → download
3. Шаринг → `ShareSheet`

**Критерии готовности:** редактор сохраняет в API, все переключатели работают, браслет с реальными данными, заказ проходит полный флоу.

---

### Шаг 6 — Уведомления (NotificationPanel) — полностью

**Что сделать:**
1. `GET /api/notifications` — список при открытии
2. SSE `GET /api/notifications/stream` — реал-тайм новые тапы
3. Fallback: если SSE недоступен → polling каждые 30с
4. `POST /api/notifications/read-all` при открытии панели
5. Красная точка на колоколе — исчезает после открытия
6. Список с иконками Lucide по типу уведомления (tap=`<Wifi/>`, write=`<PenLine/>`, report=`<BarChart2/>`, elite=`<Award/>`)

**Критерии готовности:** реальные уведомления, SSE работает, точка исчезает после прочтения.

---

### Шаг 7 — Финальная проверка и Store-сборка

**Что сделать:**
1. Пройти по всему чеклисту из раздела "production ready" в Части 1
2. Запустить `next build` — 0 ошибок TypeScript, 0 ошибок сборки
3. Запустить `next export` (если нужен static) или убедиться что SSR работает
4. `npx cap sync` — синхронизировать с Android/iOS
5. `npx cap build android` — убедиться что сборка проходит
6. `npx cap build ios` — убедиться что сборка проходит
7. Проверить Lighthouse score: Performance ≥ 90, Accessibility ≥ 95, PWA ✓
8. Проверить что все иконки — только Lucide, ни одного эмодзи в UI
9. Проверить что светлая тема 1:1 с unqx.uz (те же цвета, шрифты, отступы)
10. Проверить что тёмная тема применяется корректно на всех компонентах

---

## Финальное напоминание

- **Никаких эмодзи.** Если видишь эмодзи в коде — это ошибка. Заменяй на Lucide.
- **Никаких цветных иконок соцсетей.** Все иконки — `color={T.text}` или `color={T.textMuted}`.
- **Никаких полумер.** Каждая страница — полностью рабочая, с API, с анимациями, с обработкой ошибок.
- **Строгий порядок.** Шаг 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Не начинай Шаг 2 пока не сдал Шаг 1.
- **strokeWidth: 1.5** на всех Lucide иконках — это стандарт unqx.uz.
- **Playfair Display** только для заголовков страниц, имён, слагов. Всё остальное — Inter.
