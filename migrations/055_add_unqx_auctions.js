module.exports = {
  id: "055_add_unqx_auctions",
  async up(client) {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS unqx_auctions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        starting_price integer NOT NULL DEFAULT 0,
        min_step integer NOT NULL DEFAULT 50000,
        current_bid integer NOT NULL DEFAULT 0,
        leader_user_id text,
        winner_user_id text,
        winning_bid_id uuid,
        starts_at timestamptz NOT NULL DEFAULT now(),
        ends_at timestamptz NOT NULL,
        finished_at timestamptz,
        created_by_admin varchar(80),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT unqx_auctions_status_check CHECK (status IN ('draft', 'active', 'finished', 'cancelled')),
        CONSTRAINT unqx_auctions_prices_check CHECK (starting_price >= 0 AND min_step > 0 AND current_bid >= 0)
      );

      CREATE INDEX IF NOT EXISTS unqx_auctions_status_ends_at_idx ON unqx_auctions (status, ends_at);
      CREATE INDEX IF NOT EXISTS unqx_auctions_created_at_idx ON unqx_auctions (created_at DESC);

      CREATE TABLE IF NOT EXISTS unqx_auction_bids (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        auction_id uuid NOT NULL REFERENCES unqx_auctions(id) ON DELETE CASCADE,
        user_id text,
        bidder_name varchar(120) NOT NULL DEFAULT 'UNQX User',
        bidder_username varchar(80),
        amount integer NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        admin_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT unqx_auction_bids_status_check CHECK (status IN ('active', 'banned')),
        CONSTRAINT unqx_auction_bids_amount_check CHECK (amount > 0)
      );

      CREATE INDEX IF NOT EXISTS unqx_auction_bids_auction_created_idx ON unqx_auction_bids (auction_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS unqx_auction_bids_auction_amount_idx ON unqx_auction_bids (auction_id, amount DESC, created_at ASC);
      CREATE INDEX IF NOT EXISTS unqx_auction_bids_user_idx ON unqx_auction_bids (user_id);
    `);
  },
};
