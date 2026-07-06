module.exports = {
  id: "055_add_unqx_auctions",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS unqx_auctions (
        id SERIAL PRIMARY KEY,
        slug varchar(20) NOT NULL,
        unqx_number varchar(20) NOT NULL DEFAULT '',
        status varchar(20) NOT NULL DEFAULT 'active',
        starting_price bigint NOT NULL DEFAULT 0,
        start_price bigint NOT NULL DEFAULT 0,
        min_step bigint NOT NULL DEFAULT 50000,
        current_bid bigint NOT NULL DEFAULT 0,
        current_price bigint NOT NULL DEFAULT 0,
        leader_user_id text,
        leader_username varchar(120),
        previous_leader_username varchar(120),
        winner_user_id text,
        winning_bid_id integer,
        starts_at timestamptz NOT NULL DEFAULT now(),
        start_date timestamptz NOT NULL DEFAULT now(),
        ends_at timestamptz NOT NULL,
        end_date timestamptz,
        finished_at timestamptz,
        created_by_admin varchar(80),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT unqx_auctions_status_check CHECK (status IN ('draft', 'active', 'finished', 'completed', 'cancelled')),
        CONSTRAINT unqx_auctions_prices_check CHECK (starting_price >= 0 AND min_step > 0 AND current_bid >= 0)
      );

      ALTER TABLE unqx_auctions DROP CONSTRAINT IF EXISTS unqx_auctions_status_check;
      ALTER TABLE unqx_auctions ADD CONSTRAINT unqx_auctions_status_check CHECK (status IN ('draft', 'active', 'finished', 'completed', 'cancelled'));
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS unqx_number varchar(20) NOT NULL DEFAULT '';
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS start_price bigint NOT NULL DEFAULT 0;
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS current_price bigint NOT NULL DEFAULT 0;
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS leader_username varchar(120);
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS previous_leader_username varchar(120);
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS start_date timestamptz NOT NULL DEFAULT now();
      ALTER TABLE unqx_auctions ADD COLUMN IF NOT EXISTS end_date timestamptz;
      ALTER TABLE unqx_auctions ALTER COLUMN starting_price TYPE bigint;
      ALTER TABLE unqx_auctions ALTER COLUMN min_step TYPE bigint;
      ALTER TABLE unqx_auctions ALTER COLUMN current_bid TYPE bigint;

      UPDATE unqx_auctions
      SET
        unqx_number = COALESCE(NULLIF(unqx_number, ''), slug),
        start_price = COALESCE(NULLIF(start_price, 0), starting_price),
        current_price = COALESCE(NULLIF(current_price, 0), current_bid),
        start_date = COALESCE(start_date, starts_at),
        end_date = COALESCE(end_date, ends_at);

      CREATE INDEX IF NOT EXISTS unqx_auctions_status_ends_at_idx ON unqx_auctions (status, ends_at);
      CREATE INDEX IF NOT EXISTS unqx_auctions_created_at_idx ON unqx_auctions (created_at DESC);

      CREATE TABLE IF NOT EXISTS unqx_auction_bids (
        id SERIAL PRIMARY KEY,
        auction_id integer NOT NULL REFERENCES unqx_auctions(id) ON DELETE CASCADE,
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
