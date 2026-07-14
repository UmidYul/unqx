module.exports = {
  id: "062_add_theme_config_public_status",
  async up(client) {
    await client.query(`
      ALTER TABLE unqx_theme_configs
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS cache_version bigint NOT NULL DEFAULT 1;

      UPDATE unqx_theme_configs
      SET status = 'active'
      WHERE status IS NULL OR btrim(status) = '';

      UPDATE unqx_theme_configs
      SET cache_version = 1
      WHERE cache_version IS NULL OR cache_version < 1;

      CREATE INDEX IF NOT EXISTS unqx_theme_configs_status_idx
        ON unqx_theme_configs (status, updated_at DESC, id DESC);
    `);
  },
};
