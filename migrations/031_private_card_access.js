module.exports = {
  id: "031_private_card_access",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS card_private_passwords (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(80),
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_used_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS card_private_passwords_owner_id_created_at_idx
      ON card_private_passwords (owner_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS card_private_passwords_owner_id_deleted_at_idx
      ON card_private_passwords (owner_id, deleted_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_private_access_logs (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug VARCHAR(20) NOT NULL,
        password_id UUID REFERENCES card_private_passwords(id) ON DELETE SET NULL,
        password_label VARCHAR(80),
        viewer_device VARCHAR(220),
        viewer_ip_hash VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS card_private_access_logs_owner_id_created_at_idx
      ON card_private_access_logs (owner_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS card_private_access_logs_slug_created_at_idx
      ON card_private_access_logs (slug, created_at DESC)
    `);
  },
};