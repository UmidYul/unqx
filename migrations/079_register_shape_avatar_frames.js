module.exports = {
  id: "079_register_shape_avatar_frames",
  async up(client) {
    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES
        ('frame', 'crystal_anomal', 'Аномальный Кристалл', true),
        ('frame', 'venom_organic', 'Органика Венома', true),
        ('frame', 'sensei_scroll', 'Свиток Сенсея', true),
        ('frame', 'konoha_arc', 'Коноха Арк', true),
        ('frame', 'lunar_crescent', 'Лунный Полумесяц', true),
        ('frame', 'gogh_waves', 'Импрессионист', true),
        ('frame', 'cyber_tech', 'Кибер-Неон', true),
        ('frame', 'sakura_petal', 'Нежная Сакура', true),
        ('frame', 'portal_dome', 'Портальный Околыш', true),
        ('frame', 'ancient_totem', 'Древний Тотем', true)
      ON CONFLICT (style_kind, style_key)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now();
    `);
  },
};
