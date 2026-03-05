(function () {
  const root = document.body;
  if (!root || root.getAttribute("data-page") !== "profile-page") return;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) =>
    String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const fd = (v) => {
    try {
      if (!v) return "—";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "—";
      const day = d.toLocaleString("ru-RU", { day: "numeric" });
      const month = d.toLocaleString("ru-RU", { month: "long" });
      const year = d.toLocaleString("ru-RU", { year: "numeric" });
      return `${day} ${month} ${year}`;
    } catch {
      return "—";
    }
  };

  const fdt = (v) => {
    try {
      return v ? new Date(v).toLocaleString("ru-RU") : "—";
    } catch {
      return "—";
    }
  };

  const fp = (v) => `${Number(v || 0).toLocaleString("ru-RU")} сум`;
  const fh = (v) => {
    if (!v) return "—";
    const diff = Math.max(0, Date.now() - new Date(v).getTime());
    return `${Math.max(1, Math.floor(diff / 3600000))} ч назад`;
  };

  let csrf = $('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const s = {
    user: null,
    limits: {},
    slugs: [],
    card: null,
    requests: [],
    tags: [],
    buttons: [],
    theme: "default_dark",
    referrals: null,
    score: null,
    pricing: {
      premiumUpgradePrice: 80_000,
    },
    verification: null,
    analyticsBootstrap: null,
    analyticsPayload: null,
    analyticsSelectedSlug: "",
    analyticsSelectedPeriod: 7,
  };
  let scoreChart = null;
  let analyticsCharts = {};
  let modalLastFocused = null;
  let modalIsOpen = false;
  let modalConfirmHandler = null;
  let saveAlertTimer = null;

  const buttonTypeLabels = {
    phone: "Позвонить",
    telegram: "Telegram",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    website: "Сайт",
    whatsapp: "WhatsApp",
    email: "Email",
    other: "Другое",
  };

  const buttonTypeOptions = Object.entries(buttonTypeLabels);

  const el = {
    tabs: $$(".profile-tab-btn"),
    panels: $$(".profile-tab-panel"),
    welcomeBanner: $("#profile-welcome-banner"),
    welcomeDismiss: $("#profile-welcome-dismiss"),
    upg: $("#profile-upgrade-banner"),
    av: $("#profile-sidebar-avatar"),
    nm: $("#profile-sidebar-name"),
    un: $("#profile-sidebar-username"),
    pl: $("#profile-sidebar-plan"),
    ex: $("#profile-sidebar-expiry"),
    choosePlan: $("#profile-sidebar-choose-plan"),

    slugs: $("#profile-slugs-list"),
    addSlug: $("#profile-add-slug-btn"),
    addSlugNote: $("#profile-add-slug-note"),

    cAv: $("#profile-card-avatar-preview"),
    cAvFile: $("#profile-card-avatar-file"),
    cAvRemove: $("#profile-card-avatar-remove"),
    cAvCropWrap: $("#profile-card-avatar-crop-wrap"),
    cAvCropImage: $("#profile-card-avatar-crop-image"),
    cAvCropSave: $("#profile-card-avatar-crop-save"),
    cName: $("#profile-card-name"),
    cRole: $("#profile-card-role"),
    cBio: $("#profile-card-bio"),
    cBioC: $("#profile-card-bio-counter"),
    cHashtag: $("#profile-card-hashtag"),
    cAddress: $("#profile-card-address"),
    cPostcode: $("#profile-card-postcode"),
    cEmail: $("#profile-card-email"),
    cExtraPhone: $("#profile-card-extra-phone"),
    cTagInput: $("#profile-card-tag-input"),
    cTagAdd: $("#profile-card-tag-add"),
    cTags: $("#profile-card-tags-list"),
    cBtns: $("#profile-card-buttons-list"),
    cBtnAdd: $("#profile-card-button-add"),
    cThemes: $$(".profile-theme-btn"),
    cThemeLock: $("#profile-card-theme-lock-note"),
    cThemeWrap: $("#profile-card-theme-wrap"),
    cColor: $("#profile-card-custom-color"),
    cBranding: $("#profile-card-show-branding"),
    cSave: $("#profile-card-save"),
    cContent: $("#profile-card-content"),
    cEmpty: $("#profile-card-empty-state"),
    cPrev: $("#profile-card-live-preview"),
    cPrevLabel: $("#profile-preview-slug-label"),
    cPrevLink: $("#profile-preview-open-link"),
    scoreValue: $("#profile-score-value"),
    scoreTop: $("#profile-score-top"),
    scoreUpdated: $("#profile-score-updated"),
    scoreBreakdown: $("#profile-score-breakdown"),
    scoreTipsList: $("#profile-score-tips-list"),
    scoreHistoryChart: $("#profile-score-history-chart"),
    scoreHistoryLock: $("#profile-score-history-lock"),
    analyticsContent: $("#profile-analytics-content"),
    analyticsEmpty: $("#profile-analytics-empty-state"),
    analyticsSlug: $("#profile-analytics-slug"),
    analyticsPeriods: $("#profile-analytics-periods"),
    analyticsViews: $("#profile-analytics-views"),
    analyticsUnique: $("#profile-analytics-unique"),
    analyticsCtr: $("#profile-analytics-ctr"),
    analyticsViewsChart: $("#profile-analytics-views-chart"),
    analyticsSourcesChart: $("#profile-analytics-sources-chart"),
    analyticsDevicesChart: $("#profile-analytics-devices-chart"),
    analyticsButtonsChart: $("#profile-analytics-buttons-chart"),
    analyticsGeoChart: $("#profile-analytics-geo-chart"),
    analyticsLock: $("#profile-analytics-lock"),

    reqBanner: $("#profile-requests-banner"),
    reqTable: $("#profile-requests-table"),
    reqTableWrap: $("#profile-requests-table-wrap"),
    reqEmpty: $("#profile-requests-empty-state"),
    reqNewBtn: $("#profile-new-request-btn"),
    refLink: $("#profile-ref-link"),
    refCopy: $("#profile-ref-copy"),
    refTg: $("#profile-ref-tg"),
    refInvited: $("#profile-ref-stat-invited"),
    refPaid: $("#profile-ref-stat-paid"),
    refRewarded: $("#profile-ref-stat-rewarded"),
    refTable: $("#profile-ref-table"),
    refRewards: $("#profile-ref-rewards"),

    stName: $("#profile-settings-display-name"),
    stEmail: $("#profile-settings-email"),
    stTg: $("#profile-settings-telegram"),
    stChangeEmail: $("#profile-settings-change-email"),
    stChangePassword: $("#profile-settings-change-password"),
    stLinkTelegram: $("#profile-settings-link-telegram"),
    stUnlinkTelegram: $("#profile-settings-unlink-telegram"),
    stNotif: $("#profile-settings-notifications"),
    stDirectory: $("#profile-settings-directory"),
    stSave: $("#profile-settings-save"),
    stStatus: $("#profile-settings-status"),
    stDeact: $("#profile-settings-deactivate"),
    verificationStatus: $("#profile-verification-status"),
    verificationOpen: $("#profile-verification-open"),
    verificationModal: $("#profile-verification-modal"),
    verificationClose: $("#profile-verification-close"),
    verificationCompany: $("#profile-verification-company"),
    verificationRole: $("#profile-verification-role"),
    verificationProofType: $("#profile-verification-proof-type"),
    verificationProofValue: $("#profile-verification-proof-value"),
    verificationComment: $("#profile-verification-comment"),
    verificationSubmit: $("#profile-verification-submit"),
    qrModal: $("#profile-qr-modal"),
    qrClose: $("#profile-qr-close"),
    qrBox: $("#profile-qr-box"),
    qrLink: $("#profile-qr-link"),
    qrCopy: $("#profile-qr-copy"),
    qrDownloadPng: $("#profile-qr-download-png"),
    logout: $("#profile-logout-btn"),

    modal: $("#profile-modal"),
    modalDialog: $("#profile-modal-dialog"),
    modalTitle: $("#profile-modal-title"),
    modalText: $("#profile-modal-text"),
    modalOk: $("#profile-modal-confirm"),
    modalClose: $("#profile-modal-close"),
    modalCloseTop: $("#profile-modal-close-top"),
    cardNameError: $("#profile-card-name-error"),
  };

  let avatarCropper = null;

  const hasButtonLimit = () => Number.isFinite(s.limits?.buttons);
  const getButtonLimit = () => (hasButtonLimit() ? Number(s.limits.buttons) : Number.POSITIVE_INFINITY);
  const getTagLimit = () => (Number.isFinite(s.limits?.tags) ? Number(s.limits.tags) : 3);

  const api = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const response = await fetch(url, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.code = payload.code;
      throw error;
    }
    if (payload.csrfToken) {
      csrf = payload.csrfToken;
      $('meta[name="csrf-token"]')?.setAttribute("content", csrf);
    }
    return payload;
  };

  const closeModal = () => {
    if (!el.modal) return;
    el.modal.classList.add("hidden");
    el.modal.classList.remove("flex");
    document.body.classList.remove("modal-open");
    modalIsOpen = false;
    if (modalLastFocused instanceof HTMLElement) {
      modalLastFocused.focus();
    }
    if (el.modalOk && modalConfirmHandler) {
      el.modalOk.removeEventListener("click", modalConfirmHandler);
      modalConfirmHandler = null;
    }
  };

  const showModal = (title, text, confirmLabel, onConfirm) => {
    if (!el.modal || !el.modalTitle || !el.modalText || !el.modalOk) return;
    el.modalTitle.textContent = title;
    el.modalText.textContent = text;
    el.modalOk.textContent = confirmLabel || "Ок";
    modalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.modal.classList.remove("hidden");
    el.modal.classList.add("flex");
    document.body.classList.add("modal-open");
    modalIsOpen = true;
    requestAnimationFrame(() => {
      el.modalDialog?.focus();
    });

    if (el.modalOk && modalConfirmHandler) {
      el.modalOk.removeEventListener("click", modalConfirmHandler);
    }

    const once = () => {
      if (typeof onConfirm === "function") onConfirm();
      closeModal();
      modalConfirmHandler = null;
    };

    modalConfirmHandler = once;
    el.modalOk.addEventListener("click", once);
  };

  const showSaveAlert = (message) => {
    let node = document.getElementById("profile-save-success-alert");
    if (!(node instanceof HTMLElement)) {
      node = document.createElement("div");
      node.id = "profile-save-success-alert";
      node.className =
        "fixed bottom-4 right-4 z-[80] hidden rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.remove("hidden");
    if (saveAlertTimer) clearTimeout(saveAlertTimer);
    saveAlertTimer = setTimeout(() => {
      node?.classList.add("hidden");
    }, 2600);
  };

  const destroyCropper = () => {
    if (avatarCropper) {
      avatarCropper.destroy();
      avatarCropper = null;
    }
  };

  const hideAvatarCrop = () => {
    destroyCropper();
    if (el.cAvCropWrap) el.cAvCropWrap.classList.add("hidden");
    if (el.cAvCropImage) el.cAvCropImage.removeAttribute("src");
    if (el.cAvFile) el.cAvFile.value = "";
  };

  const currentTab = () => {
    const raw = (location.hash || "#slugs").replace("#", "");
    return ["slugs", "card", "analytics", "requests", "referrals", "settings"].includes(raw) ? raw : "slugs";
  };

  const setTab = () => {
    const active = currentTab();
    el.tabs.forEach((button) => {
      const on = button.getAttribute("data-tab-target") === active;
      button.classList.toggle("bg-neutral-900", on);
      button.classList.toggle("text-white", on);
    });
    el.panels.forEach((panel) => panel.classList.toggle("hidden", panel.getAttribute("data-tab-panel") !== active));
    if (active === "analytics") {
      void refreshAnalytics();
    }
  };

  const getCurrentPlan = () => s.user?.effectivePlan || "none";

  const stateIcon = (name) => {
    if (name === "shopping") {
      return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 8h12l-1.3 10.5a2 2 0 0 1-2 1.5H9.3a2 2 0 0 1-2-1.5L6 8Zm3-2a3 3 0 1 1 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (name === "credit-card") {
      return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
    if (name === "bar-chart-2") {
      return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10m8 10V4m8 16v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 20h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }
    if (name === "file-text") {
      return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3h6l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M10 12h6M10 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }
    return "";
  };

  const renderStateCard = ({ icon, title, text, buttonId, buttonLabel }) =>
    `<div class="mx-auto max-w-md text-center">${stateIcon(icon)}<h3 class="mt-4 text-lg font-bold text-neutral-900">${esc(title)}</h3><p class="mt-2 text-sm text-neutral-600">${esc(text)}</p><button id="${buttonId}" type="button" class="interactive-btn mt-5 min-h-11 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">${esc(buttonLabel)}</button></div>`;

  const renderWelcomeBanner = () => {
    if (!(el.welcomeBanner instanceof HTMLElement)) return;
    const show = getCurrentPlan() === "none" && !Boolean(s.user?.welcomeDismissed);
    el.welcomeBanner.classList.toggle("hidden", !show);
  };

  const renderSidebar = () => {
    if (!s.user) return;
    if (el.av) el.av.src = s.user.photoUrl || "/brand/logo.PNG";
    if (el.nm) el.nm.textContent = s.user.displayName || s.user.firstName || "UNQ+ User";
    if (el.un) el.un.textContent = s.user.username ? `@${s.user.username}` : "@—";
    const plan = s.user.plan || "none";
    if (el.pl) {
      el.pl.textContent = plan === "premium" ? "ПРЕМИУМ" : plan === "basic" ? "БАЗОВЫЙ" : "Тариф не выбран";
      el.pl.className = "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold";
      if (plan === "none") {
        el.pl.classList.add("border-neutral-300", "bg-neutral-100", "text-neutral-700");
      } else {
        el.pl.classList.add("border-neutral-300");
      }
    }
    if (el.ex) {
      el.ex.textContent = s.user.planPurchasedAt ? `Куплено: ${fd(s.user.planPurchasedAt)}` : "Куплено: —";
      if (s.user.planPurchasedAt) {
        el.ex.title = `Куплено ${fd(s.user.planPurchasedAt)}`;
      } else {
        el.ex.removeAttribute("title");
      }
    }
    if (el.choosePlan instanceof HTMLButtonElement) {
      el.choosePlan.classList.toggle("hidden", plan !== "none");
    }
    if (el.upg) {
      const upgradePrice = Number(s.pricing?.premiumUpgradePrice || 80_000).toLocaleString("ru-RU");
      const link = el.upg.querySelector('[data-order-link][data-order-plan="premium"]');
      const messageNode = el.upg.firstChild;
      if (messageNode && messageNode.nodeType === Node.TEXT_NODE) {
        messageNode.textContent = `Открыть Премиум · ${upgradePrice} сум единоразово. `;
      }
      if (link instanceof HTMLElement) {
        link.textContent = "Купить Премиум →";
      }
      el.upg.classList.toggle("hidden", plan !== "basic");
    }
  };

  const renderSlugs = () => {
    if (!el.slugs) return;
    const plan = getCurrentPlan();

    if (plan === "none") {
      if (el.addSlug instanceof HTMLButtonElement) {
        el.addSlug.classList.add("hidden");
      }
      if (el.addSlugNote) {
        el.addSlugNote.textContent = "";
      }
      el.slugs.innerHTML = renderStateCard({
        icon: "shopping",
        title: "Сначала выбери тариф",
        text: "Чтобы занять slug и создать визитку — купи Базовый или Премиум тариф.",
        buttonId: "profile-slugs-order-btn",
        buttonLabel: "Занять slug →",
      });
      return;
    }

    if (!s.slugs.length) {
      el.slugs.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Пока нет UNQ. Оставь заявку на главной.</div>';
    } else {
      const canUseQr = plan === "premium";
      const qrAction = canUseQr
        ? (slug) =>
            `<button data-a="open-qr" data-slug="${esc(slug)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Мой QR</button>`
        : () => "";

      el.slugs.innerHTML = s.slugs
        .map((slugItem) => {
          const statusLabel = slugItem.statusLabel || slugItem.status;
          const statusTone =
            slugItem.status === "active"
              ? "is-active"
              : slugItem.status === "paused"
                ? "is-paused"
                : slugItem.status === "private"
                  ? "is-private"
                  : "";

          return `<article class="interactive-card rounded-xl border border-neutral-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xl font-black">${esc(slugItem.fullSlug)}</p>
                <a href="/${encodeURIComponent(slugItem.fullSlug)}" target="_blank" class="text-sm text-neutral-500 hover:underline">unqx.uz/${esc(slugItem.fullSlug)}</a>
              </div>
              <div class="flex items-center gap-2">
                ${slugItem.isPrimary ? '<span class="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold">Основной</span>' : ""}
                <button data-a="cycle" data-slug="${esc(slugItem.fullSlug)}" data-st="${esc(slugItem.status)}" class="interactive-btn inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold"><span class="status-dot ${statusTone}" aria-hidden="true"></span>${statusLabel}</button>
              </div>
            </div>
            ${
              slugItem.status === "paused"
                ? `<div class="mt-3 flex gap-2"><input data-pm="${esc(slugItem.fullSlug)}" value="${esc(slugItem.pauseMessage || "")}" placeholder="Скоро вернусь · Пишите в Telegram" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"><button data-a="save-pm" data-slug="${esc(slugItem.fullSlug)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-3 py-2 text-sm">Сохранить</button></div>`
                : ""
            }
            <div class="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
              ${slugItem.isPrimary ? "" : `<button data-a="primary" data-slug="${esc(slugItem.fullSlug)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Сделать основным</button>`}
              ${qrAction(slugItem.fullSlug)}
              <span>${Number(slugItem.stats?.views || 0).toLocaleString("ru-RU")} просмотров</span>
              <span>с ${fd(slugItem.stats?.since || slugItem.createdAt)}</span>
            </div>
          </article>`;
        })
        .join("");
    }

    const count = s.slugs.length;

    if (el.addSlug && el.addSlugNote) {
      el.addSlug.classList.remove("hidden");
      if (plan !== "premium" && count >= 1) {
        el.addSlug.disabled = true;
        el.addSlug.textContent = "Доступно только на Премиум";
        const price = Number(s.pricing?.premiumUpgradePrice || 80_000).toLocaleString("ru-RU");
        el.addSlugNote.textContent = `Открыть Премиум · ${price} сум единоразово`;
      } else if (plan === "premium" && count >= 3) {
        el.addSlug.disabled = true;
        el.addSlug.textContent = "Добавить UNQ";
        el.addSlugNote.textContent = "Достигнут лимит 3 UNQ для Премиум тарифа";
      } else {
        el.addSlug.disabled = false;
        el.addSlug.textContent = "Добавить UNQ";
        el.addSlugNote.textContent = "";
      }
    }
  };

  const renderTags = () => {
    if (!el.cTags) return;
    el.cTags.innerHTML = s.tags
      .map(
        (tag, index) =>
          `<span class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs">${esc(tag)} <button data-a="rm-tag" data-i="${index}" class="text-neutral-500">x</button></span>`,
      )
      .join("");
  };

  const buttonRow = (button, index) => {
    const options = buttonTypeOptions
      .map(([value, label]) => `<option value="${value}" ${button.type === value ? "selected" : ""}>${label}</option>`)
      .join("");

    return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_1fr_auto]" data-bi="${index}">
      <select data-bf="type" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">${options}</select>
      <input data-bf="label" value="${esc(button.label || "")}" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <input data-bf="href" value="${esc(button.href || "")}" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <button data-a="rm-btn" data-i="${index}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Удалить</button>
    </div>`;
  };

  const renderButtons = () => {
    if (!el.cBtns) return;
    el.cBtns.innerHTML = s.buttons.map((button, index) => buttonRow(button, index)).join("");

    if (typeof Sortable !== "undefined" && !el.cBtns.dataset.sortable) {
      el.cBtns.dataset.sortable = "1";
      new Sortable(el.cBtns, {
        animation: 120,
        onEnd() {
          const rows = Array.from(el.cBtns.querySelectorAll("[data-bi]"));
          const next = [];
          rows.forEach((row) => {
            const i = Number(row.getAttribute("data-bi"));
            if (s.buttons[i]) next.push(s.buttons[i]);
          });
          s.buttons = next;
          renderButtons();
          renderPreview();
        },
      });
    }

    if (el.cBtnAdd) {
      const limit = getButtonLimit();
      const reached = Number.isFinite(limit) && s.buttons.length >= limit;
      el.cBtnAdd.disabled = reached;
      el.cBtnAdd.title = reached ? "Доступно на Премиум" : "";
    }
  };

  const renderTheme = () => {
    const premium = s.user?.effectivePlan === "premium";
    if (el.cThemeLock) el.cThemeLock.classList.toggle("hidden", premium);
    if (el.cThemeWrap) el.cThemeWrap.classList.toggle("opacity-60", !premium);

    el.cThemes.forEach((button) => {
      const on = button.getAttribute("data-theme") === s.theme;
      button.classList.toggle("bg-neutral-900", on);
      button.classList.toggle("text-white", on);
      button.disabled = !premium;
    });

    if (el.cColor) el.cColor.disabled = !premium;
    if (el.cBranding) el.cBranding.disabled = !premium;
  };

  function buildPreviewCardData() {
    const avatarUrl = String(el.cAv?.getAttribute("src") || "").trim();
    const primarySlug =
      s.slugs.find((item) => item.isPrimary) ||
      s.slugs.find((item) => ["active", "approved", "paused", "private"].includes(item.status)) ||
      s.slugs[0] ||
      null;
    const effectivePlan = getCurrentPlan() === "premium" ? "premium" : "basic";
    return {
      card: {
        slug: primarySlug?.fullSlug || "UNQ",
        name: el.cName?.value || s.user?.displayName || s.user?.firstName || "UNQ+ User",
        phone: "",
        hashtag: String(el.cHashtag?.value || "").trim(),
        address: String(el.cAddress?.value || "").trim(),
        postcode: String(el.cPostcode?.value || "").trim(),
        email: String(el.cEmail?.value || "").trim(),
        extraPhone: String(el.cExtraPhone?.value || "").trim(),
        avatarUrl: avatarUrl && !avatarUrl.includes("/brand/logo.PNG") ? avatarUrl : null,
        tags: (s.tags || []).map((tag) => ({ label: String(tag || "") })),
        buttons: (s.buttons || []).map((button) => ({
          type: String(button?.type || "other")
            .trim()
            .toLowerCase(),
          label: button?.label || "",
          url: String(button?.href || button?.value || "").trim(),
        })),
        tariff: effectivePlan,
        showBranding: el.cBranding ? !el.cBranding.checked : true,
      },
      primarySlug,
    };
  }

  const renderPreview = () => {
    if (!(el.cPrev instanceof HTMLElement) || typeof window.CardView === "undefined") return;
    const { card, primarySlug } = buildPreviewCardData();
    const slugLabel = primarySlug?.fullSlug || "[UNQ]";
    if (el.cPrevLabel) {
      el.cPrevLabel.textContent = `unqx.uz/${slugLabel}`;
    }
    if (el.cPrevLink) {
      el.cPrevLink.href = primarySlug ? `/${encodeURIComponent(primarySlug.fullSlug)}` : "#";
      el.cPrevLink.classList.toggle("pointer-events-none", !primarySlug);
      el.cPrevLink.classList.toggle("opacity-50", !primarySlug);
    }

    window.CardView.mountCardView(el.cPrev, card, {
      shareUrl: primarySlug ? `${location.origin}/${encodeURIComponent(primarySlug.fullSlug)}` : location.href,
      showPausedBanner: primarySlug?.status === "paused",
      pausedText: "Визитка на паузе — посетители видят заглушку",
      viewsLabel: `${Number(primarySlug?.stats?.views || 0).toLocaleString("ru-RU")} просмотров`,
    });
  };

  const renderCard = () => {
    const plan = getCurrentPlan();
    if (plan === "none") {
      if (el.cContent instanceof HTMLElement) el.cContent.classList.add("hidden");
      if (el.cEmpty instanceof HTMLElement) {
        el.cEmpty.classList.remove("hidden");
        el.cEmpty.innerHTML = renderStateCard({
          icon: "credit-card",
          title: "Визитка недоступна",
          text: "Создать визитку можно после покупки тарифа и активации slug.",
          buttonId: "profile-card-order-btn",
          buttonLabel: "Выбрать тариф →",
        });
      }
      return;
    }
    if (el.cContent instanceof HTMLElement) el.cContent.classList.remove("hidden");
    if (el.cEmpty instanceof HTMLElement) el.cEmpty.classList.add("hidden");

    const card = s.card || {};

    if (el.cAv) el.cAv.src = card.avatarUrl || s.user?.photoUrl || "/brand/logo.PNG";
    if (el.cName) el.cName.value = card.name || s.user?.displayName || s.user?.firstName || "";
    if (el.cRole) el.cRole.value = card.role || "";
    if (el.cBio) el.cBio.value = card.bio || "";
    if (el.cHashtag) el.cHashtag.value = card.hashtag || "";
    if (el.cAddress) el.cAddress.value = card.address || "";
    if (el.cPostcode) el.cPostcode.value = card.postcode || "";
    if (el.cEmail) el.cEmail.value = card.email || "";
    if (el.cExtraPhone) el.cExtraPhone.value = card.extraPhone || "";
    if (el.cColor) el.cColor.value = card.customColor || "#111111";
    if (el.cBranding) el.cBranding.checked = !card.showBranding;

    s.tags = Array.isArray(card.tags) ? card.tags.slice(0) : [];
    s.buttons = Array.isArray(card.buttons) ? card.buttons.slice(0) : [];
    s.theme = card.theme || "default_dark";

    if (el.cBioC) el.cBioC.textContent = `${el.cBio?.value.length || 0}/120`;

    renderTags();
    renderButtons();
    renderTheme();
    renderPreview();

  };

  const renderRequests = () => {
    if (!el.reqTable) return;
    const plan = getCurrentPlan();
    if (plan === "none" && !s.requests.length) {
      if (el.reqBanner) el.reqBanner.classList.add("hidden");
      if (el.reqTableWrap instanceof HTMLElement) el.reqTableWrap.classList.add("hidden");
      if (el.reqEmpty instanceof HTMLElement) {
        el.reqEmpty.classList.remove("hidden");
        el.reqEmpty.innerHTML = renderStateCard({
          icon: "file-text",
          title: "Заявок пока нет",
          text: "Подай заявку на slug чтобы начать.",
          buttonId: "profile-requests-order-btn",
          buttonLabel: "Занять slug →",
        });
      }
      return;
    }
    if (el.reqTableWrap instanceof HTMLElement) el.reqTableWrap.classList.remove("hidden");
    if (el.reqEmpty instanceof HTMLElement) el.reqEmpty.classList.add("hidden");

    el.reqTable.innerHTML = s.requests.length
      ? s.requests
          .map(
            (requestItem) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${fdt(requestItem.createdAt)}</td><td class="px-3 py-2">${requestItem.purchasedAt ? fdt(requestItem.purchasedAt) : "—"}</td><td class="px-3 py-2 font-mono">${esc(requestItem.slug)}</td><td class="px-3 py-2">${fp(Number(requestItem.slugPrice || 0) + Number(requestItem.planPrice || 0) + (requestItem.bracelet ? 300000 : 0))}<div class="text-[11px] text-neutral-500">${requestItem.purchasedAt ? `Единоразовая покупка · ${fd(requestItem.purchasedAt)}` : "Единоразовая покупка"}</div></td><td class="px-3 py-2">${requestItem.requestedPlan === "premium" ? "Премиум" : "Базовый"}</td><td class="px-3 py-2">${requestItem.bracelet ? "Да" : "Нет"}</td><td class="px-3 py-2">${esc(requestItem.statusBadge || requestItem.status)}</td><td class="px-3 py-2">${esc(requestItem.adminNote || "—")}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="8" class="px-3 py-8 text-center text-neutral-500">Заявок пока нет</td></tr>';

    const approved = s.requests.find((item) => item.status === "approved");
    const paid = s.requests.find((item) => item.status === "paid");
    const count = s.slugs.length;
    if (el.reqNewBtn instanceof HTMLButtonElement) {
      if (plan !== "premium" && count >= 1) {
        el.reqNewBtn.disabled = false;
        const price = Number(s.pricing?.premiumUpgradePrice || 80_000).toLocaleString("ru-RU");
        el.reqNewBtn.title = `Купить Премиум · ${price} сум единоразово`;
      } else if (plan === "premium" && count >= 3) {
        el.reqNewBtn.disabled = true;
        el.reqNewBtn.title = "Достигнут лимит 3 slug";
      } else {
        el.reqNewBtn.disabled = false;
        el.reqNewBtn.title = "";
      }
    }

    if (!el.reqBanner) return;

    if (approved && !s.card) {
      el.reqBanner.classList.remove("hidden");
      el.reqBanner.className = "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800";
      el.reqBanner.innerHTML = `Твой UNQ ${esc(approved.slug)} одобрен! Перейди во вкладку 'Моя визитка' чтобы создать карточку. <button data-a="goto-card" class="underline">Создать визитку</button>`;
      return;
    }

    if (paid) {
      el.reqBanner.classList.remove("hidden");
      el.reqBanner.className = "mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700";
      el.reqBanner.textContent = "Ожидаем оплату. Реквизиты отправлены в Telegram.";
      return;
    }

    el.reqBanner.classList.add("hidden");
  };

  const renderSettings = () => {
    if (!s.user) return;
    if (el.stName) el.stName.value = s.user.displayName || s.user.firstName || "";
    if (el.stEmail) el.stEmail.value = s.user.email || "";
    if (el.stTg) el.stTg.value = s.user.username ? `@${s.user.username}` : "";
    if (el.stNotif) el.stNotif.checked = Boolean(s.user.notificationsEnabled);
    if (el.stDirectory) el.stDirectory.checked = Boolean(s.user.showInDirectory);
    if (el.verificationStatus) {
      const latest = s.verification?.latestRequest;
      let label = "Статус: не запрошено";
      if (s.user.isVerified) {
        label = "Статус: верифицировано";
      } else if (latest?.status === "pending") {
        label = "Статус: на проверке";
      } else if (latest?.status === "rejected") {
        label = "Статус: отклонено";
      }
      el.verificationStatus.textContent = label;
    }
  };

  const renderReferrals = () => {
    const payload = s.referrals || {};
    if (el.refLink instanceof HTMLInputElement) {
      el.refLink.value = payload.refLink || "";
    }
    if (el.refTg instanceof HTMLAnchorElement) {
      const text = encodeURIComponent("Зарегистрируйся на UNQ+ по моей ссылке");
      const url = encodeURIComponent(payload.refLink || "");
      el.refTg.href = `tg://msg_url?url=${url}&text=${text}`;
    }
    if (el.refInvited) el.refInvited.textContent = String(payload.stats?.invited || 0);
    if (el.refPaid) el.refPaid.textContent = String(payload.stats?.paid || 0);
    if (el.refRewarded) el.refRewarded.textContent = String(payload.stats?.rewarded || 0);

    if (el.refTable) {
      const rows = Array.isArray(payload.referrals) ? payload.referrals : [];
      el.refTable.innerHTML = rows.length
        ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${esc(item.name || "UNQ+ User")}</td><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(item.status)}</td><td class="px-3 py-2">${esc(item.rewardType || "—")}</td></tr>`,
            )
            .join("")
        : '<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-500">Пока нет рефералов</td></tr>';
    }

    if (el.refRewards) {
      const rules = Array.isArray(payload.rewards) ? payload.rewards : [];
      el.refRewards.innerHTML = rules
        .map((rule) => {
          const statusLabel =
            rule.status === "received"
              ? "Получено"
              : rule.status === "available"
                ? "Доступно к получению"
                : "Ожидает";
          const claimButton =
            rule.status === "available"
              ? `<button data-a="claim-reward" data-rule="${rule.id}" class="interactive-btn mt-2 min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Забрать награду</button>`
              : "";
          return `<article class="rounded-xl border border-neutral-200 p-3"><p class="text-sm font-semibold">За ${rule.threshold} оплативших</p><p class="mt-1 text-sm text-neutral-600">${esc(rule.rewardLabel || "")}</p><p class="mt-2 text-xs text-neutral-500">${statusLabel}</p>${claimButton}</article>`;
        })
        .join("");
    }
  };

  const renderScore = () => {
    const score = s.score || {};
    const rows = [
      ["Просмотры", Number(score.scoreViews || 0), 300],
      ["Редкость slug", Number(score.scoreSlugRarity || 0), 200],
      ["Срок владения", Number(score.scoreTenure || 0), 150],
      ["Активность", Number(score.scoreCtr || 0), 200],
      ["Браслет", Number(score.scoreBracelet || 0), 100],
      ["Тариф", Number(score.scorePlan || 0), 49],
    ];
    if (el.scoreValue) el.scoreValue.textContent = String(Number(score.score || 0));
    if (el.scoreTop) el.scoreTop.textContent = `Топ ${Math.max(1, Number(score.topPercent || 100))}%`;
    if (el.scoreUpdated) el.scoreUpdated.textContent = `Обновлено ${fh(score.calculatedAt)}`;
    if (el.scoreBreakdown) {
      el.scoreBreakdown.innerHTML = rows
        .map(([label, value, max]) => {
          const width = Math.max(0, Math.min(100, (Number(value || 0) / Number(max || 1)) * 100));
          return `<div class="grid grid-cols-[150px_1fr_auto] items-center gap-2 text-sm">
              <span class="text-neutral-600">${esc(label)}</span>
              <span class="h-1.5 rounded-full bg-neutral-200"><span class="block h-1.5 rounded-full bg-neutral-900" style="width:${width.toFixed(2)}%"></span></span>
              <span class="text-xs text-neutral-500">${value} / ${max}</span>
            </div>`;
        })
        .join("");
    }

    const tips = [];
    if (Number(score.scoreBracelet || 0) === 0) {
      tips.push('<div class="flex items-center justify-between gap-2"><span>Добавь NFC-браслет — +100 к Score</span><button type="button" data-order-link data-order-bracelet="1" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Заказать браслет</button></div>');
    }
    if (Number(score.scorePlan || 0) === 0) {
      const price = Number(s.pricing?.premiumUpgradePrice || 80_000).toLocaleString("ru-RU");
      tips.push(`<div class="flex items-center justify-between gap-2"><span>Открыть Премиум · ${price} сум единоразово · +49 к Score</span><button type="button" data-order-link data-order-plan="premium" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Купить Премиум →</button></div>`);
    }
    if (Number(score.scoreViews || 0) < 150) tips.push("<p>Поделись визиткой чтобы получить больше просмотров</p>");
    if (Number(score.scoreTenure || 0) < 100) tips.push("<p>Score растёт каждый месяц автоматически</p>");
    if (Number(score.scoreCtr || 0) < 100) tips.push("<p>Добавь больше кнопок чтобы повысить активность</p>");
    if (el.scoreTipsList) {
      el.scoreTipsList.innerHTML = tips.length ? tips.join("") : "<p>Отличный прогресс. Поддерживай активность визитки.</p>";
    }

    const rawHistory = Array.isArray(score.history) ? score.history : [];
    const history =
      rawHistory.length > 0
        ? rawHistory
        : [
            {
              date: score.calculatedAt || new Date().toISOString(),
              score: Number(score.score || 0),
            },
          ];
    const labels = history.map((item) => {
      try {
        return new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
      } catch {
        return "";
      }
    });
    const values = history.map((item) => Number(item.score || 0));
    const isSinglePoint = values.length <= 1;
    if (scoreChart) {
      scoreChart.destroy();
      scoreChart = null;
    }
    if (el.scoreHistoryChart && typeof Chart !== "undefined") {
      scoreChart = new Chart(el.scoreHistoryChart, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              data: values,
              borderColor: "#111827",
              borderWidth: 2,
              tension: 0.25,
              pointRadius: isSinglePoint ? 3 : 0,
              pointHoverRadius: 4,
              pointBackgroundColor: "#111827",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 999, ticks: { stepSize: 200 } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
    const premium = s.user?.effectivePlan === "premium";
    if (el.scoreHistoryLock) {
      el.scoreHistoryLock.classList.toggle("hidden", premium);
    }
  };

  const destroyAnalyticsCharts = () => {
    Object.values(analyticsCharts).forEach((instance) => {
      if (instance && typeof instance.destroy === "function") {
        instance.destroy();
      }
    });
    analyticsCharts = {};
  };

  const buildChart = (canvas, config, key) => {
    if (!(canvas instanceof HTMLCanvasElement) || typeof Chart === "undefined") return;
    if (analyticsCharts[key] && typeof analyticsCharts[key].destroy === "function") {
      analyticsCharts[key].destroy();
    }
    analyticsCharts[key] = new Chart(canvas, config);
  };

  const renderAnalytics = () => {
    const plan = getCurrentPlan();
    if (plan === "none") {
      destroyAnalyticsCharts();
      if (el.analyticsContent instanceof HTMLElement) el.analyticsContent.classList.add("hidden");
      if (el.analyticsEmpty instanceof HTMLElement) {
        el.analyticsEmpty.classList.remove("hidden");
        el.analyticsEmpty.innerHTML = renderStateCard({
          icon: "bar-chart-2",
          title: "Нет данных",
          text: "Аналитика появится после активации визитки.",
          buttonId: "profile-analytics-order-btn",
          buttonLabel: "Выбрать тариф →",
        });
      }
      return;
    }
    if (el.analyticsContent instanceof HTMLElement) el.analyticsContent.classList.remove("hidden");
    if (el.analyticsEmpty instanceof HTMLElement) el.analyticsEmpty.classList.add("hidden");
    const payload = s.analyticsPayload;
    if (!payload) return;

    if (el.analyticsViews) el.analyticsViews.textContent = String(Number(payload.kpi?.views || 0));
    if (el.analyticsUnique) el.analyticsUnique.textContent = String(Number(payload.kpi?.uniqueVisitors || 0));
    if (el.analyticsCtr) el.analyticsCtr.textContent = `${Number(payload.kpi?.ctr || 0)}%`;
    if (el.analyticsLock) el.analyticsLock.classList.toggle("hidden", Boolean(payload.flags?.isPremium));

    const viewsByDay = Array.isArray(payload.chart?.viewsByDay) ? payload.chart.viewsByDay : [];
    const sourceEntries = Object.entries(payload.chart?.trafficSources || {});
    const deviceEntries = Object.entries(payload.chart?.devices || {});
    const buttonEntries = Object.entries(payload.chart?.buttonActivity || {});
    const geoEntries = Object.entries(payload.chart?.geography || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8);

    buildChart(
      el.analyticsViewsChart,
      {
        type: "line",
        data: {
          labels: viewsByDay.map((item) => item.date),
          datasets: [{ data: viewsByDay.map((item) => Number(item.value || 0)), borderColor: "#111827", borderWidth: 2, tension: 0.25 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      },
      "views",
    );
    buildChart(
      el.analyticsSourcesChart,
      {
        type: "doughnut",
        data: {
          labels: sourceEntries.map((item) => item[0]),
          datasets: [{ data: sourceEntries.map((item) => Number(item[1] || 0)), backgroundColor: ["#111827", "#374151", "#6b7280", "#d1d5db", "#9ca3af"] }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
      },
      "sources",
    );
    buildChart(
      el.analyticsDevicesChart,
      {
        type: "bar",
        data: {
          labels: deviceEntries.map((item) => item[0]),
          datasets: [{ data: deviceEntries.map((item) => Number(item[1] || 0)), backgroundColor: "#111827" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      },
      "devices",
    );
    buildChart(
      el.analyticsButtonsChart,
      {
        type: "bar",
        data: {
          labels: buttonEntries.map((item) => item[0]),
          datasets: [{ data: buttonEntries.map((item) => Number(item[1] || 0)), backgroundColor: "#374151" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      },
      "buttons",
    );
    buildChart(
      el.analyticsGeoChart,
      {
        type: "bar",
        data: {
          labels: geoEntries.map((item) => item[0]),
          datasets: [{ data: geoEntries.map((item) => Number(item[1] || 0)), backgroundColor: "#6b7280" }],
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      },
      "geo",
    );
  };

  const fillAnalyticsControls = () => {
    const bootstrap = s.analyticsBootstrap;
    if (!bootstrap) return;
    if (el.analyticsSlug instanceof HTMLSelectElement) {
      el.analyticsSlug.innerHTML = (Array.isArray(bootstrap.slugs) ? bootstrap.slugs : [])
        .map((item) => `<option value="${esc(item.fullSlug)}">${esc(item.fullSlug)} · ${esc(item.status || "")}</option>`)
        .join("");
      if (s.analyticsSelectedSlug) {
        el.analyticsSlug.value = s.analyticsSelectedSlug;
      }
    }
    if (el.analyticsPeriods instanceof HTMLElement) {
      const allowed = Array.isArray(bootstrap.periods) ? bootstrap.periods : [7];
      el.analyticsPeriods.innerHTML = [7, 30, 90]
        .map((period) => {
          const isAllowed = allowed.includes(period);
          const isActive = s.analyticsSelectedPeriod === period;
          return `<button type="button" data-analytics-period="${period}" class="interactive-btn rounded-lg border px-3 py-1.5 text-xs font-semibold ${isActive ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"} ${isAllowed ? "" : "opacity-50"}" ${isAllowed ? "" : "disabled"}>${period}д</button>`;
        })
        .join("");
    }
  };

  const refreshAnalytics = async () => {
    if (getCurrentPlan() === "none") return;
    if (!s.analyticsBootstrap) {
      try {
        s.analyticsBootstrap = await api("/api/profile/analytics/bootstrap");
        s.analyticsSelectedSlug = s.analyticsBootstrap.selectedSlug || s.analyticsBootstrap.slugs?.[0]?.fullSlug || "";
        s.analyticsSelectedPeriod = 7;
      } catch {
        s.analyticsBootstrap = { slugs: [], periods: [7] };
      }
    }
    fillAnalyticsControls();
    if (!s.analyticsSelectedSlug) {
      s.analyticsPayload = null;
      renderAnalytics();
      return;
    }
    try {
      s.analyticsPayload = await api(
        `/api/profile/analytics?slug=${encodeURIComponent(s.analyticsSelectedSlug)}&period=${encodeURIComponent(s.analyticsSelectedPeriod)}`,
      );
    } catch {
      s.analyticsPayload = null;
    }
    renderAnalytics();
  };

  const renderAll = () => {
    renderWelcomeBanner();
    renderSidebar();
    renderSlugs();
    renderCard();
    renderAnalytics();
    renderRequests();
    renderSettings();
    renderReferrals();
    renderScore();
  };

  const setLoading = (loading) => {
    el.panels.forEach((panel) => {
      panel.classList.toggle("opacity-60", loading);
      panel.classList.toggle("pointer-events-none", loading);
    });
    if (loading && el.slugs) {
      el.slugs.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Загрузка данных профиля...</div>';
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const payload = await api("/api/profile/bootstrap");
      s.user = payload.user || null;
      s.limits = payload.limits || {};
      s.slugs = payload.slugs || [];
      s.card = payload.card || null;
      s.requests = payload.requests || [];
      s.score = payload.score || null;
      s.pricing = payload.pricing || s.pricing;
      if (!s.slugs.find((item) => item.fullSlug === s.analyticsSelectedSlug)) {
        s.analyticsBootstrap = null;
        s.analyticsPayload = null;
        s.analyticsSelectedSlug = "";
      }
      try {
        s.referrals = await api("/api/referrals/bootstrap");
      } catch {
        s.referrals = null;
      }
      try {
        s.verification = await api("/api/profile/verification");
      } catch {
        s.verification = null;
      }
      renderAll();
    } catch (error) {
      if (error?.code === "AUTH_REQUIRED" || error?.code === "ACCOUNT_DISABLED") {
        location.replace("/");
        return;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const saveCard = async () => {
    if ((el.cName?.value || "").trim().length === 0) {
      if (el.cardNameError) {
        el.cardNameError.classList.remove("hidden");
      }
      showModal("Проверь поля", "Имя для визитки обязательно.");
      return;
    }
    if (el.cardNameError) {
      el.cardNameError.classList.add("hidden");
    }

    try {
      await api("/api/profile/card", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: el.cName?.value || "",
          role: el.cRole?.value || "",
          bio: el.cBio?.value || "",
          hashtag: el.cHashtag?.value || "",
          address: el.cAddress?.value || "",
          postcode: el.cPostcode?.value || "",
          email: el.cEmail?.value || "",
          extraPhone: el.cExtraPhone?.value || "",
          tags: s.tags,
          buttons: s.buttons,
          theme: s.theme,
          customColor: el.cColor?.value || null,
          showBranding: el.cBranding ? !el.cBranding.checked : true,
        }),
      });

      showSaveAlert("Успешно сохранено");
      await load();
    } catch (error) {
      if (error.code === "UPGRADE_REQUIRED") {
        showModal("Доступно на Премиум", "Эта функция доступна только для Премиум тарифа.");
        return;
      }
      showModal("Ошибка", error.message || "Не удалось сохранить визитку");
    }
  };

  const closeQrModal = () => {
    if (!(el.qrModal instanceof HTMLElement)) return;
    el.qrModal.classList.add("hidden");
    el.qrModal.classList.remove("flex");
    if (el.qrBox) el.qrBox.innerHTML = "";
  };

  const applyLogoToQrCanvas = async (canvas) => {
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

    const logo = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "/brand/logo.PNG";
    });
    if (!logo) return;

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
    ctx.drawImage(logo, x, y, size, size);
    ctx.restore();
  };

  const openQrModal = async (slug) => {
    if (getCurrentPlan() !== "premium") {
      showModal("Доступно на Премиум", "QR-код доступен только для Премиум тарифа.");
      return;
    }
    const payload = await api(`/api/profile/slugs/${encodeURIComponent(slug)}/qr`);
    if (!(el.qrModal instanceof HTMLElement)) return;
    el.qrModal.classList.remove("hidden");
    el.qrModal.classList.add("flex");
    if (el.qrLink) el.qrLink.textContent = payload.url || "";
    if (el.qrBox) {
      el.qrBox.innerHTML = "";
      if (typeof QRCode !== "undefined" && payload.url) {
        await new Promise((resolve) => {
          QRCode.toCanvas(payload.url, { width: 300, margin: 2, errorCorrectionLevel: "H" }, async (error, canvas) => {
            if (!error && canvas instanceof HTMLCanvasElement && el.qrBox) {
              await applyLogoToQrCanvas(canvas);
              el.qrBox.innerHTML = "";
              el.qrBox.appendChild(canvas);
            }
            resolve();
          });
        });
      }
    }
  };

  const cycleStatus = (status) => (status === "active" ? "paused" : status === "paused" ? "private" : "active");

  const uploadAvatarBlob = async (blob) => {
    const form = new FormData();
    form.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
    await api("/api/profile/card/avatar", {
      method: "POST",
      body: form,
    });
  };

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const action = target.getAttribute("data-a");

    try {
      if (action === "goto-card") {
        location.hash = "#card";
        return;
      }

      if (action === "rm-tag") {
        const index = Number(target.getAttribute("data-i"));
        if (!Number.isNaN(index)) {
          s.tags.splice(index, 1);
          renderTags();
          renderPreview();
        }
        return;
      }

      if (action === "rm-btn") {
        const index = Number(target.getAttribute("data-i"));
        if (!Number.isNaN(index)) {
          s.buttons.splice(index, 1);
          renderButtons();
          renderPreview();
        }
        return;
      }

      if (action === "open-qr") {
        const slug = target.getAttribute("data-slug");
        if (!slug) return;
        await openQrModal(slug);
        return;
      }

      if (action === "cycle") {
        const slug = target.getAttribute("data-slug");
        const status = target.getAttribute("data-st");
        if (!slug || !status) return;

        await api(`/api/profile/slugs/${encodeURIComponent(slug)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: cycleStatus(status) }),
        });
        await load();
        return;
      }

      if (action === "primary") {
        const slug = target.getAttribute("data-slug");
        if (!slug) return;
        await api(`/api/profile/slugs/${encodeURIComponent(slug)}/primary`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        await load();
        return;
      }

      if (action === "save-pm") {
        const slug = target.getAttribute("data-slug");
        if (!slug) return;
        const input = el.slugs?.querySelector(`[data-pm="${slug}"]`);
        await api(`/api/profile/slugs/${encodeURIComponent(slug)}/pause-message`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input instanceof HTMLInputElement ? input.value : "",
          }),
        });
        await load();
        return;
      }

      if (action === "claim-reward") {
        const ruleId = target.getAttribute("data-rule");
        if (!ruleId) return;
        await api(`/api/referrals/rewards/${encodeURIComponent(ruleId)}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        await load();
        return;
      }
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось выполнить действие");
    }
  });

  el.tabs.forEach((button) =>
    button.addEventListener("click", () => {
      location.hash = `#${button.getAttribute("data-tab-target") || "slugs"}`;
    }),
  );

  el.analyticsSlug?.addEventListener("change", () => {
    if (!(el.analyticsSlug instanceof HTMLSelectElement)) return;
    s.analyticsSelectedSlug = el.analyticsSlug.value;
    void refreshAnalytics();
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const periodButton = target.closest("[data-analytics-period]");
    if (!(periodButton instanceof HTMLElement)) return;
    const nextPeriod = Number(periodButton.getAttribute("data-analytics-period"));
    if (!Number.isFinite(nextPeriod)) return;
    s.analyticsSelectedPeriod = nextPeriod;
    void refreshAnalytics();
  });

  el.refCopy?.addEventListener("click", async () => {
    const value = el.refLink instanceof HTMLInputElement ? el.refLink.value : "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (el.refCopy) {
        el.refCopy.textContent = "Скопировано";
        setTimeout(() => {
          if (el.refCopy) el.refCopy.textContent = "Скопировать ссылку";
        }, 1200);
      }
    } catch {
      showModal("Ошибка", "Не удалось скопировать ссылку");
    }
  });

  window.addEventListener("hashchange", setTab);
  setTab();

  el.modalClose?.addEventListener("click", closeModal);
  el.modalCloseTop?.addEventListener("click", closeModal);
  el.modal?.addEventListener("click", (event) => {
    if (event.target === el.modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (!modalIsOpen) return;
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (event.key !== "Tab" || !(el.modalDialog instanceof HTMLElement)) return;
    const focusable = Array.from(
      el.modalDialog.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((item) => item instanceof HTMLElement && item.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      el.modalDialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  });

  el.addSlug?.addEventListener("click", () => {
    const plan = getCurrentPlan();
    const count = s.slugs.length;
    if (plan === "none") {
      if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
        window.UNQOrderModal.open({});
      }
      return;
    }

    if (plan === "premium" && count >= 3) {
      showModal("Лимит достигнут", "Достигнут лимит 3 UNQ для Премиум тарифа");
      return;
    }

    if (plan !== "premium" && count >= 1) {
      const upgradePrice = Number(s.pricing?.premiumUpgradePrice || 80_000).toLocaleString("ru-RU");
      showModal(
        "Нужен Премиум",
        `Открыть Премиум · ${upgradePrice} сум единоразово`,
        "Купить Премиум →",
        () => {
          if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
            window.UNQOrderModal.open({ plan: "premium" });
          }
        },
      );
      return;
    }
    if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
      window.UNQOrderModal.open({});
    }
  });

  el.reqNewBtn?.addEventListener("click", () => {
    const plan = getCurrentPlan();
    const count = s.slugs.length;
    if (plan === "none") {
      if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
        window.UNQOrderModal.open({});
      }
      return;
    }
    if (plan !== "premium" && count >= 1) {
      const upgradePrice = Number(s.pricing?.premiumUpgradePrice || 80_000).toLocaleString("ru-RU");
      showModal("Нужен Премиум", `Купить Премиум · ${upgradePrice} сум единоразово`);
      return;
    }
    if (plan === "premium" && count >= 3) {
      showModal("Лимит достигнут", "Достигнут лимит 3 slug");
      return;
    }
    if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
      window.UNQOrderModal.open({});
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (
      target.id === "profile-slugs-order-btn" ||
      target.id === "profile-card-order-btn" ||
      target.id === "profile-analytics-order-btn" ||
      target.id === "profile-requests-order-btn"
    ) {
      if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
        window.UNQOrderModal.open({});
      }
    }
  });

  el.welcomeDismiss?.addEventListener("click", async () => {
    try {
      await api("/api/profile/welcome-dismiss", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (s.user) {
        s.user.welcomeDismissed = true;
      }
      renderWelcomeBanner();
    } catch {
      renderWelcomeBanner();
    }
  });

  el.cBio?.addEventListener("input", () => {
    if (el.cBioC) el.cBioC.textContent = `${el.cBio.value.length}/120`;
    renderPreview();
  });

  el.cName?.addEventListener("input", () => {
    if (el.cardNameError && (el.cName?.value || "").trim().length > 0) {
      el.cardNameError.classList.add("hidden");
    }
    renderPreview();
  });
  el.cRole?.addEventListener("input", renderPreview);
  el.cColor?.addEventListener("input", renderPreview);
  el.cBranding?.addEventListener("change", renderPreview);
  el.cHashtag?.addEventListener("input", renderPreview);
  el.cAddress?.addEventListener("input", renderPreview);
  el.cPostcode?.addEventListener("input", renderPreview);
  el.cEmail?.addEventListener("input", renderPreview);
  el.cExtraPhone?.addEventListener("input", renderPreview);
  el.cSave?.addEventListener("click", saveCard);

  el.cTagAdd?.addEventListener("click", () => {
    const raw = el.cTagInput instanceof HTMLInputElement ? el.cTagInput.value.trim() : "";
    if (!raw) return;

    const limit = getTagLimit();
    if (s.tags.length >= limit) {
      showModal("Лимит тегов", `Можно добавить до ${limit} тегов.`);
      return;
    }

    s.tags.push((raw.startsWith("#") ? raw : `#${raw}`).slice(0, 32));
    if (el.cTagInput) el.cTagInput.value = "";
    renderTags();
    renderPreview();
  });

  el.cBtnAdd?.addEventListener("click", () => {
    const limit = getButtonLimit();
    if (Number.isFinite(limit) && s.buttons.length >= limit) {
      showModal("Лимит кнопок", "Для большего количества кнопок нужен Премиум.");
      return;
    }

    s.buttons.push({
      id: `${Date.now()}_${Math.random()}`,
      type: "other",
      label: buttonTypeLabels.other,
      href: "",
      value: "",
    });

    renderButtons();
    renderPreview();
  });

  el.cBtns?.addEventListener("input", (event) => {
    const node = event.target instanceof HTMLElement ? event.target : null;
    if (!node) return;

    const row = node.closest("[data-bi]");
    if (!(row instanceof HTMLElement)) return;

    const index = Number(row.getAttribute("data-bi"));
    if (!s.buttons[index]) return;

    const typeField = row.querySelector('[data-bf="type"]');
    const labelField = row.querySelector('[data-bf="label"]');
    const hrefField = row.querySelector('[data-bf="href"]');

    const prev = s.buttons[index];
    const type = typeField instanceof HTMLSelectElement ? typeField.value : "other";
    let label = labelField instanceof HTMLInputElement ? labelField.value : "";
    const href = hrefField instanceof HTMLInputElement ? hrefField.value : "";

    const previousDefault = buttonTypeLabels[prev.type] || "";
    const nextDefault = buttonTypeLabels[type] || "";
    if ((label || "").trim() === "" || label === previousDefault) {
      label = nextDefault;
      if (labelField instanceof HTMLInputElement) {
        labelField.value = label;
      }
    }

    s.buttons[index] = {
      ...prev,
      type,
      label,
      href,
      value: href,
    };

    renderPreview();
  });

  el.cThemes.forEach((button) =>
    button.addEventListener("click", () => {
      if (s.user?.effectivePlan !== "premium") return;
      s.theme = button.getAttribute("data-theme") || "default_dark";
      renderTheme();
      renderPreview();
    }),
  );

  el.cAvFile?.addEventListener("change", async () => {
    const file = el.cAvFile?.files && el.cAvFile.files[0];
    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      showModal("Ошибка", "Поддерживаются только PNG, JPG и WEBP");
      hideAvatarCrop();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (!(el.cAvCropImage instanceof HTMLImageElement) || !(el.cAvCropWrap instanceof HTMLElement)) return;

      el.cAvCropImage.src = String(reader.result || "");
      el.cAvCropWrap.classList.remove("hidden");

      destroyCropper();
      if (typeof Cropper !== "undefined") {
        avatarCropper = new Cropper(el.cAvCropImage, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 1,
          dragMode: "move",
          background: false,
          responsive: true,
          guides: false,
        });
      }
    };
    reader.onerror = () => showModal("Ошибка", "Не удалось прочитать файл");
    reader.readAsDataURL(file);
  });

  el.cAvCropSave?.addEventListener("click", async () => {
    if (!avatarCropper) return;

    try {
      const canvas = avatarCropper.getCroppedCanvas({
        width: 512,
        height: 512,
        imageSmoothingQuality: "high",
      });

      if (!canvas) {
        showModal("Ошибка", "Не удалось подготовить изображение");
        return;
      }

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.92);
      });

      if (!(blob instanceof Blob)) {
        showModal("Ошибка", "Не удалось сохранить изображение");
        return;
      }

      await uploadAvatarBlob(blob);
      hideAvatarCrop();
      await load();
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось загрузить аватар");
    }
  });

  el.cAvRemove?.addEventListener("click", async () => {
    try {
      await api("/api/profile/card/avatar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      hideAvatarCrop();
      await load();
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось удалить аватар");
    }
  });

  el.stSave?.addEventListener("click", async () => {
    if (!el.stStatus) return;
    el.stStatus.textContent = "";

    try {
      const payload = await api("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: el.stName?.value || "",
          telegramUsername: String(el.stTg?.value || "").replace(/^@+/, "").trim(),
          notificationsEnabled: Boolean(el.stNotif?.checked),
          showInDirectory: Boolean(el.stDirectory?.checked),
        }),
      });

      if (s.user) {
        s.user.displayName = payload.user.displayName;
        s.user.notificationsEnabled = payload.user.notificationsEnabled;
        s.user.showInDirectory = payload.user.showInDirectory;
      }

      renderSidebar();
      el.stStatus.textContent = "Сохранено";
      el.stStatus.className = "text-sm text-emerald-700";
    } catch (error) {
      el.stStatus.textContent = `${error.message}`;
      el.stStatus.className = "text-sm text-red-700";
    }
  });

  el.stDeact?.addEventListener("click", () => {
    showModal("Деактивировать аккаунт?", "Все твои UNQ станут недоступны", "Подтвердить", async () => {
      try {
        await api("/api/profile/deactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        location.href = "/";
      } catch (error) {
        if (el.stStatus) {
          el.stStatus.textContent = `${error.message}`;
          el.stStatus.className = "text-sm text-red-700";
        }
      }
    });
  });

  el.logout?.addEventListener("click", async () => {
    el.logout.disabled = true;
    try {
      await api("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      window.dispatchEvent(new CustomEvent("unqx:auth:logout"));
      location.href = "/login";
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось выйти");
      el.logout.disabled = false;
    }
  });

  el.stLinkTelegram?.addEventListener("click", async () => {
    try {
      const payload = await api("/api/profile/telegram/link/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (payload?.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось подготовить подключение Telegram");
    }
  });

  el.stUnlinkTelegram?.addEventListener("click", async () => {
    try {
      await api("/api/profile/telegram/link/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      showModal("Готово", "Telegram уведомления отключены", "Ок");
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось отключить Telegram");
    }
  });

  el.qrClose?.addEventListener("click", closeQrModal);
  el.qrModal?.addEventListener("click", (event) => {
    if (event.target === el.qrModal) closeQrModal();
  });
  el.qrCopy?.addEventListener("click", async () => {
    const value = el.qrLink?.textContent || "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showModal("Готово", "Ссылка скопирована");
    } catch {
      showModal("Ошибка", "Не удалось скопировать ссылку");
    }
  });
  el.qrDownloadPng?.addEventListener("click", () => {
    const canvas = el.qrBox?.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "unq-qr.png";
    link.click();
  });

  const closeVerificationModal = () => {
    if (!(el.verificationModal instanceof HTMLElement)) return;
    el.verificationModal.classList.add("hidden");
    el.verificationModal.classList.remove("flex");
  };
  el.verificationOpen?.addEventListener("click", () => {
    if (!(el.verificationModal instanceof HTMLElement)) return;
    el.verificationModal.classList.remove("hidden");
    el.verificationModal.classList.add("flex");
  });
  el.verificationClose?.addEventListener("click", closeVerificationModal);
  el.verificationModal?.addEventListener("click", (event) => {
    if (event.target === el.verificationModal) closeVerificationModal();
  });
  el.verificationSubmit?.addEventListener("click", async () => {
    try {
      await api("/api/profile/verification-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: el.verificationCompany?.value || "",
          role: el.verificationRole?.value || "",
          proofType: el.verificationProofType?.value || "email",
          proofValue: el.verificationProofValue?.value || "",
          comment: el.verificationComment?.value || "",
        }),
      });
      closeVerificationModal();
      await load();
      showModal("Готово", "Заявка на верификацию отправлена");
    } catch (error) {
      showModal("Ошибка", error.message || "Не удалось отправить заявку");
    }
  });

  load().catch((error) => showModal("Ошибка", error.message || "Не удалось загрузить профиль"));
})();

