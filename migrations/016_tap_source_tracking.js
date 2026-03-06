module.exports = {
  id: "016_tap_source_tracking",
  async up(client) {
    await client.query(`
      ALTER TABLE tap_events
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'direct';
    `);

    await client.query(`
      UPDATE tap_events
      SET source = CASE
        WHEN lower(source) IN ('telegram') THEN 'share'
        WHEN lower(source) IN ('nfc_scan', 'nfc_write') THEN 'nfc'
        WHEN lower(source) IN ('nfc', 'qr', 'direct', 'share', 'widget') THEN lower(source)
        ELSE 'direct'
      END;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tap_events_owner_slug_source
      ON tap_events (owner_slug, source);
    `);
  },
};
