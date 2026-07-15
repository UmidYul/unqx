module.exports = {
  id: "070_unify_pets_library",
  async up(client) {
    await client.query(`
      ALTER TABLE unqx_pets
        ADD COLUMN IF NOT EXISTS description text NULL,
        ADD COLUMN IF NOT EXISTS legacy_type varchar(40) NULL;

      ALTER TABLE unqx_user_pets
        ADD COLUMN IF NOT EXISTS display_name varchar(120) NULL,
        ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT false;

      INSERT INTO unqx_pets (name, image_url, description, price, event_name, is_active, legacy_type)
      SELECT *
      FROM (
        VALUES
          ('Коала', '/assets/pets/pet1.png', 'Спокойный декоративный друг для визитки', 2000000, NULL::varchar, true, 'kitten'),
          ('Котик', '/assets/pets/pet2.png', 'Игривый компаньон рядом с профилем', 5000000, NULL::varchar, true, 'puppy'),
          ('Леопард', '/assets/pets/pet3.png', 'Яркий акцент для профиля', 7000000, NULL::varchar, true, 'snake')
      ) AS seed(name, image_url, description, price, event_name, is_active, legacy_type)
      WHERE NOT EXISTS (
        SELECT 1
        FROM unqx_pets p
        WHERE p.legacy_type = seed.legacy_type
           OR p.image_url = seed.image_url
      );

      INSERT INTO unqx_user_pets (user_id, pet_id, display_name, is_visible, purchased_at)
      SELECT
        pcp.user_id,
        lib.id,
        pcp.display_name,
        COALESCE(pcp.is_visible, false),
        COALESCE(pcp.created_at, now())
      FROM profile_card_pets pcp
      JOIN unqx_pets lib
        ON lib.legacy_type = pcp.pet_type::text
      ON CONFLICT (user_id, pet_id) DO UPDATE
        SET display_name = COALESCE(EXCLUDED.display_name, unqx_user_pets.display_name),
            is_visible = EXCLUDED.is_visible;

      UPDATE profile_cards pc
      SET selected_pet_id = visible.pet_id
      FROM (
        SELECT DISTINCT ON (up.user_id)
          up.user_id,
          up.pet_id
        FROM unqx_user_pets up
        WHERE up.is_visible = true
        ORDER BY up.user_id, up.purchased_at DESC, up.id DESC
      ) visible
      WHERE pc.owner_id = visible.user_id
        AND pc.selected_pet_id IS NULL;
    `);
  },
};
