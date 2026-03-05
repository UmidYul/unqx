module.exports = {
  id: "012_platform_settings_and_change_log",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettingValueType') THEN
          CREATE TYPE "SettingValueType" AS ENUM ('number', 'text', 'boolean', 'json', 'textarea', 'color');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(120) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        "group" VARCHAR(60) NOT NULL,
        label VARCHAR(180) NOT NULL,
        description TEXT,
        type "SettingValueType" NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR(80)
      );

      CREATE INDEX IF NOT EXISTS platform_settings_group_idx ON platform_settings ("group");

      CREATE TABLE IF NOT EXISTS platform_setting_changes (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        setting_key VARCHAR(120) NOT NULL REFERENCES platform_settings(key) ON DELETE CASCADE,
        "group" VARCHAR(60) NOT NULL,
        old_value JSONB,
        new_value JSONB,
        changed_by VARCHAR(80),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS platform_setting_changes_setting_key_changed_at_idx
        ON platform_setting_changes (setting_key, changed_at DESC);
      CREATE INDEX IF NOT EXISTS platform_setting_changes_group_changed_at_idx
        ON platform_setting_changes ("group", changed_at DESC);

      WITH pricing AS (
        SELECT value
        FROM feature_settings
        WHERE key = 'pricing'
      )
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      SELECT x.key, x.value, 'pricing', x.label, x.type::"SettingValueType", 'migration'
      FROM (
        SELECT 'plan_basic_price'::text AS key, to_jsonb(COALESCE((pricing.value->>'planBasicPrice')::int, 50000)) AS value, 'Цена базового тарифа'::text AS label, 'number'::text AS type FROM pricing
        UNION ALL
        SELECT 'plan_premium_price', to_jsonb(COALESCE((pricing.value->>'planPremiumPrice')::int, 130000)), 'Цена премиум тарифа', 'number' FROM pricing
        UNION ALL
        SELECT 'plan_premium_upgrade_price', to_jsonb(COALESCE((pricing.value->>'premiumUpgradePrice')::int, 80000)), 'Цена апгрейда до премиум', 'number' FROM pricing
        UNION ALL
        SELECT 'pricing_footnote', to_jsonb(COALESCE(pricing.value->>'pricingFootnote', 'Тарифы оплачиваются один раз. Без подписки и скрытых платежей.')), 'Подпись под тарифами', 'textarea' FROM pricing
      ) AS x
      ON CONFLICT (key) DO NOTHING;

      WITH leaderboard AS (
        SELECT value
        FROM feature_settings
        WHERE key = 'leaderboard'
      )
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      SELECT x.key, x.value, 'platform', x.label, x.type::"SettingValueType", 'migration'
      FROM (
        SELECT 'feature_leaderboard'::text AS key, to_jsonb(COALESCE((leaderboard.value->>'enabled')::boolean, true)) AS value, 'Лидерборд включён'::text AS label, 'boolean'::text AS type FROM leaderboard
        UNION ALL
        SELECT 'leaderboard_public_count', to_jsonb(COALESCE((leaderboard.value->>'publicLimit')::int, 20)), 'Лимит публичного лидерборда', 'number' FROM leaderboard
      ) AS x
      ON CONFLICT (key) DO NOTHING;

      WITH refs AS (
        SELECT value
        FROM feature_settings
        WHERE key = 'referrals'
      )
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      SELECT x.key, x.value, 'platform', x.label, x.type::"SettingValueType", 'migration'
      FROM (
        SELECT 'feature_referrals'::text AS key, to_jsonb(COALESCE((refs.value->>'enabled')::boolean, true)) AS value, 'Рефералы включены'::text AS label, 'boolean'::text AS type FROM refs
      ) AS x
      ON CONFLICT (key) DO NOTHING;

      WITH directory AS (
        SELECT value
        FROM feature_settings
        WHERE key = 'directory'
      )
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      SELECT x.key, x.value, 'platform', x.label, x.type::"SettingValueType", 'migration'
      FROM (
        SELECT 'feature_directory'::text AS key, to_jsonb(COALESCE((directory.value->>'enabled')::boolean, true)) AS value, 'Directory включён'::text AS label, 'boolean'::text AS type FROM directory
      ) AS x
      ON CONFLICT (key) DO NOTHING;

      WITH score AS (
        SELECT value
        FROM feature_settings
        WHERE key = 'unqScore'
      )
      INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
      SELECT x.key, x.value, 'platform', x.label, x.type::"SettingValueType", 'migration'
      FROM (
        SELECT 'feature_score_public'::text AS key, to_jsonb(COALESCE((score.value->>'enabledOnCards')::boolean, true)) AS value, 'UNQ Score на карточках'::text AS label, 'boolean'::text AS type FROM score
      ) AS x
      ON CONFLICT (key) DO NOTHING;
    `);
  },
};
