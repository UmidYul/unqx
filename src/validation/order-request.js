const { z } = require("zod");

const OrderRequestSchema = z.object({
  name: z.string().trim().min(1, "РРјСЏ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ").max(100, "РРјСЏ СЃР»РёС€РєРѕРј РґР»РёРЅРЅРѕРµ"),
  letters: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000"),
  digits: z
    .string()
    .trim()
    .regex(/^[0-9]{3}$/, "Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000"),
  tariff: z.enum(["basic", "premium"]),
  theme: z.enum(["default_dark", "arctic", "linen", "marble", "forest", "sage_luxe", "midnight_obsidian", "golden_noir"]).optional(),
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
