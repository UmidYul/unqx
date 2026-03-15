module.exports = {
  id: "027_fix_staffrole_enum",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staffrole')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffRole') THEN
          EXECUTE 'ALTER TYPE staffrole RENAME TO "StaffRole"';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffRole') THEN
          EXECUTE 'CREATE TYPE "StaffRole" AS ENUM (''admin'', ''manager'')';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'staff_users' AND column_name = 'role'
        ) THEN
          IF COALESCE((
            SELECT t.typname
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE c.relname = 'staff_users' AND a.attname = 'role'
          ), '') <> 'StaffRole' THEN
            EXECUTE 'ALTER TABLE staff_users ALTER COLUMN role TYPE "StaffRole" USING role::text::"StaffRole"';
          END IF;

          EXECUTE 'ALTER TABLE staff_users ALTER COLUMN role SET DEFAULT ''manager''';
        END IF;
      END $$;
    `);
  },
};
