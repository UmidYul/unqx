const { prisma } = require("../db/prisma");
const {
  sanitizeSlug,
  normalizePrivatePasswordValue,
  comparePrivatePassword,
  parseViewerDevice,
  hashViewerIp,
} = require("./private-access");

function isPrivateAccessStorageMissing(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  return code === "42P01" || code === "42703" || code === "P2021" || code === "P2022";
}

async function listActivePrivatePasswords(ownerId) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, label, password_hash
      FROM card_private_passwords
      WHERE owner_id = ${ownerId}
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `;
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (isPrivateAccessStorageMissing(error)) {
      return [];
    }
    throw error;
  }
}

async function verifyPrivatePasswordForOwner(ownerId, rawPassword) {
  const password = normalizePrivatePasswordValue(rawPassword);
  if (!password) {
    return null;
  }

  const rows = await listActivePrivatePasswords(ownerId);
  for (const row of rows) {
    const matches = await comparePrivatePassword(password, row.password_hash);
    if (!matches) {
      continue;
    }

    const passwordId = String(row.id);
    try {
      await prisma.$queryRaw`
        UPDATE card_private_passwords
        SET last_used_at = now(),
            updated_at = now()
        WHERE id = ${passwordId}
      `;
    } catch (error) {
      if (!isPrivateAccessStorageMissing(error)) {
        throw error;
      }
    }

    return {
      passwordId,
      label: String(row.label || "").trim(),
    };
  }

  return null;
}

async function recordPrivateAccessLog({ req, ownerId, slug, passwordId, passwordLabel }) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!ownerId || !normalizedSlug) {
    return;
  }

  const userAgent = String(req.get("user-agent") || "").slice(0, 400);
  const device = parseViewerDevice(userAgent);
  const viewerIpHash = hashViewerIp(req);

  try {
    await prisma.$queryRaw`
      INSERT INTO card_private_access_logs (
        owner_id,
        slug,
        password_id,
        password_label,
        viewer_device,
        viewer_ip_hash,
        user_agent,
        created_at
      )
      VALUES (
        ${ownerId},
        ${normalizedSlug},
        ${passwordId || null},
        ${passwordLabel || null},
        ${device || null},
        ${viewerIpHash || null},
        ${userAgent || null},
        now()
      )
    `;
  } catch (error) {
    if (isPrivateAccessStorageMissing(error)) {
      return;
    }
    throw error;
  }
}

module.exports = {
  isPrivateAccessStorageMissing,
  listActivePrivatePasswords,
  verifyPrivatePasswordForOwner,
  recordPrivateAccessLog,
};