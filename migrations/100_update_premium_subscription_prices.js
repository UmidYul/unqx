module.exports = {
  id: "100_update_premium_subscription_prices",
  async up(client) {
    for (const [key, value, label] of [
      ["plan_premium_monthly_price_uzs", 26000, "Premium monthly price UZS"],
      ["plan_premium_yearly_price_uzs", 160000, "Premium yearly price UZS"],
      ["plan_premium_price", 26000, "Цена премиум тарифа"],
      ["plan_basic_price", 26000, "Цена базового тарифа"],
      ["plan_premium_upgrade_price", 26000, "Цена апгрейда до премиум"],
    ]) {
      await client.query(`
        INSERT INTO platform_settings (key, value, "group", label, type, updated_by)
        VALUES ($1, to_jsonb($2::integer), 'pricing', $3, 'number', 'migration')
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value, updated_by = 'migration', updated_at = now()
      `, [key, value, label]);
    }
    await client.query(`
      UPDATE platform_settings
      SET value = to_jsonb($1::text), updated_by = 'migration', updated_at = now()
      WHERE key = 'pricing_footnote'
        AND value #>> '{}' IN (
          'Premium-подписка оплачивается ежемесячно. Без автосписаний.',
          'Premium subscription is billed monthly.'
        )
    `, ['Premium: 26 000 сум в месяц или 160 000 сум в год. Без автосписаний.']);
  },
};
