const { z } = require("zod");

const { prisma } = require("../db/prisma");

const LEADERS_CACHE_TTL_MS = 45_000;
const LEADERS_LIMIT = 100;
const MAX_DONATION_AMOUNT = 9_000_000_000_000_000n;

let leadersCache = {
  expiresAt: 0,
  payload: null,
};

const DonationUpdateSchema = z.object({
  mode: z.enum(["set", "add", "subtract"]),
  amount: z.union([z.string(), z.number(), z.bigint()]),
  note: z.string().trim().max(500).optional().default(""),
  isPublicLeader: z.boolean().optional(),
});

function parseDonationAmount(value) {
  if (typeof value === "bigint") {
    if (value < 0n || value > MAX_DONATION_AMOUNT) {
      throw new Error("DONATION_AMOUNT_INVALID");
    }
    return value;
  }
  const raw = String(value ?? "").trim();
  if (!raw || raw.includes("-")) {
    throw new Error("DONATION_AMOUNT_INVALID");
  }
  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/[^\d]/g, "");
  if (!normalized) {
    throw new Error("DONATION_AMOUNT_INVALID");
  }
  const amount = BigInt(normalized);
  if (amount < 0n || amount > MAX_DONATION_AMOUNT) {
    throw new Error("DONATION_AMOUNT_INVALID");
  }
  return amount;
}

function formatDonationLabel(value) {
  const amount = typeof value === "bigint" ? value : parseDonationAmount(value || 0);
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} сум`;
}

function toSafeDonationItem(row, rank) {
  const total = typeof row.total_donations === "bigint"
    ? row.total_donations
    : BigInt(String(row.total_donations || "0"));
  const profileSlug = String(row.profile_slug || "").trim();
  return {
    rank,
    userId: String(row.user_id || ""),
    name: String(row.display_name || row.first_name || row.login || "UNQX User").trim() || "UNQX User",
    login: row.login ? String(row.login) : null,
    avatarUrl: String(row.avatar_url || "/brand/profile-user.svg"),
    profileSlug: profileSlug || null,
    profileUrl: profileSlug ? `/${encodeURIComponent(profileSlug)}` : null,
    totalDonations: total.toString(),
    totalDonationsLabel: formatDonationLabel(total),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at || Date.now()).toISOString(),
  };
}

function invalidateDonationLeadersCache() {
  leadersCache = {
    expiresAt: 0,
    payload: null,
  };
}

async function listDonationLeaders({ limit = LEADERS_LIMIT, useCache = true } = {}) {
  const resolvedLimit = Math.max(1, Math.min(LEADERS_LIMIT, Number(limit || LEADERS_LIMIT)));
  const now = Date.now();
  if (useCache && leadersCache.payload && leadersCache.expiresAt > now && leadersCache.payload.limit === resolvedLimit) {
    return leadersCache.payload;
  }

  const rows = await prisma.$queryRaw`
    SELECT
      dl.user_id,
      dl.total_donations,
      dl.updated_at,
      u.first_name,
      u.display_name,
      u.login,
      COALESCE(pc.avatar_url, '') AS avatar_url,
      COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug
    FROM donation_leaders dl
    JOIN users u ON u.id = dl.user_id
    LEFT JOIN profile_cards pc ON pc.owner_id = u.id
    LEFT JOIN LATERAL (
      SELECT s.full_slug
      FROM slugs s
      WHERE s.owner_id = u.id
        AND s.status IN ('active', 'approved', 'paused', 'private')
      ORDER BY s.is_primary DESC, s.created_at ASC
      LIMIT 1
    ) primary_slug ON true
    WHERE dl.is_public_leader = true
      AND dl.total_donations > 0
      AND u.status = 'active'
    ORDER BY dl.total_donations DESC, dl.updated_at ASC
    LIMIT ${resolvedLimit}
  `;

  const payload = {
    generatedAt: new Date().toISOString(),
    limit: resolvedLimit,
    items: rows.map((row, index) => toSafeDonationItem(row, index + 1)),
  };

  leadersCache = {
    expiresAt: now + LEADERS_CACHE_TTL_MS,
    payload,
  };
  return payload;
}

async function getDonationLeaderForUser(userId) {
  const rows = await prisma.$queryRaw`
    SELECT user_id, total_donations, is_public_leader, updated_at
    FROM donation_leaders
    WHERE user_id = ${String(userId)}
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return {
      userId: String(userId),
      totalDonations: "0",
      totalDonationsLabel: formatDonationLabel(0n),
      isPublicLeader: true,
      updatedAt: null,
    };
  }
  const total = typeof row.total_donations === "bigint" ? row.total_donations : BigInt(String(row.total_donations || "0"));
  return {
    userId: String(row.user_id || userId),
    totalDonations: total.toString(),
    totalDonationsLabel: formatDonationLabel(total),
    isPublicLeader: row.is_public_leader !== false,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : null,
  };
}

