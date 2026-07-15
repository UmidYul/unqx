const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { env } = require("../config/env");
const { prisma } = require("../db/prisma");

const PETS_DIR = path.join(env.PUBLIC_DIR, "uploads", "profile-pets");

function isPetsLibraryStorageMissing(error) {
  const message = String(error?.message || "");
  return error?.code === "P2021" || error?.code === "P2022" || /unqx_pets|unqx_user_pets|unqx_pet_applications|selected_pet_id|price|event_name|description|legacy_type|display_name|is_visible|application_status/i.test(message);
}

function normalizeLibraryPetId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Math.trunc(Number(value));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapLibraryPetRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    name: String(row.name || ""),
    description: String(row.description || "").trim(),
    imageUrl: String(row.imageUrl || row.image_url || ""),
    price: Math.max(0, Math.trunc(Number(row.price || 0))),
    eventName: String(row.eventName || row.event_name || "").trim(),
    legacyType: String(row.legacyType || row.legacy_type || "").trim(),
    isActive: row.isActive ?? row.is_active ?? true,
    isOwned: Boolean(row.isOwned ?? row.is_owned ?? false),
    displayName: String(row.displayName || row.display_name || "").trim(),
    isVisible: Boolean(row.isVisible ?? row.is_visible ?? false),
    applicationStatus: String(row.applicationStatus || row.application_status || "").trim().toLowerCase(),
    applicationId: row.applicationId || row.application_id || null,
    createdAt: row.createdAt || row.created_at || null,
  };
}

function normalizePetPrice(value) {
  const price = Math.trunc(Number(String(value ?? "").replace(/[^\d.-]/g, "")));
  return Number.isFinite(price) && price > 0 ? Math.min(price, 2_000_000_000) : 0;
}

function normalizePetEventName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 255) || null;
}

async function ensurePetsDir() {
  await fs.mkdir(PETS_DIR, { recursive: true });
}

function buildPetPublicPath(fileName) {
  return `/uploads/profile-pets/${fileName}`;
}

function getDiskPathFromPetPublicPath(publicPath) {
  const cleanPath = String(publicPath || "").split("?")[0].split("#")[0].trim();
  if (!cleanPath.startsWith("/uploads/profile-pets/")) return null;
  const basename = path.basename(cleanPath);
  if (!basename || basename !== cleanPath.slice("/uploads/profile-pets/".length)) return null;
  if (!/\.(png|svg)$/i.test(basename)) return null;
  const resolved = path.resolve(PETS_DIR, basename);
  const root = `${path.resolve(PETS_DIR)}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

async function savePetAsset(buffer, extension) {
  const ext = String(extension || "").toLowerCase() === "svg" ? "svg" : "png";
  await ensurePetsDir();
  const nonce = (typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex")).replace(/-/g, "").slice(0, 16);
  const fileName = `pet_${Date.now().toString(36)}_${nonce}.${ext}`;
  await fs.writeFile(path.join(PETS_DIR, fileName), buffer);
  return buildPetPublicPath(fileName);
}

async function deletePetAsset(publicPath) {
  const diskPath = getDiskPathFromPetPublicPath(publicPath);
  if (!diskPath) return;
  try {
    await fs.unlink(diskPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function listLibraryPetsLegacy({ limit = 200 } = {}) {
  const take = Math.max(1, Math.min(500, Number(limit || 200)));
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        name,
        image_url AS "imageUrl",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM unqx_pets
      ORDER BY created_at DESC, id DESC
      LIMIT ${take}
    `;
    return (Array.isArray(rows) ? rows : []).map(mapLibraryPetRow).filter(Boolean);
  } catch (error) {
    const message = String(error?.message || "");
    if (!/is_active|created_at|column .* does not exist/i.test(message)) {
      if (isPetsLibraryStorageMissing(error)) return [];
      throw error;
    }
    const rows = await prisma.$queryRaw`
      SELECT id, name, image_url AS "imageUrl"
      FROM unqx_pets
      ORDER BY id DESC
      LIMIT ${take}
    `;
    return (Array.isArray(rows) ? rows : []).map(mapLibraryPetRow).filter(Boolean);
  }
}

