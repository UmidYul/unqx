module.exports = {
  id: "044_profile_wall_post_comments",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_wall_post_comments (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        post_id UUID NOT NULL REFERENCES profile_wall_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content VARCHAR(1000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE profile_wall_post_comments
        ADD COLUMN IF NOT EXISTS post_id UUID,
        ADD COLUMN IF NOT EXISTS user_id UUID,
        ADD COLUMN IF NOT EXISTS content VARCHAR(1000),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await client.query(`
      ALTER TABLE profile_wall_post_comments
        ALTER COLUMN post_id SET NOT NULL,
        ALTER COLUMN user_id SET NOT NULL,
        ALTER COLUMN content SET NOT NULL
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'profile_wall_post_comments'::regclass
            AND conname = 'profile_wall_post_comments_post_id_fkey'
        ) THEN
          ALTER TABLE profile_wall_post_comments
            ADD CONSTRAINT profile_wall_post_comments_post_id_fkey
            FOREIGN KEY (post_id) REFERENCES profile_wall_posts(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'profile_wall_post_comments'::regclass
            AND conname = 'profile_wall_post_comments_user_id_fkey'
        ) THEN
          ALTER TABLE profile_wall_post_comments
            ADD CONSTRAINT profile_wall_post_comments_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_post_comments_post_created_idx
      ON profile_wall_post_comments (post_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_wall_post_comments_user_created_idx
      ON profile_wall_post_comments (user_id, created_at DESC)
    `);
  },
};
