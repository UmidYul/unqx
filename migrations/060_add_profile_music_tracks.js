module.exports = {
  id: "060_add_profile_music_tracks",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_tracks (
        id SERIAL PRIMARY KEY,
        title varchar(255) NOT NULL,
        audio_url varchar(500) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS unqx_tracks_created_at_idx
        ON unqx_tracks (created_at DESC, id DESC);

      ALTER TABLE profile_cards
        ADD COLUMN IF NOT EXISTS selected_track_id integer NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = current_schema()
            AND table_name = 'profile_cards'
            AND constraint_name = 'profile_cards_selected_track_id_fkey'
        ) THEN
          ALTER TABLE profile_cards
            ADD CONSTRAINT profile_cards_selected_track_id_fkey
            FOREIGN KEY (selected_track_id)
            REFERENCES unqx_tracks(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  },
};
