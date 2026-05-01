const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const {
  buildSubscriptionAutoRenewPatch,
  getSubscriptionSnapshot,
  hasSubscriptionHistoryEvidence,
} = require("../src/services/subscription");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");
const PLAN_PURCHASE_TYPES = [
  "basic_plan",
  "premium_plan",
  "upgrade_to_premium",
  "premium_subscription_monthly",
];
const ALLOWED_RESTORE_STATUSES = new Set(["active", "approved", "private"]);

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function parseArgs(argv) {
  const args = {
    apply: false,
    autoStatus: false,
    includePauseMessage: false,
    allowNoPurchaseHistory: false,
    userId: "",
    restoreStatus: "",
    limit: 100,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token) continue;

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--auto-status") {
      args.autoStatus = true;
      continue;
    }

    if (token === "--include-pause-message") {
      args.includePauseMessage = true;
      continue;
    }

    if (token === "--allow-no-purchase-history") {
      args.allowNoPurchaseHistory = true;
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

    if (token === "--restore-status") {
      const next = String(argv[i + 1] || "").trim().toLowerCase();
      if (next) {
        args.restoreStatus = next;
        i += 1;
      }
      continue;
    }

    if (token === "--limit") {
      const next = Number(argv[i + 1] || 0);
      if (Number.isFinite(next) && next > 0) {
        args.limit = Math.max(1, Math.min(5000, Math.floor(next)));
        i += 1;
      }
      continue;
    }
  }

  return args;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/restore-auto-paused-cards.js");
  console.log("  node scripts/restore-auto-paused-cards.js --user <userId>");
  console.log("  node scripts/restore-auto-paused-cards.js --apply --auto-status");
  console.log("  node scripts/restore-auto-paused-cards.js --apply --restore-status active");
  console.log("");
  console.log("Flags:");
  console.log("  --apply                        Apply updates. Default mode is dry-run.");
  console.log("  --auto-status                  Use per-user suggested status (private|active|approved).");
  console.log("  --restore-status <status>      Force one status for all restored slugs.");
  console.log("  --user <userId>                Limit scan/apply to one user.");
  console.log("  --limit <n>                    Max users to inspect (default: 100).");
  console.log("  --include-pause-message        Include paused slugs with a custom pause message.");
  console.log("  --allow-no-purchase-history    Include users without plan purchase history.");
}

function normalizeSlugs(value) {
  return Array.isArray(value) ? value : [];
}

function canRecoverWithoutPurchaseHistory(row) {
  return hasSubscriptionHistoryEvidence({
    planPurchasedAt: row.planPurchasedAt,
    planUpgradedAt: row.planUpgradedAt,
    subscriptionStartedAt: row.subscriptionStartedAt,
    subscriptionExpiresAt: row.subscriptionExpiresAt,
    subscriptionRenewedAt: row.subscriptionRenewedAt,
  });
}

function hasNonEmptyPauseMessage(slug) {
  return Boolean(String(slug?.pauseMessage || "").trim());
}

function inferSuggestedRestoreStatus(candidate) {
  if (candidate.hasPrivatePasswords) {
    return "private";
  }

  const hasActivated = candidate.slugs.some((slug) => slug?.activatedAt);
  if (hasActivated) {
    return "active";
  }

  return "approved";
}

function buildEffectiveUser(candidate, planPatch) {
  if (!planPatch) {
    return {
      plan: candidate.plan,
      planPurchasedAt: candidate.planPurchasedAt,
      subscriptionStartedAt: candidate.subscriptionStartedAt,
      subscriptionExpiresAt: candidate.subscriptionExpiresAt,
      subscriptionRenewedAt: candidate.subscriptionRenewedAt,
    };
  }

  return {
    plan: planPatch.plan || candidate.plan,
    planPurchasedAt: planPatch.planPurchasedAt || candidate.planPurchasedAt,
    subscriptionStartedAt: planPatch.subscriptionStartedAt || candidate.subscriptionStartedAt,
    subscriptionExpiresAt: planPatch.subscriptionExpiresAt || candidate.subscriptionExpiresAt,
    subscriptionRenewedAt: planPatch.subscriptionRenewedAt || candidate.subscriptionRenewedAt,
  };
}

