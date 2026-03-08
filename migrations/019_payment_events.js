module.exports = {
  id: "019_payment_events",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_events (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        order_id UUID NOT NULL,
        user_id UUID NOT NULL,
        status VARCHAR(24) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        reference VARCHAR(80) NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        actor VARCHAR(80) NOT NULL,
        source VARCHAR(40) NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_events_order_created_at_idx
      ON payment_events(order_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payment_events_provider_status_created_at_idx
      ON payment_events(provider, status, created_at DESC);
    `);
  },
};
