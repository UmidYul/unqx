# API Contracts (UNQX)

Дата: 2026-03-22
Источник: `src/routes/api/*`

## Общие правила
- Base URL: `APP_URL` из `.env` (по умолчанию `http://127.0.0.1:3100`).
- Формат запроса/ответа: JSON (`Content-Type: application/json`), кроме явно указанных случаев.
- Аутентификация: cookie-сессия `unqx.sid` (HTTP-only).
- CSRF: токен `x-csrf-token` обязателен для большинства `POST|PUT|PATCH|DELETE` в `/api/auth`, `/api/profile`, `/api/cards` (частично), `/api/features` (частично), `/api` (mobile, частично), `/api/admin`. Токен выдаётся `GET /api/auth/me` как `csrfToken`.
- Same-Origin: для эндпоинтов с `requireSameOrigin` можно не отправлять `Origin/Referer`; если отправляете — они должны совпадать с origin `APP_URL`.
- Ошибки обычно имеют вид `{"error":"...","code":"..."?}` и соответствующий HTTP статус.
- Необработанная ошибка API: HTTP 500 `{ "error": "Internal Server Error" }`.
- Даты/время — ISO 8601 строки.
- Пагинация: где есть `page`/`limit`, страница 1-based.

Комментарий для ИИ: общий протокол взаимодействия и требования безопасности для мобильного клиента.

## /api/auth
Примечание: все `POST` требуют `x-csrf-token` и `requireSameOrigin`.

UserPayload (используется в ответах `/api/auth/*`):
- `id` string (uuid)
- `email` string|null
- `login` string|null
- `emailVerified` boolean
- `firstName` string
- `lastName` string|null
- `city` string|null
- `username` string|null
- `displayName` string
- `plan` string (`none`|`basic`|`premium`)
- `effectivePlan` string (`none`|`basic`|`premium`)
- `planPurchasedAt` string|null
- `planUpgradedAt` string|null
- `status` string (`active`|`blocked`|`deactivated`|`deleted`)

### POST /api/auth/register
Комментарий для ИИ: регистрация нового пользователя и запуск верификации email при наличии email.
Auth: нет.
CSRF: да.
Request body:
- `firstName` string, 1..120
- `city` string (нормализованный город)
- `login` string (валидный логин)
- `email` string|null (опционально)
- `password` string (>= 8)
- `confirmPassword` string (должен совпадать)
Response 200:
```json
{ "ok": true, "redirectTo": "/verify-email"|"/profile", "email": "user@example.com" }
```
Ошибки:
- `400 VALIDATION_ERROR`
- `409 LOGIN_TAKEN`
- `409 EMAIL_TAKEN`

### POST /api/auth/send-otp
Комментарий для ИИ: повторная отправка OTP кода верификации email.
Auth: нет.
CSRF: да.
Request body:
- `email` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `400 VALIDATION_ERROR`

### POST /api/auth/verify-email
Комментарий для ИИ: подтверждение email по OTP, автологин.
Auth: нет.
CSRF: да.
Request body:
- `email` string
- `code` string (6 цифр)
Response 200:
```json
{ "ok": true, "redirectTo": "/profile", "user": { ...UserPayload } }
```
Ошибки:
- `400 OTP_INVALID`
- `400 OTP_EXPIRED`
- `400 OTP_INVALIDATED`

### POST /api/auth/login
Комментарий для ИИ: вход по логину и паролю.
Auth: нет.
CSRF: да.
Request body:
- `login` string
- `password` string
- `rememberMe` boolean (опционально)
Response 200:
```json
{ "ok": true, "redirectTo": "/profile", "user": { ...UserPayload } }
```
Ошибки:
- `401 INVALID_CREDENTIALS`
- `423 LOCKED`
- `403 ACCOUNT_DISABLED`
- `410 ACCOUNT_DELETED`
- `403 ACCOUNT_DEACTIVATED` (добавляет `email`, `restoreUntil`)
- `403 UNVERIFIED` (добавляет `email`)

### POST /api/auth/reactivate/request
Комментарий для ИИ: запрос OTP для восстановления деактивированного аккаунта.
Auth: нет.
CSRF: да.
Request body:
- `email` string
Response 200:
```json
{ "ok": true, "email": "user@example.com", "restoreUntil": "..." }
```
Ошибки:
- `400 VALIDATION_ERROR`
- `400 ACCOUNT_NOT_REACTIVATABLE`
- `410 ACCOUNT_DELETED`

### POST /api/auth/reactivate/confirm
Комментарий для ИИ: подтверждение восстановления аккаунта.
Auth: нет.
CSRF: да.
Request body:
- `email` string
- `code` string (6 цифр)
Response 200:
```json
{ "ok": true, "redirectTo": "/profile", "user": { ...UserPayload } }
```
Ошибки:
- `400 VALIDATION_ERROR`
- `400 ACCOUNT_NOT_REACTIVATABLE`
- `410 ACCOUNT_DELETED`
- `400 REACTIVATION_OTP_INVALID`

### POST /api/auth/forgot-password
Комментарий для ИИ: отправка кода сброса пароля (если email существует).
Auth: нет.
CSRF: да.
Request body:
- `email` string
Response 200:
```json
{ "ok": true, "message": "...", "redirectTo": "/reset-password?email=..." }
```

