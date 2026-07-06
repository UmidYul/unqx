module.exports = {
  id: "056_add_slug_sale_fields",
  async up(client) {
    await client.query(`
      ALTER TABLE slugs
        ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS sale_price bigint;

      UPDATE slugs
      SET sale_price = NULL
      WHERE on_sale = false;

      CREATE INDEX IF NOT EXISTS slugs_on_sale_idx ON slugs (on_sale, sale_price);
    `);
  },
};
