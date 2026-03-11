#!/usr/bin/env node
"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const dotenv = require("dotenv");
const { Client } = require("pg");

const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, ".env"), override: false });
dotenv.config({ path: path.join(repoRoot, ".env.example"), override: false });

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--move") args.move = true;
    else if (arg === "--db-only") args.dbOnly = true;
    else if (arg === "--files-only") args.filesOnly = true;
    else if (arg.startsWith("--from=")) args.from = arg.slice("--from=".length);
    else if (arg.startsWith("--to=")) args.to = arg.slice("--to=".length);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const envRoot = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : repoRoot;
const defaultFromRoot = path.resolve(envRoot, "..");
const defaultFromDir = path.join(defaultFromRoot, "public", "uploads", "avatars");
const defaultToDir = path.join(envRoot, "public", "uploads", "avatars");

const fromDir = args.from || process.env.AVATAR_MIGRATE_FROM || defaultFromDir;
const toDir = args.to || process.env.AVATAR_MIGRATE_TO || defaultToDir;
const dryRun = Boolean(args.dryRun);
const moveFiles = Boolean(args.move);

const onlyDb = Boolean(args.dbOnly);
const onlyFiles = Boolean(args.filesOnly);

function normalizeAvatarUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const clean = raw.split("?")[0].split("#")[0];
  const idx = clean.indexOf("/uploads/avatars/");
  if (idx !== -1) return clean.slice(idx);
  if (clean.startsWith("uploads/avatars/")) return `/${clean}`;
  if (clean.startsWith("public/uploads/avatars/")) return `/${clean.replace(/^public\//, "")}`;
  const base = path.basename(clean);
  if (!base) return null;
  return `/uploads/avatars/${base}`;
}

async function moveFile(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (error) {
    if (error && error.code === "EXDEV") {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
      return;
    }
    throw error;
  }
}

async function migrateFiles() {
  if (!existsSync(fromDir)) {
    console.error(`[avatars] source dir not found: ${fromDir}`);
    return;
  }
  await fs.mkdir(toDir, { recursive: true });
  const entries = await fs.readdir(fromDir, { withFileTypes: true });
  let copied = 0;
  let moved = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".webp")) continue;
    const src = path.join(fromDir, entry.name);
    const dest = path.join(toDir, entry.name);
    if (existsSync(dest)) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      if (moveFiles) moved += 1;
      else copied += 1;
      continue;
    }
    if (moveFiles) {
      await moveFile(src, dest);
      moved += 1;
    } else {
      await fs.copyFile(src, dest);
      copied += 1;
    }
  }

  console.log(`[avatars] files: copied=${copied} moved=${moved} skipped=${skipped} from=${fromDir} to=${toDir}`);
}

async function migrateDb() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) {
    console.error("[avatars] DATABASE_URL is not set");
    return;
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      "SELECT id, avatar_url FROM profile_cards WHERE avatar_url IS NOT NULL AND avatar_url <> ''",
    );
    let updated = 0;
    for (const row of rows) {
      const nextUrl = normalizeAvatarUrl(row.avatar_url);
      if (!nextUrl || nextUrl === row.avatar_url) continue;
      if (!dryRun) {
        await client.query("UPDATE profile_cards SET avatar_url = $1 WHERE id = $2", [nextUrl, row.id]);
      }
      updated += 1;
    }
    console.log(`[avatars] db: updated=${updated} total=${rows.length} dryRun=${dryRun}`);
  } finally {
    await client.end();
  }
}

async function main() {
  if (onlyDb && onlyFiles) {
    console.error("[avatars] choose only one of --db-only or --files-only");
    process.exitCode = 1;
    return;
  }
  if (!onlyDb) {
    await migrateFiles();
  }
  if (!onlyFiles) {
    await migrateDb();
  }
}

main().catch((error) => {
  console.error("[avatars] failed:", error);
  process.exitCode = 1;
});
