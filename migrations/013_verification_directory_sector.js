module.exports = {
  id: "013_verification_directory_sector",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS directory_sector VARCHAR(20);
    `);

    await client.query(`
      ALTER TABLE verification_requests
      ADD COLUMN IF NOT EXISTS sector VARCHAR(20) NOT NULL DEFAULT 'other';
    `);

    await client.query(`
      UPDATE users
      SET directory_sector = NULL
      WHERE directory_sector IS NOT NULL AND directory_sector NOT IN ('design', 'sales', 'marketing', 'it', 'other');
    `);

    await client.query(`
      UPDATE verification_requests
      SET sector = 'other'
      WHERE sector IS NULL OR sector NOT IN ('design', 'sales', 'marketing', 'it', 'other');
    `);
  },
};
