module.exports = {
  id: "003_fix_prisma_enum_names",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        -- 002_interactive_features created enum names in lowercase.
        -- Prisma expects PascalCase enum type names from schema.prisma.
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

