module.exports = {
  id: "086_add_donation_leaders",
  async up(client) {
    await client.query(`
      DO $$
      DECLARE
        users_id_type text;
        leader_user_id_type text;
        operation_id_type text;
        operation_id_default text;
      BEGIN
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
          INTO users_id_type
        FROM pg_attribute attribute
        WHERE attribute.attrelid = 'users'::regclass
          AND attribute.attname = 'id'
          AND NOT attribute.attisdropped;

        IF users_id_type IS NULL THEN
          RAISE EXCEPTION 'Cannot determine users.id type';
        END IF;

        leader_user_id_type := users_id_type;
        operation_id_type := users_id_type;
        operation_id_default := CASE
          WHEN operation_id_type = 'uuid' AND to_regprocedure('app_uuid_v4()') IS NOT NULL THEN 'DEFAULT app_uuid_v4()'
          WHEN operation_id_type = 'uuid' THEN 'DEFAULT gen_random_uuid()'
          ELSE 'DEFAULT gen_random_uuid()::text'
        END;

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS donation_leaders (
            user_id %1$s PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            total_donations bigint NOT NULL DEFAULT 0,
            is_public_leader boolean NOT NULL DEFAULT true,
            updated_at timestamptz NOT NULL DEFAULT now()
          )',
          leader_user_id_type
        );

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS donation_operations (
            id %1$s PRIMARY KEY %2$s,
            user_id %3$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            admin_login varchar(190) NULL,
            mode varchar(20) NOT NULL,
            amount bigint NOT NULL,
            previous_total bigint NOT NULL,
            next_total bigint NOT NULL,
            note varchar(500) NULL,
            source_key varchar(190) NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          )',
          operation_id_type,
          operation_id_default,
          users_id_type
        );
      END $$;
    `);

    await client.query(`
      ALTER TABLE donation_operations
        ADD COLUMN IF NOT EXISTS source_key varchar(190) NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS donation_leaders_public_total_idx
        ON donation_leaders (is_public_leader, total_donations DESC, updated_at ASC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS donation_operations_user_created_idx
        ON donation_operations (user_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS donation_operations_created_idx
        ON donation_operations (created_at DESC)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS donation_operations_source_key_unique_idx
        ON donation_operations (source_key)
        WHERE source_key IS NOT NULL
    `);
  },
};
