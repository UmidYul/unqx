module.exports = {
  id: "028_add_promo_codes",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromoCodeStatus') THEN
          CREATE TYPE "PromoCodeStatus" AS ENUM ('draft', 'active', 'paused', 'archived');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromoCodeDiscountType') THEN
          CREATE TYPE "PromoCodeDiscountType" AS ENUM ('discount_amount', 'fixed_price');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        code VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(180) NOT NULL,
        status "PromoCodeStatus" NOT NULL DEFAULT 'draft',
        discount_type "PromoCodeDiscountType" NOT NULL,
        discount_value INTEGER NOT NULL,
        budget_amount INTEGER NOT NULL DEFAULT 0,
        per_user_cap INTEGER NOT NULL DEFAULT 1,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        created_by VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE slug_requests
      ADD COLUMN IF NOT EXISTS promo_discount_applied INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS promo_discount_applied INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS promo_codes_status_window_idx
      ON promo_codes(status, starts_at, ends_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS promo_codes_code_status_type_idx
      ON promo_codes(code, status, discount_type);
    `);

    await client.query(`
      INSERT INTO promo_codes (
        code,
        name,
        status,
        discount_type,
        discount_value,
        budget_amount,
        per_user_cap,
        starts_at,
        ends_at,
        created_by,
        created_at,
        updated_at
      )
      SELECT
        rc.promo_code,
        rc.name,
        rc.status::text::"PromoCodeStatus",
        'discount_amount'::"PromoCodeDiscountType",
        COALESCE(rc.invitee_discount_override, 0),
        COALESCE(rc.budget_amount, 0),
        COALESCE(rc.per_user_cap, 1),
        rc.starts_at,
        rc.ends_at,
        rc.created_by,
        rc.created_at,
        rc.updated_at
      FROM referral_campaigns rc
      WHERE rc.type = 'promo_code'
        AND rc.promo_code IS NOT NULL
        AND rc.promo_code <> ''
      ON CONFLICT (code) DO NOTHING;
    `);
  },
};
