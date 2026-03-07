# API Contracts (UNQX)

Base URL: `/`

## Conventions

- JSON content type: `application/json` (except explicit CSV/VCF/file upload endpoints).
- Session auth cookie: `unqx.sid`.
- CSRF header for write methods: `x-csrf-token`.
- Most write endpoints also enforce same-origin.

## Shared Error Shape

```json
{
  "error": "Human readable message",
  "code": "MACHINE_CODE"
}
```

---

## Auth API (`/api/auth`)

| Method | Path | Auth | Request body | Success response |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public + CSRF | `firstName`, `email`, `password`, `confirmPassword` | `{ ok, redirectTo, email }` |
| POST | `/api/auth/send-otp` | Public + CSRF | `email` | `{ ok }` |
| POST | `/api/auth/verify-email` | Public + CSRF | `email`, `code(6)` | `{ ok, redirectTo, user }` |
| POST | `/api/auth/login` | Public + CSRF | `email`, `password`, `rememberMe?` | `{ ok, redirectTo, user }` |
| POST | `/api/auth/forgot-password` | Public + CSRF | `email` | `{ ok, message, redirectTo }` |
| POST | `/api/auth/reset-password` | Public + CSRF | `email`, `code(6)`, `newPassword`, `confirmPassword` | `{ ok, redirectTo }` |
| POST | `/api/auth/change-email/request` | User + CSRF | `email`, `currentPassword` | `{ ok, pendingEmail }` |
| POST | `/api/auth/change-email/verify` | User + CSRF | `code(6)` | `{ ok, user }` |
| POST | `/api/auth/change-password` | User + CSRF | `currentPassword`, `newPassword`, `confirmPassword` | `{ ok }` |
| GET | `/api/auth/me` | Optional | - | `{ authenticated: false }` or `{ authenticated: true, user }` |
| POST | `/api/auth/logout` | Optional + CSRF | - | `{ ok, csrfToken }` |

`user` payload fields: `id, email, emailVerified, firstName, lastName, username, displayName, plan, effectivePlan, planPurchasedAt, planUpgradedAt, status`.

---

## Public Cards API (`/api/cards`)

| Method | Path | Auth | Input | Success response |
|---|---|---|---|---|
| GET | `/api/cards/search` | Public | query: `q` | `{ items: [{ slug, name }] }` |
| GET | `/api/cards/availability` | Public | query: `slug`, `source?` | `{ slug, validFormat, available, reason, pendingExpiresAt, owner, suggestions }` |
| POST | `/api/cards/waitlist` | Optional + CSRF | `{ slug }` | `{ ok, queued }` |
| GET | `/api/cards/slug-counter` | Public | - | `{ taken, total }` |
| GET | `/api/cards/slug-suggestions` | Public | query: `base?`, `count?` | `{ suggestions: string[] }` |
| GET | `/api/cards/slug-price` | Public | query: `slug` | `{ slug, validFormat, price, basePrice, hasFlashSale, discountAmount, discountPercent, flashSaleId, source }` |
| GET | `/api/cards/pricing` | Optional | - | pricing settings + `{ braceletPrice, userPlan }` |
| GET | `/api/cards/slug-pricing-config` | Public | - | slug pricing config object |
| POST | `/api/cards/order-request` | User + CSRF | order payload (name, letters, digits, tariff, products, theme?, dropId?) | `{ ok, orderId, pendingExpiresAt, telegramDelivered, pricing, flashSale?, warning? }` |
| POST | `/api/cards/:slug/click` | Public | `{ buttonType? }` | `{ ok }` |
| POST | `/api/cards/:slug/view` | Public | query/body: `src?` | `{ ok }` |
| GET | `/api/cards/:slug/vcf` | Public | - | `text/vcard` file download |

---

## Profile API (`/api/profile`)

All endpoints require: authenticated user + same-origin + CSRF.

