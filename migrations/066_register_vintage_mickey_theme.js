module.exports = {
  id: "066_register_vintage_mickey_theme",
  async up(client) {
    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES ('theme', 'vintage_mickey', 'Ретро Микки 🐭', true)
      ON CONFLICT (style_kind, style_key)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now();
    `);
  },
};
