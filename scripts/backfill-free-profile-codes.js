const path = require("node:path");
const { randomInt } = require("node:crypto");
const { Client } = require("pg");
const dotenv = require("dotenv");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function generateCandidate() {
  let code = String(randomInt(1, 10));
  for (let i = 0; i < 11; i += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

async function generateUniqueCode(client, existingCodes) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generateCandidate();
    if (!existingCodes.has(candidate)) {
      existingCodes.add(candidate);
      return candidate;
    }
  }
  throw new Error("Unable to generate a unique free profile code after 100 attempts");
}

async function run() {
  const apply = process.argv.includes("--apply");

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows: users } = await client.query(
      `SELECT id FROM users WHERE free_profile_code IS NULL ORDER BY created_at ASC`,
    );

    if (!users.length) {
      console.log("[backfill-free-codes] all users already have a free profile code");
      return;
    }

    console.log(`[backfill-free-codes] found ${users.length} users without free_profile_code (mode=${apply ? "apply" : "dry-run"})`);

    const { rows: existing } = await client.query(
      `SELECT free_profile_code FROM users WHERE free_profile_code IS NOT NULL`,
    );
    const existingCodes = new Set(existing.map((r) => r.free_profile_code));

    let updated = 0;
    for (const user of users) {
      const code = await generateUniqueCode(client, existingCodes);
      if (apply) {
        await client.query(
          `UPDATE users SET free_profile_code = $1, updated_at = now() WHERE id = $2`,
          [code, user.id],
        );
        updated += 1;
      } else {
        console.log(`[dry-run] would assign ${code} → userId=${user.id}`);
      }
    }

    if (apply) {
      console.log(`[backfill-free-codes] done: assigned codes to ${updated} users`);
    } else {
      console.log(`[backfill-free-codes] dry-run done. Re-run with --apply to write changes.`);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[backfill-free-codes] failed:", error.message || error);
  process.exitCode = 1;
});