### POST /api/auth/reset-password
Комментарий для ИИ: установка нового пароля по OTP.
Auth: нет.
CSRF: да.
Request body:
- `email` string
- `code` string (6 цифр)
- `newPassword` string (>= 8)
- `confirmPassword` string
Response 200:
```json
{ "ok": true, "redirectTo": "/login" }
```
Ошибки:
- `400 VALIDATION_ERROR`
- `400 RESET_TOKEN_INVALID`
- `400 RESET_TOKEN_EXPIRED`

### POST /api/auth/change-email/request
Комментарий для ИИ: смена email (этап 1: запрос кода).
Auth: требуется сессия.
CSRF: да.
Request body:
- `email` string
- `currentPassword` string
Response 200:
```json
{ "ok": true, "pendingEmail": "new@example.com" }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `401 INVALID_CREDENTIALS`
- `409 EMAIL_TAKEN`

### POST /api/auth/change-email/verify
Комментарий для ИИ: смена email (этап 2: подтверждение кода).
Auth: требуется сессия.
CSRF: да.
Request body:
- `code` string (6 цифр)
Response 200:
```json
{ "ok": true, "user": { ...UserPayload } }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 OTP_INVALID`
- `400 OTP_EXPIRED`

### POST /api/auth/change-password
Комментарий для ИИ: смена пароля в профиле.
Auth: требуется сессия.
CSRF: да.
Request body:
- `currentPassword` string
- `newPassword` string (>= 8)
- `confirmPassword` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `400 VALIDATION_ERROR`
- `401 AUTH_REQUIRED`
- `401 INVALID_CREDENTIALS`

### GET /api/auth/me
Комментарий для ИИ: проверка сессии и получение CSRF токена.
Auth: опционально.
CSRF: нет.
Response (гость):
```json
{ "authenticated": false, "csrfToken": "..." }
```
Response (авторизован):
```json
{ "authenticated": true, "user": { ...UserPayload, "photoUrl": "..." }, "csrfToken": "..." }
```
Дополнительно: если аккаунт не активен, вернет `{ authenticated:false, csrfToken, accountStatus }`.

### POST /api/auth/logout
Комментарий для ИИ: выход и сброс сессии.
Auth: требуется сессия.
CSRF: да.
Response 200:
```json
{ "ok": true, "csrfToken": "..." }
```

## /api/profile
Примечание: все эндпоинты требуют user-сессию (`AUTH_REQUIRED`). Все `POST|PUT|PATCH|DELETE` требуют CSRF + same-origin.

ProfileCard:
- `id` string
- `ownerId` string
- `name` string
- `role` string
- `bio` string
- `hashtag` string
- `address` string
- `postcode` string
- `email` string
- `extraPhone` string
- `avatarUrl` string
- `tags` array
- `buttons` array
- `theme` string
- `customColor` string
- `showBranding` boolean
- `createdAt` string|null
- `updatedAt` string|null

SlugItem:
- `id` string
- `letters` string
- `digits` string
- `fullSlug` string
- `status` string
- `statusLabel` string
- `isPrimary` boolean
- `pauseMessage` string
- `requestedAt` string|null
- `approvedAt` string|null
- `activatedAt` string|null
- `createdAt` string|null
- `stats.views` number
- `stats.since` string|null

OrderRequestItem:
- `id` string
- `slug` string
- `requestedPlan` string
- `planPrice` number
- `bracelet` boolean
- `status` string
- `statusBadge` string
- `adminNote` string|null
- `purchasedAt` string|null
- `createdAt` string
- `paymentReference` string
- `paymentUrl` string
- `promoCode` string
- `promoDiscountApplied` number
- `inviteeDiscountApplied` number
- `bonusSpent` number
- `slugPriceBeforeDiscount` number
- `slugPrice` number
- `totalOneTime` number

Score:
- `score` number
- `scoreViews` number
- `scoreSlugRarity` number
- `scoreTenure` number
- `scoreCtr` number
- `scoreBracelet` number
- `scorePlan` number
- `percentile` number
- `topPercent` number
- `calculatedAt` string|null
- `rarityLabel` string
- `history` array (items `{ date, score }`)
- `isPremium` boolean

### GET /api/profile/bootstrap
Комментарий для ИИ: основной bootstrap профиля и лимитов.
Response 200:
- `user` объект с полями профиля и статуса
- `limits.slugs` number
- `limits.tags` number
- `limits.buttons` number
- `slugs` array SlugItem (может быть `[]` для тарифа `none`)
- `card` ProfileCard|null
- `requests` array OrderRequestItem
- `score` Score
- `pricing` объект из `getPricingSettings`
- `access.canCreateCard` boolean
- `access.canAccessAnalytics` boolean

### GET /api/profile/slugs
Комментарий для ИИ: список UNQ со статистикой.
Response 200:
```json
{ "items": [ ...SlugItem ] }
```

### PATCH /api/profile/slugs/:slug/status
Комментарий для ИИ: смена статуса UNQ (`active|paused|private`).
Request body:
- `status` string
Response 200:
```json
{ "ok": true, "slug": "AAA000", "status": "active" }
```
Ошибки:
- `400 Invalid status`
- `404 UNQ not found`
- `403 PLAN_REQUIRED`

### PATCH /api/profile/slugs/:slug/primary
Комментарий для ИИ: сделать UNQ основным.
Response 200:
```json
{ "ok": true, "slug": "AAA000", "isPrimary": true }
```
Ошибки:
- `404 UNQ not found`
- `403 PLAN_REQUIRED`

### PATCH /api/profile/slugs/:slug/pause-message
Комментарий для ИИ: сообщение для режима паузы.
Request body:
- `message` string (<= 220)
Response 200:
```json
{ "ok": true, "slug": "AAA000", "pauseMessage": "..." }
```
Ошибки:
- `404 UNQ not found`
- `403 PLAN_REQUIRED`

### GET /api/profile/card
Комментарий для ИИ: получить визитку пользователя.
Response 200:
```json
{ "card": { ...ProfileCard } }
```

### PUT /api/profile/card
Комментарий для ИИ: создать/обновить визитку.
Request body:
- `name` string (обязателен)
- `role` string
- `bio` string
- `hashtag` string
- `address` string
- `postcode` string
- `email` string
- `extraPhone` string
- `tags` array
- `buttons` array
- `theme` string
- `customColor` string
- `showBranding` boolean
Response 200:
```json
{ "ok": true, "card": { ...ProfileCard } }
```
Ошибки:
- `400 Name is required`
- `400 Invalid email`
- `403 PLAN_REQUIRED`
- `403 UPGRADE_REQUIRED`

### POST /api/profile/card/avatar
Комментарий для ИИ: загрузка аватара.
Request: `multipart/form-data`, поле `file`.
Response 200:
```json
{ "ok": true, "avatarUrl": "..." }
```
Ошибки:
- `400 Сначала сохрани визитку`
- `400 Unsupported file type`
- `400 Invalid image payload`
- `403 PLAN_REQUIRED`

### DELETE /api/profile/card/avatar
Комментарий для ИИ: удалить аватар.
Response 200:
```json
{ "ok": true, "avatarUrl": null }
```
Ошибки:
- `404 Card not found`
- `403 PLAN_REQUIRED`

### GET /api/profile/slugs/:slug/qr
Комментарий для ИИ: данные для QR и проверка доступности публичного QR.
Response 200:
```json
{ "slug": "AAA000", "url": "https://unqx.uz/AAA000", "ownerName": "...", "ownerRole": "...", "score": 0, "isAvailableForPublicQr": true }
```
Ошибки:
- `403 UPGRADE_REQUIRED`
- `404 UNQ not found`

### GET /api/profile/analytics/bootstrap
Комментарий для ИИ: подготовка аналитики (список UNQ и доступные периоды).
Response 200:
- `slugs` array (`fullSlug`, `isPrimary`, `status`)
- `currentPlan` string
- `selectedSlug` string|null
- `periods` array (для premium `[7,30,90]`, иначе `[7]`)

### GET /api/profile/analytics
Комментарий для ИИ: аналитика визитов/кликов.
Query:
- `slug` string (обязателен)
- `period` number (7/30/90 для premium)
Response 200:
- `slug` string
- `period` number
- `kpi.views` number
- `kpi.uniqueVisitors` number
- `kpi.clicks` number
- `kpi.ctr` number
- `kpi.trends.*`
- `chart.viewsByDay` array `{ date, value }`
- `chart.trafficSources` object
- `chart.geography` object
- `chart.devices` object
- `chart.buttonActivity` object
- `chart.peakHours` object
- `score` Score
- `flags.isPremium` boolean
- `flags.lockedPeriods` array
Ошибки:
- `400 Slug is required`
- `404 UNQ not found`

### GET /api/profile/verification
Комментарий для ИИ: статус верификации пользователя.
Response 200:
- `isVerified` boolean
- `latestRequest` object|null
- `canSubmitRequest` boolean
- `canSendCorrection` boolean

### POST /api/profile/verification-request
Комментарий для ИИ: отправка запроса на верификацию.
Request body:
- `companyName` string
- `role` string
- `sector` string (`design|sales|marketing|it|other`)
- `proofType` string (`email|linkedin|website`)
- `proofValue` string
- `comment` string (опционально)
Response 201:
```json
{ "ok": true, "request": { ... } }
```
Ошибки:
- `503 Verification storage unavailable`
- `409 VERIFICATION_ALREADY_SUBMITTED`
- `400 Invalid request payload`

### POST /api/profile/verification-request/correction
Комментарий для ИИ: дополнение/исправление к активной заявке.
Request body:
- `comment` string (>= 5)
Response 200:
```json
{ "ok": true, "request": { ... } }
```
Ошибки:
- `503 Verification storage unavailable`
- `400 Correction text is too short`
- `409 VERIFICATION_CORRECTION_NOT_ALLOWED`

### GET /api/profile/requests
Комментарий для ИИ: список заявок пользователя.
Response 200:
```json
{ "items": [ ...OrderRequestItem ] }
```

### PATCH /api/profile/welcome-dismiss
Комментарий для ИИ: скрыть welcome-блок.
Response 200:
```json
{ "ok": true, "welcomeDismissed": true }
```

### PATCH /api/profile/settings
Комментарий для ИИ: обновление базовых настроек профиля.
Request body:
- `displayName` string
- `notificationsEnabled` boolean
- `showInDirectory` boolean
- `telegramUsername` string
- `city` string (обязателен)
Response 200:
```json
{ "ok": true, "user": { "displayName": "...", "city": "...", "notificationsEnabled": true, "showInDirectory": true } }
```
Ошибки:
- `400 Город обязателен`

### POST /api/profile/telegram/link/start
Комментарий для ИИ: запуск линка к Telegram-боту для уведомлений.
Response 200:
```json
{ "ok": true, "url": "https://t.me/<bot>?start=notify", "notificationsEnabled": true }
```
Ошибки:
- `400 TELEGRAM_BOT_NOT_CONFIGURED`

### POST /api/profile/telegram/link/unlink
Комментарий для ИИ: отвязка Telegram и отключение уведомлений.
Response 200:
```json
{ "ok": true, "notificationsEnabled": false }
```

### POST /api/profile/deactivate
Комментарий для ИИ: деактивация аккаунта и пауза всех UNQ.
Response 200:
```json
{ "ok": true, "restoreUntil": "...", "reactivationWindowDays": 30 }
```

## /api/cards
Примечание: часть эндпоинтов публичные, часть требует user-сессию и CSRF.

### GET /api/cards/search
Комментарий для ИИ: быстрый поиск активных карточек по префиксу.
Query:
- `q` string
Response 200:
```json
{ "items": [ { "slug": "AAA000", "name": "...", "slugPrice": 123000 } ] }
```

### GET /api/cards/availability
Комментарий для ИИ: проверка доступности UNQ.
Query:
- `slug` string
- `source` string (опционально)
Response 200:
- `slug` string
- `validFormat` boolean
- `available` boolean
- `reason` string (`available|taken|pending|blocked|invalid_format`)
- `pendingExpiresAt` string|null
- `owner` object|null
- `suggestions` array

### GET /api/cards/availability-bulk
Комментарий для ИИ: пакетная проверка доступности.
Query:
- `slugs` или `items` (строка `AAA000,BBB111`)
- `source` string (опционально)
Response 200:
```json
{ "items": [ { "slug":"AAA000","validFormat":true,"available":true,"reason":"available" } ], "checked": 1 }
```

### POST /api/cards/waitlist
Комментарий для ИИ: подписка на ожидание освобождения UNQ.
Auth: опционально (использует сессию если есть).
CSRF: да.
Request body:
- `slug` string
Response 200:
```json
{ "ok": true, "queued": true|false }
```
Ошибки:
- `400 INVALID_SLUG`
- `409 SLUG_NOT_PENDING`

### GET /api/cards/slug-counter
Комментарий для ИИ: статистика занятых UNQ.
Response 200:
```json
{ "taken": 12345, "total": 1000000 }
```

### GET /api/cards/slug-suggestions
Комментарий для ИИ: подбор свободных вариантов по базе.
Query:
- `base` string (опционально)
- `count` number (опционально, default 5)
Response 200:
```json
{ "suggestions": ["AAA000","AAA001"] }
```

### GET /api/cards/slug-generate-affordable
Комментарий для ИИ: генератор доступного по цене UNQ.
Query:
- `source` string (опционально)
Response 200:
- `ok` boolean
- `slug` string
- `estimatedPrice` number
- `segment` string
- `cache` string (`hit|miss`)
- `ttlMs` number

### GET /api/cards/slug-price
Комментарий для ИИ: расчет цены UNQ.
Query:
- `slug` string
Response 200:
- `slug` string
- `validFormat` boolean
- `price` number
- `basePrice` number
- `calculatedPrice` number
- `calculation.*` детали
- `hasFlashSale` boolean
- `discountAmount` number
- `discountPercent` number
- `flashSaleId` string|null
- `source` string (`override|calculator`)
Ошибки:
- `400 validFormat=false`

### GET /api/cards/pricing
Комментарий для ИИ: текущие цены тарифов и браслета.
Response 200:
- `planBasicPrice` number
- `planPremiumPrice` number
- `premiumUpgradePrice` number
- `pricingFootnote` string
- `braceletPrice` number
- `userPlan` string

### GET /api/cards/order-precheck
Комментарий для ИИ: предварительная проверка возможности покупки.
Query:
- `requestedPlan` или `plan` (`basic|premium`)
- `promoCode` или `promo` (опционально)
- опциональные параметры атрибуции: `ref`, `refCode`, `refSource`, `refOffer`
Response 200 (основные поля):
- `authenticated` boolean
- `accountStatus` string
- `currentPlan` string
- `requestedPlan` string
- `resolvedPlan` string
- `canPurchase` boolean
- `nextAction` string
- `message` string
- `pricing.*` + `pricing.braceletPrice` + `pricing.planChargePreview`
- `limits.activeOrdersLimit` number
- `limits.activeOrdersCount` number
- `limits.slugLimit` number
- `limits.userSlugsCount` number
- `referral.*` (refCode, hasReferrer, firstOrderEligible, inviteeDiscountCandidate, bonusSpendCandidate, capPercent, breakdown, fraudVerdict)
- `promo.*` (applied, name, discountType, discountValue, policy)
- `pendingOrder` object|null

### GET /api/cards/slug-pricing-config
Комментарий для ИИ: полная конфигурация прайсинга по символам.
Response 200: объект конфигурации (как `getSlugPricingConfig`).

### POST /api/cards/order-request
Комментарий для ИИ: создание заказа на UNQ.
Auth: требуется user-сессия.
CSRF: да.
Request body (schema):
- `name` string
- `letters` string (AAA)
- `digits` string (000)
- `tariff` string (`basic|premium`)
- `theme` string (опционально)
- `products.digitalCard` boolean
- `products.bracelet` boolean
- `dropId` uuid (опционально)
- `refCode` string (опционально)
- `refSource` string (опционально)
- `refOffer` string (опционально)
- `promoCode` string (опционально)
Response 200 (основные поля):
- `ok` boolean
- `orderId` string
- `pendingExpiresAt` string|null
- `telegramDelivered` boolean
- `pricing.*` (slugBasePrice, slugPriceAfterProductDiscount, productDiscountAmount, campaignApplied, promoDiscountApplied, inviteeDiscountApplied, bonusSpent, discountCapApplied, fraudVerdict, fraudHint, slugPrice, planPrice, braceletPrice, totalOneTime)
- `referral.*` (enabled, source, offer, campaignApplied, campaignType, campaignName, campaignId, refCode, hasReferrer, firstOrderEligible, walletBalance, capPercent, rewardAmount, fraudVerdict)
- `promo` object (snapshot)
- `payment` object
- `paymentLinks.telegramUrl` string
- `flashSale` object|null
- `warning` string (если Telegram не доставился)
Ошибки:
- `401 AUTH_REQUIRED`
- `403 ACCOUNT_DISABLED`
- `400 Validation failed` (с `issues`)
- `429 TOO_MANY_ACTIVE_ORDERS`
- `409 SLUG_NOT_AVAILABLE`

### POST /api/cards/order-request/:orderId/cancel
Комментарий для ИИ: отмена собственного заказа.
Auth: требуется user-сессия.
Request params:
- `orderId` string
Response 200:
```json
{ "ok": true, "message": "Заказ отменён, slug освобождён", "orderId": "...", "slug": "AAA000" }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 Order ID is required`
- `404 Заказ не найден`
- `403 Это не ваш заказ`
- `400 Нельзя отменить заказ в статусе ...`

### POST /api/cards/:slug/click
Комментарий для ИИ: лог клика по кнопке визитки.
Request body:
- `buttonType` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `404 Card not found`

### POST /api/cards/:slug/view
Комментарий для ИИ: лог просмотра визитки.
Request body/query:
- `src` string (опционально)
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `404 Card not found`

### GET /api/cards/:slug/vcf
Комментарий для ИИ: выгрузка vCard.
Response: `text/vcard; charset=utf-8`, файл `AAA000.vcf`.
Ошибки:
- `404 Card not found`

## /api/features
Примечание: часть эндпоинтов требует user-сессию; некоторые POST требуют CSRF + same-origin.

### GET /api/public/live-stats
Комментарий для ИИ: публичная статистика платформы.
Response 200:
```json
{ "activeCardsTotal": 0, "todayCreated": 0, "todayActivated": 0, "todayTotal": 0, "onlineNow": 0 }
```

### GET /api/leaderboard
Комментарий для ИИ: публичная таблица лидеров.
Query:
- `period` string (`day|week|month|all`)
Response 200:
- `period` string
- `generatedAt` string
- `items` array
- `limit` number
Ошибки:
- `404 Not found` (если фича выключена)

### GET /api/leaderboard/me
Комментарий для ИИ: позиция пользователя в лидерборде.
Auth: требуется user-сессия.
Query:
- `period` string
Response 200:
```json
{ "item": { ... } }
```

### GET /api/flash-sale/active
Комментарий для ИИ: активная flash-распродажа.
Response 200:
```json
{ "active": false }
```
Или:
```json
{ "active": true, "sale": { "id":"...","title":"...","description":"...","discountPercent":10,"startsAt":"...","endsAt":"...","conditionType":"...","conditionLabel":"..." } }
```

### GET /api/drops
Комментарий для ИИ: список дропов.
Response 200:
- `upcoming` array
- `live` array
- `past` array
- `items` array

### GET /api/drops/:id
Комментарий для ИИ: детальная информация дропа.
Response 200: объект дропа + `waitlistCount`, `remaining`, `slugsPool` (только если `isLive`).
Ошибки:
- `404 Drop not found`

### GET /api/drops/:id/live
Комментарий для ИИ: live-статистика дропа.
Response 200: объект `stats`.
Ошибки:
- `404 Drop not found`

### POST /api/drops/:id/waitlist
Комментарий для ИИ: запись в лист ожидания дропа.
Auth: требуется user-сессия.
CSRF: да.
Response 200:
```json
{ "ok": true, "waitlistCount": 0, "alreadyJoined": false }
```
Ошибки:
- `404 Drop not found`
- `409 DROP_CLOSED`
- `409 DROP_ALREADY_LIVE`
- `409 TELEGRAM_NOT_LINKED`

### GET /api/referrals/bootstrap
Комментарий для ИИ: базовые данные реферальной программы.
Auth: требуется user-сессия.
Response 200: объект `getReferralBootstrap`:
- `refCode`, `refLink`
- `stats` (invited, paid, rewarded, rewardsAmount)
- `bonus` (balance, totalEarned, totalSpent, history[])
- `referrals` array
- `campaigns` array
- `fraud` array
- `rewards` array

### POST /api/referrals/rewards/:rewardRuleId/claim
Комментарий для ИИ: клейм вознаграждения.
Auth: требуется user-сессия.
CSRF: да.
Response 200:
```json
{ "ok": true, "reward": { ... } }
```
Ошибки:
- `400 CLAIM_FAILED`

### GET /api/referrals/bonus
Комментарий для ИИ: баланс бонусного кошелька.
Auth: требуется user-сессия.
Response 200:
- `balance` number
- `history` array (ledger items)

### GET /api/referrals/campaigns/active
Комментарий для ИИ: активные кампании.
Response 200:
```json
{ "items": [ { "id":"...","name":"...","type":"...","source":"...","offer":"...","promoCode":"...","startsAt":"...","endsAt":"...","priority":0 } ] }
```

### POST /api/referrals/promo/validate
Комментарий для ИИ: проверка промокода.
CSRF: да.
Request body:
- `promoCode` string
Response 200:
- `ok` boolean
- `valid` boolean
- `promoCode` string
- `name` string
- `discountType` string
- `discountValue` number
- `policy.enabled` boolean
- `policy.firstOrderOnly` boolean
Ошибки:
- `400 PROMO_CODE_REQUIRED`

## /api (mobile)
Примечание: все эндпоинты требуют user-сессию. Часть `POST|PATCH` требует CSRF + same-origin.

### GET /api/me
Комментарий для ИИ: базовый профиль для мобильного клиента.
Response 200:
- `user` объект (`id`, `firstName`, `lastName`, `displayName`, `username`, `email`, `plan`, `status`, `name`, `slug`, `card`)
- `slugs` array (`fullSlug`, `isPrimary`, `status`)
- `selectedSlug` string|null
Ошибки:
- `401 AUTH_REQUIRED`
- `404 USER_NOT_FOUND`

### GET /api/analytics/summary
Комментарий для ИИ: краткая сводка аналитики по всем UNQ пользователя.
Response 200:
- `summary.totalTaps` number
- `summary.todayTaps` number
- `summary.growth` number
- `summary.weekTaps` array (7)
- `summary.monthTaps` array (30)
- `summary.sources` array (`source`,`count`,`percent`)
- `summary.geo` array (`city`,`value`,`x`,`y`,`r`)
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/analytics/recent
Комментарий для ИИ: последние визиты (taps).
Response 200:
```json
{ "items": [ { "id":"...","slug":"AAA000","source":"nfc","name":"...","timestamp":"..." } ] }
```
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/analytics/sources
Комментарий для ИИ: распределение источников.
Query:
- `period` string (`7d|30d|all`)
Response 200:
```json
{ "items": [ { "source":"nfc", "count": 10, "percent": 50.0 } ] }
```
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/analytics/geo
Комментарий для ИИ: топ географий посетителей.
Response 200:
```json
{ "items": [ { "city":"Tashkent", "country":"UZ", "count": 5 } ] }
```
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/contacts
Комментарий для ИИ: список контактов пользователя.
Query:
- `q` string (поиск)
Response 200:
- `items` array (`slug`, `name`, `avatarUrl`, `phone`, `taps`, `saved`, `subscribed`, `tag`, `lastSeen`)
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/directory
Комментарий для ИИ: публичный каталог.
Query:
- `q` string (поиск)
- `page` number
- `limit` number (max 50)
Response 200:
- `items` array (`slug`, `name`, `avatarUrl`, `city`, `tag`, `taps`, `subscribed`, `saved`)
- `page` number
- `limit` number
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/directory/:slug
Комментарий для ИИ: профиль пользователя из каталога.
Response 200:
```json
{ "profile": { "slug":"AAA000", "slugs":["AAA000"], "slugPrice":123000, "name":"...", "avatarUrl":null, "city":"...", "tag":"basic", "taps":0, "role":"...", "bio":"...", "email":"...", "phone":"...", "buttons":[], "tags":[], "subscribed":false, "saved":false } }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

