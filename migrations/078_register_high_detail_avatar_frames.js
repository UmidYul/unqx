module.exports = {
  id: "078_register_high_detail_avatar_frames",
  async up(client) {
    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES
        ('frame', 'symbiote', 'Живой Симбиот', true),
        ('frame', 'lightning', 'Искрящаяся Молния', true),
        ('frame', 'zen_bamboo', 'Дзен-Бамбук', true),
        ('frame', 'sakura_aura', 'Лепесток Сакуры', true),
        ('frame', 'gogh_strokes', 'Мазки Импрессиониста', true),
        ('frame', 'lunar_gold', 'Золотая Корона Луны', true),
        ('frame', 'chakra', 'Кольцо Чакры', true),
        ('frame', 'konoha_scroll', 'Печать Конохи', true),
        ('frame', 'mystery_journal', 'Дневник Аномалий', true),
        ('frame', 'cipher_glitch', 'Билл Шифр Глитч', true)
      ON CONFLICT (style_kind, style_key)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now();
    `);
  },
};
