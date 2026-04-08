module.exports = {
    id: "040_badge_applications",
    async up(client) {
        await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeType')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badgetype') THEN
          CREATE TYPE "BadgeType" AS ENUM ('government', 'unqx_staff');
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeType') THEN
          BEGIN ALTER TYPE "BadgeType" ADD VALUE IF NOT EXISTS 'government'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "BadgeType" ADD VALUE IF NOT EXISTS 'unqx_staff'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badgetype')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeType') THEN
          BEGIN ALTER TYPE badgetype ADD VALUE IF NOT EXISTS 'government'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE badgetype ADD VALUE IF NOT EXISTS 'unqx_staff'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS badge_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_type "BadgeType" NOT NULL,
        workplace VARCHAR(200) NOT NULL,
        role VARCHAR(160) NOT NULL,
        proof_text TEXT,
        proof_link VARCHAR(500),
        comment TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS badge_applications_user_type_status_idx
        ON badge_applications (user_id, badge_type, status);
      CREATE INDEX IF NOT EXISTS badge_applications_status_requested_idx
        ON badge_applications (status, requested_at DESC);
    `);
    },
};
