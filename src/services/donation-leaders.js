const { randomUUID } = require("node:crypto");

const { z } = require("zod");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { getSetting } = require("./platform-settings");
const { normalizeTelegramUsername } = require("./payment-flow");
const { sendTelegramMessage } = require("./telegram");

const LEADERS_CACHE_TTL_MS = 45_000;
const LEADERS_LIMIT = 100;
const MAX_DONATION_AMOUNT = 9_000_000_000_000_000n;
const MIN_PUBLIC_DONATION_AMOUNT = 10_000n;

let leadersCache = {
  expiresAt: 0,
  payload: null,
};
let donationRequestsStorageReady = false;

const DonationUpdateSchema = z.object({
  mode: z.enum(["set", "add", "subtract"]),
  amount: z.union([z.string(), z.number(), z.bigint()]),
  note: z.string().trim().max(500).optional().default(""),
  isPublicLeader: z.boolean().optional(),
});

const DonationRequestSchema = z.object({
  amount: z.union([z.string(), z.number(), z.bigint()]),
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

function buildDonationReference(requestId) {
  const compact = String(requestId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `UNQX-DON-${compact || "LEADER"}`;
}

function buildNewDonationReference() {
  return buildDonationReference(randomUUID());
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function resolveDonationRank({ userId = "", amount, includeCurrentUserTotal = true }) {
  const donationAmount = parseDonationAmount(amount);
  const normalizedUserId = String(userId || "").trim();
  let currentTotal = 0n;
  if (normalizedUserId && includeCurrentUserTotal) {
    const rows = await prisma.$queryRaw`
      SELECT total_donations
      FROM donation_leaders
      WHERE user_id = ${normalizedUserId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    currentTotal = row
      ? (typeof row.total_donations === "bigint" ? row.total_donations : BigInt(String(row.total_donations || "0")))
      : 0n;
  }
  const projectedTotal = currentTotal + donationAmount;
  const rows = normalizedUserId
    ? await prisma.$queryRaw`
      SELECT COUNT(*)::int AS rank_offset
      FROM donation_leaders dl
      JOIN users u ON u.id = dl.user_id
      WHERE dl.is_public_leader = true
        AND dl.total_donations > 0
        AND u.status = 'active'
        AND dl.user_id <> ${normalizedUserId}
        AND (
          dl.total_donations > ${projectedTotal}
          OR (dl.total_donations = ${projectedTotal} AND dl.updated_at <= now())
        )
    `
    : await prisma.$queryRaw`
      SELECT COUNT(*)::int AS rank_offset
      FROM donation_leaders dl
      JOIN users u ON u.id = dl.user_id
      WHERE dl.is_public_leader = true
        AND dl.total_donations > 0
        AND u.status = 'active'
        AND (
          dl.total_donations > ${projectedTotal}
          OR (dl.total_donations = ${projectedTotal} AND dl.updated_at <= now())
        )
    `;
  const rankOffset = Number(rows?.[0]?.rank_offset || 0);
  return {
    amount: donationAmount.toString(),
    amountLabel: formatDonationLabel(donationAmount),
    currentTotal: currentTotal.toString(),
    currentTotalLabel: formatDonationLabel(currentTotal),
    projectedTotal: projectedTotal.toString(),
    projectedTotalLabel: formatDonationLabel(projectedTotal),
    estimatedRank: Math.max(1, rankOffset + 1),
  };
}

function buildDonationPaymentUrl({
  reference,
  amount,
  rankPreview,
  telegramUsername,
  userName = "",
  email = "",
}) {
  const safeUsername = normalizeTelegramUsername(telegramUsername);
  const amountLabel = formatDonationLabel(amount);
  const message =
    `Здравствуйте! Хочу сделать донат в UNQX Leaders\n\n` +
    `Код оплаты: ${reference}\n` +
    `Имя: ${String(userName || "UNQX User").trim() || "UNQX User"}\n` +
    `Email: ${String(email || "не указан").trim() || "не указан"}\n` +
    `Сумма: ${amountLabel}\n` +
    `Предварительное место: #${Number(rankPreview || 1)}\n\n` +
    `После подтверждения оплаты администратором сумма добавится к моему профилю.`;
  return `https://t.me/${safeUsername}?text=${encodeURIComponent(message)}`;
}

function buildDonationAdminTelegramText({ reference, amount, rankPreview, user }) {
  const name = String(user?.display_name || user?.first_name || user?.login || "UNQX User").trim() || "UNQX User";
  const login = String(user?.login || "").trim();
  const email = String(user?.email || "").trim();
  const profile = String(user?.profile_slug || "").trim();
  return [
    "<b>НОВАЯ ЗАЯВКА НА ДОНАТ</b>",
    "",
    `<b>Код:</b> ${reference}`,
    `<b>Пользователь:</b> ${name}${login ? ` · @${login}` : ""}`,
    email ? `<b>Email:</b> ${email}` : "",
    profile ? `<b>UNQ:</b> unqx.uz/${profile}` : "",
    `<b>Сумма:</b> ${formatDonationLabel(amount)}`,
    `<b>Предварительное место:</b> #${Number(rankPreview || 1)}`,
    "",
    "Добавь его вручную в админке: Донаты → Добавить пользователя.",
  ].filter(Boolean).join("\n");
}

async function sendDonationRequestToAdminTelegram({ reference, amount, rankPreview, user }) {
  const chatId = String(await getSetting("contact_telegram_chat_id", env.TELEGRAM_CHAT_ID || "") || "").trim();
  if (!chatId) {
    const error = new Error("TELEGRAM_CHAT_ID_MISSING");
    error.status = 503;
    throw error;
  }
  return sendTelegramMessage({
    chatId,
    text: buildDonationAdminTelegramText({ reference, amount, rankPreview, user }),
    parseMode: "HTML",
    inlineKeyboard: [
      [
        {
          text: "Открыть донаты",
          url: `${String(env.APP_URL || "").replace(/\/$/, "")}/admin/dashboard?tab=donations`,
        },
      ],
    ],
  });
}

function invalidateDonationLeadersCache() {
  leadersCache = {
    expiresAt: 0,
    payload: null,
  };
}

function isDonationRequestsStorageError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" ||
    code === "P2021" ||
    message.includes("donation_requests") ||
    (message.includes("relation") && message.includes("does not exist"));
}

async function ensureDonationRequestsStorage() {
  if (donationRequestsStorageReady) {
    return true;
  }
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      users_id_type text;
      request_id_type text;
      request_id_default text;
    BEGIN
      SELECT format_type(attribute.atttypid, attribute.atttypmod)
        INTO users_id_type
      FROM pg_attribute attribute
      WHERE attribute.attrelid = 'users'::regclass
        AND attribute.attname = 'id'
        AND NOT attribute.attisdropped;

      IF users_id_type IS NULL THEN
        RAISE EXCEPTION 'Cannot determine users.id type';
      END IF;

      request_id_type := users_id_type;
      request_id_default := CASE
        WHEN request_id_type = 'uuid' AND to_regprocedure('app_uuid_v4()') IS NOT NULL THEN 'DEFAULT app_uuid_v4()'
        WHEN request_id_type = 'uuid' THEN 'DEFAULT gen_random_uuid()'
        ELSE 'DEFAULT gen_random_uuid()::text'
      END;

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS donation_requests (
          id %1$s PRIMARY KEY %2$s,
          user_id %3$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount bigint NOT NULL,
          status varchar(20) NOT NULL DEFAULT ''new'',
          payment_reference varchar(40) NOT NULL UNIQUE,
          payment_url text NOT NULL,
          rank_preview integer NULL,
          admin_login varchar(190) NULL,
          admin_note varchar(500) NULL,
          paid_at timestamptz NULL,
          approved_at timestamptz NULL,
          rejected_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )',
        request_id_type,
        request_id_default,
        users_id_type
      );
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS donation_requests_status_created_idx
      ON donation_requests (status, created_at DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS donation_requests_user_created_idx
      ON donation_requests (user_id, created_at DESC)
  `);
  donationRequestsStorageReady = true;
  return true;
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
  if (!isUuid(normalizedUserId)) {
    const error = new Error("USER_ID_INVALID");
    error.status = 400;
    throw error;
  }
  const donationAmount = parseDonationAmount(parsed.amount);
  const signedAmount = parsed.mode === "subtract" ? -donationAmount : donationAmount;

  const result = await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRawUnsafe("SELECT id FROM users WHERE id = $1::uuid LIMIT 1", normalizedUserId);
    if (!Array.isArray(users) || !users.length) {
      const error = new Error("USER_NOT_FOUND");
      error.status = 404;
      throw error;
    }

    await tx.$executeRawUnsafe(
      `
      INSERT INTO donation_leaders (user_id, total_donations, is_public_leader, updated_at)
      VALUES ($1::uuid, 0, true, now())
      ON CONFLICT (user_id) DO NOTHING
    `,
      normalizedUserId,
    );

    const beforeRows = await tx.$queryRawUnsafe(
      `
      SELECT total_donations, is_public_leader
      FROM donation_leaders
      WHERE user_id = $1::uuid
      FOR UPDATE
    `,
      normalizedUserId,
    );
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

    const updatedRows = await tx.$queryRawUnsafe(
      `
      UPDATE donation_leaders
      SET
        total_donations = $2::bigint,
        is_public_leader = $3::boolean,
        updated_at = CASE
          WHEN total_donations IS DISTINCT FROM $2::bigint
            OR is_public_leader IS DISTINCT FROM $3::boolean
          THEN now()
          ELSE updated_at
        END
      WHERE user_id = $1::uuid
      RETURNING user_id, total_donations, is_public_leader, updated_at
    `,
      normalizedUserId,
      nextTotal.toString(),
      nextPublic,
    );

    await tx.$executeRawUnsafe(
      `
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
        $1::uuid,
        $2,
        $3,
        $4::bigint,
        $5::bigint,
        $6::bigint,
        $7,
        NULL,
        now()
      )
    `,
      normalizedUserId,
      String(adminLogin || "admin").slice(0, 190),
      parsed.mode,
      signedAmount.toString(),
      previousTotal.toString(),
      nextTotal.toString(),
      String(parsed.note || "").trim().slice(0, 500) || null,
    );

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

async function addDonationToLeaderWithClient(tx, { userId, amount, note = "", sourceKey = "", adminLogin = "system" }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("USER_ID_REQUIRED");
    error.status = 400;
    throw error;
  }
  if (!isUuid(normalizedUserId)) {
    const error = new Error("USER_ID_INVALID");
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

  const users = await tx.$queryRawUnsafe("SELECT id FROM users WHERE id = $1::uuid LIMIT 1", normalizedUserId);
  if (!Array.isArray(users) || !users.length) {
    const error = new Error("USER_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  await tx.$executeRawUnsafe(
    `
    INSERT INTO donation_leaders (user_id, total_donations, is_public_leader, updated_at)
    VALUES ($1::uuid, 0, true, now())
    ON CONFLICT (user_id) DO NOTHING
  `,
    normalizedUserId,
  );

  const beforeRows = await tx.$queryRawUnsafe(
    `
    SELECT total_donations, is_public_leader
    FROM donation_leaders
    WHERE user_id = $1::uuid
    FOR UPDATE
  `,
    normalizedUserId,
  );
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

  const updatedRows = await tx.$queryRawUnsafe(
    `
    UPDATE donation_leaders
    SET total_donations = $2::bigint, updated_at = now()
    WHERE user_id = $1::uuid
    RETURNING user_id, total_donations, is_public_leader, updated_at
  `,
    normalizedUserId,
    nextTotal.toString(),
  );

  await tx.$executeRawUnsafe(
    `
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
      $1::uuid,
      $2,
      'add',
      $3::bigint,
      $4::bigint,
      $5::bigint,
      $6,
      $7,
      now()
    )
  `,
    normalizedUserId,
    String(adminLogin || "system").slice(0, 190),
    donationAmount.toString(),
    previousTotal.toString(),
    nextTotal.toString(),
    String(note || "").trim().slice(0, 500) || null,
    normalizedSourceKey || null,
  );

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
}

function mapDonationRequestRow(row) {
  if (!row) return null;
  const amount = typeof row.amount === "bigint" ? row.amount : BigInt(String(row.amount || "0"));
  const total = typeof row.total_donations === "bigint" ? row.total_donations : BigInt(String(row.total_donations || "0"));
  const profileSlug = String(row.profile_slug || "").trim();
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    userName: String(row.display_name || row.first_name || row.login || "UNQX User").trim() || "UNQX User",
    login: row.login ? String(row.login) : null,
    email: row.email ? String(row.email) : "",
    profileUrl: profileSlug ? `/${encodeURIComponent(profileSlug)}` : null,
    amount: amount.toString(),
    amountLabel: formatDonationLabel(amount),
    status: String(row.status || "new"),
    paymentReference: String(row.payment_reference || ""),
    paymentUrl: String(row.payment_url || ""),
    rankPreview: row.rank_preview == null ? null : Number(row.rank_preview),
    adminLogin: row.admin_login ? String(row.admin_login) : null,
    adminNote: row.admin_note ? String(row.admin_note) : "",
    totalDonations: total.toString(),
    totalDonationsLabel: formatDonationLabel(total),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : null,
    paidAt: row.paid_at instanceof Date ? row.paid_at.toISOString() : null,
    approvedAt: row.approved_at instanceof Date ? row.approved_at.toISOString() : null,
    rejectedAt: row.rejected_at instanceof Date ? row.rejected_at.toISOString() : null,
  };
}

const DONATION_REQUEST_NOTE_PREFIX = "DONATION_REQUEST ";

function encodeDonationRequestNote(payload) {
  return `${DONATION_REQUEST_NOTE_PREFIX}${JSON.stringify(payload)}`.slice(0, 500);
}

function decodeDonationRequestNote(note) {
  const raw = String(note || "");
  if (!raw.startsWith(DONATION_REQUEST_NOTE_PREFIX)) {
    return null;
  }
  try {
    return JSON.parse(raw.slice(DONATION_REQUEST_NOTE_PREFIX.length));
  } catch {
    return null;
  }
}

function mapFallbackDonationRequestRow(row) {
  if (!row) return null;
  const meta = decodeDonationRequestNote(row.note) || {};
  const amount = typeof row.amount === "bigint" ? row.amount : BigInt(String(row.amount || "0"));
  const total = typeof row.total_donations === "bigint" ? row.total_donations : BigInt(String(row.total_donations || "0"));
  const profileSlug = String(row.profile_slug || "").trim();
  return {
    id: `op:${String(row.id || "")}`,
    userId: String(row.user_id || ""),
    userName: String(row.display_name || row.first_name || row.login || "UNQX User").trim() || "UNQX User",
    login: row.login ? String(row.login) : null,
    email: row.email ? String(row.email) : "",
    profileUrl: profileSlug ? `/${encodeURIComponent(profileSlug)}` : null,
    amount: amount.toString(),
    amountLabel: formatDonationLabel(amount),
    status: String(meta.status || "new"),
    paymentReference: String(meta.reference || row.source_key || ""),
    paymentUrl: String(meta.paymentUrl || ""),
    rankPreview: meta.rankPreview == null ? null : Number(meta.rankPreview),
    adminLogin: row.admin_login ? String(row.admin_login) : null,
    adminNote: String(meta.adminNote || ""),
    totalDonations: total.toString(),
    totalDonationsLabel: formatDonationLabel(total),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : null,
    updatedAt: row.created_at instanceof Date ? row.created_at.toISOString() : null,
    paidAt: meta.paidAt || null,
    approvedAt: meta.approvedAt || null,
    rejectedAt: meta.rejectedAt || null,
    fallback: true,
  };
}

async function createFallbackDonationRequest({ userId, amount, reference, rankPreview }) {
  const note = encodeDonationRequestNote({
    status: "new",
    reference,
    rankPreview: Number(rankPreview || 1),
    adminNote: "",
  });
  const rows = await prisma.$queryRawUnsafe(
    `
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
        $1::uuid,
        'system',
        'request',
        $2::bigint,
        0,
        0,
        $3,
        $4,
        now()
      )
      RETURNING *
    `,
    String(userId),
    String(amount),
    note,
    `donation_request:${reference}`,
  );
  return rows?.[0] || null;
}

async function listFallbackDonationRequests({ status = "all", q = "", page = 1, pageSize = 20 } = {}) {
  const currentPage = Math.max(1, Number(page || 1));
  const take = Math.max(1, Math.min(100, Number(pageSize || 20)));
  const offset = (currentPage - 1) * take;
  const normalizedStatus = String(status || "all").trim().toLowerCase();
  const statusFilter = ["new", "paid", "approved", "rejected"].includes(normalizedStatus) ? normalizedStatus : "";
  const search = String(q || "").trim();
  const searchLike = search ? `%${search}%` : "";
  const rows = await prisma.$queryRaw`
    SELECT
      op.*,
      u.first_name,
      u.display_name,
      u.login,
      u.email,
      COALESCE(dl.total_donations, 0) AS total_donations,
      COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug,
      COUNT(*) OVER()::int AS total_count
    FROM donation_operations op
    JOIN users u ON u.id = op.user_id
    LEFT JOIN donation_leaders dl ON dl.user_id = op.user_id
    LEFT JOIN LATERAL (
      SELECT s.full_slug
      FROM slugs s
      WHERE s.owner_id = u.id
        AND s.status IN ('active', 'approved', 'paused', 'private')
      ORDER BY s.is_primary DESC, s.created_at ASC
      LIMIT 1
    ) primary_slug ON true
    WHERE op.mode = 'request'
      AND op.note LIKE ${`${DONATION_REQUEST_NOTE_PREFIX}%`}
      AND (${statusFilter || null} IS NULL OR op.note ILIKE ${`%"status":"${statusFilter}"%`})
      AND (
        ${searchLike || null} IS NULL
        OR u.display_name ILIKE ${searchLike || null}
        OR u.first_name ILIKE ${searchLike || null}
        OR u.login ILIKE ${searchLike || null}
        OR u.email ILIKE ${searchLike || null}
        OR op.source_key ILIKE ${searchLike || null}
        OR op.note ILIKE ${searchLike || null}
      )
    ORDER BY op.created_at DESC
    LIMIT ${take}
    OFFSET ${offset}
  `;
  const items = (Array.isArray(rows) ? rows : []).map(mapFallbackDonationRequestRow).filter(Boolean);
  const total = Number(rows?.[0]?.total_count || 0);
  return {
    items,
    pagination: {
      page: currentPage,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

async function createDonationRequest({ userId, amount }) {
  const parsed = DonationRequestSchema.parse({ amount });
  const donationAmount = parseDonationAmount(parsed.amount);
  if (donationAmount < MIN_PUBLIC_DONATION_AMOUNT) {
    const error = new Error("DONATION_AMOUNT_TOO_SMALL");
    error.status = 400;
    throw error;
  }
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("USER_ID_REQUIRED");
    error.status = 401;
    throw error;
  }
  if (!isUuid(normalizedUserId)) {
    const error = new Error("USER_ID_INVALID");
    error.status = 401;
    throw error;
  }

  const userRows = await prisma.$queryRawUnsafe(
    `SELECT
      u.id,
      u.first_name,
      u.display_name,
      u.email,
      u.login,
      COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug
    FROM users
    LEFT JOIN LATERAL (
      SELECT s.full_slug
      FROM slugs s
      WHERE s.owner_id = u.id
        AND s.status IN ('active', 'approved', 'paused', 'private')
      ORDER BY s.is_primary DESC, s.created_at ASC
      LIMIT 1
    ) primary_slug ON true
    WHERE id = $1::uuid
      AND status = 'active'
    LIMIT 1`,
    normalizedUserId,
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  if (!user) {
    const error = new Error("USER_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  const rank = await resolveDonationRank({ userId: normalizedUserId, amount: donationAmount });
  const supportTelegram = normalizeTelegramUsername(await getSetting("contact_support_telegram", "@unqx_uz"));
  const reference = buildNewDonationReference();
  const paymentUrl = buildDonationPaymentUrl({
    reference,
    amount: donationAmount,
    rankPreview: rank.estimatedRank,
    telegramUsername: supportTelegram,
    userName: user.display_name || user.first_name || user.login || "UNQX User",
    email: user.email || "",
  });
  let telegramSent = false;
  try {
    await sendDonationRequestToAdminTelegram({
      reference,
      amount: donationAmount,
      rankPreview: rank.estimatedRank,
      user,
    });
    telegramSent = true;
  } catch (error) {
    console.error("[donation-leaders] failed to send donation request to Telegram", {
      code: error?.message || "",
      status: error?.status || "",
    });
  }
  return {
    ok: true,
    request: {
      id: `tg:${reference}`,
      amount: donationAmount.toString(),
      amountLabel: formatDonationLabel(donationAmount),
      status: telegramSent ? "sent" : "new",
      paymentReference: reference,
      paymentUrl,
      rankPreview: rank.estimatedRank,
      projectedTotal: rank.projectedTotal,
      projectedTotalLabel: rank.projectedTotalLabel,
      telegramSent,
    },
  };
}

async function listDonationRequests({ status = "all", q = "", page = 1, pageSize = 20 } = {}) {
  try {
    await ensureDonationRequestsStorage();
  } catch (error) {
    if (isDonationRequestsStorageError(error)) {
      const fallback = await listFallbackDonationRequests({ status, q, page, pageSize });
      return {
        ...fallback,
        storageUnavailable: true,
        message: fallback.items.length ? "" : "Заявок на донат пока нет",
      };
    }
    throw error;
  }
  const currentPage = Math.max(1, Number(page || 1));
  const take = Math.max(1, Math.min(100, Number(pageSize || 20)));
  const offset = (currentPage - 1) * take;
  const normalizedStatus = String(status || "all").trim().toLowerCase();
  const search = String(q || "").trim();
  const statusFilter = ["new", "paid", "approved", "rejected"].includes(normalizedStatus) ? normalizedStatus : "";
  const searchLike = search ? `%${search}%` : "";
  let rows = [];
  try {
    rows = await prisma.$queryRaw`
    SELECT
      dr.*,
      u.first_name,
      u.display_name,
      u.login,
      u.email,
      COALESCE(dl.total_donations, 0) AS total_donations,
      COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug,
      COUNT(*) OVER()::int AS total_count
    FROM donation_requests dr
    JOIN users u ON u.id = dr.user_id
    LEFT JOIN donation_leaders dl ON dl.user_id = dr.user_id
    LEFT JOIN LATERAL (
      SELECT s.full_slug
      FROM slugs s
      WHERE s.owner_id = u.id
        AND s.status IN ('active', 'approved', 'paused', 'private')
      ORDER BY s.is_primary DESC, s.created_at ASC
      LIMIT 1
    ) primary_slug ON true
    WHERE (${statusFilter || null} IS NULL OR dr.status = ${statusFilter || null})
      AND (
        ${searchLike || null} IS NULL
        OR u.display_name ILIKE ${searchLike || null}
        OR u.first_name ILIKE ${searchLike || null}
        OR u.login ILIKE ${searchLike || null}
        OR u.email ILIKE ${searchLike || null}
        OR dr.payment_reference ILIKE ${searchLike || null}
      )
    ORDER BY dr.created_at DESC
    LIMIT ${take}
    OFFSET ${offset}
  `;
  } catch (error) {
    if (isDonationRequestsStorageError(error)) {
      const fallback = await listFallbackDonationRequests({ status, q, page, pageSize });
      return {
        ...fallback,
        storageUnavailable: true,
        message: fallback.items.length ? "" : "Заявок на донат пока нет",
      };
    }
    throw error;
  }
  const fallback = await listFallbackDonationRequests({ status, q, page: 1, pageSize: take });
  const primaryItems = (Array.isArray(rows) ? rows : []).map(mapDonationRequestRow).filter(Boolean);
  const fallbackItems = Array.isArray(fallback.items) ? fallback.items : [];
  const mergedItems = [...primaryItems, ...fallbackItems]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, take);
  const total = Number(rows?.[0]?.total_count || 0);
  return {
    items: mergedItems,
    pagination: {
      page: currentPage,
      pageSize: take,
      total: total + Number(fallback.pagination?.total || 0),
      totalPages: Math.max(1, Math.ceil((total + Number(fallback.pagination?.total || 0)) / take)),
    },
  };
}

async function updateFallbackDonationRequestStatus({ operationId, status, adminLogin = "admin", adminNote = "" }) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedOperationId = String(operationId || "").trim();
  if (!isUuid(normalizedOperationId)) {
    const error = new Error("DONATION_REQUEST_ID_INVALID");
    error.status = 400;
    throw error;
  }
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `
        SELECT *
        FROM donation_operations
        WHERE id = $1::uuid
          AND mode = 'request'
        FOR UPDATE
      `,
      normalizedOperationId,
    );
    const request = rows?.[0];
    if (!request) {
      const error = new Error("DONATION_REQUEST_NOT_FOUND");
      error.status = 404;
      throw error;
    }
    const meta = decodeDonationRequestNote(request.note) || {};
    const currentStatus = String(meta.status || "new").toLowerCase();
    if (currentStatus === "approved" && normalizedStatus === "approved") {
      return request;
    }
    if (currentStatus === "approved" && normalizedStatus !== "approved") {
      const error = new Error("DONATION_REQUEST_ALREADY_APPROVED");
      error.status = 409;
      throw error;
    }
    if (currentStatus === "rejected" && normalizedStatus !== "rejected") {
      const error = new Error("DONATION_REQUEST_ALREADY_REJECTED");
      error.status = 409;
      throw error;
    }
    const nowIso = new Date().toISOString();
    const nextMeta = {
      ...meta,
      status: normalizedStatus,
      adminNote: String(adminNote || "").trim().slice(0, 500),
      ...(normalizedStatus === "paid" ? { paidAt: meta.paidAt || nowIso } : {}),
      ...(normalizedStatus === "approved" ? { approvedAt: meta.approvedAt || nowIso } : {}),
      ...(normalizedStatus === "rejected" ? { rejectedAt: meta.rejectedAt || nowIso } : {}),
    };
    const updatedRows = await tx.$queryRawUnsafe(
      `
        UPDATE donation_operations
        SET admin_login = $2,
            note = $3
        WHERE id = $1::uuid
        RETURNING *
      `,
      normalizedOperationId,
      String(adminLogin || "admin").slice(0, 190),
      encodeDonationRequestNote(nextMeta),
    );
    const updated = updatedRows?.[0] || request;
    if (normalizedStatus === "approved") {
      await addDonationToLeaderWithClient(tx, {
        userId: request.user_id,
        amount: request.amount,
        sourceKey: `donation_request:op:${request.id}`,
        note: `UNQX Leaders donation ${meta.reference || request.source_key || request.id}`,
        adminLogin,
      });
    }
    return updated;
  });

  const detailsRows = await prisma.$queryRawUnsafe(
    `
      SELECT
        op.*,
        u.first_name,
        u.display_name,
        u.login,
        u.email,
        COALESCE(dl.total_donations, 0) AS total_donations,
        COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug
      FROM donation_operations op
      JOIN users u ON u.id = op.user_id
      LEFT JOIN donation_leaders dl ON dl.user_id = op.user_id
      LEFT JOIN LATERAL (
        SELECT s.full_slug
        FROM slugs s
        WHERE s.owner_id = u.id
          AND s.status IN ('active', 'approved', 'paused', 'private')
        ORDER BY s.is_primary DESC, s.created_at ASC
        LIMIT 1
      ) primary_slug ON true
      WHERE op.id = $1::uuid
      LIMIT 1
    `,
    String(result.id || normalizedOperationId),
  );
  return mapFallbackDonationRequestRow(detailsRows?.[0] || result);
}

async function updateDonationRequestStatus({ requestId, status, adminLogin = "admin", adminNote = "" }) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!["paid", "approved", "rejected"].includes(normalizedStatus)) {
    const error = new Error("DONATION_STATUS_INVALID");
    error.status = 400;
    throw error;
  }
  const normalizedRequestId = String(requestId || "").trim();
  if (!normalizedRequestId) {
    const error = new Error("DONATION_REQUEST_ID_REQUIRED");
    error.status = 400;
    throw error;
  }
  if (normalizedRequestId.startsWith("op:")) {
    return updateFallbackDonationRequestStatus({
      operationId: normalizedRequestId.slice(3),
      status: normalizedStatus,
      adminLogin,
      adminNote,
    });
  }
  await ensureDonationRequestsStorage();
  if (!isUuid(normalizedRequestId)) {
    const error = new Error("DONATION_REQUEST_ID_INVALID");
    error.status = 400;
    throw error;
  }
  const result = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRawUnsafe(
      `
      SELECT *
      FROM donation_requests
      WHERE id = $1::uuid
      FOR UPDATE
    `,
      normalizedRequestId,
    );
    const request = lockedRows?.[0];
    if (!request) {
      const error = new Error("DONATION_REQUEST_NOT_FOUND");
      error.status = 404;
      throw error;
    }
    const currentStatus = String(request.status || "new").toLowerCase();
    if (currentStatus === "approved" && normalizedStatus === "approved") {
      return request;
    }
    if (currentStatus === "approved" && normalizedStatus !== "approved") {
      const error = new Error("DONATION_REQUEST_ALREADY_APPROVED");
      error.status = 409;
      throw error;
    }
    if (currentStatus === "rejected" && normalizedStatus !== "rejected") {
      const error = new Error("DONATION_REQUEST_ALREADY_REJECTED");
      error.status = 409;
      throw error;
    }

    const nowColumn =
      normalizedStatus === "approved"
        ? "approved_at"
        : normalizedStatus === "paid"
          ? "paid_at"
          : "rejected_at";
    const updatedRows = await tx.$queryRawUnsafe(
      `UPDATE donation_requests
       SET status = $1,
           admin_login = $2,
           admin_note = $3,
           ${nowColumn} = COALESCE(${nowColumn}, now()),
           updated_at = now()
       WHERE id = $4::uuid
       RETURNING *`,
      normalizedStatus,
      String(adminLogin || "admin").slice(0, 190),
      String(adminNote || "").trim().slice(0, 500) || null,
      normalizedRequestId,
    );
    const updated = updatedRows?.[0] || request;
    if (normalizedStatus === "approved") {
      await addDonationToLeaderWithClient(tx, {
        userId: request.user_id,
        amount: request.amount,
        sourceKey: `donation_request:${request.id}`,
        note: `UNQX Leaders donation ${request.payment_reference}`,
        adminLogin,
      });
    }
    return updated;
  });
  return mapDonationRequestRow(result);
}

async function addDonationToLeader({ userId, amount, note = "", sourceKey = "", adminLogin = "system" }) {
  const result = await prisma.$transaction((tx) => addDonationToLeaderWithClient(tx, {
    userId,
    amount,
    note,
    sourceKey,
    adminLogin,
  }));

  invalidateDonationLeadersCache();
  return result;
}

async function resolveDonationUserByLookup(lookup) {
  const raw = String(lookup || "").trim();
  const normalized = raw.replace(/^@+/, "").replace(/^https?:\/\/[^/]+\//i, "").replace(/^unqx\.uz\//i, "").trim();
  if (!normalized) {
    const error = new Error("DONATION_USER_LOOKUP_REQUIRED");
    error.status = 400;
    throw error;
  }
  const upper = normalized.toUpperCase();
  const like = `%${normalized}%`;
  const rows = await prisma.$queryRaw`
    SELECT
      u.id,
      u.first_name,
      u.display_name,
      u.email,
      u.login,
      u.telegram_username,
      COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug,
      COALESCE(dl.total_donations, 0) AS total_donations,
      COALESCE(dl.is_public_leader, true) AS is_public_leader
    FROM users u
    LEFT JOIN donation_leaders dl ON dl.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT s.full_slug
      FROM slugs s
      WHERE s.owner_id = u.id
        AND s.status IN ('active', 'approved', 'paused', 'private')
      ORDER BY
        CASE WHEN upper(s.full_slug) = ${upper} THEN 0 ELSE 1 END,
        s.is_primary DESC,
        s.created_at ASC
      LIMIT 1
    ) primary_slug ON true
    WHERE u.status = 'active'
      AND (
        (${isUuid(normalized)} = true AND u.id = ${isUuid(normalized) ? normalized : "00000000-0000-0000-0000-000000000000"}::uuid)
        OR upper(COALESCE(u.free_profile_code, '')) = ${upper}
        OR lower(COALESCE(u.login, '')) = lower(${normalized})
        OR lower(COALESCE(u.telegram_username, '')) = lower(${normalized})
        OR lower(COALESCE(u.email, '')) = lower(${normalized})
        OR EXISTS (
          SELECT 1
          FROM slugs s2
          WHERE s2.owner_id = u.id
            AND upper(s2.full_slug) = ${upper}
        )
        OR COALESCE(u.display_name, '') ILIKE ${like}
        OR COALESCE(u.first_name, '') ILIKE ${like}
      )
    ORDER BY
      CASE
        WHEN upper(COALESCE(primary_slug.full_slug, '')) = ${upper} THEN 0
        WHEN upper(COALESCE(u.free_profile_code, '')) = ${upper} THEN 1
        WHEN lower(COALESCE(u.login, '')) = lower(${normalized}) THEN 2
        WHEN lower(COALESCE(u.telegram_username, '')) = lower(${normalized}) THEN 3
        WHEN lower(COALESCE(u.email, '')) = lower(${normalized}) THEN 4
        ELSE 9
      END,
      u.created_at DESC
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    const error = new Error("DONATION_USER_NOT_FOUND");
    error.status = 404;
    throw error;
  }
  const total = typeof row.total_donations === "bigint" ? row.total_donations : BigInt(String(row.total_donations || "0"));
  const profileSlug = String(row.profile_slug || "").trim();
  return {
    userId: String(row.id || ""),
    name: String(row.display_name || row.first_name || row.login || "UNQX User").trim() || "UNQX User",
    login: row.login ? String(row.login) : null,
    email: row.email ? String(row.email) : "",
    telegramUsername: row.telegram_username ? String(row.telegram_username) : "",
    profileSlug: profileSlug || null,
    profileUrl: profileSlug ? `/${encodeURIComponent(profileSlug)}` : null,
    totalDonations: total.toString(),
    totalDonationsLabel: formatDonationLabel(total),
    isPublicLeader: row.is_public_leader !== false,
  };
}

