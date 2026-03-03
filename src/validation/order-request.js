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
  theme: z.enum(["default_dark", "light_minimal", "gradient", "neon", "corporate"]).optional(),
  products: z.object({
    digitalCard: z.boolean(),
    bracelet: z.boolean(),
  }),
});

module.exports = {
  OrderRequestSchema,
};
