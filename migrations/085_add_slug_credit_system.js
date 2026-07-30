module.exports = {
  id: "085_add_slug_credit_system",
  async up(client) {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "CreditStatus" AS ENUM ('active', 'completed', 'cancelled', 'overdue');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "CreditPaymentStatus" AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS credits (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id text NOT NULL UNIQUE REFERENCES slug_requests(id) ON DELETE CASCADE,
        slug varchar(20) NOT NULL,
        principal_amount integer NOT NULL,
        down_payment_amount integer NOT NULL,
        financed_amount integer NOT NULL,
        term_months integer NOT NULL,
        monthly_amount integer NOT NULL,
        status "CreditStatus" NOT NULL DEFAULT 'active',
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz NULL,
        cancelled_at timestamptz NULL,
        note text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS credit_payments (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        credit_id text NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
        installment integer NOT NULL,
        amount integer NOT NULL,
        due_date timestamptz NOT NULL,
        paid_at timestamptz NULL,
        status "CreditPaymentStatus" NOT NULL DEFAULT 'pending',
        admin_note text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (credit_id, installment)
      );

      CREATE INDEX IF NOT EXISTS idx_credits_user_status_created_at ON credits(user_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_credits_status_created_at ON credits(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_credits_slug ON credits(slug);
      CREATE INDEX IF NOT EXISTS idx_credit_payments_status_due_date ON credit_payments(status, due_date);
      CREATE INDEX IF NOT EXISTS idx_credit_payments_due_date ON credit_payments(due_date);
    `);
  },
};
