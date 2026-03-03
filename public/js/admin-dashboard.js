
(function () {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;

  const tab = body.getAttribute("data-active-tab") || "analytics";
  const base = (body.getAttribute("data-public-base-url") || location.origin).replace(/\/$/, "");
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const queryNode = document.getElementById("admin-dashboard-query");
  const initialQuery = (() => {
    if (!(queryNode instanceof HTMLScriptElement)) return {};
    try {
      return JSON.parse(queryNode.textContent || "{}") || {};
    } catch {
      return {};
    }
  })();

  const H = (h = {}) => (csrf ? { ...h, "X-CSRF-Token": csrf } : h);
  const D = (v) => (v ? new Date(v).toLocaleString("ru-RU") : "-");
  const P = (v) => `${Number(v || 0).toLocaleString("ru-RU")} сум`;
  const X = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  const Q = (o) => {
    const s = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => {
      const x = String(v ?? "").trim();
      if (!x || x === "all") return;
      s.set(k, x);
    });
    return s.toString();
  };

  function setDashboardQuery(values) {
    const url = new URL(location.href);
    url.searchParams.set("tab", tab);
    Object.entries(values).forEach(([k, v]) => {
      const x = String(v ?? "").trim();
      if (!x || x === "all" || x === "1") url.searchParams.delete(k);
      else url.searchParams.set(k, x);
    });
    history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  }

  function renderPager(containerId, pagination, onPage) {
    const box = document.getElementById(containerId);
    if (!(box instanceof HTMLElement)) return;
    const page = Number(pagination?.page || 1);
    const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
    box.innerHTML = "";
    if (totalPages <= 1) return;

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "← Назад";
    prev.disabled = page <= 1;
    prev.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";
    prev.addEventListener("click", () => onPage(page - 1));

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Вперёд →";
    next.disabled = page >= totalPages;
    next.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";
    next.addEventListener("click", () => onPage(page + 1));

    const label = document.createElement("span");
    label.className = "text-xs text-neutral-500";
    label.textContent = `${page}/${totalPages}`;

    box.appendChild(prev);
    box.appendChild(label);
    box.appendChild(next);
  }

  function getInitial(...keys) {
    for (const key of keys) {
      const value = initialQuery[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  async function E(response) {
    try {
      const payload = await response.json();
      return payload?.error || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  function tgUsername(contact) {
    const raw = String(contact || "").trim();
    if (!raw) return "";
    const fromUrl = raw.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,32})/i);
    if (fromUrl) return fromUrl[1];
    const fromAt = raw.match(/(?:^|\s)@([a-zA-Z0-9_]{5,32})(?:\s|$)/);
    if (fromAt) return fromAt[1];
    if (/^[a-zA-Z0-9_]{5,32}$/.test(raw)) return raw;
    return "";
  }

  function getFormValue(form, name, fallback = "") {
    if (!(form instanceof HTMLFormElement)) return fallback;
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      return String(field.value || fallback);
    }
    return fallback;
  }

  function setFormValue(form, name, value) {
    if (!(form instanceof HTMLFormElement)) return;
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
    }
  }

  async function loadAnalytics() {
    const kpi = document.getElementById("analytics-kpis");
    const table = document.getElementById("analytics-checker-table");
    if (!(kpi instanceof HTMLElement) || !(table instanceof HTMLElement)) return;
    const r = await fetch("/api/admin/analytics");
    if (!r.ok) return;
    const p = await r.json();
    const s = p.kpis || {};
    const oneTime = s.oneTimeRevenue || {};
    kpi.innerHTML = [
      ["Новых заявок сегодня", s.newOrdersToday || 0],
      ["Выручка разово", `${P(oneTime.today || 0)} • ${P(oneTime.week || 0)} • ${P(oneTime.month || 0)}`],
      ["Выручка ежемесячная", P(s.monthlyRecurringRevenue || 0)],
      ["Всего активных визиток", s.activeCards || 0],
    ].map(([n, v]) => `<div class="rounded-2xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">${n}</p><p class="mt-2 text-xl font-black">${X(v)}</p></div>`).join("");
    const top = p.topUnboughtPatterns || [];
    table.innerHTML = top.length ? top.map((x) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2 font-mono">${X(x.pattern)}</td><td class="px-3 py-2 font-semibold">${x.count}</td></tr>`).join("") : '<tr><td colspan="2" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';
    if (typeof Chart !== "undefined") {
      const d = p.ordersDaily || [];
      new Chart(document.getElementById("analytics-orders-chart"), { type: "line", data: { labels: d.map((x) => x.date), datasets: [{ label: "Заявки", data: d.map((x) => x.count), borderColor: "#111827", tension: 0.25 }] }, options: { responsive: true, maintainAspectRatio: false } });
      const t = p.tariffSplit || { basic: 0, premium: 0 };
      new Chart(document.getElementById("analytics-tariff-chart"), { type: "pie", data: { labels: ["Базовый", "Премиум"], datasets: [{ data: [t.basic || 0, t.premium || 0], backgroundColor: ["#e5e7eb", "#111827"] }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
  }

  async function loadOrders() {
    const form = document.getElementById("orders-filters");
    const table = document.getElementById("orders-table");
    const csv = document.getElementById("orders-export-link");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement) || !(csv instanceof HTMLAnchorElement)) return;
    const q = {
      status: getFormValue(form, "status", "all"),
      tariff: getFormValue(form, "tariff", "all"),
      bracelet: getFormValue(form, "bracelet", "all"),
      dateFrom: getFormValue(form, "dateFrom", ""),
      dateTo: getFormValue(form, "dateTo", ""),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ o_status: q.status, o_tariff: q.tariff, o_bracelet: q.bracelet, o_date_from: q.dateFrom, o_date_to: q.dateTo, o_page: q.page });
    const filterQs = Q({ status: q.status, tariff: q.tariff, bracelet: q.bracelet, dateFrom: q.dateFrom, dateTo: q.dateTo });
    csv.href = `/api/admin/orders/export.csv${filterQs ? `?${filterQs}` : ""}`;
    const r = await fetch(`/api/admin/orders?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length ? rows.map((x) => {
      const username = tgUsername(x.contact);
      const chatBtn = username
        ? `<a href="tg://resolve?domain=${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Написать</a>`
        : '<button type="button" disabled title="Нужен username в Telegram" class="cursor-not-allowed rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-400">Написать</button>';
      return `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${P(x.slugPrice)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Базовый"}</td><td class="px-4 py-3">${x.bracelet ? "Да" : "Нет"}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3"><select data-act="os" data-id="${x.id}" data-note="${X(x.adminNote || "")}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs"><option value="new" ${x.status === "new" ? "selected" : ""}>🆕 Новая</option><option value="contacted" ${x.status === "contacted" ? "selected" : ""}>💬 Связались</option><option value="paid" ${x.status === "paid" ? "selected" : ""}>💳 Ожидает оплаты</option><option value="approved" ${x.status === "approved" ? "selected" : ""}>✅ Одобрено</option><option value="rejected" ${x.status === "rejected" ? "selected" : ""}>❌ Отклонено</option></select></td><td class="px-4 py-3"><div class="flex flex-wrap gap-2">${chatBtn}<button data-act="od" data-id="${x.id}" class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50">Удалить</button></div></td></tr>`;
    }).join("") : '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Нет заявок</td></tr>';
    renderPager("orders-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadOrders();
    });
  }

  async function loadUsers() {
    const form = document.getElementById("users-filters");
    const table = document.getElementById("users-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = {
      q: getFormValue(form, "q", ""),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ u_q: q.q, u_page: q.page });
    const r = await fetch(`/api/admin/users?${Q(q)}`);
    if (!r.ok) {
      const msg = await E(r);
      table.innerHTML = `<tr><td colspan="8" class="px-3 py-8 text-center text-red-700">Не удалось загрузить пользователей: ${X(msg)}</td></tr>`;
      return;
    }
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows
          .map((x) => {
            const slugText = Array.isArray(x.slugs) && x.slugs.length ? x.slugs.map((s) => `${s.fullSlug} (${s.status})`).join(", ") : "—";
            const primarySlug =
              Array.isArray(x.slugs) && x.slugs.length
                ? x.slugs.find((s) => ["active", "private", "paused", "approved"].includes(s.status))?.fullSlug || x.slugs[0].fullSlug
                : null;
            const profileLink = primarySlug ? `/${encodeURIComponent(primarySlug)}` : x.username ? `https://t.me/${encodeURIComponent(x.username)}` : null;
            const statusLabel = x.status === "blocked" ? "Заблокирован" : x.status === "deactivated" ? "Деактивирован" : "Активен";
            return `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${X(x.username ? `@${x.username}` : x.telegramId)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3"><select data-act="up" data-id="${X(x.telegramId)}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs"><option value="basic" ${x.plan === "basic" ? "selected" : ""}>Базовый</option><option value="premium" ${x.plan === "premium" ? "selected" : ""}>Премиум</option></select><div class="mt-1 text-[11px] text-neutral-500">до ${x.planExpiresAt ? D(x.planExpiresAt) : "—"}</div></td><td class="px-4 py-3 text-xs">${X(slugText)}</td><td class="px-4 py-3">${x.hasCard ? "Есть" : "Нет"}</td><td class="px-4 py-3">${X(statusLabel)}</td><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-2"><button data-act="ux" data-id="${X(x.telegramId)}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Срок</button><button data-act="ub" data-id="${X(x.telegramId)}" class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50">Блок</button>${profileLink ? `<a href="${profileLink}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Открыть профиль →</a>` : ""}</div></td></tr>`;
          })
          .join("")
      : '<tr><td colspan="8" class="px-3 py-8 text-center text-neutral-500">Нет пользователей</td></tr>';
    renderPager("users-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadUsers();
    });
  }
  async function loadSlugs() {
    const stats = document.getElementById("slugs-stats");
    const table = document.getElementById("slugs-table");
    const form = document.getElementById("slugs-filters");
    if (!(stats instanceof HTMLElement) || !(table instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;

    const sr = await fetch("/api/admin/slugs/stats");
    if (sr.ok) {
      const s = await sr.json();
      stats.innerHTML = [["Всего slugов", s.total], ["Занято", s.taken], ["Свободно", s.free], ["Заблокировано", s.blocked]].map(([n, v]) => `<div class="rounded-2xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">${n}</p><p class="mt-2 text-2xl font-black">${Number(v || 0).toLocaleString("ru-RU")}</p></div>`).join("");
    }

    const q = { q: getFormValue(form, "q", ""), state: getFormValue(form, "state", "all"), page: getFormValue(form, "page", "1") };
    setDashboardQuery({ s_q: q.q, s_state: q.state, s_page: q.page });
    const r = await fetch(`/api/admin/slugs?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${x.stateLabel}</td><td class="px-4 py-3">${X(x.ownerName || "-")}</td><td class="px-4 py-3">${typeof x.effectivePrice === "number" ? P(x.effectivePrice) : "-"}</td><td class="px-4 py-3">${x.activationDate ? D(x.activationDate) : "-"}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-2"><button data-act="st" data-slug="${x.slug}" data-ns="${x.state === "BLOCKED" ? "free" : "blocked"}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">${x.state === "BLOCKED" ? "Разблокировать" : "Заблокировать"}</button><button data-act="sp" data-slug="${x.slug}" data-p="${x.priceOverride ?? ""}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Цена</button><a href="/${encodeURIComponent(x.slug)}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Открыть →</a></div></td></tr>`).join("")
      : '<tr><td colspan="6" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';
    renderPager("slugs-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadSlugs();
    });
  }

  async function loadCards() {
    const form = document.getElementById("cards-filters");
    const table = document.getElementById("cards-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = { q: getFormValue(form, "q", ""), status: getFormValue(form, "status", "all"), page: getFormValue(form, "page", "1") };
    setDashboardQuery({ c_q: q.q, c_status: q.status, c_page: q.page });
    const r = await fetch(`/api/admin/cards?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3 font-mono"><a href="/${encodeURIComponent(x.slug)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 hover:underline">#${X(x.slug)}</a></td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3"><select data-act="ct" data-id="${x.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs"><option value="basic" ${x.tariff === "basic" ? "selected" : ""}>Базовый</option><option value="premium" ${x.tariff === "premium" ? "selected" : ""}>Премиум</option></select></td><td class="px-4 py-3">${x.isActive ? "Активна" : "Выключена"}</td><td class="px-4 py-3">${Number(x.viewsCount || 0).toLocaleString("ru-RU")}</td><td class="px-4 py-3">${new Date(x.createdAt).toLocaleDateString("ru-RU")}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-2"><button data-act="cg" data-id="${x.id}" data-n="${x.isActive ? 0 : 1}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">${x.isActive ? "Выключить" : "Включить"}</button><a href="/admin/cards/${x.id}/edit" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Редактировать</a><a href="/${encodeURIComponent(x.slug)}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Открыть →</a><button data-act="qr" data-slug="${x.slug}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">QR</button></div></td></tr>`).join("")
      : '<tr><td colspan="7" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';
    renderPager("cards-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadCards();
    });
  }

  async function loadBracelets() {
    const form = document.getElementById("bracelets-filters");
    const table = document.getElementById("bracelets-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = { status: getFormValue(form, "status", "all"), page: getFormValue(form, "page", "1") };
    setDashboardQuery({ b_status: q.status, b_page: q.page });
    const r = await fetch(`/api/admin/bracelet-orders?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3"><select data-act="bs" data-id="${x.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs"><option value="ORDERED" ${x.deliveryStatus === "ORDERED" ? "selected" : ""}>📦 Заказан</option><option value="SHIPPED" ${x.deliveryStatus === "SHIPPED" ? "selected" : ""}>🚚 Отправлен</option><option value="DELIVERED" ${x.deliveryStatus === "DELIVERED" ? "selected" : ""}>✅ Доставлен</option></select></td></tr>`).join("")
      : '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">Нет заказов</td></tr>';
    renderPager("bracelets-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadBracelets();
    });
  }

  async function loadTestimonials() {
    const table = document.getElementById("testimonials-table");
    if (!(table instanceof HTMLElement)) return;
    const q = { page: getInitial("t_page", "page") || "1" };
    setDashboardQuery({ t_page: q.page });
    const r = await fetch(`/api/admin/testimonials?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length ? rows.map((x) => {
      const data = encodeURIComponent(JSON.stringify({ id: x.id, name: x.name, slug: x.slug, tariff: x.tariff, text: x.text }));
      return `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Базовый"}</td><td class="px-4 py-3">${X(x.text)}</td><td class="px-4 py-3">${x.isVisible ? "Показан" : "Скрыт"}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-2"><button data-act="tv" data-id="${x.id}" data-n="${x.isVisible ? 0 : 1}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">${x.isVisible ? "Скрыть" : "Показать"}</button><button data-act="te" data-json="${data}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Редактировать</button><button data-act="td" data-id="${x.id}" class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50">Удалить</button></div></td></tr>`;
    }).join("") : '<tr><td colspan="6" class="px-3 py-8 text-center text-neutral-500">Нет отзывов</td></tr>';
    renderPager("testimonials-pagination", payload.pagination, (nextPage) => {
      initialQuery.t_page = String(nextPage);
      void loadTestimonials();
    });
  }

  async function loadLogs() {
    const form = document.getElementById("logs-filters");
    const table = document.getElementById("logs-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = { type: getFormValue(form, "type", "all"), page: getFormValue(form, "page", "1") };
    setDashboardQuery({ l_type: q.type, l_page: q.page });
    const r = await fetch(`/api/admin/logs?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length ? rows.map((x) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${X(x.type)}</td><td class="px-4 py-3 font-mono text-xs">${X(x.path)}</td><td class="px-4 py-3 text-xs">${X(x.message || "-")}</td><td class="px-4 py-3 text-xs">${X(x.userAgent || "-")}</td><td class="px-4 py-3 text-xs">${D(x.occurredAt)}</td></tr>`).join("") : '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">Логи не найдены</td></tr>';
    renderPager("logs-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadLogs();
    });
  }
  const am = document.getElementById("activation-modal");
  const af = document.getElementById("activation-form");
  const at = af instanceof HTMLFormElement ? af.elements.namedItem("tariff") : null;
  const ath = af instanceof HTMLFormElement ? af.elements.namedItem("theme") : null;
  function syncATheme() {
    if (!(at instanceof HTMLSelectElement) || !(ath instanceof HTMLSelectElement)) return;
    const premium = at.value === "premium";
    ath.disabled = !premium;
    if (!premium) ath.value = "default_dark";
  }
  function closeA() {
    if (am instanceof HTMLElement) {
      am.classList.add("hidden");
      am.classList.remove("flex");
      am.setAttribute("aria-hidden", "true");
    }
  }
  function openA(id, tariff, theme) {
    if (!(am instanceof HTMLElement) || !(af instanceof HTMLFormElement)) return;
    const idField = af.elements.namedItem("orderId");
    if (idField instanceof HTMLInputElement) idField.value = id;
    if (at instanceof HTMLSelectElement) at.value = tariff === "premium" ? "premium" : "basic";
    if (ath instanceof HTMLSelectElement) ath.value = theme || "default_dark";
    syncATheme();
    am.classList.remove("hidden");
    am.classList.add("flex");
    am.setAttribute("aria-hidden", "false");
  }
  document.getElementById("activation-close-btn")?.addEventListener("click", closeA);
  at?.addEventListener("change", syncATheme);
  am?.addEventListener("click", (e) => {
    if (e.target === am) closeA();
  });
  af?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!(af instanceof HTMLFormElement)) return;
    const id = af.elements.namedItem("orderId");
    const tariff = af.elements.namedItem("tariff");
    const theme = af.elements.namedItem("theme");
    if (!(id instanceof HTMLInputElement) || !(tariff instanceof HTMLSelectElement) || !(theme instanceof HTMLSelectElement)) return;
    const r = await fetch(`/api/admin/orders/${id.value}/activate`, { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ tariff: tariff.value, theme: theme.value }) });
    if (!r.ok) return alert(await E(r));
    closeA();
    void loadOrders();
  });

  const qm = document.getElementById("qr-modal");
  const qwrap = document.getElementById("qr-svg-wrap");
  const qcan = document.getElementById("qr-canvas");
  const qtitle = document.getElementById("qr-title-slug");
  let qslug = "";
  let qsvg = "";
  function closeQ() {
    if (qm instanceof HTMLElement) {
      qm.classList.add("hidden");
      qm.classList.remove("flex");
      qm.setAttribute("aria-hidden", "true");
    }
  }
  async function openQ(slug) {
    if (!(qm instanceof HTMLElement) || !(qwrap instanceof HTMLElement) || !(qcan instanceof HTMLCanvasElement) || typeof QRCode === "undefined") return;
    const url = `${base}/${slug}`;
    qslug = slug;
    qsvg = await QRCode.toString(url, { type: "svg", width: 1000, margin: 2, errorCorrectionLevel: "H" });
    qwrap.innerHTML = await QRCode.toString(url, { type: "svg", width: 240, margin: 2, errorCorrectionLevel: "H" });
    await QRCode.toCanvas(qcan, url, { width: 1000, margin: 2, errorCorrectionLevel: "H" });
    if (qtitle instanceof HTMLElement) qtitle.textContent = `#${slug}`;
    qm.classList.remove("hidden");
    qm.classList.add("flex");
    qm.setAttribute("aria-hidden", "false");
  }
  document.querySelectorAll("[data-close-modal]").forEach((node) => node.addEventListener("click", closeQ));
  qm?.addEventListener("click", (e) => {
    if (e.target === qm) closeQ();
  });
  document.getElementById("download-qr-png")?.addEventListener("click", () => {
    if (!(qcan instanceof HTMLCanvasElement) || !qslug) return;
    const a = document.createElement("a");
    a.href = qcan.toDataURL("image/png");
    a.download = `${qslug}.png`;
    a.click();
  });
  document.getElementById("download-qr-svg")?.addEventListener("click", () => {
    if (!qsvg || !qslug) return;
    const b = new Blob([qsvg], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `${qslug}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const tem = document.getElementById("testimonial-edit-modal");
  const tef = document.getElementById("testimonial-edit-form");
  function closeTe() {
    if (!(tem instanceof HTMLElement)) return;
    tem.classList.add("hidden");
    tem.classList.remove("flex");
    tem.setAttribute("aria-hidden", "true");
  }
  function openTe(data) {
    if (!(tem instanceof HTMLElement) || !(tef instanceof HTMLFormElement)) return;
    const id = tef.elements.namedItem("id");
    const name = tef.elements.namedItem("name");
    const slug = tef.elements.namedItem("slug");
    const tariff = tef.elements.namedItem("tariff");
    const text = tef.elements.namedItem("text");
    if (!(id instanceof HTMLInputElement) || !(name instanceof HTMLInputElement) || !(slug instanceof HTMLInputElement) || !(tariff instanceof HTMLSelectElement) || !(text instanceof HTMLTextAreaElement)) return;
    id.value = String(data.id || "");
    name.value = String(data.name || "");
    slug.value = String(data.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    tariff.value = data.tariff === "premium" ? "premium" : "basic";
    text.value = String(data.text || "");
    tem.classList.remove("hidden");
    tem.classList.add("flex");
    tem.setAttribute("aria-hidden", "false");
  }
  document.getElementById("testimonial-edit-close-btn")?.addEventListener("click", closeTe);
  tem?.addEventListener("click", (e) => {
    if (e.target === tem) closeTe();
  });
  tef?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!(tef instanceof HTMLFormElement)) return;
    const id = tef.elements.namedItem("id");
    const name = tef.elements.namedItem("name");
    const slug = tef.elements.namedItem("slug");
    const tariff = tef.elements.namedItem("tariff");
    const text = tef.elements.namedItem("text");
    if (!(id instanceof HTMLInputElement) || !(name instanceof HTMLInputElement) || !(slug instanceof HTMLInputElement) || !(tariff instanceof HTMLSelectElement) || !(text instanceof HTMLTextAreaElement)) return;
    const r = await fetch(`/api/admin/testimonials/${id.value}`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ name: name.value.trim(), slug: slug.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6), tariff: tariff.value === "premium" ? "premium" : "basic", text: text.value.trim() }) });
    if (!r.ok) return alert(await E(r));
    closeTe();
    void loadTestimonials();
  });
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches('[data-act="os"]') && t instanceof HTMLSelectElement) {
      const id = t.getAttribute("data-id");
      if (!id) return;
      const previousNote = t.getAttribute("data-note") || "";
      let adminNote = previousNote;
      if (t.value === "rejected") {
        const entered = prompt("Причина отклонения (будет отправлена в Telegram)", previousNote);
        if (entered === null) return;
        adminNote = entered;
      }
      const r = await fetch(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ status: t.value, adminNote }) });
      if (!r.ok) alert(await E(r));
      else void loadOrders();
    }
    if (t.matches('[data-act="bs"]') && t instanceof HTMLSelectElement) {
      const id = t.getAttribute("data-id");
      if (!id) return;
      const r = await fetch(`/api/admin/bracelet-orders/${id}/status`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ deliveryStatus: t.value }) });
      if (!r.ok) alert(await E(r));
    }
    if (t.matches('[data-act="ct"]') && t instanceof HTMLSelectElement) {
      const id = t.getAttribute("data-id");
      if (!id) return;
      const r = await fetch(`/api/admin/cards/${id}/tariff`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ tariff: t.value }) });
      if (!r.ok) alert(await E(r));
    }
    if (t.matches('[data-act="up"]') && t instanceof HTMLSelectElement) {
      const telegramId = t.getAttribute("data-id");
      if (!telegramId) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: t.value }) });
      if (!r.ok) alert(await E(r));
      else void loadUsers();
    }
  });

  document.addEventListener("click", async (e) => {
    const n = e.target instanceof HTMLElement ? e.target.closest("[data-act]") : null;
    if (!(n instanceof HTMLElement)) return;
    const a = n.getAttribute("data-act");
    if (a === "oa") openA(n.getAttribute("data-id") || "", n.getAttribute("data-t") || "basic", n.getAttribute("data-th") || "default_dark");
    if (a === "od") { const id = n.getAttribute("data-id"); if (!id || !confirm("Удалить заявку?")) return; const r = await fetch(`/api/admin/orders/${id}`, { method: "DELETE", headers: H() }); if (!r.ok) alert(await E(r)); else void loadOrders(); }
    if (a === "ux") { const telegramId = n.getAttribute("data-id"); if (!telegramId) return; const input = prompt("Новая дата окончания (YYYY-MM-DD) или пусто для сброса", ""); if (input === null) return; const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan-expiry`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ planExpiresAt: input.trim() ? `${input.trim()}T23:59:59.000Z` : null }) }); if (!r.ok) alert(await E(r)); else void loadUsers(); }
    if (a === "ub") { const telegramId = n.getAttribute("data-id"); if (!telegramId || !confirm("Заблокировать пользователя и деактивировать его slug?")) return; const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/block`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) alert(await E(r)); else void loadUsers(); }
    if (a === "st") { const slug = n.getAttribute("data-slug"), state = n.getAttribute("data-ns"); if (!slug || !state) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/state`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ state }) }); if (!r.ok) alert(await E(r)); else void loadSlugs(); }
    if (a === "sp") { const slug = n.getAttribute("data-slug"), cur = n.getAttribute("data-p") || ""; if (!slug) return; const x = prompt("Новая цена slug (пусто = убрать override)", cur); if (x === null) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/price-override`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ priceOverride: x.trim() ? Number(x.trim()) : null }) }); if (!r.ok) alert(await E(r)); else void loadSlugs(); }
    if (a === "cg") { const id = n.getAttribute("data-id"), isActive = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/cards/${id}/toggle-active`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isActive }) }); if (!r.ok) alert(await E(r)); else void loadCards(); }
    if (a === "qr") { const slug = n.getAttribute("data-slug"); if (slug) await openQ(slug); }
    if (a === "tv") { const id = n.getAttribute("data-id"), isVisible = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/testimonials/${id}/visibility`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isVisible }) }); if (!r.ok) alert(await E(r)); else void loadTestimonials(); }
    if (a === "td") { const id = n.getAttribute("data-id"); if (!id || !confirm("Удалить отзыв?")) return; const r = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE", headers: H() }); if (!r.ok) alert(await E(r)); else void loadTestimonials(); }
    if (a === "te") { const encoded = n.getAttribute("data-json"); if (!encoded) return; try { openTe(JSON.parse(decodeURIComponent(encoded))); } catch {} }
  });

  document.getElementById("orders-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadOrders(); });
  document.getElementById("users-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadUsers(); });
  document.getElementById("slugs-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadSlugs(); });
  document.getElementById("cards-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadCards(); });
  document.getElementById("bracelets-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadBracelets(); });
  document.getElementById("logs-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadLogs(); });
  document.getElementById("testimonial-create-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!(f instanceof HTMLFormElement)) return;
    const d = new FormData(f);
    const p = { name: String(d.get("name") || "").trim(), slug: String(d.get("slug") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6), tariff: String(d.get("tariff") || "basic"), text: String(d.get("text") || "").trim() };
    const r = await fetch("/api/admin/testimonials", { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify(p) });
    if (!r.ok) alert(await E(r)); else { f.reset(); initialQuery.t_page = "1"; void loadTestimonials(); }
  });
  document.getElementById("cleanup-logs-btn")?.addEventListener("click", async () => {
    const r = await fetch("/api/admin/logs/cleanup", { method: "POST", headers: H() });
    if (!r.ok) alert(await E(r)); else void loadLogs();
  });

  if (tab === "orders") {
    const form = document.getElementById("orders-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "status", getInitial("o_status", "status") || "all");
      setFormValue(form, "tariff", getInitial("o_tariff", "tariff") || "all");
      setFormValue(form, "bracelet", getInitial("o_bracelet", "bracelet") || "all");
      setFormValue(form, "dateFrom", getInitial("o_date_from", "dateFrom") || "");
      setFormValue(form, "dateTo", getInitial("o_date_to", "dateTo") || "");
      setFormValue(form, "page", getInitial("o_page", "page") || "1");
    }
  }
  if (tab === "slugs") {
    const form = document.getElementById("slugs-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "q", getInitial("s_q", "q") || "");
      setFormValue(form, "state", getInitial("s_state", "state") || "all");
      setFormValue(form, "page", getInitial("s_page", "page") || "1");
    }
  }
  if (tab === "users") {
    const form = document.getElementById("users-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "q", getInitial("u_q", "q") || "");
      setFormValue(form, "page", getInitial("u_page", "page") || "1");
    }
  }
  if (tab === "cards") {
    const form = document.getElementById("cards-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "q", getInitial("c_q", "q") || "");
      setFormValue(form, "status", getInitial("c_status", "status") || "all");
      setFormValue(form, "page", getInitial("c_page", "page") || "1");
    }
  }
  if (tab === "bracelets") {
    const form = document.getElementById("bracelets-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "status", getInitial("b_status", "status") || "all");
      setFormValue(form, "page", getInitial("b_page", "page") || "1");
    }
  }
  if (tab === "logs") {
    const form = document.getElementById("logs-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "type", getInitial("l_type", "type") || "all");
      setFormValue(form, "page", getInitial("l_page", "page") || "1");
    }
  }

  if (tab === "analytics") void loadAnalytics();
  if (tab === "orders") void loadOrders();
  if (tab === "users") void loadUsers();
  if (tab === "slugs") void loadSlugs();
  if (tab === "cards") void loadCards();
  if (tab === "bracelets") void loadBracelets();
  if (tab === "testimonials") void loadTestimonials();
  if (tab === "logs") void loadLogs();
})();
