module.exports = {
    id: "018_account_reactivation_lifecycle",
    async up(client) {
        await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
          ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'deleted';
        ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userstatus') THEN
          ALTER TYPE userstatus ADD VALUE IF NOT EXISTS 'deleted';
        END IF;
      END $$;
    `);

        await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reactivation_deadline_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reactivation_otp_code TEXT,
      ADD COLUMN IF NOT EXISTS reactivation_otp_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reactivation_otp_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deletion_reminder_7_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deletion_reminder_1_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS users_status_reactivation_deadline_at_idx
      ON users(status, reactivation_deadline_at);
    `);
    },
};
