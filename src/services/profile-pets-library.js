const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { env } = require("../config/env");
const { prisma } = require("../db/prisma");

const PETS_DIR = path.join(env.PUBLIC_DIR, "uploads", "profile-pets");

function isPetsLibraryStorageMissing(error) {
  const message = String(error?.message || "");
  return error?.code === "P2021" || error?.code === "P2022" || /unqx_pets|selected_pet_id/i.test(message);
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
    imageUrl: String(row.imageUrl || row.image_url || ""),
    isActive: row.isActive ?? row.is_active ?? true,
    createdAt: row.createdAt || row.created_at || null,
  };
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

async function listLibraryPets({ limit = 200, activeOnly = false, includeIds = [] } = {}) {
  const take = Math.max(1, Math.min(500, Number(limit || 200)));
  const normalizedIncludeIds = [...new Set((Array.isArray(includeIds) ? includeIds : [includeIds])
    .map(normalizeLibraryPetId)
    .filter(Boolean))];
  try {
    const rows = activeOnly && normalizedIncludeIds.length
      ? await prisma.$queryRaw`
        SELECT id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
        FROM unqx_pets
        WHERE is_active = true OR id = ANY(${normalizedIncludeIds}::int[])
        ORDER BY created_at DESC, id DESC
        LIMIT ${take}
      `
      : activeOnly
        ? await prisma.$queryRaw`
          SELECT id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
          FROM unqx_pets
          WHERE is_active = true
          ORDER BY created_at DESC, id DESC
          LIMIT ${take}
        `
        : await prisma.$queryRaw`
          SELECT id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
          FROM unqx_pets
          ORDER BY created_at DESC, id DESC
          LIMIT ${take}
        `;
    return (Array.isArray(rows) ? rows : []).map(mapLibraryPetRow).filter(Boolean);
  } catch (error) {
    if (isPetsLibraryStorageMissing(error)) return [];
    throw error;
  }
}

async function findLibraryPetById(id) {
  const normalizedId = normalizeLibraryPetId(id);
  if (!normalizedId) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
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

async function createLibraryPet({ name, imageUrl }) {
  const normalizedName = String(name || "").trim().replace(/\s+/g, " ").slice(0, 255);
  if (!normalizedName || !imageUrl) {
    const error = new Error("Укажите имя питомца и загрузите SVG или PNG.");
    error.status = 400;
    throw error;
  }
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_pets (name, image_url)
    VALUES (${normalizedName}, ${imageUrl})
    RETURNING id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
  `;
  return mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
}

async function setLibraryPetActive(id, isActive) {
  const normalizedId = normalizeLibraryPetId(id);
  if (!normalizedId) return null;
  const rows = await prisma.$queryRaw`
    UPDATE unqx_pets
    SET is_active = ${Boolean(isActive)}
    WHERE id = ${normalizedId}
    RETURNING id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
  `;
  return mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
}

async function deleteLibraryPet(id) {
  const normalizedId = normalizeLibraryPetId(id);
  if (!normalizedId) return null;
  const rows = await prisma.$queryRaw`
    DELETE FROM unqx_pets
    WHERE id = ${normalizedId}
    RETURNING id, name, image_url AS "imageUrl", is_active AS "isActive", created_at AS "createdAt"
  `;
  const item = mapLibraryPetRow(Array.isArray(rows) ? rows[0] : null);
  if (item?.imageUrl) await deletePetAsset(item.imageUrl);
  return item;
}

module.exports = {
  createLibraryPet,
  deleteLibraryPet,
  deletePetAsset,
  findLibraryPetById,
  isPetsLibraryStorageMissing,
  listLibraryPets,
  normalizeLibraryPetId,
  savePetAsset,
  setLibraryPetActive,
};
