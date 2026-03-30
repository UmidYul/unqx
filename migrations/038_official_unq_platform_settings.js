module.exports = {
  id: "038_official_unq_platform_settings",
  async up(client) {
    await client.query(`
      INSERT INTO platform_settings (key, value, "group", label, description, type, updated_by)
      VALUES
        (
          'official_unq_letter_prefixes',
          '["DAV","PPP","PAA","UZB"]'::jsonb,
          'official_unq',
          'Префиксы букв (3 латинские буквы, как серии госномеров)',
          'Массив строк по одной на строку в UI. Регистр не важен. Цифры UNQ не учитываются — только первые три буквы.',
          'json',
          'migration'
        ),
        (
          'official_unq_calculator_hint',
          to_jsonb($CALC$Серии вроде госномеров (определённые три буквы латиницы) резервируются только по согласованию с администрацией и руководством проекта.$CALC$::text),
          'official_unq',
          'Подсказка под калькулятором на главной',
          'Короткий текст под описанием формата на главной. Пустая строка — блок скрыт.',
          'textarea',
          'migration'
        ),
        (
          'official_unq_purchase_notice_title',
          to_jsonb('Официальная серия'::text),
          'official_unq',
          'Заголовок предупреждения перед покупкой',
          'Показывается в калькуляторе, в hero и в модалке заказа для совпавших префиксов.',
          'text',
          'migration'
        ),
        (
          'official_unq_purchase_notice_body',
          to_jsonb($BODY$Такой UNQ можно приобрести только после согласования с администрацией и руководством UNQX. Эти буквенные комбинации предназначены для ограниченного круга владельцев.$BODY$::text),
          'official_unq',
          'Текст предупреждения перед покупкой',
          NULL,
          'textarea',
          'migration'
        ),
        (
          'official_unq_profile_badge_title',
          to_jsonb('Официальная серия UNQ'::text),
          'official_unq',
          'Заголовок бейджа в профиле',
          'Компактный блок на карточке UNQ в кабинете.',
          'text',
          'migration'
        ),
        (
          'official_unq_profile_badge_line',
          to_jsonb('Закрепление согласовано с администрацией и руководством платформы.'::text),
          'official_unq',
          'Подпись бейджа в профиле',
          NULL,
          'textarea',
          'migration'
        )
      ON CONFLICT (key) DO NOTHING
    `);
  },
};
