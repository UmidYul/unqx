module.exports = {
  id: "007_one_time_plans_and_purchases",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserPlan') THEN
          ALTER TYPE "UserPlan" ADD VALUE IF NOT EXISTS 'none';
        ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userplan') THEN
          ALTER TYPE userplan ADD VALUE IF NOT EXISTS 'none';
        END IF;
      END $$;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS plan_purchased_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS plan_upgraded_at TIMESTAMPTZ;

      ALTER TABLE users
        ALTER COLUMN plan SET DEFAULT 'none';

      ALTER TABLE slug_requests
        ADD COLUMN IF NOT EXISTS plan_price INTEGER NOT NULL DEFAULT 0;

      UPDATE slug_requests
      SET plan_price = CASE
        WHEN requested_plan::text = 'premium' THEN 130000
        ELSE 50000
      END
      WHERE plan_price IS NULL OR plan_price = 0;

      WITH approved_orders AS (
        SELECT
          telegram_id,
          MIN(created_at) AS first_purchase_at,
          MIN(created_at) FILTER (WHERE requested_plan::text = 'basic') AS first_basic_at,
          MIN(created_at) FILTER (WHERE requested_plan::text = 'premium') AS first_premium_at,
          (ARRAY_AGG(requested_plan::text ORDER BY created_at DESC))[1] AS latest_plan
        FROM slug_requests
        WHERE status = 'approved'
        GROUP BY telegram_id
      ),
      normalized AS (
        SELECT
          u.telegram_id,
          u.plan::text AS current_plan,
          u.plan_expires_at,
          u.created_at,
          ao.first_purchase_at,
          ao.first_basic_at,
          ao.first_premium_at,
          ao.latest_plan
        FROM users u
        LEFT JOIN approved_orders ao ON ao.telegram_id = u.telegram_id
      )
      UPDATE users u
      SET
        plan = CASE
          WHEN n.latest_plan = 'premium' THEN 'premium'
          WHEN n.latest_plan = 'basic' THEN 'basic'
          WHEN n.current_plan = 'premium' THEN 'premium'
          ELSE 'none'
        END,
        plan_purchased_at = COALESCE(
          u.plan_purchased_at,
          n.first_purchase_at,
          CASE
            WHEN n.current_plan = 'premium'
              THEN COALESCE(n.plan_expires_at - INTERVAL '30 days', n.created_at)
            ELSE NULL
          END
        ),
        plan_upgraded_at = COALESCE(
          u.plan_upgraded_at,
          CASE
            WHEN n.first_basic_at IS NOT NULL
              AND n.first_premium_at IS NOT NULL
              AND n.first_premium_at > n.first_basic_at
              THEN n.first_premium_at
            ELSE NULL
          END
        )
      FROM normalized n
      WHERE u.telegram_id = n.telegram_id;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseType') THEN
          CREATE TYPE "PurchaseType" AS ENUM (
            'slug',
            'basic_plan',
            'premium_plan',
            'upgrade_to_premium',
            'bracelet'
          );
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS purchases (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        telegram_id VARCHAR(40) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
        type "PurchaseType" NOT NULL,
        amount INTEGER NOT NULL,
        slug VARCHAR(20),
        purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        approved_by_admin VARCHAR(40),
        approved_at TIMESTAMPTZ,
        note TEXT
      );

      CREATE INDEX IF NOT EXISTS purchases_telegram_id_purchased_at_idx
        ON purchases (telegram_id, purchased_at DESC);
      CREATE INDEX IF NOT EXISTS purchases_type_purchased_at_idx
        ON purchases (type, purchased_at DESC);
      CREATE INDEX IF NOT EXISTS purchases_slug_idx
        ON purchases (slug);

      WITH approved AS (
        SELECT
          telegram_id,
          slug,
          slug_price,
          requested_plan::text AS requested_plan,
          bracelet,
          created_at,
          updated_at,
          ROW_NUMBER() OVER (PARTITION BY telegram_id ORDER BY created_at ASC) AS rn,
          LAG(requested_plan::text) OVER (PARTITION BY telegram_id ORDER BY created_at ASC) AS prev_plan
        FROM slug_requests
        WHERE status = 'approved'
      )
      INSERT INTO purchases (telegram_id, type, amount, slug, purchased_at, approved_at, note)
      SELECT
        telegram_id,
        'slug',
        slug_price,
        slug,
        COALESCE(updated_at, created_at),
        COALESCE(updated_at, created_at),
        'migrated_from_slug_requests'
      FROM approved;

      WITH approved AS (
        SELECT
          telegram_id,
          slug,
          bracelet,
          created_at,
          updated_at
        FROM slug_requests
        WHERE status = 'approved'
      )
      INSERT INTO purchases (telegram_id, type, amount, slug, purchased_at, approved_at, note)
      SELECT
        telegram_id,
        'bracelet',
        300000,
        slug,
        COALESCE(updated_at, created_at),
        COALESCE(updated_at, created_at),
        'migrated_from_slug_requests'
      FROM approved
      WHERE bracelet = TRUE;

      WITH approved AS (
        SELECT
          telegram_id,
          requested_plan::text AS requested_plan,
          created_at,
          updated_at,
          ROW_NUMBER() OVER (PARTITION BY telegram_id ORDER BY created_at ASC) AS rn,
          LAG(requested_plan::text) OVER (PARTITION BY telegram_id ORDER BY created_at ASC) AS prev_plan
        FROM slug_requests
        WHERE status = 'approved'
      )
      INSERT INTO purchases (telegram_id, type, amount, slug, purchased_at, approved_at, note)
      SELECT
        telegram_id,
        CASE
          WHEN rn = 1 AND requested_plan = 'basic' THEN 'basic_plan'::"PurchaseType"
          WHEN rn = 1 AND requested_plan = 'premium' THEN 'premium_plan'::"PurchaseType"
          WHEN requested_plan = 'premium' AND prev_plan = 'basic' THEN 'upgrade_to_premium'::"PurchaseType"
          ELSE NULL
        END AS type,
        CASE
          WHEN rn = 1 AND requested_plan = 'basic' THEN 50000
          WHEN rn = 1 AND requested_plan = 'premium' THEN 130000
          WHEN requested_plan = 'premium' AND prev_plan = 'basic' THEN 80000
          ELSE 0
        END AS amount,
        NULL,
        COALESCE(updated_at, created_at),
        COALESCE(updated_at, created_at),
        'migrated_from_slug_requests'
      FROM approved
      WHERE
        (rn = 1 AND requested_plan IN ('basic', 'premium'))
        OR (requested_plan = 'premium' AND prev_plan = 'basic');

      DROP INDEX IF EXISTS users_plan_plan_expires_at_idx;
      CREATE INDEX IF NOT EXISTS users_plan_idx ON users (plan);
      CREATE INDEX IF NOT EXISTS users_plan_purchased_at_idx ON users (plan, plan_purchased_at);

      ALTER TABLE users
        DROP COLUMN IF EXISTS plan_expires_at,
        DROP COLUMN IF EXISTS plan_renewed_at,
        DROP COLUMN IF EXISTS plan_billing_cycle,
        DROP COLUMN IF EXISTS next_billing_date,
        DROP COLUMN IF EXISTS subscription_id;

      ALTER TABLE slug_requests
        DROP COLUMN IF EXISTS billing_cycle,
        DROP COLUMN IF EXISTS next_billing_date,
        DROP COLUMN IF EXISTS subscription_id;

      ALTER TABLE order_requests
        DROP COLUMN IF EXISTS billing_cycle,
        DROP COLUMN IF EXISTS next_billing_date,
        DROP COLUMN IF EXISTS subscription_id;

      DROP TABLE IF EXISTS subscriptions;
      DROP TABLE IF EXISTS billing_history;
      DROP TABLE IF EXISTS invoices;
    `);
  },
};
