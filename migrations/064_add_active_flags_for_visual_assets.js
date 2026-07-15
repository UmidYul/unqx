module.exports = {
  id: "064_add_active_flags_for_visual_assets",
  async up(client) {
    await client.query(`
      ALTER TABLE unqx_tracks
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

      ALTER TABLE unqx_theme_configs
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

      ALTER TABLE unqx_visual_style_labels
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

      CREATE INDEX IF NOT EXISTS unqx_tracks_active_idx
        ON unqx_tracks (is_active, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS unqx_theme_configs_active_idx
        ON unqx_theme_configs (is_active, updated_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS unqx_visual_style_labels_active_idx
        ON unqx_visual_style_labels (style_kind, is_active, style_key);
    `);
  },
};
