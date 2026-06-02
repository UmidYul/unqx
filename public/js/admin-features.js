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
  const flashEditModal = document.getElementById("flash-sale-edit-modal");
  const flashEditForm = document.getElementById("flash-sale-edit-form");
  let flashEditLastFocused = null;
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

  function conditionValueToFormParts(conditionValue) {
    const value = conditionValue && typeof conditionValue === "object" ? conditionValue : {};
    const includeRules = Array.isArray(value.includeRules) ? value.includeRules : [];
    const excludeRules = Array.isArray(value.excludeRules) ? value.excludeRules : [];
    const includeTokens = includeRules
      .map((rule) => {
        if (!rule || typeof rule !== "object") return "";
        if (rule.type === "slug" || rule.type === "mask") return String(rule.value || "").trim();
        return `${String(rule.type || "").trim()}:${String(rule.value || "").trim()}`;
      })
      .filter(Boolean);
    const excludeTokens = excludeRules
      .map((rule) => {
        if (!rule || typeof rule !== "object") return "";
        if (rule.type === "slug" || rule.type === "mask") return String(rule.value || "").trim();
        return `${String(rule.type || "").trim()}:${String(rule.value || "").trim()}`;
      })
      .filter(Boolean);
    return {
      matchMode: String(value.matchMode || "any").trim().toLowerCase() === "all" ? "all" : "any",
      includeInput: includeTokens.join("\n"),
      excludeInput: excludeTokens.join("\n"),
    };
  }

  function buildFlashCustomConditionValue(includeInput, excludeInput, matchMode) {
    const includeTokens = tokenizePatternInput(includeInput);
    const excludeTokens = tokenizePatternInput(excludeInput).map((token) =>
      token.startsWith("!") || token.startsWith("-") ? token : `!${token}`,
    );
    if (!includeTokens.length) {
      throw new Error("Для custom-условия укажите хотя бы одно правило участия.");
    }
    return {
      matchMode: String(matchMode || "any").trim().toLowerCase() === "all" ? "all" : "any",
      patternsInput: [...includeTokens, ...excludeTokens].join("\n"),
    };
  }

  function resolveFlashConditionLabel(item) {
    const type = String(item?.conditionType || "all");
    if (type === "all") return "Все UNQ";
    if (type === "pattern_000") return "UNQ с цифрами 000";
    if (type === "pattern_aaa") return "UNQ с одинаковыми буквами";
    if (type === "sequential_digits") return "UNQ с последовательными цифрами";
    if (type !== "custom") return "Кастом";
    const value = item?.conditionValue && typeof item.conditionValue === "object" ? item.conditionValue : {};
    const includeRules = Array.isArray(value.includeRules) ? value.includeRules.length : 0;
    const excludeRules = Array.isArray(value.excludeRules) ? value.excludeRules.length : 0;
    if (includeRules && excludeRules) return `Кастом: ${includeRules} правил, ${excludeRules} исключений`;
    if (includeRules) return `Кастом: ${includeRules} правил`;
    return "Кастом";
  }

  function resolveFlashStatusMeta(item) {
    const now = Date.now();
    const startsAt = new Date(item?.startsAt || "").getTime();
    const endsAt = new Date(item?.endsAt || "").getTime();
    if (!item?.isActive) {
      return { label: "Остановлен", chipClass: "is-danger" };
    }
    if (Number.isFinite(endsAt) && endsAt <= now) {
      return { label: "Завершён", chipClass: "is-muted" };
    }
    if (Number.isFinite(startsAt) && startsAt > now) {
      return { label: "Запланирован", chipClass: "is-info" };
    }
    return { label: "Активен", chipClass: "is-success" };
  }

  function syncFlashFormState(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const conditionType = form.elements.namedItem("conditionType");
    const includeInput = form.elements.namedItem("conditionIncludeInput");
    const excludeInput = form.elements.namedItem("conditionExcludeInput");
    const matchMode = form.elements.namedItem("conditionMatchMode");
    const notifyTelegram = form.elements.namedItem("notifyTelegram");
    const telegramTarget = form.elements.namedItem("telegramTarget");
    const customWrap = form.querySelector("[data-flash-custom-wrap]");
    if (!(conditionType instanceof HTMLSelectElement) || !(customWrap instanceof HTMLElement)) {
      return;
    }

    const isCustom = conditionType.value === "custom";
    customWrap.classList.toggle("hidden", !isCustom);
    if (includeInput instanceof HTMLTextAreaElement) {
      includeInput.disabled = !isCustom;
      includeInput.required = isCustom;
    }
    if (excludeInput instanceof HTMLTextAreaElement) {
      excludeInput.disabled = !isCustom;
    }
    if (matchMode instanceof HTMLSelectElement) {
      matchMode.disabled = !isCustom;
    }
    if (telegramTarget instanceof HTMLInputElement && notifyTelegram instanceof HTMLInputElement) {
      telegramTarget.disabled = !notifyTelegram.checked;
    }
  }

  function bindFlashForm(form) {
    if (!(form instanceof HTMLFormElement) || form.dataset.flashFormBound === "1") return;
    form.dataset.flashFormBound = "1";
    const conditionType = form.elements.namedItem("conditionType");
    const notifyTelegram = form.elements.namedItem("notifyTelegram");
    if (conditionType instanceof HTMLSelectElement) {
      conditionType.addEventListener("change", () => syncFlashFormState(form));
    }
    if (notifyTelegram instanceof HTMLInputElement) {
      notifyTelegram.addEventListener("change", () => syncFlashFormState(form));
    }
    syncFlashFormState(form);
  }

  function resetFlashForm(form) {
    if (!(form instanceof HTMLFormElement)) return;
    form.reset();
    const isActive = form.elements.namedItem("isActive");
    if (isActive instanceof HTMLInputElement) {
      isActive.checked = true;
    }
    syncFlashFormState(form);
  }

  function buildFlashSalePayload(form) {
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Форма акции не найдена.");
    }
    const fd = new FormData(form);
    const conditionType = String(fd.get("conditionType") || "all").trim();
    if (!FLASH_CONDITION_TYPES.has(conditionType)) {
      throw new Error("Некорректный тип условия flash sale");
    }

    const startsAtRaw = String(fd.get("startsAt") || "").trim();
    const endsAtRaw = String(fd.get("endsAt") || "").trim();
    const startsAt = new Date(startsAtRaw);
    const endsAt = new Date(endsAtRaw);
    if (!startsAtRaw || !Number.isFinite(startsAt.getTime())) {
      throw new Error("Укажите корректную дату старта.");
    }
    if (!endsAtRaw || !Number.isFinite(endsAt.getTime())) {
      throw new Error("Укажите корректную дату окончания.");
    }

    let conditionValue = null;
    if (conditionType === "custom") {
      conditionValue = buildFlashCustomConditionValue(
        String(fd.get("conditionIncludeInput") || ""),
        String(fd.get("conditionExcludeInput") || ""),
        String(fd.get("conditionMatchMode") || "any"),
      );
    }

    return {
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim(),
      discountPercent: Number(fd.get("discountPercent") || 0),
      conditionType,
      conditionValue,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      isActive: fd.get("isActive") === "on",
      notifyTelegram: fd.get("notifyTelegram") === "on",
      telegramTarget: String(fd.get("telegramTarget") || "").trim(),
    };
  }

  function openFlashEditModal(data) {
    if (!(flashEditModal instanceof HTMLElement) || !(flashEditForm instanceof HTMLFormElement)) {
      return;
    }
    const conditionValue = data?.conditionValue && typeof data.conditionValue === "object" ? data.conditionValue : null;
    const parts = conditionValueToFormParts(conditionValue);
    flashEditLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const id = flashEditForm.elements.namedItem("id");
    const title = flashEditForm.elements.namedItem("title");
    const description = flashEditForm.elements.namedItem("description");
    const discountPercent = flashEditForm.elements.namedItem("discountPercent");
    const conditionType = flashEditForm.elements.namedItem("conditionType");
    const conditionMatchMode = flashEditForm.elements.namedItem("conditionMatchMode");
    const conditionIncludeInput = flashEditForm.elements.namedItem("conditionIncludeInput");
    const conditionExcludeInput = flashEditForm.elements.namedItem("conditionExcludeInput");
    const startsAt = flashEditForm.elements.namedItem("startsAt");
    const endsAt = flashEditForm.elements.namedItem("endsAt");
    const isActive = flashEditForm.elements.namedItem("isActive");
    const notifyTelegram = flashEditForm.elements.namedItem("notifyTelegram");
    const telegramTarget = flashEditForm.elements.namedItem("telegramTarget");

    if (id instanceof HTMLInputElement) id.value = String(data?.id || "");
    if (title instanceof HTMLInputElement) title.value = String(data?.title || "");
    if (description instanceof HTMLInputElement || description instanceof HTMLTextAreaElement) {
      description.value = String(data?.description || "");
    }
    if (discountPercent instanceof HTMLInputElement) discountPercent.value = String(Number(data?.discountPercent || 0));
    if (conditionType instanceof HTMLSelectElement) conditionType.value = String(data?.conditionType || "all");
    if (conditionMatchMode instanceof HTMLSelectElement) conditionMatchMode.value = parts.matchMode;
    if (conditionIncludeInput instanceof HTMLTextAreaElement) conditionIncludeInput.value = parts.includeInput;
    if (conditionExcludeInput instanceof HTMLTextAreaElement) conditionExcludeInput.value = parts.excludeInput;
    if (startsAt instanceof HTMLInputElement) startsAt.value = toDateInputValue(data?.startsAt);
    if (endsAt instanceof HTMLInputElement) endsAt.value = toDateInputValue(data?.endsAt);
    if (isActive instanceof HTMLInputElement) isActive.checked = Boolean(data?.isActive);
    if (notifyTelegram instanceof HTMLInputElement) notifyTelegram.checked = Boolean(data?.notifyTelegram);
    if (telegramTarget instanceof HTMLInputElement) telegramTarget.value = String(data?.telegramTarget || "");

    bindFlashForm(flashEditForm);
    syncFlashFormState(flashEditForm);
    flashEditModal.classList.remove("hidden");
    flashEditModal.classList.add("flex");
    flashEditModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      title instanceof HTMLInputElement && title.focus();
    }, 0);
  }

  function closeFlashEditModal() {
    if (!(flashEditModal instanceof HTMLElement) || !(flashEditForm instanceof HTMLFormElement)) {
      return;
    }
    flashEditModal.classList.remove("flex");
    flashEditModal.classList.add("hidden");
    flashEditModal.setAttribute("aria-hidden", "true");
    flashEditForm.reset();
    syncFlashFormState(flashEditForm);
    if (flashEditLastFocused instanceof HTMLElement && document.contains(flashEditLastFocused)) {
      flashEditLastFocused.focus();
    }
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
            const discountLabel =
              discountType === "fixed_price"
                ? `Фикс цена ${P(item.discountValue || 0)}`
                : discountType === "discount_percent"
                ? `Скидка ${Number(item.discountValue || 0)}%`
                : `Скидка ${P(item.discountValue || 0)}`;
            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3">${item.name || "-"}</td>
              <td class="px-4 py-3 font-mono">${item.code || "-"}</td>
              <td class="px-4 py-3">${statusView}</td>
              <td class="px-4 py-3">${discountLabel}</td>
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
          const statusMeta = resolveFlashStatusMeta(item);
          const conditionRaw = encodeAttr(JSON.stringify(item.conditionValue || null));
          return `<tr class="admin-table-row border-t border-neutral-100">
            <td class="px-4 py-3">
              <p class="font-semibold text-neutral-900">${item.title}</p>
              <p class="mt-1 text-xs text-neutral-500">${resolveFlashConditionLabel(item)}</p>
              ${item.description ? `<p class="mt-2 max-w-[320px] text-xs text-neutral-500">${item.description}</p>` : ""}
            </td>
            <td class="px-4 py-3 font-semibold text-neutral-900">-${item.discountPercent}%</td>
            <td class="px-4 py-3 text-neutral-700">${D(item.startsAt)} - ${D(item.endsAt)}</td>
            <td class="px-4 py-3">
              <span class="admin-status-chip ${statusMeta.chipClass}">
                <span class="admin-status-dot"></span>
                <span>${statusMeta.label}</span>
              </span>
            </td>
            <td class="px-4 py-3 text-neutral-700">${stats.requestsCount} заявок · ${P(stats.discountSum)}</td>
            <td class="px-4 py-3"><div class="admin-row-actions">${menuWrap([
            menuItem({
              label: "Редактировать",
              icon: "pen",
              attrs: `data-a="edit-flash" data-id="${item.id}" data-title="${encodeAttr(item.title || "")}" data-description="${encodeAttr(item.description || "")}" data-discount="${item.discountPercent}" data-condition-type="${encodeAttr(item.conditionType || "all")}" data-condition-value="${conditionRaw}" data-starts-at="${encodeAttr(item.startsAt || "")}" data-ends-at="${encodeAttr(item.endsAt || "")}" data-is-active="${item.isActive ? "1" : "0"}" data-notify-telegram="${item.notifyTelegram ? "1" : "0"}" data-telegram-target="${encodeAttr(item.telegramTarget || "")}"`,
            }),
            menuItem({ label: "Остановить досрочно", icon: "square", attrs: `data-a="stop-flash" data-id="${item.id}"` }),
            menuSeparator(),
            menuItem({ label: "Удалить", icon: "trash", attrs: `data-a="delete-flash" data-id="${item.id}"`, danger: true }),
          ].join(""))}</div></td>
          </tr>`;
        }),
      ).then((rows) => rows.join(""))
      : '<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2"><span class="text-sm font-semibold text-neutral-700">Нет flash sale</span><span class="text-xs text-neutral-400">Создайте первую акцию в builder выше.</span></div></td></tr>';
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
    try {
      const payload = buildFlashSalePayload(form);
      await jsonFetch("/api/admin/flash-sales", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      resetFlashForm(form);
      await loadFlashSalesAdmin();
    } catch (error) {
      await showAlert(error.message || "Не удалось создать flash sale.");
    }
  });

  flashEditForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const id = form.elements.namedItem("id");
    if (!(id instanceof HTMLInputElement) || !id.value.trim()) {
      await showAlert("Не удалось определить акцию для редактирования.");
      return;
    }
    try {
      const payload = buildFlashSalePayload(form);
      await jsonFetch(`/api/admin/flash-sales/${encodeURIComponent(id.value.trim())}`, {
        method: "PATCH",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      closeFlashEditModal();
      await loadFlashSalesAdmin();
    } catch (error) {
      await showAlert(error.message || "Не удалось сохранить flash sale.");
    }
  });

  document.getElementById("flash-sale-edit-close-btn")?.addEventListener("click", () => {
    closeFlashEditModal();
  });

  document.getElementById("flash-sale-edit-cancel")?.addEventListener("click", () => {
    closeFlashEditModal();
  });

  flashEditModal?.addEventListener("click", (event) => {
    if (event.target === flashEditModal) {
      closeFlashEditModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && flashEditModal instanceof HTMLElement && !flashEditModal.classList.contains("hidden")) {
      closeFlashEditModal();
    }
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
        const nextDiscountType = window.prompt("Тип скидки: discount_amount | fixed_price | discount_percent", currentDiscountType);
        if (nextDiscountType == null) return;
        const nextDiscountValueRaw = window.prompt("Значение скидки/цены (сум или %)", String(currentDiscountValue));
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
        const currentNotifyTelegram = target.getAttribute("data-notify-telegram") === "1";
        let conditionValueRaw = decodeAttr(target.getAttribute("data-condition-value"));
        let conditionValue = null;
        try {
          conditionValue = conditionValueRaw ? JSON.parse(conditionValueRaw) : null;
        } catch {
          conditionValue = null;
        }
        openFlashEditModal({
          id,
          title: decodeAttr(target.getAttribute("data-title")),
          description: decodeAttr(target.getAttribute("data-description")),
          discountPercent: Number(target.getAttribute("data-discount") || 0),
          conditionType: decodeAttr(target.getAttribute("data-condition-type")) || "all",
          conditionValue,
          startsAt: decodeAttr(target.getAttribute("data-starts-at")),
          endsAt: decodeAttr(target.getAttribute("data-ends-at")),
          isActive: target.getAttribute("data-is-active") === "1",
          notifyTelegram: currentNotifyTelegram,
          telegramTarget: decodeAttr(target.getAttribute("data-telegram-target")),
        });
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
  bindFlashForm(document.getElementById("flash-sales-create-form"));
  bindFlashForm(flashEditForm);
})();



