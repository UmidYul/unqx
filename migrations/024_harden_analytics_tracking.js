module.exports = {
  id: "024_harden_analytics_tracking",
  async up(client) {
    await client.query(`
      ALTER TABLE analytics_views
      ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_views_slug_fingerprint_visited_at
      ON analytics_views (slug, fingerprint, visited_at);
    `);

    await client.query(`
      ALTER TABLE analytics_clicks
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(80);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_clicks_slug_button_session_clicked_at
      ON analytics_clicks (slug, button_type, session_id, clicked_at);
    `);
  },
};
