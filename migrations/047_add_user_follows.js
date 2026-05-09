module.exports = {
  id: "047_add_user_follows",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(follower_id, followee_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_follows_follower_created
      ON user_follows (follower_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_follows_followee_created
      ON user_follows (followee_id, created_at DESC)
    `);

    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.user_contacts') IS NOT NULL THEN
          INSERT INTO user_follows (
            follower_id,
            followee_id,
            created_at
          )
          SELECT DISTINCT ON (
            uc.owner_id,
            COALESCE(uc.contact_user_id, s.owner_id)
          )
            uc.owner_id AS follower_id,
            COALESCE(uc.contact_user_id, s.owner_id) AS followee_id,
            COALESCE(uc.last_tap_at, uc.first_tap_at, now()) AS created_at
          FROM user_contacts uc
          LEFT JOIN slugs s ON s.full_slug = uc.contact_slug
          WHERE uc.subscribed = TRUE
            AND uc.owner_id IS NOT NULL
            AND COALESCE(uc.contact_user_id, s.owner_id) IS NOT NULL
            AND uc.owner_id <> COALESCE(uc.contact_user_id, s.owner_id)
          ORDER BY
            uc.owner_id,
            COALESCE(uc.contact_user_id, s.owner_id),
            COALESCE(uc.last_tap_at, uc.first_tap_at, now()) ASC
          ON CONFLICT (follower_id, followee_id) DO NOTHING;
        END IF;
      END
      $$;
    `);
  },
};
