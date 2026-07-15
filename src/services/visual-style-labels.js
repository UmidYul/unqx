const { prisma } = require("../db/prisma");

const STYLE_KINDS = new Set(["theme", "frame"]);
const STYLE_KEY_RE = /^[a-z][a-z0-9_]{0,119}$/;

function isVisualStyleLabelStorageMissing(error) {
  const message = String(error?.message || "");
  return error?.code === "P2021" || error?.code === "P2022" || /unqx_visual_style_labels/i.test(message);
}

function normalizeStyleKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  if (!STYLE_KINDS.has(kind)) {
    const error = new Error("Неверный тип визуального стиля.");
    error.status = 400;
    throw error;
  }
  return kind;
}

function normalizeStyleKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!STYLE_KEY_RE.test(key)) {
    const error = new Error("Неверный технический ID.");
    error.status = 400;
    throw error;
  }
  return key;
}

function normalizeDisplayName(value) {
  const displayName = String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
  if (!displayName) {
    const error = new Error("Введите отображаемое имя.");
    error.status = 400;
    throw error;
  }
  return displayName;
}

function mapLabelRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    kind: String(row.styleKind || row.style_kind || ""),
    key: String(row.styleKey || row.style_key || ""),
    displayName: String(row.displayName || row.display_name || ""),
    isActive: row.isActive ?? row.is_active ?? true,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

async function listVisualStyleLabels() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, style_kind AS "styleKind", style_key AS "styleKey",
             display_name AS "displayName", is_active AS "isActive", updated_at AS "updatedAt"
      FROM unqx_visual_style_labels
      ORDER BY style_kind ASC, style_key ASC
    `;
    return (Array.isArray(rows) ? rows : []).map(mapLabelRow).filter(Boolean);
  } catch (error) {
    if (isVisualStyleLabelStorageMissing(error)) return [];
    throw error;
  }
}

async function getVisualStyleLabelMap() {
  const labels = await listVisualStyleLabels();
  const map = new Map();
  labels.forEach((item) => {
    map.set(`${item.kind}:${item.key}`, item);
  });
  return map;
}

async function upsertVisualStyleLabel({ kind, key, displayName }) {
  const normalizedKind = normalizeStyleKind(kind);
  const normalizedKey = normalizeStyleKey(key);
  const normalizedName = normalizeDisplayName(displayName);
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name)
    VALUES (${normalizedKind}, ${normalizedKey}, ${normalizedName})
    ON CONFLICT (style_kind, style_key)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      updated_at = now()
    RETURNING id, style_kind AS "styleKind", style_key AS "styleKey",
              display_name AS "displayName", is_active AS "isActive", updated_at AS "updatedAt"
  `;
  return mapLabelRow(Array.isArray(rows) ? rows[0] : null);
}

async function setVisualStyleActive({ kind, key, isActive, displayName }) {
  const normalizedKind = normalizeStyleKind(kind);
  const normalizedKey = normalizeStyleKey(key);
  const fallbackName = String(displayName || normalizedKey).trim().replace(/\s+/g, " ").slice(0, 160) || normalizedKey;
  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
    VALUES (${normalizedKind}, ${normalizedKey}, ${fallbackName}, ${Boolean(isActive)})
    ON CONFLICT (style_kind, style_key)
    DO UPDATE SET
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id, style_kind AS "styleKind", style_key AS "styleKey",
              display_name AS "displayName", is_active AS "isActive", updated_at AS "updatedAt"
  `;
  return mapLabelRow(Array.isArray(rows) ? rows[0] : null);
}

module.exports = {
  getVisualStyleLabelMap,
  listVisualStyleLabels,
  normalizeDisplayName,
  normalizeStyleKey,
  setVisualStyleActive,
  upsertVisualStyleLabel,
};