| Method | Path | Request | Success response |
|---|---|---|---|
| GET | `/api/profile/bootstrap` | - | dashboard bootstrap: `{ user, limits, slugs, card, requests, score, pricing, access }` |
| GET | `/api/profile/slugs` | - | `{ items }` |
| PATCH | `/api/profile/slugs/:slug/status` | `{ status: active|paused|private }` | `{ ok, slug, status }` |
| PATCH | `/api/profile/slugs/:slug/primary` | - | `{ ok, slug, isPrimary }` |
| PATCH | `/api/profile/slugs/:slug/pause-message` | `{ message }` | `{ ok, slug, pauseMessage }` |
| GET | `/api/profile/card` | - | `{ card }` |
| PUT | `/api/profile/card` | card payload (`name`, `role`, `bio`, `tags`, `buttons`, `theme`, etc.) | `{ ok, card }` |
| POST | `/api/profile/card/avatar` | multipart form-data: `file` | `{ ok, avatarUrl }` |
| DELETE | `/api/profile/card/avatar` | - | `{ ok, avatarUrl: null }` |
| GET | `/api/profile/slugs/:slug/qr` | - | `{ slug, url, ownerName, ownerRole, score, isAvailableForPublicQr }` |
| GET | `/api/profile/analytics/bootstrap` | - | `{ slugs, currentPlan, selectedSlug, periods }` |
| GET | `/api/profile/analytics` | query: `slug`, `period?` | analytics object with KPI + chart data |
| GET | `/api/profile/verification` | - | `{ isVerified, latestRequest }` |
| POST | `/api/profile/verification-request` | `{ companyName, role, sector, proofType, proofValue, comment? }` | `201 { ok, request }` |
| GET | `/api/profile/requests` | - | `{ items }` |
| PATCH | `/api/profile/welcome-dismiss` | - | `{ ok, welcomeDismissed: true }` |
| PATCH | `/api/profile/settings` | `{ displayName, notificationsEnabled, showInDirectory, telegramUsername }` | `{ ok, user }` |
| POST | `/api/profile/telegram/link/start` | - | `{ ok, url }` |
| POST | `/api/profile/telegram/link/unlink` | - | `{ ok }` |
| POST | `/api/profile/deactivate` | - | `{ ok }` |

---

## Feature/Public API (`/api`)

| Method | Path | Auth | Input | Success response |
|---|---|---|---|---|
| GET | `/api/public/live-stats` | Public | - | `{ activeCardsTotal, todayCreated, todayActivated, todayTotal, onlineNow }` |
| GET | `/api/leaderboard` | Public | query: `period?` | `{ period, generatedAt, items, limit }` |
| GET | `/api/leaderboard/me` | User | query: `period?` | `{ item }` |
| GET | `/api/flash-sale/active` | Public | - | `{ active: false }` or `{ active: true, sale }` |
| GET | `/api/drops` | Public | - | `{ upcoming, live, past, items }` |
| GET | `/api/drops/:id` | Public | - | drop details |
| GET | `/api/drops/:id/live` | Public | - | live drop stats |
| POST | `/api/drops/:id/waitlist` | User + CSRF | - | `{ ok, waitlistCount }` |
| GET | `/api/referrals/bootstrap` | User | - | referral bootstrap payload |
| POST | `/api/referrals/rewards/:rewardRuleId/claim` | User + CSRF | - | `{ ok, reward }` |

---

## Admin API (`/api/admin`)

All endpoints require admin session; most write methods also enforce CSRF + same-origin.

### Legacy cards (deprecated)

- `GET /api/admin/cards`
- `POST /api/admin/cards`
- `GET /api/admin/cards/:id`
- `PATCH /api/admin/cards/:id`
- `DELETE /api/admin/cards/:id`
- `PATCH /api/admin/cards/:id/toggle-active`
- `PATCH /api/admin/cards/:id/tariff`
- `POST /api/admin/cards/:id/avatar`
- `DELETE /api/admin/cards/:id/avatar`
- `GET /api/admin/cards/:id/stats`

Deprecated methods return `410` with `{ error: "Legacy cards API is deprecated", code: "LEGACY_CARDS_DEPRECATED" }`.

### Orders, users, slugs, analytics, content, settings

