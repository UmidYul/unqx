module.exports = {
  id: "053_add_anime_animal_card_themes",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme') THEN
          BEGIN
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'anime_blush';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'cheetah_spots';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'serpent_scale';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme') THEN
          BEGIN
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'anime_blush';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'cheetah_spots';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'serpent_scale';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;
      END
      $$;
    `);
  },
};
