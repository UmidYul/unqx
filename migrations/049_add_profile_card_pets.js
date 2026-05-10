module.exports = {
  id: "049_add_profile_card_pets",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseType') THEN
          BEGIN
            ALTER TYPE "PurchaseType" ADD VALUE IF NOT EXISTS 'pet';
          EXCEPTION
            WHEN duplicate_object THEN
              NULL;
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchasetype') THEN
          BEGIN
            ALTER TYPE purchasetype ADD VALUE IF NOT EXISTS 'pet';
          EXCEPTION
            WHEN duplicate_object THEN
              NULL;
          END;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetType')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pettype') THEN
          CREATE TYPE "PetType" AS ENUM ('kitten', 'puppy', 'snake');
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetType') THEN
          BEGIN ALTER TYPE "PetType" ADD VALUE IF NOT EXISTS 'kitten'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "PetType" ADD VALUE IF NOT EXISTS 'puppy'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "PetType" ADD VALUE IF NOT EXISTS 'snake'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pettype')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetType') THEN
          BEGIN ALTER TYPE pettype ADD VALUE IF NOT EXISTS 'kitten'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE pettype ADD VALUE IF NOT EXISTS 'puppy'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE pettype ADD VALUE IF NOT EXISTS 'snake'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetPurchaseRequestStatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'petpurchaserequeststatus') THEN
          CREATE TYPE "PetPurchaseRequestStatus" AS ENUM ('pending', 'approved', 'rejected');
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetPurchaseRequestStatus') THEN
          BEGIN ALTER TYPE "PetPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'pending'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "PetPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'approved'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE "PetPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'rejected'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'petpurchaserequeststatus')
          AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetPurchaseRequestStatus') THEN
          BEGIN ALTER TYPE petpurchaserequeststatus ADD VALUE IF NOT EXISTS 'pending'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE petpurchaserequeststatus ADD VALUE IF NOT EXISTS 'approved'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE petpurchaserequeststatus ADD VALUE IF NOT EXISTS 'rejected'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_card_pets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_card_id UUID NOT NULL REFERENCES profile_cards(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pet_type "PetType" NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        price_snapshot INTEGER NOT NULL,
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pet_purchase_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_card_id UUID NOT NULL REFERENCES profile_cards(id) ON DELETE CASCADE,
        pet_type "PetType" NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        price_snapshot INTEGER NOT NULL,
        status "PetPurchaseRequestStatus" NOT NULL DEFAULT 'pending',
        payment_reference VARCHAR(40) NOT NULL,
        payment_url TEXT NOT NULL,
        admin_note TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_card_pets_user_id_pet_type_key
        ON profile_card_pets (user_id, pet_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_card_pets_profile_card_id_created_at_idx
        ON profile_card_pets (profile_card_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS profile_card_pets_user_id_created_at_idx
        ON profile_card_pets (user_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pet_purchase_requests_user_id_requested_at_idx
        ON pet_purchase_requests (user_id, requested_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pet_purchase_requests_status_requested_at_idx
        ON pet_purchase_requests (status, requested_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pet_purchase_requests_profile_card_id_requested_at_idx
        ON pet_purchase_requests (profile_card_id, requested_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS pet_purchase_requests_user_type_status_idx
        ON pet_purchase_requests (user_id, pet_type, status)
    `);
  },
};
