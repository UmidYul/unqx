module.exports = {
  id: "025_add_user_login",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS login VARCHAR(190);
    `);

    await client.query(`
      UPDATE users
      SET login = lower(email)
      WHERE login IS NULL AND email IS NOT NULL AND email <> '';
    `);

    await client.query(`
      UPDATE users
      SET login = regexp_replace(lower(telegram_username), '^@+', '', 'g')
      WHERE login IS NULL AND telegram_username IS NOT NULL AND telegram_username <> '';
    `);

    await client.query(`
      UPDATE users
      SET login = regexp_replace(login, '[^a-z0-9._@+-]', '', 'g')
      WHERE login IS NOT NULL;
    `);

    await client.query(`
      WITH ranked AS (
        SELECT id, login,
               ROW_NUMBER() OVER (PARTITION BY login ORDER BY id) AS rn
        FROM users
        WHERE login IS NOT NULL AND login <> ''
      )
      UPDATE users u
      SET login = 'user_' || u.id
      FROM ranked r
      WHERE u.id = r.id AND r.rn > 1;
    `);

    await client.query(`
      UPDATE users
      SET login = 'user_' || id
      WHERE login IS NULL OR login = '';
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique_idx
      ON users (login)
      WHERE login IS NOT NULL;
    `);
  },
};
