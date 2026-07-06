const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");

const { env } = require("../config/env");
const { prisma } = require("../db/prisma");

const BANNER_DIR = path.join(env.PUBLIC_DIR, "uploads", "banners");
const AD_PLACEMENTS = new Set(["footer_partner", "header_collab"]);

function isAdvertisementStorageMissing(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "P2021" ||
    error?.code === "P2022" ||
    /unqx_advertisements/i.test(message)
  );
}

function normalizeTargetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizePlacement(value) {
  const placement = String(value || "").trim();
  return AD_PLACEMENTS.has(placement) ? placement : "footer_partner";
}

function mapAdvertisementRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    imageUrl: String(row.imageUrl || row.image_url || ""),
    targetUrl: String(row.targetUrl || row.target_url || ""),
    placement: normalizePlacement(row.placement),
    positionIndex: Number(row.positionIndex || row.position_index || 1),
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

async function listAdvertisements({ limit = 24, placement = "" } = {}) {
  const take = Math.max(1, Math.min(100, Number(limit || 24)));
  const normalizedPlacement = String(placement || "").trim();
  try {
    const rows = AD_PLACEMENTS.has(normalizedPlacement)
      ? await prisma.$queryRaw`
      SELECT id, image_url AS "imageUrl", target_url AS "targetUrl", placement,
             position_index AS "positionIndex", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM unqx_advertisements
      WHERE placement = ${normalizedPlacement}
      ORDER BY position_index ASC, id ASC
      LIMIT ${take}
    `
      : await prisma.$queryRaw`
      SELECT id, image_url AS "imageUrl", target_url AS "targetUrl", placement,
             position_index AS "positionIndex", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM unqx_advertisements
      ORDER BY placement ASC, position_index ASC, id ASC
      LIMIT ${take}
    `;
    return (Array.isArray(rows) ? rows : []).map(mapAdvertisementRow).filter(Boolean);
  } catch (error) {
    if (isAdvertisementStorageMissing(error)) return [];
    throw error;
  }
}

async function ensureBannerDir() {
  await fs.mkdir(BANNER_DIR, { recursive: true });
}

function buildBannerPublicPath(fileName) {
  return `/uploads/banners/${fileName}`;
}

function getDiskPathFromBannerPublicPath(publicPath) {
  const cleanPath = String(publicPath || "").split("?")[0].split("#")[0].trim();
  if (!cleanPath.startsWith("/uploads/banners/")) return null;
  const basename = path.basename(cleanPath);
  if (!basename || basename !== cleanPath.slice("/uploads/banners/".length) || !basename.endsWith(".png")) {
    return null;
  }
  const resolved = path.resolve(BANNER_DIR, basename);
  const root = `${path.resolve(BANNER_DIR)}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

async function saveAdvertisementPng(buffer) {
  let metadata = null;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    const error = new Error("Загрузите корректный PNG-файл.");
    error.status = 400;
    throw error;
  }
  if (String(metadata.format || "").toLowerCase() !== "png") {
    const error = new Error("Загрузите PNG-файл.");
    error.status = 400;
    throw error;
  }
  await ensureBannerDir();
  const nonce = (typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex")).replace(/-/g, "").slice(0, 16);
  const fileName = `banner_${Date.now().toString(36)}_${nonce}.png`;
  await fs.writeFile(path.join(BANNER_DIR, fileName), buffer);
  return buildBannerPublicPath(fileName);
}

async function deleteAdvertisementImage(publicPath) {
  const diskPath = getDiskPathFromBannerPublicPath(publicPath);
  if (!diskPath) return;
  try {
    await fs.unlink(diskPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function createAdvertisement({ imageUrl, targetUrl, positionIndex, placement }) {
  const normalizedTargetUrl = normalizeTargetUrl(targetUrl);
  if (!imageUrl || !normalizedTargetUrl) {
    const error = new Error("Укажите логотип и корректную ссылку.");
    error.status = 400;
    throw error;
  }
  const position = Math.max(1, Math.min(999, Math.round(Number(positionIndex || 1))));
  const normalizedPlacement = normalizePlacement(placement);
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_advertisements (image_url, target_url, placement, position_index)
    VALUES (${imageUrl}, ${normalizedTargetUrl}, ${normalizedPlacement}, ${position})
    RETURNING id, image_url AS "imageUrl", target_url AS "targetUrl", placement,
              position_index AS "positionIndex", created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return mapAdvertisementRow(Array.isArray(rows) ? rows[0] : null);
}

async function deleteAdvertisement(id) {
  const numericId = Math.trunc(Number(id));
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
  const rows = await prisma.$queryRaw`
    DELETE FROM unqx_advertisements
    WHERE id = ${numericId}
    RETURNING id, image_url AS "imageUrl", target_url AS "targetUrl", placement,
              position_index AS "positionIndex", created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const item = mapAdvertisementRow(Array.isArray(rows) ? rows[0] : null);
  if (item?.imageUrl) {
    await deleteAdvertisementImage(item.imageUrl);
  }
  return item;
}

module.exports = {
  createAdvertisement,
  deleteAdvertisement,
  deleteAdvertisementImage,
  isAdvertisementStorageMissing,
  listAdvertisements,
  normalizePlacement,
  normalizeTargetUrl,
  saveAdvertisementPng,
};
