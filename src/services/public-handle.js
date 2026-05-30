const { Prisma } = require("@prisma/client");
const { randomInt } = require("node:crypto");

const { prisma } = require("../db/prisma");
const { normalizeAssignableSlug } = require("./slug");

const PUBLIC_HANDLE_SLUG_STATUSES = ["approved", "active", "paused", "private"];
const FREE_PROFILE_ALLOWED_STATUSES = new Set(["active", "paused", "private"]);
const FREE_PROFILE_CODE_REGEX = /^[1-9][0-9]{11}$/;
const FREE_PROFILE_USER_FIELD_NAMES = Object.freeze([
  "freeProfileCode",
  "freeProfileStatus",
  "freeProfilePauseMessage",
  "freeProfileDisabledAt",
]);
const FREE_PROFILE_USER_SELECT = Object.freeze({
  freeProfileCode: true,
  freeProfileStatus: true,
  freeProfilePauseMessage: true,
  freeProfileDisabledAt: true,
});
const USER_SCALAR_FIELD_ENUM = Prisma?.UserScalarFieldEnum || {};

function supportsFreeProfileUserFields() {
  return FREE_PROFILE_USER_FIELD_NAMES.every((fieldName) => USER_SCALAR_FIELD_ENUM[fieldName] === fieldName);
}

function getFreeProfileUserSelect() {
  return supportsFreeProfileUserFields() ? { ...FREE_PROFILE_USER_SELECT } : {};
}

function getFreeProfileLookupWhere(value) {
  const normalized = normalizeFreeProfileCode(value);
  if (!normalized || !supportsFreeProfileUserFields()) {
    return null;
  }
  return {
    freeProfileCode: normalized,
    freeProfileDisabledAt: null,
  };
}

function getFreeProfileAvailabilityWhere() {
  if (!supportsFreeProfileUserFields()) {
    return null;
  }
  return {
    freeProfileCode: { not: null },
    freeProfileDisabledAt: null,
  };
}

function applyFreeProfileFields(user, row = null) {
  if (!user || typeof user !== "object") {
    return user;
  }
  return {
    ...user,
    freeProfileCode: user.freeProfileCode ?? row?.freeProfileCode ?? null,
    freeProfileStatus: user.freeProfileStatus ?? row?.freeProfileStatus ?? "active",
    freeProfilePauseMessage: user.freeProfilePauseMessage ?? row?.freeProfilePauseMessage ?? null,
    freeProfileDisabledAt: user.freeProfileDisabledAt ?? row?.freeProfileDisabledAt ?? null,
  };
}

async function queryFreeProfileRowsByUserIds(userIds, db = prisma) {
  const normalizedUserIds = [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  )];
  if (!normalizedUserIds.length || supportsFreeProfileUserFields()) {
    return [];
  }
  try {
    return await db.$queryRaw(Prisma.sql`
      SELECT
        id::text AS id,
        free_profile_code AS "freeProfileCode",
        free_profile_status AS "freeProfileStatus",
        free_profile_pause_message AS "freeProfilePauseMessage",
        free_profile_disabled_at AS "freeProfileDisabledAt"
      FROM users
      WHERE id IN (${Prisma.join(normalizedUserIds)})
    `);
  } catch {
    return [];
  }
}

