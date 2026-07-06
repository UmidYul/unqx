module.exports = {
  id: "059_add_event_card_releases",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_event_card_releases (
        id varchar(64) PRIMARY KEY,
        title varchar(220) NOT NULL,
        description text NOT NULL DEFAULT '',
        image_front_url varchar(500) NOT NULL,
        image_back_url varchar(500) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS unqx_event_card_releases_created_at_idx
        ON unqx_event_card_releases (created_at DESC);
    `);
  },
};
