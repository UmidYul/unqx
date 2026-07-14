module.exports = {
  id: "061_add_theme_creator_configs",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_theme_configs (
        id SERIAL PRIMARY KEY,
        theme_key varchar(80) NOT NULL UNIQUE,
        title varchar(160) NOT NULL,
        card_bg_overlay varchar(120) NOT NULL DEFAULT 'none',
        config_json jsonb NOT NULL,
        overlay_svg text NULL,
        primary_icon_svg text NULL,
        secondary_icon_svg text NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        cache_version bigint NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS unqx_theme_configs_created_at_idx
        ON unqx_theme_configs (created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS unqx_theme_configs_status_idx
        ON unqx_theme_configs (status, updated_at DESC, id DESC);
    `);
  },
};
