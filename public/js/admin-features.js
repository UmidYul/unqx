(function initAdminFeatures() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;
  const tab = body.getAttribute("data-active-tab") || "";
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  const headers = (extra = {}) => ({ ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...extra });
  const P = (v) => `${Number(v || 0).toLocaleString("ru-RU")} сум`;
  const D = (v) => (v ? new Date(v).toLocaleString("ru-RU") : "-");

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
            (item) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3">#${item.rank}</td><td class="px-4 py-3 font-mono">${item.slug}</td><td class="px-4 py-3">${item.ownerName}</td><td class="px-4 py-3">${Number(item.views || 0).toLocaleString("ru-RU")}</td><td class="px-4 py-3">${item.delta == null ? "—" : item.delta > 0 ? `↑ +${item.delta}` : item.delta < 0 ? `↓ ${item.delta}` : "→ 0"}</td><td class="px-4 py-3">${item.plan === "premium" ? "ПРЕМИУМ" : "БАЗОВЫЙ"}</td><td class="px-4 py-3"><button data-a="exclude-lb" data-slug="${item.slug}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Исключить</button><button data-a="reset-lb-user" data-tg="${item.ownerTelegramId || ""}" class="ml-2 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Сбросить счётчик</button></td></tr>`,
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
            (item) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${item.referrer?.username ? `@${item.referrer.username}` : item.referrerTelegramId}</td><td class="px-4 py-3">${item.referred?.username ? `@${item.referred.username}` : item.referredTelegramId}</td><td class="px-4 py-3">${D(item.createdAt)}</td><td class="px-4 py-3">${item.status}</td><td class="px-4 py-3">${item.rewardType || "—"}</td><td class="px-4 py-3"><button data-a="reward-ref" data-id="${item.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold">Выдать вручную</button></td></tr>`,
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
            return `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${item.title}</td><td class="px-4 py-3">-${item.discountPercent}%</td><td class="px-4 py-3">${D(item.startsAt)} → ${D(item.endsAt)}</td><td class="px-4 py-3">${item.isActive ? "Активен" : "Остановлен"}</td><td class="px-4 py-3">${stats.requestsCount} заявок · ${P(stats.discountSum)}</td><td class="px-4 py-3"><button data-a="stop-flash" data-id="${item.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold">Остановить</button></td></tr>`;
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
        return `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${item.title}</td><td class="px-4 py-3">${D(item.dropAt)}</td><td class="px-4 py-3">${item.slugCount}</td><td class="px-4 py-3">${item.isLive ? "LIVE" : item.isFinished ? "Завершён" : "Ожидается"}</td><td class="px-4 py-3">Продано ${live.sold || 0} из ${live.total || item.slugCount}</td><td class="px-4 py-3"><button data-a="finish-drop" data-id="${item.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold">Завершить досрочно</button> <button data-a="notify-drop" data-id="${item.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold">Уведомить вручную</button></td></tr>`;
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
    }
  });

  if (tab === "leaderboard") void loadLeaderboardAdmin();
  if (tab === "referrals") void loadReferralsAdmin();
  if (tab === "flash-sales") void loadFlashSalesAdmin();
  if (tab === "drops") void loadDropsAdmin();
})();
