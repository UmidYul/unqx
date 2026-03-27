module.exports = {
  id: "033_add_user_profile_type",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserProfileType')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userprofiletype') THEN
          CREATE TYPE "UserProfileType" AS ENUM ('person', 'company');
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserProfileType') THEN
          BEGIN
            ALTER TYPE "UserProfileType" ADD VALUE IF NOT EXISTS 'person';
            ALTER TYPE "UserProfileType" ADD VALUE IF NOT EXISTS 'company';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userprofiletype') THEN
          BEGIN
            ALTER TYPE userprofiletype ADD VALUE IF NOT EXISTS 'person';
            ALTER TYPE userprofiletype ADD VALUE IF NOT EXISTS 'company';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserProfileType') THEN
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS profile_type "UserProfileType";
        ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userprofiletype') THEN
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS profile_type userprofiletype;
        ELSE
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS profile_type TEXT;
        END IF;
      END
      $$;
    `);

    await client.query(`
      UPDATE users
      SET profile_type = 'person'
      WHERE profile_type IS NULL
    `);

    await client.query(`
      ALTER TABLE users
      ALTER COLUMN profile_type SET DEFAULT 'person'
    `);

    await client.query(`
      ALTER TABLE users
      ALTER COLUMN profile_type SET NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_profile_type_idx
      ON users (profile_type)
    `);
  },
};
