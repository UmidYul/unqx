module.exports = {
  id: "029_add_promo_code_percent",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromoCodeDiscountType') THEN
          BEGIN
            ALTER TYPE "PromoCodeDiscountType" ADD VALUE IF NOT EXISTS 'discount_percent';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;
      END
      $$;
    `);
  },
};
