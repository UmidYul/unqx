module.exports = {
  id: "015_mobile_app_core",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tap_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_slug VARCHAR(20) NOT NULL,
        visitor_slug VARCHAR(20),
        visitor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        visitor_ip VARCHAR(45),
        user_agent TEXT,
        source VARCHAR(20) NOT NULL DEFAULT 'direct',
        city VARCHAR(120),
        country VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tap_events_owner_slug ON tap_events (owner_slug);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tap_events_owner_slug_created_at ON tap_events (owner_slug, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tap_events_created_at ON tap_events (created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tap_events_source ON tap_events (source);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_slug VARCHAR(20) NOT NULL,
        contact_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        saved BOOLEAN NOT NULL DEFAULT FALSE,
        subscribed BOOLEAN NOT NULL DEFAULT FALSE,
        first_tap_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_tap_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        tap_count INT NOT NULL DEFAULT 1,
        UNIQUE(owner_id, contact_slug)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_contacts_owner ON user_contacts (owner_id, last_tap_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_contacts_contact_slug ON user_contacts (contact_slug);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_contacts_saved ON user_contacts (owner_id, saved);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nfc_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug VARCHAR(20),
        uid VARCHAR(80),
        operation VARCHAR(20) NOT NULL,
        url TEXT,
        password_hash VARCHAR(128),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nfc_history_user ON nfc_history (user_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nfc_history_uid ON nfc_history (uid);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nfc_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        uid VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL DEFAULT 'Метка',
        linked_slug VARCHAR(20),
        tap_count INT NOT NULL DEFAULT 0,
        last_tap_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'ok',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nfc_tags_user ON nfc_tags (user_id, updated_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(160) NOT NULL,
        body TEXT,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read, created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(user_id, token)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id, updated_at DESC);
    `);
  },
};
