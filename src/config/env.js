const path = require("node:path");
const dotenv = require("dotenv");
const { z } = require("zod");
const bcrypt = require("bcryptjs");

function decodeB64(value) {
  if (!value) {
    return undefined;
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function normalizeBcryptHash(value) {
  return value.trim().replace(/^['\"]|['\"]$/g, "").replace(/\\\$/g, "$");
}

const rootDirDefault = path.resolve(__dirname, "../../..");
const expressAppDirDefault = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(expressAppDirDefault, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(rootDirDefault, ".env"), override: false, quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:55432/unqplus"),
  DIRECT_URL: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(8).optional(),
  SESSION_SECRET: z.string().min(8).optional(),
  ADMIN_LOGIN: z.string().min(1).default("admin"),
  ADMIN_PASSWORD_HASH: z
    .string()
    .transform(normalizeBcryptHash)
    .refine((value) => {
      try {
        bcrypt.getRounds(value);
        return true;
      } catch {
        return false;
      }
    }, "ADMIN_PASSWORD_HASH must be a bcrypt hash"),
  TIMEZONE: z.string().min(1).default("Asia/Tashkent"),
  ROOT_DIR: z.string().optional(),
});

const parsed = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_URL: process.env.APP_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_PASSWORD_HASH: decodeB64(process.env.ADMIN_PASSWORD_HASH_B64) ?? process.env.ADMIN_PASSWORD_HASH,
  TIMEZONE: process.env.TIMEZONE,
  ROOT_DIR: process.env.ROOT_DIR,
});

const ROOT_DIR = parsed.ROOT_DIR ? path.resolve(parsed.ROOT_DIR) : rootDirDefault;
const EXPRESS_APP_DIR = expressAppDirDefault;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const APP_URL = (parsed.APP_URL ?? parsed.NEXT_PUBLIC_APP_URL ?? parsed.NEXTAUTH_URL ?? `http://127.0.0.1:${parsed.PORT}`).replace(/\/$/, "");
const SESSION_SECRET = parsed.SESSION_SECRET ?? parsed.NEXTAUTH_SECRET ?? "change-me-dev-secret";

const env = {
  ...parsed,
  ROOT_DIR,
  EXPRESS_APP_DIR,
  PUBLIC_DIR,
  APP_URL,
  SESSION_SECRET,
};

module.exports = { env };