### POST /api/contacts/:slug/save
Комментарий для ИИ: сохранить/убрать контакт.
CSRF: да.
Response 200:
```json
{ "ok": true, "saved": true|false }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### POST /api/contacts/:slug/subscribe
Комментарий для ИИ: подписаться/отписаться на контакт.
CSRF: да.
Response 200:
```json
{ "ok": true, "subscribed": true|false }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### GET /api/nfc/history
Комментарий для ИИ: история NFC операций.
Response 200:
```json
{ "items": [ { "id":"...","slug":"AAA000","uid":"...","type":"read|write|verify|lock","timestamp":"..." } ] }
```
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/nfc/tags
Комментарий для ИИ: список NFC меток пользователя.
Response 200:
```json
{ "items": [ { "uid":"...","name":"...","linkedSlug":"AAA000","status":"...","tapCount":0,"lastTapAt":"..." } ] }
```
Ошибки:
- `401 AUTH_REQUIRED`

### POST /api/nfc/scan
Комментарий для ИИ: запись скана NFC (read) + опциональный tap.
CSRF: да.
Request body:
- `uid` string
- `url` string
- `recordTap` boolean (default true)
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`

### POST /api/nfc/tap
Комментарий для ИИ: ручная фиксация tap по ownerSlug.
CSRF: да.
Request body:
- `ownerSlug` string
- `source` string (опционально)
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`
- `404 SLUG_NOT_FOUND`

