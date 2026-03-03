const fs = require("node:fs/promises");
const path = require("node:path");
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
  const normalized = publicPath.replace(/^\//, "");
  return path.join(env.PUBLIC_DIR, normalized.replace(/^public\//, ""));
}

async function ensureAvatarDir() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

async function processAvatarBuffer(input) {
  return sharp(input).resize(400, 400, { fit: "cover", position: "center" }).webp({ quality: 86 }).toBuffer();
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

  try {
    await fs.unlink(getDiskPathFromPublicPath(publicPath));
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

module.exports = {
  ensureAvatarDir,
  getAvatarPublicPath,
  saveAvatarFromBuffer,
  deleteAvatarByPublicPath,
  renameAvatarBySlug,
};