const { z } = require("zod");

const UZ_PHONE_REGEX = /^\+998\d{9}$/;

const optionalString = (max) =>
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

function normalizeUzPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("+") && !raw.startsWith("+998")) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  let tail = "";

  if (digits.startsWith("998")) {
    tail = digits.slice(3);
  } else if (digits.length === 10 && digits.startsWith("0")) {
    tail = digits.slice(1);
  } else if (digits.length === 9) {
    tail = digits;
  } else {
    return null;
  }

  const normalizedTail = tail.slice(0, 9);

  if (normalizedTail.length !== 9) {
    return null;
  }

  return `+998${normalizedTail}`;
}

const requiredUzPhone = z
  .string()
  .trim()
  .transform((value) => normalizeUzPhone(value))
  .refine((value) => Boolean(value && UZ_PHONE_REGEX.test(value)), {
    message: "Phone must match +998XXXXXXXXX",
  })
  .transform((value) => value);

const optionalUzPhone = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) {
      return undefined;
    }

    return normalizeUzPhone(normalized);
  })
  .refine((value) => value === undefined || UZ_PHONE_REGEX.test(value), {
    message: "Phone must match +998XXXXXXXXX",
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

const SlugSchema = z.string().regex(/^[A-Z]{3}[0-9]{3}$/, "Slug format must be AAA001");

const TagInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(50),
  url: optionalUrl,
  sortOrder: z.number().int().min(0).optional(),
});

const ButtonInputSchema = z.object({
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

const CardUpsertSchema = z.object({
  slug: SlugSchema,
  isActive: z.boolean().default(true),
  tariff: z.enum(["basic", "premium"]).optional(),
  theme: z.enum(["default_dark", "arctic", "linen", "marble", "forest"]).optional(),
  name: z.string().trim().min(1).max(100),
  phone: requiredUzPhone,
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
  extraPhone: optionalUzPhone,
  tags: z.array(TagInputSchema).default([]),
  buttons: z.array(ButtonInputSchema).default([]),
});

const LoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

module.exports = {
  SlugSchema,
  TagInputSchema,
  ButtonInputSchema,
  CardUpsertSchema,
  LoginSchema,
};