async function updateDonationLeader({ userId, mode, amount, note = "", adminLogin = "admin", isPublicLeader }) {
  const parsed = DonationUpdateSchema.parse({ mode, amount, note, isPublicLeader });
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("USER_ID_REQUIRED");
    error.status = 400;
    throw error;
  }
  const donationAmount = parseDonationAmount(parsed.amount);
  const signedAmount = parsed.mode === "subtract" ? -donationAmount : donationAmount;

  const result = await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw`
      SELECT id FROM users WHERE id = ${normalizedUserId} LIMIT 1
    `;
    if (!Array.isArray(users) || !users.length) {
      const error = new Error("USER_NOT_FOUND");
      error.status = 404;
      throw error;
    }

    await tx.$executeRaw`
      INSERT INTO donation_leaders (user_id, total_donations, is_public_leader, updated_at)
      VALUES (${normalizedUserId}, 0, true, now())
      ON CONFLICT (user_id) DO NOTHING
    `;

    const beforeRows = await tx.$queryRaw`
      SELECT total_donations, is_public_leader
      FROM donation_leaders
      WHERE user_id = ${normalizedUserId}
      FOR UPDATE
    `;
    const before = beforeRows[0];
    const previousTotal = typeof before.total_donations === "bigint"
      ? before.total_donations
      : BigInt(String(before.total_donations || "0"));
    let nextTotal = previousTotal;
    if (parsed.mode === "set") {
      nextTotal = donationAmount;
    } else if (parsed.mode === "add") {
      nextTotal = previousTotal + donationAmount;
    } else {
      nextTotal = previousTotal > donationAmount ? previousTotal - donationAmount : 0n;
    }
    if (nextTotal > MAX_DONATION_AMOUNT) {
      const error = new Error("DONATION_AMOUNT_TOO_LARGE");
      error.status = 400;
      throw error;
    }

    const nextPublic = typeof parsed.isPublicLeader === "boolean"
      ? parsed.isPublicLeader
      : before.is_public_leader !== false;

    const updatedRows = await tx.$queryRaw`
      UPDATE donation_leaders
      SET
        total_donations = ${nextTotal},
        is_public_leader = ${nextPublic},
        updated_at = CASE
          WHEN total_donations IS DISTINCT FROM ${nextTotal}
            OR is_public_leader IS DISTINCT FROM ${nextPublic}
          THEN now()
          ELSE updated_at
        END
      WHERE user_id = ${normalizedUserId}
      RETURNING user_id, total_donations, is_public_leader, updated_at
    `;

    await tx.$executeRaw`
      INSERT INTO donation_operations (
        user_id,
        admin_login,
        mode,
        amount,
        previous_total,
        next_total,
        note,
        source_key,
        created_at
      )
      VALUES (
        ${normalizedUserId},
        ${String(adminLogin || "admin").slice(0, 190)},
        ${parsed.mode},
        ${signedAmount},
        ${previousTotal},
        ${nextTotal},
        ${String(parsed.note || "").trim().slice(0, 500) || null},
        ${null},
        now()
      )
    `;

    const updated = updatedRows[0];
    const total = typeof updated.total_donations === "bigint" ? updated.total_donations : BigInt(String(updated.total_donations || "0"));
    return {
      userId: String(updated.user_id || normalizedUserId),
      totalDonations: total.toString(),
      totalDonationsLabel: formatDonationLabel(total),
      isPublicLeader: updated.is_public_leader !== false,
      updatedAt: updated.updated_at instanceof Date ? updated.updated_at.toISOString() : new Date().toISOString(),
      previousTotal: previousTotal.toString(),
      previousTotalLabel: formatDonationLabel(previousTotal),
      amount: signedAmount.toString(),
    };
  });

  invalidateDonationLeadersCache();
  return result;
}

