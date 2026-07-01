module.exports = {
  id: "054_add_galaxy_card_theme",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme') THEN
          BEGIN
            ALTER TYPE "CardTheme" ADD VALUE IF NOT EXISTS 'galaxy';
          EXCEPTION
            WHEN duplicate_object THEN
              -- noop
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme') THEN
          BEGIN
            ALTER TYPE cardtheme ADD VALUE IF NOT EXISTS 'galaxy';
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
