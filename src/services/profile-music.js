const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { env } = require("../config/env");
const { prisma } = require("../db/prisma");

const TRACK_DIR = path.join(env.PUBLIC_DIR, "uploads", "tracks");

function isTrackStorageMissing(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "P2021" ||
    error?.code === "P2022" ||
    /unqx_tracks|selected_track_id/i.test(message)
  );
}

function mapTrackRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    title: String(row.title || ""),
    audioUrl: String(row.audioUrl || row.audio_url || ""),
    isActive: row.isActive ?? row.is_active ?? true,
    createdAt: row.createdAt || row.created_at || null,
  };
}

function normalizeTrackId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Math.trunc(Number(value));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function ensureTrackDir() {
  await fs.mkdir(TRACK_DIR, { recursive: true });
}

function buildTrackPublicPath(fileName) {
  return `/uploads/tracks/${fileName}`;
}

function getDiskPathFromTrackPublicPath(publicPath) {
  const cleanPath = String(publicPath || "").split("?")[0].split("#")[0].trim();
  if (!cleanPath.startsWith("/uploads/tracks/")) return null;
  const basename = path.basename(cleanPath);
  if (!basename || basename !== cleanPath.slice("/uploads/tracks/".length) || !basename.endsWith(".mp3")) {
    return null;
  }
  const resolved = path.resolve(TRACK_DIR, basename);
  const root = `${path.resolve(TRACK_DIR)}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

async function saveTrackMp3(buffer) {
  await ensureTrackDir();
  const nonce = (typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex")).replace(/-/g, "").slice(0, 16);
  const fileName = `track_${Date.now().toString(36)}_${nonce}.mp3`;
  await fs.writeFile(path.join(TRACK_DIR, fileName), buffer);
  return buildTrackPublicPath(fileName);
}

async function deleteTrackFile(publicPath) {
  const diskPath = getDiskPathFromTrackPublicPath(publicPath);
  if (!diskPath) return;
  try {
    await fs.unlink(diskPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function listTracks({ limit = 200, activeOnly = false, includeIds = [] } = {}) {
  const take = Math.max(1, Math.min(500, Number(limit || 200)));
  const normalizedIncludeIds = [...new Set((Array.isArray(includeIds) ? includeIds : [includeIds])
    .map(normalizeTrackId)
    .filter(Boolean))];
  try {
    const rows = activeOnly && normalizedIncludeIds.length
      ? await prisma.$queryRaw`
        SELECT id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
        FROM unqx_tracks
        WHERE is_active = true OR id = ANY(${normalizedIncludeIds}::int[])
        ORDER BY created_at DESC, id DESC
        LIMIT ${take}
      `
      : activeOnly
        ? await prisma.$queryRaw`
          SELECT id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
          FROM unqx_tracks
          WHERE is_active = true
          ORDER BY created_at DESC, id DESC
          LIMIT ${take}
        `
      : await prisma.$queryRaw`
        SELECT id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
        FROM unqx_tracks
        ORDER BY created_at DESC, id DESC
        LIMIT ${take}
      `;
    return (Array.isArray(rows) ? rows : []).map(mapTrackRow).filter(Boolean);
  } catch (error) {
    if (isTrackStorageMissing(error)) return [];
    throw error;
  }
}

async function findTrackById(id) {
  const normalizedId = normalizeTrackId(id);
  if (!normalizedId) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
      FROM unqx_tracks
      WHERE id = ${normalizedId}
      LIMIT 1
    `;
    return mapTrackRow(Array.isArray(rows) ? rows[0] : null);
  } catch (error) {
    if (isTrackStorageMissing(error)) return null;
    throw error;
  }
}

async function createTrack({ title, audioUrl }) {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle || !audioUrl) {
    const error = new Error("Укажите название трека и загрузите MP3.");
    error.status = 400;
    throw error;
  }
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_tracks (title, audio_url)
    VALUES (${normalizedTitle.slice(0, 255)}, ${audioUrl})
    RETURNING id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
  `;
  return mapTrackRow(Array.isArray(rows) ? rows[0] : null);
}

async function deleteTrack(id) {
  const normalizedId = normalizeTrackId(id);
  if (!normalizedId) return null;
  const rows = await prisma.$queryRaw`
    DELETE FROM unqx_tracks
    WHERE id = ${normalizedId}
    RETURNING id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
  `;
  const item = mapTrackRow(Array.isArray(rows) ? rows[0] : null);
  if (item?.audioUrl) {
    await deleteTrackFile(item.audioUrl);
  }
  return item;
}

async function setTrackActive(id, isActive) {
  const normalizedId = normalizeTrackId(id);
  if (!normalizedId) return null;
  const rows = await prisma.$queryRaw`
    UPDATE unqx_tracks
    SET is_active = ${Boolean(isActive)}
    WHERE id = ${normalizedId}
    RETURNING id, title, audio_url AS "audioUrl", is_active AS "isActive", created_at AS "createdAt"
  `;
  return mapTrackRow(Array.isArray(rows) ? rows[0] : null);
}

module.exports = {
  createTrack,
  deleteTrack,
  deleteTrackFile,
  findTrackById,
  isTrackStorageMissing,
  listTracks,
  normalizeTrackId,
  saveTrackMp3,
  setTrackActive,
};
