const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");

const { env } = require("../config/env");
const { prisma } = require("../db/prisma");

const EVENT_CARD_DIR = path.join(env.PUBLIC_DIR, "uploads", "event-cards");
const SUPPORTED_FORMATS = new Map([
  ["jpeg", "jpg"],
  ["jpg", "jpg"],
  ["png", "png"],
  ["webp", "webp"],
]);

function isEventCardStorageMissing(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "P2021" ||
    error?.code === "P2022" ||
    /unqx_event_card_releases/i.test(message)
  );
}

function mapEventCardRelease(row) {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    description: String(row.description || ""),
    imageFrontUrl: String(row.imageFrontUrl || row.image_front_url || ""),
    imageBackUrl: String(row.imageBackUrl || row.image_back_url || ""),
    createdAt: row.createdAt || row.created_at || null,
  };
}

async function ensureEventCardDir() {
  await fs.mkdir(EVENT_CARD_DIR, { recursive: true });
}

function buildPublicPath(fileName) {
  return `/uploads/event-cards/${fileName}`;
}

function getDiskPathFromPublicPath(publicPath) {
  const cleanPath = String(publicPath || "").split("?")[0].split("#")[0].trim();
  if (!cleanPath.startsWith("/uploads/event-cards/")) return null;
  const basename = path.basename(cleanPath);
  if (!basename || basename !== cleanPath.slice("/uploads/event-cards/".length)) return null;
  const resolved = path.resolve(EVENT_CARD_DIR, basename);
  const root = `${path.resolve(EVENT_CARD_DIR)}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

async function saveEventCardImage(buffer, side = "front") {
  let metadata = null;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    const error = new Error("Загрузите корректное изображение PNG, JPG или WebP.");
    error.status = 400;
    throw error;
  }

  const extension = SUPPORTED_FORMATS.get(String(metadata.format || "").toLowerCase());
  if (!extension) {
    const error = new Error("Поддерживаются только PNG, JPG и WebP.");
    error.status = 400;
    throw error;
  }

  await ensureEventCardDir();
  const nonce = (typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex")).replace(/-/g, "").slice(0, 16);
  const safeSide = String(side || "front").replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "front";
  const fileName = `event_card_${safeSide}_${Date.now().toString(36)}_${nonce}.${extension}`;
  await fs.writeFile(path.join(EVENT_CARD_DIR, fileName), buffer);
  return buildPublicPath(fileName);
}

async function deleteEventCardImage(publicPath) {
  const diskPath = getDiskPathFromPublicPath(publicPath);
  if (!diskPath) return;
  try {
    await fs.unlink(diskPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function listEventCardReleases({ limit = 50 } = {}) {
  const take = Math.max(1, Math.min(100, Number(limit || 50)));
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, title, description,
             image_front_url AS "imageFrontUrl",
             image_back_url AS "imageBackUrl",
             created_at AS "createdAt"
      FROM unqx_event_card_releases
      ORDER BY created_at DESC
      LIMIT ${take}
    `;
    return (Array.isArray(rows) ? rows : []).map(mapEventCardRelease).filter(Boolean);
  } catch (error) {
    if (isEventCardStorageMissing(error)) return [];
    throw error;
  }
}

async function createEventCardRelease({ title, description, imageFrontUrl, imageBackUrl }) {
  const normalizedTitle = String(title || "").trim();
  const normalizedDescription = String(description || "").trim();
  if (!normalizedTitle || !imageFrontUrl || !imageBackUrl) {
    const error = new Error("Укажите заголовок и загрузите две стороны карты.");
    error.status = 400;
    throw error;
  }

  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_event_card_releases (id, title, description, image_front_url, image_back_url)
    VALUES (${id}, ${normalizedTitle.slice(0, 220)}, ${normalizedDescription}, ${imageFrontUrl}, ${imageBackUrl})
    RETURNING id, title, description,
              image_front_url AS "imageFrontUrl",
              image_back_url AS "imageBackUrl",
              created_at AS "createdAt"
  `;
  return mapEventCardRelease(Array.isArray(rows) ? rows[0] : null);
}

async function deleteEventCardRelease(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  const rows = await prisma.$queryRaw`
    DELETE FROM unqx_event_card_releases
    WHERE id = ${normalizedId}
    RETURNING id, title, description,
              image_front_url AS "imageFrontUrl",
              image_back_url AS "imageBackUrl",
              created_at AS "createdAt"
  `;
  const item = mapEventCardRelease(Array.isArray(rows) ? rows[0] : null);
  if (item) {
    await Promise.all([
      deleteEventCardImage(item.imageFrontUrl),
      deleteEventCardImage(item.imageBackUrl),
    ]);
  }
  return item;
}

module.exports = {
  createEventCardRelease,
  deleteEventCardImage,
  deleteEventCardRelease,
  isEventCardStorageMissing,
  listEventCardReleases,
  saveEventCardImage,
};
