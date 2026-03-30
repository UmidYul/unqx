(function () {
  let s = {};
  let csrf = null;
  (function () {
    const root = document.body;
    if (!root || root.getAttribute("data-page") !== "profile-page") return;
    const reactivationWindowDays = Math.max(1, Number(root.getAttribute("data-reactivation-window-days") || 30));

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const esc = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const toDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const fd = (value) => {
      const date = toDate(value);
      return date ? date.toLocaleDateString("ru-RU") : "—";
    };
    const fdt = (value) => {
      const date = toDate(value);
      return date ? date.toLocaleString("ru-RU") : "—";
    };
    const fp = (value) => `${Number(value || 0).toLocaleString("ru-RU")} сум`;
    const fh = (value) => {
      const date = toDate(value);
      return date
        ? date.toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        : "—";
    };
    const copyWithFallback = (value) => {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    };
    const copyText = async (value) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch {
        return copyWithFallback(value);
      }
      return copyWithFallback(value);
    };
    const PROFILE_THEMES = [
      "default_dark",
      "arctic",
      "linen",
      "marble",
      "forest",
      "sage_luxe",
      "midnight_obsidian",
      "golden_noir",
      "aurora_codex",
      "nebula_glass",
      "velours",
    ];
    const PREMIUM_ONLY_THEMES = new Set(PROFILE_THEMES.filter((theme) => theme !== "default_dark"));
    const TELEGRAM_PAYMENT_USERNAME = String(root.getAttribute("data-telegram-bot-username") || "")
      .replace(/^@+/, "")
      .trim();
    const DEFAULT_PROFILE_AVATAR = "/brand/profile-thin.svg";
    const DEFAULT_BRACELET_PRICE = 250000;

    const avatarSrc = (url) => {
      const base = String(url || "").trim() || DEFAULT_PROFILE_AVATAR;
      const version = Number(s.avatarVersion || 0);
      if (!version || base === DEFAULT_PROFILE_AVATAR) return base;
      const joiner = base.includes("?") ? "&" : "?";
      return `${base}${joiner}v=${version}`;
    };


    const DRAFT_KEY = "unqx_profile_card_draft";
    const DRAFT_CLOCK_SKEW_TOLERANCE_MS = 1000 * 60 * 60 * 6;

    const getDraftOwnerKey = () => {
      if (s.user?.id) return `id:${s.user.id}`;
      if (s.user?.login) return `l:${s.user.login}`;
      if (s.user?.username) return `u:${s.user.username}`;
      if (s.user?.email) return `e:${s.user.email}`;
      return "";
    };

    const getDraftStorageKey = () => {
      const ownerKey = getDraftOwnerKey();
      return ownerKey ? `${DRAFT_KEY}:${ownerKey}` : DRAFT_KEY;
    };

    function saveDraft() {
      const ownerKey = getDraftOwnerKey();
      if (!ownerKey) return;
      const draft = {
        ownerKey,
        name: el.cName?.value || "",
        bio: el.cBio?.value || "",
        hashtag: el.cHashtag?.value || "",
        address: el.cAddress?.value || "",
        postcode: el.cPostcode?.value || "",
        email: el.cEmail?.value || "",
        extraPhone: el.cExtraPhone?.value || "",
        tags: Array.isArray(s.tags) ? [...s.tags] : [],
        buttons: Array.isArray(s.buttons) ? JSON.parse(JSON.stringify(s.buttons)) : [],
        theme: s.theme,
        showBranding: el.cBranding ? !el.cBranding.checked : true,
        updatedAt: Date.now(),
      };
      localStorage.setItem(getDraftStorageKey(), JSON.stringify(draft));
    }

    function clearDraft() {
      const key = getDraftStorageKey();
      localStorage.removeItem(key);
      if (key !== DRAFT_KEY) {
        localStorage.removeItem(DRAFT_KEY);
      }
    }

    function readDraft() {
      const draftRaw = localStorage.getItem(getDraftStorageKey());
      if (!draftRaw) {
        const legacyRaw = localStorage.getItem(DRAFT_KEY);
        if (!legacyRaw) return null;
        try {
          const legacy = JSON.parse(legacyRaw);
          const ownerKey = getDraftOwnerKey();
          if (!legacy || typeof legacy !== "object") return null;
          if (legacy.ownerKey && ownerKey && legacy.ownerKey === ownerKey) return legacy;
          return null;
        } catch {
          return null;
        }
      }
      try {
        const draft = JSON.parse(draftRaw);
        return typeof draft === "object" && draft ? draft : null;
      } catch {
        return null;
      }
    }

    function isDraftNewerThanCard(draftUpdatedAt, cardUpdatedAt) {
      if (!draftUpdatedAt) return false;
      if (!cardUpdatedAt) return true;
      return draftUpdatedAt > cardUpdatedAt - DRAFT_CLOCK_SKEW_TOLERANCE_MS;
    }

    function hasPendingDraft() {
      const draft = readDraft();
      if (!draft) return false;
      const draftUpdatedAt = Number(draft.updatedAt || 0);
      const cardUpdatedAt = s.card?.updatedAt ? new Date(s.card.updatedAt).getTime() : 0;
      return isDraftNewerThanCard(draftUpdatedAt, cardUpdatedAt);
    }

    function restoreDraft() {
      if (!s.user) return;
      const draft = readDraft();
      if (!draft) return;
      const ownerKey = getDraftOwnerKey();
      if (draft.ownerKey && ownerKey && draft.ownerKey !== ownerKey) return;
      const cardUpdatedAt = s.card?.updatedAt ? new Date(s.card.updatedAt).getTime() : 0;
      const draftUpdatedAt = Number(draft.updatedAt || 0);
      if (!isDraftNewerThanCard(draftUpdatedAt, cardUpdatedAt)) return;
      if (draftUpdatedAt && s.draftRestoredAt && draftUpdatedAt <= s.draftRestoredAt) return;

      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(draft, key);
      if (el.cName && hasOwn("name")) el.cName.value = draft.name ?? "";
      if (el.cBio && hasOwn("bio")) el.cBio.value = draft.bio ?? "";
      if (el.cHashtag && hasOwn("hashtag")) el.cHashtag.value = draft.hashtag ?? "";
      if (el.cAddress && hasOwn("address")) el.cAddress.value = draft.address ?? "";
      if (el.cPostcode && hasOwn("postcode")) el.cPostcode.value = draft.postcode ?? "";
      if (el.cEmail && hasOwn("email")) el.cEmail.value = draft.email ?? "";
      if (el.cExtraPhone && hasOwn("extraPhone")) el.cExtraPhone.value = draft.extraPhone ?? "";
      if (Array.isArray(draft.tags)) s.tags = [...draft.tags];
      if (Array.isArray(draft.buttons)) s.buttons = JSON.parse(JSON.stringify(draft.buttons));
      if (typeof draft.theme === "string" && PROFILE_THEMES.includes(draft.theme)) s.theme = draft.theme;
      if (getCurrentPlan() !== "premium" && PREMIUM_ONLY_THEMES.has(s.theme)) {
        s.theme = "default_dark";
      }
      if (el.cBranding && hasOwn("showBranding")) el.cBranding.checked = draft.showBranding === false;
      if (el.cBioC) el.cBioC.textContent = `${el.cBio?.value.length || 0}/120`;

      s.draftRestoredAt = draftUpdatedAt || Date.now();
      renderTags && renderTags();
      renderButtons && renderButtons();
      renderTheme && renderTheme();
      renderPreview && renderPreview();
    }
    let scoreChart = null;
    let analyticsCharts = {};
    let modalLastFocused = null;
    let modalIsOpen = false;
    let modalConfirmHandler = null;
    let saveAlertTimer = null;
    let profileRefreshTimer = null;
    let profileRefreshInFlight = false;
    let braceletModalLastFocused = null;
    let braceletModalOpen = false;
    let emailModalLastFocused = null;
    let emailModalOpen = false;
    let emailModalStep = "request";
    let emailRequiredModalShown = false;
    let passwordModalLastFocused = null;
    let passwordModalOpen = false;
    let privatePasswordAddModalLastFocused = null;
    let privatePasswordAddModalOpen = false;
    let privatePasswordChangeModalLastFocused = null;
    let privatePasswordChangeModalOpen = false;
    let privatePasswordChangeId = "";
    const PROFILE_SAVE_SUCCESS_MESSAGE = "Изменения сохранены";

    const toOrderPaymentReference = (orderId) => `UNQX-${String(orderId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;

    const planLabel = (value) => {
      const plan = String(value || "").toLowerCase();
      return plan === "premium" || plan === "basic" ? "Премиум" : "Без тарифа";
    };

    const buildTelegramPaymentUrl = (requestItem) => {
      const serverUrl = String(requestItem?.paymentUrl || "").trim();
      if (/^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(serverUrl)) {
        return serverUrl;
      }
      const orderCode = toOrderPaymentReference(requestItem?.id);
      const slug = String(requestItem?.slug || "").toUpperCase();
      const slugPrice = Number(requestItem?.slugPrice || 0);
      const planPrice = Number(requestItem?.planPrice || 0);
      const braceletPrice = requestItem?.bracelet ? Number(requestItem?.braceletPrice || DEFAULT_BRACELET_PRICE) : 0;
      const total = Number(requestItem?.totalOneTime || slugPrice + planPrice + braceletPrice);
      const userName = String(s.user?.displayName || s.user?.firstName || "").trim() || "не указано";
      const userEmail = String(s.user?.email || "").trim() || "не указан";
      const message = `Здравствуйте! Хочу оплатить заказ #?? ${orderCode}\n\nUNQ: ${slug}\nФИО: ${userName}\nEmail: ${userEmail}\n\n?? Детализация оплаты:\n• UNQ ${slug}: ${Number(slugPrice).toLocaleString("ru-RU")} сум\n• Тариф ${planLabel(requestItem?.requestedPlan)}: ${Number(planPrice).toLocaleString("ru-RU")} сум\n• Браслет: ${Number(braceletPrice).toLocaleString("ru-RU")} сум\n\nИтого к оплате: ${Number(total).toLocaleString("ru-RU")} сум`;
      return `https://t.me/${TELEGRAM_PAYMENT_USERNAME}?text=${encodeURIComponent(message)}`;
    };

    const openTelegramUrl = (url) => {
      const fallbackUrl = `https://t.me/${TELEGRAM_PAYMENT_USERNAME}`;
      const telegramUrl = /^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(url || "") ? url : fallbackUrl;
      const [baseUrl, query = ""] = telegramUrl.split("?");
      const username = String(baseUrl.replace(/^https:\/\/t\.me\//i, "")).trim() || TELEGRAM_PAYMENT_USERNAME;
      const params = new URLSearchParams(query);
      const text = params.get("text");
      const tgAppUrl = `tg://resolve?domain=${encodeURIComponent(username)}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
      if (isMobile) {
        window.location.href = tgAppUrl;
        window.setTimeout(() => {
          window.location.href = telegramUrl;
        }, 900);
        return;
      }
      window.location.href = telegramUrl;
    };

    const buildPendingPaymentUrl = (order) => {
      const serverUrl = String(order?.paymentUrl || "").trim();
      if (/^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(serverUrl)) {
        return serverUrl;
      }
      const reference = String(order?.paymentReference || "").trim() || toOrderPaymentReference(order?.id);
      const slug = String(order?.slug || "").trim().toUpperCase();
      const slugPrice = Number(order?.slugPrice || 0);
      const planPrice = Number(order?.planPrice || 0);
      const braceletPrice = order?.bracelet ? Number(order?.braceletPrice || DEFAULT_BRACELET_PRICE) : 0;
      const total = Number(order?.totalOneTime || slugPrice + planPrice + braceletPrice);
      const userName = String(s.user?.displayName || s.user?.firstName || "").trim() || "не указано";
      const userEmail = String(s.user?.email || "").trim() || "не указан";
      const message = `Здравствуйте! Хочу оплатить заказ #?? ${reference}

UNQ: ${slug}
ФИО: ${userName}
Email: ${userEmail}

?? Детализация оплаты:
• UNQ ${slug}: ${Number(slugPrice).toLocaleString("ru-RU")} сум
• Тариф ${planLabel(order?.requestedPlan)}: ${Number(planPrice).toLocaleString("ru-RU")} сум
• Браслет: ${Number(braceletPrice).toLocaleString("ru-RU")} сум

Итого к оплате: ${Number(total).toLocaleString("ru-RU")} сум`;
      return `https://t.me/${TELEGRAM_PAYMENT_USERNAME}?text=${encodeURIComponent(message)}`;
    };

    const buttonTypeLabels = {
      phone: "Позвонить",
      telegram: "Telegram",
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      website: "Сайт",
      card: "Карта",
      whatsapp: "WhatsApp",
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
      hdrViews: $("#profile-header-stat-views"),
      hdrCards: $("#profile-header-stat-cards"),
      hdrCtr: $("#profile-header-stat-ctr"),

      slugs: $("#profile-slugs-list"),
      addSlug: $("#profile-add-slug-btn"),
      addSlugNote: $("#profile-add-slug-note"),
      slugsKpiViews: $("#profile-slugs-kpi-views"),
      slugsKpiUnique: $("#profile-slugs-kpi-unique"),
      slugsMiniBars: $("#profile-slugs-mini-bars"),
      slugsSourceBars: $("#profile-slugs-source-bars"),

      cAv: $("#profile-card-avatar-preview"),
      cAvFile: $("#profile-card-avatar-file"),
      cAvRemove: $("#profile-card-avatar-remove"),
      cAvCropWrap: $("#profile-card-avatar-crop-wrap"),
      cAvCropImage: $("#profile-card-avatar-crop-image"),
      cAvCropSave: $("#profile-card-avatar-crop-save"),
      cName: $("#profile-card-name"),
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
      reqMobileList: $("#profile-requests-mobile-list"),
      reqEmpty: $("#profile-requests-empty-state"),
      reqNewBtn: $("#profile-new-request-btn"),
      refLink: $("#profile-ref-link"),
      refCopy: $("#profile-ref-copy"),
      refTg: $("#profile-ref-tg"),
      refInvited: $("#profile-ref-stat-invited"),
      refPaid: $("#profile-ref-stat-paid"),
      refRewarded: $("#profile-ref-stat-rewarded"),
      refBonusBalance: $("#profile-ref-bonus-balance"),
      refBonusEarned: $("#profile-ref-bonus-earned"),
      refBonusSpent: $("#profile-ref-bonus-spent"),
      refTable: $("#profile-ref-table"),
      refRewards: $("#profile-ref-rewards"),
      refBonusHistory: $("#profile-ref-bonus-history"),
      refCampaigns: $("#profile-ref-campaigns"),
      refFraud: $("#profile-ref-fraud"),

      stName: $("#profile-settings-display-name"),
      stCity: $("#profile-settings-city"),
      stLogin: $("#profile-settings-login"),
      stEmail: $("#profile-settings-email"),
      stTg: $("#profile-settings-telegram"),
      stChangeEmail: $("#profile-settings-change-email"),
      stChangePassword: $("#profile-settings-change-password"),
      emailModal: $("#profile-email-modal"),
      emailModalDialog: $("#profile-email-modal-dialog"),
      emailModalCloseTop: $("#profile-email-modal-close-top"),
      emailModalCancel: $("#profile-email-modal-cancel"),
      emailModalStepRequest: $("#profile-email-modal-step-request"),
      emailModalStepVerify: $("#profile-email-modal-step-verify"),
      emailModalPending: $("#profile-email-modal-pending"),
      emailModalError: $("#profile-email-modal-error"),
      emailModalErrorVerify: $("#profile-email-modal-error-verify"),
      emailModalSubmit: $("#profile-email-modal-submit"),
      emailModalVerify: $("#profile-email-modal-verify"),
      emailModalBack: $("#profile-email-modal-back"),
      emailNewEmail: $("#profile-email-new-email"),
      emailCurrentPassword: $("#profile-email-current-password"),
      emailVerifyCode: $("#profile-email-verify-code"),
      emailRequiredModal: $("#profile-email-required-modal"),
      emailRequiredClose: $("#profile-email-required-close"),
      emailRequiredLater: $("#profile-email-required-later"),
      emailRequiredOpen: $("#profile-email-required-open"),
      passwordModal: $("#profile-password-modal"),
      passwordModalDialog: $("#profile-password-modal-dialog"),
      passwordModalCloseTop: $("#profile-password-modal-close-top"),
      passwordModalClose: $("#profile-password-modal-close"),
      passwordModalError: $("#profile-password-modal-error"),
      passwordModalSubmit: $("#profile-password-modal-submit"),
      passwordCurrent: $("#profile-password-current"),
      passwordNew: $("#profile-password-new"),
      passwordConfirm: $("#profile-password-confirm"),
      stLinkTelegram: $("#profile-settings-link-telegram"),
      stUnlinkTelegram: $("#profile-settings-unlink-telegram"),
      stNotif: $("#profile-settings-notifications"),
      stDirectory: $("#profile-settings-directory"),
      privatePasswordOpenAdd: $("#profile-private-password-open-add"),
      privatePasswordsList: $("#profile-private-passwords-list"),
      privatePasswordAddModal: $("#profile-private-password-add-modal"),
      privatePasswordAddDialog: $("#profile-private-password-add-dialog"),
      privatePasswordAddCloseTop: $("#profile-private-password-add-close-top"),
      privatePasswordAddCancel: $("#profile-private-password-add-cancel"),
      privatePasswordAddSubmit: $("#profile-private-password-add-submit"),
      privatePasswordAddLabel: $("#profile-private-password-add-label"),
      privatePasswordAddValue: $("#profile-private-password-add-value"),
      privatePasswordAddError: $("#profile-private-password-add-error"),
      privatePasswordChangeModal: $("#profile-private-password-change-modal"),
      privatePasswordChangeDialog: $("#profile-private-password-change-dialog"),
      privatePasswordChangeCloseTop: $("#profile-private-password-change-close-top"),
      privatePasswordChangeCancel: $("#profile-private-password-change-cancel"),
      privatePasswordChangeSubmit: $("#profile-private-password-change-submit"),
      privatePasswordChangeOld: $("#profile-private-password-change-old"),
      privatePasswordChangeNew: $("#profile-private-password-change-new"),
      privatePasswordChangeMeta: $("#profile-private-password-change-meta"),
      privatePasswordChangeError: $("#profile-private-password-change-error"),
      stSave: $("#profile-settings-save"),
      stStatus: $("#profile-settings-status"),
      stDeact: $("#profile-settings-deactivate"),
      verificationStatus: $("#profile-verification-status"),
      verificationNote: $("#profile-verification-note"),
      verificationOpen: $("#profile-verification-open"),
      verificationModal: $("#profile-verification-modal"),
      verificationClose: $("#profile-verification-close"),
      verificationCompany: $("#profile-verification-company"),
      verificationRole: $("#profile-verification-role"),
      verificationSector: $("#profile-verification-sector"),
      verificationProofType: $("#profile-verification-proof-type"),
      verificationProofValue: $("#profile-verification-proof-value"),
      verificationComment: $("#profile-verification-comment"),
      verificationSubmit: $("#profile-verification-submit"),
      verificationCorrectionWrap: $("#profile-verification-correction-wrap"),
      verificationCorrection: $("#profile-verification-correction"),
      verificationCorrectionSubmit: $("#profile-verification-correction-submit"),
      qrModal: $("#profile-qr-modal"),
      qrClose: $("#profile-qr-close"),
      qrBox: $("#profile-qr-box"),
      qrLink: $("#profile-qr-link"),
      qrCopy: $("#profile-qr-copy"),
      qrDownloadPng: $("#profile-qr-download-png"),
      logout: $("#profile-logout-btn"),

      braceletModal: $("#profile-bracelet-modal"),
      braceletModalDialog: $("#profile-bracelet-modal-dialog"),
      braceletModalPrice: $("#profile-bracelet-modal-price"),
      braceletModalSubmit: $("#profile-bracelet-modal-submit"),
      braceletModalClose: $("#profile-bracelet-modal-close"),
      braceletModalCloseTop: $("#profile-bracelet-modal-close-top"),

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

    const initCsrfFromMeta = () => {
      if (csrf) return;
      const token = $('meta[name="csrf-token"]')?.getAttribute("content") || "";
      if (token) csrf = token;
    };

    const refreshCsrfToken = async () => {
      try {
        const response = await fetch("/api/auth/me", { method: "GET" });
        const payload = await response.json().catch(() => ({}));
        if (payload.csrfToken) {
          csrf = payload.csrfToken;
          $('meta[name="csrf-token"]')?.setAttribute("content", csrf);
        }
      } catch {
        // best effort
      }
    };

    const api = async (url, options = {}) => {
      initCsrfFromMeta();
      const headers = { ...(options.headers || {}) };
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const { _csrfRetried, ...fetchOptions } = options;
      const response = await fetch(url, { ...fetchOptions, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorText = String(payload.error || "").toLowerCase();
        if (!_csrfRetried && errorText.includes("invalid csrf token")) {
          await refreshCsrfToken();
          return api(url, { ...options, _csrfRetried: true });
        }
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

    const uploadAvatarBlob = async (blob) => {
      const form = new FormData();
      form.append("file", blob, "avatar.webp");
      return api("/api/profile/card/avatar", {
        method: "POST",
        body: form,
      });
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

    const setEmailModalError = (message) => {
      if (!el.emailModalError) return;
      const value = String(message || "").trim();
      el.emailModalError.textContent = value;
      el.emailModalError.classList.toggle("hidden", !value);
    };

    const setEmailModalVerifyError = (message) => {
      if (!el.emailModalErrorVerify) return;
      const value = String(message || "").trim();
      el.emailModalErrorVerify.textContent = value;
      el.emailModalErrorVerify.classList.toggle("hidden", !value);
    };

    const setPasswordModalError = (message) => {
      if (!el.passwordModalError) return;
      const value = String(message || "").trim();
      el.passwordModalError.textContent = value;
      el.passwordModalError.classList.toggle("hidden", !value);
    };

    const setPrivatePasswordAddError = (message) => {
      if (!(el.privatePasswordAddError instanceof HTMLElement)) return;
      const value = String(message || "").trim();
      el.privatePasswordAddError.textContent = value;
      el.privatePasswordAddError.classList.toggle("hidden", !value);
    };

    const setPrivatePasswordChangeError = (message) => {
      if (!(el.privatePasswordChangeError instanceof HTMLElement)) return;
      const value = String(message || "").trim();
      el.privatePasswordChangeError.textContent = value;
      el.privatePasswordChangeError.classList.toggle("hidden", !value);
    };

    const resetPrivatePasswordAddModal = () => {
      if (el.privatePasswordAddLabel instanceof HTMLInputElement) el.privatePasswordAddLabel.value = "";
      if (el.privatePasswordAddValue instanceof HTMLInputElement) el.privatePasswordAddValue.value = "";
      setPrivatePasswordAddError("");
      if (el.privatePasswordAddSubmit instanceof HTMLButtonElement) {
        el.privatePasswordAddSubmit.disabled = false;
      }
    };

    const openPrivatePasswordAddModal = () => {
      if (!(el.privatePasswordAddModal instanceof HTMLElement)) return;
      const limit = Number.isFinite(Number(s.privatePasswordLimit)) ? Number(s.privatePasswordLimit) : 10;
      const passwords = Array.isArray(s.privatePasswords) ? s.privatePasswords : [];
      if (passwords.length >= limit) {
        showModal("Лимит достигнут", `Доступно максимум ${limit} паролей.`);
        return;
      }
      resetPrivatePasswordAddModal();
      privatePasswordAddModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.privatePasswordAddModal.classList.remove("hidden");
      el.privatePasswordAddModal.classList.add("flex");
      privatePasswordAddModalOpen = true;
      requestAnimationFrame(() => {
        if (el.privatePasswordAddLabel instanceof HTMLInputElement) {
          el.privatePasswordAddLabel.focus();
        }
      });
    };

    const closePrivatePasswordAddModal = () => {
      if (!(el.privatePasswordAddModal instanceof HTMLElement)) return;
      el.privatePasswordAddModal.classList.add("hidden");
      el.privatePasswordAddModal.classList.remove("flex");
      privatePasswordAddModalOpen = false;
      if (privatePasswordAddModalLastFocused instanceof HTMLElement) {
        privatePasswordAddModalLastFocused.focus();
      }
    };

    const resetPrivatePasswordChangeModal = () => {
      privatePasswordChangeId = "";
      if (el.privatePasswordChangeOld instanceof HTMLInputElement) el.privatePasswordChangeOld.value = "";
      if (el.privatePasswordChangeNew instanceof HTMLInputElement) el.privatePasswordChangeNew.value = "";
      if (el.privatePasswordChangeMeta instanceof HTMLElement) el.privatePasswordChangeMeta.textContent = "";
      setPrivatePasswordChangeError("");
      if (el.privatePasswordChangeSubmit instanceof HTMLButtonElement) {
        el.privatePasswordChangeSubmit.disabled = false;
      }
    };

    const openPrivatePasswordChangeModal = (passwordId) => {
      if (!(el.privatePasswordChangeModal instanceof HTMLElement)) return;
      const id = String(passwordId || "").trim();
      if (!id) return;
      const passwords = Array.isArray(s.privatePasswords) ? s.privatePasswords : [];
      const item = passwords.find((candidate) => String(candidate?.id || "") === id);
      if (!item) {
        showModal("Ошибка", "Пароль не найден.");
        return;
      }
      resetPrivatePasswordChangeModal();
      privatePasswordChangeId = id;
      const label = String(item?.label || "").trim() || "Без метки";
      if (el.privatePasswordChangeMeta instanceof HTMLElement) {
        el.privatePasswordChangeMeta.textContent = `Метка: ${label}`;
      }
      privatePasswordChangeModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.privatePasswordChangeModal.classList.remove("hidden");
      el.privatePasswordChangeModal.classList.add("flex");
      privatePasswordChangeModalOpen = true;
      requestAnimationFrame(() => {
        if (el.privatePasswordChangeOld instanceof HTMLInputElement) {
          el.privatePasswordChangeOld.focus();
        }
      });
    };

    const closePrivatePasswordChangeModal = () => {
      if (!(el.privatePasswordChangeModal instanceof HTMLElement)) return;
      el.privatePasswordChangeModal.classList.add("hidden");
      el.privatePasswordChangeModal.classList.remove("flex");
      privatePasswordChangeModalOpen = false;
      resetPrivatePasswordChangeModal();
      if (privatePasswordChangeModalLastFocused instanceof HTMLElement) {
        privatePasswordChangeModalLastFocused.focus();
      }
    };

    const setEmailModalStep = (step) => {
      const nextStep = step === "verify" ? "verify" : "request";
      emailModalStep = nextStep;
      if (el.emailModalStepRequest) {
        el.emailModalStepRequest.classList.toggle("hidden", nextStep !== "request");
      }
      if (el.emailModalStepVerify) {
        el.emailModalStepVerify.classList.toggle("hidden", nextStep !== "verify");
      }
    };

    const resetEmailModal = () => {
      if (el.emailNewEmail instanceof HTMLInputElement) el.emailNewEmail.value = "";
      if (el.emailCurrentPassword instanceof HTMLInputElement) el.emailCurrentPassword.value = "";
      if (el.emailVerifyCode instanceof HTMLInputElement) el.emailVerifyCode.value = "";
      if (el.emailModalPending) el.emailModalPending.textContent = "";
      setEmailModalError("");
      setEmailModalVerifyError("");
      setEmailModalStep("request");
      if (el.emailModalSubmit instanceof HTMLButtonElement) el.emailModalSubmit.disabled = false;
      if (el.emailModalVerify instanceof HTMLButtonElement) el.emailModalVerify.disabled = false;
    };

    const openEmailModal = () => {
      if (!(el.emailModal instanceof HTMLElement)) return;
      resetEmailModal();
      emailModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.emailModal.classList.remove("hidden");
      el.emailModal.classList.add("flex");
      emailModalOpen = true;
      requestAnimationFrame(() => {
        if (el.emailNewEmail instanceof HTMLInputElement) el.emailNewEmail.focus();
      });
    };

    const closeEmailModal = () => {
      if (!(el.emailModal instanceof HTMLElement)) return;
      el.emailModal.classList.add("hidden");
      el.emailModal.classList.remove("flex");
      emailModalOpen = false;
      if (emailModalLastFocused instanceof HTMLElement) {
        emailModalLastFocused.focus();
      }
    };

    const openEmailRequiredModal = () => {
      if (!(el.emailRequiredModal instanceof HTMLElement)) return;
      el.emailRequiredModal.classList.remove("hidden");
      el.emailRequiredModal.classList.add("flex");
      emailRequiredModalShown = true;
    };

    const closeEmailRequiredModal = () => {
      if (!(el.emailRequiredModal instanceof HTMLElement)) return;
      el.emailRequiredModal.classList.add("hidden");
      el.emailRequiredModal.classList.remove("flex");
    };

    const resetPasswordModal = () => {
      if (el.passwordCurrent instanceof HTMLInputElement) el.passwordCurrent.value = "";
      if (el.passwordNew instanceof HTMLInputElement) el.passwordNew.value = "";
      if (el.passwordConfirm instanceof HTMLInputElement) el.passwordConfirm.value = "";
      setPasswordModalError("");
      if (el.passwordModalSubmit instanceof HTMLButtonElement) el.passwordModalSubmit.disabled = false;
    };

    const openPasswordModal = () => {
      if (!(el.passwordModal instanceof HTMLElement)) return;
      resetPasswordModal();
      passwordModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.passwordModal.classList.remove("hidden");
      el.passwordModal.classList.add("flex");
      passwordModalOpen = true;
      requestAnimationFrame(() => {
        if (el.passwordCurrent instanceof HTMLInputElement) el.passwordCurrent.focus();
      });
    };

    const closePasswordModal = () => {
      if (!(el.passwordModal instanceof HTMLElement)) return;
      el.passwordModal.classList.add("hidden");
      el.passwordModal.classList.remove("flex");
      passwordModalOpen = false;
      if (passwordModalLastFocused instanceof HTMLElement) {
        passwordModalLastFocused.focus();
      }
    };

    const handleEmailRequest = async () => {
      const email = String(el.emailNewEmail?.value || "").trim();
      const currentPassword = String(el.emailCurrentPassword?.value || "");
      setEmailModalError("");

      if (!email) {
        setEmailModalError("Введите новый email.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailModalError("Введите корректный email.");
        return;
      }
      if (!currentPassword) {
        setEmailModalError("Введите текущий пароль.");
        return;
      }

      if (el.emailModalSubmit instanceof HTMLButtonElement) {
        el.emailModalSubmit.disabled = true;
      }
      try {
        const payload = await api("/api/auth/change-email/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, currentPassword }),
        });
        const pendingEmail = String(payload?.pendingEmail || email).trim();
        if (el.emailModalPending) {
          el.emailModalPending.textContent = pendingEmail
            ? `Код отправлен на ${pendingEmail}.`
            : "Код отправлен на ваш email.";
        }
        setEmailModalStep("verify");
        requestAnimationFrame(() => {
          if (el.emailVerifyCode instanceof HTMLInputElement) el.emailVerifyCode.focus();
        });
      } catch (error) {
        setEmailModalError(error.message || "Не удалось отправить код");
      } finally {
        if (el.emailModalSubmit instanceof HTMLButtonElement) {
          el.emailModalSubmit.disabled = false;
        }
      }
    };

    const handleEmailVerify = async () => {
      const rawCode = String(el.emailVerifyCode?.value || "");
      const code = rawCode.replace(/\D/g, "").slice(0, 6);
      if (el.emailVerifyCode instanceof HTMLInputElement) {
        el.emailVerifyCode.value = code;
      }
      setEmailModalVerifyError("");
      if (!code) {
        setEmailModalVerifyError("Введите код из письма.");
        return;
      }
      if (el.emailModalVerify instanceof HTMLButtonElement) {
        el.emailModalVerify.disabled = true;
      }
      try {
        const verified = await api("/api/auth/change-email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (verified?.user && s.user) {
          s.user = { ...s.user, ...verified.user };
        }
        renderSettings();
        closeEmailModal();
        showModal("Готово", "Email обновлён.");
      } catch (error) {
        setEmailModalVerifyError(error.message || "Не удалось подтвердить email");
      } finally {
        if (el.emailModalVerify instanceof HTMLButtonElement) {
          el.emailModalVerify.disabled = false;
        }
      }
    };

    const handlePasswordChange = async () => {
      const currentPassword = String(el.passwordCurrent?.value || "");
      const newPassword = String(el.passwordNew?.value || "");
      const confirmPassword = String(el.passwordConfirm?.value || "");
      setPasswordModalError("");

      if (!currentPassword) {
        setPasswordModalError("Введите текущий пароль.");
        return;
      }
      if (newPassword.length < 8) {
        setPasswordModalError("Пароль должен быть минимум 8 символов.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordModalError("Пароли не совпадают.");
        return;
      }

      if (el.passwordModalSubmit instanceof HTMLButtonElement) {
        el.passwordModalSubmit.disabled = true;
      }
      try {
        await api("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        closePasswordModal();
        showModal("Готово", "Пароль обновлён.");
      } catch (error) {
        setPasswordModalError(error.message || "Не удалось изменить пароль");
      } finally {
        if (el.passwordModalSubmit instanceof HTMLButtonElement) {
          el.passwordModalSubmit.disabled = false;
        }
      }
    };

    const handlePrivatePasswordAdd = async () => {
      const password = String(el.privatePasswordAddValue?.value || "").trim();
      const label = String(el.privatePasswordAddLabel?.value || "").trim();
      const minLength = Number.isFinite(Number(s.privatePasswordMinLength)) ? Number(s.privatePasswordMinLength) : 4;
      setPrivatePasswordAddError("");

      if (password.length < minLength) {
        setPrivatePasswordAddError(`Минимальная длина пароля: ${minLength} символа.`);
        return;
      }

      if (el.privatePasswordAddSubmit instanceof HTMLButtonElement) {
        el.privatePasswordAddSubmit.disabled = true;
      }
      try {
        await api("/api/profile/privacy/passwords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, password }),
        });
        closePrivatePasswordAddModal();
        await refreshPrivateAccessData();
        showSaveAlert("Пароль добавлен");
      } catch (error) {
        setPrivatePasswordAddError(error.message || "Не удалось добавить пароль");
      } finally {
        if (el.privatePasswordAddSubmit instanceof HTMLButtonElement) {
          el.privatePasswordAddSubmit.disabled = false;
        }
      }
    };

    const handlePrivatePasswordChange = async () => {
      const passwordId = String(privatePasswordChangeId || "").trim();
      if (!passwordId) {
        setPrivatePasswordChangeError("Пароль не найден.");
        return;
      }
      const oldPassword = String(el.privatePasswordChangeOld?.value || "").trim();
      const newPassword = String(el.privatePasswordChangeNew?.value || "").trim();
      const minLength = Number.isFinite(Number(s.privatePasswordMinLength)) ? Number(s.privatePasswordMinLength) : 4;
      setPrivatePasswordChangeError("");

      if (!oldPassword) {
        setPrivatePasswordChangeError("Введите текущий пароль.");
        return;
      }
      if (newPassword.length < minLength) {
        setPrivatePasswordChangeError(`Новый пароль должен быть минимум ${minLength} символа.`);
        return;
      }

      if (el.privatePasswordChangeSubmit instanceof HTMLButtonElement) {
        el.privatePasswordChangeSubmit.disabled = true;
      }
      try {
        await api(`/api/profile/privacy/passwords/${encodeURIComponent(passwordId)}/change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        closePrivatePasswordChangeModal();
        await refreshPrivateAccessData();
        showSaveAlert("Пароль обновлён");
      } catch (error) {
        setPrivatePasswordChangeError(error.message || "Не удалось сменить пароль");
      } finally {
        if (el.privatePasswordChangeSubmit instanceof HTMLButtonElement) {
          el.privatePasswordChangeSubmit.disabled = false;
        }
      }
    };

    const closeBraceletModal = () => {
      if (!(el.braceletModal instanceof HTMLElement)) return;
      el.braceletModal.classList.add("hidden");
      el.braceletModal.classList.remove("flex");
      braceletModalOpen = false;
      if (braceletModalLastFocused instanceof HTMLElement) {
        braceletModalLastFocused.focus();
      }
    };

    const openBraceletModal = () => {
      if (!(el.braceletModal instanceof HTMLElement)) return;
      const priceValue = Number(s.pricing?.braceletPrice || DEFAULT_BRACELET_PRICE);
      if (el.braceletModalPrice instanceof HTMLElement) {
        el.braceletModalPrice.textContent = `${priceValue.toLocaleString("ru-RU")} сум`;
      }
      braceletModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.braceletModal.classList.remove("hidden");
      el.braceletModal.classList.add("flex");
      braceletModalOpen = true;
      requestAnimationFrame(() => {
        el.braceletModalDialog?.focus();
      });
    };

    const showSaveAlert = (message) => {
      let node = document.getElementById("profile-save-success-alert");
      if (!(node instanceof HTMLElement)) {
        node = document.createElement("div");
        node.id = "profile-save-success-alert";
        node.setAttribute("role", "status");
        node.setAttribute("aria-live", "polite");
        document.body.appendChild(node);
      }
      node.className = "";
      node.style.position = "fixed";
      node.style.right = "16px";
      node.style.bottom = "16px";
      node.style.zIndex = "9999";
      node.style.pointerEvents = "none";
      node.style.maxWidth = "min(92vw, 420px)";
      node.style.border = "1px solid #6ee7b7";
      node.style.borderRadius = "12px";
      node.style.background = "#ecfdf5";
      node.style.padding = "12px 14px";
      node.style.color = "#065f46";
      node.style.fontSize = "14px";
      node.style.fontWeight = "600";
      node.style.boxShadow = "0 10px 30px rgba(6, 95, 70, 0.18)";
      node.style.opacity = "0";
      node.style.transform = "translateY(10px) scale(0.98)";
      node.style.transition = "opacity 180ms ease, transform 180ms ease";
      node.style.display = "block";
      node.style.visibility = "visible";
      node.textContent = message;
      node.style.opacity = "1";
      node.style.transform = "translateY(0) scale(1)";
      if (saveAlertTimer) clearTimeout(saveAlertTimer);
      saveAlertTimer = setTimeout(() => {
        if (!node) return;
        node.style.opacity = "0";
        node.style.transform = "translateY(10px) scale(0.98)";
        window.setTimeout(() => {
          if (!node) return;
          node.style.visibility = "hidden";
        }, 180);
      }, 4000);
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
      return ["slugs", "card", "analytics", "requests", "settings"].includes(raw) ? raw : "slugs";
    };

    const setTab = () => {
      const active = currentTab();
      el.tabs.forEach((button) => {
        const on = button.getAttribute("data-tab-target") === active;
        button.classList.toggle("profile-tab-btn--active", on);
      });
      el.panels.forEach((panel) => panel.classList.toggle("hidden", panel.getAttribute("data-tab-panel") !== active));
      // Не вызываем load() или renderAll() при переключении вкладок, чтобы не сбрасывать прогресс
      // Только для вкладки аналитики подгружаем данные
      if (active === "card") {
        restoreDraft();
      }
      if (active === "analytics") {
        void refreshAnalytics();
      }
    };

    const getCurrentPlan = () => {
      const raw = String(s.user?.effectivePlan || s.user?.plan || "none")
        .trim()
        .toLowerCase();
      return raw === "premium" ? "premium" : "none";
    };

    const normalizeCardVisibilityStatus = (status) => {
      const normalized = String(status || "")
        .trim()
        .toLowerCase();
      if (normalized === "paused") return "paused";
      if (normalized === "private") return "private";
      return "active";
    };

    const cardVisibilityLabel = (status) => {
      const normalized = normalizeCardVisibilityStatus(status);
      if (normalized === "paused") return "Пауза";
      if (normalized === "private") return "Приватная";
      return "Активная";
    };

    const cardVisibilityTone = (status) => {
      const normalized = normalizeCardVisibilityStatus(status);
      if (normalized === "paused") return "is-paused";
      if (normalized === "private") return "is-private";
      return "is-active";
    };

    const resolveCardVisibility = () => {
      const slugItems = Array.isArray(s.slugs) ? s.slugs : [];
      if (!slugItems.length) {
        return { status: "active", mixed: false };
      }

      const normalizedStatuses = slugItems.map((item) => normalizeCardVisibilityStatus(item?.status));
      const uniqueStatuses = Array.from(new Set(normalizedStatuses));
      const primarySlug = slugItems.find((item) => item?.isPrimary) || slugItems[0];
      const primaryStatus = normalizeCardVisibilityStatus(primarySlug?.status);
      return {
        status: primaryStatus,
        mixed: uniqueStatuses.length > 1,
      };
    };

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
      if (el.av) {
        const sidebarAvatar = s.card?.avatarUrl || s.user.photoUrl;
        el.av.src = avatarSrc(sidebarAvatar);
      }
      if (el.nm) el.nm.textContent = s.user.displayName || s.user.firstName || "UNQX User";
      if (el.un) el.un.textContent = s.user.username ? `@${s.user.username}` : "@—";
      const plan = getCurrentPlan();
      if (el.pl) {
        el.pl.dataset.plan = plan;
        el.pl.textContent = plan === "premium" ? "PREMIUM" : "No plan";
        el.pl.className = "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold";
        if (plan === "none") {
          el.pl.classList.add("border-neutral-300", "bg-neutral-100", "text-neutral-700");
        } else {
          el.pl.classList.add("border-neutral-300");
        }
      }
      if (el.ex) {
        const expiresAt = s.subscription?.expiresAt || s.user.subscriptionExpiresAt || null;
        const isActive = plan === "premium";
        el.ex.classList.remove("hidden");
        el.ex.textContent = isActive
          ? (expiresAt ? `Active until: ${fd(expiresAt)}` : "Subscription active")
          : "Subscription inactive";
        if (isActive && expiresAt) {
          el.ex.title = `Subscription active until ${fd(expiresAt)}`;
        } else {
          el.ex.removeAttribute("title");
        }
      }
      if (el.choosePlan instanceof HTMLButtonElement) {
        el.choosePlan.classList.toggle("hidden", plan !== "none");
      }
      if (el.upg) {
        const link = el.upg.querySelector('[data-order-link][data-order-plan="premium"]');
        const messageNode = el.upg.firstChild;
        if (messageNode && messageNode.nodeType === Node.TEXT_NODE) {
          messageNode.textContent = "Renew Premium - $2/month. ";
        }
        if (link instanceof HTMLElement) {
          link.textContent = "Renew Premium >";
        }
        el.upg.classList.toggle("hidden", plan !== "none");
      }
    };

    const renderHeaderStats = () => {
      const slugItems = Array.isArray(s.slugs) ? s.slugs : [];
      const totalViews = slugItems.reduce((sum, item) => sum + Number(item?.stats?.views || 0), 0);
      const cardsCount = slugItems.length;
      const ctrRaw = Number(s.analyticsPayload?.kpi?.ctr || 0);
      const unique = Number(s.analyticsPayload?.kpi?.uniqueVisitors || 0);
      const bestViews = Math.max(
        1,
        ...slugItems.map((item) => Number(item?.stats?.views || 0)),
      );
      const bars = slugItems.length
        ? slugItems.slice(0, 8).map((item) => {
          const ratio = Math.max(0.15, Number(item?.stats?.views || 0) / bestViews);
          return `<span class="${ratio > 0.75 ? "is-active" : ""}" style="height:${Math.round(ratio * 44)}px"></span>`;
        })
        : ['<span style="height:14px"></span>', '<span style="height:20px"></span>', '<span class="is-active" style="height:34px"></span>', '<span style="height:18px"></span>'];

      if (el.hdrViews) el.hdrViews.textContent = Number(totalViews).toLocaleString("ru-RU");
      if (el.hdrCards) el.hdrCards.textContent = String(cardsCount);
      if (el.hdrCtr) el.hdrCtr.textContent = `${Number(ctrRaw).toLocaleString("ru-RU")}%`;
      if (el.slugsKpiViews) el.slugsKpiViews.textContent = Number(totalViews).toLocaleString("ru-RU");
      if (el.slugsKpiUnique) el.slugsKpiUnique.textContent = Number(unique).toLocaleString("ru-RU");
      if (el.slugsMiniBars) el.slugsMiniBars.innerHTML = bars.join("");
      if (el.slugsSourceBars) {
        const sources = Object.entries(s.analyticsPayload?.chart?.trafficSources || {}).slice(0, 3);
        if (sources.length) {
          const total = Math.max(1, sources.reduce((sum, entry) => sum + Number(entry[1] || 0), 0));
          el.slugsSourceBars.innerHTML = sources
            .map((entry) => {
              const width = Math.max(8, Math.round((Number(entry[1] || 0) / total) * 100));
              return `<div class="source-track"><div class="source-fill" style="width:${width}%"></div></div>`;
            })
            .join("");
        } else {
          el.slugsSourceBars.innerHTML = '<div class="source-track"><div class="source-fill" style="width:60%"></div></div><div class="source-track"><div class="source-fill" style="width:36%"></div></div><div class="source-track"><div class="source-fill" style="width:22%"></div></div>';
        }
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
          title: "Activate Premium first",
          text: "To reserve UNQ and publish your card, activate Premium.",
          buttonId: "profile-slugs-order-btn",
          buttonLabel: "Activate Premium >",
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
        const visibility = resolveCardVisibility();
        const primarySlug = s.slugs.find((item) => item?.isPrimary) || s.slugs[0];
        const pauseMessage = String(primarySlug?.pauseMessage || "");
        const controls = `
          <article class="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-neutral-900">Статус визитки</p>
                <p class="mt-1 text-xs text-neutral-500">Выбранный статус применяется сразу ко всем вашим UNQ.</p>
              </div>
              ${visibility.mixed ? '<span class="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Разные статусы у UNQ</span>' : ""}
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              ${["active", "paused", "private"]
            .map((status) => {
              const isActive = visibility.status === status && !visibility.mixed;
              const statusLabel = cardVisibilityLabel(status);
              const statusTone = cardVisibilityTone(status);
              return `<button data-a="card-status" data-status="${status}" class="interactive-btn inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${isActive ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-900"}"><span class="status-dot ${statusTone}" aria-hidden="true"></span>${statusLabel}</button>`;
            })
            .join("")}
            </div>
            ${visibility.status === "paused"
            ? `<div class="mt-3 flex gap-2"><input data-card-pm value="${esc(pauseMessage)}" placeholder="Скоро вернусь · Пишите в Telegram" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"><button data-a="save-card-pm" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-3 py-2 text-sm">Сохранить сообщение</button></div>`
            : ""}
          </article>
        `;

        const slugCards = s.slugs
          .map((slugItem) => {
            const isPaused = normalizeCardVisibilityStatus(slugItem.status) === "paused";

            return `<article class="interactive-card rounded-xl border border-neutral-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xl font-black">${esc(slugItem.fullSlug)}</p>
                <a href="/${encodeURIComponent(slugItem.fullSlug)}" target="_blank" class="text-sm text-neutral-500 hover:underline">unqx.uz/${esc(slugItem.fullSlug)}</a>
              </div>
              <div class="flex items-center gap-2">
                ${slugItem.isPrimary ? '<span class="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold">Основной</span>' : ""}
              </div>
            </div>
            ${isPaused && slugItem.pauseMessage
                ? `<p class="mt-3 text-xs text-neutral-500">Сообщение паузы: ${esc(slugItem.pauseMessage)}</p>`
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

        el.slugs.innerHTML = `${controls}${slugCards}`;
      }

      const count = s.slugs.length;

      if (el.addSlug && el.addSlugNote) {
        el.addSlug.classList.remove("hidden");
        if (plan !== "premium" && count >= 1) {
          el.addSlug.disabled = true;
          el.addSlug.textContent = "Premium required";
          el.addSlugNote.textContent = "Renew Premium - $2/month";
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
      // Always use 'url' for editing; initialize from href/value if needed
      const url = typeof button.url === 'string' && button.url.length > 0
        ? button.url
        : (typeof button.href === 'string' && button.href.length > 0
          ? button.href
          : (typeof button.value === 'string' ? button.value : ''));
      const selectedType = Object.prototype.hasOwnProperty.call(buttonTypeLabels, button.type) ? button.type : "other";
      const options = buttonTypeOptions
        .map(([value, label]) => `<option value="${value}" ${selectedType === value ? "selected" : ""}>${label}</option>`)
        .join("");

      return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_1fr_auto]" data-bi="${index}">
      <select data-bf="type" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">${options}</select>
      <input data-bf="label" value="${esc(button.label || "")}" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <input data-bf="href" value="${esc(url)}" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <button data-a="rm-btn" data-i="${index}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" aria-label="Удалить">×</button>
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
      const premium = getCurrentPlan() === "premium";
      console.log('[renderTheme] premium:', premium, 'user:', s.user);
      if (el.cThemeLock) el.cThemeLock.classList.toggle("hidden", premium);
      if (el.cThemeWrap) el.cThemeWrap.classList.toggle("opacity-60", !premium);

      el.cThemes.forEach((button) => {
        const on = button.getAttribute("data-theme") === s.theme;
        const themeId = button.getAttribute("data-theme") || "default_dark";
        const premiumOnly = PREMIUM_ONLY_THEMES.has(themeId);
        const locked = !premium && premiumOnly;
        console.log('[renderTheme] themeId:', themeId, 'premiumOnly:', premiumOnly, 'locked:', locked);
        button.classList.toggle("bg-neutral-900", on);
        button.classList.toggle("text-white", on);
        button.disabled = locked;
        const swatchNode = button.querySelector("[data-theme-swatch]");
        if (swatchNode instanceof HTMLElement) {
          swatchNode.style.boxShadow = on
            ? "0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(17, 24, 39, 0.35)"
            : "none";
          swatchNode.style.transform = on ? "scale(1.06)" : "scale(1)";
          swatchNode.style.transition = "transform 140ms ease, box-shadow 140ms ease";
        }
        const lockNode = button.querySelector("[data-theme-lock]");
        if (lockNode instanceof HTMLElement) {
          // Hide lock for premium users, show only if not premium and locked
          console.log('[renderTheme] lockNode for', themeId, 'hidden:', premium || !locked, 'inline-flex:', !premium && locked);
          lockNode.classList.toggle("hidden", premium || !locked);
          lockNode.classList.toggle("inline-flex", !premium && locked);
          // Force hide for premium users
          if (premium) {
            lockNode.style.display = 'none';
          } else if (!premium && locked) {
            lockNode.style.display = 'flex';
          } else {
            lockNode.style.display = '';
          }
        }
      });

      if (el.cBranding) el.cBranding.disabled = !premium;
    };

    function buildPreviewCardData() {
      const avatarUrl = String(el.cAv?.getAttribute("src") || "").trim();
      const slugs = Array.isArray(s.slugs) ? s.slugs : [];
      const primarySlug =
        slugs.find((item) => item.isPrimary) ||
        slugs.find((item) => ["active", "approved", "paused", "private"].includes(item.status)) ||
        slugs[0] ||
        null;
      const effectivePlan = getCurrentPlan() === "premium" ? "premium" : "none";
      const effectiveTheme =
        effectivePlan === "premium" && PROFILE_THEMES.includes(s.theme) ? s.theme : "default_dark";
      return {
        card: {
          slug: primarySlug?.fullSlug || "UNQ",
          name: el.cName?.value || s.user?.displayName || s.user?.firstName || "UNQX User",
          role:
            Boolean(s.user?.isVerified) &&
              String(s.verification?.latestRequest?.status || "").toLowerCase() === "approved"
              ? String(s.verification?.latestRequest?.role || "").trim()
              : "",
          phone: "",
          hashtag: String(el.cHashtag?.value || "").trim(),
          address: String(el.cAddress?.value || "").trim(),
          postcode: String(el.cPostcode?.value || "").trim(),
          email: String(el.cEmail?.value || "").trim(),
          extraPhone: String(el.cExtraPhone?.value || "").trim(),
          avatarUrl: avatarUrl && !avatarUrl.includes(DEFAULT_PROFILE_AVATAR) ? avatarUrl : null,
          tags: (s.tags || []).map((tag) => ({ label: String(tag || "") })),
          buttons: (s.buttons || []).map((button) => ({
            type: String(button?.type || "other")
              .trim()
              .toLowerCase(),
            label: button?.label || "",
            url: String(button?.href || button?.value || "").trim(),
          })),
          verified: Boolean(s.user?.isVerified),
          verifiedCompany: String(s.user?.verifiedCompany || "").trim(),
          tariff: effectivePlan,
          theme: effectiveTheme,
          showBranding: el.cBranding ? !el.cBranding.checked : true,
          bio: String(el.cBio?.value || "").trim(),
        },
        primarySlug,
      };
    }

    const renderPreview = () => {
      if (!(el.cPrev instanceof HTMLElement) || typeof window.CardView === "undefined") return;
      const { card, primarySlug } = buildPreviewCardData();
      el.cPrev.dataset.previewTheme = String(card.theme || "default_dark");
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
        pausedText: "Визитка на паузе - посетители видят заглушку",
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
            text: "Создать визитку можно после покупки тарифа и активации UNQ.",
            buttonId: "profile-card-order-btn",
            buttonLabel: "Выбрать тариф >",
          });
        }
        return;
      }
      if (el.cContent instanceof HTMLElement) el.cContent.classList.remove("hidden");
      if (el.cEmpty instanceof HTMLElement) el.cEmpty.classList.add("hidden");

      const card = s.card || {};

      if (el.cAv) el.cAv.src = avatarSrc(card.avatarUrl || s.user?.photoUrl);
      if (el.cName) el.cName.value = card.name || s.user?.displayName || s.user?.firstName || "";
      if (el.cBio) el.cBio.value = card.bio || "";
      if (el.cHashtag) el.cHashtag.value = card.hashtag || "";
      if (el.cAddress) el.cAddress.value = card.address || "";
      if (el.cPostcode) el.cPostcode.value = card.postcode || "";
      if (el.cEmail) el.cEmail.value = card.email || "";
      if (el.cExtraPhone) el.cExtraPhone.value = card.extraPhone || "";
      if (el.cBranding) el.cBranding.checked = card.showBranding === false;

      s.tags = Array.isArray(card.tags) ? card.tags.slice(0) : [];
      // Normalize all button objects to always have 'url' for editing
      s.buttons = Array.isArray(card.buttons)
        ? card.buttons.map((b) => {
          const urlValue =
            typeof b.url === "string" && b.url.length > 0
              ? b.url
              : typeof b.href === "string" && b.href.length > 0
                ? b.href
                : typeof b.value === "string"
                  ? b.value
                  : "";
          return {
            ...b,
            href: typeof b.href === "string" && b.href.length > 0 ? b.href : urlValue,
            value: typeof b.value === "string" && b.value.length > 0 ? b.value : urlValue,
            url: urlValue,
          };
        })
        : [];
      s.theme = PROFILE_THEMES.includes(card.theme) ? card.theme : "default_dark";
      if (plan !== "premium" && PREMIUM_ONLY_THEMES.has(s.theme)) {
        s.theme = "default_dark";
      }

      if (el.cBioC) el.cBioC.textContent = `${el.cBio?.value.length || 0}/120`;

      renderTags();
      renderButtons();
      renderTheme();
      renderPreview();

    };

    const renderRequests = () => {
      if (!el.reqTable) return;
      const getOrderProgress = (requestItem) => {
        const status = String(requestItem?.status || "").trim().toLowerCase();
        const progressMap = { new: 1, contacted: 2, paid: 3, approved: 4 };
        const done = Number(progressMap[status] || 0);
        const labels = ["Создан", "Связались", "Оплачено", "Активирован"];

        if (status === "rejected" || status === "expired") {
          const failLabel = status === "rejected" ? "Отклонен" : "Истек";
          return `<div class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">${failLabel}</div>`;
        }

        const steps = labels
          .map((label, index) => {
            const step = index + 1;
            const isDone = done >= step;
            return `<div class="flex items-center gap-1.5 ${index > 0 ? "ml-2" : ""}">
            ${index > 0 ? `<span class="h-px w-5 ${done >= step ? "bg-emerald-500" : "bg-neutral-300"}"></span>` : ""}
            <span class="h-2.5 w-2.5 rounded-full ${isDone ? "bg-emerald-500" : "bg-neutral-300"}"></span>
            <span class="text-[10px] ${isDone ? "text-neutral-800" : "text-neutral-500"}">${label}</span>
          </div>`;
          })
          .join("");

        return `<div class="min-w-[260px]"><div class="flex items-center">${steps}</div></div>`;
      };

      const plan = getCurrentPlan();
      if (plan === "none" && !s.requests.length) {
        if (el.reqBanner) el.reqBanner.classList.add("hidden");
        if (el.reqTableWrap instanceof HTMLElement) el.reqTableWrap.classList.add("hidden");
        if (el.reqMobileList instanceof HTMLElement) el.reqMobileList.classList.add("hidden");
        if (el.reqEmpty instanceof HTMLElement) {
          el.reqEmpty.classList.remove("hidden");
          el.reqEmpty.innerHTML = renderStateCard({
            icon: "file-text",
            title: "Заявок пока нет",
            text: "Подай заявку на UNQ чтобы начать.",
            buttonId: "profile-requests-order-btn",
            buttonLabel: "Занять UNQ >",
          });
        }
        return;
      }
      if (el.reqTableWrap instanceof HTMLElement) el.reqTableWrap.classList.remove("hidden");
      if (el.reqMobileList instanceof HTMLElement) el.reqMobileList.classList.remove("hidden");
      if (el.reqEmpty instanceof HTMLElement) el.reqEmpty.classList.add("hidden");

      if (el.reqMobileList) {
        el.reqMobileList.innerHTML = s.requests.length
          ? s.requests
            .map((requestItem) => {
              const normalizedStatus = String(requestItem.status || "").toLowerCase();
              const showNote = ["rejected", "expired"].includes(normalizedStatus);
              const canResumePayment = normalizedStatus === "new" || normalizedStatus === "contacted";
              const totalPrice =
                Number(requestItem.slugPrice || 0) +
                Number(requestItem.planPrice || 0) +
                (requestItem.bracelet ? Number(requestItem.braceletPrice || DEFAULT_BRACELET_PRICE) : 0);
              const payActionButton = canResumePayment
                ? `<button type="button" data-a="pay-request" data-order-id="${esc(requestItem.id)}" class="interactive-btn min-h-11 w-full rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Оплатить</button>`
                : "";
              const cancelActionButton = normalizedStatus === "new"
                ? `<button type="button" data-a="cancel-request" data-order-id="${esc(requestItem.id)}" class="interactive-btn min-h-11 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Отменить</button>`
                : "";
              const actionButtons = [payActionButton, cancelActionButton].filter(Boolean).join("");
              return `<article class="rounded-xl border border-neutral-200 bg-white p-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">UNQ</p>
                  <p class="break-all font-mono text-sm font-semibold text-neutral-900">${esc(requestItem.slug)}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Статус</p>
                  <p class="text-sm font-semibold text-neutral-800">${esc(requestItem.statusBadge || requestItem.status)}</p>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-1 gap-2 text-xs text-neutral-600 sm:grid-cols-2">
                <div>
                  <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Дата</p>
                  <p class="break-words">${fdt(requestItem.createdAt)}</p>
                </div>
                <div>
                  <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Покупка</p>
                  <p class="break-words">${requestItem.purchasedAt ? fdt(requestItem.purchasedAt) : "—"}</p>
                </div>
                <div>
                  <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Тариф</p>
                  <p>${requestItem.requestedPlan === "premium" ? "Premium" : "—"}</p>
                </div>
                <div>
                  <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Браслет</p>
                  <p>${requestItem.bracelet ? "Да" : "Нет"}</p>
                </div>
              </div>
              <div class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <p class="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Цена</p>
                <p class="text-sm font-semibold text-neutral-900">${fp(totalPrice)}</p>
                <p class="text-[11px] text-neutral-500">${requestItem.purchasedAt ? `Subscription payment · ${fd(requestItem.purchasedAt)}` : "Subscription payment"}</p>
              </div>
              ${showNote ? `<p class="mt-3 text-xs text-rose-700">Примечание: ${esc(requestItem.adminNote || "—")}</p>` : ""}
              ${actionButtons ? `<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">${actionButtons}</div>` : ""}
            </article>`;
            })
            .join("")
          : '<div class="rounded-xl border border-neutral-200 bg-white px-3 py-5 text-center text-sm text-neutral-500">Заявок пока нет</div>';
      }
      el.reqTable.innerHTML = s.requests.length
        ? s.requests
          .map(
            (requestItem) => {
              const normalizedStatus = String(requestItem.status || "").toLowerCase();
              const showNote = ["rejected", "expired"].includes(normalizedStatus);
              const canResumePayment = normalizedStatus === "new" || normalizedStatus === "contacted";
              const actionButtons = [
                canResumePayment
                  ? `<button type="button" data-a="pay-request" data-order-id="${esc(requestItem.id)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-800">Оплатить</button>`
                  : "",
                normalizedStatus === "new"
                  ? `<button type="button" data-a="cancel-request" data-order-id="${esc(requestItem.id)}" class="interactive-btn min-h-11 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700">Отменить</button>`
                  : "",
              ]
                .filter(Boolean)
                .join('<span class="inline-block w-1"></span>');
              return `<tr class="border-t border-neutral-100">
              <td class="px-3 py-2">${fdt(requestItem.createdAt)}</td>
              <td class="px-3 py-2">${requestItem.purchasedAt ? fdt(requestItem.purchasedAt) : "—"}</td>
              <td class="px-3 py-2 font-mono">${esc(requestItem.slug)}</td>
              <td class="px-3 py-2">${fp(Number(requestItem.slugPrice || 0) + Number(requestItem.planPrice || 0) + (requestItem.bracelet ? Number(requestItem.braceletPrice || DEFAULT_BRACELET_PRICE) : 0))}<div class="text-[11px] text-neutral-500">${requestItem.purchasedAt ? `Subscription payment · ${fd(requestItem.purchasedAt)}` : "Subscription payment"}</div></td>
              <td class="px-3 py-2">${requestItem.requestedPlan === "premium" ? "Premium" : "—"}</td>
              <td class="px-3 py-2">${requestItem.bracelet ? "Да" : "Нет"}</td>
              <td class="px-3 py-2">${esc(requestItem.statusBadge || requestItem.status)}</td>
              <td class="px-3 py-2">${showNote ? esc(requestItem.adminNote || "—") : ""}${actionButtons ? `<div class="mt-2">${actionButtons}</div>` : ""}</td>
            </tr>`;
            }
          )
          .join("")
        : '<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-500">Заявок пока нет</td></tr>';

      const approved = s.requests.find((item) => item.status === "approved");
      const needsPayment = s.requests.find((item) => ["new", "contacted"].includes(String(item.status || "").toLowerCase()));
      const paid = s.requests.find((item) => item.status === "paid");
      const count = s.slugs.length;
      if (el.reqNewBtn instanceof HTMLButtonElement) {
        if (plan !== "premium" && count >= 1) {
          el.reqNewBtn.disabled = false;
          el.reqNewBtn.title = "Renew Premium - $2/month";
        } else if (plan === "premium" && count >= 3) {
          el.reqNewBtn.disabled = true;
          el.reqNewBtn.title = "Достигнут лимит 3 UNQ";
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

      if (needsPayment) {
        el.reqBanner.classList.remove("hidden");
        el.reqBanner.className = "mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900";
        el.reqBanner.innerHTML = `Есть незавершенная оплата по заявке <span class="font-mono">${esc(needsPayment.slug || "")}</span>. <button type="button" data-a="pay-request" data-order-id="${esc(needsPayment.id)}" class="underline font-semibold">Продолжить в Telegram</button>`;
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

    const renderTelegramNotificationActions = (enabled) => {
      const resolvedEnabled =
        typeof enabled === "boolean" ? enabled : Boolean(s.user && s.user.notificationsEnabled);
      if (el.stLinkTelegram instanceof HTMLButtonElement) {
        el.stLinkTelegram.classList.toggle("hidden", resolvedEnabled);
      }
      if (el.stUnlinkTelegram instanceof HTMLButtonElement) {
        el.stUnlinkTelegram.classList.toggle("hidden", !resolvedEnabled);
      }
    };

    const renderPrivateAccessSettings = () => {
      const passwords = Array.isArray(s.privatePasswords) ? s.privatePasswords : [];
      const limit = Number.isFinite(Number(s.privatePasswordLimit)) ? Number(s.privatePasswordLimit) : 10;
      const minLength = Number.isFinite(Number(s.privatePasswordMinLength)) ? Number(s.privatePasswordMinLength) : 4;

      if (el.privatePasswordAddValue instanceof HTMLInputElement) {
        el.privatePasswordAddValue.minLength = minLength;
      }
      if (el.privatePasswordChangeNew instanceof HTMLInputElement) {
        el.privatePasswordChangeNew.minLength = minLength;
      }
      if (el.privatePasswordOpenAdd instanceof HTMLButtonElement) {
        const reached = passwords.length >= limit;
        el.privatePasswordOpenAdd.disabled = reached;
        el.privatePasswordOpenAdd.classList.toggle("opacity-60", reached);
        el.privatePasswordOpenAdd.title = reached ? `Достигнут лимит ${limit} паролей` : "";
      }

      if (el.privatePasswordsList instanceof HTMLElement) {
        if (!passwords.length) {
          el.privatePasswordsList.innerHTML = '<p class="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs text-neutral-500">Пока нет паролей. Добавьте первый пароль для приватного режима.</p>';
        } else {
          el.privatePasswordsList.innerHTML = passwords
            .map((item) => {
              const id = String(item?.id || "");
              const label = String(item?.label || "").trim() || "Без метки";
              const createdAt = item?.createdAt ? fdt(item.createdAt) : "—";
              const lastUsed = item?.lastUsedAt ? fdt(item.lastUsedAt) : "ещё не использовался";
              return `<article class="rounded-xl border border-neutral-200 bg-white p-3" data-private-password-row="${esc(id)}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-neutral-900">${esc(label)}</p>
                    <p class="text-xs text-neutral-500">Создан: ${esc(createdAt)} · Последнее открытие: ${esc(lastUsed)}</p>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button data-a="open-private-change" data-password-id="${esc(id)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Сменить пароль</button>
                    <button data-a="delete-private-password" data-password-id="${esc(id)}" class="interactive-btn min-h-11 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700">Удалить</button>
                  </div>
                </div>
              </article>`;
            })
            .join("");
        }
      }
    };

    const renderSettings = () => {
      if (!s.user) return;
      if (el.stName) el.stName.value = s.user.displayName || s.user.firstName || "";
      if (el.stCity) el.stCity.value = String(s.user.city || "");
      if (el.stLogin) el.stLogin.value = String(s.user.login || "").trim() || "—";
      if (el.stEmail) {
        const accountEmail = String(s.user.email || "").trim();
        const pendingEmail = String(s.user.pendingEmail || "").trim();
        el.stEmail.value = pendingEmail || accountEmail || "Не указан";
        if (pendingEmail) {
          el.stEmail.title = "Ожидает подтверждения";
        } else {
          el.stEmail.removeAttribute("title");
        }
      }
      if (el.stTg) el.stTg.value = s.user.username ? `@${s.user.username}` : "";
      if (el.stNotif) el.stNotif.checked = Boolean(s.user.notificationsEnabled);
      renderTelegramNotificationActions(Boolean(s.user.notificationsEnabled));
      if (el.stDirectory) el.stDirectory.checked = Boolean(s.user.showInDirectory);
      if (el.verificationStatus) {
        const latest = s.verification?.latestRequest;
        const latestStatus = String(latest?.status || "").toLowerCase();
        let label = "Статус: не запрошено";
        if (latestStatus === "pending") {
          label = "Статус: на проверке";
        } else if (s.user.isVerified) {
          label = "Статус: верифицировано";
        } else if (latestStatus === "rejected") {
          label = "Статус: отклонено";
        }
        el.verificationStatus.textContent = label;

        if (el.verificationNote instanceof HTMLElement) {
          if (latestStatus === "pending") {
            el.verificationNote.textContent = "Новая заявка недоступна до решения администратора. Для правок используйте форму исправления ниже.";
            el.verificationNote.classList.remove("hidden");
          } else if (latestStatus === "rejected" && latest?.adminNote) {
            el.verificationNote.textContent = `Причина отклонения: ${latest.adminNote}`;
            el.verificationNote.classList.remove("hidden");
          } else {
            el.verificationNote.textContent = "";
            el.verificationNote.classList.add("hidden");
          }
        }
      }

      if (el.verificationOpen instanceof HTMLButtonElement) {
        const latest = s.verification?.latestRequest;
        const latestStatus = String(latest?.status || "").toLowerCase();
        const canSubmit =
          typeof s.verification?.canSubmitRequest === "boolean"
            ? s.verification.canSubmitRequest
            : latestStatus !== "pending";
        el.verificationOpen.disabled = !canSubmit;
        el.verificationOpen.classList.toggle("opacity-60", !canSubmit);
        if (latestStatus === "pending") {
          el.verificationOpen.textContent = "Заявка отправлена";
        } else if (s.user.isVerified) {
          el.verificationOpen.textContent = "Запросить повторно";
        } else if (latestStatus === "rejected") {
          el.verificationOpen.textContent = "Подать повторно";
        } else {
          el.verificationOpen.textContent = "Подать заявку";
        }
      }

      if (el.verificationCorrectionWrap instanceof HTMLElement) {
        const latestStatus = String(s.verification?.latestRequest?.status || "").toLowerCase();
        const canSendCorrection =
          typeof s.verification?.canSendCorrection === "boolean"
            ? s.verification.canSendCorrection
            : latestStatus === "pending";
        el.verificationCorrectionWrap.classList.toggle("hidden", !canSendCorrection);
      }

      if (!emailRequiredModalShown) {
        const hasEmail = Boolean(String(s.user.email || s.user.pendingEmail || "").trim());
        if (!hasEmail) {
          openEmailRequiredModal();
        }
      }

      renderPrivateAccessSettings();
    };

    const renderReferrals = () => {
      const payload = s.referrals || {};
      if (el.refLink instanceof HTMLInputElement) {
        el.refLink.value = payload.refLink || "";
      }
      if (el.refTg instanceof HTMLAnchorElement) {
        const text = encodeURIComponent("Зарегистрируйся на UNQX по моей ссылке");
        const url = encodeURIComponent(payload.refLink || "");
        el.refTg.href = `tg://msg_url?url=${url}&text=${text}`;
      }
      if (el.refInvited) el.refInvited.textContent = String(payload.stats?.invited || 0);
      if (el.refPaid) el.refPaid.textContent = String(payload.stats?.paid || 0);
      if (el.refRewarded) el.refRewarded.textContent = `${Number(payload.stats?.rewardsAmount || 0).toLocaleString("ru-RU")} сум`;
      if (el.refBonusBalance) el.refBonusBalance.textContent = `${Number(payload.bonus?.balance || 0).toLocaleString("ru-RU")} сум`;
      if (el.refBonusEarned) el.refBonusEarned.textContent = `${Number(payload.bonus?.totalEarned || 0).toLocaleString("ru-RU")} сум`;
      if (el.refBonusSpent) el.refBonusSpent.textContent = `${Number(payload.bonus?.totalSpent || 0).toLocaleString("ru-RU")} сум`;

      if (el.refTable) {
        const rows = Array.isArray(payload.referrals) ? payload.referrals : [];
        el.refTable.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${esc(item.name || "UNQX User")}</td><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(item.status)}</td><td class="px-3 py-2">${Number(item.rewardAmount || 0).toLocaleString("ru-RU")} сум</td></tr>`,
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
      if (el.refBonusHistory) {
        const rows = Array.isArray(payload.bonus?.history) ? payload.bonus.history : [];
        el.refBonusHistory.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(item.kind || "—")}</td><td class="px-3 py-2">${item.direction === "debit" ? "-" : "+"}${Number(item.amount || 0).toLocaleString("ru-RU")} сум</td><td class="px-3 py-2">${Number(item.balanceAfter || 0).toLocaleString("ru-RU")} сум</td><td class="px-3 py-2">${esc(item.note || "—")}</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">История бонусов появится после операций</td></tr>';
      }
      if (el.refCampaigns) {
        const rows = Array.isArray(payload.campaigns) ? payload.campaigns : [];
        el.refCampaigns.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${esc(item.name || "Campaign")}</td><td class="px-3 py-2">${esc(item.type || "-")}</td><td class="px-3 py-2">${esc(`${item.source || "-"} / ${item.offer || "-"}`)}</td><td class="px-3 py-2">${esc(item.promoCode || "-")}</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-500">Активных кампаний нет</td></tr>';
      }
      if (el.refFraud) {
        const rows = Array.isArray(payload.fraud) ? payload.fraud : [];
        el.refFraud.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(String(item.verdict || "").toUpperCase())}</td><td class="px-3 py-2">${esc(item.reason || "—")}</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="3" class="px-3 py-8 text-center text-neutral-500">Проверок пока нет</td></tr>';
      }
    };

    const renderScore = () => {
      const score = s.score || {};
      const rows = [
        ["Просмотры", Number(score.scoreViews || 0), 300],
        ["Редкость UNQ", Number(score.scoreSlugRarity || 0), 200],
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
        tips.push('<div class="flex items-center justify-between gap-2"><span>Добавь NFC-стикер - +100 к Score</span><button type="button" data-a="open-bracelet-order-modal" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Заказать стикер</button></div>');
      }
      if (Number(score.scorePlan || 0) === 0) {
        tips.push('<div class="flex items-center justify-between gap-2"><span>Renew Premium - $2/month - +49 to Score</span><button type="button" data-order-link data-order-plan="premium" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Renew Premium ></button></div>');
      }
      if (Number(score.scoreViews || 0) < 150) tips.push("<p>Поделись визиткой чтобы получить больше просмотров</p>");
      if (Number(score.scoreTenure || 0) < 100) tips.push("<p>Score растёт каждый месяц автоматически</p>");
      if (Number(score.scoreCtr || 0) < 100) tips.push("<p>Добавь больше кнопок чтобы повысить активность</p>");
      if (el.scoreTipsList) {
        el.scoreTipsList.innerHTML = tips.length ? tips.join("") : "<p>Отличный прогресс. Поддерживай активность визитки.</p>";
        window.dispatchEvent(new CustomEvent("unqx:bind-order-ctas"));
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
            buttonLabel: "Выбрать тариф >",
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
      renderHeaderStats();

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
      renderHeaderStats();
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
        const prevAvatarUrl = s.card?.avatarUrl || "";
        const payload = await api("/api/profile/bootstrap");
        s.user = payload.user || null;
        if (typeof window !== "undefined") {
          window.UNQProfileUser = s.user;
        }
        if (s.user && typeof s.user === "object") {
          s.user.effectivePlan = getCurrentPlan();
        }
        s.limits = payload.limits || {};
        s.slugs = payload.slugs || [];
        s.card = payload.card || null;
        const nextAvatarUrl = s.card?.avatarUrl || "";
        if (nextAvatarUrl !== prevAvatarUrl) {
          s.avatarVersion = Date.now();
        }
        s.requests = payload.requests || [];
        s.score = payload.score || null;
        s.pricing = payload.pricing || s.pricing;
        s.privatePasswords = Array.isArray(payload?.privacy?.passwords) ? payload.privacy.passwords : [];
        s.privatePasswordMinLength = Number(payload?.privacy?.passwordMinLength || 4) || 4;
        s.privatePasswordLimit = Number(payload?.privacy?.passwordLimit || 10) || 10;
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
        // Восстановить черновик, если он новее данных профиля
        restoreDraft();
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

    const refreshPrivateAccessData = async () => {
      try {
        const passwordsPayload = await api("/api/profile/privacy/passwords");
        s.privatePasswords = Array.isArray(passwordsPayload?.items) ? passwordsPayload.items : [];
        s.privatePasswordMinLength = Number(passwordsPayload?.minLength || s.privatePasswordMinLength || 4) || 4;
        s.privatePasswordLimit = Number(passwordsPayload?.limit || s.privatePasswordLimit || 10) || 10;
        renderPrivateAccessSettings();
      } catch (error) {
        console.error("[profile] failed to refresh private access data", error);
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
            bio: el.cBio?.value || "",
            hashtag: el.cHashtag?.value || "",
            address: el.cAddress?.value || "",
            postcode: el.cPostcode?.value || "",
            email: el.cEmail?.value || "",
            extraPhone: el.cExtraPhone?.value || "",
            tags: s.tags,
            buttons: (s.buttons || []).map((b) => ({
              type: b.type || 'other',
              label: b.label || '',
              href: typeof b.url === 'string' ? b.url : (typeof b.href === 'string' ? b.href : ''),
              value: typeof b.url === 'string' ? b.url : (typeof b.value === 'string' ? b.value : ''),
            })),
            theme: s.theme,
            showBranding: el.cBranding ? !el.cBranding.checked : true,
          }),
        });

        clearDraft();
        try {
          await load();
        } catch (loadError) {
          console.error("[profile] reload after card save failed", loadError);
        }
        showSaveAlert(PROFILE_SAVE_SUCCESS_MESSAGE);
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

    const openOrderModal = (options = {}) => {
      const modalApi = window.UNQOrderModal;
      if (modalApi && typeof modalApi.open === "function") {
        modalApi.open(options);
        return true;
      }

      const fallbackRoot = document.getElementById("order-modal-root");
      if (fallbackRoot instanceof HTMLElement) {
        if (fallbackRoot.dataset.fallbackBound !== "1") {
          fallbackRoot.dataset.fallbackBound = "1";
          const closeFallback = () => {
            fallbackRoot.classList.remove("is-open", "block");
            fallbackRoot.classList.add("hidden");
            fallbackRoot.style.display = "none";
            document.body.classList.remove("modal-open");
          };
          const fallbackBackdrop = document.getElementById("order-modal-backdrop");
          const fallbackCloseTop = document.getElementById("order-modal-close-top");
          const fallbackCloseForm = document.getElementById("order-modal-close-form");
          const fallbackCloseSuccess = document.getElementById("order-modal-close-success");
          fallbackBackdrop?.addEventListener("click", closeFallback);
          fallbackCloseTop?.addEventListener("click", closeFallback);
          fallbackCloseForm?.addEventListener("click", closeFallback);
          fallbackCloseSuccess?.addEventListener("click", closeFallback);
        }
        fallbackRoot.style.display = "block";
        fallbackRoot.classList.remove("hidden");
        fallbackRoot.classList.add("block", "is-open");
        document.body.classList.add("modal-open");
        const fallbackDialog = document.getElementById("order-modal-dialog");
        if (fallbackDialog instanceof HTMLElement) {
          requestAnimationFrame(() => fallbackDialog.focus());
        }
        return true;
      }

      showModal("Ошибка", "Не удалось открыть форму заказа. Обновите страницу.");
      return false;
    };

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

    document.addEventListener("click", async (event) => {
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
    el.emailModalCloseTop?.addEventListener("click", closeEmailModal);
    el.emailModalCancel?.addEventListener("click", closeEmailModal);
    el.emailModal?.addEventListener("click", (event) => {
      if (event.target === el.emailModal) closeEmailModal();
    });
    el.emailRequiredClose?.addEventListener("click", closeEmailRequiredModal);
    el.emailRequiredLater?.addEventListener("click", closeEmailRequiredModal);
    el.emailRequiredOpen?.addEventListener("click", () => {
      closeEmailRequiredModal();
      openEmailModal();
    });
    el.emailRequiredModal?.addEventListener("click", (event) => {
      if (event.target === el.emailRequiredModal) closeEmailRequiredModal();
    });
    el.emailModalSubmit?.addEventListener("click", () => {
      void handleEmailRequest();
    });
    el.emailModalVerify?.addEventListener("click", () => {
      void handleEmailVerify();
    });
    el.emailModalBack?.addEventListener("click", () => {
      setEmailModalStep("request");
      requestAnimationFrame(() => {
        if (el.emailNewEmail instanceof HTMLInputElement) el.emailNewEmail.focus();
      });
    });
    el.emailVerifyCode?.addEventListener("input", () => {
      if (!(el.emailVerifyCode instanceof HTMLInputElement)) return;
      el.emailVerifyCode.value = el.emailVerifyCode.value.replace(/\D/g, "").slice(0, 6);
    });
    el.passwordModalCloseTop?.addEventListener("click", closePasswordModal);
    el.passwordModalClose?.addEventListener("click", closePasswordModal);
    el.passwordModal?.addEventListener("click", (event) => {
      if (event.target === el.passwordModal) closePasswordModal();
    });
    el.passwordModalSubmit?.addEventListener("click", () => {
      void handlePasswordChange();
    });
    el.privatePasswordAddCloseTop?.addEventListener("click", closePrivatePasswordAddModal);
    el.privatePasswordAddCancel?.addEventListener("click", closePrivatePasswordAddModal);
    el.privatePasswordAddModal?.addEventListener("click", (event) => {
      if (event.target === el.privatePasswordAddModal) closePrivatePasswordAddModal();
    });
    el.privatePasswordAddSubmit?.addEventListener("click", () => {
      void handlePrivatePasswordAdd();
    });
    el.privatePasswordAddValue?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handlePrivatePasswordAdd();
    });
    el.privatePasswordChangeCloseTop?.addEventListener("click", closePrivatePasswordChangeModal);
    el.privatePasswordChangeCancel?.addEventListener("click", closePrivatePasswordChangeModal);
    el.privatePasswordChangeModal?.addEventListener("click", (event) => {
      if (event.target === el.privatePasswordChangeModal) closePrivatePasswordChangeModal();
    });
    el.privatePasswordChangeSubmit?.addEventListener("click", () => {
      void handlePrivatePasswordChange();
    });
    el.privatePasswordChangeNew?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handlePrivatePasswordChange();
    });
    el.braceletModalClose?.addEventListener("click", closeBraceletModal);
    el.braceletModalCloseTop?.addEventListener("click", closeBraceletModal);
    el.braceletModal?.addEventListener("click", (event) => {
      if (event.target === el.braceletModal) closeBraceletModal();
    });
    el.braceletModalSubmit?.addEventListener("click", () => {
      closeBraceletModal();
      openOrderModal({ bracelet: true });
    });
    const trapFocus = (dialog, event) => {
      if (!(dialog instanceof HTMLElement)) return;
      const focusable = Array.from(
        dialog.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => item instanceof HTMLElement && item.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
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
    };
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (emailModalOpen) {
          closeEmailModal();
          return;
        }
        if (passwordModalOpen) {
          closePasswordModal();
          return;
        }
        if (privatePasswordChangeModalOpen) {
          closePrivatePasswordChangeModal();
          return;
        }
        if (privatePasswordAddModalOpen) {
          closePrivatePasswordAddModal();
          return;
        }
        if (braceletModalOpen) {
          closeBraceletModal();
          return;
        }
        if (modalIsOpen) {
          closeModal();
        }
        return;
      }
      if (event.key !== "Tab") return;
      if (emailModalOpen && el.emailModalDialog instanceof HTMLElement) {
        trapFocus(el.emailModalDialog, event);
        return;
      }
      if (passwordModalOpen && el.passwordModalDialog instanceof HTMLElement) {
        trapFocus(el.passwordModalDialog, event);
        return;
      }
      if (privatePasswordChangeModalOpen && el.privatePasswordChangeDialog instanceof HTMLElement) {
        trapFocus(el.privatePasswordChangeDialog, event);
        return;
      }
      if (privatePasswordAddModalOpen && el.privatePasswordAddDialog instanceof HTMLElement) {
        trapFocus(el.privatePasswordAddDialog, event);
        return;
      }
      if (braceletModalOpen && el.braceletModalDialog instanceof HTMLElement) {
        trapFocus(el.braceletModalDialog, event);
        return;
      }
      if (modalIsOpen && el.modalDialog instanceof HTMLElement) {
        trapFocus(el.modalDialog, event);
      }
    });

    el.addSlug?.addEventListener("click", () => {
      const plan = getCurrentPlan();
      const count = s.slugs.length;
      if (plan === "none") {
        openOrderModal({});
        return;
      }

      if (plan === "premium" && count >= 3) {
        showModal("Лимит достигнут", "Достигнут лимит 3 UNQ для Премиум тарифа");
        return;
      }

      if (plan !== "premium" && count >= 1) {
        showModal(
          "Premium required",
          "Renew Premium - $2/month",
          "Renew Premium >",
          () => {
            openOrderModal({ plan: "premium" });
          },
        );
        return;
      }
      openOrderModal({});
    });

    el.reqNewBtn?.addEventListener("click", () => {
      const plan = getCurrentPlan();
      const count = s.slugs.length;
      if (plan === "none") {
        openOrderModal({});
        return;
      }
      if (plan !== "premium" && count >= 1) {
        showModal("Premium required", "Renew Premium - $2/month");
        return;
      }
      if (plan === "premium" && count >= 3) {
        showModal("Лимит достигнут", "Достигнут лимит 3 UNQ");
        return;
      }
      openOrderModal({});
    });

    document.addEventListener("click", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const actionNode = target.closest("[data-a]");
      const action = actionNode instanceof HTMLElement ? actionNode.getAttribute("data-a") : "";

      if (action === "open-qr") {
        const slug = String(actionNode.getAttribute("data-slug") || "").trim();
        if (!slug) return;
        try {
          await openQrModal(slug);
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось открыть QR");
        }
        return;
      }

      if (action === "card-status") {
        const requested = normalizeCardVisibilityStatus(actionNode.getAttribute("data-status"));
        const slugs = Array.isArray(s.slugs) ? s.slugs : [];
        if (!slugs.length) {
          showModal("Ошибка", "UNQ не найден");
          return;
        }

        const visibility = resolveCardVisibility();
        if (!visibility.mixed && visibility.status === requested) {
          return;
        }

        try {
          await api("/api/profile/card/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: requested }),
          });

          slugs.forEach((item) => {
            item.status = requested;
            item.statusLabel = cardVisibilityLabel(requested);
          });

          renderSlugs();
          renderPreview();
          showSaveAlert("Статус визитки обновлён");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось обновить статус визитки");
        }
        return;
      }

      if (action === "save-card-pm") {
        const slugs = Array.isArray(s.slugs) ? s.slugs : [];
        const pausedSlugs = slugs.filter((item) => normalizeCardVisibilityStatus(item?.status) === "paused");
        if (!pausedSlugs.length) {
          showModal("Ошибка", "Сначала включите статус Пауза");
          return;
        }
        const input = document.querySelector("[data-card-pm]");
        const message = input instanceof HTMLInputElement ? String(input.value || "").trim() : "";

        try {
          await Promise.all(
            pausedSlugs.map((item) =>
              api(`/api/profile/slugs/${encodeURIComponent(item.fullSlug)}/pause-message`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
              })),
          );

          pausedSlugs.forEach((item) => {
            item.pauseMessage = message;
          });

          renderSlugs();
          showSaveAlert(PROFILE_SAVE_SUCCESS_MESSAGE);
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось сохранить сообщение паузы");
        }
        return;
      }

      if (action === "primary") {
        const slug = String(actionNode.getAttribute("data-slug") || "").trim();
        if (!slug) return;
        try {
          await api(`/api/profile/slugs/${encodeURIComponent(slug)}/primary`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const slugs = Array.isArray(s.slugs) ? s.slugs : [];
          slugs.forEach((item) => {
            item.isPrimary = String(item.fullSlug) === slug;
          });
          renderSlugs();
          renderPreview();
          showSaveAlert("Основной UNQ обновлён");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось обновить основной UNQ");
        }
        return;
      }

      if (action === "open-private-change") {
        const passwordId = String(actionNode.getAttribute("data-password-id") || "").trim();
        if (!passwordId) return;
        openPrivatePasswordChangeModal(passwordId);
        return;
      }

      if (action === "delete-private-password") {
        const passwordId = String(actionNode.getAttribute("data-password-id") || "").trim();
        if (!passwordId) return;
        showModal("Удалить пароль?", "Этот пароль больше не будет открывать приватную визитку.", "Удалить", async () => {
          try {
            await api(`/api/profile/privacy/passwords/${encodeURIComponent(passwordId)}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            await refreshPrivateAccessData();
            showSaveAlert("Пароль удалён");
          } catch (error) {
            showModal("Ошибка", error.message || "Не удалось удалить пароль");
          }
        });
        return;
      }

      if (action === "goto-card") {
        location.hash = "#card";
        return;
      }

      if (action === "open-bracelet-order-modal") {
        openBraceletModal();
        return;
      }

      if (action === "claim-reward") {
        const ruleId = String(actionNode.getAttribute("data-rule") || "").trim();
        if (!ruleId) return;
        try {
          await api(`/api/features/referrals/rewards/${encodeURIComponent(ruleId)}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          try {
            s.referrals = await api("/api/referrals/bootstrap");
          } catch {
            s.referrals = null;
          }
          renderReferrals();
          showSaveAlert("Награда начислена");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось забрать награду");
        }
        return;
      }

      const shareButton = target.closest("[data-share-card]");
      if (shareButton instanceof HTMLElement) {
        const cardRoot = shareButton.closest("[data-card-view]");
        const shareUrl = String(cardRoot?.getAttribute("data-share-url") || location.href || "").trim();
        const labelNode = cardRoot?.querySelector("[data-share-label]");
        let shared = false;
        try {
          if (navigator.share && shareUrl) {
            await navigator.share({ title: document.title, url: shareUrl });
            shared = true;
          }
        } catch {
          shared = false;
        }

        if (!shared) {
          const copied = await copyText(shareUrl);
          if (labelNode instanceof HTMLElement) {
            labelNode.textContent = copied ? "Скопировано" : "Ошибка";
          }
          if (copied) {
            showSaveAlert("Ссылка скопирована");
          } else {
            showModal("Ошибка", "Не удалось скопировать ссылку");
          }
        } else if (labelNode instanceof HTMLElement) {
          labelNode.textContent = "Отправлено";
        }

        if (labelNode instanceof HTMLElement) {
          window.setTimeout(() => {
            labelNode.textContent = "Поделиться";
          }, 1600);
        }
        return;
      }

      const saveContactButton = target.closest("[data-save-contact]");
      if (saveContactButton instanceof HTMLElement) {
        const { card, primarySlug } = buildPreviewCardData();
        const cardRoot = saveContactButton.closest("[data-card-view]");
        const shareUrl = String(cardRoot?.getAttribute("data-share-url") || location.href || "").trim();
        const fullName = String(card?.name || "UNQX User").trim();
        const phone = String(card?.extraPhone || "").trim();
        const email = String(card?.email || "").trim();
        const safeName = fullName || "UNQX User";
        const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${safeName}`];
        if (phone) {
          lines.push(`TEL;TYPE=CELL:${phone}`);
        }
        if (email) {
          lines.push(`EMAIL;TYPE=INTERNET:${email}`);
        }
        if (shareUrl) {
          lines.push(`URL:${shareUrl}`);
        }
        lines.push("END:VCARD");
        const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filename = String(primarySlug?.fullSlug || "unq-card").toLowerCase().replace(/[^a-z0-9_-]/g, "");
        link.href = downloadUrl;
        link.download = `${filename || "contact"}.vcf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        showSaveAlert("Контакт сохранён");
        return;
      }

      const copyCardButton = target.closest("[data-copy-card]");
      if (copyCardButton instanceof HTMLElement) {
        const cardToCopy = String(copyCardButton.getAttribute("data-copy-card") || "").trim();
        if (!cardToCopy) return;
        const copied = await copyText(cardToCopy);
        const labelNode = copyCardButton.querySelector("span");
        const previousText = labelNode instanceof HTMLElement ? labelNode.textContent || "" : "";
        if (labelNode instanceof HTMLElement) {
          labelNode.textContent = copied ? "Скопировано" : "Ошибка копирования";
          window.setTimeout(() => {
            labelNode.textContent = previousText;
          }, 1400);
        }
        if (copied) {
          showSaveAlert("Номер карты скопирован");
        } else {
          showModal("Ошибка", "Не удалось скопировать номер карты");
        }
        return;
      }

      const payNode = target.closest('[data-a="pay-request"]');
      if (payNode instanceof HTMLElement) {
        const orderId = String(payNode.getAttribute("data-order-id") || "").trim();
        const requestItem = s.requests.find((item) => String(item.id) === orderId);
        let url = "";
        try {
          const requestedPlan = String(requestItem?.requestedPlan || "premium").toLowerCase() === "premium" ? "premium" : "premium";
          const precheck = await api(`/api/cards/order-precheck?requestedPlan=${encodeURIComponent(requestedPlan)}`);
          const pending = precheck?.pendingOrder && typeof precheck.pendingOrder === "object" ? precheck.pendingOrder : null;
          if (pending) {
            url = buildPendingPaymentUrl(pending);
          }
        } catch {
          // fallback to local request snapshot
        }
        if (!url) {
          url = buildTelegramPaymentUrl(requestItem || { id: orderId, slug: "", requestedPlan: "premium" });
        }
        openTelegramUrl(url);
        return;
      }
      const cancelNode = target.closest('[data-a="cancel-request"]');
      if (cancelNode instanceof HTMLElement) {
        const orderId = String(cancelNode.getAttribute("data-order-id") || "").trim();
        if (!orderId) {
          return;
        }
        showModal("Отменить заявку", "UNQ будет освобожден сразу. Продолжить?", "Отменить заявку", async () => {
          try {
            await api(`/api/cards/order-request/${encodeURIComponent(orderId)}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            await load();
            location.hash = "#requests";
            showSaveAlert("Заявка отменена, UNQ освобожден");
          } catch (error) {
            showModal("Не удалось отменить", error.message || "Попробуйте позже");
          }
        });
        return;
      }
      if (
        target.id === "profile-slugs-order-btn" ||
        target.id === "profile-card-order-btn" ||
        target.id === "profile-analytics-order-btn" ||
        target.id === "profile-requests-order-btn"
      ) {
        openOrderModal({});
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
      saveDraft();
    });

    el.cName?.addEventListener("input", () => {
      if (el.cardNameError && (el.cName?.value || "").trim().length > 0) {
        el.cardNameError.classList.add("hidden");
      }
      renderPreview();
      saveDraft();
    });
    el.cBranding?.addEventListener("change", () => { renderPreview(); saveDraft(); });
    el.cHashtag?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cAddress?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cPostcode?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cEmail?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cExtraPhone?.addEventListener("input", () => { renderPreview(); saveDraft(); });
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
      saveDraft();
    });

    el.cTags?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const removeBtn = target?.closest('[data-a="rm-tag"]');
      if (!(removeBtn instanceof HTMLElement)) return;
      event.preventDefault();

      const index = Number(removeBtn.getAttribute("data-i"));
      if (!Number.isFinite(index) || index < 0 || index >= s.tags.length) return;

      s.tags.splice(index, 1);
      renderTags();
      renderPreview();
      saveDraft();
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
      saveDraft();
    });

    el.cBtns?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const removeBtn = target?.closest('[data-a="rm-btn"]');
      if (!(removeBtn instanceof HTMLElement)) return;
      event.preventDefault();

      const index = Number(removeBtn.getAttribute("data-i"));
      if (!Number.isFinite(index) || index < 0 || index >= s.buttons.length) return;

      s.buttons.splice(index, 1);
      renderButtons();
      renderPreview();
      saveDraft();
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
      if (type !== prev.type && label === previousDefault) {
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
        url: href,
      };

      renderPreview();
      saveDraft();
    });

    el.cThemes.forEach((button) =>
      button.addEventListener("click", () => {
        const selectedTheme = button.getAttribute("data-theme") || "default_dark";
        const premiumOnly = PREMIUM_ONLY_THEMES.has(selectedTheme);
        if (premiumOnly && getCurrentPlan() !== "premium") {
          showModal("Доступно на Премиум", "Эта тема доступна только для Премиум тарифа.");
          return;
        }
        s.theme = PROFILE_THEMES.includes(selectedTheme) ? selectedTheme : "default_dark";
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

    el.stChangeEmail?.addEventListener("click", openEmailModal);

    el.stChangePassword?.addEventListener("click", openPasswordModal);

    el.privatePasswordOpenAdd?.addEventListener("click", openPrivatePasswordAddModal);

    el.stSave?.addEventListener("click", async () => {
      if (!el.stStatus) return;
      el.stStatus.textContent = "";

      try {
        const payload = await api("/api/profile/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: el.stName?.value || "",
            city: el.stCity?.value || "",
            telegramUsername: String(el.stTg?.value || "").replace(/^@+/, "").trim(),
            notificationsEnabled: Boolean(el.stNotif?.checked),
            showInDirectory: Boolean(el.stDirectory?.checked),
          }),
        });

        if (s.user) {
          s.user.displayName = payload.user.displayName;
          s.user.city = payload.user.city;
          s.user.notificationsEnabled = payload.user.notificationsEnabled;
          s.user.showInDirectory = payload.user.showInDirectory;
        }

        renderSidebar();
        renderTelegramNotificationActions(Boolean(payload?.user?.notificationsEnabled));
        el.stStatus.textContent = PROFILE_SAVE_SUCCESS_MESSAGE;
        el.stStatus.className = "text-sm text-emerald-700";
        showSaveAlert(PROFILE_SAVE_SUCCESS_MESSAGE);
      } catch (error) {
        el.stStatus.textContent = `${error.message}`;
        el.stStatus.className = "text-sm text-red-700";
      }
    });

    el.stNotif?.addEventListener("change", () => {
      renderTelegramNotificationActions(Boolean(el.stNotif?.checked));
    });

    el.stDeact?.addEventListener("click", () => {
      showModal(
        "Деактивировать аккаунт?",
        `Все твои UNQ станут недоступны. Восстановление будет доступно ${reactivationWindowDays} дней, затем аккаунт удалится окончательно.`,
        "Подтвердить",
        async () => {
          try {
            await api("/api/profile/deactivate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            location.href = "/login";
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
        try {
          await api("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch (error) {
          const isCsrfError = String(error?.message || "").toLowerCase().includes("invalid csrf token");
          if (!isCsrfError) {
            throw error;
          }
          // Session can rotate after inactivity; refresh token and retry logout once.
          await api("/api/auth/me", {
            method: "GET",
          });
          await api("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        }
        window.dispatchEvent(new CustomEvent("unqx:auth:logout"));
        location.href = "/login";
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось выйти");
        el.logout.disabled = false;
      }
    });

    el.stLinkTelegram?.addEventListener("click", async () => {
      const btn = el.stLinkTelegram;
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = true;
      try {
        const payload = await api("/api/profile/telegram/link/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const url = String(payload?.url || "").trim();
        if (!url) {
          throw new Error("Не удалось получить ссылку Telegram");
        }
        if (s.user) {
          s.user.notificationsEnabled = true;
        }
        if (el.stNotif instanceof HTMLInputElement) {
          el.stNotif.checked = true;
        }
        renderTelegramNotificationActions(true);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось подключить Telegram");
      } finally {
        btn.disabled = false;
      }
    });

    el.stUnlinkTelegram?.addEventListener("click", async () => {
      const btn = el.stUnlinkTelegram;
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = true;
      try {
        await api("/api/profile/telegram/link/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (s.user) {
          s.user.notificationsEnabled = false;
        }
        if (el.stNotif instanceof HTMLInputElement) {
          el.stNotif.checked = false;
        }
        renderTelegramNotificationActions(false);
        showModal("Готово", "Telegram уведомления отключены", "Ок");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось отключить Telegram");
      } finally {
        btn.disabled = false;
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
    const fillVerificationFormFromLatest = () => {
      const latest = s.verification?.latestRequest;
      if (!latest) return;
      if (el.verificationCompany instanceof HTMLInputElement && !el.verificationCompany.value.trim()) {
        el.verificationCompany.value = String(latest.companyName || "");
      }
      if (el.verificationRole instanceof HTMLInputElement && !el.verificationRole.value.trim()) {
        el.verificationRole.value = String(latest.role || "");
      }
      if (el.verificationSector instanceof HTMLSelectElement) {
        const sector = String(latest.sector || "other").toLowerCase();
        el.verificationSector.value = ["design", "sales", "marketing", "it", "other"].includes(sector) ? sector : "other";
      }
      if (el.verificationProofType instanceof HTMLSelectElement) {
        const proofType = String(latest.proofType || "email").toLowerCase();
        el.verificationProofType.value = ["email", "linkedin", "website"].includes(proofType) ? proofType : "email";
      }
      if (el.verificationProofValue instanceof HTMLInputElement && !el.verificationProofValue.value.trim()) {
        el.verificationProofValue.value = String(latest.proofValue || "");
      }
    };
    el.verificationOpen?.addEventListener("click", () => {
      if (el.verificationOpen instanceof HTMLButtonElement && el.verificationOpen.disabled) {
        return;
      }
      if (!(el.verificationModal instanceof HTMLElement)) return;
      fillVerificationFormFromLatest();
      el.verificationModal.classList.remove("hidden");
      el.verificationModal.classList.add("flex");
    });
    el.verificationClose?.addEventListener("click", closeVerificationModal);
    el.verificationModal?.addEventListener("click", (event) => {
      if (event.target === el.verificationModal) closeVerificationModal();
    });
    el.verificationSubmit?.addEventListener("click", async () => {
      if (el.verificationSubmit instanceof HTMLButtonElement) {
        el.verificationSubmit.disabled = true;
      }
      try {
        await api("/api/profile/verification-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: el.verificationCompany?.value || "",
            role: el.verificationRole?.value || "",
            sector: el.verificationSector?.value || "other",
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
      } finally {
        if (el.verificationSubmit instanceof HTMLButtonElement) {
          el.verificationSubmit.disabled = false;
        }
      }
    });

    el.verificationCorrectionSubmit?.addEventListener("click", async () => {
      const correctionText = String(el.verificationCorrection?.value || "").trim();
      if (!correctionText) {
        showModal("Проверь данные", "Опишите, что нужно исправить в заявке.");
        return;
      }
      if (el.verificationCorrectionSubmit instanceof HTMLButtonElement) {
        el.verificationCorrectionSubmit.disabled = true;
      }
      try {
        await api("/api/profile/verification-request/correction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: correctionText }),
        });
        if (el.verificationCorrection instanceof HTMLTextAreaElement) {
          el.verificationCorrection.value = "";
        }
        await load();
        showModal("Готово", "Исправление отправлено администратору.");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось отправить исправление");
      } finally {
        if (el.verificationCorrectionSubmit instanceof HTMLButtonElement) {
          el.verificationCorrectionSubmit.disabled = false;
        }
      }
    });

    const refreshProfileSoon = (delayMs = 150) => {
      if (hasPendingDraft()) {
        return;
      }
      if (profileRefreshTimer) {
        clearTimeout(profileRefreshTimer);
        profileRefreshTimer = null;
      }
      profileRefreshTimer = setTimeout(async () => {
        if (profileRefreshInFlight) return;
        profileRefreshInFlight = true;
        try {
          await load();
        } catch {
          // explicit user actions already show errors
        } finally {
          profileRefreshInFlight = false;
        }
      }, Math.max(0, Number(delayMs) || 0));
    };

    window.addEventListener("unqx:order:submitted", () => {
      location.hash = "#requests";
      refreshProfileSoon(80);
    });

    window.addEventListener("unqx:order:cancelled", () => {
      refreshProfileSoon(80);
    });

    window.addEventListener("focus", () => {
      refreshProfileSoon(150);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshProfileSoon(150);
      }
    });
    load().catch((error) => showModal("Ошибка", error.message || "Не удалось загрузить профиль"));
  })();
})();
