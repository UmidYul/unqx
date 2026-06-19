const { z } = require("zod");

const { PROFILE_THEME_KEYS } = require("../services/profile");

const OrderRequestSchema = z.object({
  orderKind: z.enum(["slug_purchase", "subscription_renewal"]).optional(),
  subscriptionMonths: z.coerce.number().int().min(1).max(12).optional(),
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  letters: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Slug must match AAA000 format"),
  digits: z
    .string()
    .trim()
    .regex(/^[0-9]{3}$/, "Slug must match AAA000 format"),
  tariff: z.literal("premium").default("premium"),
  theme: z.enum(PROFILE_THEME_KEYS).optional(),
  products: z.object({
    digitalCard: z.boolean(),
  }),
  dropId: z.string().uuid().optional(),
  refCode: z.string().trim().max(40).optional(),
  refSource: z.string().trim().max(40).optional(),
  refOffer: z.string().trim().max(80).optional(),
  promoCode: z.string().trim().max(32).optional(),
});

module.exports = {
  OrderRequestSchema,
};
