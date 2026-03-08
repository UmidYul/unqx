# Express Migration Preview

Express-only implementation of UNQX without Next.js and without frontend build tools.

## Stack

- Express + EJS (SSR HTML)
- PostgreSQL + JS migrations
- express-session + connect-pg-simple
- Vanilla HTML/CSS/JS + local vendor bundles (SortableJS, CropperJS, Chart.js, qrcode)

## Run

```bash
npm install
npm run migrate
npm run dev
```

`npm install` runs `postinstall` and generates Prisma Client automatically.

Production:

```bash
npm run start
```

Default URL: `http://127.0.0.1:3100`

## DB Backup (Google Drive + Telegram status)

Run manual backup:

```bash
npm run backup:db
```

What it does:

- Creates PostgreSQL dump via `pg_dump` (custom format).
- Uploads dump to Google Drive via `rclone` remote.
- Deletes local temp file after upload.
- Applies retention by count (`BACKUP_KEEP_FILES`).
- Sends Telegram message on success/failure.

Required setup:

1. Install `rclone` on server.
2. Run `rclone config` and create remote (example name: `gdrive`).
3. Set env:

```env
BACKUP_RCLONE_REMOTE="gdrive:unqx-backups"
BACKUP_KEEP_FILES=14
BACKUP_NOTIFY_TELEGRAM=true
BACKUP_TELEGRAM_CHAT_ID="-1001234567890"
BACKUP_STATUS_URL="https://your-domain.com/admin/dashboard"
```

Scheduling examples:

- `cron` (daily at 03:20):

```cron
20 3 * * * cd /path/to/unqx && /usr/bin/npm run backup:db >> /var/log/unqx-backup.log 2>&1
```

- `systemd timer`: call the same `npm run backup:db` command.

## Environment

Env is read from:

1. `.env` in project root (if exists)
2. root `.env` (fallback)

Required:

```env
DATABASE_URL="postgresql://..."
ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH="$2b$10$..."
```

Optional compatibility/fallback:

```env
DIRECT_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3100"
NEXT_PUBLIC_APP_URL="http://localhost:3100"
NEXTAUTH_SECRET="change-me"
SESSION_SECRET="change-me-better"
TIMEZONE="Asia/Tashkent"
PORT=3100
TRUST_PROXY=1
SESSION_COOKIE_SECURE="auto"
SESSION_MAX_AGE_MINUTES=120
SESSION_ROLLING=true
TELEGRAM_BOT_TOKEN="123456:replace_me"
TELEGRAM_CHAT_ID="-1001234567890"
TELEGRAM_WEBHOOK_SECRET="replace_with_random_secret"
```

Semi-automatic payments (current mode):

- `payment_provider` in `platform_settings` should be `manual_tg`.
- New order is sent to admin Telegram chat with action buttons `Связались`, `Оплачено`, `Активировать`.
- Recommended sequence: `Связались` -> `Оплачено` -> `Активировать`.
- Bot webhook endpoint: `POST /api/telegram/webhook`.
- If `TELEGRAM_WEBHOOK_SECRET` is set, requests must include matching
	`x-telegram-bot-api-secret-token` header.
- To prepare migration to gateways later, configure optional settings now:
	`payment_click_merchant_id`, `payment_payme_merchant_id`.

Notes for hosting:

- If admin login refreshes without entering dashboard, usually the session cookie is not being set behind reverse proxy.
- Keep `SESSION_COOKIE_SECURE=auto` and set `TRUST_PROXY` according to your host (often `1` or `true`).

## Endpoints

Pages:

- `/`
- `/:slug`
- `/admin`
- `/admin/dashboard`
- `/admin/cards/new`
- `/admin/cards/:id/edit`
- `/admin/stats`
- `/admin/logs`
- `/robots.txt`
- `/sitemap.xml`

API:

- `GET/POST /api/admin/cards`
- `GET/PATCH/DELETE /api/admin/cards/:id`
- `PATCH /api/admin/cards/:id/toggle-active`
- `POST /api/admin/cards/:id/avatar`
- `DELETE /api/admin/cards/:id/avatar`
- `GET /api/admin/cards/:id/stats`
- `GET /api/admin/stats`
- `POST /api/admin/slug/next`
- `POST /api/admin/logs/cleanup`
- `POST /api/cards/:slug/view`
- `GET /api/cards/:slug/vcf`
- `GET /api/cards/search?q=AAA`
- `POST /api/cards/order-request`
- `POST /api/cards/order-request/:orderId/cancel`
- `POST /api/telegram/webhook`
- `GET /api/admin/payment-events`
- `GET /api/admin/payment-events/export.csv`
- `GET /api/admin/payment-stats?period=day|week|month|all`
- `GET /api/admin/payment-alerts`
- `GET /api/admin/conversion-funnel?period=day|week|month`
- `POST /api/admin/payment-alerts/notify`

