module.exports = {
  id: "102_register_maftun_theme",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme') THEN
          ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'maftun';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme') THEN
          ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'maftun';
        END IF;
      END $$;
    `);

    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES ('theme', 'maftun', 'maftūn', true)
      ON CONFLICT (style_kind, style_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now()
    `);
  },
};
