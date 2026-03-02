# UNQ+ Digital Business Cards

Full-stack web app on Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + Tailwind CSS.

## Stack

- Next.js 14, React 18, TypeScript
- Prisma ORM + PostgreSQL
- NextAuth Credentials (single admin)
- Tailwind CSS
- DnD Kit (tag/button sorting)
- react-image-crop + sharp (avatar crop + processing)
- qrcode.react (QR modal)
- Recharts (charts)

## Features

- Public card page `/:slug` (SSR)
- View tracking (`viewsCount` + `uniqueViewsCount`) with device detection (`mobile`/`desktop`)
- VCF contact download and Web Share API button
- OG metadata from card data
- Admin login `/admin` (Credentials)
- Protected admin routes (`/admin/dashboard`, `/admin/cards/*`, `/admin/stats`, `/admin/logs`)
- Card CRUD with tags/buttons and drag-and-drop sorting
- Avatar upload/crop and local storage in `/public/uploads/avatars`
- Card stats and global stats
- Error logs page and cleanup API

## Project structure

- `app/[slug]` public card page
- `app/admin` admin auth page
- `app/admin/(protected)` dashboard/cards/stats/logs
- `app/api` route handlers
- `prisma/schema.prisma` data model
- `prisma/seed.ts` demo data
- `lib/` server and domain utilities
- `components/` UI components

## Environment

Copy `.env.example` to `.env` and set your hosting values:

```env
# Neon/Vercel recommended:
# DATABASE_URL - pooled connection for runtime
# DIRECT_URL - direct connection for migrations
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.us-east-1.aws.neon.tech/unqplus?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/unqplus?sslmode=require"

NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="change-me-in-production"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

ADMIN_LOGIN="admin"
ADMIN_PASSWORD_HASH='$2b$10$...'
BACKUP_DIR="/backups"
```

## Setup on shared hosting (No Docker)

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npm run prisma:generate
```

3. Create all required DB tables (apply migrations):

```bash
npm run prisma:deploy
```

4. Optional demo data:

```bash
npm run prisma:seed
```

## Run application

Development:

```bash
npm run dev
```

Production:

```bash
npm run build
npm run start
```

For hosting panels that cannot choose hidden `.next/*` paths, use startup file:

```text
server-launcher.cjs
```

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - ESLint
- `npm run prisma:generate` - Prisma client generation
- `npm run prisma:migrate` - create/apply migrations (dev)
- `npm run prisma:deploy` - apply migrations in production/shared hosting
- `npm run prisma:seed` - seed database
- `npm run test` - unit tests (Vitest)
- `npm run test:e2e` - Playwright smoke tests

## Quick answer

Command to fill DB with required tables:

```bash
npm run prisma:deploy
```

Command to run app:

```bash
npm run build && npm run start
```

## Deploy to Vercel + Neon (recommended)

1. Create a free Neon project and database (`unqplus`).
2. In Neon connection details, copy:
   - pooled connection string -> set as `DATABASE_URL`
   - direct connection string -> set as `DIRECT_URL`
3. In Vercel Project Settings -> Environment Variables add:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_URL` (your Vercel domain, e.g. `https://project.vercel.app`)
   - `NEXTAUTH_SECRET` (long random string)
   - `NEXT_PUBLIC_APP_URL` (same public domain)
   - `ADMIN_LOGIN`
   - `ADMIN_PASSWORD_HASH`
4. In Vercel Build & Development Settings set Build Command:

```bash
npm run build:vercel
```

5. Deploy. Migrations will run automatically during build via `prisma migrate deploy`.
