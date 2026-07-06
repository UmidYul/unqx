module.exports = {
  id: "057_add_unqx_advertisements",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_advertisements (
        id SERIAL PRIMARY KEY,
        image_url varchar(500) NOT NULL,
        target_url varchar(500) NOT NULL,
        position_index integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS unqx_advertisements_position_idx
        ON unqx_advertisements (position_index ASC, id ASC);
    `);
  },
};
