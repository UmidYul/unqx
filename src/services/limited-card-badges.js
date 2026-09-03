const { randomUUID } = require("node:crypto");

const { Prisma } = require("@prisma/client");
const { z } = require("zod");

const { prisma } = require("../db/prisma");
const { resolveDonationUserByLookup } = require("./donation-leaders");

const LimitedCardIssueSchema = z.object({
  lookup: z.string().trim().min(1).max(190),
  eventName: z.string().trim().min(1).max(160),
  cardName: z.string().trim().min(1).max(160),
  editionNumber: z.coerce.number().int().min(1).max(1_000_000),
  editionTotal: z.coerce.number().int().min(1).max(1_000_000),
  comment: z.string().trim().max(1000).optional().default(""),
}).refine((value) => value.editionNumber <= value.editionTotal, {
  message: "EDITION_NUMBER_GT_TOTAL",
  path: ["editionNumber"],
});

function isLimitedCardsStorageMissing(error) {
  const code = String(error?.code || "");
  if (code === "42P01" || code === "42703" || code === "P2021" || code === "P2022") return true;
  const message = String(error?.message || "").toLowerCase().replace(/\s+/g, "");
  return message.includes("limited_card_badges") || message.includes("tabledoesnotexist") || message.includes("columndoesnotexist");
}

function formatLimitedCardBadge(row) {
  if (!row) return null;
  const editionNumber = Number(row.edition_number || 0);
  const editionTotal = Number(row.edition_total || 0);
  const eventName = String(row.event_name || "").trim();
  const cardName = String(row.card_name || "").trim();
  const profileSlug = String(row.profile_slug || "").trim();
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    eventName,
    cardName,
    editionNumber,
    editionTotal,
    editionLabel: editionNumber > 0 && editionTotal > 0 ? `${editionNumber} из ${editionTotal}` : "",
    title: "Обладатель лимитированной карты",
    line: [eventName, cardName, editionNumber > 0 && editionTotal > 0 ? `${editionNumber} из ${editionTotal}` : ""].filter(Boolean).join(" · "),
    comment: row.comment ? String(row.comment) : "",
    status: String(row.status || "active"),
    issuedByAdmin: row.issued_by_admin ? String(row.issued_by_admin) : "",
    revokedByAdmin: row.revoked_by_admin ? String(row.revoked_by_admin) : "",
    issuedAt: row.issued_at instanceof Date ? row.issued_at.toISOString() : new Date(row.issued_at || Date.now()).toISOString(),
    revokedAt: row.revoked_at ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : new Date(row.revoked_at).toISOString()) : null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at || Date.now()).toISOString(),
    user: {
      id: String(row.user_id || ""),
      name: String(row.display_name || row.first_name || row.login || "UNQX User").trim() || "UNQX User",
      login: row.login ? String(row.login) : "",
      email: row.email ? String(row.email) : "",
      telegramUsername: row.telegram_username ? String(row.telegram_username) : "",
      profileSlug: profileSlug || "",
      profileUrl: profileSlug ? `/${encodeURIComponent(profileSlug)}` : "",
    },
  };
}

