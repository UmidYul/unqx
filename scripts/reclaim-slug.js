const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");
const ALLOWED_STATUSES = new Set(["approved", "active", "private", "paused"]);

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function parseArgs(argv) {
  const args = {
    apply: false,
    userId: "",
    slug: "",
    fromSlug: "",
    status: "active",
    primary: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token) continue;

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--primary") {
      args.primary = true;
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

    if (token === "--slug") {
      const next = String(argv[i + 1] || "").trim().toUpperCase();
      if (next) {
        args.slug = next;
        i += 1;
      }
      continue;
    }

    if (token === "--from-slug") {
      const next = String(argv[i + 1] || "").trim().toUpperCase();
      if (next) {
        args.fromSlug = next;
        i += 1;
      }
      continue;
    }

    if (token === "--status") {
      const next = String(argv[i + 1] || "").trim().toLowerCase();
      if (next) {
        args.status = next;
        i += 1;
      }
    }
  }

  return args;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/reclaim-slug.js --slug UNQ001 --user <userId> [--status active] [--apply]");
  console.log("  node scripts/reclaim-slug.js --slug UNQ001 --from-slug ABC123 [--status active] [--apply]");
  console.log("");
  console.log("Flags:");
  console.log("  --apply              Apply update. Default is dry-run.");
  console.log("  --slug <slug>        Target slug to restore.");
  console.log("  --user <userId>      Restore target slug to this user.");
  console.log("  --from-slug <slug>   Infer owner from another slug that still belongs to the user.");
  console.log("  --status <status>    approved | active | private | paused. Default: active.");
  console.log("  --primary            Make restored slug primary.");
}

async function resolveOwnerId(client, args) {
  if (args.userId) {
    return String(args.userId);
  }

  const result = await client.query(
    `
      SELECT owner_id AS "ownerId"
      FROM slugs
      WHERE full_slug = $1
      LIMIT 1
    `,
    [args.fromSlug],
  );
  const row = result.rows[0];
  return row?.ownerId ? String(row.ownerId) : "";
}

async function loadState(client, args, ownerId) {
  const slugResult = await client.query(
    `
      SELECT
        id,
        full_slug AS "fullSlug",
        status,
        owner_id AS "ownerId",
        is_primary AS "isPrimary",
        pause_message AS "pauseMessage",
        approved_at AS "approvedAt",
        activated_at AS "activatedAt"
      FROM slugs
      WHERE full_slug = $1
      LIMIT 1
    `,
    [args.slug],
  );
  const ownerResult = await client.query(
    `
      SELECT id, email, login, status, plan
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [ownerId],
  );
  const ownerSlugsResult = await client.query(
    `
      SELECT full_slug AS "fullSlug", status, is_primary AS "isPrimary"
      FROM slugs
      WHERE owner_id = $1
      ORDER BY is_primary DESC, created_at ASC
    `,
    [ownerId],
  );

  return {
    slug: slugResult.rows[0] || null,
    owner: ownerResult.rows[0] || null,
    ownerSlugs: ownerSlugsResult.rows || [],
  };
}

async function applyReclaim(client, args, ownerId, state) {
  await client.query("BEGIN");
  try {
    if (args.primary) {
      await client.query(
        `
          UPDATE slugs
          SET is_primary = false, updated_at = now()
          WHERE owner_id = $1
        `,
        [ownerId],
      );
    }

    await client.query(
      `
        UPDATE slugs
        SET
          owner_id = $2,
          status = $3::"SlugStatus",
          is_primary = $4,
          pause_message = NULL,
          pending_expires_at = NULL,
          requested_at = COALESCE(requested_at, now()),
          approved_at = COALESCE(approved_at, now()),
          activated_at = CASE
            WHEN $5 THEN COALESCE(activated_at, now())
            ELSE activated_at
          END,
          updated_at = now()
        WHERE full_slug = $1
      `,
      [args.slug, ownerId, args.status, args.primary, args.status === "active"],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug || (!args.userId && !args.fromSlug)) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (!ALLOWED_STATUSES.has(args.status)) {
    throw new Error("status must be one of: approved, active, private, paused");
  }

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const ownerId = await resolveOwnerId(client, args);
    if (!ownerId) {
      throw new Error("Could not resolve target owner. Pass --user or a valid --from-slug.");
    }

    const state = await loadState(client, args, ownerId);
    if (!state.slug) {
      throw new Error(`Target slug not found: ${args.slug}`);
    }
    if (!state.owner) {
      throw new Error(`Target user not found: ${ownerId}`);
    }

    console.log("[reclaim-slug] target slug");
    console.log(JSON.stringify(state.slug, null, 2));
    console.log("[reclaim-slug] target owner");
    console.log(JSON.stringify(state.owner, null, 2));
    console.log("[reclaim-slug] owner slugs");
    console.log(JSON.stringify(state.ownerSlugs, null, 2));

    if (!args.apply) {
      console.log(`[reclaim-slug] dry-run: would assign ${args.slug} to user ${ownerId} with status=${args.status} primary=${args.primary ? "yes" : "no"}`);
      return;
    }

    await applyReclaim(client, args, ownerId, state);
    console.log(`[reclaim-slug] applied: slug=${args.slug} ownerId=${ownerId} status=${args.status} primary=${args.primary ? "yes" : "no"}`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    printUsage();
    console.error("[reclaim-slug] failed:", error.message || error);
    process.exitCode = 1;
  });
}
