module.exports = {
  id: "005_normalize_enum_type_names",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tariff')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Tariff') THEN
          EXECUTE 'ALTER TYPE tariff RENAME TO "Tariff"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardTheme') THEN
          EXECUTE 'ALTER TYPE cardtheme RENAME TO "CardTheme"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orderstatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
          EXECUTE 'ALTER TYPE orderstatus RENAME TO "OrderStatus"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugstate')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlugState') THEN
          EXECUTE 'ALTER TYPE slugstate RENAME TO "SlugState"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkerresult')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CheckerResult') THEN
          EXECUTE 'ALTER TYPE checkerresult RENAME TO "CheckerResult"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'braceletdeliverystatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BraceletDeliveryStatus') THEN
          EXECUTE 'ALTER TYPE braceletdeliverystatus RENAME TO "BraceletDeliveryStatus"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userplan')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserPlan') THEN
          EXECUTE 'ALTER TYPE userplan RENAME TO "UserPlan"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userstatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
          EXECUTE 'ALTER TYPE userstatus RENAME TO "UserStatus"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugstatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlugStatus') THEN
          EXECUTE 'ALTER TYPE slugstatus RENAME TO "SlugStatus"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugrequeststatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SlugRequestStatus') THEN
          EXECUTE 'ALTER TYPE slugrequeststatus RENAME TO "SlugRequestStatus"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referralstatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralStatus') THEN
          EXECUTE 'ALTER TYPE referralstatus RENAME TO "ReferralStatus"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referralrewardtype')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralRewardType') THEN
          EXECUTE 'ALTER TYPE referralrewardtype RENAME TO "ReferralRewardType"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flashsaleconditiontype')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FlashSaleConditionType') THEN
          EXECUTE 'ALTER TYPE flashsaleconditiontype RENAME TO "FlashSaleConditionType"';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dropslugpatterntype')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DropSlugPatternType') THEN
          EXECUTE 'ALTER TYPE dropslugpatterntype RENAME TO "DropSlugPatternType"';
        END IF;
      END $$;
    `);
  },
};