### POST /api/nfc/write
Комментарий для ИИ: запись в NFC метку (write).
CSRF: да.
Request body:
- `uid` string
- `url` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`

### POST /api/nfc/verify
Комментарий для ИИ: верификация метки (verify).
CSRF: да.
Request body:
- `uid` string
- `url` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`

### POST /api/nfc/lock
Комментарий для ИИ: операция lock с паролем.
CSRF: да.
Request body:
- `uid` string
- `password` string (>= 4)
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### PATCH /api/nfc/tags/:uid
Комментарий для ИИ: переименование метки.
CSRF: да.
Request body:
- `name` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### DELETE /api/nfc/tags/:uid
Комментарий для ИИ: удалить метку по uid.
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### DELETE /api/nfc/tags
Комментарий для ИИ: удалить метку по uid через query.
Query:
- `uid` string
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### GET /api/notifications
Комментарий для ИИ: список push уведомлений.
Response 200:
```json
{ "items": [ { "id":"...","type":"system","title":"...","subtitle":"...","read":false,"time":"..." } ] }
```
Ошибки:
- `401 AUTH_REQUIRED`

### POST /api/notifications/read-all
Комментарий для ИИ: пометить все уведомления как прочитанные.
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 AUTH_REQUIRED`

### POST /api/notifications/token
Комментарий для ИИ: регистрация push-токена устройства.
Request body:
- `expoToken` string (ExponentPushToken[])
- `fcmToken` string
- `deviceToken` string (альтернатива)
- `token` string (fallback)
- `platform` string (опционально)
Response 200:
```json
{ "ok": true, "tokensStored": 1 }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### POST /api/notifications/test-send
Комментарий для ИИ: тестовая отправка push.
Request body:
- `title` string
- `body` string
- `data` object (опционально)
Response 200:
```json
{ "ok": true, "result": { ... } }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

### GET /api/wristband/status
Комментарий для ИИ: статус последнего заказа браслета.
Response 200:
```json
{ "status": null }
```
Или:
```json
{ "status": { "status":"paid", "linkedSlug":"AAA000", "orderId":"...", "model":"wristband", "updatedAt":"..." } }
```
Ошибки:
- `401 AUTH_REQUIRED`

### GET /api/orders/:id/status
Комментарий для ИИ: статус конкретного заказа.
Response 200:
```json
{ "order": { "id":"...","status":"paid","createdAt":"...","estimatedAt":"..." } }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `404 ORDER_NOT_FOUND`

