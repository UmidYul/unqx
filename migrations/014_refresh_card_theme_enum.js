module.exports = {
  id: "014_refresh_card_theme_enum",
  async up(client) {
    await client.query(`
      DO $$
      DECLARE
        has_pascal BOOLEAN;
        has_snake BOOLEAN;
      BEGIN
        has_pascal := EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme');
        has_snake := EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme');

        IF has_pascal THEN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme_new') THEN
            EXECUTE 'CREATE TYPE "CardTheme_new" AS ENUM (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'')';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'theme'
          ) THEN
            EXECUTE 'ALTER TABLE public.cards ALTER COLUMN theme DROP DEFAULT';
            EXECUTE 'ALTER TABLE public.cards ALTER COLUMN theme TYPE "CardTheme_new" USING (CASE WHEN theme::text IN (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'') THEN theme::text::"CardTheme_new" ELSE ''default_dark''::"CardTheme_new" END)';
            EXECUTE 'ALTER TABLE public.cards ALTER COLUMN theme SET DEFAULT ''default_dark''::"CardTheme_new"';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profile_cards' AND column_name = 'theme'
          ) THEN
            EXECUTE 'ALTER TABLE public.profile_cards ALTER COLUMN theme DROP DEFAULT';
            EXECUTE 'ALTER TABLE public.profile_cards ALTER COLUMN theme TYPE "CardTheme_new" USING (CASE WHEN theme::text IN (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'') THEN theme::text::"CardTheme_new" ELSE ''default_dark''::"CardTheme_new" END)';
            EXECUTE 'ALTER TABLE public.profile_cards ALTER COLUMN theme SET DEFAULT ''default_dark''::"CardTheme_new"';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'order_requests' AND column_name = 'theme'
          ) THEN
            EXECUTE 'ALTER TABLE public.order_requests ALTER COLUMN theme DROP DEFAULT';
            EXECUTE 'ALTER TABLE public.order_requests ALTER COLUMN theme TYPE "CardTheme_new" USING (CASE WHEN theme IS NULL THEN NULL WHEN theme::text IN (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'') THEN theme::text::"CardTheme_new" ELSE ''default_dark''::"CardTheme_new" END)';
          END IF;

          EXECUTE 'DROP TYPE "CardTheme"';
          EXECUTE 'ALTER TYPE "CardTheme_new" RENAME TO "CardTheme"';
        ELSIF has_snake THEN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme_new') THEN
            EXECUTE 'CREATE TYPE cardtheme_new AS ENUM (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'')';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'theme'
          ) THEN
            EXECUTE 'ALTER TABLE public.cards ALTER COLUMN theme DROP DEFAULT';
            EXECUTE 'ALTER TABLE public.cards ALTER COLUMN theme TYPE cardtheme_new USING (CASE WHEN theme::text IN (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'') THEN theme::text::cardtheme_new ELSE ''default_dark''::cardtheme_new END)';
            EXECUTE 'ALTER TABLE public.cards ALTER COLUMN theme SET DEFAULT ''default_dark''::cardtheme_new';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profile_cards' AND column_name = 'theme'
          ) THEN
            EXECUTE 'ALTER TABLE public.profile_cards ALTER COLUMN theme DROP DEFAULT';
            EXECUTE 'ALTER TABLE public.profile_cards ALTER COLUMN theme TYPE cardtheme_new USING (CASE WHEN theme::text IN (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'') THEN theme::text::cardtheme_new ELSE ''default_dark''::cardtheme_new END)';
            EXECUTE 'ALTER TABLE public.profile_cards ALTER COLUMN theme SET DEFAULT ''default_dark''::cardtheme_new';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'order_requests' AND column_name = 'theme'
          ) THEN
            EXECUTE 'ALTER TABLE public.order_requests ALTER COLUMN theme DROP DEFAULT';
            EXECUTE 'ALTER TABLE public.order_requests ALTER COLUMN theme TYPE cardtheme_new USING (CASE WHEN theme IS NULL THEN NULL WHEN theme::text IN (''default_dark'', ''arctic'', ''linen'', ''marble'', ''forest'') THEN theme::text::cardtheme_new ELSE ''default_dark''::cardtheme_new END)';
          END IF;

          EXECUTE 'DROP TYPE cardtheme';
          EXECUTE 'ALTER TYPE cardtheme_new RENAME TO cardtheme';
        END IF;
      END $$;
    `);
  },
};
