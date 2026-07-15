module.exports = {
  id: "068_extend_unqx_pets_store",
  async up(client) {
    await client.query(`
      ALTER TABLE unqx_pets
        ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS event_name varchar(255) NULL;

      UPDATE unqx_pets
      SET price = 0
      WHERE price IS NULL;

      CREATE TABLE IF NOT EXISTS unqx_user_pets (
        id SERIAL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pet_id integer NOT NULL REFERENCES unqx_pets(id) ON DELETE CASCADE,
        purchased_at timestamp NOT NULL DEFAULT now(),
        UNIQUE(user_id, pet_id)
      );

      CREATE INDEX IF NOT EXISTS unqx_user_pets_user_idx
        ON unqx_user_pets (user_id, purchased_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS unqx_user_pets_pet_idx
        ON unqx_user_pets (pet_id);

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = current_schema()
            AND table_name = 'profile_cards'
            AND constraint_name = 'profile_cards_selected_pet_id_fkey'
        ) THEN
          ALTER TABLE profile_cards
            DROP CONSTRAINT profile_cards_selected_pet_id_fkey;
        END IF;

        ALTER TABLE profile_cards
          ADD CONSTRAINT profile_cards_selected_pet_id_fkey
          FOREIGN KEY (selected_pet_id)
          REFERENCES unqx_pets(id)
          ON DELETE SET NULL;
      END $$;
    `);
  },
};
