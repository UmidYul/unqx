module.exports = {
  id: "008_finalize_none_plan_defaults",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserPlan') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = '"UserPlan"'::regtype
              AND enumlabel = 'none'
          ) THEN
            RAISE EXCEPTION 'Enum value "none" is missing in type "UserPlan". Run migration 007 first.';
          END IF;
        ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userplan') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = 'userplan'::regtype
              AND enumlabel = 'none'
          ) THEN
            RAISE EXCEPTION 'Enum value "none" is missing in type userplan. Run migration 007 first.';
          END IF;
        END IF;
      END $$;

      ALTER TABLE users
        ALTER COLUMN plan SET DEFAULT 'none';

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
      targets AS (
        SELECT
          u.telegram_id,
          u.plan::text AS current_plan,
          u.plan_purchased_at,
          u.plan_upgraded_at,
          ao.first_purchase_at,
          ao.first_basic_at,
          ao.first_premium_at,
          ao.latest_plan,
          CASE
            WHEN ao.latest_plan = 'premium' THEN 'premium'
            WHEN ao.latest_plan = 'basic' THEN 'basic'
            WHEN u.plan::text = 'premium' THEN 'premium'
            ELSE 'none'
          END AS target_plan
        FROM users u
        LEFT JOIN approved_orders ao ON ao.telegram_id = u.telegram_id
      )
      UPDATE users u
      SET
        plan_purchased_at = CASE
          WHEN t.target_plan = 'none' THEN NULL
          ELSE COALESCE(u.plan_purchased_at, t.first_purchase_at)
        END,
        plan_upgraded_at = COALESCE(
          u.plan_upgraded_at,
          CASE
            WHEN t.first_basic_at IS NOT NULL
              AND t.first_premium_at IS NOT NULL
              AND t.first_premium_at > t.first_basic_at
              THEN t.first_premium_at
            ELSE NULL
          END
        )
      FROM targets t
      WHERE u.telegram_id = t.telegram_id;

      WITH approved_orders AS (
        SELECT
          telegram_id,
          (ARRAY_AGG(requested_plan::text ORDER BY created_at DESC))[1] AS latest_plan
        FROM slug_requests
        WHERE status = 'approved'
        GROUP BY telegram_id
      ),
      targets AS (
        SELECT
          u.telegram_id,
          CASE
            WHEN ao.latest_plan = 'premium' THEN 'premium'
            WHEN ao.latest_plan = 'basic' THEN 'basic'
            WHEN u.plan::text = 'premium' THEN 'premium'
            ELSE 'none'
          END AS target_plan
        FROM users u
        LEFT JOIN approved_orders ao ON ao.telegram_id = u.telegram_id
      )
      UPDATE users u
      SET plan = 'premium'
      FROM targets t
      WHERE u.telegram_id = t.telegram_id
        AND t.target_plan = 'premium';

      WITH approved_orders AS (
        SELECT
          telegram_id,
          (ARRAY_AGG(requested_plan::text ORDER BY created_at DESC))[1] AS latest_plan
        FROM slug_requests
        WHERE status = 'approved'
        GROUP BY telegram_id
      ),
      targets AS (
        SELECT
          u.telegram_id,
          CASE
            WHEN ao.latest_plan = 'premium' THEN 'premium'
            WHEN ao.latest_plan = 'basic' THEN 'basic'
            WHEN u.plan::text = 'premium' THEN 'premium'
            ELSE 'none'
          END AS target_plan
        FROM users u
        LEFT JOIN approved_orders ao ON ao.telegram_id = u.telegram_id
      )
      UPDATE users u
      SET plan = 'basic'
      FROM targets t
      WHERE u.telegram_id = t.telegram_id
        AND t.target_plan = 'basic';

      WITH approved_orders AS (
        SELECT
          telegram_id,
          (ARRAY_AGG(requested_plan::text ORDER BY created_at DESC))[1] AS latest_plan
        FROM slug_requests
        WHERE status = 'approved'
        GROUP BY telegram_id
      ),
      targets AS (
        SELECT
          u.telegram_id,
          CASE
            WHEN ao.latest_plan = 'premium' THEN 'premium'
            WHEN ao.latest_plan = 'basic' THEN 'basic'
            WHEN u.plan::text = 'premium' THEN 'premium'
            ELSE 'none'
          END AS target_plan
        FROM users u
        LEFT JOIN approved_orders ao ON ao.telegram_id = u.telegram_id
      )
      UPDATE users u
      SET plan = 'none'
      FROM targets t
      WHERE u.telegram_id = t.telegram_id
        AND t.target_plan = 'none';
    `);
  },
};
