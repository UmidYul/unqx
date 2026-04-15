const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");

const { env } = require("../config/env");

const AVATAR_DIR = path.join(env.PUBLIC_DIR, "uploads", "avatars");

function getAvatarPublicPath(slug) {
  return `/uploads/avatars/${slug}.webp`;
}

function getAvatarDiskPathBySlug(slug) {
  return path.join(AVATAR_DIR, `${slug}.webp`);
}

function getDiskPathFromPublicPath(publicPath) {
  const cleanPath = String(publicPath || "")
    .split("?")[0]
    .split("#")[0]
    .trim();
  if (!cleanPath.startsWith("/uploads/avatars/")) {
    return null;
  }

  const basename = path.basename(cleanPath);
  if (!basename || basename !== cleanPath.slice("/uploads/avatars/".length) || !basename.endsWith(".webp")) {
    return null;
  }

  const resolved = path.resolve(AVATAR_DIR, basename);
  const avatarRoot = `${path.resolve(AVATAR_DIR)}${path.sep}`;
  if (!resolved.startsWith(avatarRoot)) {
    return null;
  }

  return resolved;
}

async function ensureAvatarDir() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

async function processAvatarBuffer(input) {
  return sharp(input).resize(400, 400, { fit: "cover", position: "center" }).webp({ quality: 86 }).toBuffer();
}

async function isSupportedAvatarBuffer(input) {
  try {
    const metadata = await sharp(input).metadata();
    return ["jpeg", "png", "webp"].includes(String(metadata.format || "").toLowerCase());
  } catch {
    return false;
  }
}

async function saveAvatarFromBuffer(slug, input) {
  await ensureAvatarDir();
  const output = await processAvatarBuffer(input);
  const targetPath = getAvatarDiskPathBySlug(slug);
  await fs.writeFile(targetPath, output);
  return getAvatarPublicPath(slug);
}

async function deleteAvatarByPublicPath(publicPath) {
  if (!publicPath) {
    return;
  }

  const diskPath = getDiskPathFromPublicPath(publicPath);
  if (!diskPath) {
    return;
  }

  try {
    await fs.unlink(diskPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function renameAvatarBySlug(oldSlug, newSlug) {
  if (oldSlug === newSlug) {
    return getAvatarPublicPath(oldSlug);
  }

  await ensureAvatarDir();

  const oldPath = getAvatarDiskPathBySlug(oldSlug);
  const newPath = getAvatarDiskPathBySlug(newSlug);

  try {
    await fs.rename(oldPath, newPath);
    return getAvatarPublicPath(newSlug);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function getAvatarFileNameFromPublicPath(publicPath) {
  if (typeof publicPath !== "string") {
    return null;
  }

  const cleanPath = publicPath.split("?")[0].split("#")[0];
  if (!cleanPath.startsWith("/uploads/avatars/")) {
    return null;
  }

  const basename = path.basename(cleanPath);
  if (!basename.endsWith(".webp")) {
    return null;
  }

  return basename;
}

function sanitizeAvatarSlugPart(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
}

function buildAvatarSlug(prefix) {
  const base = sanitizeAvatarSlugPart(prefix) || "profile";
  const nonceSource = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
  const nonce = nonceSource.replace(/-/g, "").slice(0, 12);
  const stamp = Date.now().toString(36);
  return `${base}_${stamp}_${nonce}`;
}

async function cleanupOrphanAvatars(referencedPublicPaths = []) {
  await ensureAvatarDir();

  const referenced = new Set(
    referencedPublicPaths
      .map((publicPath) => getAvatarFileNameFromPublicPath(publicPath))
      .filter(Boolean),
  );

  const entries = await fs.readdir(AVATAR_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".webp")) {
      continue;
    }

    if (!referenced.has(entry.name)) {
      await deleteAvatarByPublicPath(`/uploads/avatars/${entry.name}`);
    }
  }
}

module.exports = {
  ensureAvatarDir,
  getAvatarPublicPath,
  isSupportedAvatarBuffer,
  saveAvatarFromBuffer,
  deleteAvatarByPublicPath,
  renameAvatarBySlug,
  cleanupOrphanAvatars,
  buildAvatarSlug,
};
