module.exports = {
  id: "026_add_staff_users",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staffrole') THEN
          CREATE TYPE staffrole AS ENUM ('admin', 'manager');
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id uuid PRIMARY KEY DEFAULT app_uuid_v4(),
        login varchar(190) NOT NULL,
        password_hash text NOT NULL,
        role staffrole NOT NULL DEFAULT 'manager',
        is_active boolean NOT NULL DEFAULT true,
        name varchar(120),
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS staff_users_login_unique_idx
      ON staff_users (login);
    `);
  },
};
