import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

export function getAvatarPublicPath(slug: string): string {
  return `/uploads/avatars/${slug}.webp`;
}

function getAvatarDiskPathBySlug(slug: string): string {
  return path.join(AVATAR_DIR, `${slug}.webp`);
}

function getDiskPathFromPublicPath(publicPath: string): string {
  const normalized = publicPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", normalized);
}

export async function ensureAvatarDir(): Promise<void> {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

export async function processAvatarBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(400, 400, { fit: "cover", position: "center" })
    .webp({ quality: 86 })
    .toBuffer();
}

export async function saveAvatarFromBuffer(slug: string, input: Buffer): Promise<string> {
  await ensureAvatarDir();
  const output = await processAvatarBuffer(input);
  const targetPath = getAvatarDiskPathBySlug(slug);
  await fs.writeFile(targetPath, output);
  return getAvatarPublicPath(slug);
}

export async function deleteAvatarByPublicPath(publicPath?: string | null): Promise<void> {
  if (!publicPath) {
    return;
  }

  try {
    await fs.unlink(getDiskPathFromPublicPath(publicPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function renameAvatarBySlug(oldSlug: string, newSlug: string): Promise<string | null> {
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
