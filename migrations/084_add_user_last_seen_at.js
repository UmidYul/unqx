module.exports = {
  id: "084_add_user_last_seen_at",
  async up(client) {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL;

      UPDATE users
      SET last_seen_at = last_login_at
      WHERE last_seen_at IS NULL
        AND last_login_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users(last_seen_at);
    `);
  },
};
