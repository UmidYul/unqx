import { z } from "zod";

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const schema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:55432/unqplus"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(8).default("change-me-dev-secret"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ADMIN_LOGIN: z.string().min(1).default("admin"),
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(BCRYPT_HASH_REGEX, "ADMIN_PASSWORD_HASH must be a valid bcrypt hash"),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
});
