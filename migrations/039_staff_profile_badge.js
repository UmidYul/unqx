module.exports = {
    id: "039_staff_profile_badge",
    async up(client) {
        await client.query(`
      INSERT INTO platform_settings (key, value, "group", label, description, type, updated_by)
      VALUES
        (
          'staff_profile_badge_title',
          to_jsonb('ПРОФИЛЬ СОТРУДНИКА UNQX'::text),
          'official_unq',
          'Заголовок бейджа сотрудника в профиле',
          'Отображается на визитке пользователей, созданных сотрудниками UNQX.',
          'text',
          'migration'
        ),
        (
          'staff_profile_badge_line',
          to_jsonb('Владелец данного профиля является членом команды UNQX. Данные верифицированы и подтверждены администрацией платформы.'::text),
          'official_unq',
          'Подпись бейджа сотрудника в профиле',
          NULL,
          'textarea',
          'migration'
        )
      ON CONFLICT (key) DO NOTHING
    `);
    },
};
