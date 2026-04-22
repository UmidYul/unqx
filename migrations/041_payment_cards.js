module.exports = {
  id: "041_payment_cards",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_cards (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        public_slug VARCHAR(90) NOT NULL UNIQUE,
        title VARCHAR(140) NOT NULL,
        address TEXT,
        postcode VARCHAR(20),
        methods JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_by_staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_cards_owner_id_created_at_idx
      ON payment_cards (owner_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_cards_created_by_staff_id_idx
      ON payment_cards (created_by_staff_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_cards_is_published_idx
      ON payment_cards (is_published)
    `);
  },
};
