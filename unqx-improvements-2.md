# UNQX App — Sentry, Биометрия, Onboarding

---

## ПРОМТ 13 — Sentry (мониторинг ошибок)

```
Подключи Sentry — чтобы видеть все краши и ошибки
которые происходят у реальных пользователей.

## Установка
npx expo install @sentry/react-native

## Настройка
1. Зарегистрируйся на sentry.io, создай проект Expo/React Native
2. Скопируй DSN из настроек проекта
3. Добавь в .env: EXPO_PUBLIC_SENTRY_DSN=твой_dsn

## Что сделать

### 1. Инициализировать в App.tsx до всего остального
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.2,   // 20% запросов для performance
  debug: __DEV__,
});

export default Sentry.wrap(App);

### 2. Передать пользователя в Sentry после логина
После успешного логина:
Sentry.setUser({ id: user.id, username: user.slug });

При логауте:
Sentry.setUser(null);

### 3. Обновить ErrorBoundary
В componentDidCatch добавить:
Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });

### 4. Логировать важные события (breadcrumbs)
Добавить в ключевые места — помогает понять что делал
пользователь перед крашем:

// NFC скан
Sentry.addBreadcrumb({ message: 'NFC scan started', category: 'nfc' });

// Навигация между экранами
Sentry.addBreadcrumb({ message: `Navigate to ${screenName}`, category: 'navigation' });

// API ошибка
Sentry.addBreadcrumb({ message: `API error: ${endpoint}`, category: 'api', level: 'error' });

### 5. Обернуть критические места в try/catch с Sentry
В apiClient.ts при ошибке запроса:
Sentry.captureException(error, { tags: { endpoint, method } });

### 6. Настройка в app.json
{
  "expo": {
    "plugins": [
      ["@sentry/react-native/expo", { "organization": "твой_org", "project": "unqx" }]
    ]
  }
}

## Ожидаемый результат
- Любой краш у любого пользователя виден в Sentry dashboard
- Stack trace с точной строкой кода
- Информация о пользователе рядом с ошибкой
- История действий до краша (breadcrumbs)
- Email алёрт при новой ошибке

## Важно
- debug: false в production — не засорять консоль
- tracesSampleRate не больше 0.2 — не нагружать сервер
- Не логировать пароли и токены в breadcrumbs
- После подключения запусти: npx expo start --clear
```

---

## ПРОМТ 14 — Биометрия (Face ID / отпечаток)

```
Добавь биометрическую аутентификацию.
Пользователь входит через Face ID или отпечаток пальца
вместо ввода пароля повторно.

## Установка
npx expo install expo-local-authentication

## Что сделать

### 1. Хук hooks/useBiometrics.ts

- isAvailable() — поддерживается ли биометрия на устройстве
- isEnrolled() — есть ли сохранённый отпечаток/лицо
- authenticate(reason: string) — запустить биометрию, вернуть success: boolean
- getBiometricType() — вернуть 'Face ID' | 'Touch ID' | 'Fingerprint' | null

Использовать LocalAuthentication.authenticateAsync с:
- promptMessage: reason
- fallbackLabel: 'Использовать пароль'
- cancelLabel: 'Отмена'
- disableDeviceFallback: false

### 2. Хранение состояния биометрии
В AsyncStorage хранить:
- biometrics_enabled: boolean — включена ли биометрия
- biometrics_asked: boolean — предлагали ли включить

### 3. Где применить

#### При входе в приложение (App Lock)
Если biometrics_enabled === true и приложение было свёрнуто
более 5 минут — при открытии запросить биометрию.

Логика в App.tsx через AppState:
- При переходе в background — сохранить timestamp
- При возврате в active — если прошло > 5 мин и биометрия включена → заблокировать экран

Создать components/BiometricLockScreen.tsx:
- Показывается поверх всего приложения
- Иконка Fingerprint или ScanFace из lucide-react-native
- Текст "Подтвердите личность"
- Кнопка автоматически запускает биометрию при показе
- Кнопка "Другой способ" → переход к логину

#### При входе в аккаунт
После успешного логина с паролем — предложить включить биометрию:
"Хотите входить через Face ID в следующий раз?"
Кнопки: "Включить" | "Не сейчас"
Показать один раз — сохранить biometrics_asked.

### 4. Настройка в ProfileScreen
В разделе настроек добавить переключатель:
"Вход по Face ID / отпечатку"
Toggle → вызвать authenticate() для подтверждения
При успехе → сохранить biometrics_enabled в AsyncStorage

### 5. Info.plist и AndroidManifest (автоматически через expo)
В app.json добавить:
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSFaceIDUsageDescription": "Для быстрого входа в UNQX"
      }
    }
  }
}

## Ожидаемый результат
- При включённой биометрии: открыл приложение → Face ID/отпечаток → внутри
- Если биометрия не прошла → кнопка войти паролем
- В настройках профиля можно включить/выключить
- После 5 минут в фоне — блокировка при возврате

## Важно
- Проверять isAvailable() перед показом опции
- Не блокировать если biometrics_enabled === false
- На симуляторе Face ID можно эмулировать через меню
- disableDeviceFallback: false — всегда давать альтернативу
- Не хранить биометрические данные — expo-local-authentication
  использует системное API, данные не покидают устройство
```

