module.exports = {
  id: "030_track_user_creator_staff",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_by_staff_id UUID
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_created_by_staff_id_idx
      ON users (created_by_staff_id)
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_users')
          AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'users_created_by_staff_id_fkey'
          ) THEN
          ALTER TABLE users
          ADD CONSTRAINT users_created_by_staff_id_fkey
          FOREIGN KEY (created_by_staff_id)
          REFERENCES staff_users(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  },
};
