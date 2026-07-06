module.exports = {
  id: "058_add_advertisement_placement",
  async up(client) {
    await client.query(`
      ALTER TABLE unqx_advertisements
        ADD COLUMN IF NOT EXISTS placement varchar(32) NOT NULL DEFAULT 'footer_partner';

      UPDATE unqx_advertisements
      SET placement = 'footer_partner'
      WHERE placement IS NULL OR placement = '';

      CREATE INDEX IF NOT EXISTS unqx_advertisements_placement_position_idx
        ON unqx_advertisements (placement ASC, position_index ASC, id ASC);
    `);
  },
};
