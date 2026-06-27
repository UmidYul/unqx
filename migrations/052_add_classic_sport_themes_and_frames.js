module.exports = {
  id: "052_add_classic_sport_themes_and_frames",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme') THEN
          BEGIN
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'heritage_crest';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'ivory_tennis';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'grand_slam_clay';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'racing_green';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'polo_navy';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'alpine_ski';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'boxing_legend';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'basketball_court';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'football_pitch';
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'olympic_gold';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme') THEN
          BEGIN
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'heritage_crest';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'ivory_tennis';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'grand_slam_clay';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'racing_green';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'polo_navy';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'alpine_ski';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'boxing_legend';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'basketball_court';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'football_pitch';
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'olympic_gold';
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
