module.exports = {
  id: "001_init",
  async up(client) {
    await client.query(`
      CREATE OR REPLACE FUNCTION app_uuid_v4()
      RETURNS UUID
      LANGUAGE plpgsql
      AS $$
      DECLARE
        hex TEXT;
      BEGIN
        -- Extension-free UUID v4-style generator for managed Postgres hosts.
        hex := md5(random()::text || clock_timestamp()::text || txid_current()::text);
        RETURN (
          substr(hex, 1, 8) || '-' ||
          substr(hex, 9, 4) || '-' ||
          '4' || substr(hex, 14, 3) || '-' ||
          substr('89ab', 1 + floor(random() * 4)::int, 1) || substr(hex, 18, 3) || '-' ||
          substr(hex, 21, 12)
        )::uuid;
      END;
      $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tariff') THEN
          CREATE TYPE tariff AS ENUM ('basic', 'premium');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtheme') THEN
          CREATE TYPE cardtheme AS ENUM ('default_dark', 'light_minimal', 'gradient', 'neon', 'corporate');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orderstatus') THEN
          CREATE TYPE orderstatus AS ENUM ('NEW', 'CONTACTED', 'PAID', 'ACTIVATED', 'REJECTED');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugstate') THEN
          CREATE TYPE slugstate AS ENUM ('TAKEN', 'BLOCKED');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkerresult') THEN
          CREATE TYPE checkerresult AS ENUM ('AVAILABLE', 'TAKEN', 'BLOCKED', 'INVALID');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'braceletdeliverystatus') THEN
          CREATE TYPE braceletdeliverystatus AS ENUM ('ORDERED', 'SHIPPED', 'DELIVERED');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userplan') THEN
          CREATE TYPE userplan AS ENUM ('basic', 'premium');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userstatus') THEN
          CREATE TYPE userstatus AS ENUM ('active', 'blocked', 'deactivated');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugstatus') THEN
          CREATE TYPE slugstatus AS ENUM ('free', 'pending', 'approved', 'active', 'paused', 'private', 'blocked');
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slugrequeststatus') THEN
          CREATE TYPE slugrequeststatus AS ENUM ('new', 'contacted', 'paid', 'approved', 'rejected', 'expired');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        slug VARCHAR(20) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        tariff tariff NOT NULL DEFAULT 'basic',
        theme cardtheme NOT NULL DEFAULT 'default_dark',
        avatar_url TEXT,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        hashtag VARCHAR(50),
        address TEXT,
        postcode VARCHAR(20),
        email VARCHAR(100),
        extra_phone VARCHAR(30),
        views_count INTEGER NOT NULL DEFAULT 0,
        unique_views_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS cards_is_active_idx ON cards (is_active);
      CREATE INDEX IF NOT EXISTS cards_created_at_idx ON cards (created_at);

      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        label VARCHAR(50) NOT NULL,
        url TEXT,
        sort_order INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS tags_card_id_sort_order_idx ON tags (card_id, sort_order);

      CREATE TABLE IF NOT EXISTS buttons (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        label VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE INDEX IF NOT EXISTS buttons_card_id_sort_order_idx ON buttons (card_id, sort_order);

      CREATE TABLE IF NOT EXISTS views_log (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        device VARCHAR(20),
        ip_hash VARCHAR(64),
        is_unique BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE INDEX IF NOT EXISTS views_log_card_id_viewed_at_idx ON views_log (card_id, viewed_at);
      CREATE INDEX IF NOT EXISTS views_log_card_id_ip_hash_viewed_at_idx ON views_log (card_id, ip_hash, viewed_at);
      CREATE INDEX IF NOT EXISTS views_log_viewed_at_idx ON views_log (viewed_at);

      CREATE TABLE IF NOT EXISTS error_logs (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        type VARCHAR(30) NOT NULL,
        path TEXT NOT NULL,
        message TEXT,
        user_agent TEXT,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS error_logs_type_occurred_at_idx ON error_logs (type, occurred_at);
      CREATE INDEX IF NOT EXISTS error_logs_occurred_at_idx ON error_logs (occurred_at);

      CREATE TABLE IF NOT EXISTS order_requests (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(20) NOT NULL,
        slug_price INTEGER NOT NULL,
        tariff tariff NOT NULL,
        theme cardtheme,
        bracelet BOOLEAN NOT NULL DEFAULT FALSE,
        contact VARCHAR(120) NOT NULL,
        status orderstatus NOT NULL DEFAULT 'NEW',
        card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS order_requests_slug_created_at_idx ON order_requests (slug, created_at);
      CREATE INDEX IF NOT EXISTS order_requests_status_created_at_idx ON order_requests (status, created_at);
      CREATE INDEX IF NOT EXISTS order_requests_card_id_idx ON order_requests (card_id);

      CREATE TABLE IF NOT EXISTS bracelet_orders (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        order_id UUID NOT NULL UNIQUE REFERENCES order_requests(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(20) NOT NULL,
        contact VARCHAR(120) NOT NULL,
        delivery_status braceletdeliverystatus NOT NULL DEFAULT 'ORDERED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS bracelet_orders_delivery_status_created_at_idx ON bracelet_orders (delivery_status, created_at);

      CREATE TABLE IF NOT EXISTS slug_records (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        slug VARCHAR(20) NOT NULL UNIQUE,
        state slugstate NOT NULL DEFAULT 'TAKEN',
        owner_name VARCHAR(100),
        price_override INTEGER,
        activation_date TIMESTAMPTZ,
        card_id UUID UNIQUE REFERENCES cards(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS slug_records_state_idx ON slug_records (state);
      CREATE INDEX IF NOT EXISTS slug_records_activation_date_idx ON slug_records (activation_date);

      CREATE TABLE IF NOT EXISTS slug_checker_logs (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        slug VARCHAR(20),
        pattern VARCHAR(20) NOT NULL,
        source VARCHAR(20) NOT NULL,
        result checkerresult NOT NULL,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS slug_checker_logs_checked_at_idx ON slug_checker_logs (checked_at);
      CREATE INDEX IF NOT EXISTS slug_checker_logs_pattern_checked_at_idx ON slug_checker_logs (pattern, checked_at);
      CREATE INDEX IF NOT EXISTS slug_checker_logs_source_checked_at_idx ON slug_checker_logs (source, checked_at);

      CREATE TABLE IF NOT EXISTS testimonials (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(20) NOT NULL,
        tariff tariff NOT NULL,
        text TEXT NOT NULL,
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS testimonials_is_visible_sort_order_idx ON testimonials (is_visible, sort_order);

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        telegram_id VARCHAR(40) NOT NULL UNIQUE,
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120),
        username VARCHAR(120),
        photo_url TEXT,
        display_name VARCHAR(120),
        plan userplan NOT NULL DEFAULT 'basic',
        plan_expires_at TIMESTAMPTZ,
        notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        status userstatus NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS users_plan_plan_expires_at_idx ON users (plan, plan_expires_at);
      CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

      CREATE TABLE IF NOT EXISTS slugs (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        letters VARCHAR(3) NOT NULL,
        digits VARCHAR(3) NOT NULL,
        full_slug VARCHAR(20) NOT NULL UNIQUE,
        owner_telegram_id VARCHAR(40) REFERENCES users(telegram_id) ON DELETE SET NULL,
        status slugstatus NOT NULL DEFAULT 'free',
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        price INTEGER,
        pause_message VARCHAR(220),
        requested_at TIMESTAMPTZ,
        pending_expires_at TIMESTAMPTZ,
        approved_at TIMESTAMPTZ,
        activated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS slugs_owner_telegram_id_status_idx ON slugs (owner_telegram_id, status);
      CREATE INDEX IF NOT EXISTS slugs_status_updated_at_idx ON slugs (status, updated_at);

      CREATE TABLE IF NOT EXISTS slug_waitlist (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        full_slug VARCHAR(20) NOT NULL,
        telegram_id VARCHAR(40),
        ip_hash VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS slug_waitlist_full_slug_created_at_idx ON slug_waitlist (full_slug, created_at);
      CREATE INDEX IF NOT EXISTS slug_waitlist_telegram_id_created_at_idx ON slug_waitlist (telegram_id, created_at);

      CREATE TABLE IF NOT EXISTS profile_cards (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        owner_telegram_id VARCHAR(40) NOT NULL UNIQUE REFERENCES users(telegram_id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        role VARCHAR(120),
        bio VARCHAR(120),
        avatar_url TEXT,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
        theme cardtheme NOT NULL DEFAULT 'default_dark',
        custom_color VARCHAR(20),
        show_branding BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS slug_requests (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        telegram_id VARCHAR(40) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
        slug VARCHAR(20) NOT NULL,
        slug_price INTEGER NOT NULL,
        requested_plan userplan NOT NULL,
        bracelet BOOLEAN NOT NULL DEFAULT FALSE,
        contact VARCHAR(140) NOT NULL,
        status slugrequeststatus NOT NULL DEFAULT 'new',
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS slug_requests_telegram_id_created_at_idx ON slug_requests (telegram_id, created_at);
      CREATE INDEX IF NOT EXISTS slug_requests_status_created_at_idx ON slug_requests (status, created_at);
      CREATE INDEX IF NOT EXISTS slug_requests_slug_idx ON slug_requests (slug);

      CREATE TABLE IF NOT EXISTS slug_views (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        full_slug VARCHAR(20) NOT NULL,
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        device VARCHAR(20),
        ip_hash VARCHAR(64),
        is_unique BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE INDEX IF NOT EXISTS slug_views_full_slug_viewed_at_idx ON slug_views (full_slug, viewed_at);
      CREATE INDEX IF NOT EXISTS slug_views_full_slug_ip_hash_viewed_at_idx ON slug_views (full_slug, ip_hash, viewed_at);
    `);
  },
};