async function listLibraryPets({ limit = 200, activeOnly = false, includeIds = [], userId = null } = {}) {
  const take = Math.max(1, Math.min(500, Number(limit || 200)));
  const normalizedUserId = String(userId || "").trim() || null;
  const normalizedIncludeIds = [...new Set((Array.isArray(includeIds) ? includeIds : [includeIds])
    .map(normalizeLibraryPetId)
    .filter(Boolean))];
  try {
    const rows = activeOnly
      ? await prisma.$queryRaw`
        SELECT
          p.id,
          p.name,
          p.description,
          p.image_url AS "imageUrl",
          p.price,
          p.event_name AS "eventName",
          p.legacy_type AS "legacyType",
          p.is_active AS "isActive",
          p.created_at AS "createdAt",
          (up.user_id IS NOT NULL) AS "isOwned",
          up.display_name AS "displayName",
          up.is_visible AS "isVisible",
          latest_app.id AS "applicationId",
          latest_app.status AS "applicationStatus"
        FROM unqx_pets p
        LEFT JOIN unqx_user_pets up
          ON up.pet_id = p.id
         AND up.user_id = ${normalizedUserId}::uuid
        LEFT JOIN LATERAL (
          SELECT app.id, app.status
          FROM unqx_pet_applications app
          WHERE app.pet_id = p.id
            AND app.user_id = ${normalizedUserId}::uuid
          ORDER BY app.created_at DESC, app.id DESC
          LIMIT 1
        ) latest_app ON true
        WHERE p.is_active = true
           OR p.id = ANY(${normalizedIncludeIds}::int[])
           OR up.user_id IS NOT NULL
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${take}
      `
      : await prisma.$queryRaw`
        SELECT
          p.id,
          p.name,
          p.description,
          p.image_url AS "imageUrl",
          p.price,
          p.event_name AS "eventName",
          p.legacy_type AS "legacyType",
          p.is_active AS "isActive",
          p.created_at AS "createdAt",
          (up.user_id IS NOT NULL) AS "isOwned",
          up.display_name AS "displayName",
          up.is_visible AS "isVisible",
          latest_app.id AS "applicationId",
          latest_app.status AS "applicationStatus"
        FROM unqx_pets p
        LEFT JOIN unqx_user_pets up
          ON up.pet_id = p.id
         AND up.user_id = ${normalizedUserId}::uuid
        LEFT JOIN LATERAL (
          SELECT app.id, app.status
          FROM unqx_pet_applications app
          WHERE app.pet_id = p.id
            AND app.user_id = ${normalizedUserId}::uuid
          ORDER BY app.created_at DESC, app.id DESC
          LIMIT 1
        ) latest_app ON true
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${take}
      `;
    return (Array.isArray(rows) ? rows : []).map(mapLibraryPetRow).filter(Boolean);
  } catch (error) {
    const message = String(error?.message || "");
    if (/unqx_user_pets|unqx_pet_applications|price|event_name|description|legacy_type|display_name|is_visible|application_status|column .* does not exist|relation .* does not exist/i.test(message)) {
      const legacyItems = await listLibraryPetsLegacy({ limit: take });
      if (!activeOnly) return legacyItems;
      const includeSet = new Set(normalizedIncludeIds.map(String));
      return legacyItems.filter((item) => item.isActive || includeSet.has(String(item.id)));
    }
    if (isPetsLibraryStorageMissing(error)) return [];
    throw error;
  }
}

async function createLibraryPetApplication({ userId, petId }) {
  const normalizedPetId = normalizeLibraryPetId(petId);
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !normalizedPetId) return null;
  const pet = await findLibraryPetById(normalizedPetId);
  if (!pet) return null;
  const owned = await isLibraryPetOwnedByUser({ userId: normalizedUserId, petId: normalizedPetId });
  if (owned) {
    return { status: "approved", pet, alreadyOwned: true };
  }
  try {
    const rows = await prisma.$queryRaw`
      INSERT INTO unqx_pet_applications (user_id, pet_id, status)
      VALUES (${normalizedUserId}::uuid, ${normalizedPetId}, 'pending')
      ON CONFLICT (user_id, pet_id) WHERE status = 'pending'
      DO UPDATE SET status = EXCLUDED.status
      RETURNING id, user_id AS "userId", pet_id AS "petId", status, created_at AS "createdAt"
    `;
    const item = Array.isArray(rows) ? rows[0] : null;
    return item ? { ...item, pet } : null;
  } catch (error) {
    if (isPetsLibraryStorageMissing(error)) return null;
    throw error;
  }
}

