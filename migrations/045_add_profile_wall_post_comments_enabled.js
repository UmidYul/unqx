module.exports = {
  id: "045_add_profile_wall_post_comments_enabled",
  async up(client) {
    await client.query(`
      ALTER TABLE profile_wall_posts
        ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await client.query(`
      UPDATE profile_wall_posts
      SET comments_enabled = TRUE
      WHERE comments_enabled IS NULL
    `);

    await client.query(`
      ALTER TABLE profile_wall_posts
        ALTER COLUMN comments_enabled SET DEFAULT TRUE,
        ALTER COLUMN comments_enabled SET NOT NULL
    `);
  },
};
