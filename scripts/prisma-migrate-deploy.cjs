const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const appDir = path.resolve(__dirname, "..");
const schemaPath = path.join(appDir, "prisma", "schema.prisma");
const prismaBin = path.join(
  appDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

function runPrisma(args) {
  return spawnSync(prismaBin, args, {
    cwd: appDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
}

function hasMigrations() {
  const migrationsDir = path.join(appDir, "prisma", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    return false;
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  return entries.some((entry) => {
    if (!entry.isDirectory()) {
      return false;
    }

    const migrationSql = path.join(migrationsDir, entry.name, "migration.sql");
    return fs.existsSync(migrationSql);
  });
}

const result = hasMigrations()
  ? runPrisma(["migrate", "deploy", "--schema", schemaPath])
  : (() => {
      console.warn("[prisma:migrate:deploy] no migrations found; falling back to `prisma db push`");
      return runPrisma(["db", "push", "--schema", schemaPath]);
    })();

if (result.error) {
  console.error(`[prisma:migrate:deploy] failed: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}
