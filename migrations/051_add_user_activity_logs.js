const id = "051_add_user_activity_logs";

async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user_activity_logs" (
      "id"         VARCHAR(36)   NOT NULL,
      "user_id"    VARCHAR(36),
      "user_login" VARCHAR(200),
      "action"     VARCHAR(60)   NOT NULL,
      "detail"     VARCHAR(500),
      "ip"         VARCHAR(45),
      "user_agent" VARCHAR(500),
      "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      CONSTRAINT "user_activity_logs_pkey" PRIMARY KEY ("id")
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS "ual_user_id_created_at_idx" ON "user_activity_logs"("user_id", "created_at" DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "ual_action_created_at_idx"  ON "user_activity_logs"("action",  "created_at" DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "ual_created_at_idx"         ON "user_activity_logs"("created_at" DESC)`);
}

module.exports = { id, up };
