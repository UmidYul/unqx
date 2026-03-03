# Express Migration Preview

Express-only implementation of UNQ+ without Next.js and without frontend build tools.

## Stack

- Express + EJS
- Prisma + PostgreSQL
- express-session + connect-pg-simple
- Vanilla HTML/CSS/JS + CDN libs (SortableJS, CropperJS, Chart.js, qrcode)

## Run

```bash
cd express-app
npm install
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Production:

```bash
cd express-app
npm run start
```

Default URL: `http://127.0.0.1:3100`

## Environment

The app reads env values from:

1. `express-app/.env` (if exists)
2. root `.env` (fallback)

Required variables:

```env
DATABASE_URL="postgresql://..."
ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH="$2b$10$..."
```

Optional compatibility/fallback variables:

```env
DIRECT_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3100"
NEXT_PUBLIC_APP_URL="http://localhost:3100"
NEXTAUTH_SECRET="change-me"
SESSION_SECRET="change-me-better"
TIMEZONE="Asia/Tashkent"
PORT=3100
```

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
- `GET /api/admin/cards/:id/stats`
- `GET /api/admin/stats`
- `POST /api/admin/slug/next`
- `POST /api/admin/logs/cleanup`
- `POST /api/cards/:slug/view`
- `GET /api/cards/:slug/vcf`

## Tests

```bash
cd express-app
npm test
```

Integration and e2e are opt-in:

```bash
INTEGRATION_RUN=1 npm test
E2E_RUN=1 npm run test:e2e
```