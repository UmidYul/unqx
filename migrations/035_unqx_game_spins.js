module.exports = {
  id: "035_unqx_game_spins",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_game_spins (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug VARCHAR(20) NOT NULL,
        price INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS unqx_game_spins_created_at_idx
        ON unqx_game_spins (created_at DESC);

      CREATE INDEX IF NOT EXISTS unqx_game_spins_user_id_created_at_idx
        ON unqx_game_spins (user_id, created_at DESC);
    `);
  },
};