---

## ПРОМТ 15 — Onboarding

```
Добавь onboarding для новых пользователей.
Объяснить что такое UNQX, зачем нужны разрешения,
и провести через первую настройку.

## Что сделать

### 1. Хук hooks/useOnboarding.ts
В AsyncStorage хранить:
- onboarding_completed: boolean
- onboarding_step: number (для resume если закрыл)

Методы:
- isCompleted() → boolean
- complete() → сохранить onboarding_completed = true
- getStep() → текущий шаг
- setStep(n) → сохранить шаг

### 2. Показывать onboarding один раз
В App.tsx при старте:
- Если !onboarding_completed → показать OnboardingScreen
- Если completed → обычный AppShell

### 3. Экраны onboarding (5 шагов)

Создай screens/OnboardingScreen.tsx с горизонтальным
FlatList/ScrollView по шагам. Пагинация через dots внизу.

Шаг 1 — Добро пожаловать
- Иконка Wifi из lucide-react-native (большая)
- Заголовок: "UNQX NFC Manager"
- Текст: "Управляй своей цифровой визиткой. Читай и записывай NFC-метки."
- Кнопка: "Начать"

Шаг 2 — Как это работает
- Три пункта с иконками:
  Scan → "Сканируй чужие визитки одним касанием"
  PenLine → "Записывай свой UNQ на браслет или наклейку"
  BarChart2 → "Смотри кто и когда тапнул твою карточку"
- Кнопка: "Далее"

Шаг 3 — NFC разрешение
- Иконка Wifi (большая)
- Заголовок: "Разрешить NFC"
- Текст: "Приложению нужен доступ к NFC чтобы читать
  и записывать метки. Данные не покидают устройство."
- Кнопка: "Разрешить NFC" → запустить useNFC().requestPermission()
- Кнопка пропустить: "Позже" (маленький текст)

Шаг 4 — Уведомления
- Иконка Bell (большая)
- Заголовок: "Будь в курсе"
- Текст: "Получай уведомления когда кто-то открывает
  твою визитку или меняется статус заказа."
- Кнопка: "Включить уведомления" → запустить registerForPushNotifications()
- Кнопка пропустить: "Позже"

Шаг 5 — Готово
- Иконка CheckCircle2 (большая, зелёная)
- Заголовок: "Всё готово"
- Текст: "Твой UNQ настроен. Начни делиться визиткой прямо сейчас."
- Кнопка: "Открыть приложение" → complete() → перейти в AppShell

### 4. Навигация между шагами
- Кнопка "Далее" → следующий шаг + haptics.light()
- Свайп влево/вправо — тоже переключает шаги
- Точки-индикаторы внизу — активная точка больше/ярче
- Кнопка "Назад" на шагах 2-4 (не на 1 и 5)

### 5. Стили
- Каждый шаг занимает весь экран
- Иконка по центру вверху, большая (64-80px)
- Заголовок крупный (Playfair Display если используется)
- Текст под ним серый, lineHeight комфортный
- Кнопки внизу экрана
- Фон и цвета — по существующей теме проекта

### 6. Пропустить весь onboarding
Маленькая кнопка "Пропустить" в правом верхнем углу
на шагах 1-4. Нажатие → complete() → AppShell.

## Ожидаемый результат
- Новый пользователь видит onboarding при первом запуске
- Повторный запуск — сразу AppShell, без onboarding
- Разрешения запрашиваются в контексте — пользователь понимает зачем
- Можно пропустить любой шаг и весь onboarding целиком

## Важно
- Не запрашивать разрешения без объяснения — Apple отклоняет приложения
- Onboarding показывается ОДИН раз — проверяй AsyncStorage
- Если пользователь закрыл на шаге 3 — при следующем открытии
  показать с того же шага (использовать onboarding_step)
- Кнопки "Пропустить" всегда доступны — не заставляй давать разрешения
- После complete() очистить onboarding_step из AsyncStorage
```

---

## Порядок внедрения (продолжение)

```
Предыдущие (1-12):
✅ React Query, SecureStore, Error Boundary, Offline,
   Pull to Refresh, Empty States, Disable Buttons,
   Transitions, Keyboard, Push, Haptics, Store Review

Следующие:
☐ 13. Sentry          — мониторинг ошибок в продакшене
☐ 14. Биометрия       — Face ID / отпечаток
☐ 15. Onboarding      — первый запуск нового пользователя
```

Каждый промт отдавать AI отдельно.
Проверять что работает перед переходом к следующему.
