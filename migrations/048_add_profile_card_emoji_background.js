module.exports = {
  id: "048_add_profile_card_emoji_background",
  async up(client) {
    await client.query(`
      ALTER TABLE profile_cards
        ADD COLUMN IF NOT EXISTS emoji_background_pack VARCHAR(40) NOT NULL DEFAULT 'none'
    `);

    await client.query(`
      UPDATE profile_cards
      SET emoji_background_pack = 'none'
      WHERE emoji_background_pack IS NULL OR btrim(emoji_background_pack) = ''
    `);

    await client.query(`
      ALTER TABLE profile_cards
        ALTER COLUMN emoji_background_pack SET DEFAULT 'none',
        ALTER COLUMN emoji_background_pack SET NOT NULL
    `);
  },
};
