module.exports = {
  id: "087_update_donation_leaders_and_admin",
  async up(client) {
    await client.query(`
      DO $$
      DECLARE
        users_id_type text;
        request_id_type text;
        request_id_default text;
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

        request_id_type := users_id_type;
        request_id_default := CASE
          WHEN request_id_type = 'uuid' AND to_regprocedure('app_uuid_v4()') IS NOT NULL THEN 'DEFAULT app_uuid_v4()'
          WHEN request_id_type = 'uuid' THEN 'DEFAULT gen_random_uuid()'
          ELSE 'DEFAULT gen_random_uuid()::text'
        END;

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS donation_requests (
            id %1$s PRIMARY KEY %2$s,
            user_id %3$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount bigint NOT NULL,
            status varchar(20) NOT NULL DEFAULT ''new'',
            payment_reference varchar(40) NOT NULL UNIQUE,
            payment_url text NOT NULL,
            rank_preview integer NULL,
            admin_login varchar(190) NULL,
            admin_note varchar(500) NULL,
            paid_at timestamptz NULL,
            approved_at timestamptz NULL,
            rejected_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )',
          request_id_type,
          request_id_default,
          users_id_type
        );
      END $$;
    `);

    await client.query(`
      ALTER TABLE donation_operations
        ADD COLUMN IF NOT EXISTS source_key varchar(190) NULL
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS donation_operations_source_key_unique_idx
        ON donation_operations (source_key)
        WHERE source_key IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS donation_requests_status_created_idx
        ON donation_requests (status, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS donation_requests_user_created_idx
        ON donation_requests (user_id, created_at DESC)
    `);
  },
};
