module.exports = {
  id: "069_update_pets_fields",
  async up(client) {
    await client.query(`
      ALTER TABLE unqx_pets
        ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS event_name varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

      UPDATE unqx_pets
      SET price = 0
      WHERE price IS NULL;

      UPDATE unqx_pets
      SET is_active = true
      WHERE is_active IS NULL;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'profile_cards'
            AND column_name = 'selected_pet_id'
        ) THEN
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
        END IF;
      END $$;
    `);
  },
};