| Method | Path |
|---|---|
| GET | `/api/admin/navigation-summary` |
| GET | `/api/admin/orders` |
| PATCH | `/api/admin/orders/:id/status` |
| POST | `/api/admin/orders/:id/extend-pending` |
| POST | `/api/admin/orders/:id/activate` |
| DELETE | `/api/admin/orders/:id` |
| GET | `/api/admin/users` |
| PATCH | `/api/admin/users/:userId/plan` |
| PATCH | `/api/admin/users/:userId/block` |
| PATCH | `/api/admin/users/:userId/unblock` |
| GET | `/api/admin/orders/export.csv` |
| GET | `/api/admin/purchases` |
| GET | `/api/admin/purchases/export.csv` |
| GET | `/api/admin/slugs/stats` |
| GET | `/api/admin/slugs` |
| PATCH | `/api/admin/slugs/:slug/state` |
| PATCH | `/api/admin/slugs/:slug/activate` |
| PATCH | `/api/admin/slugs/:slug/price-override` |
| GET | `/api/admin/bracelet-orders` |
| PATCH | `/api/admin/bracelet-orders/:id/status` |
| GET | `/api/admin/testimonials` |
| POST | `/api/admin/testimonials` |
| PATCH | `/api/admin/testimonials/:id` |
| PATCH | `/api/admin/testimonials/:id/visibility` |
| DELETE | `/api/admin/testimonials/:id` |
| GET | `/api/admin/analytics` |
| GET | `/api/admin/platform-analytics` |
| GET | `/api/admin/verification-requests` |
| POST | `/api/admin/verification-requests/:id/approve` |
| POST | `/api/admin/verification-requests/:id/reject` |
| GET | `/api/admin/directory-exclusions` |
| POST | `/api/admin/directory-exclusions` |
| DELETE | `/api/admin/directory-exclusions/:slug` |
| GET | `/api/admin/logs` |
| GET | `/api/admin/stats` |
| POST | `/api/admin/slug/next` |
| POST | `/api/admin/logs/cleanup` |

### Feature/admin controls (`src/routes/api/admin-features.js`)

| Method | Path |
|---|---|
| GET | `/api/admin/leaderboard` |
| PATCH | `/api/admin/leaderboard/settings` |
| PATCH | `/api/admin/leaderboard/exclusions/:slug` |
| POST | `/api/admin/leaderboard/reset-user/:userId` |
| GET | `/api/admin/leaderboard/suspicious` |
| GET | `/api/admin/score/settings` |
| PATCH | `/api/admin/score/settings` |
| GET | `/api/admin/score/overview` |
| POST | `/api/admin/score/recalculate/:userId` |
| POST | `/api/admin/score/recalculate-all` |
| GET | `/api/admin/score/runs` |
| GET | `/api/admin/referrals/stats` |
| GET | `/api/admin/referrals` |
| PATCH | `/api/admin/referrals/:id/status` |
| POST | `/api/admin/referrals/:id/reward` |
| PATCH | `/api/admin/referrals/settings` |
| GET | `/api/admin/referrals/settings` |
| PATCH | `/api/admin/referrals/rules` |
| GET | `/api/admin/pricing/settings` |
| PATCH | `/api/admin/pricing/settings` |
| GET | `/api/admin/settings/changes` |
| GET | `/api/admin/settings/:group` |
| PATCH | `/api/admin/settings/:group` |
| POST | `/api/admin/settings/:group/reset/:key` |
| GET | `/api/admin/flash-sales` |
| POST | `/api/admin/flash-sales` |
| PATCH | `/api/admin/flash-sales/:id` |
| POST | `/api/admin/flash-sales/:id/stop` |
| GET | `/api/admin/flash-sales/:id/stats` |
| GET | `/api/admin/drops` |
| POST | `/api/admin/drops` |
| PATCH | `/api/admin/drops/:id` |
| PATCH | `/api/admin/drops/:id/slugs` |
| POST | `/api/admin/drops/:id/finish` |
| GET | `/api/admin/drops/:id/live` |
| GET | `/api/admin/drops/:id/waitlist` |
| POST | `/api/admin/drops/:id/notify-manual` |

---

## Telegram API (`/api/telegram`)

| Method | Path | Auth | Request | Success response |
|---|---|---|---|---|
| POST | `/api/telegram/webhook` | Public | Telegram webhook payload | `{ ok: true }` |

---

## Minimal status/error matrix

- `200`/`201`: success.
- `400`: validation or domain error.
- `401`: auth required.
- `403`: forbidden / plan limit / blocked account.
- `404`: resource not found.
- `409`: conflict (slug/drop state conflicts).
- `410`: deprecated endpoint.
- `423`: temporary account lock (login throttling).
- `503`: optional storage unavailable.
