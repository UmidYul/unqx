import { z } from "zod";
import bcrypt from "bcryptjs";

function decodeB64(value?: string) {
  if (!value) {
    return undefined;
  }
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function normalizeBcryptHash(value: string) {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\\$/g, "$");
}

const schema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:55432/unqplus"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(8).default("change-me-dev-secret"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
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
});

const parsed = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_PASSWORD_HASH: decodeB64(process.env.ADMIN_PASSWORD_HASH_B64) ?? process.env.ADMIN_PASSWORD_HASH,
});

export const env = parsed;