### PATCH /api/me/card
Комментарий для ИИ: упрощенное обновление визитки из мобильного клиента.
CSRF: да.
Request body:
- `name` string (обязателен)
- `buttons` array `{ icon,label,url }`
- `theme` string (`light|dark|gradient`)
- `job` string
- `email` string
- `phone` string
- `telegram` string
Response 200:
```json
{ "ok": true, "card": { ... } }
```
Ошибки:
- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`

## /api/payments
### POST /api/payments/payme/webhook
### POST /api/payments/payme/webhook/:secret
Комментарий для ИИ: webhook Payme для авто-подтверждения оплат.
Auth: секрет через заголовок/параметр/тело (если настроен `PAYME_WEBHOOK_SECRET`).
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 Unauthorized webhook`

## /api/telegram
### POST /api/telegram/webhook
### POST /api/telegram/webhook/:secret
Комментарий для ИИ: webhook Telegram-бота для изменения статусов заказов.
Auth: секрет `TELEGRAM_WEBHOOK_SECRET` в `x-telegram-bot-api-secret-token` или query/path.
Response 200:
```json
{ "ok": true }
```
Ошибки:
- `401 Unauthorized webhook`

## /api/admin (админ-панель)
Примечание: все эндпоинты требуют staff-сессию (`requireStaffApi`), `x-csrf-token` и same-origin для write методов.
Комментарий для ИИ: эти эндпоинты предназначены для админки, мобильному клиенту обычно не нужны.

