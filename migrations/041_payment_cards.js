module.exports = {
    id: "041_payment_cards",
    async up(client) {
        await client.query(`
      CREATE TABLE IF NOT EXISTS payment_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        number INTEGER NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        role VARCHAR(120),
        bio VARCHAR(120),
        hashtag VARCHAR(50),
        address TEXT,
        postcode VARCHAR(20),
        email VARCHAR(100),
        extra_phone VARCHAR(30),
        avatar_url TEXT,
        tags JSONB NOT NULL DEFAULT '[]',
        buttons JSONB NOT NULL DEFAULT '[]',
        theme "CardTheme" NOT NULL DEFAULT 'marble',
        custom_color VARCHAR(20),
        show_branding BOOLEAN NOT NULL DEFAULT true,
        views_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS payment_cards_number_unique
        ON payment_cards (number);

      CREATE INDEX IF NOT EXISTS payment_cards_owner_id_idx
        ON payment_cards (owner_id);
    `);
    },
};