async function addDonationByLookup({ lookup, amount, note = "", adminLogin = "admin" }) {
  const user = await resolveDonationUserByLookup(lookup);
  const donations = await updateDonationLeader({
    userId: user.userId,
    mode: "add",
    amount,
    note: String(note || `Ручное добавление доната: ${lookup}`).trim().slice(0, 500),
    adminLogin,
    isPublicLeader: true,
  });
  return {
    user: {
      ...user,
      totalDonations: donations.totalDonations,
      totalDonationsLabel: donations.totalDonationsLabel,
      isPublicLeader: donations.isPublicLeader,
    },
    donations,
  };
}

async function clearDonationLeaders({ reset = true, adminLogin = "admin", note = "" } = {}) {
  const normalizedNote = String(note || (reset ? "Массовая очистка Top 100" : "Массовое скрытие Top 100")).trim().slice(0, 500);
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT user_id, total_donations
      FROM donation_leaders
      WHERE is_public_leader = true OR total_donations > 0
      FOR UPDATE
    `;
    if (!Array.isArray(rows) || !rows.length) {
      return { affected: 0 };
    }

    if (reset) {
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
        SELECT
          user_id,
          ${String(adminLogin || "admin").slice(0, 190)},
          'set',
          -total_donations,
          total_donations,
          0,
          ${normalizedNote || null},
          NULL,
          now()
        FROM donation_leaders
        WHERE total_donations > 0
      `;
    }

    await tx.$executeRaw`
      UPDATE donation_leaders
      SET
        total_donations = CASE WHEN ${Boolean(reset)} THEN 0 ELSE total_donations END,
        is_public_leader = false,
        updated_at = now()
      WHERE is_public_leader = true OR total_donations > 0
    `;
    return { affected: rows.length };
  });

  invalidateDonationLeadersCache();
  return result;
}

module.exports = {
  addDonationToLeader,
  addDonationByLookup,
  clearDonationLeaders,
  createDonationRequest,
  DonationUpdateSchema,
  DonationRequestSchema,
  formatDonationLabel,
  getDonationLeaderForUser,
  invalidateDonationLeadersCache,
  listDonationLeaders,
  listDonationRequests,
  parseDonationAmount,
  resolveDonationUserByLookup,
  resolveDonationRank,
  updateDonationRequestStatus,
  updateDonationLeader,
};
