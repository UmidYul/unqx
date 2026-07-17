module.exports = {
  id: "080_register_art_shape_avatar_frames",
  async up(client) {
    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES
        ('frame', 'zen_organic', 'Дзен-Овал', true),
        ('frame', 'temple_arch', 'Арка Пагоды', true),
        ('frame', 'hex_portal', 'Портальный Гексагон', true),
        ('frame', 'leaf_scroll', 'Двойной Свиток Конохи', true),
        ('frame', 'gogh_wave', 'Кипарисовый Изгиб', true),
        ('frame', 'diamond_shield', 'Кристалл Пустоты', true),
        ('frame', 'symbiote_morph', 'Жидкий Симбиот', true),
        ('frame', 'crescent_contour', 'Лунный Серп', true),
        ('frame', 'taiji_curves', 'Древняя Инь-Янь', true),
        ('frame', 'tech_segmented', 'Глитч-Барьер', true)
      ON CONFLICT (style_kind, style_key)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now();
    `);
  },
};
