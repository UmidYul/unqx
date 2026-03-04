module.exports = {
  id: "006_profile_card_contacts",
  async up(client) {
    await client.query(`
      ALTER TABLE profile_cards
      ADD COLUMN IF NOT EXISTS hashtag VARCHAR(50),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS postcode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS email VARCHAR(100),
      ADD COLUMN IF NOT EXISTS extra_phone VARCHAR(30);
    `);
  },
};
