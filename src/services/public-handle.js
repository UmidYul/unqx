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
  return tx.profileCard.create({
    data: buildFreeProfileCardDefaults(user),
    select: { id: true },
  });
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