async function queryFreeProfileRowByCode(code, db = prisma) {
  const normalizedCode = normalizeFreeProfileCode(code);
  if (!normalizedCode || supportsFreeProfileUserFields()) {
    return null;
  }
  try {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT
        id::text AS id,
        free_profile_code AS "freeProfileCode",
        free_profile_status AS "freeProfileStatus",
        free_profile_pause_message AS "freeProfilePauseMessage",
        free_profile_disabled_at AS "freeProfileDisabledAt"
      FROM users
      WHERE free_profile_code = ${normalizedCode}
        AND free_profile_disabled_at IS NULL
      LIMIT 1
    `);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

async function hydrateFreeProfileUser(user, db = prisma) {
  if (!user || supportsFreeProfileUserFields()) {
    return user;
  }
  const rows = await queryFreeProfileRowsByUserIds([user.id], db);
  return applyFreeProfileFields(user, Array.isArray(rows) && rows.length ? rows[0] : null);
}

async function hydrateFreeProfileUsers(users, db = prisma) {
  const list = Array.isArray(users) ? users : [];
  if (!list.length || supportsFreeProfileUserFields()) {
    return list;
  }
  const rows = await queryFreeProfileRowsByUserIds(
    list.map((item) => item?.id),
    db,
  );
  const rowsById = new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [String(row?.id || "").trim(), row])
      .filter(([id]) => Boolean(id)),
  );
  return list.map((user) => applyFreeProfileFields(user, rowsById.get(String(user?.id || "").trim())));
}

function normalizeDefaultCardName(displayName, firstName) {
  const nextDisplayName = String(displayName || "").trim().slice(0, 120);
  if (nextDisplayName) {
    return nextDisplayName;
  }
  const nextFirstName = String(firstName || "").trim().slice(0, 120);
  return nextFirstName || "UNQX User";
}

function normalizePublicHandleValue(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeFreeProfileCode(value) {
  const normalized = normalizePublicHandleValue(value);
  return FREE_PROFILE_CODE_REGEX.test(normalized) ? normalized : "";
}

function isFreeProfileCode(value) {
  return Boolean(normalizeFreeProfileCode(value));
}

function normalizeFreeProfileStatus(value, options = {}) {
  if (options.disabledAt) {
    return "disabled";
  }
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return FREE_PROFILE_ALLOWED_STATUSES.has(normalized) ? normalized : "active";
}

function generateFreeProfileCodeCandidate() {
  let code = String(randomInt(1, 10));
  for (let index = 0; index < 11; index += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

async function generateUniqueFreeProfileCode(db = prisma) {
  if (!supportsFreeProfileUserFields()) {
    return "";
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateFreeProfileCodeCandidate();
    const existing = await db.user.findFirst({
      where: { freeProfileCode: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("Unable to generate a unique FREE profile code");
}

function buildFreeProfileCardDefaults(user) {
  return {
    ownerId: user.id,
    name: normalizeDefaultCardName(user.displayName, user.firstName),
    tags: [],
    buttons: [],
    theme: "default_dark",
    showBranding: true,
  };
}

function buildProfileCardCompatErrorText(error) {
  const parts = [];
  const push = (value) => {
    if (!value) return;
    parts.push(String(value));
  };

  push(error?.message);
  push(error?.cause?.message);
  push(error?.meta?.message);
  push(error?.meta?.driverAdapterError?.message);
  push(error?.meta?.driverAdapterError?.cause?.message);

  try {
    push(JSON.stringify(error?.meta || {}));
  } catch {
    // ignore non-serializable error metadata
  }

  return parts.join("\n");
}

function isProfileCardThemeTypeMismatchError(error) {
  const message = buildProfileCardCompatErrorText(error);
  return (
    /column "theme" is of type cardtheme but expression is of type "CardTheme"/i.test(message) ||
    (/column "theme" is of type/i.test(message) &&
      /cardtheme/i.test(message) &&
      /expression is of type "CardTheme"/i.test(message))
  );
}

async function createProfileCardCompat({ tx = prisma, user }) {
  if (!user?.id || typeof tx?.$queryRawUnsafe !== "function") {
    return null;
  }

  const defaults = buildFreeProfileCardDefaults(user);
  const rows = await tx.$queryRawUnsafe(
    `
      WITH inserted AS (
        INSERT INTO profile_cards (owner_id, name, tags, buttons, show_branding)
        VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5)
        ON CONFLICT (owner_id) DO NOTHING
        RETURNING id
      )
      SELECT id FROM inserted
      UNION ALL
      SELECT id FROM profile_cards WHERE owner_id = $1::uuid
      LIMIT 1
    `,
    user.id,
    defaults.name,
    JSON.stringify(defaults.tags),
    JSON.stringify(defaults.buttons),
    defaults.showBranding,
  );

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function ensureProfileCardExists({ tx = prisma, user }) {
  if (!user?.id || !tx.profileCard) {
    return null;
  }
  const existing = await tx.profileCard.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }
  try {
    return await tx.profileCard.create({
      data: buildFreeProfileCardDefaults(user),
      select: { id: true },
    });
  } catch (error) {
    if (!isProfileCardThemeTypeMismatchError(error)) {
      throw error;
    }

    const compatCard = await createProfileCardCompat({ tx, user });
    if (compatCard) {
      return compatCard;
    }

    throw error;
  }
}

async function ensureFreeProfileForUser({ tx = prisma, user, createProfileCard = true } = {}) {
  if (!user?.id) {
    throw new Error("User is required to ensure FREE profile");
  }

  if (!supportsFreeProfileUserFields()) {
    if (createProfileCard) {
      await ensureProfileCardExists({ tx, user });
    }
    return {
      id: user.id,
      firstName: user.firstName,
      displayName: user.displayName,
      freeProfileCode: null,
      freeProfileStatus: "active",
      freeProfilePauseMessage: null,
      freeProfileDisabledAt: null,
    };
  }

  const nextCode = normalizeFreeProfileCode(user.freeProfileCode) || (await generateUniqueFreeProfileCode(tx));
  const nextStatus = normalizeFreeProfileStatus(user.freeProfileStatus, {
    disabledAt: null,
  });
  const updatedUser = await tx.user.update({
    where: { id: user.id },
    data: {
      freeProfileCode: nextCode,
      freeProfileStatus: nextStatus === "disabled" ? "active" : nextStatus,
      freeProfileDisabledAt: null,
    },
    select: {
      id: true,
      firstName: true,
      displayName: true,
      ...getFreeProfileUserSelect(),
    },
  });

  if (createProfileCard) {
    await ensureProfileCardExists({ tx, user: { ...user, ...updatedUser } });
  }

  return updatedUser;
}

function getLinkableSlugRows(slugs) {
  const rows = Array.isArray(slugs) ? slugs : [];
  return rows.filter((row) =>
    PUBLIC_HANDLE_SLUG_STATUSES.includes(
      String(row?.status || "")
        .trim()
        .toLowerCase(),
    ),
  );
}

function getPrimarySlugRow(slugs) {
  const rows = getLinkableSlugRows(slugs);
  const primary = rows.find((row) => row?.isPrimary);
  return primary || rows[0] || null;
}

function mapSlugRowToPublicHandle(row) {
  const fullSlug = String(row?.fullSlug || "").trim().toUpperCase();
  if (!fullSlug) {
    return null;
  }
  return {
    type: "slug",
    value: fullSlug,
    href: `/${encodeURIComponent(fullSlug)}`,
    status: String(row?.status || "active").trim().toLowerCase() || "active",
    pauseMessage: String(row?.pauseMessage || "").trim() || null,
    isPrimary: Boolean(row?.isPrimary),
  };
}

function getFreeProfileHandle(user) {
  const code = normalizeFreeProfileCode(user?.freeProfileCode);
  const status = normalizeFreeProfileStatus(user?.freeProfileStatus, {
    disabledAt: user?.freeProfileDisabledAt,
  });
  if (!code || status === "disabled") {
    return null;
  }
  return {
    type: "free",
    value: code,
    href: `/${encodeURIComponent(code)}`,
    status,
    pauseMessage: String(user?.freeProfilePauseMessage || "").trim() || null,
    isPrimary: true,
  };
}

function getActivePublicHandle(user) {
  const slugHandle = mapSlugRowToPublicHandle(getPrimarySlugRow(user?.slugs));
  if (slugHandle) {
    return slugHandle;
  }
  return getFreeProfileHandle(user);
}

function hasActivePublicProfile(user) {
  return Boolean(getActivePublicHandle(user));
}

function hasPaidPublicHandle(user) {
  return Boolean(mapSlugRowToPublicHandle(getPrimarySlugRow(user?.slugs)));
}

function getAllPublicHandles(user) {
  const slugHandles = getLinkableSlugRows(user?.slugs).map(mapSlugRowToPublicHandle).filter(Boolean);
  const freeHandle = getFreeProfileHandle(user);
  if (slugHandles.length) {
    return slugHandles;
  }
  return freeHandle ? [freeHandle] : [];
}

function buildPublicHandleCompatibilityPayload(user) {
  const publicHandle = getActivePublicHandle(user);
  return {
    publicHandle,
    selectedSlug: publicHandle?.value || null,
    slug: publicHandle?.value || null,
  };
}

function buildPublicHandleUserSelect(options = {}) {
  const includeProfileCard = options.includeProfileCard !== false;
  const includeSlugs = options.includeSlugs !== false;
  return {
    id: true,
    createdAt: true,
    status: true,
    plan: true,
    subscriptionStartedAt: true,
    subscriptionExpiresAt: true,
    displayName: true,
    firstName: true,
    lastName: true,
    city: true,
    username: true,
    login: true,
    email: true,
    emailVerified: true,
    isVerified: true,
    verifiedCompany: true,
    ...getFreeProfileUserSelect(),
    ...(includeProfileCard
      ? {
          profileCard: {
            select: {
              name: true,
              role: true,
              avatarUrl: true,
            },
          },
        }
      : {}),
    ...(includeSlugs
      ? {
          slugs: {
            where: {
              status: {
                in: PUBLIC_HANDLE_SLUG_STATUSES,
              },
            },
            orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              fullSlug: true,
              status: true,
              pauseMessage: true,
              isPrimary: true,
              createdAt: true,
              updatedAt: true,
              approvedAt: true,
              activatedAt: true,
            },
          },
        }
      : {}),
  };
}

async function findPublicHandleByValue(value, options = {}) {
  const normalized = normalizePublicHandleValue(value);
  if (!normalized) {
    return null;
  }

  if (isFreeProfileCode(normalized)) {
    if (supportsFreeProfileUserFields()) {
      const freeProfileWhere = getFreeProfileLookupWhere(normalized);
      if (!freeProfileWhere) {
        return null;
      }
      const owner = await prisma.user.findFirst({
        where: freeProfileWhere,
        select: buildPublicHandleUserSelect(options),
      });
      if (!owner) {
        return null;
      }
      return {
        type: "free",
        value: normalized,
        status: normalizeFreeProfileStatus(owner.freeProfileStatus, {
          disabledAt: owner.freeProfileDisabledAt,
        }),
        pauseMessage: String(owner.freeProfilePauseMessage || "").trim() || null,
        ownerId: owner.id,
        owner,
      };
    }

    const freeProfileRow = await queryFreeProfileRowByCode(normalized, prisma);
    if (!freeProfileRow?.id) {
      return null;
    }
    const ownerBase = await prisma.user.findUnique({
      where: { id: String(freeProfileRow.id).trim() },
      select: buildPublicHandleUserSelect(options),
    });
    const owner = applyFreeProfileFields(ownerBase, freeProfileRow);
    if (!owner) {
      return null;
    }
    return {
      type: "free",
      value: normalized,
      status: normalizeFreeProfileStatus(owner.freeProfileStatus, {
        disabledAt: owner.freeProfileDisabledAt,
      }),
      pauseMessage: String(owner.freeProfilePauseMessage || "").trim() || null,
      ownerId: owner.id,
      owner,
    };
  }

  const slug = normalizeAssignableSlug(normalized);
  if (!slug) {
    return null;
  }

  const row = await prisma.slug.findUnique({
    where: { fullSlug: slug },
    select: {
      fullSlug: true,
      status: true,
      pauseMessage: true,
      isPrimary: true,
      price: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      activatedAt: true,
      owner: {
        select: buildPublicHandleUserSelect(options),
      },
    },
  });
  if (!row) {
    return null;
  }

  return {
    type: "slug",
    value: String(row.fullSlug || "").trim().toUpperCase(),
    status: String(row.status || "").trim().toLowerCase(),
    pauseMessage: String(row.pauseMessage || "").trim() || null,
    ownerId: String(row.ownerId || "").trim() || null,
    owner: row.owner || null,
    slug: row,
  };
}

module.exports = {
  PUBLIC_HANDLE_SLUG_STATUSES,
  FREE_PROFILE_CODE_REGEX,
  supportsFreeProfileUserFields,
  getFreeProfileUserSelect,
  getFreeProfileLookupWhere,
  getFreeProfileAvailabilityWhere,
  applyFreeProfileFields,
  hydrateFreeProfileUser,
  hydrateFreeProfileUsers,
  normalizePublicHandleValue,
  normalizeFreeProfileCode,
  normalizeFreeProfileStatus,
  isFreeProfileCode,
  generateUniqueFreeProfileCode,
  buildFreeProfileCardDefaults,
  ensureProfileCardExists,
  ensureFreeProfileForUser,
  getLinkableSlugRows,
  getPrimarySlugRow,
  mapSlugRowToPublicHandle,
  getFreeProfileHandle,
  getActivePublicHandle,
  hasActivePublicProfile,
  hasPaidPublicHandle,
  getAllPublicHandles,
  buildPublicHandleCompatibilityPayload,
  buildPublicHandleUserSelect,
  findPublicHandleByValue,
};