function analyzeCandidate(row, options = {}) {
  const slugs = normalizeSlugs(row.slugs);
  if (!slugs.length) {
    return { candidate: null, reason: "no_slugs" };
  }

  const hasSubscriptionEvidence = canRecoverWithoutPurchaseHistory(row);
  if (!options.allowNoPurchaseHistory && !row.hasPlanPurchase && !hasSubscriptionEvidence) {
    return { candidate: null, reason: "no_purchase_or_subscription_history" };
  }

  const hasPauseMessage = slugs.some(hasNonEmptyPauseMessage);
  if (hasPauseMessage && !options.includePauseMessage) {
    return { candidate: null, reason: "has_pause_message" };
  }

  const planPatch = buildSubscriptionAutoRenewPatch(
    {
      plan: row.plan,
      planPurchasedAt: row.planPurchasedAt,
      planUpgradedAt: row.planUpgradedAt,
      subscriptionStartedAt: row.subscriptionStartedAt,
      subscriptionExpiresAt: row.subscriptionExpiresAt,
      subscriptionRenewedAt: row.subscriptionRenewedAt,
    },
    {
      autoRenew: true,
      recoverPlan: row.plan === "none",
    },
  );
  const effectiveUser = buildEffectiveUser(row, planPatch);
  const subscription = getSubscriptionSnapshot(effectiveUser, { autoRenew: true });
  if (subscription.effectivePlan !== "premium") {
    return { candidate: null, reason: "effective_plan_not_premium" };
  }

  return {
    candidate: {
      userId: row.id,
      currentPlan: row.plan,
      nextPlan: effectiveUser.plan,
      planPatch,
      hasPlanPurchase: Boolean(row.hasPlanPurchase),
      hasSubscriptionEvidence,
      hasPrivatePasswords: Boolean(row.hasPrivatePasswords),
      subscription,
      slugs,
      suggestedRestoreStatus: inferSuggestedRestoreStatus({
        hasPrivatePasswords: row.hasPrivatePasswords,
        slugs,
      }),
    },
    reason: null,
  };
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "n/a";
  }
  return date.toISOString();
}

function printCandidate(candidate) {
  const slugList = candidate.slugs.map((slug) => String(slug.fullSlug || "").trim()).filter(Boolean).join(", ");
  console.log(
    [
      `[candidate] userId=${candidate.userId}`,
      `slugs=${slugList || "-"}`,
      `currentPlan=${candidate.currentPlan}`,
      `nextPlan=${candidate.nextPlan}`,
      `suggestedStatus=${candidate.suggestedRestoreStatus}`,
      `expiresAt=${formatDate(candidate.subscription.expiresAt)}`,
      `privatePasswords=${candidate.hasPrivatePasswords ? "yes" : "no"}`,
      `planPurchase=${candidate.hasPlanPurchase ? "yes" : "no"}`,
      `autoRenewed=${candidate.subscription.autoRenewed ? "yes" : "no"}`,
    ].join(" "),
  );
}

async function loadUsers(client, options = {}) {
  const params = [];
  const where = ["u.status = 'active'"];

  if (options.userId) {
    params.push(String(options.userId));
    where.push(`u.id = $${params.length}`);
  }

  params.push(Math.max(1, Math.min(5000, Number(options.limit || 100) || 100)));
  const limitRef = `$${params.length}`;
  const purchaseTypesSql = PLAN_PURCHASE_TYPES.map((value) => `'${value}'`).join(", ");
  const query = `
    SELECT
      u.id,
      u.plan,
      u.plan_purchased_at AS "planPurchasedAt",
      u.plan_upgraded_at AS "planUpgradedAt",
      u.subscription_started_at AS "subscriptionStartedAt",
      u.subscription_expires_at AS "subscriptionExpiresAt",
      u.subscription_renewed_at AS "subscriptionRenewedAt",
      EXISTS (
        SELECT 1
        FROM purchases p
        WHERE p.user_id = u.id
          AND p.type IN (${purchaseTypesSql})
      ) AS "hasPlanPurchase",
      EXISTS (
        SELECT 1
        FROM card_private_passwords cpp
        WHERE cpp.owner_id = u.id
          AND cpp.deleted_at IS NULL
      ) AS "hasPrivatePasswords",
      slug_stats.slugs
    FROM users u
    JOIN LATERAL (
      SELECT
        COALESCE(
          json_agg(
            json_build_object(
              'fullSlug', s.full_slug,
              'status', s.status,
              'pauseMessage', s.pause_message,
              'activatedAt', s.activated_at,
              'approvedAt', s.approved_at,
              'isPrimary', s.is_primary
            )
            ORDER BY s.is_primary DESC, s.created_at ASC
          ),
          '[]'::json
        ) AS slugs,
        COUNT(*) FILTER (WHERE s.status = 'paused')::int AS paused_count,
        COUNT(*) FILTER (WHERE s.status IN ('active', 'private', 'approved'))::int AS live_count
      FROM slugs s
      WHERE s.owner_id = u.id
        AND s.status IN ('paused', 'active', 'private', 'approved')
    ) slug_stats ON true
    WHERE ${where.join(" AND ")}
      AND slug_stats.paused_count > 0
      AND slug_stats.live_count = 0
    ORDER BY u.id
    LIMIT ${limitRef}
  `;

  const result = await client.query(query, params);
  return Array.isArray(result.rows) ? result.rows : [];
}

