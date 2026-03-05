module.exports = {
  id: "010_analytics_directory_verification",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS verified_company VARCHAR(160),
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS show_in_directory BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    await client.query(`
      ALTER TABLE slugs
      ADD COLUMN IF NOT EXISTS analytics_views_count INTEGER NOT NULL DEFAULT 0;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_slugs_analytics_views_count_desc
      ON slugs (analytics_views_count DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(20) NOT NULL,
        visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        source VARCHAR(20) NOT NULL DEFAULT 'direct',
        city VARCHAR(120) NOT NULL DEFAULT 'Неизвестно',
        device VARCHAR(20) NOT NULL DEFAULT 'desktop',
        session_id VARCHAR(80) NOT NULL
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_views_slug_visited_at
      ON analytics_views (slug, visited_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_views_visited_at
      ON analytics_views (visited_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_views_slug_session_visited_at
      ON analytics_views (slug, session_id, visited_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(20) NOT NULL,
        button_type VARCHAR(40) NOT NULL DEFAULT 'other',
        clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_clicks_slug_clicked_at
      ON analytics_clicks (slug, clicked_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_clicks_button_type_clicked_at
      ON analytics_clicks (button_type, clicked_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id VARCHAR(40) NOT NULL,
        slug VARCHAR(20) NOT NULL,
        company_name VARCHAR(160) NOT NULL,
        role VARCHAR(160) NOT NULL,
        proof_type VARCHAR(20) NOT NULL,
        proof_value VARCHAR(320) NOT NULL,
        comment TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_requests_telegram_status
      ON verification_requests (telegram_id, status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_requests_status_requested_desc
      ON verification_requests (status, requested_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS directory_exclusions (
        slug VARCHAR(20) PRIMARY KEY,
        reason TEXT,
        excluded_by VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  },
};
