module.exports = {
  id: "081_remove_today_frames_add_dragon_orbit",
  async up(client) {
    await client.query(`
      DELETE FROM unqx_visual_style_labels
      WHERE style_kind = 'frame'
        AND style_key = ANY($1::text[]);
    `, [[
      "symbiote",
      "lightning",
      "zen_bamboo",
      "sakura_aura",
      "gogh_strokes",
      "lunar_gold",
      "chakra",
      "konoha_scroll",
      "mystery_journal",
      "cipher_glitch",
      "crystal_anomal",
      "venom_organic",
      "sensei_scroll",
      "konoha_arc",
      "lunar_crescent",
      "gogh_waves",
      "cyber_tech",
      "sakura_petal",
      "portal_dome",
      "ancient_totem",
      "zen_organic",
      "temple_arch",
      "hex_portal",
      "leaf_scroll",
      "gogh_wave",
      "diamond_shield",
      "symbiote_morph",
      "crescent_contour",
      "taiji_curves",
      "tech_segmented",
    ]]);

    await client.query(`
      INSERT INTO unqx_visual_style_labels (style_kind, style_key, display_name, is_active)
      VALUES ('frame', 'dragon_orbit', 'Круглый Дракон', true)
      ON CONFLICT (style_kind, style_key)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = now();
    `);
  },
};
