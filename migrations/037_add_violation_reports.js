module.exports = {
  id: "037_add_violation_reports",
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS violation_reports (
        id UUID PRIMARY KEY DEFAULT app_uuid_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        violation_type VARCHAR(40) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        user_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        reporter_ip VARCHAR(120),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS violation_reports_user_id_created_at_idx
      ON violation_reports (user_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS violation_reports_status_created_at_idx
      ON violation_reports (status, created_at DESC)
    `);
  },
};
