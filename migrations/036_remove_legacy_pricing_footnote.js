module.exports = {
  id: "036_remove_legacy_pricing_footnote",
  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.platform_settings') IS NOT NULL THEN
          UPDATE platform_settings
          SET
            value = to_jsonb(''::text),
            updated_by = 'system:remove_legacy_pricing_footnote_036',
            updated_at = now()
          WHERE key = 'pricing_footnote'
            AND (
              COALESCE(value #>> '{}', '') = 'Тарифы оплачиваются один раз. Без подписки и скрытых платежей.'
              OR COALESCE(value #>> '{}', '') = 'Тарифы оплачиваются один раз. Без подписки и скрытых платежей'
              OR COALESCE(value #>> '{}', '') LIKE 'Тарифы оплачиваются один раз%'
            );
        END IF;

        IF to_regclass('public.feature_settings') IS NOT NULL THEN
          UPDATE feature_settings
          SET value = jsonb_set(value, '{pricingFootnote}', to_jsonb(''::text), true)
          WHERE key = 'pricing'
            AND COALESCE(value->>'pricingFootnote', '') LIKE 'Тарифы оплачиваются один раз%';
        END IF;
      END
      $$;
    `);
  },
};
