module.exports = {
  id: "002_interactive_features",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referralstatus') THEN
          CREATE TYPE referralstatus AS ENUM ('registered', 'paid', 'rewarded');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referralrewardtype') THEN
          CREATE TYPE referralrewardtype AS ENUM ('discount', 'free_month', 'bonus_slug');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flashsaleconditiontype') THEN
          CREATE TYPE flashsaleconditiontype AS ENUM ('all', 'pattern_000', 'pattern_aaa', 'sequential_digits', 'custom');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dropslugpatterntype') THEN
          CREATE TYPE dropslugpatterntype AS ENUM ('random', 'sequential', 'themed', 'manual');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugstatus') THEN
          ALTER TYPE slugstatus ADD VALUE IF NOT EXISTS 'reserved_drop';
        END IF;
      END $$;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code VARCHAR(40);
      CREATE UNIQUE INDEX IF NOT EXISTS users_ref_code_key ON users (ref_code) WHERE ref_code IS NOT NULL;

      CREATE TABLE IF NOT EXISTS referral_reward_rules (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        required_paid_friends INTEGER NOT NULL,
        reward_type referralrewardtype NOT NULL,
        reward_value INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS referral_reward_rules_required_paid_friends_key
        ON referral_reward_rules (required_paid_friends);

      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        referrer_telegram_id VARCHAR(40) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
        referred_telegram_id VARCHAR(40) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
        ref_code VARCHAR(40) NOT NULL,
        status referralstatus NOT NULL DEFAULT 'registered',
        reward_type referralrewardtype,
        rewarded_rule_id UUID REFERENCES referral_reward_rules(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        rewarded_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_telegram_id_key ON referrals (referred_telegram_id);
      CREATE INDEX IF NOT EXISTS referrals_referrer_telegram_id_status_idx ON referrals (referrer_telegram_id, status);
      CREATE INDEX IF NOT EXISTS referrals_created_at_idx ON referrals (created_at);

      CREATE TABLE IF NOT EXISTS feature_settings (
        key VARCHAR(80) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS flash_sales (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        title VARCHAR(180) NOT NULL,
        description TEXT,
        discount_percent INTEGER NOT NULL,
        condition_type flashsaleconditiontype NOT NULL,
        condition_value JSONB,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        notify_telegram BOOLEAN NOT NULL DEFAULT FALSE,
        telegram_target VARCHAR(120),
        created_by_admin VARCHAR(80),
        started_notification_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS flash_sales_active_window_idx ON flash_sales (is_active, starts_at, ends_at);

      CREATE TABLE IF NOT EXISTS drops (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        title VARCHAR(180) NOT NULL,
        description TEXT,
        drop_at TIMESTAMPTZ NOT NULL,
        slug_count INTEGER NOT NULL,
        slug_pattern_type dropslugpatterntype NOT NULL,
        slugs_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
        sold_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_announced BOOLEAN NOT NULL DEFAULT FALSE,
        is_live BOOLEAN NOT NULL DEFAULT FALSE,
        is_sold_out BOOLEAN NOT NULL DEFAULT FALSE,
        is_finished BOOLEAN NOT NULL DEFAULT FALSE,
        notify_telegram BOOLEAN NOT NULL DEFAULT FALSE,
        telegram_target VARCHAR(120),
        notified_15m_at TIMESTAMPTZ,
        notified_start_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS drops_drop_at_idx ON drops (drop_at);
      CREATE INDEX IF NOT EXISTS drops_is_live_idx ON drops (is_live, is_finished, is_sold_out);

      CREATE TABLE IF NOT EXISTS drop_waitlist (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
        telegram_id VARCHAR(40) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        notified_at TIMESTAMPTZ,
        notified_15m_at TIMESTAMPTZ,
        notified_start_at TIMESTAMPTZ,
        UNIQUE (drop_id, telegram_id)
      );
      CREATE INDEX IF NOT EXISTS drop_waitlist_drop_id_joined_at_idx ON drop_waitlist (drop_id, joined_at);

      CREATE TABLE IF NOT EXISTS leaderboard_exclusions (
        full_slug VARCHAR(20) PRIMARY KEY,
        reason TEXT,
        excluded_by VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS leaderboard_suspicious_log (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        full_slug VARCHAR(20) NOT NULL,
        views_count INTEGER NOT NULL,
        window_minutes INTEGER NOT NULL,
        threshold INTEGER NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS leaderboard_suspicious_log_slug_occurred_at_idx ON leaderboard_suspicious_log (full_slug, occurred_at);

      ALTER TABLE slug_requests
        ADD COLUMN IF NOT EXISTS drop_id UUID REFERENCES drops(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS flash_sale_id UUID REFERENCES flash_sales(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS flash_discount_amount INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX IF NOT EXISTS slug_requests_drop_id_created_at_idx ON slug_requests (drop_id, created_at);
      CREATE INDEX IF NOT EXISTS slug_requests_flash_sale_id_created_at_idx ON slug_requests (flash_sale_id, created_at);

      CREATE INDEX IF NOT EXISTS slug_views_viewed_at_idx ON slug_views (viewed_at);
      CREATE INDEX IF NOT EXISTS slug_views_unique_viewed_at_idx ON slug_views (is_unique, viewed_at);

      INSERT INTO feature_settings(key, value)
      VALUES
        ('leaderboard', '{"enabled": true, "publicLimit": 20, "suspiciousThreshold": 50, "suspiciousWindowMinutes": 10}'::jsonb),
        ('referrals', '{"enabled": true, "requirePaid": true}'::jsonb)
      ON CONFLICT (key) DO NOTHING;

      INSERT INTO referral_reward_rules(required_paid_friends, reward_type, reward_value, is_active)
      VALUES
        (1, 'discount', 20, TRUE),
        (3, 'free_month', 1, TRUE),
        (5, 'bonus_slug', 1, TRUE)
      ON CONFLICT (required_paid_friends) DO NOTHING;
    `);
  },
};
