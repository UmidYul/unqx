# Express Migration Preview

Express-only implementation of UNQ+ without Next.js and without frontend build tools.

## Stack

- Express + EJS (SSR HTML)
- Prisma + PostgreSQL
- express-session + connect-pg-simple
- Vanilla HTML/CSS/JS + local vendor bundles (SortableJS, CropperJS, Chart.js, qrcode)

## Run

```bash
cd express-app
npm install
npm run prisma:deploy
npm run dev
```

`npm install` runs `postinstall` and generates Prisma Client automatically.

Production:

```bash
cd express-app
npm run start
```

Default URL: `http://127.0.0.1:3100`

## Environment

Env is read from:

1. `express-app/.env` (if exists)
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
```

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

## Visual Compare (Next vs Express)

Artifacts are written to `express-app/artifacts/visual`:

- `next/<route>/<state>/<viewport>.png`
- `express/<route>/<state>/<viewport>.png`
- `diff/<route>/<state>/<viewport>.png`

### 1) Seed deterministic fixture

```bash
cd express-app
npm run seed:visual
```

Creates/updates visual fixture cards (`AAA001` active, `AAA002` inactive), demo cards, view logs, and sample error logs.

### 2) Run screenshot diff

Start both apps first (in separate terminals):

- Next reference (root project): `npm run dev`
- Express candidate (`express-app`): `npm run dev`

Then run:

```bash
cd express-app
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
cd express-app
npm test
```

Integration/e2e are opt-in:

```bash
INTEGRATION_RUN=1 npm test
E2E_RUN=1 npm run test:e2e
```