async function getActiveLimitedCardBadgeForUser(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        lcb.*,
        u.first_name,
        u.display_name,
        u.email,
        u.login,
        u.telegram_username,
        COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug
      FROM limited_card_badges lcb
      JOIN users u ON u.id = lcb.user_id
      LEFT JOIN LATERAL (
        SELECT s.full_slug
        FROM slugs s
        WHERE s.owner_id = u.id
          AND s.status IN ('active', 'approved', 'paused', 'private')
        ORDER BY s.is_primary DESC, s.created_at ASC
        LIMIT 1
      ) primary_slug ON true
      WHERE lcb.user_id = ${normalizedUserId}
        AND lcb.status = 'active'
        AND lcb.revoked_at IS NULL
      ORDER BY lcb.issued_at DESC
      LIMIT 1
    `;
    return formatLimitedCardBadge(Array.isArray(rows) ? rows[0] : null);
  } catch (error) {
    if (isLimitedCardsStorageMissing(error)) return null;
    throw error;
  }
}

async function listLimitedCardBadges({ status = "all", q = "", page = 1, pageSize = 25 } = {}) {
  const normalizedStatus = String(status || "all").trim().toLowerCase();
  const search = String(q || "").trim();
  const safePage = Math.max(1, Number.parseInt(String(page || "1"), 10) || 1);
  const safePageSize = Math.max(1, Math.min(100, Number.parseInt(String(pageSize || "25"), 10) || 25));
  const where = [Prisma.sql`1=1`];
  if (["active", "revoked"].includes(normalizedStatus)) {
    where.push(Prisma.sql`lcb.status = ${normalizedStatus}`);
  }
  if (search) {
    const like = `%${search}%`;
    where.push(Prisma.sql`(
      lcb.event_name ILIKE ${like}
      OR lcb.card_name ILIKE ${like}
      OR COALESCE(lcb.comment, '') ILIKE ${like}
      OR COALESCE(u.display_name, '') ILIKE ${like}
      OR COALESCE(u.first_name, '') ILIKE ${like}
      OR COALESCE(u.login, '') ILIKE ${like}
      OR COALESCE(u.email, '') ILIKE ${like}
      OR COALESCE(u.telegram_username, '') ILIKE ${like}
      OR EXISTS (
        SELECT 1
        FROM slugs s2
        WHERE s2.owner_id = u.id
          AND s2.full_slug ILIKE ${like}
      )
    )`);
  }
  const whereSql = Prisma.join(where, Prisma.sql` AND `);
  const offset = (safePage - 1) * safePageSize;
  try {
    const [items, countRows] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT
          lcb.*,
          u.first_name,
          u.display_name,
          u.email,
          u.login,
          u.telegram_username,
          COALESCE(primary_slug.full_slug, u.free_profile_code, '') AS profile_slug
        FROM limited_card_badges lcb
        JOIN users u ON u.id = lcb.user_id
        LEFT JOIN LATERAL (
          SELECT s.full_slug
          FROM slugs s
          WHERE s.owner_id = u.id
            AND s.status IN ('active', 'approved', 'paused', 'private')
          ORDER BY s.is_primary DESC, s.created_at ASC
          LIMIT 1
        ) primary_slug ON true
        WHERE ${whereSql}
        ORDER BY
          CASE WHEN lcb.status = 'active' THEN 0 ELSE 1 END,
          lcb.issued_at DESC
        LIMIT ${safePageSize}
        OFFSET ${offset}
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM limited_card_badges lcb
        JOIN users u ON u.id = lcb.user_id
        WHERE ${whereSql}
      `),
    ]);
    const total = Number(countRows?.[0]?.total || 0);
    return {
      items: (Array.isArray(items) ? items : []).map(formatLimitedCardBadge),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    };
  } catch (error) {
    if (isLimitedCardsStorageMissing(error)) {
      return {
        items: [],
        pagination: { page: safePage, pageSize: safePageSize, total: 0, totalPages: 1 },
        storageReady: false,
      };
    }
    throw error;
  }
}

async function issueLimitedCardBadge({ lookup, eventName, cardName, editionNumber, editionTotal, comment = "", adminLogin = "admin" }) {
  const input = LimitedCardIssueSchema.parse({ lookup, eventName, cardName, editionNumber, editionTotal, comment });
  const user = await resolveDonationUserByLookup(input.lookup);
  try {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO limited_card_badges (
        id,
        user_id,
        event_name,
        card_name,
        edition_number,
        edition_total,
        comment,
        status,
        issued_by_admin,
        issued_at,
        updated_at
      )
      VALUES (
        ${id},
        ${user.userId},
        ${input.eventName},
        ${input.cardName},
        ${input.editionNumber},
        ${input.editionTotal},
        ${input.comment || null},
        'active',
        ${String(adminLogin || "admin").trim().slice(0, 190)},
        now(),
        now()
      )
    `;
    return { user, badge: await getActiveLimitedCardBadgeForUser(user.userId) };
  } catch (error) {
    if (isLimitedCardsStorageMissing(error)) {
      error.status = 503;
      error.message = "LIMITED_CARDS_STORAGE_UNAVAILABLE";
    }
    throw error;
  }
}

async function revokeLimitedCardBadge({ id, adminLogin = "admin" }) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    const error = new Error("LIMITED_CARD_BADGE_ID_REQUIRED");
    error.status = 400;
    throw error;
  }
  try {
    const rows = await prisma.$queryRaw`
      UPDATE limited_card_badges
      SET
        status = 'revoked',
        revoked_by_admin = ${String(adminLogin || "admin").trim().slice(0, 190)},
        revoked_at = now(),
        updated_at = now()
      WHERE id = ${normalizedId}
        AND status = 'active'
      RETURNING *
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      const error = new Error("LIMITED_CARD_BADGE_NOT_FOUND");
      error.status = 404;
      throw error;
    }
    return formatLimitedCardBadge(row);
  } catch (error) {
    if (isLimitedCardsStorageMissing(error)) {
      error.status = 503;
      error.message = "LIMITED_CARDS_STORAGE_UNAVAILABLE";
    }
    throw error;
  }
}

module.exports = {
  LimitedCardIssueSchema,
  getActiveLimitedCardBadgeForUser,
  issueLimitedCardBadge,
  isLimitedCardsStorageMissing,
  listLimitedCardBadges,
  revokeLimitedCardBadge,
};
