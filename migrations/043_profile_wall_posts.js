module.exports = {
  id: "043_profile_wall_posts",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfileWallPostStatus') THEN
          CREATE TYPE "ProfileWallPostStatus" AS ENUM ('published', 'hidden', 'deleted');
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfileWallPostStatus') THEN
          BEGIN ALTER TYPE "ProfileWallPostStatus" ADD VALUE IF NOT EXISTS 'published'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "ProfileWallPostStatus" ADD VALUE IF NOT EXISTS 'hidden'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "ProfileWallPostStatus" ADD VALUE IF NOT EXISTS 'deleted'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profilewallpoststatus') THEN
          BEGIN ALTER TYPE profilewallpoststatus ADD VALUE IF NOT EXISTS 'published'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE profilewallpoststatus ADD VALUE IF NOT EXISTS 'hidden'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE profilewallpoststatus ADD VALUE IF NOT EXISTS 'deleted'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_wall_posts (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content VARCHAR(280) NOT NULL,
        status "ProfileWallPostStatus" NOT NULL DEFAULT 'published',
        hidden_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE profile_wall_posts
        ADD COLUMN IF NOT EXISTS owner_id UUID,
        ADD COLUMN IF NOT EXISTS content VARCHAR(280),
        ADD COLUMN IF NOT EXISTS status "ProfileWallPostStatus",
        ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await client.query(`
      UPDATE profile_wall_posts
      SET status = 'published'
      WHERE status IS NULL
    `);

    await client.query(`
      ALTER TABLE profile_wall_posts
        ALTER COLUMN owner_id SET NOT NULL,
        ALTER COLUMN content SET NOT NULL,
        ALTER COLUMN status SET DEFAULT 'published',
        ALTER COLUMN status SET NOT NULL
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'profile_wall_posts'::regclass
            AND conname = 'profile_wall_posts_owner_id_fkey'
        ) THEN
          ALTER TABLE profile_wall_posts
            ADD CONSTRAINT profile_wall_posts_owner_id_fkey
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_wall_post_likes (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        post_id UUID NOT NULL REFERENCES profile_wall_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE profile_wall_post_likes
        ADD COLUMN IF NOT EXISTS post_id UUID,
        ADD COLUMN IF NOT EXISTS user_id UUID,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await client.query(`
      ALTER TABLE profile_wall_post_likes
        ALTER COLUMN post_id SET NOT NULL,
        ALTER COLUMN user_id SET NOT NULL
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'profile_wall_post_likes'::regclass
            AND conname = 'profile_wall_post_likes_post_id_fkey'
        ) THEN
          ALTER TABLE profile_wall_post_likes
            ADD CONSTRAINT profile_wall_post_likes_post_id_fkey
            FOREIGN KEY (post_id) REFERENCES profile_wall_posts(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'profile_wall_post_likes'::regclass
            AND conname = 'profile_wall_post_likes_user_id_fkey'
        ) THEN
          ALTER TABLE profile_wall_post_likes
            ADD CONSTRAINT profile_wall_post_likes_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_wall_post_likes_post_user_uidx
      ON profile_wall_post_likes (post_id, user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_posts_owner_status_created_idx
      ON profile_wall_posts (owner_id, status, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_posts_owner_created_idx
      ON profile_wall_posts (owner_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_posts_status_created_idx
      ON profile_wall_posts (status, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_post_likes_post_created_idx
      ON profile_wall_post_likes (post_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_post_likes_user_created_idx
      ON profile_wall_post_likes (user_id, created_at DESC)
    `);
  },
};
