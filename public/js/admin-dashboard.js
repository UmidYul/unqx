
(function () {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;

  const tab = body.getAttribute("data-active-tab") || "analytics";
  const base = (body.getAttribute("data-public-base-url") || location.origin).replace(/\/$/, "");
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
  const showPrompt = (message, defaultValue = "") => {
    if (window.UNQAdminDialog?.prompt) {
      return window.UNQAdminDialog.prompt(message, defaultValue);
    }
    if (typeof window.prompt === "function") {
      return Promise.resolve(window.prompt(message, defaultValue));
    }
    return Promise.resolve(null);
  };
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
  const formatPendingCountdown = (iso) => {
    if (!iso) return "";
    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) return "";
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return "истекает сейчас";
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `истекает через ${hours}ч ${minutes}мин`;
  };
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
  const ICONS = {
    more: '<circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    userCheck: '<path d="M9 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8"/><path d="M3 20a6 6 0 0 1 12 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m17 11 2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    message: '<path d="M4 5h16v10H8l-4 4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    creditCard: '<rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/>',
    xCircle: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m9 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    checkCircle: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    external: '<path d="M14 5h5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m10 14 9-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="5" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/>',
    send: '<path d="m3 12 18-8-6 16-3-7-9-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 7l1 12h8l1-12M9 7V5h6v2" stroke="currentColor" stroke-width="1.8"/>',
    pen: '<path d="m4 20 4-.8L20 7a2.2 2.2 0 0 0-3-3L5 16l-1 4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/>',
    toggleLeft: '<rect x="3" y="7" width="18" height="10" rx="5" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>',
    toggleRight: '<rect x="3" y="7" width="18" height="10" rx="5" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>',
    package: '<path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8" stroke="currentColor" stroke-width="1.8"/>',
    truck: '<path d="M3 7h11v8H3zM14 10h4l3 3v2h-7" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="17" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="17" r="2" stroke="currentColor" stroke-width="1.8"/>',
    crown: '<path d="M3 9 7 5l5 6 5-6 4 4-2 9H5L3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    shieldOff: '<path d="M12 3 5 6v6c0 5 3.5 8 7 9 1.2-.4 2.4-1 3.4-1.8" stroke="currentColor" stroke-width="1.8"/><path d="m3 3 18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" stroke="currentColor" stroke-width="1.8"/><path d="M14 14h2v2h-2zM18 14h2v6h-6v-2" stroke="currentColor" stroke-width="1.8"/>',
    link2: '<path d="M10 7h6a4 4 0 1 1 0 8h-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 17H8a4 4 0 1 1 0-8h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const I = (name, size = 14) => `<svg class="admin-i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const statusMeta = {
    new: { label: "Новая", tone: "info" },
    contacted: { label: "Связались", tone: "muted" },
    paid: { label: "Ожидает оплаты", tone: "warning" },
    approved: { label: "Одобрено", tone: "success" },
    rejected: { label: "Отклонено", tone: "danger" },
    expired: { label: "Истекла", tone: "muted" },
    muted: { label: "Скрыт", tone: "muted" },
    ORDERED: { label: "Заказан", tone: "warning" },
    SHIPPED: { label: "Отправлен", tone: "info" },
    DELIVERED: { label: "Доставлен", tone: "success" },
  };
  function statusChip(code) {
    const m = statusMeta[code] || { label: String(code || "-"), tone: "muted" };
    return `<span class="admin-status-chip is-${m.tone}"><span class="admin-status-dot"></span>${X(m.label)}</span>`;
  }
  function kebabButton() {
    return `<button type="button" class="admin-kebab-btn" data-kebab-toggle aria-label="Действия" aria-haspopup="menu" aria-expanded="false">${I("more", 16)}</button>`;
  }
  function menuItem({ label, icon, attrs = "", danger = false }) {
    return `<button type="button" class="admin-menu-item${danger ? " is-danger" : ""}" ${attrs}>${I(icon, 16)}<span>${X(label)}</span></button>`;
  }
  function menuSeparator() {
    return '<div class="admin-menu-sep" role="separator"></div>';
  }
  function menuWrap(content) {
    return `${kebabButton()}<div class="admin-row-menu is-hidden">${content}</div>`;
  }

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

  let openRowMenu = null;
  let openRowToggle = null;

  function resetRowMenuPosition(menu) {
    if (!(menu instanceof HTMLElement)) return;
    menu.classList.remove("is-floating");
    menu.style.left = "";
    menu.style.top = "";
    menu.style.right = "";
    menu.style.bottom = "";
  }

  function positionRowMenu(menu, toggle) {
    if (!(menu instanceof HTMLElement) || !(toggle instanceof HTMLElement)) return;
    const gap = 6;
    const padding = 8;
    const toggleRect = toggle.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = Math.max(200, Math.ceil(menuRect.width));
    const menuHeight = Math.ceil(menuRect.height);

    let left = toggleRect.right - menuWidth;
    left = Math.max(padding, Math.min(left, viewportWidth - menuWidth - padding));

    const fitsBottom = toggleRect.bottom + gap + menuHeight <= viewportHeight - padding;
    let top = fitsBottom ? toggleRect.bottom + gap : toggleRect.top - menuHeight - gap;
    top = Math.max(padding, Math.min(top, viewportHeight - menuHeight - padding));

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  function repositionOpenRowMenu() {
    if (!(openRowMenu instanceof HTMLElement) || !(openRowToggle instanceof HTMLElement)) return;
    if (openRowMenu.classList.contains("is-hidden")) return;
    positionRowMenu(openRowMenu, openRowToggle);
  }

  function closeAllRowMenus() {
    document.querySelectorAll(".admin-row-menu").forEach((node) => {
      node.classList.add("is-hidden");
      resetRowMenuPosition(node);
    });
    document.querySelectorAll("[data-kebab-toggle]").forEach((node) => node.setAttribute("aria-expanded", "false"));
    openRowMenu = null;
    openRowToggle = null;
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
      { n: "Новых заявок сегодня", v: s.newOrdersToday || 0, i: "userCheck" },
      { n: "Выручка разово", v: `${P(oneTime.today || 0)} • ${P(oneTime.week || 0)} • ${P(oneTime.month || 0)}`, i: "creditCard" },
      { n: "Выручка ежемесячная", v: P(s.monthlyRecurringRevenue || 0), i: "calendar" },
      { n: "Активных визиток", v: s.activeCards || 0, i: "link2" },
      { n: "Средний UNQ Score", v: Number(s.averageUnqScore || 0).toLocaleString("ru-RU"), i: "chart" },
    ].map((x) => `<article class="admin-kpi-card"><div class="admin-kpi-icon">${I(x.i, 20)}</div><p class="admin-kpi-value">${X(x.v)}</p><p class="admin-kpi-label">${x.n}</p></article>`).join("");
    const top = p.topUnboughtPatterns || [];
    table.innerHTML = top.length ? top.map((x) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2 font-mono">${X(x.pattern)}</td><td class="px-3 py-2 font-semibold">${x.count}</td></tr>`).join("") : '<tr><td colspan="2" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';
    if (typeof Chart !== "undefined") {
      const d = p.ordersDaily || [];
      new Chart(document.getElementById("analytics-orders-chart"), { type: "line", data: { labels: d.map((x) => x.date), datasets: [{ label: "Заявки", data: d.map((x) => x.count), borderColor: "#111827", tension: 0.25 }] }, options: { responsive: true, maintainAspectRatio: false } });
      const t = p.tariffSplit || { basic: 0, premium: 0 };
      new Chart(document.getElementById("analytics-tariff-chart"), { type: "pie", data: { labels: ["Базовый", "Премиум"], datasets: [{ data: [t.basic || 0, t.premium || 0], backgroundColor: ["#e5e7eb", "#111827"] }] }, options: { responsive: true, maintainAspectRatio: false } });
      const dScore = p.scoreDistribution || [];
      new Chart(document.getElementById("analytics-score-distribution-chart"), {
        type: "bar",
        data: {
          labels: dScore.map((x) => x.range),
          datasets: [{ data: dScore.map((x) => x.count), backgroundColor: "#111827" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
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
      const username = x.username || "";
      const profileHref = x.slug ? `/${encodeURIComponent(x.slug)}` : "";
      const countdown = x.slugState === "pending" ? formatPendingCountdown(x.pendingExpiresAt) : "";
      const remainingMs = x.pendingExpiresAt ? new Date(x.pendingExpiresAt).getTime() - Date.now() : 0;
      const countdownTone = remainingMs <= 30 * 60 * 1000 ? "text-red-700 font-semibold" : remainingMs <= 2 * 60 * 60 * 1000 ? "text-red-700" : "text-neutral-500";
      const statusBlock = `${statusChip(x.status)}${countdown ? `<div class="mt-1 inline-flex items-center gap-1 text-[11px] ${countdownTone}">${I("clock", 14)}<span>${X(countdown)}</span></div>` : ""}`;
      const menu = menuWrap([
        menuItem({ label: "Одобрить", icon: "userCheck", attrs: `data-act="os" data-id="${x.id}" data-status="approved" data-note="${X(x.adminNote || "")}"` }),
        menuItem({ label: "Связались", icon: "message", attrs: `data-act="os" data-id="${x.id}" data-status="contacted" data-note="${X(x.adminNote || "")}"` }),
        menuItem({ label: "Ожидает оплаты", icon: "creditCard", attrs: `data-act="os" data-id="${x.id}" data-status="paid" data-note="${X(x.adminNote || "")}"` }),
        menuItem({ label: "Отклонить", icon: "xCircle", attrs: `data-act="os" data-id="${x.id}" data-status="rejected" data-note="${X(x.adminNote || "")}"`, danger: true }),
        menuSeparator(),
        menuItem({ label: "Открыть профиль", icon: "external", attrs: profileHref ? `data-act="open-url" data-url="${profileHref}"` : 'disabled="disabled"' }),
        menuItem({ label: "Написать в Telegram", icon: "send", attrs: username ? `data-act="open-url" data-url="https://t.me/${encodeURIComponent(username)}"` : 'disabled="disabled"' }),
        x.slugState === "pending" && x.status !== "expired" ? menuItem({ label: "Продлить 24 часа", icon: "clock", attrs: `data-act="ope" data-id="${x.id}"` }) : "",
        menuSeparator(),
        menuItem({ label: "Удалить", icon: "trash", attrs: `data-act="od" data-id="${x.id}"`, danger: true }),
      ].join(""));
      return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${P(x.slugPrice)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Базовый"}</td><td class="px-4 py-3">${x.bracelet ? "Да" : "Нет"}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3">${statusBlock}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
    }).join("") : `<tr><td colspan="9" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>Нет заявок</span></div></td></tr>`;
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
      sort: getFormValue(form, "sort", "created_desc"),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ u_q: q.q, u_sort: q.sort, u_page: q.page });
    const r = await fetch(`/api/admin/users?${Q(q)}`);
    if (!r.ok) {
      const msg = await E(r);
      table.innerHTML = `<tr><td colspan="10" class="px-3 py-8 text-center text-red-700">Не удалось загрузить пользователей: ${X(msg)}</td></tr>`;
      return;
    }
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows
          .map((x) => {
            const slugText = Array.isArray(x.slugs) && x.slugs.length ? x.slugs.map((s) => `${s.fullSlug} (${s.status}${s.hasBracelet ? ", bracelet" : ""})`).join(", ") : "—";
            const primarySlug =
              Array.isArray(x.slugs) && x.slugs.length
                ? x.slugs.find((s) => ["active", "private", "paused", "approved"].includes(s.status))?.fullSlug || x.slugs[0].fullSlug
                : null;
            const profileLink = primarySlug ? `/${encodeURIComponent(primarySlug)}` : x.username ? `https://t.me/${encodeURIComponent(x.username)}` : null;
            const statusLabel = x.status === "blocked" ? "Заблокирован" : x.status === "deactivated" ? "Деактивирован" : "Активен";
            const braceletSlugs = Array.isArray(x.slugs) ? x.slugs.filter((s) => s.hasBracelet).map((s) => s.fullSlug).join(",") : "";
            const expiryBadge = x.isExpiredPlan ? '<span class="ml-1 inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Истёк</span>' : "";
            const score = Number(x.unqScore?.score || 0);
            const scoreBreakdown = x.unqScore?.breakdown || {};
            const menu = menuWrap([
              menuItem({ label: "Сменить тариф", icon: "crown", attrs: `data-act="up" data-id="${X(x.telegramId)}" data-current-plan="${X(x.plan)}" data-active-slugs="${Number(x.activeSlugCount || 0)}" data-bracelet-slugs="${X(braceletSlugs)}"` }),
              menuItem({ label: "Продлить тариф", icon: "calendar", attrs: `data-act="ux" data-id="${X(x.telegramId)}"` }),
              menuSeparator(),
              menuItem({ label: "Открыть профиль", icon: "external", attrs: profileLink ? `data-act="open-url" data-url="${profileLink}"` : 'disabled="disabled"' }),
              menuSeparator(),
              menuItem({ label: x.status === "blocked" ? "Разблокировать" : "Заблокировать", icon: "shieldOff", attrs: `data-act="ub" data-id="${X(x.telegramId)}" data-status="${X(x.status)}"`, danger: x.status !== "blocked" }),
            ].join(""));
            return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.username ? `@${x.username}` : x.telegramId)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3"><span class="inline-flex rounded-full border border-neutral-200 px-2 py-1 text-xs font-medium">${x.plan === "premium" ? "Премиум" : "Базовый"}</span></td><td class="px-4 py-3 text-xs text-neutral-600">${x.planExpiresAt ? D(x.planExpiresAt) : "—"} ${expiryBadge}</td><td class="px-4 py-3 text-xs">${X(slugText)}</td><td class="px-4 py-3">${x.hasCard ? "Есть" : "Нет"}</td><td class="px-4 py-3"><button type="button" data-act="toggle-score" data-id="${X(x.telegramId)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-sm font-semibold">${score}</button></td><td class="px-4 py-3">${statusChip(x.status === "blocked" ? "rejected" : "approved")}</td><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr><tr class="border-t border-neutral-100 hidden" data-score-row="${X(x.telegramId)}"><td colspan="10" class="px-4 py-2 text-xs text-neutral-600">Просмотры: ${Number(scoreBreakdown.views || 0)} | Редкость: ${Number(scoreBreakdown.slugRarity || 0)} | Срок: ${Number(scoreBreakdown.tenure || 0)} | CTR: ${Number(scoreBreakdown.ctr || 0)} | Браслет: ${Number(scoreBreakdown.bracelet || 0)} | Тариф: ${Number(scoreBreakdown.plan || 0)}</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="10" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("userCheck", 48)}<span>Нет пользователей</span></div></td></tr>`;
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
      ? rows.map((x) => {
        const menu = menuWrap([
          menuItem({ label: "Активировать", icon: "checkCircle", attrs: `data-act="sa" data-slug="${x.slug}"` }),
          menuItem({ label: x.state === "BLOCKED" ? "Разблокировать" : "Заблокировать", icon: x.state === "BLOCKED" ? "toggleRight" : "toggleLeft", attrs: `data-act="st" data-slug="${x.slug}" data-ns="${x.state === "BLOCKED" ? "free" : "blocked"}"` }),
          menuItem({ label: "Изменить цену", icon: "pen", attrs: `data-act="sp" data-slug="${x.slug}" data-p="${x.priceOverride ?? ""}"` }),
          menuSeparator(),
          menuItem({ label: "Открыть визитку", icon: "external", attrs: `data-act="open-url" data-url="/${encodeURIComponent(x.slug)}"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${statusChip(x.state === "BLOCKED" ? "rejected" : x.state === "TAKEN" ? "approved" : "new")}</td><td class="px-4 py-3">${X(x.ownerName || "-")}</td><td class="px-4 py-3">${x.isPrimary ? "Да" : "Нет"}</td><td class="px-4 py-3">${typeof x.effectivePrice === "number" ? P(x.effectivePrice) : "-"}</td><td class="px-4 py-3">${x.requestedAt ? D(x.requestedAt) : "-"}</td><td class="px-4 py-3">${x.approvedAt ? D(x.approvedAt) : "-"}</td><td class="px-4 py-3">${x.activatedAt ? D(x.activatedAt) : "-"}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : `<tr><td colspan="9" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("link2", 48)}<span>Нет данных</span></div></td></tr>`;
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
      ? rows.map((x) => {
        const menu = menuWrap([
          menuItem({ label: "Открыть визитку", icon: "eye", attrs: `data-act="open-url" data-url="/${encodeURIComponent(x.slug)}"` }),
          menuItem({ label: "Редактировать", icon: "pen", attrs: `data-act="open-url" data-url="/admin/cards/${x.id}/edit"` }),
          menuItem({ label: "Сменить тариф", icon: "crown", attrs: `data-act="ct" data-id="${x.id}"` }),
          menuSeparator(),
          menuItem({ label: x.isActive ? "Выключить" : "Включить", icon: x.isActive ? "toggleLeft" : "toggleRight", attrs: `data-act="cg" data-id="${x.id}" data-n="${x.isActive ? 0 : 1}"` }),
          menuItem({ label: "QR-код", icon: "qr", attrs: `data-act="qr" data-slug="${x.slug}"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">#${X(x.slug)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Базовый"}</td><td class="px-4 py-3">${statusChip(x.isActive ? "approved" : "rejected")}</td><td class="px-4 py-3">${Number(x.viewsCount || 0).toLocaleString("ru-RU")}</td><td class="px-4 py-3">${new Date(x.createdAt).toLocaleDateString("ru-RU")}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : `<tr><td colspan="7" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>Нет данных</span></div></td></tr>`;
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
      ? rows.map((x) => {
        const menu = menuWrap([
          menuItem({ label: "Заказан", icon: "package", attrs: `data-act="bs" data-id="${x.id}" data-status="ORDERED"` }),
          menuItem({ label: "Отправлен", icon: "truck", attrs: `data-act="bs" data-id="${x.id}" data-status="SHIPPED"` }),
          menuItem({ label: "Доставлен", icon: "checkCircle", attrs: `data-act="bs" data-id="${x.id}" data-status="DELIVERED"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3"><div class="flex items-center justify-between gap-2">${statusChip(x.deliveryStatus)}<div class="admin-row-actions">${menu}</div></div></td></tr>`;
      }).join("")
      : `<tr><td colspan="5" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("package", 48)}<span>Нет заказов</span></div></td></tr>`;
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
      const menu = menuWrap([
        menuItem({ label: x.isVisible ? "Скрыть" : "Показать", icon: "eye", attrs: `data-act="tv" data-id="${x.id}" data-n="${x.isVisible ? 0 : 1}"` }),
        menuItem({ label: "Редактировать", icon: "pen", attrs: `data-act="te" data-json="${data}"` }),
        menuSeparator(),
        menuItem({ label: "Удалить", icon: "trash", attrs: `data-act="td" data-id="${x.id}"`, danger: true }),
      ].join(""));
      return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Базовый"}</td><td class="px-4 py-3">${X(x.text)}</td><td class="px-4 py-3">${statusChip(x.isVisible ? "approved" : "muted")}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("message", 48)}<span>Нет отзывов</span></div></td></tr>`;
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

  async function loadScoreManagement() {
    const table = document.getElementById("score-table");
    const runsTable = document.getElementById("score-runs-table");
    const visibilityToggle = document.getElementById("score-visibility-toggle");
    if (!(table instanceof HTMLElement) || !(runsTable instanceof HTMLElement)) return;

    const [overviewRes, runsRes, settingsRes] = await Promise.all([
      fetch("/api/admin/score/overview"),
      fetch("/api/admin/score/runs"),
      fetch("/api/admin/score/settings"),
    ]);
    if (!overviewRes.ok) return;
    const overview = await overviewRes.json();
    const runs = runsRes.ok ? await runsRes.json() : { items: [] };
    const settings = settingsRes.ok ? await settingsRes.json() : { settings: { enabledOnCards: true } };

    table.innerHTML = (overview.items || []).length
      ? overview.items.map((x) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.userName)}</td><td class="px-4 py-3 font-mono">${X(x.slug || "—")}</td><td class="px-4 py-3 text-lg font-black">${Number(x.score || 0)}</td><td class="px-4 py-3">Топ ${Math.max(1, Math.ceil(100 - Number(x.percentile || 0)))}%</td><td class="px-4 py-3 text-xs">${D(x.calculatedAt)}</td><td class="px-4 py-3"><button type="button" data-act="score-recalc-one" data-id="${X(x.telegramId)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold">Пересчитать</button></td></tr>`).join("")
      : '<tr><td colspan="6" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>';

    runsTable.innerHTML = (runs.items || []).length
      ? runs.items.map((x) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${D(x.startedAt)}</td><td class="px-3 py-2">${Number(x.processedUsers || 0)}</td><td class="px-3 py-2">${Number(x.averageMsPerUser || 0).toFixed(2)} мс</td></tr>`).join("")
      : '<tr><td colspan="3" class="px-3 py-8 text-center text-neutral-500">Запусков пока нет</td></tr>';

    if (visibilityToggle instanceof HTMLInputElement) {
      visibilityToggle.checked = Boolean(settings.settings?.enabledOnCards);
    }
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
    if (!r.ok) return showAlert(await E(r));
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
    if (!r.ok) return showAlert(await E(r));
    closeTe();
    void loadTestimonials();
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    const toggle = target instanceof Element ? target.closest("[data-kebab-toggle]") : null;
    if (toggle instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      const wrap = toggle.closest(".admin-row-actions");
      const menu = wrap?.querySelector(".admin-row-menu");
      if (!(menu instanceof HTMLElement)) return;
      const isOpen = !menu.classList.contains("is-hidden");
      closeAllRowMenus();
      if (!isOpen) {
        menu.classList.remove("is-hidden");
        menu.classList.add("is-floating");
        positionRowMenu(menu, toggle);
        openRowMenu = menu;
        openRowToggle = toggle;
        toggle.setAttribute("aria-expanded", "true");
      }
      return;
    }
    if (!(target instanceof Element) || !target.closest(".admin-row-actions")) {
      closeAllRowMenus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllRowMenus();
  });
  window.addEventListener("resize", repositionOpenRowMenu);
  window.addEventListener(
    "scroll",
    () => {
      if (openRowMenu) closeAllRowMenus();
    },
    true,
  );
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches('[data-act="os"]') && t instanceof HTMLSelectElement) {
      const id = t.getAttribute("data-id");
      if (!id) return;
      const previousNote = t.getAttribute("data-note") || "";
      let adminNote = previousNote;
      if (t.value === "rejected") {
        const entered = await showPrompt("Причина отклонения (будет отправлена в Telegram)", previousNote);
        if (entered === null) return;
        adminNote = entered;
      }
      const r = await fetch(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ status: t.value, adminNote }) });
      if (!r.ok) showAlert(await E(r));
      else void loadOrders();
    }
    if (t.matches('[data-act="bs"]') && t instanceof HTMLSelectElement) {
      const id = t.getAttribute("data-id");
      if (!id) return;
      const r = await fetch(`/api/admin/bracelet-orders/${id}/status`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ deliveryStatus: t.value }) });
      if (!r.ok) showAlert(await E(r));
    }
    if (t.matches('[data-act="ct"]') && t instanceof HTMLSelectElement) {
      const id = t.getAttribute("data-id");
      if (!id) return;
      const r = await fetch(`/api/admin/cards/${id}/tariff`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ tariff: t.value }) });
      if (!r.ok) showAlert(await E(r));
    }
    if (t.matches('[data-act="up"]') && t instanceof HTMLSelectElement) {
      const telegramId = t.getAttribute("data-id");
      if (!telegramId) return;
      const prevPlan = t.getAttribute("data-current-plan") || "basic";
      const activeSlugs = Number(t.getAttribute("data-active-slugs") || "0");
      const braceletSlugs = String(t.getAttribute("data-bracelet-slugs") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const downgradeToBasic = prevPlan === "premium" && t.value === "basic" && activeSlugs > 1;
      if (downgradeToBasic) {
        const braceletNote = braceletSlugs.length ? `\nБраслет привязан к: ${braceletSlugs.join(", ")}.` : "";
        const ok = await showConfirm(`У пользователя ${activeSlugs} slug. При переходе на Базовый будет активен только основной. Продолжить?${braceletNote}`);
        if (!ok) {
          t.value = prevPlan;
          return;
        }
      }
      let r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: t.value, force: downgradeToBasic }) });
      if (r.status === 409 && !downgradeToBasic) {
        const payload = await r.json().catch(() => ({}));
        if (payload.code === "PLAN_DOWNGRADE_CONFIRMATION_REQUIRED") {
          const cnt = Number(payload.activeSlugCount || activeSlugs || 2);
          const braceletNote = braceletSlugs.length ? `\nБраслет привязан к: ${braceletSlugs.join(", ")}.` : "";
          const ok = await showConfirm(`У пользователя ${cnt} slug. При переходе на Базовый будет активен только основной. Продолжить?${braceletNote}`);
          if (!ok) {
            t.value = prevPlan;
            return;
          }
          r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: "basic", force: true }) });
        }
      }
      if (!r.ok) {
        showAlert(await E(r));
        t.value = prevPlan;
      } else {
        void loadUsers();
      }
    }
  });

  document.addEventListener("click", async (e) => {
    const target = e.target;
    const n = target instanceof Element ? target.closest("[data-act]") : null;
    if (!(n instanceof HTMLElement)) return;
    const a = n.getAttribute("data-act");
    closeAllRowMenus();
    if (a === "open-url") {
      const url = n.getAttribute("data-url");
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      closeAllRowMenus();
      return;
    }
    if (a === "os") {
      const id = n.getAttribute("data-id");
      const status = n.getAttribute("data-status");
      const previousNote = n.getAttribute("data-note") || "";
      if (!id || !status) return;
      let adminNote = previousNote;
      if (status === "rejected") {
        const entered = await showPrompt("Причина отклонения (будет отправлена в Telegram)", previousNote);
        if (entered === null) return;
        adminNote = entered;
      }
      const r = await fetch(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ status, adminNote }) });
      if (!r.ok) showAlert(await E(r));
      else void loadOrders();
      closeAllRowMenus();
      return;
    }
    if (a === "bs") {
      const id = n.getAttribute("data-id");
      const deliveryStatus = n.getAttribute("data-status");
      if (!id || !deliveryStatus) return;
      const r = await fetch(`/api/admin/bracelet-orders/${id}/status`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ deliveryStatus }) });
      if (!r.ok) showAlert(await E(r));
      else void loadBracelets();
      closeAllRowMenus();
      return;
    }
    if (a === "ct") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const tariff = String(await showPrompt("Новый тариф: basic или premium", "basic") || "").trim().toLowerCase();
      if (!["basic", "premium"].includes(tariff)) return;
      const r = await fetch(`/api/admin/cards/${id}/tariff`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ tariff }) });
      if (!r.ok) showAlert(await E(r));
      else void loadCards();
      closeAllRowMenus();
      return;
    }
    if (a === "up") {
      const telegramId = n.getAttribute("data-id");
      if (!telegramId) return;
      const prevPlan = n.getAttribute("data-current-plan") || "basic";
      const activeSlugs = Number(n.getAttribute("data-active-slugs") || "0");
      const braceletSlugs = String(n.getAttribute("data-bracelet-slugs") || "").split(",").map((x) => x.trim()).filter(Boolean);
      const entered = String(await showPrompt("Новый тариф: basic или premium", prevPlan) || "").trim().toLowerCase();
      if (!["basic", "premium"].includes(entered) || entered === prevPlan) return;
      const downgradeToBasic = prevPlan === "premium" && entered === "basic" && activeSlugs > 1;
      if (downgradeToBasic) {
        const braceletNote = braceletSlugs.length ? `\nБраслет привязан к: ${braceletSlugs.join(", ")}.` : "";
        const ok = await showConfirm(`У пользователя ${activeSlugs} slug. При переходе на Базовый будет активен только основной. Продолжить?${braceletNote}`);
        if (!ok) return;
      }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: entered, force: downgradeToBasic }) });
      if (!r.ok) showAlert(await E(r));
      else void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "oa") openA(n.getAttribute("data-id") || "", n.getAttribute("data-t") || "basic", n.getAttribute("data-th") || "default_dark");
    if (a === "od") { const id = n.getAttribute("data-id"); if (!id || !await showConfirm("Удалить заявку?")) return; const r = await fetch(`/api/admin/orders/${id}`, { method: "DELETE", headers: H() }); if (!r.ok) showAlert(await E(r)); else void loadOrders(); }
    if (a === "ope") { const id = n.getAttribute("data-id"); if (!id) return; const r = await fetch(`/api/admin/orders/${id}/extend-pending`, { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadOrders(); }
    if (a === "ux") { const telegramId = n.getAttribute("data-id"); if (!telegramId) return; const input = await showPrompt("Новая дата окончания (YYYY-MM-DD) или пусто для сброса", ""); if (input === null) return; const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan-expiry`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ planExpiresAt: input.trim() ? `${input.trim()}T23:59:59.000Z` : null }) }); if (!r.ok) showAlert(await E(r)); else void loadUsers(); }
    if (a === "ub") { const telegramId = n.getAttribute("data-id"); const status = n.getAttribute("data-status"); if (!telegramId) return; const isBlocked = status === "blocked"; if (!isBlocked && !await showConfirm("Заблокировать пользователя и деактивировать его slug?")) return; if (isBlocked && !await showConfirm("Разблокировать пользователя и восстановить статусы slug?")) return; const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/${isBlocked ? "unblock" : "block"}`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadUsers(); }
    if (a === "st") { const slug = n.getAttribute("data-slug"), state = n.getAttribute("data-ns"); if (!slug || !state) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/state`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ state }) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "sa") { const slug = n.getAttribute("data-slug"); if (!slug) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/activate`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "sp") { const slug = n.getAttribute("data-slug"), cur = n.getAttribute("data-p") || ""; if (!slug) return; const x = await showPrompt("Новая цена slug (пусто = убрать override)", cur); if (x === null) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/price-override`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ priceOverride: x.trim() ? Number(x.trim()) : null }) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "cg") { const id = n.getAttribute("data-id"), isActive = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/cards/${id}/toggle-active`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isActive }) }); if (!r.ok) showAlert(await E(r)); else void loadCards(); }
    if (a === "qr") { const slug = n.getAttribute("data-slug"); if (slug) await openQ(slug); }
    if (a === "tv") { const id = n.getAttribute("data-id"), isVisible = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/testimonials/${id}/visibility`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isVisible }) }); if (!r.ok) showAlert(await E(r)); else void loadTestimonials(); }
    if (a === "td") { const id = n.getAttribute("data-id"); if (!id || !await showConfirm("Удалить отзыв?")) return; const r = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE", headers: H() }); if (!r.ok) showAlert(await E(r)); else void loadTestimonials(); }
    if (a === "te") { const encoded = n.getAttribute("data-json"); if (!encoded) return; try { openTe(JSON.parse(decodeURIComponent(encoded))); } catch {} }
    if (a === "toggle-score") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const row = document.querySelector(`[data-score-row="${id}"]`);
      if (row instanceof HTMLElement) {
        row.classList.toggle("hidden");
      }
      return;
    }
    if (a === "score-recalc-one") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const r = await fetch(`/api/admin/score/recalculate/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) showAlert(await E(r));
      else {
        if (tab === "score") void loadScoreManagement();
        if (tab === "users") void loadUsers();
      }
      return;
    }
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
    if (!r.ok) showAlert(await E(r)); else { f.reset(); initialQuery.t_page = "1"; void loadTestimonials(); }
  });
  document.getElementById("cleanup-logs-btn")?.addEventListener("click", async () => {
    const r = await fetch("/api/admin/logs/cleanup", { method: "POST", headers: H() });
    if (!r.ok) showAlert(await E(r)); else void loadLogs();
  });
  document.getElementById("score-recalculate-all-btn")?.addEventListener("click", async () => {
    const r = await fetch("/api/admin/score/recalculate-all", { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) });
    if (!r.ok) showAlert(await E(r));
    else void loadScoreManagement();
  });
  document.getElementById("score-visibility-toggle")?.addEventListener("change", async (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const r = await fetch("/api/admin/score/settings", {
      method: "PATCH",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({ enabledOnCards: target.checked }),
    });
    if (!r.ok) showAlert(await E(r));
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
      setFormValue(form, "sort", getInitial("u_sort", "sort") || "created_desc");
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
  if (tab === "score") void loadScoreManagement();
})();


