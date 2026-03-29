const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function parseArgs(argv) {
  const args = {
    all: false,
    userId: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token) continue;

    if (token === "--all") {
      args.all = true;
      continue;
    }

    if (token === "--user" || token === "--user-id") {
      const next = String(argv[i + 1] || "").trim();
      if (next) {
        args.userId = next;
        i += 1;
      }
      continue;
    }
  }

  return args;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/clear-user-sessions.js --all");
  console.log("  node scripts/clear-user-sessions.js --user <userId>");
}

async function clearAllSessions(client) {
  const countBefore = await client.query("SELECT COUNT(*)::int AS count FROM user_sessions");
  const total = Number(countBefore.rows?.[0]?.count || 0);
  const deleted = await client.query("DELETE FROM user_sessions");

  return {
    mode: "all",
    totalBefore: total,
    deleted: Number(deleted.rowCount || 0),
  };
}

async function clearUserSessions(client, userId) {
  const countBefore = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM user_sessions
      WHERE (sess::jsonb #>> '{user,userId}') = $1
    `,
    [String(userId)],
  );
  const total = Number(countBefore.rows?.[0]?.count || 0);

  const deleted = await client.query(
    `
      DELETE FROM user_sessions
      WHERE (sess::jsonb #>> '{user,userId}') = $1
    `,
    [String(userId)],
  );

  return {
    mode: "user",
    userId: String(userId),
    totalBefore: total,
    deleted: Number(deleted.rowCount || 0),
  };
}

async function run() {
  const { all, userId } = parseArgs(process.argv.slice(2));
  if (!all && !userId) {
    printUsage();
    throw new Error("Specify either --all or --user <userId>");
  }
  if (all && userId) {
    printUsage();
    throw new Error("Use only one mode: --all or --user <userId>");
  }

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = all
      ? await clearAllSessions(client)
      : await clearUserSessions(client, userId);

    if (result.mode === "all") {
      console.log(`[clear-sessions] done: deleted ${result.deleted} of ${result.totalBefore} sessions`);
      return;
    }

    console.log(
      `[clear-sessions] done: userId=${result.userId}, deleted ${result.deleted} of ${result.totalBefore} sessions`,
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[clear-sessions] failed:", error.message || error);
  process.exitCode = 1;
});
