const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function parseArgs(argv) {
  const args = {
    userId: "",
    slug: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token) continue;

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
    }
  }

  return args;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/inspect-subscription-slugs.js --user <userId>");
  console.log("  node scripts/inspect-subscription-slugs.js --slug <FULLSLUG>");
}

async function inspectUser(client, userId) {
  const userResult = await client.query(
    `
      SELECT
        id,
        email,
        login,
        status,
        plan,
        plan_purchased_at AS "planPurchasedAt",
        plan_upgraded_at AS "planUpgradedAt",
        subscription_started_at AS "subscriptionStartedAt",
        subscription_expires_at AS "subscriptionExpiresAt",
        subscription_renewed_at AS "subscriptionRenewedAt"
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) {
    console.log(`[inspect-subscription-slugs] user not found: ${userId}`);
    return;
  }

  const slugsResult = await client.query(
    `
      SELECT
        id,
        full_slug AS "fullSlug",
        status,
        owner_id AS "ownerId",
        is_primary AS "isPrimary",
        pause_message AS "pauseMessage",
        approved_at AS "approvedAt",
        activated_at AS "activatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM slugs
      WHERE owner_id = $1
      ORDER BY is_primary DESC, created_at ASC
    `,
    [userId],
  );

  console.log("[inspect-subscription-slugs] user");
  console.log(JSON.stringify(user, null, 2));
  console.log("[inspect-subscription-slugs] owned slugs");
  console.log(JSON.stringify(slugsResult.rows, null, 2));
}

async function inspectSlug(client, slug) {
  const slugResult = await client.query(
    `
      SELECT
        s.id,
        s.full_slug AS "fullSlug",
        s.status,
        s.owner_id AS "ownerId",
        s.is_primary AS "isPrimary",
        s.pause_message AS "pauseMessage",
        s.approved_at AS "approvedAt",
        s.activated_at AS "activatedAt",
        s.created_at AS "createdAt",
        s.updated_at AS "updatedAt",
        u.email,
        u.login,
        u.status AS "userStatus",
        u.plan AS "userPlan",
        u.subscription_started_at AS "subscriptionStartedAt",
        u.subscription_expires_at AS "subscriptionExpiresAt",
        u.subscription_renewed_at AS "subscriptionRenewedAt"
      FROM slugs s
      LEFT JOIN users u ON u.id = s.owner_id
      WHERE s.full_slug = $1
      LIMIT 1
    `,
    [slug],
  );

  const row = slugResult.rows[0];
  if (!row) {
    console.log(`[inspect-subscription-slugs] slug not found: ${slug}`);
    return;
  }

  console.log("[inspect-subscription-slugs] slug");
  console.log(JSON.stringify(row, null, 2));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userId && !args.slug) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (args.userId) {
      await inspectUser(client, args.userId);
    }
    if (args.slug) {
      await inspectSlug(client, args.slug);
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    printUsage();
    console.error("[inspect-subscription-slugs] failed:", error.message || error);
    process.exitCode = 1;
  });
}
