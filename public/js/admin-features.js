(function initAdminFeatures() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;
  const tab = body.getAttribute("data-active-tab") || "";
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  const headers = (extra = {}) => ({ ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...extra });
  const P = (v) => `${Number(v || 0).toLocaleString("ru-RU")} сум`;
  const D = (v) => (v ? new Date(v).toLocaleString("ru-RU") : "-");
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
  function closeAllRowMenus() {
    document.querySelectorAll(".admin-row-menu").forEach((node) => node.classList.add("is-hidden"));
    document.querySelectorAll("[data-kebab-toggle]").forEach((node) => node.setAttribute("aria-expanded", "false"));
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
      jsonFetch("/api/admin/leaderboard?period=week"),
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
    const settingsForm = document.getElementById("referrals-settings-form");
    if (!(stats instanceof HTMLElement) || !(table instanceof HTMLElement)) return;

    const [statPayload, rowsPayload, settingsPayload] = await Promise.all([
      jsonFetch("/api/admin/referrals/stats"),
      jsonFetch("/api/admin/referrals"),
      jsonFetch("/api/admin/referrals/settings"),
    ]);
    if (settingsForm instanceof HTMLFormElement) {
      const enabled = settingsForm.elements.namedItem("enabled");
      const requirePaid = settingsForm.elements.namedItem("requirePaid");
      if (enabled instanceof HTMLInputElement) enabled.checked = Boolean(settingsPayload.settings?.enabled);
      if (requirePaid instanceof HTMLInputElement) requirePaid.checked = Boolean(settingsPayload.settings?.requirePaid);
    }
    stats.innerHTML = [
      ["Всего реф-регистраций", statPayload.totalRegistrations],
      ["Конверсия в оплату", `${statPayload.conversionPaid}%`],
      ["Выдано наград", statPayload.rewarded],
    ]
      .map(([title, value]) => `<article class="rounded-2xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">${title}</p><p class="mt-2 text-2xl font-black">${value}</p></article>`)
      .join("");

    table.innerHTML = (rowsPayload.items || []).length
      ? rowsPayload.items
          .map(
            (item) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${item.referrer?.username ? `@${item.referrer.username}` : item.referrerTelegramId}</td><td class="px-4 py-3">${item.referred?.username ? `@${item.referred.username}` : item.referredTelegramId}</td><td class="px-4 py-3">${D(item.createdAt)}</td><td class="px-4 py-3">${item.status}</td><td class="px-4 py-3">${item.rewardType || "—"}</td><td class="px-4 py-3"><div class="admin-row-actions">${menuWrap(menuItem({ label: "Выдать награду вручную", icon: "gift", attrs: `data-a="reward-ref" data-id="${item.id}"` }))}</div></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="6" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';
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
            return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${item.title}</td><td class="px-4 py-3">-${item.discountPercent}%</td><td class="px-4 py-3">${D(item.startsAt)} → ${D(item.endsAt)}</td><td class="px-4 py-3">${item.isActive ? "Активен" : "Остановлен"}</td><td class="px-4 py-3">${stats.requestsCount} заявок · ${P(stats.discountSum)}</td><td class="px-4 py-3"><div class="admin-row-actions">${menuWrap([
              menuItem({ label: "Редактировать", icon: "pen", attrs: 'disabled="disabled"' }),
              menuItem({ label: "Остановить досрочно", icon: "square", attrs: `data-a="stop-flash" data-id="${item.id}"` }),
              menuSeparator(),
              menuItem({ label: "Удалить", icon: "trash", attrs: 'disabled="disabled"', danger: true }),
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
          menuItem({ label: "Редактировать", icon: "pen", attrs: 'disabled="disabled"' }),
          menuItem({ label: "Завершить досрочно", icon: "square", attrs: `data-a="finish-drop" data-id="${item.id}"` }),
          menuItem({ label: "Отправить уведомление вручную", icon: "send", attrs: `data-a="notify-drop" data-id="${item.id}"` }),
          menuSeparator(),
          menuItem({ label: "Удалить", icon: "trash", attrs: 'disabled="disabled"', danger: true }),
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
    const requirePaid = form.elements.namedItem("requirePaid");
    await jsonFetch("/api/admin/referrals/settings", {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        enabled: enabled instanceof HTMLInputElement ? enabled.checked : true,
        requirePaid: requirePaid instanceof HTMLInputElement ? requirePaid.checked : true,
      }),
    });
  });

  document.getElementById("flash-sales-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const fd = new FormData(form);
    await jsonFetch("/api/admin/flash-sales", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || ""),
        discountPercent: Number(fd.get("discountPercent") || 0),
        conditionType: String(fd.get("conditionType") || "all"),
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
          body: JSON.stringify({ rewardType: "discount" }),
        });
        await loadReferralsAdmin();
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
      alert(error.message || "Ошибка");
    } finally {
      closeAllRowMenus();
    }
  });

  if (tab === "leaderboard") void loadLeaderboardAdmin();
  if (tab === "referrals") void loadReferralsAdmin();
  if (tab === "flash-sales") void loadFlashSalesAdmin();
  if (tab === "drops") void loadDropsAdmin();
})();
