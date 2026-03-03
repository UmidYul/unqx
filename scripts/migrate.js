const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
const dotenv = require("dotenv");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function loadMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => {
      const fullPath = path.join(MIGRATIONS_DIR, filename);
      const migration = require(fullPath);

      if (typeof migration?.up !== "function") {
        throw new Error(`Migration "${filename}" must export an "up(client)" function`);
      }

      const id = migration.id ?? filename.replace(/\.js$/i, "");
      const checksum = crypto.createHash("sha256").update(fs.readFileSync(fullPath, "utf8")).digest("hex");

      return { id, filename, fullPath, checksum, up: migration.up };
    });
}

async function ensureMetaTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required for migrations");
  }

  const client = new Client({ connectionString });
  const migrations = loadMigrations();

  if (migrations.length === 0) {
    console.log("[migrate] no migration files found");
    return;
  }

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["unqx_schema_migrations"]);
    await ensureMetaTable(client);

    const { rows } = await client.query("SELECT id, checksum FROM schema_migrations");
    const applied = new Map(rows.map((row) => [row.id, row.checksum]));

    for (const migration of migrations) {
      const appliedChecksum = applied.get(migration.id);
      if (appliedChecksum) {
        if (appliedChecksum !== migration.checksum) {
          throw new Error(
            `Migration "${migration.id}" was already applied with a different checksum. ` +
              `Create a new migration file instead of editing applied ones.`,
          );
        }

        console.log(`[migrate] skip ${migration.id}`);
        continue;
      }

      console.log(`[migrate] apply ${migration.id}`);
      await client.query("BEGIN");
      try {
        await migration.up(client);
        await client.query("INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)", [
          migration.id,
          migration.checksum,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("[migrate] done");
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["unqx_schema_migrations"]);
    } catch {
      // ignore unlock errors during shutdown
    }
    await client.end();
  }
}

run().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exitCode = 1;
});
