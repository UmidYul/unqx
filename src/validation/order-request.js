const { z } = require("zod");

const OrderRequestSchema = z.object({
  name: z.string().trim().min(1, "Имя обязательно").max(100, "Имя слишком длинное"),
  letters: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Slug должен быть в формате AAA000"),
  digits: z
    .string()
    .trim()
    .regex(/^[0-9]{3}$/, "Slug должен быть в формате AAA000"),
  tariff: z.enum(["basic", "premium"]),
  theme: z.enum(["default_dark", "arctic", "linen", "marble", "forest", "sage_luxe", "midnight_obsidian", "golden_noir", "aurora_codex", "nebula_glass"]).optional(),
  products: z.object({
    digitalCard: z.boolean(),
    bracelet: z.boolean(),
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