async function findLibraryPetById(id) {
  const normalizedId = normalizeLibraryPetId(id);
  if (!normalizedId) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, name, description, image_url AS "imageUrl", price, event_name AS "eventName", legacy_type AS "legacyType", is_active AS "isActive", created_at AS "createdAt"
      FROM unqx_pets
      WHERE id = ${normalizedId}
      LIMIT 1
    `;
    return mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
  } catch (error) {
    if (isPetsLibraryStorageMissing(error)) return null;
    throw error;
  }
}

async function findVisibleUserLibraryPet({ userId, petId }) {
  const normalizedPetId = normalizeLibraryPetId(petId);
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !normalizedPetId) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p.description,
        p.image_url AS "imageUrl",
        p.price,
        p.event_name AS "eventName",
        p.legacy_type AS "legacyType",
        p.is_active AS "isActive",
        p.created_at AS "createdAt",
        true AS "isOwned",
        up.display_name AS "displayName",
        up.is_visible AS "isVisible"
      FROM unqx_user_pets up
      JOIN unqx_pets p
        ON p.id = up.pet_id
      WHERE up.user_id = ${normalizedUserId}::uuid
        AND up.pet_id = ${normalizedPetId}
        AND up.is_visible = true
      LIMIT 1
    `;
    return mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
  } catch (error) {
    if (isPetsLibraryStorageMissing(error)) return null;
    throw error;
  }
}

async function listVisibleUserLibraryPets({ userId, limit = 3 } = {}) {
  const normalizedUserId = String(userId || "").trim();
  const take = Math.max(1, Math.min(3, Number(limit || 3)));
  if (!normalizedUserId) return [];
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p.description,
        p.image_url AS "imageUrl",
        p.price,
        p.event_name AS "eventName",
        p.legacy_type AS "legacyType",
        p.is_active AS "isActive",
        p.created_at AS "createdAt",
        true AS "isOwned",
        up.display_name AS "displayName",
        up.is_visible AS "isVisible"
      FROM unqx_user_pets up
      JOIN unqx_pets p
        ON p.id = up.pet_id
      WHERE up.user_id = ${normalizedUserId}::uuid
        AND up.is_visible = true
      ORDER BY up.purchased_at ASC, up.id ASC
      LIMIT ${take}
    `;
    return (Array.isArray(rows) ? rows : []).map(mapLibraryPetRow).filter(Boolean);
  } catch (error) {
    if (isPetsLibraryStorageMissing(error)) return [];
    throw error;
  }
}

async function createLibraryPet({ name, imageUrl, price = 0, eventName = null, description = null }) {
  const normalizedName = String(name || "").trim().replace(/\s+/g, " ").slice(0, 255);
  if (!normalizedName || !imageUrl) {
    const error = new Error("Укажите имя питомца и загрузите SVG или PNG.");
    error.status = 400;
    throw error;
  }
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_pets (name, image_url, price, event_name, description)
    VALUES (${normalizedName}, ${imageUrl}, ${normalizePetPrice(price)}, ${normalizePetEventName(eventName)}, ${normalizePetEventName(description)})
    RETURNING id, name, description, image_url AS "imageUrl", price, event_name AS "eventName", legacy_type AS "legacyType", is_active AS "isActive", created_at AS "createdAt"
  `;
  return mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
}

async function updateLibraryPet(id, { name, imageUrl, price = 0, eventName = null, description = null }) {
  const normalizedId = normalizeLibraryPetId(id);
  const normalizedName = String(name || "").trim().replace(/\s+/g, " ").slice(0, 255);
  if (!normalizedId || !normalizedName) return null;
  const existing = await findLibraryPetById(normalizedId);
  if (!existing) return null;
  const nextImageUrl = String(imageUrl || existing.imageUrl || "").trim();
  const rows = await prisma.$queryRaw`
    UPDATE unqx_pets
    SET name = ${normalizedName},
        image_url = ${nextImageUrl},
        price = ${normalizePetPrice(price)},
        event_name = ${normalizePetEventName(eventName)},
        description = ${normalizePetEventName(description)}
    WHERE id = ${normalizedId}
    RETURNING id, name, description, image_url AS "imageUrl", price, event_name AS "eventName", legacy_type AS "legacyType", is_active AS "isActive", created_at AS "createdAt"
  `;
  const item = mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
  if (imageUrl && existing.imageUrl && existing.imageUrl !== imageUrl) {
    await deletePetAsset(existing.imageUrl);
  }
  return item;
}

