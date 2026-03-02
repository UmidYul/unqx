import { z } from "zod";

const DEFAULT_ADMIN_HASH = "$2b$10$nXEG5Nb9BeOLV1OkQPFqyOXI73zc/JFsd2wXmuU.5wlqjVwrrRPOu";

const schema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:55432/unqplus"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(8).default("change-me-dev-secret"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ADMIN_LOGIN: z.string().min(1).default("admin"),
  ADMIN_PASSWORD_HASH: z
    .string()
    .optional()
    .transform((value) => (value && value.length >= 20 ? value : DEFAULT_ADMIN_HASH)),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
});
