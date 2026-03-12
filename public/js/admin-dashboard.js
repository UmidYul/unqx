
(function () {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;

  const autofillIgnoreSelectors = "form,input,textarea,select";
  const autofillIgnoreAttrs = ["data-bwignore", "data-lpignore", "data-1p-ignore"];

  function markAutofillIgnored(root) {
    if (!(root instanceof Element) && root !== document) return;
    const nodes = root === document
      ? Array.from(document.querySelectorAll(autofillIgnoreSelectors))
      : [root, ...Array.from(root.querySelectorAll(autofillIgnoreSelectors))];

    nodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      autofillIgnoreAttrs.forEach((attr) => {
        node.setAttribute(attr, "true");
      });
      if (node instanceof HTMLInputElement) {
        if (node.type === "password") {
          node.setAttribute("autocomplete", "new-password");
        }
        if (node.type === "text" && !node.hasAttribute("autocomplete")) {
          node.setAttribute("autocomplete", "off");
        }
      }
      if ((node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) && !node.hasAttribute("autocomplete")) {
        node.setAttribute("autocomplete", "off");
      }
    });
  }

  markAutofillIgnored(document);
  const autofillObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((added) => {
        if (added instanceof Element) {
          markAutofillIgnored(added);
        }
      });
    });
  });
  autofillObserver.observe(body, { childList: true, subtree: true });

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
  const P = (v) => `${Number(v || 0).toLocaleString("ru-RU")} СЃСѓРј`;
  const formatPendingCountdown = (iso) => {
    if (!iso) return "";
    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) return "";
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return "РІСЂРµРјСЏ РІС‹С€Р»Рѕ";
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `РѕСЃС‚Р°Р»РѕСЃСЊ ${hours}С‡ ${minutes}РјРёРЅ`;
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
  const normalizeShortSlug = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const isShortSlug = (value) => /^[A-Z]{3}[0-9]{3}$/.test(String(value || ""));
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
  const THEME_META = {
    default_dark: { label: "Obsidian Noir", fill: "#0a0a0a", border: "#ffffff", text: "#111111" },
    arctic: { label: "Glacier Platinum", fill: "#f0f5f9", border: "#7a9db8", text: "#1a2a3a" },
    linen: { label: "Imperial Linen", fill: "#f2ede6", border: "#c8a882", text: "#3a2e24" },
    marble: { label: "Carrara Prestige", fill: "#ffffff", border: "#0a0a0a", text: "#0a0a0a" },
    forest: { label: "Emerald Reserve", fill: "#1f5335", border: "#e7dbbf", text: "#e7dbbf" },
    sage_luxe: { label: "Verdant Luxe", fill: "#ecf2ee", border: "#7f927f", text: "#2f3e33" },
    midnight_obsidian: { label: "Midnight Obsidian", fill: "#111927", border: "#5374a6", text: "#d6e6ff" },
  };
  function themePill(theme) {
    const id = String(theme || "default_dark").trim();
    const meta = THEME_META[id] || THEME_META.default_dark;
    const bg = `linear-gradient(90deg, ${meta.fill} 0%, ${meta.fill} 14px, transparent 14px, transparent 100%)`;
    return `<span class="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold" style="border-color:${meta.border};color:${meta.text};background:${bg};">${X(meta.label)}</span>`;
  }
  const I = (name, size = 14) => `<svg class="admin-i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const statusMeta = {
    pending: { label: "РќР° СЂР°СЃСЃРјРѕС‚СЂРµРЅРёРё", tone: "warning" },
    verification_approved: { label: "РћРґРѕР±СЂРµРЅРѕ", tone: "success" },
    verification_rejected: { label: "РћС‚РєР»РѕРЅРµРЅРѕ", tone: "danger" },
    new: { label: "РќРѕРІР°СЏ", tone: "info" },
    contacted: { label: "РЎРІСЏР·Р°Р»РёСЃСЊ", tone: "muted" },
    paid: { label: "РћРїР»Р°С‡РµРЅРѕ", tone: "warning" },
    approved: { label: "РђРєС‚РёРІРёСЂРѕРІР°РЅРѕ", tone: "success" },
    rejected: { label: "РћС‚РєР»РѕРЅРµРЅРѕ", tone: "danger" },
    expired: { label: "РћС‚РєР»РѕРЅРµРЅРѕ", tone: "muted" },
    muted: { label: "РЎРєСЂС‹С‚", tone: "muted" },
    ORDERED: { label: "Р—Р°РєР°Р·Р°РЅ", tone: "warning" },
    SHIPPED: { label: "РћС‚РїСЂР°РІР»РµРЅ", tone: "info" },
    DELIVERED: { label: "Р”РѕСЃС‚Р°РІР»РµРЅ", tone: "success" },
  };
  function statusChip(code) {
    const m = statusMeta[code] || { label: String(code || "-"), tone: "muted" };
    return `<span class="admin-status-chip is-${m.tone}"><span class="admin-status-dot"></span>${X(m.label)}</span>`;
  }
  function kebabButton() {
    return `<button type="button" class="admin-kebab-btn" data-kebab-toggle aria-label="Р”РµР№СЃС‚РІРёСЏ" aria-haspopup="menu" aria-expanded="false">${I("more", 16)}</button>`;
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
    prev.textContent = "в†ђ РќР°Р·Р°Рґ";
    prev.disabled = page <= 1;
    prev.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";
    prev.addEventListener("click", () => onPage(page - 1));

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Р’РїРµСЂС‘Рґ";
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

  function syncVerificationFiltersFromLocation(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const params = new URLSearchParams(location.search);
    const statusFromUrl = String(params.get("v_status") || params.get("status") || "all").trim().toLowerCase();
    const pageFromUrl = String(params.get("v_page") || params.get("page") || "1").trim();
    const allowedStatuses = new Set(["all", "pending", "approved", "rejected"]);
    setFormValue(form, "status", allowedStatuses.has(statusFromUrl) ? statusFromUrl : "all");
    setFormValue(form, "page", /^\d+$/.test(pageFromUrl) ? pageFromUrl : "1");
  }

  async function loadMaintenanceBanner() {
    const banner = document.getElementById("admin-maintenance-banner");
    const textNode = document.getElementById("admin-maintenance-text");
    const disableBtn = document.getElementById("admin-maintenance-disable");
    if (!(banner instanceof HTMLElement) || !(textNode instanceof HTMLElement) || !(disableBtn instanceof HTMLButtonElement)) return;
    try {
      const response = await fetch("/api/admin/settings/platform");
      if (!response.ok) return;
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      const asMap = new Map(items.map((item) => [item.key, item.value]));
      const enabled = Boolean(asMap.get("maintenance_mode"));
      banner.classList.toggle("hidden", !enabled);
      const message = String(asMap.get("maintenance_message") || "").trim();
      textNode.textContent = enabled
        ? `Р РµР¶РёРј РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ РІРєР»СЋС‡С‘РЅ - СЃР°Р№С‚ РЅРµРґРѕСЃС‚СѓРїРµРЅ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№${message ? `. ${message}` : ""}`
        : "";
      disableBtn.onclick = async () => {
        disableBtn.disabled = true;
        const r = await fetch("/api/admin/settings/platform", {
          method: "PATCH",
          headers: H({ "Content-Type": "application/json" }),
          body: JSON.stringify({ maintenance_mode: false }),
        });
        disableBtn.disabled = false;
        if (!r.ok) {
          await showAlert(await E(r));
          return;
        }
        banner.classList.add("hidden");
      };
    } catch {
      // ignore banner load failures
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
    const breakdown = s.breakdown || {};
    const breakdownLines = [
      `Slug: ${P(breakdown.slug || 0)}`,
      `Р‘Р°Р·РѕРІС‹Р№: ${P(breakdown.basicPlan || 0)}`,
      `РџСЂРµРјРёСѓРј: ${P(breakdown.premiumPlan || 0)}`,
      `Р‘СЂР°СЃР»РµС‚С‹: ${P(breakdown.bracelet || 0)}`,
    ];
    kpi.innerHTML = [
      { n: "РќРѕРІС‹С… Р·Р°СЏРІРѕРє СЃРµРіРѕРґРЅСЏ", v: s.newOrdersToday || 0, i: "userCheck" },
      { n: "Р’С‹СЂСѓС‡РєР° СЃРµРіРѕРґРЅСЏ", v: P(s.revenueToday || 0), i: "creditCard" },
      { n: "Р’С‹СЂСѓС‡РєР° Р·Р° 30 РґРЅРµР№", v: P(s.revenue30Days || 0), i: "calendar" },
      { n: "Р’С‹СЂСѓС‡РєР° РІСЃРµРіРѕ", v: P(s.revenueTotal || 0), i: "link2" },
      { n: "РЎСЂРµРґРЅРёР№ UNQ Score", v: Number(s.averageUnqScore || 0).toLocaleString("ru-RU"), i: "chart" },
      {
        n: "Р Р°Р·Р±РёРІРєР°",
        lines: breakdownLines,
        i: "package",
      },
    ]
      .map((x) => {
        const valueMarkup = Array.isArray(x.lines)
          ? `<ul class="admin-kpi-list">${x.lines.map((line) => `<li>${X(line)}</li>`).join("")}</ul>`
          : `<p class="admin-kpi-value">${X(x.v)}</p>`;
        return `<article class="admin-kpi-card"><div class="admin-kpi-icon">${I(x.i, 20)}</div>${valueMarkup}<p class="admin-kpi-label">${x.n}</p></article>`;
      })
      .join("");
    const top = p.topUnboughtPatterns || [];
    table.innerHTML = top.length ? top.map((x) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2 font-mono">${X(x.pattern)}</td><td class="px-3 py-2 font-semibold">${x.count}</td></tr>`).join("") : '<tr><td colspan="2" class="px-3 py-8 text-center text-neutral-500">РќРµС‚ РґР°РЅРЅС‹С…</td></tr>';
    if (typeof Chart !== "undefined") {
      const d = p.revenueDaily || [];
      new Chart(document.getElementById("analytics-orders-chart"), {
        type: "line",
        data: { labels: d.map((x) => x.date), datasets: [{ label: "Р’С‹СЂСѓС‡РєР°", data: d.map((x) => x.amount), borderColor: "#111827", tension: 0.25 }] },
        options: { responsive: true, maintainAspectRatio: false },
      });
      new Chart(document.getElementById("analytics-tariff-chart"), {
        type: "pie",
        data: {
          labels: ["Slug", "Р‘Р°Р·РѕРІС‹Р№ С‚Р°СЂРёС„", "РџСЂРµРјРёСѓРј С‚Р°СЂРёС„", "Р‘СЂР°СЃР»РµС‚С‹"],
          datasets: [
            {
              data: [
                breakdown.slug || 0,
                breakdown.basicPlan || 0,
                breakdown.premiumPlan || 0,
                breakdown.bracelet || 0,
              ],
              backgroundColor: ["#111827", "#374151", "#6b7280", "#d1d5db"],
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
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
        menuItem({ label: "РћРґРѕР±СЂРёС‚СЊ", icon: "userCheck", attrs: `data-act="os" data-id="${x.id}" data-status="approved" data-note="${X(x.adminNote || "")}"` }),
        menuItem({ label: "РЎРІСЏР·Р°Р»РёСЃСЊ", icon: "message", attrs: `data-act="os" data-id="${x.id}" data-status="contacted" data-note="${X(x.adminNote || "")}"` }),
        menuItem({ label: "РћРїР»Р°С‡РµРЅРѕ", icon: "creditCard", attrs: `data-act="os" data-id="${x.id}" data-status="paid" data-note="${X(x.adminNote || "")}"` }),
        menuItem({ label: "РћС‚РєР»РѕРЅРёС‚СЊ", icon: "xCircle", attrs: `data-act="os" data-id="${x.id}" data-status="rejected" data-note="${X(x.adminNote || "")}"`, danger: true }),
        menuSeparator(),
        menuItem({ label: "РћС‚РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ", icon: "external", attrs: profileHref ? `data-act="open-url" data-url="${profileHref}"` : 'disabled="disabled"' }),
        menuItem({ label: "РќР°РїРёСЃР°С‚СЊ РІ Telegram", icon: "send", attrs: username ? `data-act="open-url" data-url="https://t.me/${encodeURIComponent(username)}"` : 'disabled="disabled"' }),
        x.slugState === "pending" && x.status !== "expired" ? menuItem({ label: "Р”РѕР±Р°РІРёС‚СЊ 24 С‡Р°СЃР°", icon: "clock", attrs: `data-act="ope" data-id="${x.id}"` }) : "",
        menuSeparator(),
        menuItem({ label: "РЈРґР°Р»РёС‚СЊ", icon: "trash", attrs: `data-act="od" data-id="${x.id}"`, danger: true }),
      ].join(""));
      return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${P(x.slugPrice)}</td><td class="px-4 py-3 font-semibold">${P(x.amount || 0)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "РџСЂРµРјРёСѓРј" : "Р‘Р°Р·РѕРІС‹Р№"}</td><td class="px-4 py-3">${x.bracelet ? "Р”Р°" : "РќРµС‚"}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3">${statusBlock}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
    }).join("") : `<tr><td colspan="10" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>РќРµС‚ Р·Р°СЏРІРѕРє</span></div></td></tr>`;
    renderPager("orders-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadOrders();
    });
  }

  async function loadPurchases() {
    const form = document.getElementById("purchases-filters");
    const table = document.getElementById("purchases-table");
    const totalNode = document.getElementById("purchases-total");
    const csv = document.getElementById("purchases-export-link");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement) || !(totalNode instanceof HTMLElement) || !(csv instanceof HTMLAnchorElement)) return;

    const q = {
      type: getFormValue(form, "type", "all"),
      user: getFormValue(form, "user", ""),
      dateFrom: getFormValue(form, "dateFrom", ""),
      dateTo: getFormValue(form, "dateTo", ""),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ p_type: q.type, p_user: q.user, p_date_from: q.dateFrom, p_date_to: q.dateTo, p_page: q.page });
    const filterQs = Q({ type: q.type, user: q.user, dateFrom: q.dateFrom, dateTo: q.dateTo });
    csv.href = `/api/admin/purchases/export.csv${filterQs ? `?${filterQs}` : ""}`;

    const r = await fetch(`/api/admin/purchases?${Q(q)}`);
    if (!r.ok) {
      table.innerHTML = `<tr><td colspan="6" class="px-3 py-8 text-center text-red-700">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїРѕРєСѓРїРєРё</td></tr>`;
      return;
    }
    const payload = await r.json();
    totalNode.textContent = `РћР±С‰Р°СЏ РІС‹СЂСѓС‡РєР°: ${P(payload.totalRevenue || 0)}`;

    const typeLabel = (type) => {
      if (type === "slug") return "Slug";
      if (type === "basic_plan") return "Р‘Р°Р·РѕРІС‹Р№ С‚Р°СЂРёС„";
      if (type === "premium_plan") return "РџСЂРµРјРёСѓРј С‚Р°СЂРёС„";
      if (type === "upgrade_to_premium") return "РђРїРіСЂРµР№Рґ РґРѕ РџСЂРµРјРёСѓРј";
      if (type === "bracelet") return "Р‘СЂР°СЃР»РµС‚";
      return type;
    };
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.purchasedAt)}</td><td class="px-4 py-3">${X(x.username ? `@${x.username}` : x.userName)}</td><td class="px-4 py-3"><span class="inline-flex rounded-full border border-neutral-200 px-2 py-1 text-xs font-medium">${X(typeLabel(x.type))}</span></td><td class="px-4 py-3 font-mono">${X(x.slug || "вЂ”")}</td><td class="px-4 py-3 font-semibold">${P(x.amount || 0)}</td><td class="px-4 py-3">${X(x.approvedByAdmin || "вЂ”")}</td></tr>`).join("")
      : `<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>РќРµС‚ РїРѕРєСѓРїРѕРє</span></div></td></tr>`;

    renderPager("purchases-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadPurchases();
    });
  }

  async function loadPricingSettings() {
    const form = document.getElementById("pricing-settings-form");
    if (!(form instanceof HTMLFormElement)) return;
    const r = await fetch("/api/admin/pricing/settings");
    if (!r.ok) return;
    const payload = await r.json();
    const settings = payload.settings || {};
    setFormValue(form, "planBasicPrice", String(Number(settings.planBasicPrice || 50000)));
    setFormValue(form, "planPremiumPrice", String(Number(settings.planPremiumPrice || 130000)));
    setFormValue(form, "premiumUpgradePrice", String(Number(settings.premiumUpgradePrice || 80000)));
    setFormValue(form, "pricingFootnote", String(settings.pricingFootnote || ""));
  }

  async function loadUsers() {
    const form = document.getElementById("users-filters");
    const table = document.getElementById("users-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = {
      q: getFormValue(form, "q", ""),
      plan: getFormValue(form, "plan", "all"),
      sort: getFormValue(form, "sort", "created_desc"),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ u_q: q.q, u_plan: q.plan, u_sort: q.sort, u_page: q.page });
    const r = await fetch(`/api/admin/users?${Q(q)}`);
    if (!r.ok) {
      const msg = await E(r);
      table.innerHTML = `<tr><td colspan="9" class="px-3 py-8 text-center text-red-700">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№: ${X(msg)}</td></tr>`;
      return;
    }
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows
        .map((x) => {
          const allSlugs = Array.isArray(x.slugs)
            ? x.slugs.map((s) => String(s.fullSlug || "").trim()).filter(Boolean)
            : [];
          const slugText = allSlugs.length
            ? allSlugs.length > 2
              ? `${allSlugs.slice(0, 2).join(", ")} +${allSlugs.length - 2}`
              : allSlugs.join(", ")
            : "вЂ”";
          const slugTitle = allSlugs.length ? allSlugs.join(", ") : "";
          const primarySlug =
            Array.isArray(x.slugs) && x.slugs.length
              ? x.slugs.find((s) => ["active", "private", "paused", "approved"].includes(s.status))?.fullSlug || x.slugs[0].fullSlug
              : null;
          const profileLink = primarySlug ? `/${encodeURIComponent(primarySlug)}` : x.username ? `https://t.me/${encodeURIComponent(x.username)}` : null;
          const braceletSlugs = Array.isArray(x.slugs) ? x.slugs.filter((s) => s.hasBracelet).map((s) => s.fullSlug).join(",") : "";
          const userSlugsCsv = allSlugs.join(",");
          const editSlugAttrs = allSlugs.length
            ? `data-act="us-edit" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"`
            : 'disabled="disabled"';
          const score = Number(x.unqScore?.score || 0);
          const scoreBreakdown = x.unqScore?.breakdown || {};
          const menu = menuWrap([
            menuItem({ label: "РЎРјРµРЅРёС‚СЊ С‚Р°СЂРёС„", icon: "crown", attrs: `data-act="up" data-id="${X(x.telegramId)}" data-current-plan="${X(x.plan)}" data-active-slugs="${Number(x.activeSlugCount || 0)}" data-bracelet-slugs="${X(braceletSlugs)}"` }),
            ...(x.isVerified ? [menuItem({ label: "РЎРЅСЏС‚СЊ РІРµСЂРёС„РёРєР°С†РёСЋ", icon: "xCircle", attrs: `data-act="uv" data-id="${X(x.telegramId)}"`, danger: true })] : []),
            menuItem({ label: "Р”РѕР±Р°РІРёС‚СЊ slug", icon: "link2", attrs: `data-act="us-add" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"` }),
            menuItem({ label: "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ slug", icon: "pen", attrs: editSlugAttrs }),
            menuItem({ label: "РЈРґР°Р»РёС‚СЊ slug", icon: "trash", attrs: `data-act="us-delete" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"`, danger: true }),
            menuSeparator(),
            menuItem({ label: "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РІРёР·РёС‚РєСѓ", icon: "pen", attrs: `data-act="open-url" data-url="/admin/users/${encodeURIComponent(String(x.telegramId || ""))}/card"` }),
            menuItem({ label: "РћС‚РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ", icon: "external", attrs: profileLink ? `data-act="open-url" data-url="${profileLink}"` : 'disabled="disabled"' }),
            menuItem({ label: "РќР°РєСЂСѓС‚РёС‚СЊ РїСЂРѕСЃРјРѕС‚СЂС‹", icon: "eye", attrs: `data-act="uvb" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"` }),
            menuSeparator(),
            menuItem({ label: x.status === "blocked" ? "Р Р°Р·Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ" : "Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ", icon: "shieldOff", attrs: `data-act="ub" data-id="${X(x.telegramId)}" data-status="${X(x.status)}"`, danger: x.status !== "blocked" }),
            menuItem({ label: "РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕР»РЅРѕСЃС‚СЊСЋ", icon: "trash", attrs: `data-act="ud" data-id="${X(x.telegramId)}" data-name="${X(x.name)}"`, danger: true }),
          ].join(""));
          const planLabel = x.plan === "premium" ? "РџСЂРµРјРёСѓРј" : x.plan === "basic" ? "Р‘Р°Р·РѕРІС‹Р№" : "Р‘РµР· С‚Р°СЂРёС„Р°";
          const planChipClass =
            x.plan === "none"
              ? "border-amber-300 bg-amber-50 text-amber-800 whitespace-nowrap"
              : "border-neutral-200 whitespace-nowrap";
          return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3">${X(x.city || "вЂ”")}</td><td class="px-4 py-3"><span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${planChipClass}">${planLabel}</span></td><td class="hidden px-4 py-3 text-xs text-neutral-600 xl:table-cell">${x.planPurchasedAt ? D(x.planPurchasedAt) : "вЂ”"}</td><td class="admin-col-slugs px-4 py-3 text-xs" title="${X(slugTitle)}">${X(slugText)}</td><td class="px-4 py-3"><button type="button" data-act="toggle-score" data-id="${X(x.telegramId)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-sm font-semibold">${score}</button></td><td class="px-4 py-3">${statusChip(x.status === "blocked" ? "rejected" : "approved")}</td><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr><tr class="border-t border-neutral-100 hidden" data-score-row="${X(x.telegramId)}"><td colspan="9" class="px-4 py-2 text-xs text-neutral-600">РџСЂРѕСЃРјРѕС‚СЂС‹: ${Number(scoreBreakdown.views || 0)} | Р РµРґРєРѕСЃС‚СЊ: ${Number(scoreBreakdown.slugRarity || 0)} | РЎСЂРѕРє: ${Number(scoreBreakdown.tenure || 0)} | CTR: ${Number(scoreBreakdown.ctr || 0)} | Р‘СЂР°СЃР»РµС‚: ${Number(scoreBreakdown.bracelet || 0)} | РўР°СЂРёС„: ${Number(scoreBreakdown.plan || 0)}</td></tr>`;
        })
        .join("")
      : `<tr><td colspan="9" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("userCheck", 48)}<span>РќРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№</span></div></td></tr>`;
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
      stats.innerHTML = [["Р’СЃРµРіРѕ slugРѕРІ", s.total], ["Р—Р°РЅСЏС‚Рѕ", s.taken], ["РЎРІРѕР±РѕРґРЅРѕ", s.free], ["Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ", s.blocked]].map(([n, v]) => `<div class="rounded-2xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">${n}</p><p class="mt-2 text-2xl font-black">${Number(v || 0).toLocaleString("ru-RU")}</p></div>`).join("");
    }

    const q = { q: getFormValue(form, "q", ""), state: getFormValue(form, "state", "all"), page: getFormValue(form, "page", "1") };
    setDashboardQuery({ s_q: q.q, s_state: q.state, s_page: q.page });
    const r = await fetch(`/api/admin/slugs?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    const searchedSlug = String(q.q || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const canCreateBySearch = rows.length === 0 && /^[A-Z]{3}[0-9]{3}$/.test(searchedSlug);
    table.innerHTML = rows.length
      ? rows.map((x) => {
        const priceValue = typeof x.effectivePrice === "number" ? P(x.effectivePrice) : "-";
        const priceCell = `<span>${priceValue}</span>`;
        const menu = menuWrap([
          menuItem({ label: "РђРєС‚РёРІРёСЂРѕРІР°С‚СЊ", icon: "checkCircle", attrs: `data-act="sa" data-slug="${x.slug}"` }),
          menuItem({ label: x.state === "BLOCKED" ? "Р Р°Р·Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ" : "Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ", icon: x.state === "BLOCKED" ? "toggleRight" : "toggleLeft", attrs: `data-act="st" data-slug="${x.slug}" data-ns="${x.state === "BLOCKED" ? "free" : "blocked"}"` }),
          menuItem({ label: "РР·РјРµРЅРёС‚СЊ С†РµРЅСѓ", icon: "pen", attrs: `data-act="sp" data-slug="${x.slug}" data-p="${x.priceOverride ?? ""}"` }),
          ...(x.ownerId ? [menuItem({ label: "РЈРґР°Р»РёС‚СЊ slug", icon: "trash", attrs: `data-act="sd" data-slug="${x.slug}" data-owner-id="${X(x.ownerId)}" data-owner-name="${X(x.ownerName || "")}"`, danger: true })] : []),
          menuSeparator(),
          menuItem({ label: "РћС‚РєСЂС‹С‚СЊ РІРёР·РёС‚РєСѓ", icon: "external", attrs: `data-act="open-url" data-url="/${encodeURIComponent(x.slug)}"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${statusChip(x.state === "BLOCKED" ? "rejected" : x.state === "TAKEN" ? "approved" : "new")}</td><td class="px-4 py-3">${X(x.ownerName || "-")}</td><td class="px-4 py-3">${x.isPrimary ? "Р”Р°" : "РќРµС‚"}</td><td class="px-4 py-3">${priceCell}</td><td class="px-4 py-3">${x.requestedAt ? D(x.requestedAt) : "-"}</td><td class="px-4 py-3">${x.approvedAt ? D(x.approvedAt) : "-"}</td><td class="px-4 py-3">${x.activatedAt ? D(x.activatedAt) : "-"}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : canCreateBySearch
        ? (() => {
          const menu = menuWrap(
            menuItem({ label: "РР·РјРµРЅРёС‚СЊ С†РµРЅСѓ", icon: "pen", attrs: `data-act="sp" data-slug="${searchedSlug}" data-p=""` }),
          );
          return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">${X(searchedSlug)}</td><td class="px-4 py-3">${statusChip("new")}</td><td class="px-4 py-3">-</td><td class="px-4 py-3">РќРµС‚</td><td class="px-4 py-3"><span>-</span></td><td class="px-4 py-3">-</td><td class="px-4 py-3">-</td><td class="px-4 py-3">-</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
        })()
        : `<tr><td colspan="9" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("link2", 48)}<span>РќРµС‚ РґР°РЅРЅС‹С…</span></div></td></tr>`;
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
          menuItem({ label: "РћС‚РєСЂС‹С‚СЊ РІРёР·РёС‚РєСѓ", icon: "eye", attrs: `data-act="open-url" data-url="/${encodeURIComponent(x.slug)}"` }),
          menuItem({ label: "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ", icon: "pen", attrs: `data-act="open-url" data-url="/admin/cards/${x.id}/edit"` }),
          menuItem({ label: "РЎРјРµРЅРёС‚СЊ С‚Р°СЂРёС„", icon: "crown", attrs: `data-act="ct" data-id="${x.id}"` }),
          menuSeparator(),
          menuItem({ label: x.isActive ? "Р’С‹РєР»СЋС‡РёС‚СЊ" : "Р’РєР»СЋС‡РёС‚СЊ", icon: x.isActive ? "toggleLeft" : "toggleRight", attrs: `data-act="cg" data-id="${x.id}" data-n="${x.isActive ? 0 : 1}"` }),
          menuItem({ label: "QR-РєРѕРґ", icon: "qr", attrs: `data-act="qr" data-slug="${x.slug}"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">#${X(x.slug)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "РџСЂРµРјРёСѓРј" : "Р‘Р°Р·РѕРІС‹Р№"}</td><td class="px-4 py-3">${statusChip(x.isActive ? "approved" : "rejected")}</td><td class="px-4 py-3">${Number(x.viewsCount || 0).toLocaleString("ru-RU")}</td><td class="px-4 py-3">${new Date(x.createdAt).toLocaleDateString("ru-RU")}</td><td class="px-4 py-3">${themePill(x.theme || "default_dark")}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : `<tr><td colspan="8" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>РќРµС‚ РґР°РЅРЅС‹С…</span></div></td></tr>`;
    renderPager("cards-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadCards();
    });
  }

  async function applySlugPriceOverride(slugRaw, priceRaw) {
    const slug = String(slugRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
      await showAlert("Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000");
      return false;
    }

    const payloadPrice =
      priceRaw === null || priceRaw === undefined || String(priceRaw).trim() === ""
        ? null
        : Number(String(priceRaw).trim());

    if (!(payloadPrice === null || Number.isFinite(payloadPrice))) {
      await showAlert("РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ С†РµРЅР° override");
      return false;
    }

    const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/price-override`, {
      method: "PATCH",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({ priceOverride: payloadPrice === null ? null : payloadPrice }),
    });
    if (!r.ok) {
      await showAlert(await E(r));
      return false;
    }
    const payload = await r.json().catch(() => ({}));
    const ignoredForPurchasedSlug = Boolean(payload?.synced?.appliedToPurchasedSlug);

    const statusNode = document.getElementById("slugs-price-override-status");
    if (statusNode instanceof HTMLElement) {
      if (ignoredForPurchasedSlug) {
        statusNode.textContent = `Slug ${slug} СѓР¶Рµ РєСѓРїР»РµРЅ/Р°РєС‚РёРІРёСЂРѕРІР°РЅ. Override РЅРµ РїСЂРёРјРµРЅРµРЅ, С†РµРЅР° РЅРµ РёР·РјРµРЅРµРЅР°.`;
      } else {
        statusNode.textContent =
          payloadPrice === null
            ? `Override РґР»СЏ ${slug} СѓРґР°Р»РµРЅ`
            : `Р¦РµРЅР° РґР»СЏ ${slug} СЃРѕС…СЂР°РЅРµРЅР°: ${Number(payloadPrice).toLocaleString("ru-RU")} СЃСѓРј`;
      }
    }

    const slugsFilterForm = document.getElementById("slugs-filters");
    if (slugsFilterForm instanceof HTMLFormElement) {
      setFormValue(slugsFilterForm, "q", slug);
      setFormValue(slugsFilterForm, "page", "1");
    }
    await loadSlugs();
    return true;
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
          menuItem({ label: "Р—Р°РєР°Р·Р°РЅ", icon: "package", attrs: `data-act="bs" data-id="${x.id}" data-status="ORDERED"` }),
          menuItem({ label: "РћС‚РїСЂР°РІР»РµРЅ", icon: "truck", attrs: `data-act="bs" data-id="${x.id}" data-status="SHIPPED"` }),
          menuItem({ label: "Р”РѕСЃС‚Р°РІР»РµРЅ", icon: "checkCircle", attrs: `data-act="bs" data-id="${x.id}" data-status="DELIVERED"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3"><div class="flex items-center justify-between gap-2">${statusChip(x.deliveryStatus)}<div class="admin-row-actions">${menu}</div></div></td></tr>`;
      }).join("")
      : `<tr><td colspan="5" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("package", 48)}<span>РќРµС‚ Р·Р°РєР°Р·РѕРІ</span></div></td></tr>`;
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
    const r = await fetch(`/api/admin/testimonials?${Q({ ...q, _: Date.now() })}`, { cache: "no-store" });
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length ? rows.map((x) => {
      const data = encodeURIComponent(JSON.stringify({ id: x.id, name: x.name, slug: x.slug, tariff: x.tariff, text: x.text }));
      const menu = menuWrap([
        menuItem({ label: x.isVisible ? "РЎРєСЂС‹С‚СЊ" : "РџРѕРєР°Р·Р°С‚СЊ", icon: "eye", attrs: `data-act="tv" data-id="${x.id}" data-n="${x.isVisible ? 0 : 1}"` }),
        menuItem({ label: "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ", icon: "pen", attrs: `data-act="te" data-json="${data}"` }),
        menuSeparator(),
        menuItem({ label: "РЈРґР°Р»РёС‚СЊ", icon: "trash", attrs: `data-act="td" data-id="${x.id}"`, danger: true }),
      ].join(""));
      return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "РџСЂРµРјРёСѓРј" : "Р‘Р°Р·РѕРІС‹Р№"}</td><td class="px-4 py-3">${X(x.text)}</td><td class="px-4 py-3">${statusChip(x.isVisible ? "approved" : "muted")}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("message", 48)}<span>РќРµС‚ РѕС‚Р·С‹РІРѕРІ</span></div></td></tr>`;
    renderPager("testimonials-pagination", payload.pagination, (nextPage) => {
      initialQuery.t_page = String(nextPage);
      void loadTestimonials();
    });
  }

  async function loadVerificationRequests() {
    const form = document.getElementById("verification-filters");
    const table = document.getElementById("verification-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    syncVerificationFiltersFromLocation(form);
    table.innerHTML = '<tr><td colspan="11" class="px-3 py-8 text-center text-neutral-500">Р—Р°РіСЂСѓР·РєР°...</td></tr>';
    try {
      const q = {
        status: getFormValue(form, "status", "all"),
        page: getFormValue(form, "page", "1"),
      };
      setDashboardQuery({ v_status: q.status, v_page: q.page });
      const r = await fetch(`/api/admin/verification-requests?${Q(q)}`);
      if (!r.ok) {
        table.innerHTML = '<tr><td colspan="11" class="px-3 py-8 text-center text-rose-600">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р·Р°СЏРІРєРё РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ</td></tr>';
        return;
      }
      const payload = await r.json();
      const rows = Array.isArray(payload.items) ? payload.items : [];
      table.innerHTML = rows.length
        ? rows
          .map((x) => {
            const proofTypeMap = {
              email: "Email",
              linkedin: "LinkedIn",
              website: "Website",
            };
            const proofType = proofTypeMap[String(x.proofType || "").toLowerCase()] || String(x.proofType || "вЂ”");
            const sectorMap = {
              design: "Р”РёР·Р°Р№РЅ",
              sales: "РџСЂРѕРґР°Р¶Рё",
              marketing: "РњР°СЂРєРµС‚РёРЅРі",
              it: "IT",
              other: "Р”СЂСѓРіРѕРµ",
            };
            const sector = sectorMap[String(x.sector || "").toLowerCase()] || "Р”СЂСѓРіРѕРµ";
            const proofValueRaw = String(x.proofValue || "").trim();
            const proofValue = /^https?:\/\//i.test(proofValueRaw)
              ? `<a href="${X(proofValueRaw)}" target="_blank" rel="noopener noreferrer" class="text-xs text-neutral-700 underline break-all">${X(proofValueRaw)}</a>`
              : `<span class="text-xs break-all">${X(proofValueRaw || "вЂ”")}</span>`;
            const userName = String(x.user?.displayName || x.user?.firstName || x.user?.username || "вЂ”");
            const userLogin = String(x.user?.username || "").trim();
            const userCell = `${X(userName)}${userLogin ? `<div class="text-xs text-neutral-500">@${X(userLogin)}</div>` : ""}`;
            const reviewCell = x.reviewedAt ? D(x.reviewedAt) : "вЂ”";
            const canReview = String(x.status || "").toLowerCase() === "pending";
            const menu = canReview
              ? menuWrap(
                [
                  menuItem({ label: "РћРґРѕР±СЂРёС‚СЊ", icon: "checkCircle", attrs: `data-act="vr-approve" data-id="${X(x.id)}"` }),
                  menuItem({ label: "РћС‚РєР»РѕРЅРёС‚СЊ", icon: "xCircle", attrs: `data-act="vr-reject" data-id="${X(x.id)}"`, danger: true }),
                ].join(""),
              )
              : "вЂ”";
            const verificationStatusCode =
              x.status === "approved" ? "verification_approved" : x.status === "rejected" ? "verification_rejected" : "pending";
            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3">${userCell}</td>
              <td class="px-4 py-3 font-mono">${X(x.slug || "вЂ”")}</td>
              <td class="px-4 py-3">${X(x.companyName || "вЂ”")}</td>
              <td class="px-4 py-3">${X(x.role || "вЂ”")}</td>
              <td class="px-4 py-3">${X(sector)}</td>
              <td class="px-4 py-3"><div class="text-xs text-neutral-500">${X(proofType)}</div>${proofValue}</td>
              <td class="px-4 py-3 text-xs">${X(x.comment || "вЂ”")}</td>
              <td class="px-4 py-3">${statusChip(verificationStatusCode)}</td>
              <td class="px-4 py-3 text-xs">${D(x.requestedAt)}</td>
              <td class="px-4 py-3 text-xs">${reviewCell}</td>
              <td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td>
            </tr>`;
          })
          .join("")
        : '<tr><td colspan="11" class="px-3 py-8 text-center text-neutral-500">Р—Р°СЏРІРѕРє РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ РЅРµС‚</td></tr>';
      renderPager("verification-pagination", payload.pagination, (nextPage) => {
        setFormValue(form, "page", String(nextPage));
        void loadVerificationRequests();
      });
    } catch {
      table.innerHTML = '<tr><td colspan="11" class="px-3 py-8 text-center text-rose-600">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р·Р°СЏРІРєРё РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ</td></tr>';
    }
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
    table.innerHTML = rows.length ? rows.map((x) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${X(x.type)}</td><td class="px-4 py-3 font-mono text-xs">${X(x.path)}</td><td class="px-4 py-3 text-xs">${X(x.message || "-")}</td><td class="px-4 py-3 text-xs">${X(x.userAgent || "-")}</td><td class="px-4 py-3 text-xs">${D(x.occurredAt)}</td></tr>`).join("") : '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">Р›РѕРіРё РЅРµ РЅР°Р№РґРµРЅС‹</td></tr>';
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
      ? overview.items.map((x) => `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.userName)}</td><td class="px-4 py-3 font-mono">${X(x.slug || "вЂ”")}</td><td class="px-4 py-3 text-lg font-black">${Number(x.score || 0)}</td><td class="px-4 py-3">РўРѕРї ${Math.max(1, Math.ceil(100 - Number(x.percentile || 0)))}%</td><td class="px-4 py-3 text-xs">${D(x.calculatedAt)}</td><td class="px-4 py-3"><button type="button" data-act="score-recalc-one" data-id="${X(x.telegramId)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold">РџРµСЂРµСЃС‡РёС‚Р°С‚СЊ</button></td></tr>`).join("")
      : '<tr><td colspan="6" class="px-3 py-8 text-center text-neutral-500">РќРµС‚ РґР°РЅРЅС‹С…</td></tr>';

    runsTable.innerHTML = (runs.items || []).length
      ? runs.items.map((x) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${D(x.startedAt)}</td><td class="px-3 py-2">${Number(x.processedUsers || 0)}</td><td class="px-3 py-2">${Number(x.averageMsPerUser || 0).toFixed(2)} РјСЃ</td></tr>`).join("")
      : '<tr><td colspan="3" class="px-3 py-8 text-center text-neutral-500">Р—Р°РїСѓСЃРєРѕРІ РїРѕРєР° РЅРµС‚</td></tr>';

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
  const qrLogoUrl = `${window.location.origin}/brand/logo.PNG`;

  function withLogoInSvg(svg, width) {
    if (!svg || typeof svg !== "string") return svg;
    const size = Math.round(width * 0.22);
    const x = Math.round((width - size) / 2);
    const y = Math.round((width - size) / 2);
    const pad = Math.max(6, Math.round(size * 0.14));
    const boxX = x - pad;
    const boxY = y - pad;
    const boxSize = size + pad * 2;
    const radius = Math.max(8, Math.round(boxSize * 0.18));
    const overlay =
      `<rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="${radius}" ry="${radius}" fill="#ffffff"/>` +
      `<image href="${qrLogoUrl}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
    return svg.replace("</svg>", `${overlay}</svg>`);
  }

  async function withLogoOnCanvas(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = Math.round(canvas.width * 0.22);
    const x = Math.round((canvas.width - size) / 2);
    const y = Math.round((canvas.height - size) / 2);
    const pad = Math.max(6, Math.round(size * 0.14));
    const boxX = x - pad;
    const boxY = y - pad;
    const boxSize = size + pad * 2;
    const radius = Math.max(8, Math.round(boxSize * 0.18));
    const img = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = "/brand/logo.PNG";
    });
    if (!img) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxSize - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxSize, boxY, boxX + boxSize, boxY + radius);
    ctx.lineTo(boxX + boxSize, boxY + boxSize - radius);
    ctx.quadraticCurveTo(boxX + boxSize, boxY + boxSize, boxX + boxSize - radius, boxY + boxSize);
    ctx.lineTo(boxX + radius, boxY + boxSize);
    ctx.quadraticCurveTo(boxX, boxY + boxSize, boxX, boxY + boxSize - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  }

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
    const svgLarge = await QRCode.toString(url, { type: "svg", width: 1000, margin: 2, errorCorrectionLevel: "H" });
    const svgSmall = await QRCode.toString(url, { type: "svg", width: 240, margin: 2, errorCorrectionLevel: "H" });
    qsvg = withLogoInSvg(svgLarge, 1000);
    qwrap.innerHTML = withLogoInSvg(svgSmall, 240);
    await QRCode.toCanvas(qcan, url, { width: 1000, margin: 2, errorCorrectionLevel: "H" });
    await withLogoOnCanvas(qcan);
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
        const entered = await showPrompt("РџСЂРёС‡РёРЅР° РѕС‚РєР»РѕРЅРµРЅРёСЏ (Р±СѓРґРµС‚ РѕС‚РїСЂР°РІР»РµРЅР° РІ Telegram)", previousNote);
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
      const prevPlan = t.getAttribute("data-current-plan") || "none";
      if (t.value === prevPlan) return;
      const manualWarningOk = await showConfirm("Р СѓС‡РЅР°СЏ СЃРјРµРЅР° С‚Р°СЂРёС„Р° Р±РµР· РѕРїР»Р°С‚С‹. РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РґР»СЏ РєРѕСЂСЂРµРєС‚РёСЂРѕРІРѕРє. РџСЂРѕРґРѕР»Р¶РёС‚СЊ?");
      if (!manualWarningOk) {
        t.value = prevPlan;
        return;
      }
      const activeSlugs = Number(t.getAttribute("data-active-slugs") || "0");
      const braceletSlugs = String(t.getAttribute("data-bracelet-slugs") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const downgradeToBasic = prevPlan === "premium" && t.value === "basic" && activeSlugs > 1;
      if (downgradeToBasic) {
        const braceletNote = braceletSlugs.length ? `\nР‘СЂР°СЃР»РµС‚ РїСЂРёРІСЏР·Р°РЅ Рє: ${braceletSlugs.join(", ")}.` : "";
        const ok = await showConfirm(`РЈ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ${activeSlugs} slug. РџСЂРё РїРµСЂРµС…РѕРґРµ РЅР° Р‘Р°Р·РѕРІС‹Р№ Р±СѓРґРµС‚ Р°РєС‚РёРІРµРЅ С‚РѕР»СЊРєРѕ РѕСЃРЅРѕРІРЅРѕР№. РџСЂРѕРґРѕР»Р¶РёС‚СЊ?${braceletNote}`);
        if (!ok) {
          t.value = prevPlan;
          return;
        }
      }
      const reason = String(await showPrompt("РџСЂРёС‡РёРЅР° СЂСѓС‡РЅРѕР№ СЃРјРµРЅС‹ С‚Р°СЂРёС„Р°", "") || "").trim();
      if (!reason) {
        showAlert("РЈРєР°Р¶Рё РїСЂРёС‡РёРЅСѓ СЃРјРµРЅС‹ С‚Р°СЂРёС„Р°");
        t.value = prevPlan;
        return;
      }
      let r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: t.value, reason, force: downgradeToBasic }) });
      if (r.status === 409 && !downgradeToBasic) {
        const payload = await r.json().catch(() => ({}));
        if (payload.code === "PLAN_DOWNGRADE_CONFIRMATION_REQUIRED") {
          const cnt = Number(payload.activeSlugCount || activeSlugs || 2);
          const braceletNote = braceletSlugs.length ? `\nР‘СЂР°СЃР»РµС‚ РїСЂРёРІСЏР·Р°РЅ Рє: ${braceletSlugs.join(", ")}.` : "";
          const ok = await showConfirm(`РЈ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ${cnt} slug. РџСЂРё РїРµСЂРµС…РѕРґРµ РЅР° Р‘Р°Р·РѕРІС‹Р№ Р±СѓРґРµС‚ Р°РєС‚РёРІРµРЅ С‚РѕР»СЊРєРѕ РѕСЃРЅРѕРІРЅРѕР№. РџСЂРѕРґРѕР»Р¶РёС‚СЊ?${braceletNote}`);
          if (!ok) {
            t.value = prevPlan;
            return;
          }
          r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: "basic", reason, force: true }) });
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
      if (status === "approved") {
        const row = n.closest("tr");
        const cells = row ? Array.from(row.querySelectorAll("td")) : [];
        const userText = cells[1]?.textContent?.trim() || "вЂ”";
        const slugText = cells[2]?.textContent?.trim() || "вЂ”";
        const amountText = cells[4]?.textContent?.trim() || "вЂ”";
        const tariffText = cells[5]?.textContent?.trim() || "вЂ”";
        const ok = await showConfirm(
          `РџРѕРґС‚РІРµСЂРґРёС‚СЊ РѕРґРѕР±СЂРµРЅРёРµ Р·Р°СЏРІРєРё?\n\nРџРѕР»СЊР·РѕРІР°С‚РµР»СЊ: ${userText}\nSlug: ${slugText}\nРўР°СЂРёС„: ${tariffText}\nРћРїР»Р°С‚Р°: ${amountText} РїРѕР»СѓС‡РµРЅР°\n\nРџРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ:\nВ· Slug ${slugText} Р±СѓРґРµС‚ Р·Р°РєСЂРµРїР»С‘РЅ Р·Р° РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј\nВ· РўР°СЂРёС„ ${tariffText} Р±СѓРґРµС‚ Р°РєС‚РёРІРёСЂРѕРІР°РЅ\nВ· РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїРѕР»СѓС‡РёС‚ СѓРІРµРґРѕРјР»РµРЅРёРµ РІ Telegram`,
        );
        if (!ok) return;
      }
      if (status === "rejected") {
        const entered = await showPrompt("РџСЂРёС‡РёРЅР° РѕС‚РєР»РѕРЅРµРЅРёСЏ (Р±СѓРґРµС‚ РѕС‚РїСЂР°РІР»РµРЅР° РІ Telegram)", previousNote);
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
      const tariff = String(await showPrompt("РќРѕРІС‹Р№ С‚Р°СЂРёС„: basic РёР»Рё premium", "basic") || "").trim().toLowerCase();
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
      const prevPlan = n.getAttribute("data-current-plan") || "none";
      const activeSlugs = Number(n.getAttribute("data-active-slugs") || "0");
      const braceletSlugs = String(n.getAttribute("data-bracelet-slugs") || "").split(",").map((x) => x.trim()).filter(Boolean);
      const entered = String(await showPrompt("РќРѕРІС‹Р№ С‚Р°СЂРёС„: none, basic РёР»Рё premium", prevPlan) || "").trim().toLowerCase();
      if (!["none", "basic", "premium"].includes(entered) || entered === prevPlan) return;
      const manualWarningOk = await showConfirm("Р СѓС‡РЅР°СЏ СЃРјРµРЅР° С‚Р°СЂРёС„Р° Р±РµР· РѕРїР»Р°С‚С‹. РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РґР»СЏ РєРѕСЂСЂРµРєС‚РёСЂРѕРІРѕРє. РџСЂРѕРґРѕР»Р¶РёС‚СЊ?");
      if (!manualWarningOk) return;
      const reason = String(await showPrompt("РџСЂРёС‡РёРЅР° СЂСѓС‡РЅРѕР№ СЃРјРµРЅС‹ С‚Р°СЂРёС„Р°", "") || "").trim();
      if (!reason) {
        showAlert("РЈРєР°Р¶Рё РїСЂРёС‡РёРЅСѓ СЃРјРµРЅС‹ С‚Р°СЂРёС„Р°");
        return;
      }
      const downgradeToBasic = prevPlan === "premium" && entered === "basic" && activeSlugs > 1;
      if (downgradeToBasic) {
        const braceletNote = braceletSlugs.length ? `\nР‘СЂР°СЃР»РµС‚ РїСЂРёРІСЏР·Р°РЅ Рє: ${braceletSlugs.join(", ")}.` : "";
        const ok = await showConfirm(`РЈ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ${activeSlugs} slug. РџСЂРё РїРµСЂРµС…РѕРґРµ РЅР° Р‘Р°Р·РѕРІС‹Р№ Р±СѓРґРµС‚ Р°РєС‚РёРІРµРЅ С‚РѕР»СЊРєРѕ РѕСЃРЅРѕРІРЅРѕР№. РџСЂРѕРґРѕР»Р¶РёС‚СЊ?${braceletNote}`);
        if (!ok) return;
      }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: entered, reason, force: downgradeToBasic }) });
      if (!r.ok) showAlert(await E(r));
      else void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "us-add") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ";
      if (!userId) return;
      const knownSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));

      const entered = await showPrompt(`РќРѕРІС‹Р№ slug РґР»СЏ ${userName} (AAA000)`, "");
      if (entered === null) return;
      const nextSlug = normalizeShortSlug(entered);
      if (!isShortSlug(nextSlug)) {
        await showAlert("Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000.");
        return;
      }
      const ok = await showConfirm(`РќР°Р·РЅР°С‡РёС‚СЊ slug ${nextSlug} РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ ${userName}?`);
      if (!ok) return;

      const createResponse = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/slugs`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ slug: nextSlug }),
      });
      if (createResponse.ok) {
        void loadUsers();
        void loadSlugs();
        closeAllRowMenus();
        return;
      }

      let payload = {};
      try {
        payload = await createResponse.json();
      } catch {
        payload = {};
      }

      if (createResponse.status === 409 && payload?.code === "SLUG_LIMIT_REACHED") {
        const slugLimit = Number(payload?.slugLimit || 0);
        const currentSlugCount = Number(payload?.currentSlugCount || 0);
        if (slugLimit <= 0 || currentSlugCount <= 0) {
          await showAlert("Р›РёРјРёС‚ slug РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЂР°РІРµРЅ 0. РЎРЅР°С‡Р°Р»Р° СЃРјРµРЅРё С‚Р°СЂРёС„, Р·Р°С‚РµРј РґРѕР±Р°РІСЊ slug.");
          return;
        }
        const candidates = Array.isArray(payload?.ownedSlugs)
          ? payload.ownedSlugs.map((slug) => normalizeShortSlug(slug)).filter((slug) => isShortSlug(slug))
          : knownSlugs;
        const defaultCurrent = candidates[0] || "";
        const hint = candidates.length ? `\nSlug РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ: ${candidates.join(", ")}` : "";
        const enteredCurrent = await showPrompt(
          `Р›РёРјРёС‚ slug РґРѕСЃС‚РёРіРЅСѓС‚. РЈРєР°Р¶Рё slug, РєРѕС‚РѕСЂС‹Р№ РЅСѓР¶РЅРѕ Р·Р°РјРµРЅРёС‚СЊ.${hint}`,
          defaultCurrent,
        );
        if (enteredCurrent === null) return;
        const currentSlug = normalizeShortSlug(enteredCurrent);
        if (!isShortSlug(currentSlug)) {
          await showAlert("РўРµРєСѓС‰РёР№ slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000.");
          return;
        }
        const replaceOk = await showConfirm(`Р—Р°РјРµРЅРёС‚СЊ ${currentSlug} РЅР° ${nextSlug} Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ${userName}?`);
        if (!replaceOk) return;
        const replaceResponse = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/slugs/${encodeURIComponent(currentSlug)}`, {
          method: "PATCH",
          headers: H({ "Content-Type": "application/json" }),
          body: JSON.stringify({ slug: nextSlug }),
        });
        if (!replaceResponse.ok) {
          await showAlert(await E(replaceResponse));
          return;
        }
        void loadUsers();
        void loadSlugs();
        closeAllRowMenus();
        return;
      }

      await showAlert(payload?.error || `HTTP ${createResponse.status}`);
      return;
    }
    if (a === "us-edit") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));

      const defaultCurrent = userSlugs[0] || "";
      const hint = userSlugs.length ? ` (${userSlugs.join(", ")})` : "";
      const enteredCurrent = await showPrompt(`РўРµРєСѓС‰РёР№ slug${hint}`, defaultCurrent);
      if (enteredCurrent === null) return;
      const currentSlug = normalizeShortSlug(enteredCurrent);
      if (!isShortSlug(currentSlug)) {
        await showAlert("РўРµРєСѓС‰РёР№ slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000.");
        return;
      }

      const enteredNext = await showPrompt(`РќРѕРІС‹Р№ slug РґР»СЏ ${userName} (AAA000)`, currentSlug);
      if (enteredNext === null) return;
      const nextSlug = normalizeShortSlug(enteredNext);
      if (!isShortSlug(nextSlug)) {
        await showAlert("Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000.");
        return;
      }
      if (nextSlug === currentSlug) {
        await showAlert("РќРѕРІС‹Р№ slug РґРѕР»Р¶РµРЅ РѕС‚Р»РёС‡Р°С‚СЊСЃСЏ РѕС‚ С‚РµРєСѓС‰РµРіРѕ.");
        return;
      }
      const ok = await showConfirm(`Р—Р°РјРµРЅРёС‚СЊ ${currentSlug} РЅР° ${nextSlug} Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ${userName}?`);
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/slugs/${encodeURIComponent(currentSlug)}`, {
        method: "PATCH",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ slug: nextSlug }),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      void loadUsers();
      void loadSlugs();
      closeAllRowMenus();
      return;
    }
    if (a === "us-delete") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));
      if (!userSlugs.length) {
        await showAlert("РЈ СЌС‚РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅРµС‚ slug РґР»СЏ СѓРґР°Р»РµРЅРёСЏ.");
        return;
      }
      const defaultSlug = userSlugs[0] || "";
      const enteredSlug = await showPrompt(`РљР°РєРѕР№ slug СѓРґР°Р»РёС‚СЊ? (${userSlugs.join(", ")})`, defaultSlug);
      if (enteredSlug === null) return;
      const targetSlug = normalizeShortSlug(enteredSlug);
      if (!isShortSlug(targetSlug)) {
        await showAlert("Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000.");
        return;
      }
      const ok = await showConfirm(`РЈРґР°Р»РёС‚СЊ slug ${targetSlug} Сѓ ${userName}?\n\nР‘СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹ Р°РЅР°Р»РёС‚РёС‡РµСЃРєРёРµ Р·Р°РїРёСЃРё РїРѕ СЌС‚РѕРјСѓ slug.`);
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/slugs/${encodeURIComponent(targetSlug)}`, {
        method: "DELETE",
        headers: H(),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      const nextPrimary = payload?.nextPrimarySlug ? `\nРќРѕРІС‹Р№ РѕСЃРЅРѕРІРЅРѕР№: ${payload.nextPrimarySlug}` : "";
      await showAlert(`Slug ${targetSlug} СѓРґР°Р»РµРЅ.${nextPrimary}`);
      void loadUsers();
      void loadSlugs();
      closeAllRowMenus();
      return;
    }
    if (a === "uv") {
      const telegramId = n.getAttribute("data-id");
      if (!telegramId) return;
      const ok = await showConfirm("РЎРЅСЏС‚СЊ РІРµСЂРёС„РёРєР°С†РёСЋ Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ?");
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/unverify`, {
        method: "PATCH",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "uvb") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));
      if (!userSlugs.length) {
        await showAlert("РЈ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅРµС‚ slug РґР»СЏ РЅР°РєСЂСѓС‚РєРё РїСЂРѕСЃРјРѕС‚СЂРѕРІ.");
        return;
      }
      const enteredCount = await showPrompt(`РЎРєРѕР»СЊРєРѕ РїСЂРѕСЃРјРѕС‚СЂРѕРІ РґРѕР±Р°РІРёС‚СЊ РґР»СЏ ${userName}? (1-5000)`, "100");
      if (enteredCount === null) return;
      const count = Number.parseInt(String(enteredCount || "").trim(), 10);
      if (!Number.isFinite(count) || count < 1 || count > 5000) {
        await showAlert("РљРѕР»РёС‡РµСЃС‚РІРѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ С‡РёСЃР»РѕРј РѕС‚ 1 РґРѕ 5000.");
        return;
      }
      let targetSlug = userSlugs[0];
      if (userSlugs.length > 1) {
        const enteredSlug = await showPrompt(`РќР° РєР°РєРѕР№ slug РЅР°С‡РёСЃР»РёС‚СЊ РїСЂРѕСЃРјРѕС‚СЂС‹? (${userSlugs.join(", ")})`, targetSlug);
        if (enteredSlug === null) return;
        targetSlug = normalizeShortSlug(enteredSlug);
        if (!isShortSlug(targetSlug)) {
          await showAlert("Slug РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ AAA000.");
          return;
        }
      }
      const ok = await showConfirm(`Р”РѕР±Р°РІРёС‚СЊ ${count} РїСЂРѕСЃРјРѕС‚СЂРѕРІ РЅР° ${targetSlug} РґР»СЏ ${userName}?`);
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/views`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ count, slug: targetSlug }),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      await showAlert(`Р”РѕР±Р°РІР»РµРЅРѕ РїСЂРѕСЃРјРѕС‚СЂРѕРІ: ${Number(payload?.addedViews || count)} (slug: ${payload?.slug || targetSlug}).`);
      void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "oa") openA(n.getAttribute("data-id") || "", n.getAttribute("data-t") || "basic", n.getAttribute("data-th") || "default_dark");
    if (a === "od") { const id = n.getAttribute("data-id"); if (!id || !await showConfirm("РЈРґР°Р»РёС‚СЊ Р·Р°СЏРІРєСѓ?")) return; const r = await fetch(`/api/admin/orders/${id}`, { method: "DELETE", headers: H() }); if (!r.ok) showAlert(await E(r)); else void loadOrders(); }
    if (a === "ope") { const id = n.getAttribute("data-id"); if (!id) return; const r = await fetch(`/api/admin/orders/${id}/extend-pending`, { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadOrders(); }
    if (a === "ub") { const telegramId = n.getAttribute("data-id"); const status = n.getAttribute("data-status"); if (!telegramId) return; const isBlocked = status === "blocked"; if (!isBlocked && !await showConfirm("Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РґРµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ РµРіРѕ slug?")) return; if (isBlocked && !await showConfirm("Р Р°Р·Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃС‹ slug?")) return; const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/${isBlocked ? "unblock" : "block"}`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadUsers(); }
    if (a === "ud") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ";
      if (!userId) return;
      const hardConfirm = await showConfirm(`РџРѕР»РЅРѕСЃС‚СЊСЋ СѓРґР°Р»РёС‚СЊ ${userName} Рё РІСЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ Р·Р°РїРёСЃРё?\n\nР”РµР№СЃС‚РІРёРµ РЅРµРѕР±СЂР°С‚РёРјРѕ.`);
      if (!hardConfirm) return;
      const keyword = String(await showPrompt("Р’РІРµРґРёС‚Рµ DELETE РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ", "") || "").trim();
      if (keyword !== "DELETE") {
        await showAlert("РЈРґР°Р»РµРЅРёРµ РѕС‚РјРµРЅРµРЅРѕ: РЅРµРІРµСЂРЅРѕРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ.");
        return;
      }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/purge`, { method: "DELETE", headers: H() });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      const freedSlugs = Number(payload?.freedSlugs || 0);
      await showAlert(`РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»РµРЅ. РћСЃРІРѕР±РѕР¶РґРµРЅРѕ slug: ${freedSlugs}.`);
      void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "sd") {
      const slug = n.getAttribute("data-slug");
      const ownerId = n.getAttribute("data-owner-id");
      const ownerName = n.getAttribute("data-owner-name") || "РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ";
      if (!slug || !ownerId) return;
      const ok = await showConfirm(`РЈРґР°Р»РёС‚СЊ slug ${slug} Сѓ ${ownerName}?\n\nР‘СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹ Р°РЅР°Р»РёС‚РёС‡РµСЃРєРёРµ Р·Р°РїРёСЃРё РїРѕ СЌС‚РѕРјСѓ slug.`);
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(ownerId)}/slugs/${encodeURIComponent(slug)}`, { method: "DELETE", headers: H() });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      const nextPrimary = payload?.nextPrimarySlug ? `\nРќРѕРІС‹Р№ РѕСЃРЅРѕРІРЅРѕР№: ${payload.nextPrimarySlug}` : "";
      await showAlert(`Slug ${slug} СѓРґР°Р»РµРЅ.${nextPrimary}`);
      void loadUsers();
      void loadSlugs();
      closeAllRowMenus();
      return;
    }
    if (a === "st") { const slug = n.getAttribute("data-slug"), state = n.getAttribute("data-ns"); if (!slug || !state) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/state`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ state }) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "sa") { const slug = n.getAttribute("data-slug"); if (!slug) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/activate`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "sp") { const slug = n.getAttribute("data-slug"), cur = n.getAttribute("data-p") || ""; if (!slug) return; const x = await showPrompt("РќРѕРІР°СЏ С†РµРЅР° slug (РїСѓСЃС‚Рѕ = СѓР±СЂР°С‚СЊ override)", cur); if (x === null) return; await applySlugPriceOverride(slug, x); }
    if (a === "cg") { const id = n.getAttribute("data-id"), isActive = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/cards/${id}/toggle-active`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isActive }) }); if (!r.ok) showAlert(await E(r)); else void loadCards(); }
    if (a === "qr") { const slug = n.getAttribute("data-slug"); if (slug) await openQ(slug); }
    if (a === "tv") { const id = n.getAttribute("data-id"), isVisible = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/testimonials/${id}/visibility`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isVisible }) }); if (!r.ok) showAlert(await E(r)); else void loadTestimonials(); }
    if (a === "td") {
      const id = n.getAttribute("data-id");
      if (!id || !await showConfirm("РЈРґР°Р»РёС‚СЊ РѕС‚Р·С‹РІ?")) return;
      const r = await fetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: H(),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      await loadTestimonials();
      return;
    }
    if (a === "te") { const encoded = n.getAttribute("data-json"); if (!encoded) return; try { openTe(JSON.parse(decodeURIComponent(encoded))); } catch { } }
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
    if (a === "vr-approve") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const ok = await showConfirm("РћРґРѕР±СЂРёС‚СЊ Р·Р°СЏРІРєСѓ РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ?");
      if (!ok) return;
      const r = await fetch(`/api/admin/verification-requests/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadVerificationRequests();
      closeAllRowMenus();
      return;
    }
    if (a === "vr-reject") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const adminNote = String(await showPrompt("РџСЂРёС‡РёРЅР° РѕС‚РєР»РѕРЅРµРЅРёСЏ", "") || "").trim();
      if (!adminNote) return;
      const r = await fetch(`/api/admin/verification-requests/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminNote }),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadVerificationRequests();
      closeAllRowMenus();
      return;
    }
  });

  document.getElementById("orders-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadOrders(); });
  document.getElementById("purchases-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadPurchases(); });
  document.getElementById("pricing-settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const body = {
      planBasicPrice: Number(getFormValue(form, "planBasicPrice", "50000")),
      planPremiumPrice: Number(getFormValue(form, "planPremiumPrice", "130000")),
      premiumUpgradePrice: Number(getFormValue(form, "premiumUpgradePrice", "80000")),
      pricingFootnote: getFormValue(form, "pricingFootnote", ""),
    };
    const r = await fetch("/api/admin/pricing/settings", {
      method: "PATCH",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!r.ok) showAlert(await E(r));
    else {
      await loadPricingSettings();
      showAlert("РўР°СЂРёС„С‹ РѕР±РЅРѕРІР»РµРЅС‹");
    }
  });
  document.getElementById("users-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadUsers(); });
  document.getElementById("slugs-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadSlugs(); });
  document.getElementById("slugs-price-override-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const slug = getFormValue(form, "slug", "");
    const priceOverride = getFormValue(form, "priceOverride", "");
    await applySlugPriceOverride(slug, priceOverride);
  });
  document.getElementById("slugs-price-override-reset")?.addEventListener("click", async () => {
    const form = document.getElementById("slugs-price-override-form");
    if (!(form instanceof HTMLFormElement)) return;
    const slug = getFormValue(form, "slug", "");
    await applySlugPriceOverride(slug, null);
    setFormValue(form, "priceOverride", "");
  });
  document.getElementById("cards-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadCards(); });
  document.getElementById("bracelets-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadBracelets(); });
  document.getElementById("logs-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadLogs(); });
  document.getElementById("verification-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadVerificationRequests(); });
  document.getElementById("verification-filters")?.elements?.namedItem?.("status")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("verification-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadVerificationRequests();
  });
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
  const pushBroadcastStatusNode = document.getElementById("push-broadcast-status");
  let pushBroadcastPollTimer = null;
  const setPushBroadcastStatus = (message, tone = "neutral") => {
    if (!(pushBroadcastStatusNode instanceof HTMLElement)) return;
    const base = "rounded-xl border px-3 py-2 text-sm";
    let toneClass = "border-neutral-300 bg-neutral-50 text-neutral-700";
    if (tone === "success") toneClass = "border-emerald-300 bg-emerald-50 text-emerald-800";
    if (tone === "error") toneClass = "border-rose-300 bg-rose-50 text-rose-800";
    if (tone === "progress") toneClass = "border-sky-300 bg-sky-50 text-sky-800";
    pushBroadcastStatusNode.className = `${base} ${toneClass}`;
    pushBroadcastStatusNode.textContent = String(message || "").trim();
    pushBroadcastStatusNode.classList.remove("hidden");
  };
  const stopPushBroadcastPolling = () => {
    if (pushBroadcastPollTimer) {
      clearTimeout(pushBroadcastPollTimer);
      pushBroadcastPollTimer = null;
    }
  };
  const pollBroadcastJob = async (jobId, onDone) => {
    const tick = async () => {
      try {
        const r = await fetch(`/api/admin/push/broadcast/jobs/${encodeURIComponent(jobId)}`, { headers: H() });
        if (!r.ok) {
          stopPushBroadcastPolling();
          setPushBroadcastStatus("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚СѓСЃ СЂР°СЃСЃС‹Р»РєРё", "error");
          if (onDone) onDone(false);
          return;
        }

        const payload = await r.json().catch(() => null);
        const job = payload?.job || {};
        const progress = job?.progress || {};
        const status = String(job?.status || "queued");
        const total = Number(progress.totalRecipients || 0);
        const processed = Number(progress.processedRecipients || 0);
        const percent = Number(progress.percent || 0);
        const sent = Number(progress.sent || 0);
        const tokens = Number(progress.tokens || 0);
        const cleaned = Number(progress.cleaned || 0);
        const inAppInserted = Number(progress.inAppInserted || 0);

        if (status === "queued" || status === "running") {
          setPushBroadcastStatus(`Р Р°СЃСЃС‹Р»РєР° РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ: ${processed}/${total} (${percent}%), sent: ${sent}, tokens: ${tokens}, cleaned: ${cleaned}, in-app: ${inAppInserted}`, "progress");
          pushBroadcastPollTimer = setTimeout(() => {
            void tick();
          }, 1500);
          return;
        }

        stopPushBroadcastPolling();
        if (status === "completed") {
          if (job?.dryRun) {
            setPushBroadcastStatus(`Dry-run Р·Р°РІРµСЂС€С‘РЅ: РЅР°Р№РґРµРЅРѕ РїРѕР»СѓС‡Р°С‚РµР»РµР№ ${total}`, "success");
          } else {
            setPushBroadcastStatus(`Р Р°СЃСЃС‹Р»РєР° Р·Р°РІРµСЂС€РµРЅР°: ${processed}/${total}, sent: ${sent}, tokens: ${tokens}, cleaned: ${cleaned}, in-app: ${inAppInserted}`, "success");
          }
          if (onDone) onDone(true);
          return;
        }

        const errorMessage = String(job?.error || "РћС€РёР±РєР° РІС‹РїРѕР»РЅРµРЅРёСЏ СЂР°СЃСЃС‹Р»РєРё");
        setPushBroadcastStatus(`РћС€РёР±РєР° СЂР°СЃСЃС‹Р»РєРё: ${errorMessage}`, "error");
        if (onDone) onDone(false);
      } catch {
        stopPushBroadcastPolling();
        setPushBroadcastStatus("РЎР±РѕР№ СЃРµС‚Рё РїСЂРё РїСЂРѕРІРµСЂРєРµ СЃС‚Р°С‚СѓСЃР° СЂР°СЃСЃС‹Р»РєРё", "error");
        if (onDone) onDone(false);
      }
    };

    void tick();
  };
  document.getElementById("push-test-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const userId = getFormValue(form, "userId", "").trim();
    const slug = getFormValue(form, "slug", "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const title = getFormValue(form, "title", "").trim();
    const bodyText = getFormValue(form, "body", "").trim();
    const includeInApp = !!(form.elements.namedItem("includeInApp") instanceof HTMLInputElement && form.elements.namedItem("includeInApp").checked);
    const rawData = getFormValue(form, "data", "").trim();

    if (!userId && !slug) {
      showAlert("РЈРєР°Р¶РёС‚Рµ userId РёР»Рё slug");
      return;
    }
    if (!title || !bodyText) {
      showAlert("Р—Р°РїРѕР»РЅРёС‚Рµ Р·Р°РіРѕР»РѕРІРѕРє Рё С‚РµРєСЃС‚");
      return;
    }

    let data = {};
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("JSON data must be an object");
        }
        data = parsed;
      } catch {
        showAlert("РџРѕР»Рµ JSON data РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РІР°Р»РёРґРЅС‹Рј JSON-РѕР±СЉРµРєС‚РѕРј");
        return;
      }
    }

    const r = await fetch("/api/admin/push/test-user", {
      method: "POST",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({ userId, slug, title, body: bodyText, data, includeInApp }),
    });
    if (!r.ok) {
      showAlert(await E(r));
      return;
    }

    const payload = await r.json().catch(() => null);
    const sent = Number(payload?.result?.sent || 0);
    const tokens = Number(payload?.result?.tokens || 0);
    const inserted = Number(payload?.inAppInserted || 0);
    showAlert(`РўРµСЃС‚ РѕС‚РїСЂР°РІР»РµРЅ. userId: ${payload?.userId || "-"}, sent: ${sent}, tokens: ${tokens}, in-app: ${inserted}`);
  });
  document.getElementById("push-broadcast-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const title = getFormValue(form, "title", "").trim();
    const bodyText = getFormValue(form, "body", "").trim();
    if (!title || !bodyText) {
      showAlert("Р—Р°РїРѕР»РЅРёС‚Рµ Р·Р°РіРѕР»РѕРІРѕРє Рё С‚РµРєСЃС‚ СЂР°СЃСЃС‹Р»РєРё");
      return;
    }

    const plan = getFormValue(form, "plan", "all");
    const status = getFormValue(form, "status", "all");
    const limit = Number(getFormValue(form, "limit", "20000")) || 20000;
    const includeInApp = !!(form.elements.namedItem("includeInApp") instanceof HTMLInputElement && form.elements.namedItem("includeInApp").checked);
    const onlyWithPushTokens = !!(form.elements.namedItem("onlyWithPushTokens") instanceof HTMLInputElement && form.elements.namedItem("onlyWithPushTokens").checked);
    const dryRun = !!(form.elements.namedItem("dryRun") instanceof HTMLInputElement && form.elements.namedItem("dryRun").checked);
    const rawData = getFormValue(form, "data", "").trim();

    let data = {};
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("JSON data must be an object");
        }
        data = parsed;
      } catch {
        showAlert("РџРѕР»Рµ JSON data РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РІР°Р»РёРґРЅС‹Рј JSON-РѕР±СЉРµРєС‚РѕРј");
        return;
      }
    }

    const warning = dryRun
      ? "РЎРґРµР»Р°С‚СЊ dry-run СЂР°СЃСЃС‹Р»РєРё?"
      : "РћС‚РїСЂР°РІРёС‚СЊ push-СЂР°СЃСЃС‹Р»РєСѓ РІС‹Р±СЂР°РЅРЅРѕР№ Р°СѓРґРёС‚РѕСЂРёРё?";
    if (!await showConfirm(warning)) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }
    setPushBroadcastStatus("РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЂР°СЃСЃС‹Р»РєРё...", "progress");

    const r = await fetch("/api/admin/push/broadcast/start", {
      method: "POST",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title,
        body: bodyText,
        plan,
        status,
        limit,
        includeInApp,
        onlyWithPushTokens,
        dryRun,
        data,
      }),
    });
    if (!r.ok) {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
      showAlert(await E(r));
      return;
    }

    const payload = await r.json().catch(() => null);
    const jobId = String(payload?.job?.id || "").trim();
    if (!jobId) {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
      setPushBroadcastStatus("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ СЂР°СЃСЃС‹Р»РєСѓ", "error");
      return;
    }

    stopPushBroadcastPolling();
    await pollBroadcastJob(jobId, (success) => {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
      if (!success) {
        showAlert("Р Р°СЃСЃС‹Р»РєР° Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃ РѕС€РёР±РєРѕР№");
      }
    });
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
  if (tab === "purchases") {
    const form = document.getElementById("purchases-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "type", getInitial("p_type", "type") || "all");
      setFormValue(form, "user", getInitial("p_user", "user") || "");
      setFormValue(form, "dateFrom", getInitial("p_date_from", "dateFrom") || "");
      setFormValue(form, "dateTo", getInitial("p_date_to", "dateTo") || "");
      setFormValue(form, "page", getInitial("p_page", "page") || "1");
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
      setFormValue(form, "plan", getInitial("u_plan", "plan") || "all");
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
  if (tab === "verification") {
    const form = document.getElementById("verification-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "status", getInitial("v_status", "status") || "all");
      setFormValue(form, "page", getInitial("v_page", "page") || "1");
      syncVerificationFiltersFromLocation(form);
    }
  }

  void loadMaintenanceBanner();

  if (tab === "analytics") void loadAnalytics();
  if (tab === "orders") void loadOrders();
  if (tab === "purchases") {
    void loadPurchases();
    void loadPricingSettings();
  }
  if (tab === "users") void loadUsers();
  if (tab === "slugs") void loadSlugs();
  if (tab === "cards") void loadCards();
  if (tab === "bracelets") void loadBracelets();
  if (tab === "testimonials") void loadTestimonials();
  if (tab === "logs") void loadLogs();
  const verificationSection = document.getElementById("tab-verification");
  if (tab === "verification" || (verificationSection instanceof HTMLElement && !verificationSection.classList.contains("hidden"))) {
    void loadVerificationRequests();
  }
  if (tab === "score") void loadScoreManagement();
})();


