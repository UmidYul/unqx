(function initAdminFeatures() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;
  const tab = body.getAttribute("data-active-tab") || "";
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const showAlert = (message) => {
    if (window.UNQAdminDialog?.alert) {
      return window.UNQAdminDialog.alert(message);
    }
    if (typeof window.alert === "function") {
      window.alert(message);
    }
    return Promise.resolve();
  };
  const showConfirm = (message) => {
    if (window.UNQAdminDialog?.confirm) {
      return window.UNQAdminDialog.confirm(message);
    }
    if (typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(message));
    }
    return Promise.resolve(false);
  };

  const headers = (extra = {}) => ({ ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...extra });
  const P = (v) => `${Number(v || 0).toLocaleString("ru-RU")} сум`;
  const D = (v) => (v ? new Date(v).toLocaleString("ru-RU") : "-");
  const FLASH_CONDITION_TYPES = new Set(["all", "pattern_000", "pattern_aaa", "sequential_digits", "custom"]);
  const SLUG_RE = /^[A-Z]{3}[0-9]{3}$/;
  const FULL_MASK_RE = /^[A-Z0-9*?]{6}$/;
  const LETTER_MASK_RE = /^[A-Z*?]{3}$/;
  const DIGIT_MASK_RE = /^[0-9*?]{3}$/;
  const ICONS = {
    more: '<circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/>',
    eyeOff: '<path d="M3 3 21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" stroke-width="1.8"/><path d="M9 5.3a10.9 10.9 0 0 1 12 6.7s-3.5 6-10 6a10.8 10.8 0 0 1-5-.9" stroke="currentColor" stroke-width="1.8"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/>',
    refresh: '<path d="M20 11a8 8 0 1 0 2 5" stroke="currentColor" stroke-width="1.8"/><path d="M20 4v7h-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    gift: '<path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13" stroke="currentColor" stroke-width="1.8"/><path d="M7.5 7a2.5 2.5 0 1 1 5-2.5V7M16.5 7a2.5 2.5 0 1 0-5-2.5V7" stroke="currentColor" stroke-width="1.8"/>',
    pen: '<path d="m4 20 4-.8L20 7a2.2 2.2 0 0 0-3-3L5 16l-1 4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/>',
    send: '<path d="m3 12 18-8-6 16-3-7-9-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 7l1 12h8l1-12M9 7V5h6v2" stroke="currentColor" stroke-width="1.8"/>',
  };
  const I = (name, size = 16) => `<svg class="admin-i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const kebabButton = () => `<button type="button" class="admin-kebab-btn" data-kebab-toggle aria-label="Действия">${I("more", 16)}</button>`;
  const menuItem = ({ label, icon, attrs = "", danger = false }) => `<button type="button" class="admin-menu-item${danger ? " is-danger" : ""}" ${attrs}>${I(icon, 16)}<span>${label}</span></button>`;
  const menuSeparator = () => '<div class="admin-menu-sep" role="separator"></div>';
  const menuWrap = (content) => `${kebabButton()}<div class="admin-row-menu is-hidden">${content}</div>`;
  const encodeAttr = (value) => encodeURIComponent(String(value == null ? "" : value));
  const decodeAttr = (value) => {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  };
  const toDateInputValue = (value) => {
    const date = new Date(String(value || ""));
    if (!Number.isFinite(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const conditionValueToInput = (conditionValue) => {
    if (!conditionValue || typeof conditionValue !== "object") return "";
    const allowed = Array.isArray(conditionValue.allowedSlugs) ? conditionValue.allowedSlugs : [];
    const masks = Array.isArray(conditionValue.slugPatterns) ? conditionValue.slugPatterns : [];
    return [...allowed, ...masks].join(" ");
  };
  function closeAllRowMenus() {
    document.querySelectorAll(".admin-row-menu").forEach((node) => node.classList.add("is-hidden"));
    document.querySelectorAll("[data-kebab-toggle]").forEach((node) => node.setAttribute("aria-expanded", "false"));
  }

  function tokenizePatternInput(raw) {
    return String(raw || "")
      .split(/[\s,;]+/g)
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  function normalizePatternToken(token) {
    const cleaned = String(token || "")
      .toUpperCase()
      .replace(/[^A-Z0-9*?]/g, "");
    if (!cleaned) return null;
    if (SLUG_RE.test(cleaned)) return { kind: "slug", value: cleaned };
    if (FULL_MASK_RE.test(cleaned)) return { kind: "mask", value: cleaned };
    if (LETTER_MASK_RE.test(cleaned)) return { kind: "mask", value: `${cleaned}***` };
    if (DIGIT_MASK_RE.test(cleaned)) return { kind: "mask", value: `***${cleaned}` };
    return null;
  }

  function buildFlashCustomConditionValue(rawPatternInput) {
    const allowedSlugs = [];
    const slugPatterns = [];
    const seen = new Set();
    let droppedCount = 0;

    for (const token of tokenizePatternInput(rawPatternInput)) {
      const parsed = normalizePatternToken(token);
      if (!parsed) {
        droppedCount += 1;
        continue;
      }
      const key = `${parsed.kind}:${parsed.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (parsed.kind === "slug") {
        allowedSlugs.push(parsed.value);
      } else {
        slugPatterns.push(parsed.value);
      }
    }

    return {
      allowedSlugs,
      slugPatterns,
      droppedCount,
    };
  }

  function resolveFlashConditionLabel(item) {
    const type = String(item?.conditionType || "all");
    if (type === "all") return "Все slug";
    if (type === "pattern_000") return "Slug с 000";
    if (type === "pattern_aaa") return "Slug с одинаковыми буквами";
    if (type === "sequential_digits") return "Slug с последовательными цифрами";
    if (type !== "custom") return "Кастом";
    const value = item?.conditionValue && typeof item.conditionValue === "object" ? item.conditionValue : {};
    const slugPatterns = Array.isArray(value.slugPatterns) ? value.slugPatterns.length : 0;
    const allowedSlugs = Array.isArray(value.allowedSlugs) ? value.allowedSlugs.length : 0;
    if (slugPatterns && allowedSlugs) return `Кастом: ${slugPatterns} маск., ${allowedSlugs} точн. slug`;
    if (slugPatterns) return `Кастом: ${slugPatterns} маск.`;
    if (allowedSlugs) return `Кастом: ${allowedSlugs} точн. slug`;
    return "Кастом";
  }

  function setupFlashCreateForm() {
    const form = document.getElementById("flash-sales-create-form");
    if (!(form instanceof HTMLFormElement)) return;
    const conditionType = form.elements.namedItem("conditionType");
    const customInput = form.elements.namedItem("conditionPatternInput");
    const customWrap = form.querySelector("[data-flash-custom-wrap]");
    if (!(conditionType instanceof HTMLSelectElement) || !(customInput instanceof HTMLTextAreaElement) || !(customWrap instanceof HTMLElement)) {
      return;
    }
    const sync = () => {
      const isCustom = conditionType.value === "custom";
      customWrap.classList.toggle("hidden", !isCustom);
      customInput.disabled = !isCustom;
      customInput.required = isCustom;
      if (!isCustom) customInput.value = "";
    };
    conditionType.addEventListener("change", sync);
    sync();
  }

  async function jsonFetch(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  async function loadLeaderboardAdmin() {
    const table = document.getElementById("leaderboard-table");
    const susp = document.getElementById("leaderboard-suspicious-table");
    const form = document.getElementById("leaderboard-settings-form");
    if (!(table instanceof HTMLElement) || !(susp instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;

    const [board, suspicious] = await Promise.all([
      jsonFetch("/api/admin/leaderboard?period=all"),
      jsonFetch("/api/admin/leaderboard/suspicious"),
    ]);

    const enabled = form.elements.namedItem("enabled");
    const publicLimit = form.elements.namedItem("publicLimit");
    const suspiciousThreshold = form.elements.namedItem("suspiciousThreshold");
    const suspiciousWindowMinutes = form.elements.namedItem("suspiciousWindowMinutes");
    if (enabled instanceof HTMLInputElement) enabled.checked = Boolean(board.settings?.enabled);
    if (publicLimit instanceof HTMLInputElement) publicLimit.value = String(board.settings?.publicLimit || 20);
    if (suspiciousThreshold instanceof HTMLInputElement) suspiciousThreshold.value = String(board.settings?.suspiciousThreshold || 50);
    if (suspiciousWindowMinutes instanceof HTMLInputElement) suspiciousWindowMinutes.value = String(board.settings?.suspiciousWindowMinutes || 10);

    table.innerHTML = (board.items || []).length
      ? board.items
        .map(
          (item) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">#${item.rank}</td><td class="px-4 py-3 font-mono">${item.slug}</td><td class="px-4 py-3">${item.ownerName}</td><td class="px-4 py-3">${Number(item.views || 0).toLocaleString("ru-RU")}</td><td class="px-4 py-3">${item.delta == null ? "—" : item.delta > 0 ? `+${item.delta}` : item.delta < 0 ? `${item.delta}` : "0"}</td><td class="px-4 py-3">${item.plan === "premium" ? "ПРЕМИУМ" : "БАЗОВЫЙ"}</td><td class="px-4 py-3"><div class="admin-row-actions">${menuWrap([
            menuItem({ label: "Исключить из лидерборда", icon: "eyeOff", attrs: `data-a="exclude-lb" data-slug="${item.slug}"` }),
            menuItem({ label: "Сбросить счётчик", icon: "refresh", attrs: `data-a="reset-lb-user" data-tg="${item.ownerTelegramId || ""}"` }),
          ].join(""))}</div></td></tr>`,
        )
        .join("")
      : '<tr><td colspan="7" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';

    susp.innerHTML = (suspicious.items || []).length
      ? suspicious.items
        .map(
          (item) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3 font-mono">${item.fullSlug}</td><td class="px-4 py-3">${item.viewsCount}</td><td class="px-4 py-3">${item.windowMinutes} мин</td><td class="px-4 py-3">${D(item.occurredAt)}</td></tr>`,
        )
        .join("")
      : '<tr><td colspan="4" class="px-4 py-8 text-center text-neutral-500">Нет флагов</td></tr>';
  }

  async function loadReferralsAdmin() {
    const stats = document.getElementById("referrals-stats");
    const table = document.getElementById("referrals-table");
    const ledgerTable = document.getElementById("referrals-ledger-table");
    const settingsForm = document.getElementById("referrals-settings-form");
    const historyFiltersForm = document.getElementById("referrals-history-filters");
    if (!(stats instanceof HTMLElement) || !(table instanceof HTMLElement)) return;

    const [statPayload, rowsPayload, ledgerPayload, settingsPayload] = await Promise.all([
      jsonFetch("/api/admin/referrals/stats"),
      jsonFetch("/api/admin/referrals"),
      jsonFetch("/api/admin/referrals/ledger"),
      jsonFetch("/api/admin/referrals/settings"),
    ]);

    if (settingsForm instanceof HTMLFormElement) {
      const enabled = settingsForm.elements.namedItem("enabled");
      const referrerReward = settingsForm.elements.namedItem("referrerReward");
      const inviteeDiscount = settingsForm.elements.namedItem("inviteeDiscount");
      const discountCapPercent = settingsForm.elements.namedItem("discountCapPercent");
      const defaultPerUserCap = settingsForm.elements.namedItem("defaultPerUserCap");

      if (enabled instanceof HTMLInputElement) enabled.checked = Boolean(settingsPayload.settings?.feature_referrals);
      if (referrerReward instanceof HTMLInputElement) {
        referrerReward.value = String(settingsPayload.settings?.referral_v1_referrer_reward || 50000);
      }
      if (inviteeDiscount instanceof HTMLInputElement) {
        inviteeDiscount.value = String(settingsPayload.settings?.referral_v1_invitee_discount || 100000);
      }
      if (discountCapPercent instanceof HTMLInputElement) {
        discountCapPercent.value = String(settingsPayload.settings?.referral_v1_discount_cap_percent || 30);
      }
      if (defaultPerUserCap instanceof HTMLInputElement) {
        defaultPerUserCap.value = String(settingsPayload.settings?.referral_v2_default_per_user_cap || 1);
      }
    }

    stats.innerHTML = [
      ["Всего конверсий", statPayload.totalRegistrations],
      ["Оплаченные конверсии", `${statPayload.conversionPaid}%`],
      ["Начислено бонусов", P(statPayload.rewardAmount || 0)],
    ]
      .map(([title, value]) => `<article class="rounded-2xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">${title}</p><p class="mt-2 text-2xl font-black">${value}</p></article>`)
      .join("");

    const statusFilterControl = historyFiltersForm instanceof HTMLFormElement ? historyFiltersForm.elements.namedItem("status") : null;
    const selectedStatus = statusFilterControl instanceof HTMLSelectElement ? String(statusFilterControl.value || "all").toLowerCase() : "all";
    const rows = Array.isArray(rowsPayload.items) ? rowsPayload.items : [];
    const filteredRows = selectedStatus === "all"
      ? rows
      : rows.filter((item) => String(item.status || "pending").toLowerCase() === selectedStatus);

    table.innerHTML = filteredRows.length
      ? filteredRows
        .map(
          (item) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${item.referrer?.username ? `@${item.referrer.username}` : item.referrer?.firstName || item.referrerId}</td><td class="px-4 py-3">${item.referred?.username ? `@${item.referred.username}` : item.referred?.firstName || item.referredId}</td><td class="px-4 py-3">${D(item.createdAt)}</td><td class="px-4 py-3">${statusChip(String(item.status || "pending").toLowerCase())}</td><td class="px-4 py-3">${item.refSource || "direct"} / ${item.refOffer || "-"}</td><td class="px-4 py-3">${P(item.rewardAmount || 0)}</td><td class="px-4 py-3"><div class="admin-row-actions">${menuWrap(menuItem({ label: "Начислить вручную", icon: "gift", attrs: `data-a="reward-ref" data-id="${item.id}"` }))}</div></td></tr>`,
        )
        .join("")
      : `<tr><td colspan="7" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("userCheck", 44)}<span>Нет записей по выбранному статусу</span><span class="text-xs text-neutral-400">Измените фильтр или дождитесь новых конверсий.</span></div></td></tr>`;

    if (ledgerTable instanceof HTMLElement) {
      ledgerTable.innerHTML = (ledgerPayload.items || []).length
        ? ledgerPayload.items
          .map(
            (item) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(item.createdAt)}</td><td class="px-4 py-3">${item.user?.username ? `@${item.user.username}` : item.user?.firstName || item.userId}</td><td class="px-4 py-3">${item.direction || "-"}</td><td class="px-4 py-3">${item.kind || "-"}</td><td class="px-4 py-3">${P(item.amount || 0)}</td><td class="px-4 py-3">${P(item.balanceAfter || 0)}</td><td class="px-4 py-3 font-mono text-xs">${item.idempotencyKey || "-"}</td></tr>`,
          )
          .join("")
        : '<tr><td colspan="7" class="px-3 py-8 text-center text-neutral-500">No operations</td></tr>';
    }
  }

  async function loadPromoCodesAdmin() {
    const campaignsTable = document.getElementById("promocodes-campaigns-table");
    const settingsForm = document.getElementById("promocodes-settings-form");
    if (!(campaignsTable instanceof HTMLElement)) return;

    const [settingsPayload, campaignsPayload] = await Promise.all([
      jsonFetch("/api/admin/promocodes/settings"),
      jsonFetch("/api/admin/promocodes"),
    ]);

    if (settingsForm instanceof HTMLFormElement) {
      const promoCodesEnabled = settingsForm.elements.namedItem("promoCodesEnabled");
      const promoFirstOrderOnly = settingsForm.elements.namedItem("promoFirstOrderOnly");
      if (promoCodesEnabled instanceof HTMLInputElement) promoCodesEnabled.checked = settingsPayload.settings?.feature_promo_codes !== undefined ? Boolean(settingsPayload.settings?.feature_promo_codes) : true;
      if (promoFirstOrderOnly instanceof HTMLInputElement) promoFirstOrderOnly.checked = settingsPayload.settings?.promo_codes_first_order_only !== undefined ? Boolean(settingsPayload.settings?.promo_codes_first_order_only) : true;
    }

    campaignsTable.innerHTML = (campaignsPayload.items || []).length
      ? (campaignsPayload.items || [])
          .map((item) => {
            const status = String(item.status || "draft");
            const statusAction = status === "active" ? "paused" : "active";
            const statusLabel = status === "active" ? "Пауза" : "Активировать";
            const statusView = status === "active" ? "Активна" : status === "paused" ? "Пауза" : status === "archived" ? "Архив" : "Черновик";
            const discountType = String(item.discountType || "discount_amount");
            const discountLabel = discountType === "fixed_price" ? "Фикс цена" : "Скидка";
            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3">${item.name || "-"}</td>
              <td class="px-4 py-3 font-mono">${item.code || "-"}</td>
              <td class="px-4 py-3">${statusView}</td>
              <td class="px-4 py-3">${discountLabel} ${P(item.discountValue || 0)}</td>
              <td class="px-4 py-3">${P(item.budgetAmount || 0)}</td>
              <td class="px-4 py-3">${Number(item.perUserCap || 1)}</td>
              <td class="px-4 py-3">${D(item.startsAt)} - ${D(item.endsAt)}</td>
              <td class="px-4 py-3"><div class="admin-row-actions">${menuWrap([
                menuItem({ label: statusLabel, icon: "refresh", attrs: `data-a="promo-status" data-id="${item.id}" data-status="${statusAction}"` }),
                menuItem({
                  label: "Редактировать",
                  icon: "pen",
                  attrs: `data-a="promo-edit" data-id="${item.id}" data-name="${encodeAttr(item.name || "")}" data-promo="${encodeAttr(item.code || "")}" data-status="${encodeAttr(status)}" data-discount-type="${encodeAttr(discountType)}" data-discount-value="${Number(item.discountValue || 0)}" data-budget="${Number(item.budgetAmount || 0)}" data-per-user-cap="${Number(item.perUserCap || 1)}" data-starts-at="${encodeAttr(item.startsAt || "")}" data-ends-at="${encodeAttr(item.endsAt || "")}"`,
                }),
                menuSeparator(),
                menuItem({ label: "Удалить", icon: "trash", attrs: `data-a="promo-delete" data-id="${item.id}"`, danger: true }),
              ].join(""))}</div></td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("gift", 44)}<span>Нет промокодов</span><span class="text-xs text-neutral-400">Создайте первый промокод в форме выше.</span></div></td></tr>`;
  }
  async function loadFlashSalesAdmin() {
    const table = document.getElementById("flash-sales-table");
    if (!(table instanceof HTMLElement)) return;
    const payload = await jsonFetch("/api/admin/flash-sales");
    table.innerHTML = (payload.items || []).length
      ? await Promise.all(
        payload.items.map(async (item) => {
          let stats = { requestsCount: 0, discountSum: 0 };
          try {
            stats = await jsonFetch(`/api/admin/flash-sales/${item.id}/stats`);
          } catch {
            stats = { requestsCount: 0, discountSum: 0 };
          }
          const conditionRaw = encodeAttr(JSON.stringify(item.conditionValue || null));
          return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3"><p class="font-semibold">${item.title}</p><p class="mt-1 text-xs text-neutral-500">${resolveFlashConditionLabel(item)}</p></td><td class="px-4 py-3">-${item.discountPercent}%</td><td class="px-4 py-3">${D(item.startsAt)} - ${D(item.endsAt)}</td><td class="px-4 py-3">${item.isActive ? "Активен" : "Остановлен"}</td><td class="px-4 py-3">${stats.requestsCount} заявок · ${P(stats.discountSum)}</td><td class="px-4 py-3"><div class="admin-row-actions">${menuWrap([
            menuItem({
              label: "Редактировать",
              icon: "pen",
              attrs: `data-a="edit-flash" data-id="${item.id}" data-title="${encodeAttr(item.title || "")}" data-description="${encodeAttr(item.description || "")}" data-discount="${item.discountPercent}" data-condition-type="${encodeAttr(item.conditionType || "all")}" data-condition-value="${conditionRaw}" data-starts-at="${encodeAttr(item.startsAt || "")}" data-ends-at="${encodeAttr(item.endsAt || "")}" data-is-active="${item.isActive ? "1" : "0"}" data-telegram-target="${encodeAttr(item.telegramTarget || "")}"`,
            }),
            menuItem({ label: "Остановить досрочно", icon: "square", attrs: `data-a="stop-flash" data-id="${item.id}"` }),
            menuSeparator(),
            menuItem({ label: "Удалить", icon: "trash", attrs: `data-a="delete-flash" data-id="${item.id}"`, danger: true }),
          ].join(""))}</div></td></tr>`;
        }),
      ).then((rows) => rows.join(""))
      : '<tr><td colspan="6" class="px-3 py-8 text-center text-neutral-500">Нет flash sale</td></tr>';
  }

  async function loadDropsAdmin() {
    const table = document.getElementById("drops-table");
    if (!(table instanceof HTMLElement)) return;
    const payload = await jsonFetch("/api/admin/drops");

    table.innerHTML = await Promise.all(
      (payload.items || []).map(async (item) => {
        let live = { sold: 0, total: item.slugCount || 0 };
        try {
          live = await jsonFetch(`/api/admin/drops/${item.id}/live`);
        } catch {
          // noop
        }
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${item.title}</td><td class="px-4 py-3">${D(item.dropAt)}</td><td class="px-4 py-3">${item.slugCount}</td><td class="px-4 py-3">${item.isLive ? "LIVE" : item.isFinished ? "Завершён" : "Ожидается"}</td><td class="px-4 py-3">Продано ${live.sold || 0} из ${live.total || item.slugCount}</td><td class="px-4 py-3"><div class="admin-row-actions">${menuWrap([
          menuItem({
            label: "Редактировать",
            icon: "pen",
            attrs: `data-a="edit-drop" data-id="${item.id}" data-title="${encodeAttr(item.title || "")}" data-description="${encodeAttr(item.description || "")}" data-drop-at="${encodeAttr(item.dropAt || "")}" data-telegram-target="${encodeAttr(item.telegramTarget || "")}"`,
          }),
          menuItem({ label: "Завершить досрочно", icon: "square", attrs: `data-a="finish-drop" data-id="${item.id}"` }),
          menuItem({ label: "Отправить уведомление вручную", icon: "send", attrs: `data-a="notify-drop" data-id="${item.id}"` }),
          menuSeparator(),
          menuItem({ label: "Удалить", icon: "trash", attrs: `data-a="delete-drop" data-id="${item.id}"`, danger: true }),
        ].join(""))}</div></td></tr>`;
      }),
    ).then((rows) => rows.join(""));
  }

  document.getElementById("leaderboard-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const enabled = form.elements.namedItem("enabled");
    const publicLimit = form.elements.namedItem("publicLimit");
    const suspiciousThreshold = form.elements.namedItem("suspiciousThreshold");
    const suspiciousWindowMinutes = form.elements.namedItem("suspiciousWindowMinutes");
    await jsonFetch("/api/admin/leaderboard/settings", {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        enabled: enabled instanceof HTMLInputElement ? enabled.checked : true,
        publicLimit: publicLimit instanceof HTMLInputElement ? Number(publicLimit.value || 20) : 20,
        suspiciousThreshold: suspiciousThreshold instanceof HTMLInputElement ? Number(suspiciousThreshold.value || 50) : 50,
        suspiciousWindowMinutes: suspiciousWindowMinutes instanceof HTMLInputElement ? Number(suspiciousWindowMinutes.value || 10) : 10,
      }),
    });
    await loadLeaderboardAdmin();
  });

  document.getElementById("referrals-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const enabled = form.elements.namedItem("enabled");
    const referrerReward = form.elements.namedItem("referrerReward");
    const inviteeDiscount = form.elements.namedItem("inviteeDiscount");
    const discountCapPercent = form.elements.namedItem("discountCapPercent");
    const defaultPerUserCap = form.elements.namedItem("defaultPerUserCap");
    await jsonFetch("/api/admin/referrals/settings", {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        enabled: enabled instanceof HTMLInputElement ? enabled.checked : true,
        referrerReward: referrerReward instanceof HTMLInputElement ? Number(referrerReward.value || 0) : 0,
        inviteeDiscount: inviteeDiscount instanceof HTMLInputElement ? Number(inviteeDiscount.value || 0) : 0,
        discountCapPercent: discountCapPercent instanceof HTMLInputElement ? Number(discountCapPercent.value || 0) : 0,
        defaultPerUserCap: defaultPerUserCap instanceof HTMLInputElement ? Number(defaultPerUserCap.value || 1) : 1,
      }),
    });
    await loadReferralsAdmin();
  });

  document.getElementById("promocodes-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const promoCodesEnabled = form.elements.namedItem("promoCodesEnabled");
    const promoFirstOrderOnly = form.elements.namedItem("promoFirstOrderOnly");
    await jsonFetch("/api/admin/promocodes/settings", {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        promoCodesEnabled: promoCodesEnabled instanceof HTMLInputElement ? promoCodesEnabled.checked : true,
        promoFirstOrderOnly: promoFirstOrderOnly instanceof HTMLInputElement ? promoFirstOrderOnly.checked : true,
      }),
    });
    await loadPromoCodesAdmin();
  });

  document.getElementById("promocodes-campaign-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const fd = new FormData(form);
    await jsonFetch("/api/admin/promocodes", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: String(fd.get("name") || "").trim(),
        promoCode: String(fd.get("promoCode") || "").trim().toUpperCase(),
        status: String(fd.get("status") || "draft").trim().toLowerCase(),
        discountType: String(fd.get("discountType") || "discount_amount").trim().toLowerCase(),
        discountValue: Number(fd.get("discountValue") || 0),
        budgetAmount: Number(fd.get("budgetAmount") || 0),
        perUserCap: Number(fd.get("perUserCap") || 1),
        startsAt: fd.get("startsAt") ? new Date(String(fd.get("startsAt"))).toISOString() : null,
        endsAt: fd.get("endsAt") ? new Date(String(fd.get("endsAt"))).toISOString() : null,
      }),
    });
    form.reset();
    await loadPromoCodesAdmin();
  });

  document.getElementById("referrals-history-filters")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadReferralsAdmin();
  });

  document.getElementById("flash-sales-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const fd = new FormData(form);
    const conditionType = String(fd.get("conditionType") || "all");
    if (!FLASH_CONDITION_TYPES.has(conditionType)) {
      await showAlert("Некорректный тип условия flash sale");
      return;
    }

    let conditionValue = null;
    if (conditionType === "custom") {
      const customRaw = String(fd.get("conditionPatternInput") || "");
      if (!customRaw.trim()) {
        await showAlert("Add at least one custom rule");
        return;
      }
      conditionValue = {
        matchMode: String(fd.get("conditionMatchMode") || "any"),
        patternsInput: customRaw,
      };
    }

    await jsonFetch("/api/admin/flash-sales", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || ""),
        discountPercent: Number(fd.get("discountPercent") || 0),
        conditionType,
        conditionValue,
        startsAt: new Date(String(fd.get("startsAt") || "")).toISOString(),
        endsAt: new Date(String(fd.get("endsAt") || "")).toISOString(),
        notifyTelegram: fd.get("notifyTelegram") === "on",
        telegramTarget: String(fd.get("telegramTarget") || ""),
      }),
    });
    form.reset();
    await loadFlashSalesAdmin();
  });

  document.getElementById("drops-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const fd = new FormData(form);
    await jsonFetch("/api/admin/drops", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || ""),
        dropAt: new Date(String(fd.get("dropAt") || "")).toISOString(),
        slugCount: Number(fd.get("slugCount") || 1),
        slugPatternType: String(fd.get("slugPatternType") || "random"),
        manualSlugs: String(fd.get("manualSlugs") || ""),
        notifyTelegram: fd.get("notifyTelegram") === "on",
        telegramTarget: String(fd.get("telegramTarget") || ""),
      }),
    });
    form.reset();
    await loadDropsAdmin();
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-a]") : null;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-a");

    try {
      if (action === "exclude-lb") {
        const slug = target.getAttribute("data-slug");
        if (!slug) return;
        await jsonFetch(`/api/admin/leaderboard/exclusions/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ excluded: true, reason: "manual" }),
        });
        await loadLeaderboardAdmin();
      }
      if (action === "reset-lb-user") {
        const telegramId = target.getAttribute("data-tg");
        if (!telegramId) return;
        await jsonFetch(`/api/admin/leaderboard/reset-user/${encodeURIComponent(telegramId)}`, {
          method: "POST",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        await loadLeaderboardAdmin();
      }
      if (action === "reward-ref") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        await jsonFetch(`/api/admin/referrals/${encodeURIComponent(id)}/reward`, {
          method: "POST",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ amount: 50000 }),
        });
        await loadReferralsAdmin();
      }
      if (action === "promo-status") {
        const id = target.getAttribute("data-id");
        const status = target.getAttribute("data-status");
        if (!id || !status) return;
        await jsonFetch(`/api/admin/promocodes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status }),
        });
        await loadPromoCodesAdmin();
      }
      if (action === "promo-delete") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        const ok = await showConfirm("Удалить промокод без возможности восстановления?");
        if (!ok) return;
        await jsonFetch(`/api/admin/promocodes/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        await loadPromoCodesAdmin();
      }
      if (action === "promo-edit") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        const currentName = decodeAttr(target.getAttribute("data-name"));
        const currentPromo = decodeAttr(target.getAttribute("data-promo"));
        const currentStatus = decodeAttr(target.getAttribute("data-status")) || "draft";
        const currentDiscountType = decodeAttr(target.getAttribute("data-discount-type")) || "discount_amount";
        const currentDiscountValue = Number(target.getAttribute("data-discount-value") || 0);
        const currentBudget = Number(target.getAttribute("data-budget") || 0);
        const currentPerUserCap = Number(target.getAttribute("data-per-user-cap") || 1);
        const currentStartsAt = toDateInputValue(decodeAttr(target.getAttribute("data-starts-at")));
        const currentEndsAt = toDateInputValue(decodeAttr(target.getAttribute("data-ends-at")));

        const nextName = window.prompt("Название промокода", currentName);
        if (nextName == null) return;
        const nextPromo = window.prompt("Промокод", currentPromo);
        if (nextPromo == null) return;
        const nextStatus = window.prompt("Статус: draft|active|paused|archived", currentStatus);
        if (nextStatus == null) return;
        const nextDiscountType = window.prompt("Тип скидки: discount_amount | fixed_price", currentDiscountType);
        if (nextDiscountType == null) return;
        const nextDiscountValueRaw = window.prompt("Значение скидки/цены (сум)", String(currentDiscountValue));
        if (nextDiscountValueRaw == null) return;
        const nextBudgetRaw = window.prompt("Бюджет кампании", String(currentBudget));
        if (nextBudgetRaw == null) return;
        const nextPerUserCapRaw = window.prompt("Лимит на пользователя", String(currentPerUserCap));
        if (nextPerUserCapRaw == null) return;
        const nextStartsAt = window.prompt("Дата начала (YYYY-MM-DDTHH:mm или пусто)", currentStartsAt);
        if (nextStartsAt == null) return;
        const nextEndsAt = window.prompt("Дата конца (YYYY-MM-DDTHH:mm или пусто)", currentEndsAt);
        if (nextEndsAt == null) return;

        await jsonFetch(`/api/admin/promocodes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            name: String(nextName || "").trim(),
            promoCode: String(nextPromo || "").trim().toUpperCase(),
            status: String(nextStatus || "").trim().toLowerCase(),
            discountType: String(nextDiscountType || "").trim().toLowerCase(),
            discountValue: Number(nextDiscountValueRaw || 0),
            budgetAmount: Number(nextBudgetRaw || 0),
            perUserCap: Number(nextPerUserCapRaw || 1),
            startsAt: String(nextStartsAt || "").trim() ? new Date(String(nextStartsAt)).toISOString() : null,
            endsAt: String(nextEndsAt || "").trim() ? new Date(String(nextEndsAt)).toISOString() : null,
          }),
        });
        await loadPromoCodesAdmin();
      }
      if (action === "stop-flash") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        await jsonFetch(`/api/admin/flash-sales/${encodeURIComponent(id)}/stop`, {
          method: "POST",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        await loadFlashSalesAdmin();
      }
      if (action === "edit-flash") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        const currentTitle = decodeAttr(target.getAttribute("data-title"));
        const currentDescription = decodeAttr(target.getAttribute("data-description"));
        const currentDiscount = Number(target.getAttribute("data-discount") || 0);
        const currentType = decodeAttr(target.getAttribute("data-condition-type")) || "all";
        const currentStartsAt = toDateInputValue(decodeAttr(target.getAttribute("data-starts-at")));
        const currentEndsAt = toDateInputValue(decodeAttr(target.getAttribute("data-ends-at")));
        const currentIsActive = target.getAttribute("data-is-active") === "1";
        const currentTelegramTarget = decodeAttr(target.getAttribute("data-telegram-target"));
        let conditionValueRaw = decodeAttr(target.getAttribute("data-condition-value"));
        let conditionValue = null;
        try {
          conditionValue = conditionValueRaw ? JSON.parse(conditionValueRaw) : null;
        } catch {
          conditionValue = null;
        }

        const nextTitle = window.prompt("Название flash sale", currentTitle);
        if (nextTitle == null) return;
        const nextDescription = window.prompt("Описание flash sale", currentDescription);
        if (nextDescription == null) return;
        const nextDiscountRaw = window.prompt("Скидка в процентах (1-95)", String(currentDiscount));
        if (nextDiscountRaw == null) return;
        const nextDiscount = Number(nextDiscountRaw);
        if (!Number.isFinite(nextDiscount)) {
          await showAlert("Некорректная скидка");
          return;
        }
        const nextType = (window.prompt("Тип условия: all | pattern_000 | pattern_aaa | sequential_digits | custom", currentType) || "").trim();
        if (!FLASH_CONDITION_TYPES.has(nextType)) {
          await showAlert("Некорректный тип условия");
          return;
        }
        let nextConditionValue = null;
        if (nextType === "custom") {
          const currentPatternInput = conditionValueToInput(conditionValue);
          const nextPatternInput = window.prompt("Кастомные slug/маски через пробел или запятую", currentPatternInput);
          if (nextPatternInput == null) return;
          if (!nextPatternInput.trim()) {
            await showAlert("Add at least one custom rule");
            return;
          }
          const currentMode = String(conditionValue?.matchMode || "any").toLowerCase() === "all" ? "all" : "any";
          const nextModeRaw = window.prompt("Mode: any | all", currentMode);
          if (nextModeRaw == null) return;
          const nextMode = String(nextModeRaw || "").trim().toLowerCase() === "all" ? "all" : "any";
          nextConditionValue = {
            matchMode: nextMode,
            patternsInput: nextPatternInput,
          };
        }
        const nextStartsAt = window.prompt("Дата старта (YYYY-MM-DDTHH:mm)", currentStartsAt);
        if (nextStartsAt == null) return;
        const nextEndsAt = window.prompt("Дата окончания (YYYY-MM-DDTHH:mm)", currentEndsAt);
        if (nextEndsAt == null) return;
        const nextActiveRaw = window.prompt("Активность: 1 = активен, 0 = остановлен", currentIsActive ? "1" : "0");
        if (nextActiveRaw == null) return;
        const nextTelegramTarget = window.prompt("Telegram target (опционально)", currentTelegramTarget);
        if (nextTelegramTarget == null) return;

        await jsonFetch(`/api/admin/flash-sales/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: nextTitle.trim(),
            description: nextDescription.trim(),
            discountPercent: nextDiscount,
            conditionType: nextType,
            conditionValue: nextConditionValue,
            startsAt: new Date(nextStartsAt).toISOString(),
            endsAt: new Date(nextEndsAt).toISOString(),
            isActive: String(nextActiveRaw).trim() !== "0",
            telegramTarget: String(nextTelegramTarget || "").trim(),
          }),
        });
        await loadFlashSalesAdmin();
      }
      if (action === "delete-flash") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        const ok = await showConfirm("Удалить flash sale? Действие необратимо.");
        if (!ok) return;
        await jsonFetch(`/api/admin/flash-sales/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        await loadFlashSalesAdmin();
      }
      if (action === "finish-drop") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        await jsonFetch(`/api/admin/drops/${encodeURIComponent(id)}/finish`, {
          method: "POST",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        await loadDropsAdmin();
      }
      if (action === "edit-drop") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        const currentTitle = decodeAttr(target.getAttribute("data-title"));
        const currentDescription = decodeAttr(target.getAttribute("data-description"));
        const currentDropAt = toDateInputValue(decodeAttr(target.getAttribute("data-drop-at")));
        const currentTelegramTarget = decodeAttr(target.getAttribute("data-telegram-target"));

        const nextTitle = window.prompt("Название дропа", currentTitle);
        if (nextTitle == null) return;
        const nextDescription = window.prompt("Описание дропа", currentDescription);
        if (nextDescription == null) return;
        const nextDropAt = window.prompt("Дата дропа (YYYY-MM-DDTHH:mm)", currentDropAt);
        if (nextDropAt == null) return;
        const nextTelegramTarget = window.prompt("Telegram target (опционально)", currentTelegramTarget);
        if (nextTelegramTarget == null) return;

        await jsonFetch(`/api/admin/drops/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: nextTitle.trim(),
            description: nextDescription.trim(),
            dropAt: new Date(nextDropAt).toISOString(),
            telegramTarget: String(nextTelegramTarget || "").trim(),
          }),
        });
        await loadDropsAdmin();
      }
      if (action === "delete-drop") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        const ok = await showConfirm("Удалить дроп? Действие необратимо.");
        if (!ok) return;
        await jsonFetch(`/api/admin/drops/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
        await loadDropsAdmin();
      }
      if (action === "notify-drop") {
        const id = target.getAttribute("data-id");
        if (!id) return;
        await jsonFetch(`/api/admin/drops/${encodeURIComponent(id)}/notify-manual`, {
          method: "POST",
          headers: headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
      }
    } catch (error) {
      showAlert(error.message || "Ошибка");
    } finally {
      closeAllRowMenus();
    }
  });

  if (tab === "leaderboard") void loadLeaderboardAdmin();
  if (tab === "referrals") void loadReferralsAdmin();
  if (tab === "promocodes") void loadPromoCodesAdmin();
  if (tab === "flash-sales") void loadFlashSalesAdmin();
  if (tab === "drops") void loadDropsAdmin();
  setupFlashCreateForm();
})();



