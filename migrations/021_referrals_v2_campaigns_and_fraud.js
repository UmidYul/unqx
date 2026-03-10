module.exports = {
  id: "021_referrals_v2_campaigns_and_fraud",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralCampaignType') THEN
          CREATE TYPE "ReferralCampaignType" AS ENUM ('source_offer', 'promo_code');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralCampaignStatus') THEN
          CREATE TYPE "ReferralCampaignStatus" AS ENUM ('draft', 'active', 'paused', 'archived');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralFraudVerdict') THEN
          CREATE TYPE "ReferralFraudVerdict" AS ENUM ('allow', 'block', 'review');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_campaigns (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        name VARCHAR(180) NOT NULL,
        type "ReferralCampaignType" NOT NULL,
        status "ReferralCampaignStatus" NOT NULL DEFAULT 'draft',
        source VARCHAR(40),
        offer VARCHAR(80),
        promo_code VARCHAR(32),
        reward_amount_override INTEGER,
        invitee_discount_override INTEGER,
        discount_cap_percent_override DOUBLE PRECISION,
        priority INTEGER NOT NULL DEFAULT 0,
        budget_amount INTEGER NOT NULL DEFAULT 0,
        per_user_cap INTEGER NOT NULL DEFAULT 1,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        created_by VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_campaign_usage (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        campaign_id UUID NOT NULL REFERENCES referral_campaigns(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID REFERENCES slug_requests(id) ON DELETE SET NULL,
        purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'reserved',
        amount_spent INTEGER NOT NULL DEFAULT 0,
        idempotency_key VARCHAR(120) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finalized_at TIMESTAMPTZ,
        released_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_fraud_checks (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        order_id UUID REFERENCES slug_requests(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip_hash VARCHAR(64),
        device_hash VARCHAR(64),
        velocity_ip_count INTEGER NOT NULL DEFAULT 0,
        velocity_device_count INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        verdict "ReferralFraudVerdict" NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE slug_requests
      ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES referral_campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS promo_code VARCHAR(32),
      ADD COLUMN IF NOT EXISTS fraud_verdict "ReferralFraudVerdict",
      ADD COLUMN IF NOT EXISTS fraud_reason TEXT,
      ADD COLUMN IF NOT EXISTS campaign_snapshot JSONB;
    `);

    await client.query(`
      ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES referral_campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS promo_code VARCHAR(32),
      ADD COLUMN IF NOT EXISTS fraud_verdict "ReferralFraudVerdict",
      ADD COLUMN IF NOT EXISTS fraud_reason TEXT,
      ADD COLUMN IF NOT EXISTS campaign_snapshot JSONB;
    `);

    await client.query(`
      INSERT INTO platform_settings(key, value, "group", label, type, updated_by)
      VALUES
        ('referral_v2_velocity_window_hours', to_jsonb(24), 'platform', 'Referral v2 velocity window (hours)', 'number', 'system'),
        ('referral_v2_velocity_ip_limit', to_jsonb(5), 'platform', 'Referral v2 velocity IP limit', 'number', 'system'),
        ('referral_v2_velocity_device_limit', to_jsonb(4), 'platform', 'Referral v2 velocity device limit', 'number', 'system'),
        ('referral_v2_review_score_threshold', to_jsonb(60), 'platform', 'Referral v2 fraud review threshold', 'number', 'system'),
        ('referral_v2_block_score_threshold', to_jsonb(100), 'platform', 'Referral v2 fraud block threshold', 'number', 'system'),
        ('referral_v2_default_per_user_cap', to_jsonb(1), 'platform', 'Referral v2 default per-user cap', 'number', 'system')
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaigns_status_type_window_idx
      ON referral_campaigns(status, type, starts_at, ends_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaigns_source_offer_idx
      ON referral_campaigns(source, offer, status, priority DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaigns_promo_idx
      ON referral_campaigns(promo_code, status, priority DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaign_usage_campaign_created_idx
      ON referral_campaign_usage(campaign_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaign_usage_user_campaign_created_idx
      ON referral_campaign_usage(user_id, campaign_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaign_usage_order_idx
      ON referral_campaign_usage(order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_campaign_usage_purchase_idx
      ON referral_campaign_usage(purchase_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_fraud_checks_order_idx
      ON referral_fraud_checks(order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_fraud_checks_verdict_created_idx
      ON referral_fraud_checks(verdict, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_fraud_checks_user_created_idx
      ON referral_fraud_checks(user_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_fraud_checks_ip_created_idx
      ON referral_fraud_checks(ip_hash, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_fraud_checks_device_created_idx
      ON referral_fraud_checks(device_hash, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS slug_requests_campaign_created_idx
      ON slug_requests(campaign_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS slug_requests_fraud_verdict_created_idx
      ON slug_requests(fraud_verdict, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS slug_requests_promo_code_idx
      ON slug_requests(promo_code);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS purchases_campaign_purchased_idx
      ON purchases(campaign_id, purchased_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS purchases_fraud_verdict_purchased_idx
      ON purchases(fraud_verdict, purchased_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS purchases_promo_code_idx
      ON purchases(promo_code);
    `);
  },
};
