module.exports = {
  id: "020_referrals_v1_wallet",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusLedgerDirection') THEN
          CREATE TYPE "BonusLedgerDirection" AS ENUM ('credit', 'debit');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusLedgerKind') THEN
          CREATE TYPE "BonusLedgerKind" AS ENUM ('referral_reward', 'bonus_spend', 'bonus_refund', 'manual_adjustment');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralConversionStatus') THEN
          CREATE TYPE "ReferralConversionStatus" AS ENUM ('pending', 'approved', 'reversed');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_bonus_wallet (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_conversions (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ref_code VARCHAR(40),
        ref_source VARCHAR(40),
        ref_offer VARCHAR(80),
        status "ReferralConversionStatus" NOT NULL DEFAULT 'pending',
        reward_amount INTEGER NOT NULL DEFAULT 0,
        invitee_discount_applied INTEGER NOT NULL DEFAULT 0,
        bonus_spent INTEGER NOT NULL DEFAULT 0,
        order_id UUID UNIQUE REFERENCES slug_requests(id) ON DELETE SET NULL,
        purchase_id UUID UNIQUE REFERENCES purchases(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bonus_ledger (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        direction "BonusLedgerDirection" NOT NULL,
        kind "BonusLedgerKind" NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL UNIQUE,
        order_id UUID REFERENCES slug_requests(id) ON DELETE SET NULL,
        purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
        conversion_id UUID REFERENCES referral_conversions(id) ON DELETE SET NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE slug_requests
      ADD COLUMN IF NOT EXISTS ref_code VARCHAR(40),
      ADD COLUMN IF NOT EXISTS ref_source VARCHAR(40),
      ADD COLUMN IF NOT EXISTS ref_offer VARCHAR(80),
      ADD COLUMN IF NOT EXISTS invitee_discount_applied INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bonus_spent INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_cap_applied INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS ref_code VARCHAR(40),
      ADD COLUMN IF NOT EXISTS ref_source VARCHAR(40),
      ADD COLUMN IF NOT EXISTS ref_offer VARCHAR(80),
      ADD COLUMN IF NOT EXISTS invitee_discount_applied INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bonus_spent INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_cap_applied INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      INSERT INTO platform_settings(key, value, "group", label, type, updated_by)
      VALUES
        ('referral_v1_referrer_reward', to_jsonb(50000), 'platform', 'Реферальная награда (сум)', 'number', 'system'),
        ('referral_v1_invitee_discount', to_jsonb(100000), 'platform', 'Скидка приглашенному (сум)', 'number', 'system'),
        ('referral_v1_discount_cap_percent', to_jsonb(30), 'platform', 'Лимит общей скидки (%)', 'number', 'system'),
        ('referral_v1_tiers_enabled', to_jsonb(false), 'platform', 'Tier-рефералка включена', 'boolean', 'system')
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_conversions_referrer_created_at_idx
      ON referral_conversions(referrer_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_conversions_referred_created_at_idx
      ON referral_conversions(referred_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_conversions_source_offer_created_at_idx
      ON referral_conversions(ref_source, ref_offer, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS referral_conversions_status_created_at_idx
      ON referral_conversions(status, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bonus_ledger_user_created_at_idx
      ON bonus_ledger(user_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bonus_ledger_kind_created_at_idx
      ON bonus_ledger(kind, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bonus_ledger_order_id_idx
      ON bonus_ledger(order_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bonus_ledger_purchase_id_idx
      ON bonus_ledger(purchase_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bonus_ledger_conversion_id_idx
      ON bonus_ledger(conversion_id);
    `);
  },
};
