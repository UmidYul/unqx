(function initAdminSettings() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;
  const activeTab = body.getAttribute("data-active-tab") || "analytics";
  if (activeTab !== "settings") return;

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const groups = ["pricing", "algorithm", "contacts", "platform", "homepage", "official_unq"];
  const uiConfig = {
    hiddenByGroup: {
      pricing: new Set([
        "plan_basic_name",
        "plan_basic_price",
        "plan_basic_slug_limit",
        "plan_basic_button_limit",
        "plan_basic_tag_limit",
        "plan_basic_themes",
        "plan_basic_hide_branding",
        "plan_basic_analytics_days",
        "plan_basic_features",
        "plan_basic_excluded_features",
        "plan_premium_upgrade_price",
      ]),
      platform: new Set(["referral_tiers", "referral_v1_tiers_enabled", "platform_today_visitors_adjustment"]),
    },
    labelByKey: {
      plan_basic_name: "Название тарифа Basic",
      plan_basic_price: "Цена тарифа Basic (сум)",
      plan_premium_name: "Название тарифа Premium",
      plan_premium_price: "Цена тарифа Premium (сум)",
      plan_premium_monthly_price_usd: "Premium monthly price (USD)",
      plan_premium_monthly_price_uzs: "Premium monthly price (UZS)",
      plan_premium_upgrade_price: "Цена апгрейда до Premium (сум)",
      pet_kitten_price: "Цена питомца Коала (сум)",
      pet_puppy_price: "Цена питомца Котик (сум)",
      pet_snake_price: "Цена питомца Леопард (сум)",
      pricing_section_visible: "Показывать блок тарифов на главной",
      pricing_slug_markup_percent: "Наценка на номера (%)",
      pricing_slug_markup_comment: "Комментарий к наценке номеров",
      plan_premium_popular_badge: "Показывать бейдж Популярный",
      payment_manual_instructions: "Инструкция для ручной оплаты",
      payment_click_merchant_id: "Click Merchant ID",
      payment_payme_merchant_id: "Payme Merchant ID",
      contact_telegram_chat_id: "Telegram Chat ID (служебный)",
      platform_hero_subtitle: "Подзаголовок hero-блока",
      platform_total_slugs: "Общее количество slug",
      homepage_flash_sale_visible: "Показывать Flash Sale баннер",
      homepage_hero_visible: "Показывать Hero и проверку UNQ",
      homepage_promo_banner_visible: "Показывать промо-баннер",
      homepage_promo_banner_image_url: "Картинка промо-баннера",
      homepage_promo_banner_target_url: "Ссылка промо-баннера",
      homepage_promo_banner_alt: "Alt промо-баннера",
      homepage_next_drop_visible: "Показывать блок следующего дропа",
      homepage_calculator_visible: "Показывать калькулятор стоимости UNQ",
      homepage_live_profiles_visible: "Показывать Live Profiles",
      homepage_testimonials_visible: "Показывать отзывы",
      homepage_latest_posts_visible: "Показывать последние посты",
      homepage_latest_unq_visible: "Показывать последние созданные UNQ",
      homepage_views_ranking_visible: "Показывать рейтинг по просмотрам",
      homepage_auction_visible: "Показывать аукцион",
      homepage_faq_visible: "Показывать FAQ",
      pending_expiry_hours: "Срок pending-заказа (часы)",
      score_recalc_interval_hours: "Пересчет Score (часы)",
      referral_v1_referrer_reward: "Награда рефереру (сум)",
      referral_v1_invitee_discount: "Скидка приглашенному (сум)",
      referral_v1_discount_cap_percent: "Лимит общей скидки (%)",
    },
    descriptionByKey: {
      payment_click_merchant_id: "Заполняется только при активной интеграции Click.",
      payment_payme_merchant_id: "Заполняется только при активной интеграции Payme.",
      contact_telegram_chat_id: "Служебный идентификатор для отправки уведомлений в Telegram.",
      feature_directory: "Показывает публичный каталог визиток (Directory).",
      feature_leaderboard: "Включает страницу рейтинга пользователей.",
      feature_score_public: "Показывает UNQ Score на публичной визитке.",
      feature_verification: "Разрешает пользователям отправлять заявки на верификацию.",
      feature_drops: "Включает страницу и механику drops.",
      feature_referrals: "Включает реферальную систему для новых заказов.",
      referral_v1_referrer_reward: "Сумма бонуса пользователю, который пригласил друга.",
      referral_v1_invitee_discount: "Скидка новому пользователю по реферальной ссылке.",
      referral_v1_discount_cap_percent: "Максимальный общий дисконт от slug-базы.",
      pricing_slug_markup_percent: "Процент добавляется ко всем итоговым ценам UNQ-номеров до акций, промокодов и реферальных скидок.",
      pricing_slug_markup_comment: "Внутренний комментарий для админки: причина или дата изменения.",
      official_unq_letter_prefixes: "Например: DAV, UZB, PPP — только три буквы, как на узбекских номерах.",
      official_unq_calculator_hint: "Показывается на главной под калькулятором. Очистите поле, чтобы скрыть.",
      pending_expiry_hours: "Через сколько часов неоплаченный заказ станет просроченным.",
      score_recalc_interval_hours: "Как часто пересчитывать UNQ Score.",
      leaderboard_min_views: "Минимум просмотров визитки для попадания в рейтинг.",
      leaderboard_public_count: "Сколько карточек показывать в публичном рейтинге.",
      maintenance_mode: "Отключает сайт для пользователей и показывает страницу обслуживания.",
      maintenance_release_report_mode: "Показывает публичную страницу отчета до релиза.",
      maintenance_release_open_at: "Дата и время, когда сайт автоматически откроется.",
      homepage_flash_sale_visible: "Верхний промо-баннер активной Flash Sale акции.",
      homepage_hero_visible: "Первый экран с заголовком, live-статистикой и проверкой свободного UNQ.",
      homepage_promo_banner_visible: "Длинный баннер между статистикой занятых UNQ и калькулятором.",
      homepage_promo_banner_image_url: "Путь к картинке. Можно загрузить файл во вкладке Баннер.",
      homepage_promo_banner_target_url: "Куда ведет клик по баннеру: #calculator, /страница или https://...",
      homepage_promo_banner_alt: "Текст для доступности и SEO.",
      homepage_next_drop_visible: "Красная плашка с ближайшим дропом и кнопкой уведомления.",
      homepage_calculator_visible: "Блок расчёта цены и бронирования комбинации.",
      homepage_live_profiles_visible: "Горизонтальная лента live profiles.",
      homepage_testimonials_visible: "Секция отзывов. Сейчас по умолчанию скрыта.",
      homepage_latest_posts_visible: "Карточки последних публичных постов.",
      homepage_latest_unq_visible: "Последние созданные аккаунты/UNQ.",
      homepage_views_ranking_visible: "Топ профилей по просмотрам.",
      homepage_auction_visible: "Виджет активного аукциона под рейтингом.",
      homepage_faq_visible: "Блок часто задаваемых вопросов.",
    },
    orderByGroup: {
      pricing: [
        "plan_basic_name",
        "plan_basic_price",
        "plan_basic_slug_limit",
        "plan_basic_button_limit",
        "plan_basic_tag_limit",
        "plan_basic_themes",
        "plan_basic_hide_branding",
        "plan_basic_analytics_days",
        "plan_basic_features",
        "plan_basic_excluded_features",
        "plan_premium_name",
        "plan_premium_price",
        "plan_premium_monthly_price_usd",
        "plan_premium_monthly_price_uzs",
        "plan_premium_upgrade_price",
        "plan_premium_slug_limit",
        "plan_premium_button_limit",
        "plan_premium_tag_limit",
        "plan_premium_themes",
        "plan_premium_hide_branding",
        "plan_premium_analytics_days",
        "plan_premium_features",
        "plan_premium_excluded_features",
        "pet_kitten_price",
        "pet_puppy_price",
        "pet_snake_price",
        "pricing_section_visible",
        "pricing_slug_markup_percent",
        "pricing_slug_markup_comment",
        "plan_premium_popular_badge",
        "pricing_footnote",
        "payment_provider",
        "payment_manual_instructions",
        "payment_click_merchant_id",
        "payment_payme_merchant_id",
      ],
      algorithm: [
        "slug_base_price",
        "slug_mult_letters_all_same",
        "slug_mult_letters_sequential",
        "slug_mult_letters_palindrome",
        "slug_mult_letters_random",
        "slug_mult_digits_zeros",
        "slug_mult_digits_near_zero",
        "slug_mult_digits_all_same",
        "slug_mult_digits_sequential",
        "slug_mult_digits_round",
        "slug_mult_digits_palindrome",
        "slug_mult_digits_random",
        "slug_pricing_custom_rules",
      ],
      contacts: [
        "contact_support_telegram",
        "contact_phone",
        "contact_email",
        "contact_address",
        "contact_response_time",
        "contact_error_fallback",
        "contact_telegram_bot",
        "contact_telegram_channel",
        "contact_telegram_chat_id",
      ],
      platform: [
        "platform_name",
        "platform_tagline",
        "platform_hero_subtitle",
        "platform_total_slugs",
        "feature_directory",
        "feature_leaderboard",
        "feature_score_public",
        "feature_verification",
        "feature_drops",
        "feature_referrals",
        "referral_v1_referrer_reward",
        "referral_v1_invitee_discount",
        "referral_v1_discount_cap_percent",
        "pending_expiry_hours",
        "score_recalc_interval_hours",
        "leaderboard_min_views",
        "leaderboard_public_count",
        "maintenance_mode",
        "maintenance_message",
        "maintenance_release_report_mode",
        "maintenance_release_report_title",
        "maintenance_release_report_message",
        "maintenance_release_open_at",
      ],
      homepage: [
        "homepage_flash_sale_visible",
        "homepage_hero_visible",
        "homepage_promo_banner_visible",
        "homepage_promo_banner_image_url",
        "homepage_promo_banner_target_url",
        "homepage_promo_banner_alt",
        "homepage_next_drop_visible",
        "homepage_calculator_visible",
        "homepage_live_profiles_visible",
        "homepage_latest_posts_visible",
        "homepage_latest_unq_visible",
        "homepage_views_ranking_visible",
        "homepage_auction_visible",
        "homepage_faq_visible",
        "homepage_testimonials_visible",
      ],
      official_unq: [
        "official_unq_letter_prefixes",
        "official_unq_calculator_hint",
        "official_unq_purchase_notice_title",
        "official_unq_purchase_notice_body",
        "official_unq_profile_badge_title",
        "official_unq_profile_badge_line",
        "staff_profile_badge_title",
        "staff_profile_badge_line",
      ],
    },
    sectionByKey: {
      pricing: {
        plan_basic_name: "Тариф Basic",
        plan_premium_name: "Тариф Premium",
        pet_kitten_price: "Животные",
        pricing_section_visible: "Публичное отображение",
        payment_provider: "Оплата",
      },
      algorithm: {
        slug_base_price: "Базовая цена",
        slug_mult_letters_all_same: "Множители для букв",
        slug_mult_digits_zeros: "Множители для цифр",
        slug_pricing_custom_rules: "Кастомные паттерны",
      },
      contacts: {
        contact_support_telegram: "Публичные контакты",
        contact_telegram_bot: "Telegram",
        contact_telegram_chat_id: "Служебные параметры",
      },
      platform: {
        platform_name: "Бренд и витрина",
        feature_directory: "Функции платформы",
        referral_v1_referrer_reward: "Рефералка",
        pending_expiry_hours: "Лимиты и расчеты",
        maintenance_mode: "Обслуживание",
      },
      homepage: {
        homepage_flash_sale_visible: "Показ блоков",
      },
      official_unq: {
        official_unq_letter_prefixes: "Префиксы и тексты",
        official_unq_calculator_hint: "Публичные тексты",
        official_unq_purchase_notice_title: "Предупреждение перед покупкой",
        official_unq_profile_badge_title: "Пометка на визитке",
        official_unq_profile_badge_line: "Пометка на визитке",
        staff_profile_badge_title: "Бейдж сотрудника UNQX",
        staff_profile_badge_line: "Бейдж сотрудника UNQX",
      },
    },
  };
  const state = {
    activeSubtab: "pricing",
    loaded: {},
    originalByGroup: {},
    currentByGroup: {},
    dirtyByGroup: {},
    changesPage: 1,
  };

  function resolveSettingsPanel(group) {
    if (group === "official_unq") {
      return document.getElementById("admin-settings-panel-official-unq");
    }
    return document.querySelector(`[data-settings-panel="${group}"]`);
  }

  function resolveSettingsForm(group) {
    if (group === "official_unq") {
      return document.getElementById("settings-form-official-unq");
    }
    return document.getElementById(`settings-form-${group}`);
  }

  const panelByGroup = Object.fromEntries(
    ["pricing", "algorithm", "contacts", "platform", "homepage", "official_unq", "changes"].map((group) => [group, resolveSettingsPanel(group)]),
  );

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function jsonFetch(url, init) {
    return fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...(init?.headers || {}),
      },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || `HTTP ${response.status}`;
        const error = new Error(message);
        error.payload = payload;
        throw error;
      }
      return payload;
    });
  }

  function showAlert(message) {
    if (window.UNQAdminDialog?.alert) {
      return window.UNQAdminDialog.alert(message);
    }
    if (typeof window.alert === "function") {
      window.alert(message);
    }
    return Promise.resolve();
  }

  function showConfirm(message) {
    if (window.UNQAdminDialog?.confirm) {
      return window.UNQAdminDialog.confirm(message);
    }
    if (typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(message));
    }
    return Promise.resolve(false);
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function equals(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function setDirty(group, dirty) {
    state.dirtyByGroup[group] = dirty;
    const dot = document.querySelector(`[data-settings-unsaved-dot="${group}"]`);
    if (dot instanceof HTMLElement) {
      dot.classList.toggle("hidden", !dirty);
    }
  }

  function refreshDirty(group) {
    const original = state.originalByGroup[group] || {};
    const current = state.currentByGroup[group] || {};
    setDirty(group, !equals(original, current));
  }

  function parseInputValue(field, item) {
    const t = item.type;
    if (t === "number") return Number(field.value || 0);
    if (t === "boolean") return Boolean(field.checked);
    if (t === "json") {
      try {
        return JSON.parse(field.value || "[]");
      } catch {
        return Array.isArray(item.value) ? [] : {};
      }
    }
    return String(field.value || "");
  }

  function toDateTimeLocalValue(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = parsed.getFullYear();
    const mm = pad(parsed.getMonth() + 1);
    const dd = pad(parsed.getDate());
    const hh = pad(parsed.getHours());
    const min = pad(parsed.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function updateCurrentFromForm(group) {
    const form = resolveSettingsForm(group);
    const loaded = state.loaded[group] || [];
    if (!(form instanceof HTMLFormElement)) return;
    const next = {};
    loaded.forEach((item) => {
      // Спец. обработка для визуального редактора custom_rules
      if (item.key === "slug_pricing_custom_rules") {
        const textarea = form.elements.namedItem(item.key);
        if (textarea instanceof HTMLTextAreaElement) {
          // Собираем значения из таблицы
          const rows = form.querySelectorAll("#custom-rules-rows tr[data-rule-row]");
          const arr = [];
          rows.forEach((row, idx) => {
            arr.push({
              pattern: row.querySelector(`[data-rule-pattern='${idx}']`)?.value || "",
              type: row.querySelector(`[data-rule-type='${idx}']`)?.value || "contains",
              delta: Number(row.querySelector(`[data-rule-delta='${idx}']`)?.value || 0),
              label: row.querySelector(`[data-rule-label='${idx}']`)?.value || "",
            });
          });
          textarea.value = JSON.stringify(arr);
          next[item.key] = arr;
        }
        return;
      }
      const field = form.elements.namedItem(item.key);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        next[item.key] = parseInputValue(field, item);
      }
    });
    state.currentByGroup[group] = next;
    refreshDirty(group);
    if (group === "algorithm") {
      renderAlgorithmPreview();
    }
  }

  function buildArrayEditor(group, item, values) {
    const key = item.key;
    const listId = `${group}-${key}-list`;
    const rows = values
      .map(
        (v, idx) => `
        <div class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2" data-array-row="${idx}">
          <span class="cursor-move text-neutral-400">::</span>
          <input type="text" value="${esc(v)}" class="min-h-11 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" data-array-input="${idx}" />
          <button type="button" data-array-remove="${idx}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700">Удалить</button>
        </div>`,
      )
      .join("");
    return `
      <div id="${listId}" class="space-y-2" data-array-list="${key}">${rows}</div>
      <button type="button" data-array-add="${key}" class="interactive-btn mt-2 min-h-11 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700">Добавить строку</button>
    `;
  }

  function prepareGroupItems(group, items) {
    const hidden = uiConfig.hiddenByGroup[group] || new Set();
    const withMeta = items
      .filter((item) => !hidden.has(item.key))
      .map((item) => ({
        ...item,
        label: uiConfig.labelByKey[item.key] || item.label,
        description: uiConfig.descriptionByKey[item.key] || item.description,
        __section: uiConfig.sectionByKey[group]?.[item.key] || "",
      }));
    const byKey = new Map(withMeta.map((item) => [item.key, item]));
    const orderedKeys = uiConfig.orderByGroup[group] || [];
    const ordered = orderedKeys.map((key) => byKey.get(key)).filter(Boolean);
    const orderedSet = new Set(ordered.map((item) => item.key));
    const rest = withMeta.filter((item) => !orderedSet.has(item.key));
    return [...ordered, ...rest];
  }

  function renderGroup(group, items) {
    // Вешаем обработчики на визуальный редактор custom_rules
    if (group === "algorithm") {
      setTimeout(() => {
        const form = document.getElementById(`settings-form-algorithm`);
        if (!form) return;
        const addBtn = form.querySelector("#custom-rules-add");
        if (addBtn) {
          addBtn.addEventListener("click", () => {
            const textarea = form.elements.namedItem("slug_pricing_custom_rules");
            let arr = [];
            try { arr = JSON.parse(textarea.value || "[]"); } catch { arr = []; }
            arr.push({ pattern: "", type: "contains", delta: 0, label: "" });
            textarea.value = JSON.stringify(arr);
            renderGroup(group, items.map(i => i.key === "slug_pricing_custom_rules" ? { ...i, value: arr } : i));
            updateCurrentFromForm(group);
          });
        }
        const rows = form.querySelectorAll("#custom-rules-rows [data-rule-remove]");
        rows.forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.getAttribute("data-rule-remove"));
            const textarea = form.elements.namedItem("slug_pricing_custom_rules");
            let arr = [];
            try { arr = JSON.parse(textarea.value || "[]"); } catch { arr = []; }
            arr.splice(idx, 1);
            textarea.value = JSON.stringify(arr);
            renderGroup(group, items.map(i => i.key === "slug_pricing_custom_rules" ? { ...i, value: arr } : i));
            updateCurrentFromForm(group);
          });
        });
        // Inline редактирование
        const inputs = form.querySelectorAll("#custom-rules-rows input, #custom-rules-rows select");
        inputs.forEach((input) => {
          input.addEventListener("input", () => {
            updateCurrentFromForm(group);
          });
        });
      }, 0);
    }
    const form = resolveSettingsForm(group);
    if (!(form instanceof HTMLFormElement)) return;
    const preparedItems = prepareGroupItems(group, items);
    state.loaded[group] = preparedItems;
    const current = {};
    preparedItems.forEach((item) => {
      current[item.key] = item.value;
    });
    state.originalByGroup[group] = clone(current);
    state.currentByGroup[group] = clone(current);
    setDirty(group, false);

    form.innerHTML = preparedItems
      .map((item, index) => {
        const sectionTitle =
          item.__section && preparedItems[index - 1]?.__section !== item.__section
            ? `<div class="md:col-span-2 mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600">${esc(item.__section)}</div>`
            : "";
        const description = item.description ? `<div class="mt-1 text-xs text-neutral-500">${esc(item.description)}</div>` : "";
        const reset = `<button type="button" data-settings-reset="${group}:${item.key}" class="mt-1 text-xs font-semibold text-neutral-500 underline">Сбросить</button>`;
        // Визуальный редактор для slug_pricing_custom_rules
        if (item.key === "slug_pricing_custom_rules" && Array.isArray(item.value)) {
          return `${sectionTitle}<label class="block md:col-span-2"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
            <div id="custom-rules-editor" class="rounded-xl bg-neutral-50 border border-neutral-200 p-3 mb-2">
              <table class="min-w-full text-left text-sm">
                <thead class="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th class="px-2 py-1">Паттерн</th>
                    <th class="px-2 py-1">Тип</th>
                    <th class="px-2 py-1">Надбавка</th>
                    <th class="px-2 py-1">Метка</th>
                    <th class="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody id="custom-rules-rows">
                  ${item.value.map((rule, idx) => `
                    <tr data-rule-row="${idx}" class="hover:bg-neutral-100 transition">
                      <td><input type="text" class="border border-neutral-300 rounded-lg px-2 py-1 w-28 focus:border-neutral-500 focus:bg-white transition" data-rule-pattern="${idx}" value="${esc(rule.pattern || "")}" /></td>
                      <td>
                        <select class="border border-neutral-300 rounded-lg px-2 py-1 focus:border-neutral-500 transition" data-rule-type="${idx}">
                          <option value="contains" ${rule.type === "contains" ? "selected" : ""}>Содержит</option>
                          <option value="startsWith" ${rule.type === "startsWith" ? "selected" : ""}>Начинается</option>
                          <option value="endsWith" ${rule.type === "endsWith" ? "selected" : ""}>Заканчивается</option>
                          <option value="regex" ${rule.type === "regex" ? "selected" : ""}>RegExp</option>
                        </select>
                      </td>
                      <td><input type="number" class="border border-neutral-300 rounded-lg px-2 py-1 w-20 focus:border-neutral-500 focus:bg-white transition" data-rule-delta="${idx}" value="${esc(rule.delta || 0)}" /></td>
                      <td><input type="text" class="border border-neutral-300 rounded-lg px-2 py-1 w-32 focus:border-neutral-500 focus:bg-white transition" data-rule-label="${idx}" value="${esc(rule.label || "")}" /></td>
                      <td><button type="button" class="text-rose-600 hover:text-rose-800 font-bold text-lg px-2 py-1 rounded transition" data-rule-remove="${idx}" title="Удалить">✕</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              <button type="button" class="interactive-btn min-h-9 rounded-xl bg-neutral-200 hover:bg-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 mt-2 transition" id="custom-rules-add">Добавить правило</button>
            </div>
            <textarea name="${esc(item.key)}" class="hidden">${esc(JSON.stringify(item.value || []))}</textarea>
            ${description}${reset}
          </label>`;
        }
        if (item.type === "boolean") {
          return `${sectionTitle}<label class="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm md:col-span-2">
            <input type="checkbox" name="${esc(item.key)}" ${item.value ? "checked" : ""} class="mt-1 h-4 w-4 rounded border-neutral-300" />
            <span><span class="font-semibold text-neutral-800">${esc(item.label)}</span>${description}${reset}</span>
          </label>`;
        }
        if (item.type === "json" && Array.isArray(item.value)) {
          return `${sectionTitle}<label class="block md:col-span-2"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
            ${buildArrayEditor(group, item, item.value)}
            <textarea name="${esc(item.key)}" class="hidden">${esc(JSON.stringify(item.value || []))}</textarea>
            ${description}${reset}
          </label>`;
        }
        if (item.type === "textarea" || item.type === "json") {
          return `${sectionTitle}<label class="block md:col-span-2"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
            <textarea name="${esc(item.key)}" rows="3" class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm">${esc(item.type === "json" ? JSON.stringify(item.value ?? null, null, 2) : String(item.value ?? ""))}</textarea>
            ${description}${reset}
          </label>`;
        }
        if (item.type === "datetime" || item.key === "maintenance_release_open_at") {
          return `${sectionTitle}<label class="block"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
            <input type="datetime-local" name="${esc(item.key)}" value="${esc(toDateTimeLocalValue(item.value))}" class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
            ${description}${reset}
          </label>`;
        }
        return `${sectionTitle}<label class="block"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
          <input type="${item.type === "number" ? "number" : "text"}" ${item.type === "number" ? 'step="any"' : ""} name="${esc(item.key)}" value="${esc(item.value ?? "")}" class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          ${description}${reset}
        </label>`;
      })
      .join("");

    form.addEventListener("input", () => updateCurrentFromForm(group));
    form.addEventListener("change", () => updateCurrentFromForm(group));
    form.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const resetTarget = target.getAttribute("data-settings-reset");
      if (resetTarget) {
        event.preventDefault();
        const [, key] = resetTarget.split(":");
        await jsonFetch(`/api/admin/settings/${encodeURIComponent(group)}/reset/${encodeURIComponent(key)}`, { method: "POST" });
        await loadGroup(group, { force: true });
        return;
      }

      const addKey = target.getAttribute("data-array-add");
      if (addKey) {
        event.preventDefault();
        const hidden = form.elements.namedItem(addKey);
        if (!(hidden instanceof HTMLTextAreaElement)) return;
        let arr = [];
        try {
          arr = JSON.parse(hidden.value || "[]");
        } catch {
          arr = [];
        }
        if (!Array.isArray(arr)) arr = [];
        arr.push("");
        hidden.value = JSON.stringify(arr);
        await loadGroup(group, { force: true, override: { [addKey]: arr } });
        return;
      }

      const removeAttr = target.getAttribute("data-array-remove");
      if (removeAttr !== null) {
        event.preventDefault();
        const idx = Number(removeAttr);
        const listNode = target.closest("[data-array-list]");
        if (!(listNode instanceof HTMLElement)) return;
        const arrayKey = listNode.getAttribute("data-array-list");
        if (!arrayKey) return;
        const hidden = form.elements.namedItem(arrayKey);
        if (!(hidden instanceof HTMLTextAreaElement)) return;
        let arr = [];
        try {
          arr = JSON.parse(hidden.value || "[]");
        } catch {
          arr = [];
        }
        if (!Array.isArray(arr)) arr = [];
        if (Number.isFinite(idx) && idx >= 0 && idx < arr.length) {
          arr.splice(idx, 1);
        }
        hidden.value = JSON.stringify(arr);
        await loadGroup(group, { force: true, override: { [arrayKey]: arr } });
      }
    });

    form.querySelectorAll("[data-array-list]").forEach((listNode) => {
      if (!(listNode instanceof HTMLElement) || typeof window.Sortable !== "function") return;
      const key = listNode.getAttribute("data-array-list");
      if (!key) return;
      window.Sortable.create(listNode, {
        handle: ".cursor-move",
        animation: 120,
        onSort: () => {
          const values = Array.from(listNode.querySelectorAll("[data-array-input]")).map((node) => node.value || "");
          const hidden = form.elements.namedItem(key);
          if (hidden instanceof HTMLTextAreaElement) {
            hidden.value = JSON.stringify(values);
            updateCurrentFromForm(group);
          }
        },
      });
    });

    form.querySelectorAll("[data-array-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest("[data-array-list]");
        if (!(row instanceof HTMLElement)) return;
        const key = row.getAttribute("data-array-list");
        if (!key) return;
        const values = Array.from(row.querySelectorAll("[data-array-input]")).map((node) => node.value || "");
        const hidden = form.elements.namedItem(key);
        if (hidden instanceof HTMLTextAreaElement) {
          hidden.value = JSON.stringify(values);
          updateCurrentFromForm(group);
        }
      });
    });
  }

  function toggleSubtab(nextSubtab) {
    Object.entries(panelByGroup).forEach(([name, node]) => {
      if (node instanceof HTMLElement) {
        node.classList.toggle("hidden", name !== nextSubtab);
      }
    });
    document.querySelectorAll("[data-settings-subtab]").forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const active = btn.getAttribute("data-settings-subtab") === nextSubtab;
      btn.classList.toggle("is-active", active);
    });
    state.activeSubtab = nextSubtab;
  }

  async function loadGroup(group, opts = {}) {
    const payload = await jsonFetch(`/api/admin/settings/${encodeURIComponent(group)}`);
    let items = Array.isArray(payload.items) ? payload.items : [];
    if (opts.override && typeof opts.override === "object") {
      items = items.map((item) => (Object.prototype.hasOwnProperty.call(opts.override, item.key) ? { ...item, value: opts.override[item.key] } : item));
    }
    renderGroup(group, items);
    if (group === "algorithm") {
      renderAlgorithmPreview(payload.previewConfig || null);
    }
  }

  function renderAlgorithmPreview(previewConfig) {
    const box = document.getElementById("settings-algorithm-preview");
    const form = document.getElementById("settings-form-algorithm");
    if (!(box instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;
    const fromState = state.currentByGroup.algorithm || {};
    const cfg = {
      basePrice: Number(fromState.slug_base_price || previewConfig?.basePrice || 100000),
      letterSame: Number(fromState.slug_mult_letters_all_same || previewConfig?.lettersAllSame || 5),
      letterSeq: Number(fromState.slug_mult_letters_sequential || previewConfig?.lettersSequential || 3),
      letterPal: Number(fromState.slug_mult_letters_palindrome || previewConfig?.lettersPalindrome || 2),
      letterRnd: Number(fromState.slug_mult_letters_random || previewConfig?.lettersRandom || 1),
      dig000: Number(fromState.slug_mult_digits_zeros || previewConfig?.digitsZeros || 6),
      dig009: Number(fromState.slug_mult_digits_near_zero || previewConfig?.digitsNearZero || 4),
      digSame: Number(fromState.slug_mult_digits_all_same || previewConfig?.digitsAllSame || 4),
      digSeq: Number(fromState.slug_mult_digits_sequential || previewConfig?.digitsSequential || 3),
      digRound: Number(fromState.slug_mult_digits_round || previewConfig?.digitsRound || 2),
      digPal: Number(fromState.slug_mult_digits_palindrome || previewConfig?.digitsPalindrome || 1.5),
      digRnd: Number(fromState.slug_mult_digits_random || previewConfig?.digitsRandom || 1),
    };
    const rows = [
      { slug: "AAA000", l: cfg.letterSame, d: cfg.dig000 },
      { slug: "ZZZ999", l: cfg.letterSame, d: cfg.digSame },
      { slug: "ABC123", l: cfg.letterSeq, d: cfg.digSeq },
      { slug: "ABA001", l: cfg.letterPal, d: cfg.dig009 },
      { slug: "XYZ500", l: cfg.letterSeq, d: cfg.digRound },
      { slug: "ABX374", l: cfg.letterRnd, d: cfg.digRnd },
    ];
    box.innerHTML = `
      <table class="min-w-full text-left text-sm">
        <thead class="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr><th class="px-3 py-2">Slug</th><th class="px-3 py-2">Буквы</th><th class="px-3 py-2">Цифры</th><th class="px-3 py-2">Итого</th></tr>
        </thead>
        <tbody>
          ${rows
        .map((row) => {
          const total = Math.round(cfg.basePrice * row.l * row.d);
          return `<tr class="border-t border-neutral-100"><td class="px-3 py-2 font-mono">${row.slug}</td><td class="px-3 py-2">×${row.l}</td><td class="px-3 py-2">×${row.d}</td><td class="px-3 py-2 font-semibold">${total.toLocaleString("ru-RU")} сум</td></tr>`;
        })
        .join("")}
        </tbody>
      </table>`;
  }

  async function saveGroup(group) {
    updateCurrentFromForm(group);
    const payload = state.currentByGroup[group] || {};
    try {
      const result = await jsonFetch(`/api/admin/settings/${encodeURIComponent(group)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (result.warning) {
        await showAlert(result.warning);
      } else {
        await showAlert("Настройки обновлены");
      }
      await loadGroup(group, { force: true });
    } catch (error) {
      const issues = error?.payload?.issues;
      if (Array.isArray(issues) && issues.length) {
        await showAlert(issues.map((item) => `${item.key}: ${item.message}`).join("\n"));
      } else {
        await showAlert(error.message || "Не удалось сохранить настройки");
      }
    }
  }

  async function loadChanges(page = 1) {
    const table = document.getElementById("settings-changes-table");
    const pager = document.getElementById("settings-changes-pagination");
    const form = document.getElementById("settings-changes-filters");
    if (!(table instanceof HTMLElement) || !(pager instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;
    const group = String(form.elements.namedItem("group")?.value || "");
    const dateFrom = String(form.elements.namedItem("dateFrom")?.value || "");
    const dateTo = String(form.elements.namedItem("dateTo")?.value || "");
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (group) params.set("group", group);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const payload = await jsonFetch(`/api/admin/settings/changes?${params.toString()}`);
    const rows = Array.isArray(payload.items) ? payload.items : [];
    table.innerHTML = rows.length
      ? rows
        .map(
          (row) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${new Date(row.changedAt).toLocaleString("ru-RU")}</td><td class="px-3 py-2">${esc(row.settingKey)}</td><td class="px-3 py-2"><span class="line-clamp-2">${esc(JSON.stringify(row.oldValue))}</span></td><td class="px-3 py-2"><span class="line-clamp-2">${esc(JSON.stringify(row.newValue))}</span></td><td class="px-3 py-2">${esc(row.changedBy || "admin")}</td></tr>`,
        )
        .join("")
      : `<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>`;
    const current = Number(payload.page || 1);
    const totalPages = Math.max(1, Number(payload.totalPages || 1));
    pager.innerHTML = "";
    if (totalPages > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700";
      prev.textContent = "← Назад";
      prev.disabled = current <= 1;
      prev.addEventListener("click", () => void loadChanges(current - 1));
      const next = document.createElement("button");
      next.type = "button";
      next.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700";
      next.textContent = "Вперёд →";
      next.disabled = current >= totalPages;
      next.addEventListener("click", () => void loadChanges(current + 1));
      const label = document.createElement("span");
      label.className = "text-xs text-neutral-500";
      label.textContent = `${current}/${totalPages}`;
      pager.append(prev, label, next);
    }
  }

  function hasAnyDirty() {
    return Object.values(state.dirtyByGroup).some(Boolean);
  }

  document.querySelectorAll("[data-settings-subtab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextSubtab = btn.getAttribute("data-settings-subtab");
      if (!nextSubtab) return;
      if (nextSubtab !== state.activeSubtab && hasAnyDirty()) {
        const ok = await showConfirm("Есть несохранённые изменения. Уйти?");
        if (!ok) return;
      }
      toggleSubtab(nextSubtab);
      if (groups.includes(nextSubtab) && !state.loaded[nextSubtab]) {
        await loadGroup(nextSubtab);
      }
      if (nextSubtab === "changes") {
        await loadChanges(1);
      }
    });
  });

  document.querySelectorAll("[data-settings-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const group = btn.getAttribute("data-settings-save");
      if (!group) return;
      await saveGroup(group);
    });
  });

  document.getElementById("settings-changes-filters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadChanges(1);
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasAnyDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  void (async () => {
    toggleSubtab("pricing");
    for (const group of groups) {
      await loadGroup(group);
    }
    await loadChanges(1);
  })();
})();
