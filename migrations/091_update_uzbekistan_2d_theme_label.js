module.exports = {
  id: "091_update_uzbekistan_2d_theme_label",
  async up(client) {
    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES ('theme', 'uzbekistan_2d', 'Узбекистан Diplomatic', true)
      ON CONFLICT (style_kind, style_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now()
    `);
  },
};
