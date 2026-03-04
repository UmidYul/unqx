module.exports = {
  id: "009_add_welcome_dismissed_flag",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS welcome_dismissed BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  },
};
