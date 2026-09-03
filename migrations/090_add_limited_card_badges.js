module.exports = {
  id: "090_add_limited_card_badges",
  async up(client) {
    await client.query(`
      DO $$
      DECLARE
        users_id_type text;
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

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS limited_card_badges (
            id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id %1$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            event_name varchar(160) NOT NULL,
            card_name varchar(160) NOT NULL,
            edition_number integer NOT NULL,
            edition_total integer NOT NULL,
            comment text NULL,
            status varchar(20) NOT NULL DEFAULT ''active'',
            issued_by_admin varchar(190) NULL,
            revoked_by_admin varchar(190) NULL,
            issued_at timestamptz NOT NULL DEFAULT now(),
            revoked_at timestamptz NULL,
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT limited_card_badges_edition_positive_chk
              CHECK (edition_number > 0 AND edition_total > 0 AND edition_number <= edition_total)
          )',
          users_id_type
        );
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS limited_card_badges_user_status_idx
        ON limited_card_badges (user_id, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS limited_card_badges_status_issued_idx
        ON limited_card_badges (status, issued_at DESC)
    `);
  },
};
