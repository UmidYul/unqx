module.exports = {
  id: "094_update_platform_total_slugs",
  async up(client) {
    await client.query(`
      UPDATE platform_settings
      SET
        value = to_jsonb(17576000),
        updated_by = 'migration',
        updated_at = NOW()
      WHERE key = 'platform_total_slugs'
        AND (value = '17576'::jsonb OR value = to_jsonb('17576'::text))
    `);
  },
};