Эндпоинты (кратко):
- `GET /api/admin/navigation-summary` — сводка навигации админки.
- `GET /api/admin/staff` — список staff.
- `POST /api/admin/staff` — создать staff.
- `PATCH /api/admin/staff/:id` — обновить staff.
- `PATCH /api/admin/staff/:id/password` — смена пароля staff.
- `GET /api/admin/cards` — список карточек.
- `POST /api/admin/cards` — создать карточку.
- `GET /api/admin/cards/:id` — получить карточку.
- `PATCH /api/admin/cards/:id` — обновить карточку.
- `DELETE /api/admin/cards/:id` — удалить карточку.
- `PATCH /api/admin/cards/:id/toggle-active` — toggle активности.
- `PATCH /api/admin/cards/:id/tariff` — смена тарифа.
- `POST /api/admin/cards/:id/avatar` — загрузка аватара.
- `DELETE /api/admin/cards/:id/avatar` — удалить аватар.
- `GET /api/admin/orders` — список заказов.
- `PATCH /api/admin/orders/:id/status` — смена статуса заказа.
- `POST /api/admin/orders/:id/extend-pending` — продление pending.
- `POST /api/admin/orders/:id/activate` — активация заказа.
- `DELETE /api/admin/orders/:id` — удалить заказ.
- `GET /api/admin/users` — список пользователей.
- `GET /api/admin/users/check` — проверка логина/email.
- `POST /api/admin/users` — создать пользователя.
- `GET /api/admin/users/:userId/card` — карточка пользователя.
- `PATCH /api/admin/users/:userId/profile` — обновить профиль.
- `POST /api/admin/users/:userId/slugs` — добавить UNQ.
- `PATCH /api/admin/users/:userId/slugs/:slug` — обновить UNQ.
- `DELETE /api/admin/users/:userId/slugs/:slug` — удалить UNQ.
- `PUT /api/admin/users/:userId/card` — обновить визитку.
- `POST /api/admin/users/:userId/card/avatar` — аватар.
- `DELETE /api/admin/users/:userId/card/avatar` — удалить аватар.
- `PATCH /api/admin/users/:userId/login` — смена логина.
- `PATCH /api/admin/users/:userId/plan` — смена тарифа.
- `PATCH /api/admin/users/:userId/verification` — верификация.
- `PATCH /api/admin/users/:userId/unverify` — снять верификацию.
- `POST /api/admin/users/:userId/views` — добавить просмотры.
- `POST /api/admin/users/:userId/views/reduce` — уменьшить просмотры.
- `PATCH /api/admin/users/:userId/block` — блокировка.
- `PATCH /api/admin/users/:userId/unblock` — разблокировка.
- `DELETE /api/admin/users/:userId/purge` — полное удаление.
- `GET /api/admin/orders/export.csv` — экспорт заказов.
- `GET /api/admin/purchases` — список покупок.
- `GET /api/admin/purchases/export.csv` — экспорт покупок.
- `GET /api/admin/payment-events` — лог платежей.
- `GET /api/admin/payment-events/export.csv` — экспорт лога.
- `GET /api/admin/payment-stats` — статистика платежей.
- `GET /api/admin/payment-alerts` — платежные алерты.
- `GET /api/admin/conversion-funnel` — конверсия.
- `POST /api/admin/payment-alerts/notify` — уведомление по алертам.
- `GET /api/admin/slugs/stats` — статистика UNQ.
- `GET /api/admin/slugs` — список UNQ.
- `PATCH /api/admin/slugs/:slug/state` — изменить состояние.
- `PATCH /api/admin/slugs/:slug/activate` — активировать.
- `PATCH /api/admin/slugs/:slug/price-override` — override цены.
- `GET /api/admin/bracelet-orders` — заказы браслетов.
- `PATCH /api/admin/bracelet-orders/:id/status` — статус браслета.
- `GET /api/admin/testimonials` — отзывы.
- `POST /api/admin/testimonials` — создать отзыв.
- `PATCH /api/admin/testimonials/:id` — обновить отзыв.
- `PATCH /api/admin/testimonials/:id/visibility` — видимость.
- `DELETE /api/admin/testimonials/:id` — удалить отзыв.
- `GET /api/admin/analytics` — аналитика.
- `GET /api/admin/platform-analytics` — аналитика платформы.
- `GET /api/admin/verification-requests` — заявки на верификацию.
- `POST /api/admin/verification-requests/:id/approve` — апрув.
- `POST /api/admin/verification-requests/:id/reject` — отклонение.
- `GET /api/admin/directory-exclusions` — исключения из каталога.
- `POST /api/admin/directory-exclusions` — добавить исключение.
- `DELETE /api/admin/directory-exclusions/:slug` — удалить исключение.
- `GET /api/admin/logs` — логи.
- `GET /api/admin/cards/:id/stats` — статистика карточки.
- `GET /api/admin/stats` — общая статистика.
- `POST /api/admin/slug/next` — следующий свободный UNQ.
- `POST /api/admin/push/test-user` — тест push.
- `POST /api/admin/push/broadcast` — массовый push.
- `POST /api/admin/push/broadcast/start` — запуск рассылки.
- `GET /api/admin/push/broadcast/jobs/:jobId` — статус рассылки.
- `POST /api/admin/logs/cleanup` — очистка логов.