async function applyCandidate(client, candidate, options = {}) {
  const restoreStatus = options.autoStatus
    ? candidate.suggestedRestoreStatus
    : String(options.restoreStatus || "").trim().toLowerCase();
  if (!ALLOWED_RESTORE_STATUSES.has(restoreStatus)) {
    throw new Error(`Invalid restore status: ${restoreStatus}`);
  }

  await client.query("BEGIN");
  try {
    if (candidate.planPatch) {
      await client.query(
        `
          UPDATE users
          SET
            plan = $2,
            plan_purchased_at = $3,
            subscription_started_at = $4,
            subscription_renewed_at = $5,
            subscription_expires_at = $6,
            updated_at = now()
          WHERE id = $1
        `,
        [
          candidate.userId,
          candidate.planPatch.plan,
          candidate.planPatch.planPurchasedAt || null,
          candidate.planPatch.subscriptionStartedAt || null,
          candidate.planPatch.subscriptionRenewedAt || null,
          candidate.planPatch.subscriptionExpiresAt || null,
        ],
      );
    }

    const slugIds = candidate.slugs
      .map((slug) => String(slug.fullSlug || "").trim())
      .filter(Boolean);
    const updateResult = await client.query(
      `
        UPDATE slugs
        SET status = $3, updated_at = now()
        WHERE owner_id = $1
          AND full_slug = ANY($2::text[])
          AND status = 'paused'
      `,
      [candidate.userId, slugIds, restoreStatus],
    );

    await client.query("COMMIT");
    return {
      userId: candidate.userId,
      restoreStatus,
      updatedSlugs: Number(updateResult.rowCount || 0),
      hadPlanPatch: Boolean(candidate.planPatch),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function validateArgs(args) {
  if (!args.apply) {
    return;
  }

  if (args.autoStatus && args.restoreStatus) {
    throw new Error("Use only one apply mode: --auto-status or --restore-status <status>");
  }

  if (!args.autoStatus && !args.restoreStatus) {
    throw new Error("Apply mode requires either --auto-status or --restore-status <status>");
  }

  if (args.restoreStatus && !ALLOWED_RESTORE_STATUSES.has(args.restoreStatus)) {
    throw new Error("restore-status must be one of: active, approved, private");
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const rows = await loadUsers(client, args);
    const analyzed = rows.map((row) => analyzeCandidate(row, args));
    const candidates = analyzed
      .map((item) => item.candidate)
      .filter(Boolean);
    const skippedByReason = analyzed.reduce((acc, item) => {
      if (!item.reason) {
        return acc;
      }
      acc[item.reason] = Number(acc[item.reason] || 0) + 1;
      return acc;
    }, {});

    console.log(
      `[restore-auto-paused-cards] scanned=${rows.length} candidates=${candidates.length} mode=${args.apply ? "apply" : "dry-run"}`,
    );
    Object.entries(skippedByReason).forEach(([reason, count]) => {
      console.log(`[restore-auto-paused-cards] skipped ${reason}=${count}`);
    });

    if (!candidates.length) {
      return;
    }

    candidates.forEach(printCandidate);

    if (!args.apply) {
      console.log("[restore-auto-paused-cards] dry-run only. Re-run with --apply to change data.");
      return;
    }

    const results = [];
    for (const candidate of candidates) {
      const result = await applyCandidate(client, candidate, args);
      results.push(result);
      console.log(
        `[restored] userId=${result.userId} status=${result.restoreStatus} slugs=${result.updatedSlugs} planPatched=${result.hadPlanPatch ? "yes" : "no"}`,
      );
    }

    const updatedUsers = results.length;
    const updatedSlugs = results.reduce((sum, item) => sum + Number(item.updatedSlugs || 0), 0);
    console.log(
      `[restore-auto-paused-cards] done: users=${updatedUsers}, slugs=${updatedSlugs}`,
    );
  } finally {
    await client.end();
  }
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
  process.exit(0);
}

if (require.main === module) {
  run().catch((error) => {
    printUsage();
    console.error("[restore-auto-paused-cards] failed:", error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  analyzeCandidate,
  canRecoverWithoutPurchaseHistory,
  inferSuggestedRestoreStatus,
  loadUsers,
};
