
(function () {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;

  const adminRole = String(body.getAttribute("data-admin-role") || "admin").toLowerCase();
  const isManager = adminRole === "manager";
  const userCardBasePath = isManager ? "/manager/users" : "/admin/users";
  const dashboardBasePath = isManager ? "/manager/dashboard" : "/admin/dashboard";
  const assignableBadgeTypes = ["unqx_staff", "government"];
  const PET_TYPE_LABELS = {
    kitten: "Коала",
    puppy: "Котик",
    snake: "Леопард",
  };

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

  const urlTab = new URLSearchParams(window.location.search).get("tab") || "";
  const bodyTab = String(body.getAttribute("data-active-tab") || "analytics").trim();
  const tab = String((isManager ? bodyTab : (urlTab || bodyTab || "analytics"))).trim();
  const tabAliases = { slug: "slugs" };
  const normalizedTab = tabAliases[tab] || tab;
  const tabSections = Array.from(document.querySelectorAll('section[id^="tab-"]'));
  const dashboardDebugEnabled =
    new URLSearchParams(window.location.search).get("debug") === "admin-dashboard";
  const dbg = dashboardDebugEnabled
    ? (...args) => console.log("[admin-dashboard]", ...args)
    : () => { };
  dbg("init", {
    href: window.location.href,
    urlTab,
    bodyActiveTab: body.getAttribute("data-active-tab"),
    tab,
    normalizedTab,
    sections: tabSections.map((node) => ({
      id: node.id,
      hidden: node.classList.contains("hidden"),
    })),
  });
  const activeSection =
    document.getElementById(`tab-${normalizedTab}`) ||
    document.getElementById("tab-analytics");
  tabSections.forEach((node) => {
    if (node instanceof HTMLElement) node.classList.add("hidden");
  });
  if (activeSection instanceof HTMLElement) {
    let cursor = activeSection;
    while (cursor instanceof HTMLElement) {
      if (cursor.id && cursor.id.startsWith("tab-")) {
        cursor.classList.remove("hidden");
      }
      cursor = cursor.parentElement;
    }
    dbg("active-section-unhidden", activeSection.id);
    dbg("active-section-state", {
      id: activeSection.id,
      className: activeSection.className,
      hiddenClass: activeSection.classList.contains("hidden"),
      display: window.getComputedStyle(activeSection).display,
      childCount: activeSection.children.length,
      innerHtmlLength: activeSection.innerHTML.length,
    });
  }
  if (!tabSections.some((node) => node instanceof HTMLElement && !node.classList.contains("hidden"))) {
    dbg("no-visible-sections-fallback", "unhiding all sections");
    tabSections.forEach((node) => {
      if (node instanceof HTMLElement) node.classList.remove("hidden");
    });
  }
  dbg(
    "sections-after-init",
    JSON.stringify(
      tabSections.map((node) => ({
        id: node.id,
        hiddenClass: node.classList.contains("hidden"),
        display: window.getComputedStyle(node).display,
      })),
    ),
  );
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
  const DATE_ONLY = (v) => {
    if (!v) return "-";
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("ru-RU");
  };
  const P = (v) => `${Number(v || 0).toLocaleString("ru-RU")} сум`;
  const formatPendingCountdown = (iso) => {
    if (!iso) return "";
    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) return "";
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return "время вышло";
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `осталось ${hours}ч ${minutes}мин`;
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
  const RESERVED_ASSIGNABLE_SLUGS = new Set(["ADMIN", "API", "AUTH", "FAQ", "MANAGER", "PROFILE", "QR", "TERMS"]);
  const normalizeShortSlug = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const isLegacySlug = (value) => /^[A-Z]{3}[0-9]{3}$/.test(String(value || ""));
  const isManagedUsernameSlug = (value) => {
    const slug = String(value || "").toUpperCase();
    return /^(0|[1-9][0-9]{0,2})$/.test(slug) || /^[A-Z]{1,3}$/.test(slug);
  };
  const isShortSlug = (value) => {
    const slug = String(value || "").toUpperCase();
    return !RESERVED_ASSIGNABLE_SLUGS.has(slug) && (isLegacySlug(slug) || isManagedUsernameSlug(slug));
  };
  const assignableSlugHint = "AAA000, 0-999 или A-Z до 3 букв";
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
    at: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M15 9.8v4.4a2.2 2.2 0 0 0 3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="11.3" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/>',
    badge: '<path d="M12 3.5 14.3 8l5 .7-3.6 3.5.9 5-4.6-2.4-4.6 2.4.9-5L4.7 8.7l5-.7L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    idCard: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="11" r="2" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 16a3 3 0 0 1 5 0M14 10h4M14 14h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    key: '<circle cx="8" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M11.2 12H21M17 12v3M14 12v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    linkEdit: '<path d="M10 7h5a4 4 0 0 1 1.7 7.6M14 17H9a4 4 0 0 1-1.7-7.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m14.5 19 1.2-.2 4.7-4.7a1.3 1.3 0 0 0-1.8-1.8L14 17l-.3 1.3a.6.6 0 0 0 .8.7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
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
    sage_luxe: { label: "Verdant Luxe", fill: "#f7faf7", border: "#8ca18f", text: "#2f4034" },
    midnight_obsidian: { label: "Midnight Obsidian", fill: "#111927", border: "#5374a6", text: "#d6e6ff" },
    golden_noir: { label: "Noir Aureate", fill: "#161b28", border: "#c9ad6a", text: "#dfc98e" },
    aurora_codex: { label: "Aurora Scriptum", fill: "#f5ecd8", border: "#8a2a26", text: "#2b1f15" },
    nebula_glass: { label: "Apple Liquid Glass", fill: "#0a0f24", border: "#a9c7ff", text: "#f1f6ff" },
    galaxy: { label: "Galaxy", fill: "#2A085C", border: "#000000", text: "#00e5ff", bg: "#12072B" },
    velours: { label: "Velours Luxe", fill: "#2d0a12", border: "#5a1828", text: "#c9a55a", bg: "#2d0a12" },
    graffiti_neon: { label: "Graffiti Neon", fill: "#19142a", border: "#5ef7ff", text: "#9bff62", bg: "#19142a" },
    heritage_crest: { label: "Sweet Ribbon", fill: "#ffc6dd", border: "#ff9fca", text: "#7a2446", bg: "#ffc6dd" },
    ivory_tennis: { label: "Gotham Shadow", fill: "#111318", border: "#f0c84b", text: "#f4f4f5", bg: "#111318" },
    grand_slam_clay: { label: "Web Swing", fill: "#cf1f2d", border: "#6bb7ff", text: "#ffffff", bg: "#cf1f2d" },
    racing_green: { label: "Sakura Dream", fill: "#ffc8df", border: "#b7d7ff", text: "#6a2a4b", bg: "#ffc8df" },
    polo_navy: { label: "Neon Mecha", fill: "#0a3a52", border: "#4df7ff", text: "#eaffff", bg: "#0a3a52" },
    alpine_ski: { label: "Moon Prism", fill: "#d8c7ff", border: "#bfe9ff", text: "#4a3f7a", bg: "#d8c7ff" },
    boxing_legend: { label: "Shonen Flame", fill: "#d94818", border: "#ffd15a", text: "#fff5e8", bg: "#d94818" },
    basketball_court: { label: "Cyber Idol", fill: "#cf2b9f", border: "#61f7ff", text: "#fff3fb", bg: "#cf2b9f" },
    football_pitch: { label: "Forest Spirit", fill: "#1ba879", border: "#a8ffd6", text: "#f0fff8", bg: "#1ba879" },
    olympic_gold: { label: "Dragon Aura", fill: "#6732bd", border: "#ffd36e", text: "#fff6d8", bg: "#6732bd" },
    anime_blush: { label: "Anime Blush", fill: "#ff9ed1", border: "#a874ff", text: "#69264d", bg: "#ff9ed1" },
    cheetah_spots: { label: "Cheetah Skin", fill: "#f5c46b", border: "#2b1608", text: "#2b1608", bg: "#f5c46b" },
    serpent_scale: { label: "Serpent Scale", fill: "#155332", border: "#8ee6a8", text: "#ecfff1", bg: "#155332" },
    color_red: { label: "Color Red", fill: "#8e1627", border: "#ff6b85", text: "#fff2f5", bg: "#8e1627" },
    color_orange: { label: "Color Orange", fill: "#c85600", border: "#ffb957", text: "#fff4e5", bg: "#c85600" },
    color_yellow: { label: "Color Yellow", fill: "#d1a800", border: "#fff3a6", text: "#332500", bg: "#d1a800" },
    color_green: { label: "Color Green", fill: "#1f8f47", border: "#b4ff82", text: "#f2fff4", bg: "#1f8f47" },
    color_teal: { label: "Color Teal", fill: "#0f8c93", border: "#91f8ff", text: "#ecffff", bg: "#0f8c93" },
    color_blue: { label: "Color Blue", fill: "#1d63d6", border: "#8fc8ff", text: "#eef6ff", bg: "#1d63d6" },
    color_purple: { label: "Color Purple", fill: "#7a2fca", border: "#d6adff", text: "#fbf4ff", bg: "#7a2fca" },
    color_pink: { label: "Color Pink", fill: "#d53c84", border: "#ffb6dc", text: "#fff3f9", bg: "#d53c84" },
  };
  function themePill(theme) {
    const id = String(theme || "default_dark").trim();
    const meta = THEME_META[id] || THEME_META.default_dark;
    const bg = meta.bg || `linear-gradient(90deg, ${meta.fill} 0%, ${meta.fill} 14px, transparent 14px, transparent 100%)`;
    return `<span class="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold" style="border-color:${meta.border};color:${meta.text};background:${bg};">${X(meta.label)}</span>`;
  }
  const I = (name, size = 14) => `<svg class="admin-i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const statusMeta = {
    pending: { label: "На рассмотрении", tone: "warning" },
    verification_approved: { label: "Одобрено", tone: "success" },
    verification_rejected: { label: "Отклонено", tone: "danger" },
    verification_revoked: { label: "Снято", tone: "muted" },
    new: { label: "Новая", tone: "info" },
    processed: { label: "Обработано", tone: "success" },
    contacted: { label: "Связались", tone: "muted" },
    paid: { label: "Оплачено", tone: "warning" },
    approved: { label: "Активировано", tone: "success" },
    rejected: { label: "Отклонено", tone: "danger" },
    expired: { label: "Отклонено", tone: "muted" },
    muted: { label: "Скрыт", tone: "muted" },
    ORDERED: { label: "Заказан", tone: "warning" },
    SHIPPED: { label: "Отправлен", tone: "info" },
    DELIVERED: { label: "Доставлен", tone: "success" },
  };
  function statusChip(code) {
    const m = statusMeta[code] || { label: String(code || "-"), tone: "muted" };
    return `<span class="admin-status-chip is-${m.tone}"><span class="admin-status-dot"></span>${X(m.label)}</span>`;
  }
  function reportTypeLabel(value) {
    const key = String(value || "").trim().toLowerCase();
    const labels = {
      child_safety: "Безопасность детей",
      sexual_content: "Сексуальный контент",
      violence: "Насилие",
      fraud: "Мошенничество",
      hate_or_harassment: "Ненависть/травля",
      illegal_goods: "Незаконные товары/услуги",
      other: "Другое",
    };
    return labels[key] || "Другое";
  }
  function petTypeLabel(value) {
    const key = String(value || "").trim().toLowerCase();
    return PET_TYPE_LABELS[key] || "Питомец";
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

  const userCreateModal = document.getElementById("user-create-modal");
  const userCreateOpen = document.getElementById("users-create-open");
  const userCreateClose = document.getElementById("user-create-close");
  const userCreateForm = document.getElementById("user-create-form");
  const userCreateError = document.getElementById("user-create-error");
  const userCreateLoginStatus = document.getElementById("user-create-login-status");
  const userCreateSlugStatus = document.getElementById("user-create-slug-status");
  const userCreateSlugPrice = document.getElementById("user-create-slug-price");
  const userCreateEmailStatus = document.getElementById("user-create-email-status");
  const userVerificationModal = document.getElementById("user-verification-modal");
  const userVerificationClose = document.getElementById("user-verification-close");
  const userVerificationForm = document.getElementById("user-verification-form");
  const userVerificationError = document.getElementById("user-verification-error");
  const userVerificationUser = document.getElementById("user-verification-user");
  const verificationDetailModal = document.getElementById("verification-detail-modal");
  const verificationDetailClose = document.getElementById("verification-detail-close");
  const verificationDetailTitle = document.getElementById("verification-detail-title");
  const verificationDetailBody = document.getElementById("verification-detail-body");
  const verificationDetailActions = document.getElementById("verification-detail-actions");
  const userBadgeModal = document.getElementById("user-badge-modal");
  const userBadgeClose = document.getElementById("user-badge-close");
  const userBadgeForm = document.getElementById("user-badge-form");
  const userBadgeUser = document.getElementById("user-badge-user");
  const userBadgeError = document.getElementById("user-badge-error");
  const USER_CREATE_LOGIN_REGEX = /^[a-z0-9._@+-]+$/;
  const USER_CREATE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const userCreateState = {
    slugCheckSeq: 0,
    loginCheckSeq: 0,
    emailCheckSeq: 0,
    slugDebounceTimer: null,
    loginDebounceTimer: null,
    emailDebounceTimer: null,
  };
  const verificationRequestsState = {
    itemsById: new Map(),
    selectedId: "",
  };

  function setUserCreateError(message) {
    if (!(userCreateError instanceof HTMLElement)) return;
    const text = String(message || "").trim();
    if (!text) {
      userCreateError.classList.add("hidden");
      userCreateError.textContent = "";
      return;
    }
    userCreateError.textContent = text;
    userCreateError.classList.remove("hidden");
  }

  function setCreateInlineStatus(node, text, tone = "muted") {
    if (!(node instanceof HTMLElement)) return;
    const value = String(text || "").trim();
    const toneClass =
      tone === "error"
        ? "text-red-700"
        : tone === "success"
          ? "text-emerald-700"
          : tone === "info"
            ? "text-blue-700"
            : "text-neutral-500";
    node.className = `mt-1 block text-xs ${toneClass}`;
    node.textContent = value;
  }

  function setCreateInputTone(input, tone = "neutral") {
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return;
    input.classList.remove("border-red-400", "focus:border-red-500", "focus:ring-red-100");
    input.classList.remove("border-emerald-400", "focus:border-emerald-500", "focus:ring-emerald-100");
    if (tone === "error") {
      input.classList.add("border-red-400", "focus:border-red-500", "focus:ring-red-100");
      return;
    }
    if (tone === "success") {
      input.classList.add("border-emerald-400", "focus:border-emerald-500", "focus:ring-emerald-100");
    }
  }

  function normalizeUserCreateSlug(value) {
    return normalizeShortSlug(value);
  }

  function normalizeUserCreateLogin(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeUserCreateEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeUserCreateProfileType(value) {
    return String(value || "").trim().toLowerCase() === "company" ? "company" : "person";
  }

  function normalizeBadgeTypesInput(value) {
    const source = Array.isArray(value)
      ? value
      : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const selected = [];
    source.forEach((item) => {
      const normalized = String(item || "").trim().toLowerCase();
      if (assignableBadgeTypes.includes(normalized) && !selected.includes(normalized)) {
        selected.push(normalized);
      }
    });
    return selected.slice(0, 2);
  }

  function getPrimaryBadgeType(badgeTypes) {
    const selected = normalizeBadgeTypesInput(badgeTypes);
    if (selected.includes("government")) return "government";
    if (selected.includes("unqx_staff")) return "unqx_staff";
    return "none";
  }

  function getBadgeTypeInputs(form) {
    if (!(form instanceof HTMLFormElement)) return [];
    return Array.from(form.querySelectorAll('input[name="badgeTypes"][type="checkbox"]'))
      .filter((input) => input instanceof HTMLInputElement && assignableBadgeTypes.includes(input.value));
  }

  function getSelectedBadgeTypes(form) {
    return getBadgeTypeInputs(form)
      .filter((input) => input.checked)
      .map((input) => input.value);
  }

  function setSelectedBadgeTypes(form, badgeTypes) {
    const selected = normalizeBadgeTypesInput(badgeTypes);
    getBadgeTypeInputs(form).forEach((input) => {
      input.checked = selected.includes(input.value);
    });
  }

  function formatUserCreatePrice(value) {
    return `${Number(value || 0).toLocaleString("ru-RU")} сум`;
  }

  function mapSlugAvailabilityReason(reason) {
    switch (String(reason || "").toLowerCase()) {
      case "available":
        return "Slug свободен";
      case "invalid_format":
        return `Slug должен быть в формате ${assignableSlugHint}`;
      case "reserved_path":
        return "Этот slug зарезервирован системным маршрутом";
      case "pending":
        return "Slug временно забронирован другим пользователем";
      case "blocked":
        return "Slug временно недоступен";
      case "reserved_drop":
      case "drop_reserved":
        return "Slug доступен только в активном дропе";
      case "taken":
      case "approved":
      case "active":
      case "private":
      case "paused":
        return "Slug уже занят";
      default:
        return "Slug недоступен";
    }
  }

  async function fetchUserCreateIdentityCheck({ login, email }) {
    const params = new URLSearchParams();
    if (login) params.set("login", login);
    if (email) params.set("email", email);
    if (!params.toString()) return null;
    const response = await fetch(`/api/admin/users/check?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(String(payload?.error || `HTTP ${response.status}`));
      err.code = String(payload?.code || "");
      throw err;
    }
    return payload && typeof payload === "object" ? payload : null;
  }

  async function fetchUserCreateSlugInfo(slugValue) {
    const slug = normalizeUserCreateSlug(slugValue);
    if (!isShortSlug(slug)) {
      return {
        slug,
        validFormat: false,
        available: false,
        reason: "invalid_format",
        price: null,
      };
    }
    const availabilityResponse = await fetch(`/api/admin/slugs/availability/check?slug=${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const availabilityPayload = await availabilityResponse.json().catch(() => ({}));
    if (!availabilityResponse.ok) {
      const err = new Error(String(availabilityPayload?.error || `HTTP ${availabilityResponse.status}`));
      err.code = String(availabilityPayload?.code || "");
      throw err;
    }
    return {
      slug: String(availabilityPayload?.slug || slug),
      validFormat: Boolean(availabilityPayload?.validFormat),
      available: Boolean(availabilityPayload?.available),
      reason: String(availabilityPayload?.reason || ""),
      price: availabilityPayload?.price === null || availabilityPayload?.price === undefined ? null : Number(availabilityPayload.price || 0),
    };
  }

  async function validateUserCreateLoginLive(loginInput) {
    const normalized = normalizeUserCreateLogin(loginInput.value);
    loginInput.value = normalized;
    const seq = ++userCreateState.loginCheckSeq;
    if (!normalized) {
      setCreateInputTone(loginInput, "neutral");
      setCreateInlineStatus(userCreateLoginStatus, "");
      return { ok: false, code: "LOGIN_REQUIRED" };
    }
    if (normalized.length < 3) {
      setCreateInputTone(loginInput, "error");
      setCreateInlineStatus(userCreateLoginStatus, "Минимум 3 символа", "error");
      return { ok: false, code: "LOGIN_TOO_SHORT" };
    }
    if (!USER_CREATE_LOGIN_REGEX.test(normalized)) {
      setCreateInputTone(loginInput, "error");
      setCreateInlineStatus(userCreateLoginStatus, "Разрешены только a-z, 0-9 и символы . _ @ + -", "error");
      return { ok: false, code: "LOGIN_INVALID_FORMAT" };
    }
    setCreateInlineStatus(userCreateLoginStatus, "Проверяем логин...", "info");
    try {
      const payload = await fetchUserCreateIdentityCheck({ login: normalized });
      if (seq !== userCreateState.loginCheckSeq) return null;
      const loginCheck = payload?.login || {};
      if (loginCheck.available === false) {
        setCreateInputTone(loginInput, "error");
        setCreateInlineStatus(userCreateLoginStatus, loginCheck.message || "Этот логин уже занят", "error");
        return { ok: false, code: "LOGIN_TAKEN" };
      }
      setCreateInputTone(loginInput, "success");
      setCreateInlineStatus(userCreateLoginStatus, "Логин свободен", "success");
      return { ok: true };
    } catch {
      if (seq !== userCreateState.loginCheckSeq) return null;
      setCreateInputTone(loginInput, "neutral");
      setCreateInlineStatus(userCreateLoginStatus, "Не удалось проверить логин. Можно продолжить.", "muted");
      return { ok: true, unchecked: true };
    }
  }

  async function validateUserCreateEmailLive(emailInput) {
    const normalized = normalizeUserCreateEmail(emailInput.value);
    emailInput.value = normalized;
    const seq = ++userCreateState.emailCheckSeq;
    if (!normalized) {
      setCreateInputTone(emailInput, "neutral");
      setCreateInlineStatus(userCreateEmailStatus, "Email не обязателен, но поможет восстановить доступ.");
      return { ok: true };
    }
    if (!USER_CREATE_EMAIL_REGEX.test(normalized)) {
      setCreateInputTone(emailInput, "error");
      setCreateInlineStatus(userCreateEmailStatus, "Введите email в формате name@example.com", "error");
      return { ok: false, code: "EMAIL_INVALID" };
    }
    setCreateInlineStatus(userCreateEmailStatus, "Проверяем email...", "info");
    try {
      const payload = await fetchUserCreateIdentityCheck({ email: normalized });
      if (seq !== userCreateState.emailCheckSeq) return null;
      const emailCheck = payload?.email || {};
      if (emailCheck.available === false) {
        setCreateInputTone(emailInput, "error");
        setCreateInlineStatus(userCreateEmailStatus, emailCheck.message || "Этот email уже используется", "error");
        return { ok: false, code: "EMAIL_TAKEN" };
      }
      setCreateInputTone(emailInput, "success");
      setCreateInlineStatus(userCreateEmailStatus, "Email свободен", "success");
      return { ok: true };
    } catch {
      if (seq !== userCreateState.emailCheckSeq) return null;
      setCreateInputTone(emailInput, "neutral");
      setCreateInlineStatus(userCreateEmailStatus, "Не удалось проверить email. Можно продолжить.", "muted");
      return { ok: true, unchecked: true };
    }
  }

  async function validateUserCreateSlugLive(slugInput) {
    const normalized = normalizeUserCreateSlug(slugInput.value);
    slugInput.value = normalized;
    const seq = ++userCreateState.slugCheckSeq;
    if (!normalized) {
      setCreateInputTone(slugInput, "neutral");
      setCreateInlineStatus(userCreateSlugStatus, "");
      setCreateInlineStatus(userCreateSlugPrice, "");
      return { ok: false, empty: true };
    }
    if (!isShortSlug(normalized)) {
      setCreateInputTone(slugInput, "error");
      setCreateInlineStatus(userCreateSlugStatus, `Slug должен быть в формате ${assignableSlugHint}`, "error");
      setCreateInlineStatus(userCreateSlugPrice, "");
      return { ok: false, code: "SLUG_INVALID" };
    }
    setCreateInlineStatus(userCreateSlugStatus, "Проверяем slug...", "info");
    try {
      const payload = await fetchUserCreateSlugInfo(normalized);
      if (seq !== userCreateState.slugCheckSeq) return null;
      if (!payload.available) {
        setCreateInputTone(slugInput, "error");
        setCreateInlineStatus(userCreateSlugStatus, mapSlugAvailabilityReason(payload.reason), "error");
        setCreateInlineStatus(userCreateSlugPrice, payload.price != null ? `Цена: ${formatUserCreatePrice(payload.price)}` : "");
        return { ok: false, code: "SLUG_TAKEN", payload };
      }
      setCreateInputTone(slugInput, "success");
      setCreateInlineStatus(userCreateSlugStatus, "Slug свободен", "success");
      setCreateInlineStatus(
        userCreateSlugPrice,
        payload.price != null ? `Текущая цена: ${formatUserCreatePrice(payload.price)}` : "",
      );
      return { ok: true, payload };
    } catch {
      if (seq !== userCreateState.slugCheckSeq) return null;
      setCreateInputTone(slugInput, "neutral");
      setCreateInlineStatus(userCreateSlugStatus, "Не удалось проверить slug. Попробуйте ещё раз.", "error");
      setCreateInlineStatus(userCreateSlugPrice, "");
      return { ok: false, code: "SLUG_CHECK_FAILED" };
    }
  }

  function mapUserCreateSubmitError(payload, fallbackStatus) {
    const code = String(payload?.code || "").trim();
    if (code === "VALIDATION_ERROR") return "Проверьте форму: имя, город, логин и пароль обязательны, пароль минимум 8 символов.";
    if (code === "EMAIL_INVALID") return "Email указан в неверном формате.";
    if (code === "PLAN_REQUIRED_FOR_ACTIVATION") return "Для мгновенной активации выберите тариф.";
    if (code === "SLUG_INVALID") return `Slug должен быть в формате ${assignableSlugHint}.`;
    if (code === "SLUG_RESERVED") return "Этот slug зарезервирован системным маршрутом.";
    if (code === "LOGIN_TAKEN") return "Этот логин уже занят. Укажите другой.";
    if (code === "EMAIL_TAKEN") return "Этот email уже используется. Укажите другой.";
    if (code === "SLUG_TAKEN") return "Этот slug уже занят. Выберите свободный.";
    if (code === "SLUG_NOT_FREE") return "Этот slug сейчас недоступен. Выберите другой.";
    if (code === "LOGIN_OR_EMAIL_TAKEN") return "Логин или email уже используются.";
    const fallback = String(payload?.error || "").trim();
    if (fallback.toLowerCase() === "validation failed") {
      return "Форма заполнена с ошибками. Проверьте поля и попробуйте снова.";
    }
    return fallback || `Не удалось создать пользователя (HTTP ${fallbackStatus || 500}).`;
  }

  function clearUserCreateValidationState() {
    userCreateState.slugCheckSeq += 1;
    userCreateState.loginCheckSeq += 1;
    userCreateState.emailCheckSeq += 1;
    if (userCreateState.slugDebounceTimer) {
      clearTimeout(userCreateState.slugDebounceTimer);
      userCreateState.slugDebounceTimer = null;
    }
    if (userCreateState.loginDebounceTimer) {
      clearTimeout(userCreateState.loginDebounceTimer);
      userCreateState.loginDebounceTimer = null;
    }
    if (userCreateState.emailDebounceTimer) {
      clearTimeout(userCreateState.emailDebounceTimer);
      userCreateState.emailDebounceTimer = null;
    }
  }

  function resetUserCreateFieldTones() {
    if (!(userCreateForm instanceof HTMLFormElement)) return;
    const name = userCreateForm.elements.namedItem("name");
    const city = userCreateForm.elements.namedItem("city");
    const login = userCreateForm.elements.namedItem("login");
    const password = userCreateForm.elements.namedItem("password");
    const email = userCreateForm.elements.namedItem("email");
    const profileType = userCreateForm.elements.namedItem("profileType");
    const plan = userCreateForm.elements.namedItem("plan");
    const slug = userCreateForm.elements.namedItem("slug");
    setCreateInputTone(name, "neutral");
    setCreateInputTone(city, "neutral");
    setCreateInputTone(login, "neutral");
    setCreateInputTone(password, "neutral");
    setCreateInputTone(email, "neutral");
    setCreateInputTone(profileType, "neutral");
    setCreateInputTone(plan, "neutral");
    setCreateInputTone(slug, "neutral");
  }

  function openUserCreate() {
    if (!(userCreateModal instanceof HTMLElement)) return;
    clearUserCreateValidationState();
    resetUserCreateFieldTones();
    setUserCreateError("");
    if (userCreateForm instanceof HTMLFormElement) {
      const plan = userCreateForm.elements.namedItem("plan");
      if (plan instanceof HTMLSelectElement) {
        const noneOption = plan.querySelector('option[value="none"]');
        if (noneOption instanceof HTMLOptionElement) {
          noneOption.disabled = isManager;
        }
        if (isManager && plan.value === "none") {
          plan.value = "premium";
        }
      }
      const slug = userCreateForm.elements.namedItem("slug");
      if (slug instanceof HTMLInputElement) {
        slug.value = normalizeUserCreateSlug(slug.value);
      }
      const login = userCreateForm.elements.namedItem("login");
      if (login instanceof HTMLInputElement) {
        login.value = normalizeUserCreateLogin(login.value);
      }
      const email = userCreateForm.elements.namedItem("email");
      if (email instanceof HTMLInputElement) {
        email.value = normalizeUserCreateEmail(email.value);
      }
      const profileType = userCreateForm.elements.namedItem("profileType");
      if (profileType instanceof HTMLSelectElement) {
        profileType.value = normalizeUserCreateProfileType(profileType.value);
      }
      setSelectedBadgeTypes(userCreateForm, getSelectedBadgeTypes(userCreateForm));
    }
    setCreateInlineStatus(userCreateLoginStatus, "");
    setCreateInlineStatus(userCreateSlugStatus, "");
    setCreateInlineStatus(userCreateSlugPrice, "");
    setCreateInlineStatus(userCreateEmailStatus, "Email не обязателен, но поможет восстановить доступ.");
    userCreateModal.classList.remove("hidden");
    userCreateModal.classList.add("flex");
    userCreateModal.setAttribute("aria-hidden", "false");
  }

  function closeUserCreate() {
    if (!(userCreateModal instanceof HTMLElement)) return;
    clearUserCreateValidationState();
    userCreateModal.classList.add("hidden");
    userCreateModal.classList.remove("flex");
    userCreateModal.setAttribute("aria-hidden", "true");
  }

  function setUserVerificationError(message) {
    if (!(userVerificationError instanceof HTMLElement)) return;
    const text = String(message || "").trim();
    if (!text) {
      userVerificationError.textContent = "";
      userVerificationError.classList.add("hidden");
      return;
    }
    userVerificationError.textContent = text;
    userVerificationError.classList.remove("hidden");
  }

  function syncUserVerificationFields() {
    if (!(userVerificationForm instanceof HTMLFormElement)) return;
    const statusField = userVerificationForm.elements.namedItem("status");
    const companyField = userVerificationForm.elements.namedItem("company");
    const roleField = userVerificationForm.elements.namedItem("role");
    if (!(statusField instanceof HTMLSelectElement)) return;
    if (!(companyField instanceof HTMLInputElement)) return;
    if (!(roleField instanceof HTMLInputElement)) return;

    const shouldVerify = statusField.value === "verified";
    companyField.disabled = !shouldVerify;
    roleField.disabled = !shouldVerify;
    companyField.required = shouldVerify;
    roleField.required = shouldVerify;
    if (!shouldVerify) {
      setCreateInputTone(companyField, "neutral");
      setCreateInputTone(roleField, "neutral");
    }
  }

  function openUserVerificationModal({ userId, userName, isVerified, company, role, badgeType, badgeTypes }) {
    if (!(userVerificationModal instanceof HTMLElement)) return;
    if (!(userVerificationForm instanceof HTMLFormElement)) return;
    const userIdField = userVerificationForm.elements.namedItem("userId");
    const statusField = userVerificationForm.elements.namedItem("status");
    const companyField = userVerificationForm.elements.namedItem("company");
    const roleField = userVerificationForm.elements.namedItem("role");
    if (!(userIdField instanceof HTMLInputElement)) return;
    if (!(statusField instanceof HTMLSelectElement)) return;
    if (!(companyField instanceof HTMLInputElement)) return;
    if (!(roleField instanceof HTMLInputElement)) return;
    if (!getBadgeTypeInputs(userVerificationForm).length) return;

    setUserVerificationError("");
    userIdField.value = String(userId || "").trim();
    statusField.value = isVerified ? "verified" : "unverified";
    companyField.value = String(company || "").trim();
    roleField.value = String(role || "").trim();
    const selectedBadgeTypes = normalizeBadgeTypesInput(badgeTypes).length
      ? normalizeBadgeTypesInput(badgeTypes)
      : normalizeBadgeTypesInput(badgeType);
    setSelectedBadgeTypes(userVerificationForm, selectedBadgeTypes);
    setCreateInputTone(statusField, "neutral");
    setCreateInputTone(companyField, "neutral");
    setCreateInputTone(roleField, "neutral");
    if (userVerificationUser instanceof HTMLElement) {
      userVerificationUser.textContent = `Пользователь: ${String(userName || "—").trim() || "—"}`;
    }
    syncUserVerificationFields();

    userVerificationModal.classList.remove("hidden");
    userVerificationModal.classList.add("flex");
    userVerificationModal.setAttribute("aria-hidden", "false");
  }

  function closeUserVerificationModal() {
    if (!(userVerificationModal instanceof HTMLElement)) return;
    userVerificationModal.classList.add("hidden");
    userVerificationModal.classList.remove("flex");
    userVerificationModal.setAttribute("aria-hidden", "true");
    setUserVerificationError("");
  }

  function setUserBadgeError(message) {
    if (!(userBadgeError instanceof HTMLElement)) return;
    const text = String(message || "").trim();
    if (!text) {
      userBadgeError.textContent = "";
      userBadgeError.classList.add("hidden");
      return;
    }
    userBadgeError.textContent = text;
    userBadgeError.classList.remove("hidden");
  }

  function openUserBadgeModal({ userId, userName, badgeType, badgeTypes }) {
    if (!(userBadgeModal instanceof HTMLElement)) return;
    if (!(userBadgeForm instanceof HTMLFormElement)) return;
    const userIdField = userBadgeForm.elements.namedItem("userId");
    if (!(userIdField instanceof HTMLInputElement)) return;
    if (!getBadgeTypeInputs(userBadgeForm).length) return;

    userIdField.value = String(userId || "").trim();
    const selectedBadgeTypes = normalizeBadgeTypesInput(badgeTypes).length
      ? normalizeBadgeTypesInput(badgeTypes)
      : normalizeBadgeTypesInput(badgeType);
    setSelectedBadgeTypes(userBadgeForm, selectedBadgeTypes);
    setUserBadgeError("");
    if (userBadgeUser instanceof HTMLElement) {
      userBadgeUser.textContent = `Пользователь: ${String(userName || "—").trim() || "—"}`;
    }
    userBadgeModal.classList.remove("hidden");
    userBadgeModal.classList.add("flex");
    userBadgeModal.setAttribute("aria-hidden", "false");
  }

  function closeUserBadgeModal() {
    if (!(userBadgeModal instanceof HTMLElement)) return;
    userBadgeModal.classList.add("hidden");
    userBadgeModal.classList.remove("flex");
    userBadgeModal.setAttribute("aria-hidden", "true");
    setUserBadgeError("");
  }

  userCreateOpen?.addEventListener("click", openUserCreate);
  userCreateClose?.addEventListener("click", closeUserCreate);
  userCreateModal?.addEventListener("click", (e) => {
    if (e.target === userCreateModal) closeUserCreate();
  });
  userVerificationClose?.addEventListener("click", closeUserVerificationModal);
  userVerificationModal?.addEventListener("click", (e) => {
    if (e.target === userVerificationModal) closeUserVerificationModal();
  });
  verificationDetailClose?.addEventListener("click", closeVerificationDetailModal);
  verificationDetailModal?.addEventListener("click", (e) => {
    if (e.target === verificationDetailModal) closeVerificationDetailModal();
  });
  verificationDetailActions?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-vr-modal-action]") : null;
    if (!(target instanceof HTMLElement)) return;
    const action = String(target.getAttribute("data-vr-modal-action") || "").trim();
    if (action === "close") {
      closeVerificationDetailModal();
      return;
    }
    const id = verificationRequestsState.selectedId;
    if (id) void runVerificationRequestAction(action, id);
  });
  userBadgeClose?.addEventListener("click", closeUserBadgeModal);
  userBadgeModal?.addEventListener("click", (e) => {
    if (e.target === userBadgeModal) closeUserBadgeModal();
  });
  userVerificationForm?.elements?.namedItem?.("status")?.addEventListener?.("change", () => {
    syncUserVerificationFields();
    setUserVerificationError("");
  });
  userVerificationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(userVerificationForm instanceof HTMLFormElement)) return;
    const userIdField = userVerificationForm.elements.namedItem("userId");
    const statusField = userVerificationForm.elements.namedItem("status");
    const companyField = userVerificationForm.elements.namedItem("company");
    const roleField = userVerificationForm.elements.namedItem("role");
    if (!(userIdField instanceof HTMLInputElement)) return;
    if (!(statusField instanceof HTMLSelectElement)) return;
    if (!(companyField instanceof HTMLInputElement)) return;
    if (!(roleField instanceof HTMLInputElement)) return;
    if (!getBadgeTypeInputs(userVerificationForm).length) return;

    const userId = String(userIdField.value || "").trim();
    const status = statusField.value === "verified" ? "verified" : "unverified";
    const company = String(companyField.value || "").trim();
    const role = String(roleField.value || "").trim();
    const badgeTypes = getSelectedBadgeTypes(userVerificationForm);
    const badgeType = getPrimaryBadgeType(badgeTypes);

    setUserVerificationError("");
    setCreateInputTone(statusField, "neutral");
    setCreateInputTone(companyField, "neutral");
    setCreateInputTone(roleField, "neutral");

    if (!userId) {
      setUserVerificationError("Не удалось определить пользователя. Обновите страницу и попробуйте снова.");
      return;
    }
    if (status === "verified") {
      if (!company) {
        setCreateInputTone(companyField, "error");
        setUserVerificationError("Укажите место работы.");
        return;
      }
      if (!role) {
        setCreateInputTone(roleField, "error");
        setUserVerificationError("Укажите должность.");
        return;
      }
    }

    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, {
      method: "PATCH",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        status,
        company: status === "verified" ? company : "",
        role: status === "verified" ? role : "",
        badgeType,
        badgeTypes,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const code = String(payload?.code || "").trim();
      if (code === "VERIFICATION_PROFILE_REQUIRED") {
        setUserVerificationError("Для активации верификации заполните место работы и должность.");
      } else if (code === "VERIFICATION_STATUS_INVALID") {
        setUserVerificationError("Выберите корректный статус верификации.");
      } else if (code === "USER_NOT_FOUND") {
        setUserVerificationError("Пользователь не найден.");
      } else if (code === "USERS_STORAGE_UNAVAILABLE") {
        setUserVerificationError("Хранилище пользователей временно недоступно. Попробуйте позже.");
      } else if (code === "MANAGER_FORBIDDEN") {
        setUserVerificationError("У вас нет доступа к этой операции.");
      } else {
        setUserVerificationError(`Не удалось сохранить изменения (HTTP ${response.status}).`);
      }
      return;
    }

    closeUserVerificationModal();
    await showAlert(status === "verified" ? "Верификация активирована." : "Верификация снята.");
    void loadUsers();
    closeAllRowMenus();
  });
  userBadgeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(userBadgeForm instanceof HTMLFormElement)) return;
    const userIdField = userBadgeForm.elements.namedItem("userId");
    if (!(userIdField instanceof HTMLInputElement)) return;
    if (!getBadgeTypeInputs(userBadgeForm).length) return;

    const userId = String(userIdField.value || "").trim();
    const badgeTypes = getSelectedBadgeTypes(userBadgeForm);
    const badgeType = getPrimaryBadgeType(badgeTypes);
    if (!userId) {
      setUserBadgeError("Не удалось определить пользователя.");
      return;
    }

    const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/badge`, {
      method: "PATCH",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({ badgeType, badgeTypes }),
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => ({}));
      const code = String(payload?.code || "").trim();
      if (code === "BADGE_STORAGE_UNAVAILABLE") {
        setUserBadgeError("Хранилище бейджей временно недоступно. Попробуйте позже.");
      } else if (code === "USER_NOT_FOUND") {
        setUserBadgeError("Пользователь не найден.");
      } else if (code === "MANAGER_FORBIDDEN") {
        setUserBadgeError("У вас нет доступа к этой операции.");
      } else {
        setUserBadgeError(`Не удалось обновить бейдж (HTTP ${r.status}).`);
      }
      return;
    }

    closeUserBadgeModal();
    await showAlert("Бейджи обновлены.");
    void loadUsers();
    closeAllRowMenus();
  });
  userCreateForm?.addEventListener("input", (event) => {
    if (!(userCreateForm instanceof HTMLFormElement)) return;
    const slug = userCreateForm.elements.namedItem("slug");
    const login = userCreateForm.elements.namedItem("login");
    const email = userCreateForm.elements.namedItem("email");
    if (event.target === slug && slug instanceof HTMLInputElement) {
      slug.value = normalizeUserCreateSlug(slug.value);
      if (userCreateState.slugDebounceTimer) clearTimeout(userCreateState.slugDebounceTimer);
      userCreateState.slugDebounceTimer = window.setTimeout(() => {
        void validateUserCreateSlugLive(slug);
      }, 320);
      return;
    }
    if (event.target === login && login instanceof HTMLInputElement) {
      login.value = normalizeUserCreateLogin(login.value);
      if (userCreateState.loginDebounceTimer) clearTimeout(userCreateState.loginDebounceTimer);
      userCreateState.loginDebounceTimer = window.setTimeout(() => {
        void validateUserCreateLoginLive(login);
      }, 320);
      return;
    }
    if (event.target === email && email instanceof HTMLInputElement) {
      email.value = normalizeUserCreateEmail(email.value);
      if (userCreateState.emailDebounceTimer) clearTimeout(userCreateState.emailDebounceTimer);
      userCreateState.emailDebounceTimer = window.setTimeout(() => {
        void validateUserCreateEmailLive(email);
      }, 350);
    }
  });
  userCreateForm?.addEventListener("focusout", (event) => {
    if (!(userCreateForm instanceof HTMLFormElement)) return;
    const slug = userCreateForm.elements.namedItem("slug");
    const login = userCreateForm.elements.namedItem("login");
    const email = userCreateForm.elements.namedItem("email");
    if (event.target === slug && slug instanceof HTMLInputElement) {
      void validateUserCreateSlugLive(slug);
      return;
    }
    if (event.target === login && login instanceof HTMLInputElement) {
      void validateUserCreateLoginLive(login);
      return;
    }
    if (event.target === email && email instanceof HTMLInputElement) {
      void validateUserCreateEmailLive(email);
    }
  });
  userCreateForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!(userCreateForm instanceof HTMLFormElement)) return;
    setUserCreateError("");
    const name = userCreateForm.elements.namedItem("name");
    const city = userCreateForm.elements.namedItem("city");
    const login = userCreateForm.elements.namedItem("login");
    const password = userCreateForm.elements.namedItem("password");
    const email = userCreateForm.elements.namedItem("email");
    const profileType = userCreateForm.elements.namedItem("profileType");
    const plan = userCreateForm.elements.namedItem("plan");
    const slug = userCreateForm.elements.namedItem("slug");
    if (
      !(name instanceof HTMLInputElement) ||
      !(city instanceof HTMLSelectElement) ||
      !(login instanceof HTMLInputElement) ||
      !(password instanceof HTMLInputElement) ||
      !(email instanceof HTMLInputElement) ||
      !(profileType instanceof HTMLSelectElement) ||
      !(plan instanceof HTMLSelectElement) ||
      !(slug instanceof HTMLInputElement) ||
      !getBadgeTypeInputs(userCreateForm).length
    ) {
      return;
    }

    const firstName = String(name.value || "").trim();
    const selectedCity = String(city.value || "").trim();
    const normalizedLogin = normalizeUserCreateLogin(login.value);
    const normalizedEmail = normalizeUserCreateEmail(email.value);
    const normalizedProfileType = normalizeUserCreateProfileType(profileType.value);
    const normalizedBadgeTypes = getSelectedBadgeTypes(userCreateForm);
    const normalizedBadgeType = getPrimaryBadgeType(normalizedBadgeTypes);
    const normalizedSlug = normalizeUserCreateSlug(slug.value);
    name.value = firstName;
    login.value = normalizedLogin;
    email.value = normalizedEmail;
    profileType.value = normalizedProfileType;
    setSelectedBadgeTypes(userCreateForm, normalizedBadgeTypes);
    slug.value = normalizedSlug;

    if (!firstName) {
      setCreateInputTone(name, "error");
      setUserCreateError("Введите имя пользователя.");
      return;
    }
    setCreateInputTone(name, "neutral");
    if (!selectedCity) {
      setCreateInputTone(city, "error");
      setUserCreateError("Выберите город пользователя.");
      return;
    }
    setCreateInputTone(city, "neutral");
    if (!normalizedLogin) {
      setCreateInputTone(login, "error");
      setUserCreateError("Введите логин.");
      return;
    }
    if (normalizedLogin.length < 3 || !USER_CREATE_LOGIN_REGEX.test(normalizedLogin)) {
      setCreateInputTone(login, "error");
      setUserCreateError("Логин должен быть не короче 3 символов и содержать только a-z, 0-9, . _ @ + -");
      return;
    }
    if (!password.value || String(password.value).length < 8) {
      setCreateInputTone(password, "error");
      setUserCreateError("Пароль должен содержать минимум 8 символов.");
      return;
    }
    setCreateInputTone(password, "neutral");
    if (normalizedEmail && !USER_CREATE_EMAIL_REGEX.test(normalizedEmail)) {
      setCreateInputTone(email, "error");
      setUserCreateError("Введите email в формате name@example.com");
      return;
    }

    const selectedPlan = plan.value === "premium" ? "premium" : "none";
    const hasSlugInput = Boolean(normalizedSlug);
    const requiresInlineActivation = isManager || selectedPlan !== "none" || hasSlugInput;
    if (requiresInlineActivation && selectedPlan === "none") {
      setCreateInputTone(plan, "error");
      setUserCreateError("Для мгновенной активации выберите тариф.");
      return;
    }
    setCreateInputTone(plan, "neutral");
    if (requiresInlineActivation && !isShortSlug(normalizedSlug)) {
      setCreateInputTone(slug, "error");
      setUserCreateError(`Slug должен быть в формате ${assignableSlugHint}.`);
      return;
    }

    const [loginCheckResult, emailCheckResult, slugCheckResult] = await Promise.all([
      validateUserCreateLoginLive(login),
      validateUserCreateEmailLive(email),
      requiresInlineActivation ? validateUserCreateSlugLive(slug) : Promise.resolve({ ok: true }),
    ]);

    if (loginCheckResult && loginCheckResult.ok === false) {
      setUserCreateError(userCreateLoginStatus instanceof HTMLElement ? userCreateLoginStatus.textContent || "Проверьте логин." : "Проверьте логин.");
      return;
    }
    if (emailCheckResult && emailCheckResult.ok === false) {
      setUserCreateError(userCreateEmailStatus instanceof HTMLElement ? userCreateEmailStatus.textContent || "Проверьте email." : "Проверьте email.");
      return;
    }
    if (slugCheckResult && slugCheckResult.ok === false) {
      setUserCreateError(userCreateSlugStatus instanceof HTMLElement ? userCreateSlugStatus.textContent || "Проверьте slug." : "Проверьте slug.");
      return;
    }

    const payload = {
      firstName,
      city: selectedCity,
      login: normalizedLogin,
      password: password.value || "",
      email: normalizedEmail,
      profileType: normalizedProfileType,
      badgeType: normalizedBadgeType,
      badgeTypes: normalizedBadgeTypes,
      plan: selectedPlan,
      slug: normalizedSlug,
    };
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const errorPayload = await r.json().catch(() => ({}));
        setUserCreateError(mapUserCreateSubmitError(errorPayload, r.status));
        return;
      }
      const createdPayload = await r.json().catch(() => ({}));
      userCreateForm.reset();
      setSelectedBadgeTypes(userCreateForm, []);
      resetUserCreateFieldTones();
      setCreateInlineStatus(userCreateLoginStatus, "");
      setCreateInlineStatus(userCreateSlugStatus, "");
      setCreateInlineStatus(userCreateSlugPrice, "");
      setCreateInlineStatus(userCreateEmailStatus, "Email не обязателен, но поможет восстановить доступ.");
      if (isManager) {
        const planField = userCreateForm.elements.namedItem("plan");
        if (planField instanceof HTMLSelectElement) {
          planField.value = "premium";
        }
      }
      closeUserCreate();
      if (isManager) {
        const createdUserId = String(createdPayload?.user?.id || "").trim();
        if (createdUserId) {
          const shouldOpenCard = await showConfirm("Пользователь создан. Открыть редактор визитки сейчас?");
          if (shouldOpenCard) {
            window.location.assign(`${userCardBasePath}/${encodeURIComponent(createdUserId)}/card`);
            return;
          }
        }
      }
      await showAlert("Пользователь создан.");
      const usersFiltersForm = document.getElementById("users-filters");
      if (usersFiltersForm instanceof HTMLFormElement) {
        setFormValue(usersFiltersForm, "page", "1");
        const createdLogin = String(createdPayload?.user?.login || "").trim();
        if (createdLogin) {
          setFormValue(usersFiltersForm, "q", createdLogin);
        }
      }
      void loadUsers();
    } catch (error) {
      setUserCreateError(error?.message || "Не удалось создать пользователя. Проверьте соединение и попробуйте снова.");
    }
  });
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
    next.textContent = "Вперёд";
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
    const allowedStatuses = new Set(["all", "pending", "approved", "rejected", "revoked"]);
    setFormValue(form, "status", allowedStatuses.has(statusFromUrl) ? statusFromUrl : "all");
    setFormValue(form, "page", /^\d+$/.test(pageFromUrl) ? pageFromUrl : "1");
  }

  function syncReportsFiltersFromLocation(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const params = new URLSearchParams(location.search);
    const statusFromUrl = String(params.get("r_status") || params.get("status") || "all").trim().toLowerCase();
    const pageFromUrl = String(params.get("r_page") || params.get("page") || "1").trim();
    const allowedStatuses = new Set(["all", "new", "processed"]);
    setFormValue(form, "status", allowedStatuses.has(statusFromUrl) ? statusFromUrl : "all");
    setFormValue(form, "page", /^\d+$/.test(pageFromUrl) ? pageFromUrl : "1");
  }

  function syncBadgesFiltersFromLocation(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const params = new URLSearchParams(location.search);
    const statusFromUrl = String(params.get("ba_status") || params.get("status") || "all").trim().toLowerCase();
    const badgeTypeFromUrl = String(params.get("ba_type") || params.get("badgeType") || "all").trim().toLowerCase();
    const pageFromUrl = String(params.get("ba_page") || params.get("page") || "1").trim();
    const allowedStatuses = new Set(["all", "pending", "approved", "rejected", "revoked"]);
    const allowedTypes = new Set(["all", "government", "unqx_staff"]);
    setFormValue(form, "status", allowedStatuses.has(statusFromUrl) ? statusFromUrl : "all");
    setFormValue(form, "badgeType", allowedTypes.has(badgeTypeFromUrl) ? badgeTypeFromUrl : "all");
    setFormValue(form, "page", /^\d+$/.test(pageFromUrl) ? pageFromUrl : "1");
  }

  function syncPetFiltersFromLocation(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const params = new URLSearchParams(location.search);
    const statusFromUrl = String(params.get("pet_status") || params.get("status") || "all").trim().toLowerCase();
    const petTypeFromUrl = String(params.get("pet_type") || params.get("petType") || "all").trim().toLowerCase();
    const pageFromUrl = String(params.get("pet_page") || params.get("page") || "1").trim();
    const allowedStatuses = new Set(["all", "pending", "approved", "rejected"]);
    const allowedTypes = new Set(["all", "kitten", "puppy", "snake"]);
    setFormValue(form, "status", allowedStatuses.has(statusFromUrl) ? statusFromUrl : "all");
    setFormValue(form, "petType", allowedTypes.has(petTypeFromUrl) ? petTypeFromUrl : "all");
    setFormValue(form, "page", /^\d+$/.test(pageFromUrl) ? pageFromUrl : "1");
  }

  async function loadMaintenanceBanner() {
    if (isManager) return;
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
        ? `Режим обслуживания включён - сайт недоступен для пользователей${message ? `. ${message}` : ""}`
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

  const analyticsCharts = {
    orders: null,
    tariff: null,
    score: null,
  };

  function destroyAnalyticsCharts() {
    Object.keys(analyticsCharts).forEach((key) => {
      if (analyticsCharts[key] && typeof analyticsCharts[key].destroy === "function") {
        analyticsCharts[key].destroy();
      }
      analyticsCharts[key] = null;
    });
  }

  function renderAnalyticsEmptyState(node, iconName, title, hint) {
    if (!(node instanceof HTMLElement)) return;
    node.innerHTML = `<div class="inline-flex flex-col items-center gap-2">${I(iconName, 42)}<span>${X(title)}</span><span class="text-xs text-neutral-400">${X(hint)}</span></div>`;
  }

  async function loadAnalytics() {
    const kpi = document.getElementById("analytics-kpis");
    const table = document.getElementById("analytics-checker-table");
    const filtersForm = document.getElementById("analytics-filters");
    const ordersCanvas = document.getElementById("analytics-orders-chart");
    const tariffCanvas = document.getElementById("analytics-tariff-chart");
    const scoreCanvas = document.getElementById("analytics-score-distribution-chart");
    const ordersEmpty = document.getElementById("analytics-orders-empty");
    const tariffEmpty = document.getElementById("analytics-tariff-empty");
    const scoreEmpty = document.getElementById("analytics-score-empty");
    if (!(kpi instanceof HTMLElement) || !(table instanceof HTMLElement)) return;
    const q = {
      dateFrom: filtersForm instanceof HTMLFormElement ? getFormValue(filtersForm, "dateFrom", "") : "",
      dateTo: filtersForm instanceof HTMLFormElement ? getFormValue(filtersForm, "dateTo", "") : "",
      groupBy: filtersForm instanceof HTMLFormElement ? getFormValue(filtersForm, "groupBy", "day") : "day",
    };
    setDashboardQuery({
      a_date_from: q.dateFrom,
      a_date_to: q.dateTo,
      a_group_by: q.groupBy,
    });
    const r = await fetch(`/api/admin/analytics?${Q(q)}`);
    if (!r.ok) return;
    const p = await r.json();
    const s = p.kpis || {};
    const meta = p.meta || {};
    const breakdown = s.breakdown || {};
    const breakdownLines = [
      `Slug: ${P(breakdown.slug || 0)}`,
      `Legacy basic: ${P(breakdown.basicPlan || 0)}`,
      `Премиум: ${P(breakdown.premiumPlan || 0)}`,
    ];
    const periodLabel = meta.dateFrom && meta.dateTo ? `${meta.dateFrom} - ${meta.dateTo}` : "выбранный период";
    const analyticsCards = [
      { n: `Новых заявок (${periodLabel})`, v: s.newOrdersToday || 0, i: "userCheck" },
      { n: `Выручка (${periodLabel})`, v: P(s.revenueToday || 0), i: "creditCard" },
      { n: "Выручка за период", v: P(s.revenue30Days || 0), i: "calendar" },
      { n: "Выручка всего", v: P(s.revenueTotal || 0), i: "link2" },
      { n: "Средний UNQ Score", v: Number(s.averageUnqScore || 0).toLocaleString("ru-RU"), i: "chart" },
      {
        n: "Разбивка",
        lines: breakdownLines,
        i: "package",
      },
    ];
    const visitorsDateLabel = String(s.todayVisitorsDate || "").trim();
    const visitorsCard = `
      <article class="admin-kpi-card">
        <div class="admin-kpi-icon">${I("eye", 20)}</div>
        <p class="admin-kpi-value">${Number(s.todayVisitorsTotal || 0).toLocaleString("ru-RU")}</p>
        <p class="admin-kpi-label">Посетители сегодня</p>
        <p class="mt-2 text-sm text-neutral-600">Факт: ${Number(s.todayVisitorsRaw || 0).toLocaleString("ru-RU")} · вручную: +${Number(s.todayVisitorsManual || 0).toLocaleString("ru-RU")}</p>
        <p class="mt-1 text-xs text-neutral-400">${X(visitorsDateLabel ? `${visitorsDateLabel} UTC` : "Текущие UTC-сутки")}</p>
        <form id="analytics-visitors-adjust-form" class="mt-auto flex items-end gap-2 pt-4">
          <label class="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            <span class="mb-1 block">Добавить</span>
            <input id="analytics-visitors-adjust-amount" name="analytics-visitors-adjust-amount" type="number" min="1" step="1" value="1" class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900" />
          </label>
          <button type="submit" class="interactive-btn min-h-11 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100">Увеличить</button>
        </form>
      </article>`;
    kpi.innerHTML = analyticsCards
      .map((x) => {
        const valueMarkup = Array.isArray(x.lines)
          ? `<ul class="admin-kpi-list">${x.lines.map((line) => `<li>${X(line)}</li>`).join("")}</ul>`
          : `<p class="admin-kpi-value">${X(x.v)}</p>`;
        return `<article class="admin-kpi-card"><div class="admin-kpi-icon">${I(x.i, 20)}</div>${valueMarkup}<p class="admin-kpi-label">${x.n}</p></article>`;
      })
      .join("") + visitorsCard;
    const visitorsAdjustForm = document.getElementById("analytics-visitors-adjust-form");
    if (visitorsAdjustForm instanceof HTMLFormElement) {
      visitorsAdjustForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const amountField = visitorsAdjustForm.elements.namedItem("analytics-visitors-adjust-amount");
        const submitButton = visitorsAdjustForm.querySelector('button[type="submit"]');
        if (!(amountField instanceof HTMLInputElement) || !(submitButton instanceof HTMLButtonElement)) return;

        const amount = Number(amountField.value || 0);
        if (!Number.isInteger(amount) || amount < 1) {
          await showAlert("Укажите целое число больше нуля.");
          amountField.focus();
          return;
        }

        amountField.disabled = true;
        submitButton.disabled = true;
        try {
          const response = await fetch("/api/admin/analytics/today-visitors/increment", {
            method: "POST",
            headers: H({ "Content-Type": "application/json" }),
            body: JSON.stringify({ amount }),
          });
          if (!response.ok) {
            await showAlert(await E(response));
            return;
          }
          amountField.value = "1";
          await loadAnalytics();
        } finally {
          amountField.disabled = false;
          submitButton.disabled = false;
        }
      });
    }
    const top = p.topUnboughtPatterns || [];
    table.innerHTML = top.length
      ? top.map((x) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2 font-mono">${X(x.pattern)}</td><td class="px-3 py-2 font-semibold">${x.count}</td></tr>`).join("")
      : `<tr><td colspan="2" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("link2", 42)}<span>Нет данных</span><span class="text-xs text-neutral-400">В выбранном периоде нет проверок.</span></div></td></tr>`;

    const d = Array.isArray(p.revenueDaily) ? p.revenueDaily : [];
    const dScore = Array.isArray(p.scoreDistribution) ? p.scoreDistribution : [];
    const hasRevenueTrend = d.some((x) => Number(x.amount || 0) > 0);
    const hasRevenueBreakdown =
      Number(breakdown.slug || 0) > 0 ||
      Number(breakdown.basicPlan || 0) > 0 ||
      Number(breakdown.premiumPlan || 0) > 0 ||
      false;
    const hasScoreDistribution = dScore.some((x) => Number(x.count || 0) > 0);

    renderAnalyticsEmptyState(ordersEmpty, "calendar", "Нет данных", "За выбранный период нет выручки.");
    renderAnalyticsEmptyState(tariffEmpty, "package", "Нет данных", "Нет данных для разбивки выручки.");
    renderAnalyticsEmptyState(scoreEmpty, "userCheck", "Нет данных", "Нет данных для распределения score.");
    if (ordersCanvas instanceof HTMLCanvasElement) {
      ordersCanvas.classList.toggle("hidden", !hasRevenueTrend);
    }
    if (tariffCanvas instanceof HTMLCanvasElement) {
      tariffCanvas.classList.toggle("hidden", !hasRevenueBreakdown);
    }
    if (scoreCanvas instanceof HTMLCanvasElement) {
      scoreCanvas.classList.toggle("hidden", !hasScoreDistribution);
    }
    if (ordersEmpty instanceof HTMLElement) {
      ordersEmpty.classList.toggle("hidden", hasRevenueTrend);
      ordersEmpty.classList.toggle("flex", !hasRevenueTrend);
    }
    if (tariffEmpty instanceof HTMLElement) {
      tariffEmpty.classList.toggle("hidden", hasRevenueBreakdown);
      tariffEmpty.classList.toggle("flex", !hasRevenueBreakdown);
    }
    if (scoreEmpty instanceof HTMLElement) {
      scoreEmpty.classList.toggle("hidden", hasScoreDistribution);
      scoreEmpty.classList.toggle("flex", !hasScoreDistribution);
    }

    destroyAnalyticsCharts();
    if (typeof Chart !== "undefined") {
      if (hasRevenueTrend && ordersCanvas instanceof HTMLCanvasElement) {
        analyticsCharts.orders = new Chart(ordersCanvas, {
          type: "line",
          data: { labels: d.map((x) => x.date), datasets: [{ label: "Выручка", data: d.map((x) => x.amount), borderColor: "#111827", tension: 0.25 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { title: { display: true, text: "Дата" } },
              y: { title: { display: true, text: "Сумма (сум)" } },
            },
          },
        });
      }
      if (hasRevenueBreakdown && tariffCanvas instanceof HTMLCanvasElement) {
        analyticsCharts.tariff = new Chart(tariffCanvas, {
          type: "pie",
          data: {
            labels: ["Slug", "Legacy basic", "Премиум тариф"],
            datasets: [
              {
                data: [
                  breakdown.slug || 0,
                  breakdown.basicPlan || 0,
                  breakdown.premiumPlan || 0,
                ],
                backgroundColor: ["#111827", "#374151", "#6b7280"],
              },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }
      if (hasScoreDistribution && scoreCanvas instanceof HTMLCanvasElement) {
        analyticsCharts.score = new Chart(scoreCanvas, {
          type: "bar",
          data: {
            labels: dScore.map((x) => x.range),
            datasets: [{ data: dScore.map((x) => x.count), backgroundColor: "#111827" }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { title: { display: true, text: "Диапазон score" } },
              y: { title: { display: true, text: "Количество пользователей" } },
            },
          },
        });
      }
    }
  }

  const analyticsFiltersForm = document.getElementById("analytics-filters");
  if (analyticsFiltersForm instanceof HTMLFormElement) {
    setFormValue(analyticsFiltersForm, "dateFrom", getInitial("a_date_from", "dateFrom"));
    setFormValue(analyticsFiltersForm, "dateTo", getInitial("a_date_to", "dateTo"));
    setFormValue(analyticsFiltersForm, "groupBy", getInitial("a_group_by", "groupBy") || "day");

    analyticsFiltersForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await loadAnalytics();
    });

    analyticsFiltersForm.addEventListener("reset", async () => {
      setTimeout(async () => {
        setFormValue(analyticsFiltersForm, "groupBy", "day");
        await loadAnalytics();
      }, 0);
    });
  }

  async function loadOrders() {
    const form = document.getElementById("orders-filters");
    const table = document.getElementById("orders-table");
    const csv = document.getElementById("orders-export-link");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement) || !(csv instanceof HTMLAnchorElement)) return;

    const q = {
      q: getFormValue(form, "q", ""),
      status: getFormValue(form, "status", "all"),
      tariff: getFormValue(form, "tariff", "all"),
      dateFrom: getFormValue(form, "dateFrom", ""),
      dateTo: getFormValue(form, "dateTo", ""),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({
      o_q: q.q,
      o_status: q.status,
      o_tariff: q.tariff,
      o_date_from: q.dateFrom,
      o_date_to: q.dateTo,
      o_page: q.page,
    });
    const filterQs = Q({ q: q.q, status: q.status, tariff: q.tariff, dateFrom: q.dateFrom, dateTo: q.dateTo });
    csv.href = `/api/admin/orders/export.csv${filterQs ? `?${filterQs}` : ""}`;
    const r = await fetch(`/api/admin/orders?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows
        .map((x) => {
          const username = x.username || "";
          const profileHref = x.slug ? `/${encodeURIComponent(x.slug)}` : "";
          const countdown = x.slugState === "pending" ? formatPendingCountdown(x.pendingExpiresAt) : "";
          const remainingMs = x.pendingExpiresAt ? new Date(x.pendingExpiresAt).getTime() - Date.now() : 0;
          const countdownTone =
            remainingMs <= 30 * 60 * 1000 ? "text-red-700 font-semibold" : remainingMs <= 2 * 60 * 60 * 1000 ? "text-red-700" : "text-neutral-500";
          const statusBlock = `${statusChip(x.status)}${countdown ? `<div class="mt-1 inline-flex items-center gap-1 text-[11px] ${countdownTone}">${I("clock", 14)}<span>${X(countdown)}</span></div>` : ""}`;
          const menu = menuWrap([
            menuItem({ label: "Одобрить", icon: "checkCircle", attrs: `data-act="os" data-id="${x.id}" data-status="approved" data-note="${X(x.adminNote || "")}"` }),
            menuItem({ label: "Отклонить", icon: "xCircle", attrs: `data-act="os" data-id="${x.id}" data-status="rejected" data-note="${X(x.adminNote || "")}"`, danger: true }),
            menuSeparator(),
            menuItem({ label: "Отметить: Связались", icon: "message", attrs: `data-act="os" data-id="${x.id}" data-status="contacted" data-note="${X(x.adminNote || "")}"` }),
            menuItem({ label: "Отметить: Оплачена", icon: "creditCard", attrs: `data-act="os" data-id="${x.id}" data-status="paid" data-note="${X(x.adminNote || "")}"` }),
            menuSeparator(),
            menuItem({ label: "Открыть профиль", icon: "external", attrs: profileHref ? `data-act="open-url" data-url="${profileHref}"` : 'disabled="disabled"' }),
            menuItem({ label: "Написать в Telegram", icon: "send", attrs: username ? `data-act="open-url" data-url="https://t.me/${encodeURIComponent(username)}"` : 'disabled="disabled"' }),
            x.slugState === "pending" && x.status !== "expired" ? menuItem({ label: "Добавить 24 часа", icon: "clock", attrs: `data-act="ope" data-id="${x.id}"` }) : "",
            ...(!isManager
              ? [
                menuSeparator(),
                menuItem({ label: "Удалить", icon: "trash", attrs: `data-act="od" data-id="${x.id}"`, danger: true }),
              ]
              : []),
          ].join(""));
          return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3 text-right">${P(x.slugPrice)}</td><td class="px-4 py-3 text-right font-semibold">${P(x.amount || 0)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Legacy"}</td><td class="px-4 py-3">${X(x.contact)}</td><td class="px-4 py-3">${statusBlock}</td><td class="px-4 py-3 text-right"><div class="admin-row-actions justify-end">${menu}</div></td></tr>`;
        })
        .join("")
      : `<tr><td colspan="10" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>Нет заявок</span><span class="text-xs text-neutral-400">Измените фильтры или сбросьте поиск.</span></div></td></tr>`;
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
      table.innerHTML = `<tr><td colspan="6" class="px-3 py-8 text-center text-red-700">Не удалось загрузить покупки</td></tr>`;
      return;
    }
    const payload = await r.json();
    totalNode.textContent = `Общая выручка: ${P(payload.totalRevenue || 0)}`;

    const typeLabel = (type) => {
      if (type === "slug") return "Slug";
      if (type === "premium_subscription_monthly") return "Premium monthly";
      if (type === "basic_plan") return "Базовый тариф (legacy)";
      if (type === "premium_plan") return "Премиум тариф (legacy)";
      if (type === "upgrade_to_premium") return "Апгрейд до Премиум (legacy)";
      return type;
    };
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => {
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${D(x.purchasedAt)}</td><td class="px-4 py-3">${X(x.username ? `@${x.username}` : x.userName)}</td><td class="px-4 py-3"><span class="inline-flex rounded-full border border-neutral-200 px-2 py-1 text-xs font-medium">${X(typeLabel(x.type))}</span></td><td class="px-4 py-3 font-mono">${X(x.slug || "-")}</td><td class="px-4 py-3 text-right font-semibold">${P(x.amount || 0)}</td><td class="px-4 py-3">${X(x.approvedByAdmin || "-")}</td></tr>`;
      }).join("")
      : `<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>Нет покупок</span><span class="text-xs text-neutral-400">Покупки появятся после оплаты заказов пользователями.</span></div></td></tr>`;

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
    setFormValue(form, "planPremiumMonthlyPriceUsd", String(Number(settings.planPremiumMonthlyPriceUsd || 2)));
    setFormValue(form, "planPremiumMonthlyPriceUzs", String(Number(settings.planPremiumMonthlyPriceUzs || settings.planPremiumPrice || 130000)));
    setFormValue(form, "pricingFootnote", String(settings.pricingFootnote || ""));
  }

  async function loadUsers() {
    const form = document.getElementById("users-filters");
    const table = document.getElementById("users-table");
    const managerStatsNode = document.getElementById("users-manager-created-stats");
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
      table.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-center text-red-700">Не удалось загрузить пользователей: ${X(msg)}</td></tr>`;
      if (managerStatsNode instanceof HTMLElement) {
        managerStatsNode.classList.add("hidden");
        managerStatsNode.textContent = "";
      }
      return;
    }
    const payload = await r.json();
    if (managerStatsNode instanceof HTMLElement) {
      if (isManager) {
        const trackingEnabled = payload?.managerStats?.trackingEnabled !== false;
        if (trackingEnabled) {
          const createdCount = Number(payload?.managerStats?.createdAccountsCount || 0);
          managerStatsNode.textContent = `Создано аккаунтов вами: ${createdCount.toLocaleString("ru-RU")}`;
        } else {
          managerStatsNode.textContent = "Статистика менеджера появится после применения миграции БД.";
        }
        managerStatsNode.classList.remove("hidden");
      } else {
        managerStatsNode.classList.add("hidden");
        managerStatsNode.textContent = "";
      }
    }
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows
        .map((x) => {
          const allSlugs = Array.isArray(x.slugs)
            ? x.slugs.map((s) => String(s.fullSlug || "").trim()).filter(Boolean)
            : [];
          const freeCode = String(x.freeProfileCode || "").trim();
          const allHandles = freeCode ? [...allSlugs, freeCode] : allSlugs;
          const slugText = allHandles.length
            ? allHandles.length > 2
              ? `${allHandles.slice(0, 2).join(", ")} +${allHandles.length - 2}`
              : allHandles.join(", ")
            : "—";
          const slugTitle = allHandles.length ? allHandles.join(", ") : "";
          const primarySlug =
            Array.isArray(x.slugs) && x.slugs.length
              ? x.slugs.find((s) => ["active", "private", "paused", "approved"].includes(s.status))?.fullSlug || x.slugs[0].fullSlug
              : null;
          const contactUsername = String(x.username || x.telegramUsername || "").replace(/^@+/, "");
          const profileLink = primarySlug
            ? `/${encodeURIComponent(primarySlug)}`
            : freeCode
              ? `/${encodeURIComponent(freeCode)}`
              : contactUsername
                ? `https://t.me/${encodeURIComponent(contactUsername)}`
                : null;
          const badgeTypes = normalizeBadgeTypesInput(Array.isArray(x.badgeTypes) ? x.badgeTypes : x.badgeType || "");
          const primaryBadgeType = getPrimaryBadgeType(badgeTypes);
          const badgeTypesCsv = badgeTypes.join(",");
          const userSlugsCsv = allSlugs.join(",");
          const userCell = X(x.name);
          const emailCell = x.email
            ? `<span class="block break-all text-xs text-neutral-700">${X(x.email)}</span>`
            : "—";
          const editSlugAttrs = allSlugs.length
            ? `data-act="us-edit" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"`
            : 'disabled="disabled"';
          const menuItems = [];
          if (!isManager) {
            menuItems.push(menuItem({ label: "Change login", icon: "at", attrs: `data-act="ul" data-id="${X(x.telegramId)}" data-login="${X(x.login || "")}" data-name="${X(x.name)}"` }));
            menuItems.push(menuItem({ label: "Change password", icon: "lock", attrs: `data-act="upwd" data-id="${X(x.telegramId)}" data-name="${X(x.name)}"` }));
            menuItems.push(menuItem({ label: "Change plan", icon: "crown", attrs: `data-act="up" data-id="${X(x.telegramId)}" data-current-plan="${X(x.plan)}" data-active-slugs="${Number(x.activeSlugCount || 0)}"` }));
            menuItems.push(menuSeparator());
          }
          menuItems.push(menuItem({ label: "Add slug", icon: "link2", attrs: `data-act="us-add" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"` }));
          menuItems.push(menuItem({ label: "Edit slug", icon: "linkEdit", attrs: editSlugAttrs }));
          menuItems.push(menuItem({ label: "Delete slug", icon: "trash", attrs: `data-act="us-delete" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"`, danger: true }));
          menuItems.push(menuSeparator());

          const verificationLabel = x.isVerified ? "Верификация: активна" : "Верифицировать";
          menuItems.push(
            menuItem({
              label: verificationLabel,
              icon: "checkCircle",
              attrs: `data-act="uvm" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-verified="${x.isVerified ? "1" : "0"}" data-company="${X(x.verifiedCompany || "")}" data-role="${X(x.verifiedRole || "")}" data-badge-type="${X(primaryBadgeType)}" data-badge-types="${X(badgeTypesCsv)}"`,
            }),
          );
          menuItems.push(
            menuItem({
              label: "Изменить бейдж",
              icon: "badge",
              attrs: `data-act="ubadge" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-badge-type="${X(primaryBadgeType)}" data-badge-types="${X(badgeTypesCsv)}"`,
            }),
          );

          const cardEditorUrl = `${userCardBasePath}/${encodeURIComponent(String(x.telegramId || ""))}/card`;
          const cardEditorLabel = x.hasCard ? "Редактировать визитку" : "Создать визитку";
          menuItems.push(menuItem({ label: cardEditorLabel, icon: "idCard", attrs: `data-act="open-card" data-url="${cardEditorUrl}"` }));
          menuItems.push(menuItem({ label: "Payment карточки", icon: "creditCard", attrs: `data-act="open-card" data-url="${dashboardBasePath}?tab=payment-cards&userId=${encodeURIComponent(String(x.telegramId || ""))}"` }));
          menuItems.push(menuItem({ label: "Open profile", icon: "external", attrs: profileLink ? `data-act="open-url" data-url="${profileLink}"` : 'disabled="disabled"' }));

          if (!isManager) {
            menuItems.push(menuItem({ label: "Boost views", icon: "eye", attrs: `data-act="uvb" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"` }));
            menuItems.push(menuItem({ label: "Reduce views", icon: "xCircle", attrs: `data-act="uvd" data-id="${X(x.telegramId)}" data-name="${X(x.name)}" data-slugs="${X(userSlugsCsv)}"`, danger: true }));
            menuItems.push(menuSeparator());
            menuItems.push(menuItem({ label: x.status === "blocked" ? "Unblock" : "Block", icon: "shieldOff", attrs: `data-act="ub" data-id="${X(x.telegramId)}" data-status="${X(x.status)}"`, danger: x.status !== "blocked" }));
            menuItems.push(menuItem({ label: "Delete user permanently", icon: "trash", attrs: `data-act="ud" data-id="${X(x.telegramId)}" data-name="${X(x.name)}"`, danger: true }));
          }

          const menu = menuWrap(menuItems.join(""));
          const isPremium = x.plan === "premium" || x.plan === "basic";
          const planChipHtml = isPremium
            ? `<span class="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 whitespace-nowrap">Премиум</span>`
            : `<span class="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 whitespace-nowrap">Бесплатный</span>`;
          const rowProfileUrl = profileLink ? X(profileLink) : "";
          return `<tr class="admin-table-row border-t border-neutral-100 cursor-pointer hover:bg-neutral-50" data-user-profile-url="${rowProfileUrl}"><td class="px-4 py-3">${userCell}</td><td class="px-4 py-3">${emailCell}</td><td class="px-4 py-3">${planChipHtml}</td><td class="admin-col-slugs px-4 py-3 text-xs" title="${X(slugTitle)}">${X(slugText)}</td><td class="px-4 py-3">${statusChip(x.status === "blocked" ? "rejected" : "approved")}</td><td class="px-4 py-3">${DATE_ONLY(x.createdAt)}</td><td class="px-4 py-3 text-center" onclick="event.stopPropagation()"><div class="admin-row-actions justify-center">${menu}</div></td></tr>`;
        })
        .join("")
      : `<tr><td colspan="7" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("userCheck", 48)}<span>No users found</span></div></td></tr>`;
    renderPager("users-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadUsers();
    });
  }

  async function loadAccounts() {
    const form = document.getElementById("accounts-filters");
    const table = document.getElementById("accounts-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = {
      q: getFormValue(form, "q", ""),
      plan: getFormValue(form, "plan", "all"),
      page: getFormValue(form, "page", "1"),
    };
    table.innerHTML = `<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-400">Загрузка...</td></tr>`;
    const r = await fetch(`/api/admin/accounts?${Q(q)}`);
    if (!r.ok) {
      const msg = await E(r);
      table.innerHTML = `<tr><td colspan="4" class="px-3 py-8 text-center text-red-700">Ошибка: ${X(msg)}</td></tr>`;
      return;
    }
    const payload = await r.json();
    const rows = payload.items || [];
    const slugLink = (slug) => slug
      ? `<a href="${base}/${X(slug)}" target="_blank" rel="noopener noreferrer" class="font-mono font-semibold text-neutral-900 hover:underline">${X(slug)}</a>`
      : `<span class="text-neutral-400">—</span>`;
    table.innerHTML = rows.length
      ? rows.map((x) => `<tr class="border-t border-neutral-100 hover:bg-neutral-50">
          <td class="px-4 py-3 font-medium text-neutral-900">${X(x.firstName)}</td>
          <td class="px-4 py-3 text-xs text-neutral-600">${x.login ? `@${X(x.login)}` : "—"}</td>
          <td class="px-4 py-3 text-xs">${slugLink(x.slug)}</td>
          <td class="px-4 py-3 text-xs">${slugLink(x.freeSlug)}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" class="px-3 py-10 text-center text-neutral-500">Аккаунты не найдены</td></tr>`;
    renderPager("accounts-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadAccounts();
    });
  }

  const paymentCardsState = {
    items: [],
    selected: null,
    editing: null,
    methods: [],
    panel: "profiles",
  };

  function setPaymentPanel(panel) {
    const allowed = new Set(["profiles", "pages", "editor", "preview"]);
    const nextPanel = allowed.has(panel) ? panel : "profiles";
    paymentCardsState.panel = nextPanel;
    document.querySelectorAll("[data-payment-panel]").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.classList.toggle("hidden", node.getAttribute("data-payment-panel") !== nextPanel);
    });
    document.querySelectorAll("[data-payment-panel-tab]").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const active = node.getAttribute("data-payment-panel-tab") === nextPanel;
      node.classList.toggle("bg-neutral-900", active);
      node.classList.toggle("text-white", active);
      node.classList.toggle("shadow-sm", active);
      node.classList.toggle("text-neutral-600", !active);
    });
  }

  function getEditingPaymentCard() {
    const editingId = paymentCardsState.editing?.id || "";
    if (editingId) {
      return paymentCardsState.items.find((item) => String(item.id) === String(editingId)) || paymentCardsState.editing;
    }
    return paymentCardsState.editing || null;
  }

  function normalizePaymentSlug(value) {
    return String(value || "")
      .trim()
      .replace(/^\/+payment\/+/i, "")
      .replace(/^\/+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function paymentMethodRow(method, index) {
    const type = String(method?.type || "other");
    return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3" data-payment-method-index="${index}">
      <div class="grid gap-2 sm:grid-cols-[130px_1fr]">
        <select data-payment-method-field="type" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
          <option value="card" ${type === "card" ? "selected" : ""}>Карта</option>
          <option value="bank" ${type === "bank" ? "selected" : ""}>Банк</option>
          <option value="payme" ${type === "payme" ? "selected" : ""}>Payme</option>
          <option value="click" ${type === "click" ? "selected" : ""}>Click</option>
          <option value="cash" ${type === "cash" ? "selected" : ""}>Наличные</option>
          <option value="other" ${type === "other" ? "selected" : ""}>Другое</option>
        </select>
        <input data-payment-method-field="label" value="${X(method?.label || "")}" placeholder="Название реквизита"
          class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      </div>
      <input data-payment-method-field="value" value="${X(method?.value || "")}" placeholder="Номер карты, счёт, телефон или инструкция"
        class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input data-payment-method-field="note" value="${X(method?.note || "")}" placeholder="Комментарий"
          class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
        <button type="button" data-payment-method-remove="${index}"
          class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50">Удалить</button>
      </div>
    </div>`;
  }

  function renderPaymentMethods() {
    const list = document.getElementById("payment-card-methods-list");
    if (!(list instanceof HTMLElement)) return;
    list.innerHTML = paymentCardsState.methods.length
      ? paymentCardsState.methods.map(paymentMethodRow).join("")
      : `<div class="rounded-xl border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">Добавьте реквизиты для этой точки.</div>`;
  }

  function setPaymentEditorStatus(message, tone = "muted") {
    const node = document.getElementById("payment-card-editor-status");
    if (!(node instanceof HTMLElement)) return;
    node.textContent = String(message || "");
    node.className = tone === "error" ? "text-xs text-red-700" : tone === "success" ? "text-xs text-emerald-700" : "text-xs text-neutral-500";
  }

  function renderPaymentPagePreview(card = getEditingPaymentCard()) {
    const box = document.getElementById("payment-page-preview");
    const empty = document.getElementById("payment-page-preview-empty");
    if (!(box instanceof HTMLElement) || !(empty instanceof HTMLElement)) return;
    if (!card) {
      box.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    box.classList.remove("hidden");
    const title = document.getElementById("payment-page-preview-title");
    const url = document.getElementById("payment-page-preview-url");
    const status = document.getElementById("payment-page-preview-status");
    const address = document.getElementById("payment-page-preview-address");
    const methods = document.getElementById("payment-page-preview-methods");
    if (title instanceof HTMLElement) title.textContent = card.title || "Payment card";
    if (url instanceof HTMLElement) url.textContent = card.publicSlug ? `/payment/${card.publicSlug}` : "/payment/...";
    if (status instanceof HTMLElement) {
      const published = card.isPublished !== false;
      status.textContent = published ? "Опубликована" : "Черновик";
      status.className = published
        ? "inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
        : "inline-flex w-fit rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600";
    }
    if (address instanceof HTMLElement) {
      const place = [card.address || "", card.postcode || ""].filter(Boolean).join(", ");
      address.textContent = place || "Адрес точки не указан";
    }
    if (methods instanceof HTMLElement) {
      const rows = Array.isArray(card.methods) ? card.methods : [];
      methods.innerHTML = rows.length
        ? rows.map((method) => {
          const label = method?.label || method?.type || "Реквизит";
          const value = method?.value || method?.requisite || "";
          const note = method?.note || "";
          return `<div class="rounded-lg border border-neutral-200 bg-white p-3">
            <div class="text-sm font-semibold text-neutral-900">${X(label)}</div>
            <div class="mt-1 break-words font-mono text-sm text-neutral-700">${X(value || "Не заполнено")}</div>
            ${note ? `<div class="mt-1 text-xs text-neutral-500">${X(note)}</div>` : ""}
          </div>`;
        }).join("")
        : `<div class="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">Реквизиты еще не добавлены</div>`;
    }
  }

  function renderPaymentPreview(selected) {
    const preview = selected?.profile || selected?.paymentCard?.profile || {};
    const user = selected?.user || selected?.paymentCard?.user || {};
    const avatar = document.getElementById("payment-cards-preview-avatar");
    const avatarEmpty = document.getElementById("payment-cards-preview-avatar-empty");
    const name = document.getElementById("payment-cards-preview-name");
    const role = document.getElementById("payment-cards-preview-role");
    const meta = document.getElementById("payment-cards-preview-meta");
    const tags = document.getElementById("payment-cards-preview-tags");
    const avatarUrl = String(preview.avatarUrl || "");
    if (avatar instanceof HTMLImageElement && avatarEmpty instanceof HTMLElement) {
      avatar.src = avatarUrl;
      avatar.classList.toggle("hidden", !avatarUrl);
      avatarEmpty.classList.toggle("hidden", Boolean(avatarUrl));
    }
    if (name instanceof HTMLElement) name.textContent = preview.name || user.name || "Выберите профиль";
    if (role instanceof HTMLElement) role.textContent = preview.role || "";
    if (meta instanceof HTMLElement) {
      const contact = [preview.email || user.email || "", preview.extraPhone || "", user.city || ""].filter(Boolean).join(" · ");
      meta.textContent = contact || (preview.hasCard ? "Данные основной визитки" : "У пользователя пока нет основной визитки");
    }
    if (tags instanceof HTMLElement) {
      const values = Array.isArray(preview.tags) ? preview.tags : [];
      tags.innerHTML = values.slice(0, 6).map((tag) => `<span class="rounded-full border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600">${X(tag)}</span>`).join("");
    }
  }

  function renderPaymentSelected(selected) {
    const box = document.getElementById("payment-cards-selected-user");
    if (!(box instanceof HTMLElement)) return;
    if (!selected?.user) {
      box.classList.add("hidden");
      box.textContent = "";
      renderPaymentPreview(null);
      return;
    }
    const profile = selected.profile || {};
    box.innerHTML = `<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div class="min-w-0"><span class="font-semibold text-neutral-900">${X(profile.name || selected.user.name || "UNQX User")}</span>
      <span class="text-neutral-500"> · ID ${X(selected.user.id || "")}</span>
      <div class="mt-1 text-xs text-neutral-500">${profile.hasCard ? "Основная визитка найдена" : "Основная визитка не создана"}</div></div>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-payment-panel-goto="pages" class="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">Страницы</button>
        <button type="button" data-act="pc-create-selected" class="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Новая страница</button>
      </div>
    </div>`;
    box.classList.remove("hidden");
    renderPaymentPreview(selected);
  }

  function renderPaymentUserResults(items) {
    const box = document.getElementById("payment-user-search-results");
    if (!(box instanceof HTMLElement)) return;
    const rows = Array.isArray(items) ? items : [];
    box.innerHTML = rows.length
      ? rows.map((user) => {
        const name = user.name || user.login || user.telegramUsername || "UNQX User";
        const meta = [user.login ? `@${user.login}` : user.telegramUsername ? `@${user.telegramUsername}` : "", user.city || "", user.hasCard ? "визитка есть" : "без визитки"].filter(Boolean).join(" · ");
        return `<button type="button" data-act="pc-select-user" data-id="${X(user.telegramId || user.id || "")}"
          class="flex min-h-20 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-3 text-left text-sm transition hover:border-neutral-400 hover:bg-neutral-50">
          <span class="min-w-0"><span class="block truncate font-semibold text-neutral-900">${X(name)}</span><span class="block truncate text-xs text-neutral-500">${X(meta)}</span></span>
          <span class="shrink-0 text-xs font-semibold text-neutral-500">Выбрать</span>
        </button>`;
      }).join("")
      : `<div class="rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-center text-xs text-neutral-500 sm:col-span-2 xl:col-span-3">Профили не найдены</div>`;
  }

  async function searchPaymentUsers() {
    const input = document.getElementById("payment-user-search");
    const q = input instanceof HTMLInputElement ? input.value.trim() : "";
    const box = document.getElementById("payment-user-search-results");
    if (box instanceof HTMLElement) {
      box.innerHTML = `<div class="rounded-xl border border-neutral-200 px-3 py-3 text-center text-xs text-neutral-500">Загрузка...</div>`;
    }
    const r = await fetch(`/api/admin/users?${Q({ q, page: "1", pageSize: "8" })}`);
    if (!r.ok) {
      if (box instanceof HTMLElement) {
        box.innerHTML = `<div class="rounded-xl border border-red-200 px-3 py-3 text-center text-xs text-red-700">${X(await E(r))}</div>`;
      }
      return;
    }
    const payload = await r.json().catch(() => ({}));
    renderPaymentUserResults(payload.items || []);
  }

  function openPaymentEditor(card = null) {
    const form = document.getElementById("payment-card-editor");
    if (!(form instanceof HTMLFormElement)) return;
    const selectedUserId = paymentCardsState.selected?.user?.id || "";
    const target = card || {
      id: "",
      ownerId: selectedUserId,
      title: "",
      publicSlug: "",
      address: "",
      postcode: "",
      methods: [],
      isPublished: true,
    };
    paymentCardsState.editing = target;
    paymentCardsState.methods = Array.isArray(target.methods) ? target.methods.map((x) => ({ ...x })) : [];
    form.classList.remove("hidden");
    document.getElementById("payment-card-editor-empty")?.classList.add("hidden");
    setFormValue(form, "id", target.id || "");
    setFormValue(form, "ownerId", target.ownerId || selectedUserId);
    setFormValue(form, "title", target.title || "");
    setFormValue(form, "publicSlug", target.publicSlug || "");
    setFormValue(form, "address", target.address || "");
    setFormValue(form, "postcode", target.postcode || "");
    const published = form.elements.namedItem("isPublished");
    if (published instanceof HTMLInputElement) published.checked = target.isPublished !== false;
    const titleNode = document.getElementById("payment-card-editor-title");
    if (titleNode instanceof HTMLElement) titleNode.textContent = target.id ? "Редактировать Payment" : "Новая Payment страница";
    document.getElementById("payment-card-delete")?.classList.toggle("hidden", !target.id);
    const publicLink = document.getElementById("payment-cards-open-public");
    if (publicLink instanceof HTMLAnchorElement) {
      publicLink.href = target.publicSlug ? `/payment/${encodeURIComponent(target.publicSlug)}` : "#";
      publicLink.classList.toggle("hidden", !target.publicSlug);
    }
    renderPaymentPreview({ user: target.user || paymentCardsState.selected?.user, profile: target.profile || paymentCardsState.selected?.profile });
    renderPaymentMethods();
    renderPaymentPagePreview(target);
    setPaymentEditorStatus("");
    setPaymentPanel("editor");
  }

  async function loadPaymentCards() {
    const form = document.getElementById("payment-cards-filters");
    const table = document.getElementById("payment-cards-table");
    const mobileList = document.getElementById("payment-cards-mobile-list");
    const totalNode = document.getElementById("payment-cards-total");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = {
      q: getFormValue(form, "q", ""),
      userId: getFormValue(form, "userId", ""),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ pc_q: q.q, pc_user_id: q.userId, pc_page: q.page });
    const r = await fetch(`/api/admin/payment-cards?${Q(q)}`);
    if (!r.ok) {
      table.innerHTML = `<tr><td colspan="6" class="px-3 py-8 text-center text-red-700">${X(await E(r))}</td></tr>`;
      if (mobileList instanceof HTMLElement) {
        mobileList.innerHTML = `<div class="rounded-lg border border-red-200 p-4 text-center text-sm text-red-700">Не удалось загрузить Payment-страницы</div>`;
      }
      return;
    }
    const payload = await r.json();
    paymentCardsState.items = Array.isArray(payload.items) ? payload.items : [];
    paymentCardsState.selected = payload.selected || null;
    renderPaymentSelected(paymentCardsState.selected);
    if (totalNode instanceof HTMLElement) {
      totalNode.textContent = `${Number(payload.pagination?.total || 0).toLocaleString("ru-RU")} страниц`;
    }
    const emptyTable = `<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>Payment карточек пока нет</span><span class="text-xs text-neutral-400">Выберите профиль и создайте страницу точки.</span></div></td></tr>`;
    const emptyMobile = `<div class="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">Payment карточек пока нет</div>`;
    table.innerHTML = paymentCardsState.items.length
      ? paymentCardsState.items.map((item) => {
        const menu = menuWrap([
          menuItem({ label: "Редактировать", icon: "pen", attrs: `data-act="pc-edit" data-id="${X(item.id)}"` }),
          menuItem({ label: "Открыть", icon: "external", attrs: `data-act="open-url" data-url="/payment/${encodeURIComponent(item.publicSlug)}"` }),
          menuSeparator(),
          menuItem({ label: "Удалить", icon: "trash", attrs: `data-act="pc-delete" data-id="${X(item.id)}" data-title="${X(item.title)}"`, danger: true }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100">
          <td class="px-4 py-3"><div class="font-semibold">${X(item.profile?.name || item.user?.name || "UNQX User")}</div><div class="text-xs text-neutral-500">${X(item.profile?.role || item.user?.city || "")}</div></td>
          <td class="px-4 py-3"><div class="font-semibold">${X(item.title || "Payment card")}</div><div class="text-xs text-neutral-500">${X(item.address || "Адрес не указан")}</div></td>
          <td class="px-4 py-3 font-mono text-xs">/payment/${X(item.publicSlug)}</td>
          <td class="px-4 py-3">${Number(item.methods?.length || 0)}</td>
          <td class="px-4 py-3">${statusChip(item.isPublished ? "approved" : "muted")}</td>
          <td class="px-4 py-3 text-right"><div class="admin-row-actions justify-end">${menu}</div></td>
        </tr>`;
      }).join("")
      : emptyTable;
    if (mobileList instanceof HTMLElement) {
      mobileList.innerHTML = paymentCardsState.items.length
        ? paymentCardsState.items.map((item) => {
          const status = item.isPublished ? "Опубликована" : "Черновик";
          return `<article class="rounded-lg border border-neutral-200 bg-white p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-neutral-900">${X(item.title || "Payment card")}</p>
                <p class="mt-1 break-all font-mono text-xs text-neutral-500">/payment/${X(item.publicSlug)}</p>
              </div>
              <span class="shrink-0 rounded-full border border-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-600">${status}</span>
            </div>
            <p class="mt-2 line-clamp-2 text-xs text-neutral-500">${X(item.address || "Адрес не указан")}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-act="pc-edit" data-id="${X(item.id)}" class="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700">Редактировать</button>
              <button type="button" data-act="open-url" data-url="/payment/${encodeURIComponent(item.publicSlug)}" class="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700">Открыть</button>
              <button type="button" data-act="pc-delete" data-id="${X(item.id)}" data-title="${X(item.title)}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Удалить</button>
            </div>
          </article>`;
        }).join("")
        : emptyMobile;
    }
    renderPager("payment-cards-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadPaymentCards();
    });
    if (paymentCardsState.editing?.id) {
      const refreshed = paymentCardsState.items.find((item) => String(item.id) === String(paymentCardsState.editing.id));
      if (refreshed) {
        paymentCardsState.editing = refreshed;
        renderPaymentPagePreview(refreshed);
      }
    } else {
      renderPaymentPagePreview(null);
    }
  }

  async function savePaymentCard() {
    const form = document.getElementById("payment-card-editor");
    if (!(form instanceof HTMLFormElement)) return;
    const id = getFormValue(form, "id", "");
    const ownerId = getFormValue(form, "ownerId", "");
    if (!id && !ownerId) {
      await showAlert("Сначала выберите пользователя во вкладке Payment.");
      return;
    }
    const published = form.elements.namedItem("isPublished");
    const payload = {
      title: getFormValue(form, "title", ""),
      publicSlug: normalizePaymentSlug(getFormValue(form, "publicSlug", "")),
      address: getFormValue(form, "address", ""),
      postcode: getFormValue(form, "postcode", ""),
      methods: paymentCardsState.methods,
      isPublished: published instanceof HTMLInputElement ? published.checked : true,
    };
    if (!payload.title) {
      setPaymentEditorStatus("Название точки обязательно.", "error");
      return;
    }
    const url = id ? `/api/admin/payment-cards/${encodeURIComponent(id)}` : `/api/admin/users/${encodeURIComponent(ownerId)}/payment-cards`;
    const r = await fetch(url, {
      method: id ? "PATCH" : "POST",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      setPaymentEditorStatus(await E(r), "error");
      return;
    }
    const result = await r.json().catch(() => ({}));
    setPaymentEditorStatus("Сохранено.", "success");
    if (result.paymentCard) {
      paymentCardsState.editing = result.paymentCard;
      openPaymentEditor(result.paymentCard);
    }
    await loadPaymentCards();
  }

  async function loadManagers() {
    const table = document.getElementById("managers-table");
    if (!(table instanceof HTMLElement)) return;
    const r = await fetch("/api/admin/staff");
    if (!r.ok) {
      table.innerHTML = `<tr><td colspan="9" class="px-3 py-8 text-center text-red-700">Failed to load managers</td></tr>`;
      return;
    }
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => {
        const statusLabel = x.isActive ? "Active" : "Disabled";
        const roleLabel = x.role === "admin" ? "Admin" : "Manager";
        const toggleLabel = x.isActive ? "Disable" : "Enable";
        const toggleIcon = x.isActive ? "toggleLeft" : "toggleRight";
        const createdAccounts = Array.isArray(x.createdAccounts) ? x.createdAccounts : [];
        const createdAccountsCount = Number(x.createdAccountsCount ?? createdAccounts.length ?? 0);
        const accountLabels = createdAccounts
          .map((account) => {
            const login = String(account?.login || "").trim();
            if (login) return `@${login}`;
            const name = String(account?.name || "").trim();
            return name || String(account?.id || "").trim();
          })
          .filter(Boolean);
        const accountPreview = accountLabels.length
          ? accountLabels.length > 4
            ? `${accountLabels.slice(0, 4).join(", ")} +${accountLabels.length - 4}`
            : accountLabels.join(", ")
          : "—";
        const accountTitle = accountLabels.join(", ");
        const menu = menuWrap([
          menuItem({ label: toggleLabel, icon: toggleIcon, attrs: `data-act="manager-toggle" data-id="${X(x.id)}" data-next="${x.isActive ? 0 : 1}" data-name="${X(x.name || x.login || "")}"` }),
          menuItem({ label: "Reset password", icon: "key", attrs: `data-act="manager-reset" data-id="${X(x.id)}" data-name="${X(x.name || x.login || "")}"` }),
        ].join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.name || "—")}</td><td class="px-4 py-3 font-mono">${X(x.login || "")}</td><td class="px-4 py-3">${X(roleLabel)}</td><td class="px-4 py-3">${X(statusLabel)}</td><td class="px-4 py-3">${D(x.lastLoginAt)}</td><td class="px-4 py-3">${D(x.createdAt)}</td><td class="px-4 py-3 font-semibold">${createdAccountsCount.toLocaleString("ru-RU")}</td><td class="px-4 py-3 text-xs text-neutral-600" title="${X(accountTitle)}">${X(accountPreview)}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : `<tr><td colspan="9" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("userCheck", 48)}<span>No managers found</span></div></td></tr>`;
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
    const searchedSlug = String(q.q || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const canCreateBySearch = rows.length === 0 && /^[A-Z]{3}[0-9]{3}$/.test(searchedSlug);
    table.innerHTML = rows.length
      ? rows.map((x) => {
        const priceValue = typeof x.effectivePrice === "number" ? P(x.effectivePrice) : "-";
        const priceCell = `<span>${priceValue}</span>`;
        const rowMenuItems = [
          menuItem({ label: "Активировать", icon: "checkCircle", attrs: `data-act="sa" data-slug="${x.slug}"` }),
          menuItem({ label: x.state === "BLOCKED" ? "Разблокировать" : "Заблокировать", icon: x.state === "BLOCKED" ? "toggleRight" : "toggleLeft", attrs: `data-act="st" data-slug="${x.slug}" data-ns="${x.state === "BLOCKED" ? "free" : "blocked"}"` }),
        ];
        if (isLegacySlug(x.slug)) {
          rowMenuItems.push(menuItem({ label: "Изменить цену", icon: "pen", attrs: `data-act="sp" data-slug="${x.slug}" data-p="${x.priceOverride ?? ""}"` }));
        }
        if (x.ownerId) {
          rowMenuItems.push(menuItem({ label: "Удалить slug", icon: "trash", attrs: `data-act="sd" data-slug="${x.slug}" data-owner-id="${X(x.ownerId)}" data-owner-name="${X(x.ownerName || "")}"`, danger: true }));
        }
        rowMenuItems.push(menuSeparator());
        rowMenuItems.push(menuItem({ label: "Открыть визитку", icon: "external", attrs: `data-act="open-url" data-url="/${encodeURIComponent(x.slug)}"` }));
        const menu = menuWrap(rowMenuItems.join(""));
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${statusChip(x.state === "BLOCKED" ? "rejected" : x.state === "TAKEN" ? "approved" : "new")}</td><td class="px-4 py-3">${X(x.ownerName || "-")}</td><td class="px-4 py-3">${x.isPrimary ? "Да" : "Нет"}</td><td class="px-4 py-3">${priceCell}</td><td class="px-4 py-3">${x.requestedAt ? D(x.requestedAt) : "-"}</td><td class="px-4 py-3">${x.approvedAt ? D(x.approvedAt) : "-"}</td><td class="px-4 py-3">${x.activatedAt ? D(x.activatedAt) : "-"}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : canCreateBySearch
        ? (() => {
          const menu = menuWrap(
            menuItem({ label: "Изменить цену", icon: "pen", attrs: `data-act="sp" data-slug="${searchedSlug}" data-p=""` }),
          );
          return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">${X(searchedSlug)}</td><td class="px-4 py-3">${statusChip("new")}</td><td class="px-4 py-3">-</td><td class="px-4 py-3">Нет</td><td class="px-4 py-3"><span>-</span></td><td class="px-4 py-3">-</td><td class="px-4 py-3">-</td><td class="px-4 py-3">-</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
        })()
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
        const menuItems = [];
        if (x.slug) {
          menuItems.push(menuItem({ label: "Открыть визитку", icon: "eye", attrs: `data-act="open-url" data-url="/${encodeURIComponent(x.slug)}"` }));
        }
        menuItems.push(menuItem({ label: "Редактировать", icon: "pen", attrs: `data-act="open-url" data-url="/admin/cards/${x.id}/edit"` }));
        menuItems.push(menuItem({ label: "Сменить тариф", icon: "crown", attrs: `data-act="ct" data-id="${x.id}"` }));
        menuItems.push(menuSeparator());
        menuItems.push(menuItem({ label: x.isActive ? "Выключить" : "Включить", icon: x.isActive ? "toggleLeft" : "toggleRight", attrs: `data-act="cg" data-id="${x.id}" data-n="${x.isActive ? 0 : 1}"` }));
        if (x.slug) {
          menuItems.push(menuItem({ label: "QR-код", icon: "qr", attrs: `data-act="qr" data-slug="${x.slug}"` }));
        }
        const menu = menuWrap(menuItems.join(""));
        const slugCell = x.slug ? `#${X(x.slug)}` : '<span class="text-neutral-400">—</span>';
        return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3 font-mono">${slugCell}</td><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Legacy"}</td><td class="px-4 py-3">${statusChip(x.isActive ? "approved" : "rejected")}</td><td class="px-4 py-3">${Number(x.viewsCount || 0).toLocaleString("ru-RU")}</td><td class="px-4 py-3">${new Date(x.createdAt).toLocaleDateString("ru-RU")}</td><td class="px-4 py-3">${themePill(x.theme || "default_dark")}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
      }).join("")
      : `<tr><td colspan="8" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("creditCard", 48)}<span>Нет данных</span></div></td></tr>`;
    renderPager("cards-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadCards();
    });
  }

  async function loadPosts() {
    const form = document.getElementById("posts-filters");
    const table = document.getElementById("posts-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = {
      q: getFormValue(form, "q", ""),
      sort: getFormValue(form, "sort", "newest"),
      status: getFormValue(form, "status", "all"),
      page: getFormValue(form, "page", "1"),
    };
    setDashboardQuery({ post_q: q.q, post_sort: q.sort, post_status: q.status, post_page: q.page });
    const r = await fetch(`/api/admin/wall-posts?${Q(q)}`);
    if (!r.ok) return;
    const payload = await r.json();
    const rows = Array.isArray(payload.items) ? payload.items : [];
    table.innerHTML = rows.length
      ? rows.map((post) => {
        const author = post.author || {};
        const postHref = String(post.postHref || "");
        const commentsHref = String(post.commentsHref || postHref || "");
        const content = X(post.content || "").replace(/\n/g, "<br>");
        const slug = String(author.primarySlug || "").trim();
        const authorLine = [
          author.handle ? `@${X(String(author.handle).replace(/^@+/, ""))}` : "",
          slug ? `/${X(slug)}` : "",
          author.email ? X(author.email) : "",
        ].filter(Boolean).join(" · ");
        const postActions = [
          postHref ? `<a href="${X(postHref)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-neutral-900 underline underline-offset-2">Открыть</a>` : "",
          commentsHref ? `<a href="${X(commentsHref)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-neutral-600 underline underline-offset-2">Комментарии</a>` : "",
        ].filter(Boolean).join(" ");
        const status = String(post.status || "published");
        const statusCode = status === "published" ? "approved" : (status === "hidden" ? "muted" : "rejected");
        return `<tr class="admin-table-row border-t border-neutral-100 align-top">
          <td class="max-w-[420px] px-4 py-3">
            <div class="line-clamp-4 whitespace-normal text-sm text-neutral-900">${content || '<span class="text-neutral-400">—</span>'}</div>
            <div class="mt-2 font-mono text-[11px] text-neutral-400">${X(post.id || "")}</div>
          </td>
          <td class="px-4 py-3">
            <div class="font-semibold text-neutral-900">${X(author.name || "UNQX User")}${author.verified ? ' <span class="text-sky-600">✓</span>' : ""}</div>
            <div class="mt-1 text-xs text-neutral-500">${authorLine || "—"}</div>
            <div class="mt-1 text-xs text-neutral-400">${X(author.plan || "none")}</div>
          </td>
          <td class="px-4 py-3">${statusChip(statusCode)}</td>
          <td class="px-4 py-3 font-semibold">${Number(post.popularityScore || 0).toLocaleString("ru-RU")}</td>
          <td class="px-4 py-3">${Number(post.likesCount || 0).toLocaleString("ru-RU")}</td>
          <td class="px-4 py-3">${Number(post.commentsCount || 0).toLocaleString("ru-RU")}</td>
          <td class="px-4 py-3 text-xs text-neutral-600">${D(post.createdAt)}</td>
          <td class="px-4 py-3">${postActions || '<span class="text-xs text-neutral-400">Нет ссылки</span>'}</td>
        </tr>`;
      }).join("")
      : '<tr><td colspan="8" class="px-3 py-10 text-center text-neutral-500">Посты не найдены</td></tr>';
    renderPager("posts-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadPosts();
    });
  }

  async function applySlugPriceOverride(slugRaw, priceRaw) {
    const slug = String(slugRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
      await showAlert("Override цены доступен только для slug формата AAA000");
      return false;
    }

    const payloadPrice = (() => {
      if (priceRaw === null || priceRaw === undefined) return null;
      const raw = String(priceRaw).trim();
      if (!raw) return null;
      const normalized = raw
        .replace(/\s+/g, "")
        .replace(/[^\d.,-]/g, "")
        .replace(",", ".");
      const parsedPrice = Number(normalized);
      return Number.isFinite(parsedPrice) ? parsedPrice : Number.NaN;
    })();

    if (!(payloadPrice === null || Number.isFinite(payloadPrice))) {
      await showAlert("Некорректная цена override");
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
        statusNode.textContent = `Slug ${slug} уже куплен/активирован. Override не применен, цена не изменена.`;
      } else {
        statusNode.textContent =
          payloadPrice === null
            ? `Override для ${slug} удален`
            : `Цена для ${slug} сохранена: ${Number(payloadPrice).toLocaleString("ru-RU")} сум`;
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
        menuItem({ label: x.isVisible ? "Скрыть" : "Показать", icon: "eye", attrs: `data-act="tv" data-id="${x.id}" data-n="${x.isVisible ? 0 : 1}"` }),
        menuItem({ label: "Редактировать", icon: "pen", attrs: `data-act="te" data-json="${data}"` }),
        menuSeparator(),
        menuItem({ label: "Удалить", icon: "trash", attrs: `data-act="td" data-id="${x.id}"`, danger: true }),
      ].join(""));
      return `<tr class="admin-table-row border-t border-neutral-100"><td class="px-4 py-3">${X(x.name)}</td><td class="px-4 py-3 font-mono">${X(x.slug)}</td><td class="px-4 py-3">${x.tariff === "premium" ? "Премиум" : "Legacy"}</td><td class="px-4 py-3">${X(x.text)}</td><td class="px-4 py-3">${statusChip(x.isVisible ? "approved" : "muted")}</td><td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="px-3 py-10 text-center text-neutral-500"><div class="inline-flex flex-col items-center gap-2">${I("message", 48)}<span>Нет отзывов</span></div></td></tr>`;
    renderPager("testimonials-pagination", payload.pagination, (nextPage) => {
      initialQuery.t_page = String(nextPage);
      void loadTestimonials();
    });
  }

  function getVerificationStatusCode(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "approved") return "verification_approved";
    if (normalized === "rejected") return "verification_rejected";
    if (normalized === "revoked") return "verification_revoked";
    return "pending";
  }

  function getVerificationSectorLabel(value) {
    const sectorMap = {
      design: "Дизайн",
      sales: "Продажи",
      marketing: "Маркетинг",
      it: "IT",
      other: "Другое",
    };
    return sectorMap[String(value || "").toLowerCase()] || "Другое";
  }

  function getVerificationProofTypeLabel(value) {
    const proofTypeMap = {
      email: "Email",
      linkedin: "LinkedIn",
      website: "Website",
    };
    return proofTypeMap[String(value || "").toLowerCase()] || String(value || "—");
  }

  function getVerificationUserName(item) {
    return String(item?.user?.displayName || item?.user?.firstName || item?.user?.username || "—");
  }

  function renderVerificationProof(item) {
    const proofType = getVerificationProofTypeLabel(item?.proofType);
    const proofValueRaw = String(item?.proofValue || "").trim();
    const proofValue = /^https?:\/\//i.test(proofValueRaw)
      ? `<a href="${X(proofValueRaw)}" target="_blank" rel="noopener noreferrer" class="text-neutral-700 underline break-all">${X(proofValueRaw)}</a>`
      : `<span class="break-all">${X(proofValueRaw || "—")}</span>`;
    return `<div class="text-xs text-neutral-500">${X(proofType)}</div><div>${proofValue}</div>`;
  }

  function verificationDetailField(label, value, wide = false) {
    return `<div class="${wide ? "sm:col-span-2 " : ""}rounded-xl border border-neutral-200 px-3 py-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">${X(label)}</p>
      <div class="mt-1 text-sm text-neutral-900">${value || "—"}</div>
    </div>`;
  }

  function verificationActionButton(action, label, icon, danger = false) {
    const tone = danger
      ? "border-red-200 text-red-700 hover:bg-red-50"
      : action === "approve"
        ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        : "border-neutral-300 text-neutral-700 hover:bg-neutral-100";
    return `<button type="button" data-vr-modal-action="${X(action)}" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${tone}">${I(icon, 16)}<span>${X(label)}</span></button>`;
  }

  function renderVerificationDetailActions(item) {
    if (!(verificationDetailActions instanceof HTMLElement)) return;
    const status = String(item?.status || "").trim().toLowerCase();
    const buttons = [];
    buttons.push(`<button type="button" data-vr-modal-action="close" class="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100">Закрыть</button>`);
    if (status === "pending") {
      buttons.push(verificationActionButton("reject", "Отклонить", "xCircle", true));
      buttons.push(verificationActionButton("approve", "Одобрить", "checkCircle"));
    }
    if (status === "approved") {
      buttons.push(verificationActionButton("revoke", "Снять верификацию", "shieldOff", true));
    }
    verificationDetailActions.innerHTML = buttons.join("");
  }

  function openVerificationDetailModal(id) {
    const item = verificationRequestsState.itemsById.get(String(id || ""));
    if (!item || !(verificationDetailModal instanceof HTMLElement)) return;
    verificationRequestsState.selectedId = String(item.id || "");
    const userName = getVerificationUserName(item);
    const userLogin = String(item.user?.username || "").trim();
    if (verificationDetailTitle instanceof HTMLElement) {
      verificationDetailTitle.textContent = `Заявка: ${userName}`;
    }
    if (verificationDetailBody instanceof HTMLElement) {
      verificationDetailBody.innerHTML = `<div class="grid gap-3 sm:grid-cols-2">
        ${verificationDetailField("Пользователь", `${X(userName)}${userLogin ? `<div class="text-xs text-neutral-500">@${X(userLogin)}</div>` : ""}`)}
        ${verificationDetailField("Slug", `<span class="font-mono">${X(item.slug || "—")}</span>`)}
        ${verificationDetailField("Компания", X(item.companyName || "—"))}
        ${verificationDetailField("Роль", X(item.role || "—"))}
        ${verificationDetailField("Сфера", X(getVerificationSectorLabel(item.sector)))}
        ${verificationDetailField("Статус", statusChip(getVerificationStatusCode(item.status)))}
        ${verificationDetailField("Доказательство", renderVerificationProof(item), true)}
        ${verificationDetailField("Комментарий", X(item.comment || "—"), true)}
        ${verificationDetailField("Запрошено", D(item.requestedAt))}
        ${verificationDetailField("Решение", item.reviewedAt ? D(item.reviewedAt) : "—")}
        ${verificationDetailField("Комментарий админа", X(item.adminNote || "—"), true)}
      </div>`;
    }
    renderVerificationDetailActions(item);
    verificationDetailModal.classList.remove("hidden");
    verificationDetailModal.classList.add("flex");
    verificationDetailModal.setAttribute("aria-hidden", "false");
  }

  function closeVerificationDetailModal() {
    if (!(verificationDetailModal instanceof HTMLElement)) return;
    verificationDetailModal.classList.add("hidden");
    verificationDetailModal.classList.remove("flex");
    verificationDetailModal.setAttribute("aria-hidden", "true");
    verificationRequestsState.selectedId = "";
  }

  async function runVerificationRequestAction(action, id) {
    const item = verificationRequestsState.itemsById.get(String(id || ""));
    if (!item) return;
    if (action === "details") {
      openVerificationDetailModal(item.id);
      return;
    }
    if (action === "approve") {
      const ok = await showConfirm("Одобрить заявку на верификацию?");
      if (!ok) return;
      const r = await fetch(`/api/admin/verification-requests/${encodeURIComponent(item.id)}/approve`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
    } else if (action === "reject") {
      const adminNote = String(await showPrompt("Причина отклонения", "") || "").trim();
      if (!adminNote) return;
      const r = await fetch(`/api/admin/verification-requests/${encodeURIComponent(item.id)}/reject`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminNote }),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
    } else if (action === "revoke") {
      const adminNote = String(await showPrompt("Причина снятия верификации", "") || "").trim();
      if (!adminNote) return;
      const r = await fetch(`/api/admin/verification-requests/${encodeURIComponent(item.id)}/revoke`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminNote }),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
    } else {
      return;
    }
    closeVerificationDetailModal();
    closeAllRowMenus();
    await loadVerificationRequests();
    if (tab === "users") void loadUsers();
  }

  async function loadVerificationRequests() {
    const form = document.getElementById("verification-filters");
    const table = document.getElementById("verification-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    syncVerificationFiltersFromLocation(form);
    table.innerHTML = '<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-500">Загрузка...</td></tr>';
    try {
      const q = {
        status: getFormValue(form, "status", "all"),
        page: getFormValue(form, "page", "1"),
      };
      setDashboardQuery({ v_status: q.status, v_page: q.page });
      const r = await fetch(`/api/admin/verification-requests?${Q(q)}`);
      if (!r.ok) {
        table.innerHTML = '<tr><td colspan="4" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить заявки на верификацию</td></tr>';
        return;
      }
      const payload = await r.json();
      const rows = Array.isArray(payload.items) ? payload.items : [];
      verificationRequestsState.itemsById = new Map(
        rows.map((item) => [String(item?.id || ""), item]).filter(([id]) => Boolean(id)),
      );
      table.innerHTML = rows.length
        ? rows
          .map((x) => {
            const userName = getVerificationUserName(x);
            const userLogin = String(x.user?.username || "").trim();
            const userCell = `${X(userName)}${userLogin ? `<div class="text-xs text-neutral-500">@${X(userLogin)}</div>` : ""}`;
            const status = String(x.status || "").toLowerCase();
            const actions = [
              menuItem({ label: "Подробнее", icon: "eye", attrs: `data-act="vr-details" data-id="${X(x.id)}"` }),
            ];
            if (status === "pending") {
              actions.push(menuItem({ label: "Одобрить", icon: "checkCircle", attrs: `data-act="vr-approve" data-id="${X(x.id)}"` }));
              actions.push(menuItem({ label: "Отклонить", icon: "xCircle", attrs: `data-act="vr-reject" data-id="${X(x.id)}"`, danger: true }));
            }
            if (status === "approved") {
              actions.push(menuItem({ label: "Снять верификацию", icon: "shieldOff", attrs: `data-act="vr-revoke" data-id="${X(x.id)}"`, danger: true }));
            }
            const menu = menuWrap(actions.join(""));
            const verificationStatusCode = getVerificationStatusCode(x.status);
            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3">${userCell}</td>
              <td class="px-4 py-3 font-mono">${X(x.slug || "—")}</td>
              <td class="px-4 py-3">${statusChip(verificationStatusCode)}</td>
              <td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td>
            </tr>`;
          })
          .join("")
        : '<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-500">Заявок на верификацию нет</td></tr>';
      renderPager("verification-pagination", payload.pagination, (nextPage) => {
        setFormValue(form, "page", String(nextPage));
        void loadVerificationRequests();
      });
    } catch {
      table.innerHTML = '<tr><td colspan="4" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить заявки на верификацию</td></tr>';
    }
  }

  async function loadViolationReports() {
    const form = document.getElementById("reports-filters");
    const table = document.getElementById("reports-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Загрузка...</td></tr>';

    try {
      const q = {
        status: getFormValue(form, "status", "all"),
        page: getFormValue(form, "page", "1"),
      };
      setDashboardQuery({ r_status: q.status, r_page: q.page });
      const response = await fetch(`/api/admin/violation-reports?${Q(q)}`);
      if (!response.ok) {
        table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить репорты</td></tr>';
        return;
      }

      const payload = await response.json();
      const rows = Array.isArray(payload.items) ? payload.items : [];
      table.innerHTML = rows.length
        ? rows
          .map((item) => {
            const user = item.user || {};
            const displayName = String(user.displayName || "—");
            const login = String(user.login || "").trim();
            const userCell = `${X(displayName)}${login ? `<div class="text-xs text-neutral-500">@${X(login)}</div>` : ""}`;
            const contacts = [
              user.email ? `<div class="text-xs break-all">${X(String(user.email))}</div>` : "",
              user.telegramUsername ? `<div class="text-xs text-neutral-500">@${X(String(user.telegramUsername).replace(/^@+/, ""))}</div>` : "",
            ].filter(Boolean).join("");
            const ipCell = [
              item.reporterIp ? `<div class="text-xs font-mono">${X(String(item.reporterIp))}</div>` : "—",
              item.userAgent ? `<div class="mt-1 max-w-[260px] break-words text-xs text-neutral-500">${X(String(item.userAgent))}</div>` : "",
            ].join("");
            const menu = String(item.status || "").toLowerCase() === "processed"
              ? "—"
              : menuWrap([
                menuItem({ label: "Пометить обработанным", icon: "checkCircle", attrs: `data-act="rr-process" data-id="${X(item.id)}"` }),
              ].join(""));

            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3">${X(reportTypeLabel(item.type))}</td>
              <td class="px-4 py-3">${userCell}</td>
              <td class="px-4 py-3">${contacts || "—"}</td>
              <td class="px-4 py-3"><div class="max-w-[320px] whitespace-pre-wrap break-words text-xs">${X(String(item.message || "—"))}</div></td>
              <td class="px-4 py-3">${ipCell}</td>
              <td class="px-4 py-3">${statusChip(item.status || "new")}</td>
              <td class="px-4 py-3 text-xs">${D(item.createdAt)}</td>
              <td class="px-4 py-3 text-xs">${D(item.updatedAt)}</td>
              <td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td>
            </tr>`;
          })
          .join("")
        : '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Репортов нет</td></tr>';

      renderPager("reports-pagination", payload.pagination, (nextPage) => {
        setFormValue(form, "page", String(nextPage));
        void loadViolationReports();
      });
    } catch {
      table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить репорты</td></tr>';
    }
  }

  async function loadBadgeApplications() {
    const form = document.getElementById("badges-filters");
    const table = document.getElementById("badges-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    syncBadgesFiltersFromLocation(form);
    table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Загрузка...</td></tr>';
    try {
      const q = {
        status: getFormValue(form, "status", "all"),
        badgeType: getFormValue(form, "badgeType", "all"),
        page: getFormValue(form, "page", "1"),
      };
      setDashboardQuery({ ba_status: q.status, ba_type: q.badgeType, ba_page: q.page });
      const r = await fetch(`/api/admin/badge-applications?${Q(q)}`);
      if (!r.ok) {
        table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить заявки на бейджи</td></tr>';
        return;
      }
      const payload = await r.json();
      const rows = Array.isArray(payload.items) ? payload.items : [];
      const badgeTypeLabels = { government: "Гос. служебный", unqx_staff: "Работник UNQX" };
      table.innerHTML = rows.length
        ? rows
          .map((x) => {
            const userName = String(x.user?.displayName || x.user?.firstName || x.user?.username || "—");
            const userLogin = String(x.user?.username || "").trim();
            const userCell = `${X(userName)}${userLogin ? `<div class="text-xs text-neutral-500">@${X(userLogin)}</div>` : ""}`;
            const typeLabel = badgeTypeLabels[x.badgeType] || x.badgeType;
            const proofParts = [];
            if (x.proofText) proofParts.push(`<span class="text-xs break-all">${X(x.proofText)}</span>`);
            if (x.proofLink) {
              const link = String(x.proofLink).trim();
              proofParts.push(`<a href="${X(link)}" target="_blank" rel="noopener noreferrer" class="text-xs text-neutral-700 underline break-all">${X(link)}</a>`);
            }
            const proofCell = proofParts.length ? proofParts.join("<br>") : "—";
            const reviewCell = x.reviewedAt ? D(x.reviewedAt) : "—";
            const statusCode = x.status === "approved" ? "verification_approved" : x.status === "rejected" ? "verification_rejected" : x.status === "revoked" ? "verification_rejected" : "pending";
            const canApprove = x.status === "pending";
            const canRevoke = x.status === "approved";
            const actions = [];
            if (canApprove) {
              actions.push(menuItem({ label: "Одобрить", icon: "checkCircle", attrs: `data-act="ba-approve" data-id="${X(x.id)}"` }));
              actions.push(menuItem({ label: "Отклонить", icon: "xCircle", attrs: `data-act="ba-reject" data-id="${X(x.id)}"`, danger: true }));
            }
            if (canRevoke) {
              actions.push(menuItem({ label: "Отозвать", icon: "xCircle", attrs: `data-act="ba-revoke" data-id="${X(x.id)}"`, danger: true }));
            }
            const menu = actions.length ? menuWrap(actions.join("")) : "—";
            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3">${userCell}</td>
              <td class="px-4 py-3">${X(typeLabel)}</td>
              <td class="px-4 py-3">${X(x.workplace || "—")}</td>
              <td class="px-4 py-3">${X(x.role || "—")}</td>
              <td class="px-4 py-3">${proofCell}</td>
              <td class="px-4 py-3">${statusChip(statusCode)}</td>
              <td class="px-4 py-3 text-xs">${D(x.requestedAt)}</td>
              <td class="px-4 py-3 text-xs">${reviewCell}</td>
              <td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td>
            </tr>`;
          })
          .join("")
        : '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Заявок на бейджи нет</td></tr>';
      renderPager("badges-pagination", payload.pagination, (nextPage) => {
        setFormValue(form, "page", String(nextPage));
        void loadBadgeApplications();
      });
    } catch {
      table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить заявки на бейджи</td></tr>';
    }
  }

  async function loadPetRequests() {
    const form = document.getElementById("pets-filters");
    const table = document.getElementById("pets-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    syncPetFiltersFromLocation(form);
    table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Загрузка...</td></tr>';
    try {
      const q = {
        status: getFormValue(form, "status", "all"),
        petType: getFormValue(form, "petType", "all"),
        page: getFormValue(form, "page", "1"),
      };
      setDashboardQuery({ pet_status: q.status, pet_type: q.petType, pet_page: q.page });
      const response = await fetch(`/api/admin/pet-requests?${Q(q)}`);
      if (!response.ok) {
        table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить заявки на животных</td></tr>';
        return;
      }
      const payload = await response.json();
      const rows = Array.isArray(payload.items) ? payload.items : [];
      table.innerHTML = rows.length
        ? rows
          .map((item) => {
            const userName = String(item.user?.displayName || item.user?.firstName || item.user?.username || item.user?.email || "—").trim();
            const userLogin = String(item.user?.username || "").trim();
            const userEmail = String(item.user?.email || "").trim();
            const slugOrLogin = String(item.slug || "").trim();
            const status = String(item.status || "").trim().toLowerCase();
            const userCell = `${X(userName)}${userLogin ? `<div class="text-xs text-neutral-500">@${X(userLogin)}</div>` : userEmail ? `<div class="text-xs text-neutral-500">${X(userEmail)}</div>` : ""}`;
            const slugCell = slugOrLogin
              ? `<span class="font-mono">${X(slugOrLogin)}</span>${userLogin && slugOrLogin !== `@${userLogin}` ? `<div class="text-xs text-neutral-500">@${X(userLogin)}</div>` : ""}`
              : userLogin
                ? `<span class="text-xs text-neutral-500">@${X(userLogin)}</span>`
                : "—";
            const actions = [];
            if (status === "pending") {
              actions.push(menuItem({ label: "Одобрить", icon: "checkCircle", attrs: `data-act="pr-approve" data-id="${X(item.id)}"` }));
              actions.push(menuItem({ label: "Отклонить", icon: "xCircle", attrs: `data-act="pr-reject" data-id="${X(item.id)}"`, danger: true }));
            }
            if (item.user?.id) {
              actions.push(menuItem({ label: "Открыть визитку", icon: "idCard", attrs: `data-act="open-card" data-url="${userCardBasePath}/${encodeURIComponent(String(item.user.id))}/card"` }));
            }
            const menu = actions.length ? menuWrap(actions.join("")) : "—";
            return `<tr class="admin-table-row border-t border-neutral-100">
              <td class="px-4 py-3 text-xs">${D(item.requestedAt)}</td>
              <td class="px-4 py-3">${userCell}</td>
              <td class="px-4 py-3">${slugCell}</td>
              <td class="px-4 py-3">${X(petTypeLabel(item.petType))}</td>
              <td class="px-4 py-3">${X(item.displayName || item.petLabel || petTypeLabel(item.petType))}</td>
              <td class="px-4 py-3 text-right font-semibold">${P(item.priceSnapshot)}</td>
              <td class="px-4 py-3">${statusChip(status)}</td>
              <td class="px-4 py-3 text-xs">${item.reviewedAt ? D(item.reviewedAt) : "—"}</td>
              <td class="px-4 py-3"><div class="admin-row-actions">${menu}</div></td>
            </tr>`;
          })
          .join("")
        : '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Заявок на животных нет</td></tr>';
      renderPager("pets-pagination", payload.pagination, (nextPage) => {
        setFormValue(form, "page", String(nextPage));
        void loadPetRequests();
      });
    } catch {
      table.innerHTML = '<tr><td colspan="9" class="px-3 py-8 text-center text-rose-600">Не удалось загрузить заявки на животных</td></tr>';
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
    table.innerHTML = rows.length ? rows.map((x) => `<tr class="border-t border-neutral-100"><td class="px-4 py-3">${X(x.type)}</td><td class="px-4 py-3 font-mono text-xs">${X(x.path)}</td><td class="px-4 py-3 text-xs">${X(x.message || "-")}</td><td class="px-4 py-3 text-xs">${X(x.userAgent || "-")}</td><td class="px-4 py-3 text-xs">${D(x.occurredAt)}</td></tr>`).join("") : '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">Логи не найдены</td></tr>';
    renderPager("logs-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadLogs();
    });
  }

  function uaDescribe(action, detail) {
    const d = detail || "";
    switch (action) {
      case "login":          return "Вошёл в аккаунт";
      case "logout":         return "Вышел из аккаунта";
      case "password_change":return "Сменил пароль";
      case "avatar_update":  return "Загрузил новый аватар";
      case "avatar_delete":  return "Удалил аватар";
      case "email_verify":   return "Подтвердил email";
      case "qr_download":    return "Скачал QR-код";
      case "card_create":    return d ? `Создал визитку «${d}»` : "Создал визитку";
      case "card_update":    return d ? `Обновил визитку «${d}»` : "Обновил визитку";
      case "card_delete":    return d ? `Удалил визитку «${d}»` : "Удалил визитку";
      case "profile_update": return d ? `Обновил профиль: ${d}` : "Обновил профиль";
      case "link_add":       return d ? `Добавил ссылку: ${d}` : "Добавил ссылку в визитку";
      case "link_remove":    return d ? `Удалил ссылку: ${d}` : "Удалил ссылку из визитки";
      case "slug_request":   return d ? `Запросил slug «${d}»` : "Запросил slug";
      case "slug_purchase": {
        const plan = (d.match(/plan=(\S+)/) || [])[1] || "";
        const order = (d.match(/order=([a-f0-9-]{8,})/) || [])[1] || "";
        const planLabel = plan === "premium" ? "Премиум-подписку" : plan ? `план «${plan}»` : "подписку";
        return order ? `Купил ${planLabel} (заказ #${order.slice(0, 8)}…)` : `Купил ${planLabel}`;
      }
      case "plan_upgrade": {
        const plan = (d.match(/plan=(\S+)/) || [])[1] || d;
        return plan ? `Сменил тариф на «${plan}»` : "Сменил тариф";
      }
      default: return d || action;
    }
  }

  async function loadUserActivity() {
    const form = document.getElementById("user-activity-filters");
    const table = document.getElementById("user-activity-table");
    if (!(form instanceof HTMLFormElement) || !(table instanceof HTMLElement)) return;
    const q = {
      q:        getFormValue(form, "q", ""),
      action:   getFormValue(form, "action", "all"),
      dateFrom: getFormValue(form, "dateFrom", ""),
      dateTo:   getFormValue(form, "dateTo", ""),
      page:     getFormValue(form, "page", "1"),
    };
    table.innerHTML = `<tr><td colspan="3" class="px-3 py-8 text-center text-neutral-400">Загрузка...</td></tr>`;
    const r = await fetch(`/api/admin/user-activity?${Q(q)}`);
    if (!r.ok) {
      const msg = await E(r);
      table.innerHTML = `<tr><td colspan="3" class="px-3 py-8 text-center text-red-700">Ошибка: ${X(msg)}</td></tr>`;
      return;
    }
    const payload = await r.json();
    const rows = payload.items || [];
    table.innerHTML = rows.length
      ? rows.map((x) => `<tr class="border-t border-neutral-100 hover:bg-neutral-50">
          <td class="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">${D(x.createdAt)}</td>
          <td class="px-4 py-3">${x.userSlug ? `<a href="${base}/${X(x.userSlug)}" target="_blank" rel="noopener noreferrer" class="font-mono text-xs font-semibold text-neutral-900 hover:underline">${X(x.userSlug)}</a>` : x.userFreeSlug ? `<a href="${base}/${X(x.userFreeSlug)}" target="_blank" rel="noopener noreferrer" class="font-mono text-xs text-neutral-700 hover:underline">${X(x.userFreeSlug)}</a>` : x.userLogin ? `<span class="font-mono text-xs text-neutral-500">@${X(x.userLogin)}</span>` : '<span class="text-neutral-400 text-xs">—</span>'}</td>
          <td class="px-4 py-3 text-sm text-neutral-700">${X(uaDescribe(x.action, x.detail))}</td>
        </tr>`).join("")
      : `<tr><td colspan="3" class="px-3 py-10 text-center text-neutral-500">Действия не найдены</td></tr>`;
    renderPager("user-activity-pagination", payload.pagination, (nextPage) => {
      setFormValue(form, "page", String(nextPage));
      void loadUserActivity();
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
  const moveFocusOutBeforeHide = (container) => {
    if (!(container instanceof HTMLElement)) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !container.contains(active)) return;
    const fallback = document.querySelector(".admin-sidebar-link.is-active, .admin-topbar, main");
    if (fallback instanceof HTMLElement) {
      if (!fallback.hasAttribute("tabindex")) fallback.setAttribute("tabindex", "-1");
      fallback.focus({ preventScroll: true });
      return;
    }
    if (document.body instanceof HTMLElement) {
      document.body.focus();
    }
  };
  function syncATheme() {
    if (!(at instanceof HTMLSelectElement) || !(ath instanceof HTMLSelectElement)) return;
    const premium = at.value === "premium";
    ath.disabled = !premium;
    if (!premium) ath.value = "default_dark";
  }
  function closeA() {
    if (am instanceof HTMLElement) {
      moveFocusOutBeforeHide(am);
      am.classList.add("hidden");
      am.classList.remove("flex");
      am.setAttribute("aria-hidden", "true");
    }
  }
  function openA(id, tariff, theme) {
    if (!(am instanceof HTMLElement) || !(af instanceof HTMLFormElement)) return;
    const idField = af.elements.namedItem("orderId");
    if (idField instanceof HTMLInputElement) idField.value = id;
    if (at instanceof HTMLSelectElement) at.value = "premium";
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
      moveFocusOutBeforeHide(qm);
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
    moveFocusOutBeforeHide(tem);
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
    tariff.value = "premium";
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
    const r = await fetch(`/api/admin/testimonials/${id.value}`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ name: name.value.trim(), slug: slug.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6), tariff: "premium", text: text.value.trim() }) });
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
      const manualWarningOk = await showConfirm("Ручная смена тарифа без оплаты. Использовать только для корректировок. Продолжить?");
      if (!manualWarningOk) {
        t.value = prevPlan;
        return;
      }
      const reason = String(await showPrompt("Причина ручной смены тарифа", "") || "").trim();
      if (!reason) {
        showAlert("Укажи причину смены тарифа");
        t.value = prevPlan;
        return;
      }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: t.value, reason, force: false }) });
      if (!r.ok) {
        showAlert(await E(r));
        t.value = prevPlan;
      } else {
        void loadUsers();
      }
    }
  });

  function parseAllowedBadgeType(rawValue, fallback = "none") {
    const raw = String(rawValue || "").trim().toLowerCase();
    if (["none", "government", "unqx_staff"].includes(raw)) {
      return raw;
    }
    return fallback;
  }

  function parseAllowedBadgeTypes(rawValue, fallback = []) {
    const parsed = normalizeBadgeTypesInput(rawValue);
    if (parsed.length) return parsed;
    return normalizeBadgeTypesInput(fallback);
  }

  function openUserBadgeEditorFromNode(node) {
    if (!(node instanceof HTMLElement)) return;
    const userId = node.getAttribute("data-id");
    const userName = node.getAttribute("data-name") || "пользователя";
    if (!userId) return;
    const currentBadgeType = parseAllowedBadgeType(node.getAttribute("data-badge-type"), "none");
    const currentBadgeTypes = parseAllowedBadgeTypes(node.getAttribute("data-badge-types"), currentBadgeType);
    openUserBadgeModal({ userId, userName, badgeType: currentBadgeType, badgeTypes: currentBadgeTypes });
  }

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
    if (a === "open-card") {
      const url = n.getAttribute("data-url");
      if (url) window.location.assign(url);
      closeAllRowMenus();
      return;
    }
    if (a === "pc-select-user") {
      const userId = n.getAttribute("data-id") || "";
      const form = document.getElementById("payment-cards-filters");
      if (userId && form instanceof HTMLFormElement) {
        setFormValue(form, "userId", userId);
        setFormValue(form, "page", "1");
        paymentCardsState.editing = null;
        await loadPaymentCards();
        setPaymentPanel("pages");
      }
      closeAllRowMenus();
      return;
    }
    if (a === "pc-create-selected") {
      if (paymentCardsState.selected?.user?.id) {
        openPaymentEditor(null);
      }
      closeAllRowMenus();
      return;
    }
    if (a === "pc-edit") {
      const id = n.getAttribute("data-id");
      const item = paymentCardsState.items.find((x) => String(x.id) === String(id));
      if (item) openPaymentEditor(item);
      closeAllRowMenus();
      return;
    }
    if (a === "pc-delete") {
      const id = n.getAttribute("data-id");
      const title = n.getAttribute("data-title") || "Payment карточку";
      if (!id) return;
      const ok = await showConfirm(`Удалить ${title}?`);
      if (!ok) return;
      const r = await fetch(`/api/admin/payment-cards/${encodeURIComponent(id)}`, { method: "DELETE", headers: H() });
      if (!r.ok) await showAlert(await E(r));
      else {
        paymentCardsState.editing = null;
        await loadPaymentCards();
        document.getElementById("payment-card-editor")?.classList.add("hidden");
        document.getElementById("payment-card-editor-empty")?.classList.remove("hidden");
        renderPaymentPagePreview(null);
      }
      closeAllRowMenus();
      return;
    }
    if (a === "manager-toggle") {
      if (isManager) return;
      const id = n.getAttribute("data-id");
      const next = n.getAttribute("data-next");
      const name = n.getAttribute("data-name") || "менеджера";
      if (!id || next === null) return;
      const enable = next === "1";
      const ok = await showConfirm(`${enable ? "Включить" : "Отключить"} ${name}?`);
      if (!ok) return;
      const r = await fetch(`/api/admin/staff/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ isActive: enable }),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadManagers();
      return;
    }
    if (a === "manager-reset") {
      if (isManager) return;
      const id = n.getAttribute("data-id");
      const name = n.getAttribute("data-name") || "менеджера";
      if (!id) return;
      const entered = await showPrompt(`Новый пароль для ${name}`, "");
      if (entered === null) return;
      const password = String(entered || "").trim();
      if (!password || password.length < 8) {
        showAlert("Пароль должен быть не короче 8 символов.");
        return;
      }
      const r = await fetch(`/api/admin/staff/${encodeURIComponent(id)}/password`, {
        method: "PATCH",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ password }),
      });
      if (!r.ok) showAlert(await E(r));
      else showAlert("Пароль обновлён.");
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
        const userText = cells[1]?.textContent?.trim() || "—";
        const slugText = cells[2]?.textContent?.trim() || "—";
        const amountText = cells[4]?.textContent?.trim() || "—";
        const tariffText = cells[5]?.textContent?.trim() || "—";
        const ok = await showConfirm(
          `Подтвердить одобрение заявки?\n\nПользователь: ${userText}\nSlug: ${slugText}\nТариф: ${tariffText}\nОплата: ${amountText} получена\n\nПосле подтверждения:\n· Slug ${slugText} будет закреплён за пользователем\n· Тариф ${tariffText} будет активирован\n· Пользователь получит уведомление в Telegram`,
        );
        if (!ok) return;
      }
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
    if (a === "ct") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const tariff = String(await showPrompt("Новый тариф: premium", "premium") || "").trim().toLowerCase();
      if (tariff !== "premium") return;
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
      const entered = String(await showPrompt("Новый тариф: none или premium", prevPlan) || "").trim().toLowerCase();
      if (!["none", "premium"].includes(entered) || entered === prevPlan) return;
      const manualWarningOk = await showConfirm("Ручная смена тарифа без оплаты. Использовать только для корректировок. Продолжить?");
      if (!manualWarningOk) return;
      const reason = String(await showPrompt("Причина ручной смены тарифа", "") || "").trim();
      if (!reason) {
        showAlert("Укажи причину смены тарифа");
        return;
      }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/plan`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ plan: entered, reason, force: false }) });
      if (!r.ok) showAlert(await E(r));
      else void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "ul") {
      const userId = n.getAttribute("data-id");
      if (!userId) return;
      const prevLogin = String(n.getAttribute("data-login") || "").trim();
      const userName = n.getAttribute("data-name") || "пользователь";
      const entered = String(await showPrompt(`Новый логин для ${userName}`, prevLogin) || "").trim().toLowerCase();
      if (!entered || entered === prevLogin) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/login`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ login: entered }) });
      if (!r.ok) showAlert(await E(r));
      else void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "upwd") {
      const userId = n.getAttribute("data-id");
      if (!userId) return;
      const userName = n.getAttribute("data-name") || "пользователь";
      const entered = String(await showPrompt(`Новый пароль для ${userName} (мин. 8 символов)`, "") || "").trim();
      if (!entered) return;
      if (entered.length < 8) { await showAlert("Пароль должен содержать минимум 8 символов."); return; }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ password: entered }) });
      if (!r.ok) showAlert(await E(r));
      closeAllRowMenus();
      return;
    }
    if (a === "us-add") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "пользователь";
      if (!userId) return;
      const knownSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));

      const entered = await showPrompt(`Новый slug для ${userName} (${assignableSlugHint})`, "");
      if (entered === null) return;
      const nextSlug = normalizeShortSlug(entered);
      if (!isShortSlug(nextSlug)) {
        await showAlert(`Slug должен быть в формате ${assignableSlugHint}.`);
        return;
      }
      const ok = await showConfirm(`Назначить slug ${nextSlug} пользователю ${userName}?`);
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
          await showAlert("Лимит slug для пользователя равен 0. Сначала смени тариф, затем добавь slug.");
          return;
        }
        const candidates = Array.isArray(payload?.ownedSlugs)
          ? payload.ownedSlugs.map((slug) => normalizeShortSlug(slug)).filter((slug) => isShortSlug(slug))
          : knownSlugs;
        const defaultCurrent = candidates[0] || "";
        const hint = candidates.length ? `\nSlug пользователя: ${candidates.join(", ")}` : "";
        const enteredCurrent = await showPrompt(
          `Лимит slug достигнут. Укажи slug, который нужно заменить.${hint}`,
          defaultCurrent,
        );
        if (enteredCurrent === null) return;
        const currentSlug = normalizeShortSlug(enteredCurrent);
        if (!isShortSlug(currentSlug)) {
          await showAlert(`Текущий slug должен быть в формате ${assignableSlugHint}.`);
          return;
        }
        const replaceOk = await showConfirm(`Заменить ${currentSlug} на ${nextSlug} у пользователя ${userName}?`);
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
      const userName = n.getAttribute("data-name") || "пользователь";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));

      const defaultCurrent = userSlugs[0] || "";
      const hint = userSlugs.length ? ` (${userSlugs.join(", ")})` : "";
      const enteredCurrent = await showPrompt(`Текущий slug${hint}`, defaultCurrent);
      if (enteredCurrent === null) return;
      const currentSlug = normalizeShortSlug(enteredCurrent);
      if (!isShortSlug(currentSlug)) {
        await showAlert(`Текущий slug должен быть в формате ${assignableSlugHint}.`);
        return;
      }

      const enteredNext = await showPrompt(`Новый slug для ${userName} (${assignableSlugHint})`, currentSlug);
      if (enteredNext === null) return;
      const nextSlug = normalizeShortSlug(enteredNext);
      if (!isShortSlug(nextSlug)) {
        await showAlert(`Slug должен быть в формате ${assignableSlugHint}.`);
        return;
      }
      if (nextSlug === currentSlug) {
        await showAlert("Новый slug должен отличаться от текущего.");
        return;
      }
      const ok = await showConfirm(`Заменить ${currentSlug} на ${nextSlug} у пользователя ${userName}?`);
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
      const userName = n.getAttribute("data-name") || "пользователь";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));
      if (!userSlugs.length) {
        await showAlert("У этого пользователя нет slug для удаления.");
        return;
      }
      const defaultSlug = userSlugs[0] || "";
      const enteredSlug = await showPrompt(`Какой slug удалить? (${userSlugs.join(", ")})`, defaultSlug);
      if (enteredSlug === null) return;
      const targetSlug = normalizeShortSlug(enteredSlug);
      if (!isShortSlug(targetSlug)) {
        await showAlert(`Slug должен быть в формате ${assignableSlugHint}.`);
        return;
      }
      const ok = await showConfirm(`Удалить slug ${targetSlug} у ${userName}?\n\nБудут удалены аналитические записи по этому slug.`);
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
      const nextPrimary = payload?.nextPrimarySlug ? `\nНовый основной: ${payload.nextPrimarySlug}` : "";
      await showAlert(`Slug ${targetSlug} удален.${nextPrimary}`);
      void loadUsers();
      void loadSlugs();
      closeAllRowMenus();
      return;
    }
    if (a === "uvm") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "пользователя";
      if (!userId) return;

      const currentVerified = String(n.getAttribute("data-verified") || "") === "1";
      const currentCompany = String(n.getAttribute("data-company") || "").trim();
      const currentRole = String(n.getAttribute("data-role") || "").trim();
      const currentBadgeType = parseAllowedBadgeType(n.getAttribute("data-badge-type"), "none");
      const currentBadgeTypes = parseAllowedBadgeTypes(n.getAttribute("data-badge-types"), currentBadgeType);
      openUserVerificationModal({
        userId,
        userName,
        isVerified: currentVerified,
        company: currentCompany,
        role: currentRole,
        badgeType: currentBadgeType,
        badgeTypes: currentBadgeTypes,
      });
      return;
    }
    if (a === "uvb") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "пользователя";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));
      if (!userSlugs.length) {
        await showAlert("У пользователя нет slug для накрутки просмотров.");
        return;
      }
      const enteredCount = await showPrompt(`Сколько просмотров добавить для ${userName}? (1-5000)`, "100");
      if (enteredCount === null) return;
      const count = Number.parseInt(String(enteredCount || "").trim(), 10);
      if (!Number.isFinite(count) || count < 1 || count > 5000) {
        await showAlert("Количество должно быть числом от 1 до 5000.");
        return;
      }
      let targetSlug = userSlugs[0];
      if (userSlugs.length > 1) {
        const enteredSlug = await showPrompt(`На какой slug начислить просмотры? (${userSlugs.join(", ")})`, targetSlug);
        if (enteredSlug === null) return;
        targetSlug = normalizeShortSlug(enteredSlug);
        if (!isShortSlug(targetSlug)) {
          await showAlert(`Slug должен быть в формате ${assignableSlugHint}.`);
          return;
        }
      }
      const ok = await showConfirm(`Добавить ${count} просмотров на ${targetSlug} для ${userName}?`);
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
      await showAlert(`Добавлено просмотров: ${Number(payload?.addedViews || count)} (slug: ${payload?.slug || targetSlug}).`);
      void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "ubadge") {
      openUserBadgeEditorFromNode(n);
      return;
    }
    if (a === "uvd") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "пользователя";
      if (!userId) return;
      const userSlugs = String(n.getAttribute("data-slugs") || "")
        .split(",")
        .map((slug) => normalizeShortSlug(slug))
        .filter((slug) => isShortSlug(slug));
      if (!userSlugs.length) {
        await showAlert("У пользователя нет slug для уменьшения просмотров.");
        return;
      }
      const enteredCount = await showPrompt(`Сколько просмотров убрать для ${userName}? (1-5000)`, "100");
      if (enteredCount === null) return;
      const count = Number.parseInt(String(enteredCount || "").trim(), 10);
      if (!Number.isFinite(count) || count < 1 || count > 5000) {
        await showAlert("Количество должно быть числом от 1 до 5000.");
        return;
      }
      let targetSlug = userSlugs[0];
      if (userSlugs.length > 1) {
        const enteredSlug = await showPrompt(`С какого slug уменьшить просмотры? (${userSlugs.join(", ")})`, targetSlug);
        if (enteredSlug === null) return;
        targetSlug = normalizeShortSlug(enteredSlug);
        if (!isShortSlug(targetSlug)) {
          await showAlert(`Slug должен быть в формате ${assignableSlugHint}.`);
          return;
        }
      }
      const ok = await showConfirm(`Уменьшить на ${count} просмотров для ${targetSlug} пользователя ${userName}?`);
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/views/reduce`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ count, slug: targetSlug }),
      });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      await showAlert(`Уменьшено просмотров: ${Number(payload?.removedViews || 0)} (slug: ${payload?.slug || targetSlug}).`);
      void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "oa") openA(n.getAttribute("data-id") || "", n.getAttribute("data-t") || "premium", n.getAttribute("data-th") || "default_dark");
    if (a === "od") { if (isManager) return; const id = n.getAttribute("data-id"); if (!id || !await showConfirm("Удалить заявку?")) return; const r = await fetch(`/api/admin/orders/${id}`, { method: "DELETE", headers: H() }); if (!r.ok) showAlert(await E(r)); else void loadOrders(); }
    if (a === "ope") { const id = n.getAttribute("data-id"); if (!id) return; const r = await fetch(`/api/admin/orders/${id}/extend-pending`, { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadOrders(); }
    if (a === "ub") { const telegramId = n.getAttribute("data-id"); const status = n.getAttribute("data-status"); if (!telegramId) return; const isBlocked = status === "blocked"; if (!isBlocked && !await showConfirm("Заблокировать пользователя и деактивировать его slug?")) return; if (isBlocked && !await showConfirm("Разблокировать пользователя и восстановить статусы slug?")) return; const r = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}/${isBlocked ? "unblock" : "block"}`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadUsers(); }
    if (a === "ud") {
      const userId = n.getAttribute("data-id");
      const userName = n.getAttribute("data-name") || "пользователя";
      if (!userId) return;
      const hardConfirm = await showConfirm(`Полностью удалить ${userName} и все связанные записи?\n\nДействие необратимо.`);
      if (!hardConfirm) return;
      const keyword = String(await showPrompt("Введите DELETE для подтверждения", "") || "").trim();
      if (keyword !== "DELETE") {
        await showAlert("Удаление отменено: неверное подтверждение.");
        return;
      }
      const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/purge`, { method: "DELETE", headers: H() });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      const freedSlugs = Number(payload?.freedSlugs || 0);
      await showAlert(`Пользователь удален. Освобождено slug: ${freedSlugs}.`);
      void loadUsers();
      closeAllRowMenus();
      return;
    }
    if (a === "sd") {
      const slug = n.getAttribute("data-slug");
      const ownerId = n.getAttribute("data-owner-id");
      const ownerName = n.getAttribute("data-owner-name") || "пользователя";
      if (!slug || !ownerId) return;
      const ok = await showConfirm(`Удалить slug ${slug} у ${ownerName}?\n\nБудут удалены аналитические записи по этому slug.`);
      if (!ok) return;
      const r = await fetch(`/api/admin/users/${encodeURIComponent(ownerId)}/slugs/${encodeURIComponent(slug)}`, { method: "DELETE", headers: H() });
      if (!r.ok) {
        await showAlert(await E(r));
        return;
      }
      const payload = await r.json().catch(() => ({}));
      const nextPrimary = payload?.nextPrimarySlug ? `\nНовый основной: ${payload.nextPrimarySlug}` : "";
      await showAlert(`Slug ${slug} удален.${nextPrimary}`);
      void loadUsers();
      void loadSlugs();
      closeAllRowMenus();
      return;
    }
    if (a === "st") { const slug = n.getAttribute("data-slug"), state = n.getAttribute("data-ns"); if (!slug || !state) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/state`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ state }) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "sa") { const slug = n.getAttribute("data-slug"); if (!slug) return; const r = await fetch(`/api/admin/slugs/${encodeURIComponent(slug)}/activate`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({}) }); if (!r.ok) showAlert(await E(r)); else void loadSlugs(); }
    if (a === "sp") { const slug = n.getAttribute("data-slug"), cur = n.getAttribute("data-p") || ""; if (!slug) return; const x = await showPrompt("Новая цена slug (пусто = убрать override)", cur); if (x === null) return; await applySlugPriceOverride(slug, x); }
    if (a === "cg") { const id = n.getAttribute("data-id"), isActive = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/cards/${id}/toggle-active`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isActive }) }); if (!r.ok) showAlert(await E(r)); else void loadCards(); }
    if (a === "qr") { const slug = n.getAttribute("data-slug"); if (slug) await openQ(slug); }
    if (a === "tv") { const id = n.getAttribute("data-id"), isVisible = n.getAttribute("data-n") === "1"; if (!id) return; const r = await fetch(`/api/admin/testimonials/${id}/visibility`, { method: "PATCH", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ isVisible }) }); if (!r.ok) showAlert(await E(r)); else void loadTestimonials(); }
    if (a === "td") {
      const id = n.getAttribute("data-id");
      if (!id || !await showConfirm("Удалить отзыв?")) return;
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
    if (a === "vr-details") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      openVerificationDetailModal(id);
      closeAllRowMenus();
      return;
    }
    if (a === "vr-approve" || a === "vr-reject" || a === "vr-revoke") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      await runVerificationRequestAction(a.replace("vr-", ""), id);
      return;
    }
    if (a === "rr-process") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const ok = await showConfirm("Пометить репорт как обработанный?");
      if (!ok) return;
      const r = await fetch(`/api/admin/violation-reports/${encodeURIComponent(id)}/process`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadViolationReports();
      closeAllRowMenus();
      return;
    }
    if (a === "ba-approve") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const ok = await showConfirm("Одобрить заявку на бейдж?");
      if (!ok) return;
      const r = await fetch(`/api/admin/badge-applications/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadBadgeApplications();
      closeAllRowMenus();
      return;
    }
    if (a === "ba-reject") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const adminNote = String(await showPrompt("Причина отклонения", "") || "").trim();
      if (!adminNote) return;
      const r = await fetch(`/api/admin/badge-applications/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminNote }),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadBadgeApplications();
      closeAllRowMenus();
      return;
    }
    if (a === "ba-revoke") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const adminNote = String(await showPrompt("Причина отзыва бейджа", "") || "").trim();
      if (!adminNote) return;
      const r = await fetch(`/api/admin/badge-applications/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminNote }),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadBadgeApplications();
      closeAllRowMenus();
      return;
    }
    if (a === "pr-approve") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const ok = await showConfirm("Одобрить заявку на животное?");
      if (!ok) return;
      const r = await fetch(`/api/admin/pet-requests/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadPetRequests();
      closeAllRowMenus();
      return;
    }
    if (a === "pr-reject") {
      const id = n.getAttribute("data-id");
      if (!id) return;
      const adminNote = String(await showPrompt("Причина отклонения", "") || "").trim();
      if (!adminNote) return;
      const r = await fetch(`/api/admin/pet-requests/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: H({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminNote }),
      });
      if (!r.ok) showAlert(await E(r));
      else void loadPetRequests();
      closeAllRowMenus();
      return;
    }
  });

  document.getElementById("orders-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadOrders(); });
  document.getElementById("orders-filters")?.addEventListener("reset", () => {
    const form = document.getElementById("orders-filters");
    if (!(form instanceof HTMLFormElement)) return;
    setTimeout(() => {
      setFormValue(form, "q", "");
      setFormValue(form, "status", "all");
      setFormValue(form, "tariff", "all");

      setFormValue(form, "dateFrom", "");
      setFormValue(form, "dateTo", "");
      setFormValue(form, "page", "1");
      void loadOrders();
    }, 0);
  });
  document.getElementById("purchases-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadPurchases(); });
  document.getElementById("pricing-settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const body = {
      planPremiumMonthlyPriceUsd: Number(getFormValue(form, "planPremiumMonthlyPriceUsd", "2")),
      planPremiumMonthlyPriceUzs: Number(getFormValue(form, "planPremiumMonthlyPriceUzs", "130000")),
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
      showAlert("Тарифы обновлены");
    }
  });
  document.getElementById("users-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadUsers(); });
  document.getElementById("users-table")?.addEventListener("click", (e) => {
    const row = e.target instanceof Element ? e.target.closest("tr[data-user-profile-url]") : null;
    if (!row) return;
    const url = row.getAttribute("data-user-profile-url");
    if (url) window.open(url, "_blank");
  });
  document.getElementById("accounts-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadAccounts(); });
  document.getElementById("payment-cards-filters")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (f instanceof HTMLFormElement) setFormValue(f, "page", "1");
    paymentCardsState.editing = null;
    void loadPaymentCards();
    setPaymentPanel("pages");
  });
  document.getElementById("payment-cards-create")?.addEventListener("click", async () => {
    if (!paymentCardsState.selected?.user?.id) {
      await showAlert("Сначала выберите пользователя во вкладке Payment или откройте Payment из меню пользователя.");
      setPaymentPanel("profiles");
      return;
    }
    openPaymentEditor(null);
  });
  document.getElementById("payment-selected-create")?.addEventListener("click", () => {
    if (!paymentCardsState.selected?.user?.id) return;
    openPaymentEditor(null);
  });
  document.getElementById("payment-user-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void searchPaymentUsers();
  });
  document.querySelectorAll("[data-payment-panel-tab]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.addEventListener("click", () => setPaymentPanel(node.getAttribute("data-payment-panel-tab") || "profiles"));
  });
  document.querySelectorAll("[data-payment-panel-goto]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.addEventListener("click", () => setPaymentPanel(node.getAttribute("data-payment-panel-goto") || "profiles"));
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    const tabNode = target instanceof Element ? target.closest("[data-payment-panel-tab]") : null;
    if (tabNode instanceof HTMLElement) {
      e.preventDefault();
      setPaymentPanel(tabNode.getAttribute("data-payment-panel-tab") || "profiles");
      return;
    }
    const node = target instanceof Element ? target.closest("[data-payment-panel-goto]") : null;
    if (!(node instanceof HTMLElement)) return;
    e.preventDefault();
    setPaymentPanel(node.getAttribute("data-payment-panel-goto") || "profiles");
  });
  document.getElementById("payment-card-method-add")?.addEventListener("click", () => {
    paymentCardsState.methods.push({
      id: `${Date.now()}_${Math.random()}`,
      type: "card",
      label: "Карта",
      value: "",
      note: "",
      isActive: true,
    });
    renderPaymentMethods();
  });
  document.getElementById("payment-card-methods-list")?.addEventListener("input", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const row = target?.closest("[data-payment-method-index]");
    if (!(row instanceof HTMLElement)) return;
    const index = Number(row.getAttribute("data-payment-method-index"));
    if (!Number.isFinite(index) || !paymentCardsState.methods[index]) return;
    const field = target?.getAttribute("data-payment-method-field");
    if (!field) return;
    paymentCardsState.methods[index] = {
      ...paymentCardsState.methods[index],
      [field]: target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : "",
    };
  });
  document.getElementById("payment-card-methods-list")?.addEventListener("click", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const remove = target?.closest("[data-payment-method-remove]");
    if (!(remove instanceof HTMLElement)) return;
    e.preventDefault();
    const index = Number(remove.getAttribute("data-payment-method-remove"));
    if (!Number.isFinite(index) || index < 0 || index >= paymentCardsState.methods.length) return;
    paymentCardsState.methods.splice(index, 1);
    renderPaymentMethods();
  });
  document.getElementById("payment-card-editor")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void savePaymentCard();
  });
  document.getElementById("payment-card-delete")?.addEventListener("click", async () => {
    const form = document.getElementById("payment-card-editor");
    if (!(form instanceof HTMLFormElement)) return;
    const id = getFormValue(form, "id", "");
    if (!id) return;
    const ok = await showConfirm("Удалить эту Payment карточку?");
    if (!ok) return;
    const r = await fetch(`/api/admin/payment-cards/${encodeURIComponent(id)}`, { method: "DELETE", headers: H() });
    if (!r.ok) {
      setPaymentEditorStatus(await E(r), "error");
      return;
    }
    form.classList.add("hidden");
    document.getElementById("payment-card-editor-empty")?.classList.remove("hidden");
    paymentCardsState.editing = null;
    renderPaymentPagePreview(null);
    await loadPaymentCards();
    setPaymentPanel("pages");
  });
  const managersCreateForm = document.getElementById("managers-create-form");
  const managersCreateStatus = document.getElementById("managers-create-status");
  managersCreateForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isManager) return;
    if (!(managersCreateForm instanceof HTMLFormElement)) return;
    if (managersCreateStatus instanceof HTMLElement) {
      managersCreateStatus.textContent = "";
    }
    const name = managersCreateForm.elements.namedItem("name");
    const login = managersCreateForm.elements.namedItem("login");
    const password = managersCreateForm.elements.namedItem("password");
    if (!(name instanceof HTMLInputElement) || !(login instanceof HTMLInputElement) || !(password instanceof HTMLInputElement)) return;
    const payload = {
      name: name.value || "",
      login: login.value || "",
      password: password.value || "",
    };
    const r = await fetch("/api/admin/staff", {
      method: "POST",
      headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const msg = await E(r);
      if (managersCreateStatus instanceof HTMLElement) {
        managersCreateStatus.textContent = `Ошибка: ${msg}`;
        managersCreateStatus.className = "md:col-span-4 text-xs text-red-700";
      }
      return;
    }
    managersCreateForm.reset();
    if (managersCreateStatus instanceof HTMLElement) {
      managersCreateStatus.textContent = "Менеджер создан";
      managersCreateStatus.className = "md:col-span-4 text-xs text-emerald-700";
    }
    void loadManagers();
  });
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
  document.getElementById("posts-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadPosts(); });
  document.getElementById("posts-filters")?.elements?.namedItem?.("sort")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("posts-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadPosts();
  });
  document.getElementById("posts-filters")?.elements?.namedItem?.("status")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("posts-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadPosts();
  });
  document.getElementById("logs-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadLogs(); });
  document.getElementById("user-activity-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadUserActivity(); });
  document.getElementById("user-activity-filters")?.addEventListener("reset", () => { setTimeout(() => void loadUserActivity(), 0); });
  document.getElementById("verification-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadVerificationRequests(); });
  document.getElementById("verification-filters")?.elements?.namedItem?.("status")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("verification-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadVerificationRequests();
  });
  document.getElementById("reports-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadViolationReports(); });
  document.getElementById("reports-filters")?.elements?.namedItem?.("status")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("reports-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadViolationReports();
  });
  document.getElementById("badges-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadBadgeApplications(); });
  document.getElementById("badges-filters")?.elements?.namedItem?.("status")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("badges-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadBadgeApplications();
  });
  document.getElementById("badges-filters")?.elements?.namedItem?.("badgeType")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("badges-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadBadgeApplications();
  });
  document.getElementById("pets-filters")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (f instanceof HTMLFormElement) setFormValue(f, "page", "1"); void loadPetRequests(); });
  document.getElementById("pets-filters")?.elements?.namedItem?.("status")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("pets-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadPetRequests();
  });
  document.getElementById("pets-filters")?.elements?.namedItem?.("petType")?.addEventListener?.("change", (e) => {
    const target = e.currentTarget;
    const form = document.getElementById("pets-filters");
    if (!(target instanceof HTMLSelectElement) || !(form instanceof HTMLFormElement)) return;
    setFormValue(form, "page", "1");
    void loadPetRequests();
  });
  document.getElementById("testimonial-create-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!(f instanceof HTMLFormElement)) return;
    const d = new FormData(f);
    const p = { name: String(d.get("name") || "").trim(), slug: String(d.get("slug") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6), tariff: String(d.get("tariff") || "premium"), text: String(d.get("text") || "").trim() };
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
          setPushBroadcastStatus("Не удалось получить статус рассылки", "error");
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
          setPushBroadcastStatus(`Рассылка выполняется: ${processed}/${total} (${percent}%), sent: ${sent}, tokens: ${tokens}, cleaned: ${cleaned}, in-app: ${inAppInserted}`, "progress");
          pushBroadcastPollTimer = setTimeout(() => {
            void tick();
          }, 1500);
          return;
        }

        stopPushBroadcastPolling();
        if (status === "completed") {
          if (job?.dryRun) {
            setPushBroadcastStatus(`Dry-run завершён: найдено получателей ${total}`, "success");
          } else {
            setPushBroadcastStatus(`Рассылка завершена: ${processed}/${total}, sent: ${sent}, tokens: ${tokens}, cleaned: ${cleaned}, in-app: ${inAppInserted}`, "success");
          }
          if (onDone) onDone(true);
          return;
        }

        const errorMessage = String(job?.error || "Ошибка выполнения рассылки");
        setPushBroadcastStatus(`Ошибка рассылки: ${errorMessage}`, "error");
        if (onDone) onDone(false);
      } catch {
        stopPushBroadcastPolling();
        setPushBroadcastStatus("Сбой сети при проверке статуса рассылки", "error");
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
      showAlert("Укажите userId или slug");
      return;
    }
    if (!title || !bodyText) {
      showAlert("Заполните заголовок и текст");
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
        showAlert("Поле JSON data должно быть валидным JSON-объектом");
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
    showAlert(`Тест отправлен. userId: ${payload?.userId || "-"}, sent: ${sent}, tokens: ${tokens}, in-app: ${inserted}`);
  });
  document.getElementById("push-broadcast-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const title = getFormValue(form, "title", "").trim();
    const bodyText = getFormValue(form, "body", "").trim();
    if (!title || !bodyText) {
      showAlert("Заполните заголовок и текст рассылки");
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
        showAlert("Поле JSON data должно быть валидным JSON-объектом");
        return;
      }
    }

    const warning = dryRun
      ? "Сделать dry-run рассылки?"
      : "Отправить push-рассылку выбранной аудитории?";
    if (!await showConfirm(warning)) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }
    setPushBroadcastStatus("Инициализация рассылки...", "progress");

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
      setPushBroadcastStatus("Не удалось запустить рассылку", "error");
      return;
    }

    stopPushBroadcastPolling();
    await pollBroadcastJob(jobId, (success) => {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
      if (!success) {
        showAlert("Рассылка завершилась с ошибкой");
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
      setFormValue(form, "q", getInitial("o_q", "q") || "");
      setFormValue(form, "status", getInitial("o_status", "status") || "all");
      setFormValue(form, "tariff", getInitial("o_tariff", "tariff") || "all");

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
  if (normalizedTab === "payment-cards") {
    const form = document.getElementById("payment-cards-filters");
    let initialPaymentUserId = "";
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "q", getInitial("pc_q", "q") || "");
      initialPaymentUserId = getInitial("pc_user_id", "userId") || "";
      setFormValue(form, "userId", initialPaymentUserId);
      setFormValue(form, "page", getInitial("pc_page", "page") || "1");
    }
    const requestedPanel = getInitial("pc_view", "view") || "";
    setPaymentPanel(requestedPanel || (initialPaymentUserId ? "pages" : "profiles"));
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
      setFormValue(form, "profileType", getInitial("u_type", "profileType") || "all");
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
  if (tab === "posts") {
    const form = document.getElementById("posts-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "q", getInitial("post_q", "q") || "");
      setFormValue(form, "sort", getInitial("post_sort", "sort") || "newest");
      setFormValue(form, "status", getInitial("post_status", "status") || "all");
      setFormValue(form, "page", getInitial("post_page", "page") || "1");
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
  if (tab === "reports") {
    const form = document.getElementById("reports-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "status", getInitial("r_status", "status") || "all");
      setFormValue(form, "page", getInitial("r_page", "page") || "1");
      syncReportsFiltersFromLocation(form);
    }
  }
  if (tab === "badges") {
    const form = document.getElementById("badges-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "status", getInitial("ba_status", "status") || "all");
      setFormValue(form, "badgeType", getInitial("ba_type", "badgeType") || "all");
      setFormValue(form, "page", getInitial("ba_page", "page") || "1");
      syncBadgesFiltersFromLocation(form);
    }
  }
  if (tab === "pets") {
    const form = document.getElementById("pets-filters");
    if (form instanceof HTMLFormElement) {
      setFormValue(form, "status", getInitial("pet_status", "status") || "all");
      setFormValue(form, "petType", getInitial("pet_type", "petType") || "all");
      setFormValue(form, "page", getInitial("pet_page", "page") || "1");
      syncPetFiltersFromLocation(form);
    }
  }

  if (!isManager) {
    void loadMaintenanceBanner();
  }

  if (tab === "analytics") {
    dbg("load", "analytics");
    void loadAnalytics();
  }
  if (tab === "orders") {
    dbg("load", "orders");
    void loadOrders();
  }
  if (tab === "purchases") {
    dbg("load", "purchases");
    void loadPurchases();
    void loadPricingSettings();
  }
  if (normalizedTab === "payment-cards") {
    dbg("load", "payment-cards");
    void searchPaymentUsers();
    void loadPaymentCards();
  }
  if (tab === "users") {
    dbg("load", "users");
    void loadUsers();
  }
  if (tab === "managers") {
    dbg("load", "managers");
    void loadManagers();
  }
  if (tab === "slugs") {
    dbg("load", "slugs");
    void loadSlugs();
  }
  if (tab === "cards") {
    dbg("load", "cards");
    void loadCards();
  }
  if (tab === "posts") {
    dbg("load", "posts");
    void loadPosts();
  }

  if (tab === "testimonials") {
    dbg("load", "testimonials");
    void loadTestimonials();
  }
  if (tab === "logs") {
    dbg("load", "logs");
    void loadLogs();
  }
  if (tab === "activity") {
    dbg("load", "activity");
    void loadUserActivity();
  }
  const verificationSection = document.getElementById("tab-verification");
  if (tab === "verification" || (verificationSection instanceof HTMLElement && !verificationSection.classList.contains("hidden"))) {
    dbg("load", "verification");
    void loadVerificationRequests();
  }
  if (tab === "accounts") {
    dbg("load", "accounts");
    void loadAccounts();
  }
  const reportsSection = document.getElementById("tab-reports");
  if (tab === "reports" || (reportsSection instanceof HTMLElement && !reportsSection.classList.contains("hidden"))) {
    dbg("load", "reports");
    void loadViolationReports();
  }
  const badgesSection = document.getElementById("tab-badges");
  if (tab === "badges" || (badgesSection instanceof HTMLElement && !badgesSection.classList.contains("hidden"))) {
    dbg("load", "badges");
    void loadBadgeApplications();
  }
  const petsSection = document.getElementById("tab-pets");
  if (tab === "pets" || (petsSection instanceof HTMLElement && !petsSection.classList.contains("hidden"))) {
    dbg("load", "pets");
    void loadPetRequests();
  }
  if (tab === "score") {
    dbg("load", "score");
    void loadScoreManagement();
  }
})();
