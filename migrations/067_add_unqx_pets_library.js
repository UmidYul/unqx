module.exports = {
  id: "067_add_unqx_pets_library",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_pets (
        id SERIAL PRIMARY KEY,
        name varchar(255) NOT NULL,
        image_url varchar(500) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS unqx_pets_active_idx
        ON unqx_pets (is_active, created_at DESC, id DESC);

      ALTER TABLE profile_cards
        ADD COLUMN IF NOT EXISTS selected_pet_id integer NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = current_schema()
            AND table_name = 'profile_cards'
            AND constraint_name = 'profile_cards_selected_pet_id_fkey'
        ) THEN
          ALTER TABLE profile_cards
            ADD CONSTRAINT profile_cards_selected_pet_id_fkey
            FOREIGN KEY (selected_pet_id)
            REFERENCES unqx_pets(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  },
};
