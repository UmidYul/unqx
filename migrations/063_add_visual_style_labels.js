module.exports = {
  id: "063_add_visual_style_labels",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_visual_style_labels (
        id SERIAL PRIMARY KEY,
        style_kind varchar(24) NOT NULL,
        style_key varchar(120) NOT NULL,
        display_name varchar(160) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (style_kind, style_key)
      );

      CREATE INDEX IF NOT EXISTS unqx_visual_style_labels_kind_idx
        ON unqx_visual_style_labels (style_kind, style_key);
    `);
  },
};