### User Order Cancellation

Users can cancel their own orders if they are still in "new" status (not yet contacted by admin).

#### Cancel Order (`POST /api/cards/order-request/:orderId/cancel`)
Allows authenticated users to cancel their pending orders.

**Requirements:**
- User must be authenticated
- Order must belong to the user
- Order status must be "new"

**What happens:**
- Order status changed to "rejected" with note "Отменено пользователем"
- Slug is freed and becomes available again
- Payment event logged with source "user_cancel"

**Response:**
```json
{
  "ok": true,
  "message": "Заказ отменён, slug освобождён",
  "orderId": "order-uuid",
  "slug": "AAA001"
}
```

**Error cases:**
- 400: Order not in "new" status
- 403: Order belongs to different user
- 404: Order not found

### Payment Analytics & Monitoring

The system includes comprehensive payment analytics and monitoring:

#### Dashboard Statistics (`GET /api/admin/payment-stats`)
Returns aggregated payment statistics for specified period:
- Orders by status (new, contacted, paid, approved, rejected, expired)
- Payment events by status
- Revenue by provider
- Total slugs sold and active users

Query parameters:
- `period`: `day` (default), `week`, `month`, or `all`

#### Payment Alerts (`GET /api/admin/payment-alerts`)
Returns actionable alerts for admin attention:
- **Critical**: Orders marked "paid" but not "approved" > 2 hours
- **Warning**: Pending orders > 24 hours, payment event mismatches
- **Info**: Orders "contacted" > 48 hours

#### Conversion Funnel (`GET /api/admin/conversion-funnel`)
Returns order conversion metrics through the payment flow:
- new → contacted → paid → approved
- Conversion rates between stages
- Drop-off analysis (rejected, expired)

Query parameters:
- `period`: `day`, `week` (default), or `month`

#### Telegram Notifications (Automated Cron)
The system includes a standalone script for automated payment monitoring.

**Setup cron job on your server:**

1. Edit crontab:
```bash
crontab -e
```

2. Add one of these schedules:

```bash
# Every 2 hours (recommended)
0 */2 * * * cd /path/to/unqx && node scripts/check-payment-alerts.js >> logs/payment-alerts.log 2>&1

# Every hour (for high-volume)
0 * * * * cd /path/to/unqx && node scripts/check-payment-alerts.js >> logs/payment-alerts.log 2>&1

# Every 4 hours (for low-volume)
0 */4 * * * cd /path/to/unqx && node scripts/check-payment-alerts.js >> logs/payment-alerts.log 2>&1
```

**What it does:**
- Automatically checks for critical/warning payment alerts
- Sends Telegram notification only when issues found
- Includes order details (slug, amount, age)
- Logs all activity for debugging

**Manual trigger (for testing):**
```bash
# Using npm script
npm run cron:alerts

# Or directly
node scripts/check-payment-alerts.js
```

**Alternative: External service (cron-job.org):**
If your hosting doesn't support cron, use external service:
```
POST https://yourdomain.com/api/admin/payment-alerts/notify
Authorization: Bearer <admin_token>
Schedule: Every 2 hours
```

## Visual Compare (Next vs Express)

Artifacts are written to `artifacts/visual`:

- `next/<route>/<state>/<viewport>.png`
- `express/<route>/<state>/<viewport>.png`
- `diff/<route>/<state>/<viewport>.png`

### 1) Seed deterministic fixture

```bash
npm run seed:visual
```

Creates/updates visual fixture cards (`AAA001` active, `AAA002` inactive), demo cards, view logs, and sample error logs.

### 2) Run screenshot diff

Start both apps first (in separate terminals):

- Next reference (root project): `npm run dev`
- Express candidate (this project): `npm run dev`

Then run:

```bash
VISUAL_ADMIN_PASSWORD="your_admin_plain_password" npm run test:visual
```

Optional env:

- `NEXT_BASE_URL` (default `http://127.0.0.1:3000`)
- `EXPRESS_BASE_URL` (default `http://127.0.0.1:3100`)
- `VISUAL_ACTIVE_SLUG` (default `AAA001`)
- `VISUAL_UNAVAILABLE_SLUG` (default `AAA002`)
- `VISUAL_NOT_FOUND_SLUG` (default `ZZZ404`)
- `VISUAL_DIFF_THRESHOLD` (default `0.002` i.e. `0.2%`)
- `VISUAL_ERROR_500_PATH` (optional route to capture 500 page)

Combined helper:

```bash
npm run test:visual:seed
```

## Tests

```bash
npm test
```

Integration/e2e are opt-in:

```bash
INTEGRATION_RUN=1 npm test
E2E_RUN=1 npm run test:e2e
```
