module.exports = {
  id: "011_email_auth_and_user_id_refs",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(40),
      ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(120),
      ADD COLUMN IF NOT EXISTS email VARCHAR(190),
      ADD COLUMN IF NOT EXISTS pending_email VARCHAR(190),
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS otp_code TEXT,
      ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reset_password_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS login_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    `);

    await client.query(`
      UPDATE users
      SET email = lower(email)
      WHERE email IS NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
      ON users (email)
      WHERE email IS NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_chat_id_unique_idx
      ON users (telegram_chat_id)
      WHERE telegram_chat_id IS NOT NULL;
    `);

    await client.query(`
      ALTER TABLE slugs ADD COLUMN IF NOT EXISTS owner_id UUID;
      ALTER TABLE slug_requests ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id UUID;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_id UUID;
      ALTER TABLE drop_waitlist ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE unq_scores ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE score_history ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS owner_id UUID;
      ALTER TABLE slug_waitlist ADD COLUMN IF NOT EXISTS user_id UUID;
    `);

    await client.query(`
      UPDATE slugs s SET owner_id = u.id FROM users u WHERE s.owner_telegram_id = u.telegram_id AND s.owner_id IS NULL;
      UPDATE slug_requests sr SET user_id = u.id FROM users u WHERE sr.telegram_id = u.telegram_id AND sr.user_id IS NULL;
      UPDATE purchases p SET user_id = u.id FROM users u WHERE p.telegram_id = u.telegram_id AND p.user_id IS NULL;
      UPDATE referrals r SET referrer_id = u.id FROM users u WHERE r.referrer_telegram_id = u.telegram_id AND r.referrer_id IS NULL;
      UPDATE referrals r SET referred_id = u.id FROM users u WHERE r.referred_telegram_id = u.telegram_id AND r.referred_id IS NULL;
      UPDATE drop_waitlist dw SET user_id = u.id FROM users u WHERE dw.telegram_id = u.telegram_id AND dw.user_id IS NULL;
      UPDATE verification_requests vr SET user_id = u.id FROM users u WHERE vr.telegram_id = u.telegram_id AND vr.user_id IS NULL;
      UPDATE unq_scores us SET user_id = u.id FROM users u WHERE us.telegram_id = u.telegram_id AND us.user_id IS NULL;
      UPDATE score_history sh SET user_id = u.id FROM users u WHERE sh.telegram_id = u.telegram_id AND sh.user_id IS NULL;
      UPDATE profile_cards pc SET owner_id = u.id FROM users u WHERE pc.owner_telegram_id = u.telegram_id AND pc.owner_id IS NULL;
      UPDATE slug_waitlist sw SET user_id = u.id FROM users u WHERE sw.telegram_id = u.telegram_id AND sw.user_id IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS slugs_owner_id_idx ON slugs (owner_id, status);
      CREATE INDEX IF NOT EXISTS slug_requests_user_id_idx ON slug_requests (user_id, created_at);
      CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON purchases (user_id, purchased_at DESC);
      CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals (referrer_id, status);
      CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON referrals (referred_id);
      CREATE INDEX IF NOT EXISTS drop_waitlist_user_id_idx ON drop_waitlist (user_id);
      CREATE INDEX IF NOT EXISTS verification_requests_user_id_idx ON verification_requests (user_id, status);
      CREATE INDEX IF NOT EXISTS unq_scores_user_id_idx ON unq_scores (user_id);
      CREATE INDEX IF NOT EXISTS score_history_user_id_idx ON score_history (user_id, recorded_at);
      CREATE INDEX IF NOT EXISTS profile_cards_owner_id_idx ON profile_cards (owner_id);
      CREATE INDEX IF NOT EXISTS slug_waitlist_user_id_idx ON slug_waitlist (user_id, created_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS telegram_link_tokens (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(120) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_id_idx ON telegram_link_tokens (user_id, created_at DESC);
    `);
  },
};
