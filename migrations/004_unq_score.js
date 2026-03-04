module.exports = {
  id: "004_unq_score",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS slug_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_slug VARCHAR(20) NOT NULL,
        clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        device VARCHAR(20),
        ip_hash VARCHAR(64),
        is_unique BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS slug_clicks_full_slug_clicked_at_idx ON slug_clicks (full_slug, clicked_at);
      CREATE INDEX IF NOT EXISTS slug_clicks_full_slug_ip_hash_clicked_at_idx ON slug_clicks (full_slug, ip_hash, clicked_at);
      CREATE INDEX IF NOT EXISTS slug_clicks_clicked_at_idx ON slug_clicks (clicked_at);

      CREATE TABLE IF NOT EXISTS unq_scores (
        telegram_id VARCHAR(40) PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
        score INTEGER NOT NULL DEFAULT 0,
        score_views INTEGER NOT NULL DEFAULT 0,
        score_slug_rarity INTEGER NOT NULL DEFAULT 0,
        score_tenure INTEGER NOT NULL DEFAULT 0,
        score_ctr INTEGER NOT NULL DEFAULT 0,
        score_bracelet INTEGER NOT NULL DEFAULT 0,
        score_plan INTEGER NOT NULL DEFAULT 0,
        percentile DOUBLE PRECISION NOT NULL DEFAULT 0,
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS unq_scores_score_desc_idx ON unq_scores (score DESC);
      CREATE INDEX IF NOT EXISTS unq_scores_percentile_desc_idx ON unq_scores (percentile DESC);

      CREATE TABLE IF NOT EXISTS score_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id VARCHAR(40) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS score_history_telegram_id_recorded_at_key ON score_history (telegram_id, recorded_at);
      CREATE INDEX IF NOT EXISTS score_history_recorded_at_idx ON score_history (recorded_at);
      CREATE INDEX IF NOT EXISTS score_history_telegram_id_recorded_at_idx ON score_history (telegram_id, recorded_at);

      CREATE TABLE IF NOT EXISTS score_recalculation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        processed_users INTEGER NOT NULL DEFAULT 0,
        average_ms_per_user DOUBLE PRECISION NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS score_recalculation_runs_started_at_desc_idx ON score_recalculation_runs (started_at DESC);

      INSERT INTO feature_settings (key, value)
      VALUES ('unqScore', '{"enabledOnCards": true}'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `);
  },
};