async function addDonationToLeader({ userId, amount, note = "", sourceKey = "", adminLogin = "system" }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("USER_ID_REQUIRED");
    error.status = 400;
    throw error;
  }
  const donationAmount = parseDonationAmount(amount);
  if (donationAmount <= 0n) {
    const error = new Error("DONATION_AMOUNT_INVALID");
    error.status = 400;
    throw error;
  }
  const normalizedSourceKey = String(sourceKey || "").trim().slice(0, 190);

  const result = await prisma.$transaction(async (tx) => {
    if (normalizedSourceKey) {
      const existingOperations = await tx.$queryRaw`
        SELECT id
        FROM donation_operations
        WHERE source_key = ${normalizedSourceKey}
        LIMIT 1
      `;
      if (Array.isArray(existingOperations) && existingOperations.length) {
        const currentRows = await tx.$queryRaw`
          SELECT user_id, total_donations, is_public_leader, updated_at
          FROM donation_leaders
          WHERE user_id = ${normalizedUserId}
          LIMIT 1
        `;
        const current = currentRows[0] || {
          user_id: normalizedUserId,
          total_donations: 0n,
          is_public_leader: true,
          updated_at: null,
        };
        const total = typeof current.total_donations === "bigint" ? current.total_donations : BigInt(String(current.total_donations || "0"));
        return {
          userId: String(current.user_id || normalizedUserId),
          totalDonations: total.toString(),
          totalDonationsLabel: formatDonationLabel(total),
          isPublicLeader: current.is_public_leader !== false,
          updatedAt: current.updated_at instanceof Date ? current.updated_at.toISOString() : null,
          skipped: true,
        };
      }
    }

    const users = await tx.$queryRaw`
      SELECT id FROM users WHERE id = ${normalizedUserId} LIMIT 1
    `;
    if (!Array.isArray(users) || !users.length) {
      const error = new Error("USER_NOT_FOUND");
      error.status = 404;
      throw error;
    }

    await tx.$executeRaw`
      INSERT INTO donation_leaders (user_id, total_donations, is_public_leader, updated_at)
      VALUES (${normalizedUserId}, 0, true, now())
      ON CONFLICT (user_id) DO NOTHING
    `;

    const beforeRows = await tx.$queryRaw`
      SELECT total_donations, is_public_leader
      FROM donation_leaders
      WHERE user_id = ${normalizedUserId}
      FOR UPDATE
    `;
    const before = beforeRows[0];
    const previousTotal = typeof before.total_donations === "bigint"
      ? before.total_donations
      : BigInt(String(before.total_donations || "0"));
    const nextTotal = previousTotal + donationAmount;
    if (nextTotal > MAX_DONATION_AMOUNT) {
      const error = new Error("DONATION_AMOUNT_TOO_LARGE");
      error.status = 400;
      throw error;
    }

    const updatedRows = await tx.$queryRaw`
      UPDATE donation_leaders
      SET total_donations = ${nextTotal}, updated_at = now()
      WHERE user_id = ${normalizedUserId}
      RETURNING user_id, total_donations, is_public_leader, updated_at
    `;

    await tx.$executeRaw`
      INSERT INTO donation_operations (
        user_id,
        admin_login,
        mode,
        amount,
        previous_total,
        next_total,
        note,
        source_key,
        created_at
      )
      VALUES (
        ${normalizedUserId},
        ${String(adminLogin || "system").slice(0, 190)},
        ${"add"},
        ${donationAmount},
        ${previousTotal},
        ${nextTotal},
        ${String(note || "").trim().slice(0, 500) || null},
        ${normalizedSourceKey || null},
        now()
      )
    `;

    const updated = updatedRows[0];
    const total = typeof updated.total_donations === "bigint" ? updated.total_donations : BigInt(String(updated.total_donations || "0"));
    return {
      userId: String(updated.user_id || normalizedUserId),
      totalDonations: total.toString(),
      totalDonationsLabel: formatDonationLabel(total),
      isPublicLeader: updated.is_public_leader !== false,
      updatedAt: updated.updated_at instanceof Date ? updated.updated_at.toISOString() : new Date().toISOString(),
      previousTotal: previousTotal.toString(),
      previousTotalLabel: formatDonationLabel(previousTotal),
      amount: donationAmount.toString(),
      skipped: false,
    };
  });

  invalidateDonationLeadersCache();
  return result;
}

module.exports = {
  addDonationToLeader,
  DonationUpdateSchema,
  formatDonationLabel,
  getDonationLeaderForUser,
  invalidateDonationLeadersCache,
  listDonationLeaders,
  parseDonationAmount,
  updateDonationLeader,
};