## /api/admin (features)
Примечание: требует admin-сессию (`requireAdminApi`). CSRF в этом роутере не включён.
Комментарий для ИИ: управление фичами, рефералками, промокодами, дропами и flash-sale.

Эндпоинты (кратко):
- `GET /api/admin/leaderboard`
- `PATCH /api/admin/leaderboard/settings`
- `PATCH /api/admin/leaderboard/exclusions/:slug`
- `POST /api/admin/leaderboard/reset-user/:userId`
- `GET /api/admin/leaderboard/suspicious`
- `GET /api/admin/score/settings`
- `PATCH /api/admin/score/settings`
- `GET /api/admin/score/overview`
- `POST /api/admin/score/recalculate/:userId`
- `POST /api/admin/score/recalculate-all`
- `GET /api/admin/score/runs`
- `GET /api/admin/referrals/stats`
- `GET /api/admin/referrals`
- `GET /api/admin/referrals/campaigns`
- `POST /api/admin/referrals/campaigns`
- `PATCH /api/admin/referrals/campaigns/:id`
- `DELETE /api/admin/referrals/campaigns/:id`
- `GET /api/admin/referrals/campaigns/:id/usage`
- `GET /api/admin/promocodes`
- `POST /api/admin/promocodes`
- `PATCH /api/admin/promocodes/:id`
- `DELETE /api/admin/promocodes/:id`
- `GET /api/admin/promocodes/settings`
- `PATCH /api/admin/promocodes/settings`
- `GET /api/admin/referrals/fraud`
- `PATCH /api/admin/referrals/fraud/:id/verdict`
- `GET /api/admin/referrals/ledger`
- `GET /api/admin/referrals/summary`
- `PATCH /api/admin/referrals/:id/status`
- `POST /api/admin/referrals/:id/reward`
- `PATCH /api/admin/referrals/settings`
- `GET /api/admin/referrals/settings`
- `GET /api/admin/pricing/settings`
- `GET /api/admin/settings/changes`
- `GET /api/admin/settings/:group`
- `PATCH /api/admin/settings/:group`
- `POST /api/admin/settings/:group/reset/:key`
- `PATCH /api/admin/pricing/settings`
- `GET /api/admin/flash-sales`
- `POST /api/admin/flash-sales`
- `PATCH /api/admin/flash-sales/:id`
- `POST /api/admin/flash-sales/:id/stop`
- `DELETE /api/admin/flash-sales/:id`
- `GET /api/admin/flash-sales/:id/stats`
- `GET /api/admin/drops`
- `POST /api/admin/drops`
- `PATCH /api/admin/drops/:id`
- `PATCH /api/admin/drops/:id/slugs`
- `POST /api/admin/drops/:id/finish`
- `DELETE /api/admin/drops/:id`
- `GET /api/admin/drops/:id/live`
- `GET /api/admin/drops/:id/waitlist`
- `POST /api/admin/drops/:id/notify-manual`
