module.exports = {
  id: "042_repair_payment_cards_schema",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_cards (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        public_slug VARCHAR(90) NOT NULL UNIQUE,
        title VARCHAR(140) NOT NULL,
        address TEXT,
        postcode VARCHAR(20),
        methods JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_by_staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE payment_cards
        ADD COLUMN IF NOT EXISTS public_slug VARCHAR(90),
        ADD COLUMN IF NOT EXISTS title VARCHAR(140),
        ADD COLUMN IF NOT EXISTS methods JSONB,
        ADD COLUMN IF NOT EXISTS is_published BOOLEAN,
        ADD COLUMN IF NOT EXISTS created_by_staff_id UUID,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payment_cards' AND column_name = 'name'
        ) THEN
          UPDATE payment_cards
          SET title = LEFT(COALESCE(NULLIF(BTRIM(title), ''), NULLIF(BTRIM(name), ''), 'Payment card'), 140)
          WHERE title IS NULL OR BTRIM(title) = '';
        ELSE
          UPDATE payment_cards
          SET title = 'Payment card'
          WHERE title IS NULL OR BTRIM(title) = '';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payment_cards' AND column_name = 'buttons'
        ) THEN
          UPDATE payment_cards
          SET methods = COALESCE(methods, buttons, '[]'::jsonb)
          WHERE methods IS NULL;
        ELSE
          UPDATE payment_cards
          SET methods = '[]'::jsonb
          WHERE methods IS NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payment_cards' AND column_name = 'number'
        ) THEN
          UPDATE payment_cards
          SET public_slug = NULLIF(REGEXP_REPLACE(LOWER(number::text), '[^a-z0-9_-]+', '-', 'g'), '')
          WHERE public_slug IS NULL OR BTRIM(public_slug) = '';
        ELSE
          UPDATE payment_cards
          SET public_slug = 'payment-' || SUBSTRING(id::text, 1, 8)
          WHERE public_slug IS NULL OR BTRIM(public_slug) = '';
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE payment_cards
      SET is_published = true
      WHERE is_published IS NULL
    `);

    await client.query(`
      WITH normalized AS (
        SELECT
          id,
          LEFT(
            COALESCE(
              NULLIF(REGEXP_REPLACE(LOWER(public_slug), '[^a-z0-9_-]+', '-', 'g'), ''),
              'payment-' || SUBSTRING(id::text, 1, 8)
            ),
            80
          ) AS base_slug
        FROM payment_cards
      ),
      ranked AS (
        SELECT
          id,
          base_slug,
          ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS duplicate_rank
        FROM normalized
      )
      UPDATE payment_cards pc
      SET public_slug = CASE
        WHEN ranked.duplicate_rank = 1 THEN ranked.base_slug
        ELSE LEFT(ranked.base_slug, 70) || '-' || ranked.duplicate_rank::text
      END
      FROM ranked
      WHERE pc.id = ranked.id
    `);

    await client.query(`
      ALTER TABLE payment_cards
        ALTER COLUMN public_slug SET NOT NULL,
        ALTER COLUMN title SET NOT NULL,
        ALTER COLUMN methods SET DEFAULT '[]'::jsonb,
        ALTER COLUMN methods SET NOT NULL,
        ALTER COLUMN is_published SET DEFAULT true,
        ALTER COLUMN is_published SET NOT NULL
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'payment_cards'
            AND indexdef ILIKE 'CREATE UNIQUE%'
            AND indexdef ILIKE '%(public_slug)%'
        ) THEN
          EXECUTE 'CREATE UNIQUE INDEX payment_cards_public_slug_unique_idx ON payment_cards (public_slug)';
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'payment_cards'::regclass
            AND conname = 'payment_cards_created_by_staff_id_fkey'
        ) THEN
          ALTER TABLE payment_cards
            ADD CONSTRAINT payment_cards_created_by_staff_id_fkey
            FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_cards_owner_id_created_at_idx
      ON payment_cards (owner_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_cards_created_by_staff_id_idx
      ON payment_cards (created_by_staff_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_cards_is_published_idx
      ON payment_cards (is_published)
    `);
  },
};
