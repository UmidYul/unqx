import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      return normalized.length > 0 ? normalized : undefined;
    });

const urlParser = z.string().url();
const optionalUrl = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized.length > 0 ? normalized : undefined;
  })
  .refine((value) => !value || /^https?:\/\//i.test(value), {
    message: "URL must start with http:// or https://",
  })
  .refine((value) => !value || urlParser.safeParse(value).success, {
    message: "Invalid URL",
  });

export const SlugSchema = z.string().regex(/^[A-Z]{3}[0-9]{3}$/, "Slug format must be AAA001");

export const TagInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(50),
  url: optionalUrl,
  sortOrder: z.number().int().min(0).optional(),
});

export const ButtonInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(50),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "URL must start with http:// or https://",
    }),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).optional(),
});

export const CardUpsertSchema = z.object({
  slug: SlugSchema,
  isActive: z.boolean().default(true),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30),
  verified: z.boolean().default(false),
  hashtag: optionalString(50),
  address: optionalString(300),
  postcode: optionalString(20),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      return normalized.length > 0 ? normalized : undefined;
    })
    .refine((value) => !value || z.string().email().max(100).safeParse(value).success, {
      message: "Invalid email",
    }),
  extraPhone: optionalString(30),
  tags: z.array(TagInputSchema).default([]),
  buttons: z.array(ButtonInputSchema).default([]),
});

export const LoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
