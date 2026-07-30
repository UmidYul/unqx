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

      DO $$
      DECLARE
        users_id_type text;
        orders_id_type text;
        credit_id_type text;
        credit_id_default text;
      BEGIN
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
          INTO users_id_type
        FROM pg_attribute attribute
        WHERE attribute.attrelid = 'users'::regclass
          AND attribute.attname = 'id'
          AND NOT attribute.attisdropped;

        SELECT format_type(attribute.atttypid, attribute.atttypmod)
          INTO orders_id_type
        FROM pg_attribute attribute
        WHERE attribute.attrelid = 'slug_requests'::regclass
          AND attribute.attname = 'id'
          AND NOT attribute.attisdropped;

        IF users_id_type IS NULL OR orders_id_type IS NULL THEN
          RAISE EXCEPTION 'Cannot determine users.id or slug_requests.id type';
        END IF;

        credit_id_type := orders_id_type;
        credit_id_default := CASE
          WHEN credit_id_type = 'uuid' AND to_regprocedure('app_uuid_v4()') IS NOT NULL THEN 'DEFAULT app_uuid_v4()'
          WHEN credit_id_type = 'uuid' THEN 'DEFAULT gen_random_uuid()'
          ELSE 'DEFAULT gen_random_uuid()::text'
        END;

        IF to_regclass('credits') IS NOT NULL THEN
          PERFORM 1
          FROM pg_attribute attribute
          WHERE attribute.attrelid = 'credits'::regclass
            AND attribute.attname = 'user_id'
            AND format_type(attribute.atttypid, attribute.atttypmod) = users_id_type
            AND NOT attribute.attisdropped;

          IF NOT FOUND THEN
            PERFORM 1 FROM credits LIMIT 1;
            IF FOUND THEN
              RAISE EXCEPTION 'Existing credits.user_id type is incompatible and table is not empty';
            END IF;
            DROP TABLE credits CASCADE;
          END IF;
        END IF;

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS credits (
            id %1$s PRIMARY KEY %2$s,
            user_id %3$s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            order_id %4$s NOT NULL UNIQUE REFERENCES slug_requests(id) ON DELETE CASCADE,
            slug varchar(20) NOT NULL,
            principal_amount integer NOT NULL,
            down_payment_amount integer NOT NULL,
            financed_amount integer NOT NULL,
            term_months integer NOT NULL,
            monthly_amount integer NOT NULL,
            status "CreditStatus" NOT NULL DEFAULT ''active'',
            started_at timestamptz NOT NULL DEFAULT now(),
            completed_at timestamptz NULL,
            cancelled_at timestamptz NULL,
            note text NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )',
          credit_id_type,
          credit_id_default,
          users_id_type,
          orders_id_type
        );

        IF to_regclass('credit_payments') IS NOT NULL THEN
          PERFORM 1
          FROM pg_attribute attribute
          WHERE attribute.attrelid = 'credit_payments'::regclass
            AND attribute.attname = 'credit_id'
            AND format_type(attribute.atttypid, attribute.atttypmod) = credit_id_type
            AND NOT attribute.attisdropped;

          IF NOT FOUND THEN
            PERFORM 1 FROM credit_payments LIMIT 1;
            IF FOUND THEN
              RAISE EXCEPTION 'Existing credit_payments.credit_id type is incompatible and table is not empty';
            END IF;
            DROP TABLE credit_payments;
          END IF;
        END IF;

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS credit_payments (
            id %1$s PRIMARY KEY %2$s,
            credit_id %1$s NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
            installment integer NOT NULL,
            amount integer NOT NULL,
            due_date timestamptz NOT NULL,
            paid_at timestamptz NULL,
            status "CreditPaymentStatus" NOT NULL DEFAULT ''pending'',
            admin_note text NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (credit_id, installment)
          )',
          credit_id_type,
          credit_id_default
        );
      END $$;

      CREATE INDEX IF NOT EXISTS idx_credits_user_status_created_at ON credits(user_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_credits_status_created_at ON credits(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_credits_slug ON credits(slug);
      CREATE INDEX IF NOT EXISTS idx_credit_payments_status_due_date ON credit_payments(status, due_date);
      CREATE INDEX IF NOT EXISTS idx_credit_payments_due_date ON credit_payments(due_date);
    `);
  },
};
