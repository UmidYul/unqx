module.exports = {
  id: "046_add_graffiti_color_themes_and_avatar_frame",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme') THEN
          BEGIN
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'graffiti_neon';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_red';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_orange';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_yellow';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_green';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_teal';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_blue';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_purple';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'color_pink';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme') THEN
          BEGIN
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'graffiti_neon';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_red';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_orange';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_yellow';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_green';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_teal';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_blue';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_purple';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'color_pink';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE profile_cards
        ADD COLUMN IF NOT EXISTS avatar_frame VARCHAR(40) NOT NULL DEFAULT 'none'
    `);

    await client.query(`
      UPDATE profile_cards
      SET avatar_frame = 'none'
      WHERE avatar_frame IS NULL OR btrim(avatar_frame) = ''
    `);

    await client.query(`
      ALTER TABLE profile_cards
        ALTER COLUMN avatar_frame SET DEFAULT 'none',
        ALTER COLUMN avatar_frame SET NOT NULL
    `);
  },
};