async function setLibraryPetActive(id, isActive) {
  const normalizedId = normalizeLibraryPetId(id);
  if (!normalizedId) return null;
  const rows = await prisma.$queryRaw`
    UPDATE unqx_pets
    SET is_active = ${Boolean(isActive)}
    WHERE id = ${normalizedId}
    RETURNING id, name, description, image_url AS "imageUrl", price, event_name AS "eventName", legacy_type AS "legacyType", is_active AS "isActive", created_at AS "createdAt"
  `;
  return mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
}

async function deleteLibraryPet(id) {
  const normalizedId = normalizeLibraryPetId(id);
  if (!normalizedId) return null;
  try {
    await prisma.$executeRaw`
      UPDATE profile_cards
      SET selected_pet_id = NULL
      WHERE selected_pet_id = ${normalizedId}
    `;
  } catch (error) {
    if (!isPetsLibraryStorageMissing(error)) throw error;
  }
  const rows = await prisma.$queryRaw`
    DELETE FROM unqx_pets
    WHERE id = ${normalizedId}
    RETURNING id, name, description, image_url AS "imageUrl", price, event_name AS "eventName", legacy_type AS "legacyType", is_active AS "isActive", created_at AS "createdAt"
  `;
  const item = mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
  if (item?.imageUrl) await deletePetAsset(item.imageUrl);
  return item;
}

async function isLibraryPetOwnedByUser({ userId, petId }) {
  const normalizedPetId = normalizeLibraryPetId(petId);
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !normalizedPetId) return false;
  try {
    const rows = await prisma.$queryRaw`
      SELECT 1
      FROM unqx_user_pets
      WHERE user_id = ${normalizedUserId}::uuid
        AND pet_id = ${normalizedPetId}
      LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    if (isPetsLibraryStorageMissing(error)) return false;
    throw error;
  }
}

async function purchaseLibraryPetForUser({ userId, petId, displayName = "" }) {
  const normalizedPetId = normalizeLibraryPetId(petId);
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !normalizedPetId) return null;
  const pet = await findLibraryPetById(normalizedPetId);
  if (!pet || (!pet.isActive && !await isLibraryPetOwnedByUser({ userId: normalizedUserId, petId: normalizedPetId }))) {
    return null;
  }
  try {
    await prisma.$executeRaw`
      INSERT INTO unqx_user_pets (user_id, pet_id, display_name, is_visible)
      VALUES (${normalizedUserId}::uuid, ${normalizedPetId}, ${String(displayName || pet.name || "").trim().slice(0, 120) || null}, false)
      ON CONFLICT (user_id, pet_id) DO NOTHING
    `;
  } catch (error) {
    if (!isPetsLibraryStorageMissing(error)) throw error;
    await prisma.$executeRaw`
      INSERT INTO unqx_user_pets (user_id, pet_id)
      VALUES (${normalizedUserId}::uuid, ${normalizedPetId})
      ON CONFLICT (user_id, pet_id) DO NOTHING
    `;
  }
  return { ...pet, isOwned: true };
}

async function updateUserLibraryPetPreferences({ userId, pets = [] }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !Array.isArray(pets) || !pets.length) return;
  try {
    for (const patch of pets) {
      const petId = normalizeLibraryPetId(patch?.id ?? patch?.petId ?? patch?.pet_id);
      if (!petId) continue;
      const displayName = String(patch?.displayName || patch?.display_name || "").trim().slice(0, 120) || null;
      const isVisible = Boolean(patch?.isVisible ?? patch?.is_visible);
      await prisma.$executeRaw`
        UPDATE unqx_user_pets
        SET display_name = ${displayName},
            is_visible = ${isVisible}
        WHERE user_id = ${normalizedUserId}::uuid
          AND pet_id = ${petId}
      `;
    }
  } catch (error) {
    if (!isPetsLibraryStorageMissing(error)) throw error;
  }
}

module.exports = {
  createLibraryPet,
  createLibraryPetApplication,
  deleteLibraryPet,
  deletePetAsset,
  findLibraryPetById,
  findVisibleUserLibraryPet,
  isPetsLibraryStorageMissing,
  isLibraryPetOwnedByUser,
  listLibraryPets,
  listVisibleUserLibraryPets,
  normalizeLibraryPetId,
  purchaseLibraryPetForUser,
  savePetAsset,
  setLibraryPetActive,
  updateLibraryPet,
  updateUserLibraryPetPreferences,
};
