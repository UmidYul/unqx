module.exports = {
  id: "034_monthly_subscription_model",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderKind')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orderkind') THEN
          CREATE TYPE "OrderKind" AS ENUM ('slug_purchase', 'subscription_renewal');
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderKind') THEN
          BEGIN
            ALTER TYPE "OrderKind" ADD VALUE IF NOT EXISTS 'slug_purchase';
            ALTER TYPE "OrderKind" ADD VALUE IF NOT EXISTS 'subscription_renewal';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orderkind') THEN
          BEGIN
            ALTER TYPE orderkind ADD VALUE IF NOT EXISTS 'slug_purchase';
            ALTER TYPE orderkind ADD VALUE IF NOT EXISTS 'subscription_renewal';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseType') THEN
          BEGIN
            ALTER TYPE "PurchaseType" ADD VALUE IF NOT EXISTS 'premium_subscription_monthly';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchasetype') THEN
          BEGIN
            ALTER TYPE purchasetype ADD VALUE IF NOT EXISTS 'premium_subscription_monthly';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_renewed_at TIMESTAMPTZ;

      ALTER TABLE slug_requests
        ADD COLUMN IF NOT EXISTS subscription_months INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderKind') THEN
          ALTER TABLE slug_requests
            ADD COLUMN IF NOT EXISTS order_kind "OrderKind";
        ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orderkind') THEN
          ALTER TABLE slug_requests
            ADD COLUMN IF NOT EXISTS order_kind orderkind;
        ELSE
          ALTER TABLE slug_requests
            ADD COLUMN IF NOT EXISTS order_kind TEXT;
        END IF;
      END
      $$;
    `);

    await client.query(`
      UPDATE slug_requests
      SET order_kind = 'slug_purchase'
      WHERE order_kind IS NULL;

      ALTER TABLE slug_requests
      ALTER COLUMN order_kind SET DEFAULT 'slug_purchase';

      ALTER TABLE slug_requests
      ALTER COLUMN order_kind SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE purchases
        ADD COLUMN IF NOT EXISTS subscription_period_start TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
    `);

    await client.query(`
      UPDATE users
      SET plan = 'premium'
      WHERE plan::text = 'basic';

      UPDATE users
      SET
        subscription_started_at = COALESCE(subscription_started_at, plan_purchased_at, now()),
        subscription_expires_at = COALESCE(subscription_expires_at, now() + INTERVAL '30 days'),
        subscription_renewed_at = COALESCE(subscription_renewed_at, plan_upgraded_at)
      WHERE plan::text = 'premium';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_subscription_expires_at_idx
      ON users (subscription_expires_at);

      CREATE INDEX IF NOT EXISTS users_plan_subscription_expires_at_idx
      ON users (plan, subscription_expires_at);

      CREATE INDEX IF NOT EXISTS slug_requests_order_kind_created_at_idx
      ON slug_requests (order_kind, created_at);
    `);

    await client.query(`
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      VALUES
        ('plan_premium_monthly_price_usd', to_jsonb(2), 'pricing', 'Premium monthly price USD', 'number', 'system:migration_034')
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      SELECT
        'plan_premium_monthly_price_uzs',
        COALESCE(
          (SELECT value FROM platform_settings WHERE key = 'plan_premium_price'),
          to_jsonb(130000)
        ),
        'pricing',
        'Premium monthly price UZS',
        'number',
        'system:migration_034'
      ON CONFLICT (key) DO NOTHING;
    `);
  },
};
