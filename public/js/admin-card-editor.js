(function initAdminCardEditor() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-card-editor") {
    return;
  }

  const mode = String(body.getAttribute("data-mode") || "").trim();
  if (mode !== "edit") {
    return;
  }

  const cardId = String(body.getAttribute("data-card-id") || "").trim();
  if (!cardId) {
    return;
  }

  const form = document.getElementById("card-editor-form");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const presetsNode = document.getElementById("admin-card-editor-presets");
  const buttonTypeLabels = {
    phone: "Позвонить",
    telegram: "Telegram",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    whatsapp: "WhatsApp",
    website: "Сайт",
    map: "Карта",
    card: "Карта NFC",
    other: "Другое",
  };
  const buttonTypeOptions = Object.entries(buttonTypeLabels);
  const PET_TYPES = ["kitten", "puppy", "snake"];
  const PET_TYPE_LABELS = {
    kitten: "Коала",
    puppy: "Котик",
    snake: "Леопард",
  };
  const PET_ASSET_URLS = {
    kitten: "/assets/pets/pet1.png",
    puppy: "/assets/pets/pet2.png",
    snake: "/assets/pets/pet3.png",
  };
  const draftStorageKey = `unqx:admin-card-draft:${cardId}`;

  let presets = {
    signatureThemes: [],
    colorThemes: [],
    avatarFrames: [],
    emojiBackgroundPacks: [],
  };
  try {
    presets = JSON.parse(presetsNode?.textContent || "{}") || presets;
  } catch {
    presets = {
      signatureThemes: [],
      colorThemes: [],
      avatarFrames: [],
      emojiBackgroundPacks: [],
    };
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const el = {
    pageError: $("#admin-card-page-error"),
    formError: $("#card-form-error"),
    saveStatus: $("#admin-card-save-status"),
    saveButton: $("#save-card-btn"),
    ownerName: $("#admin-card-owner-name"),
    ownerLogin: $("#admin-card-owner-login"),
    ownerPlan: $("#admin-card-owner-plan"),
    ownerLink: $("#admin-card-open-owner-link"),
    primarySlug: $("#admin-card-primary-slug"),
    primarySlugStatus: $("#admin-card-primary-slug-status"),
    primarySlugNote: $("#admin-card-primary-slug-note"),
    previewSlugSelect: $("#admin-card-preview-slug-select"),
    publicLink: $("#admin-card-open-public-link"),
    previewSlugLabel: $("#admin-card-preview-slug-label"),
    previewOpenLink: $("#admin-card-preview-open-link"),
    tariffSelect: $("#admin-card-tariff-select"),
    tariffApply: $("#admin-card-tariff-apply"),
    activeToggle: $("#admin-card-active-toggle"),
    operationsNote: $("#admin-card-operations-note"),
    verificationState: $("#admin-card-verification-state"),
    verifiedCompany: $("#admin-card-verified-company"),
    verifiedCompanyInput: $("#admin-card-verified-company-input"),
    verificationRequest: $("#admin-card-verification-request"),
    categories: $$(".admin-card-category-btn[data-card-category]"),
    panels: $$("[data-card-panel]"),
    avatarFile: $("#admin-card-avatar-file"),
    avatarCurrent: $("#admin-card-avatar-current"),
    avatarFallback: $("#admin-card-avatar-fallback"),
    avatarUpload: $("#admin-card-avatar-upload"),
    avatarRemove: $("#admin-card-avatar-remove"),
    avatarCropWrap: $("#admin-card-avatar-crop-wrap"),
    avatarCropImage: $("#admin-card-avatar-crop-image"),
    name: $("#admin-card-name"),
    role: $("#admin-card-role"),
    bio: $("#admin-card-bio"),
    bioCounter: $("#admin-card-bio-counter"),
    hashtag: $("#admin-card-hashtag"),
    tagInput: $("#admin-card-tag-input"),
    tagAdd: $("#admin-card-tag-add"),
    tagsList: $("#admin-card-tags-list"),
    buttonAdd: $("#admin-card-button-add"),
    buttonsList: $("#admin-card-buttons-list"),
    address: $("#admin-card-address"),
    postcode: $("#admin-card-postcode"),
    email: $("#admin-card-email"),
    extraPhone: $("#admin-card-extra-phone"),
    themeButtons: $$("[data-theme]"),
    frameButtons: $$("[data-avatar-frame]"),
    emojiPackButtons: $$("[data-emoji-background-pack]"),
    customColor: $("#admin-card-custom-color"),
    hideBranding: $("#admin-card-hide-branding"),
    petsList: $("#admin-card-pets-list"),
    preview: $("#profile-card-live-preview"),
  };

  if (
    !(el.name instanceof HTMLInputElement) ||
    !(el.role instanceof HTMLInputElement) ||
    !(el.bio instanceof HTMLTextAreaElement) ||
    !(el.hashtag instanceof HTMLInputElement) ||
    !(el.tagsList instanceof HTMLElement) ||
    !(el.buttonsList instanceof HTMLElement) ||
    !(el.address instanceof HTMLInputElement) ||
    !(el.postcode instanceof HTMLInputElement) ||
    !(el.email instanceof HTMLInputElement) ||
    !(el.extraPhone instanceof HTMLInputElement) ||
    !(el.preview instanceof HTMLElement)
  ) {
    return;
  }

  const state = {
    loaded: false,
    category: "main",
    owner: null,
    verification: null,
    slugs: [],
    selectedPreviewSlug: "",
    isActive: false,
    tariff: "legacy",
    petCatalog: [],
    petDrafts: {},
    card: {
      name: "",
      role: "",
      bio: "",
      hashtag: "",
      address: "",
      postcode: "",
      email: "",
      extraPhone: "",
      avatarUrl: "",
      tags: [],
      buttons: [],
      theme: "default_dark",
      customColor: "",
      avatarFrame: "none",
      emojiBackgroundPack: "none",
      showBranding: true,
      pets: [],
    },
  };

  let cropper = null;
  let sourceObjectUrl = "";
  let pendingAvatarPreviewUrl = "";
  let pendingAvatarBlob = null;
  let tagsSortable = null;
  let buttonsSortable = null;
  let saveStatusTimer = 0;

  function withCsrfHeaders(headers = {}) {
    return csrf
      ? {
        ...headers,
        "X-CSRF-Token": csrf,
      }
      : headers;
  }

  function api(url, options = {}) {
    const headers = withCsrfHeaders(options.headers || {});
    return fetch(url, { ...options, headers }).then(async (response) => {
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        const error = new Error(payload?.error || "Request failed");
        error.status = response.status;
        error.code = payload?.code || "";
        error.payload = payload;
        throw error;
      }
      return payload;
    });
  }

  function setNodeMessage(node, message) {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const text = String(message || "").trim();
    node.textContent = text;
    node.classList.toggle("hidden", !text);
  }

  function showPageError(message) {
    setNodeMessage(el.pageError, message);
  }

  function showFormError(message) {
    setNodeMessage(el.formError, message);
  }

  function setSaveStatus(message, tone = "neutral") {
    if (!(el.saveStatus instanceof HTMLElement)) {
      return;
    }
    window.clearTimeout(saveStatusTimer);
    el.saveStatus.textContent = String(message || "");
    el.saveStatus.style.color =
      tone === "error" ? "#b91c1c" : tone === "success" ? "#166534" : "#6b7280";
    if (message) {
      saveStatusTimer = window.setTimeout(() => {
        if (el.saveStatus instanceof HTMLElement) {
          el.saveStatus.textContent = "";
        }
      }, 3200);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeHexColor(value) {
    const raw = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : "";
  }

  function createEditorButton(data = {}) {
    const id = String(data.id || `${Date.now()}_${Math.random()}`).slice(0, 80);
    return {
      id,
      type: String(data.type || "other").trim().toLowerCase() || "other",
      label: String(data.label || "").trim().slice(0, 40),
      value: String(data.href || data.value || data.url || "").trim().slice(0, 400),
      active: data.active !== false,
    };
  }

  function createEmptyButton() {
    return createEditorButton({
      type: "other",
      label: "",
      value: "",
      active: true,
    });
  }

  function normalizePetItem(pet) {
    const petType = String(pet?.petType || "").trim().toLowerCase();
    if (!PET_TYPES.includes(petType)) {
      return null;
    }
    return {
      id: String(pet?.id || "").trim(),
      petType,
      label: String(pet?.label || PET_TYPE_LABELS[petType] || petType).trim(),
      assetUrl: String(pet?.assetUrl || PET_ASSET_URLS[petType]).trim(),
      displayName: String(pet?.displayName || PET_TYPE_LABELS[petType] || "").trim(),
      priceSnapshot: Number.isFinite(Number(pet?.priceSnapshot)) ? Number(pet.priceSnapshot) : 0,
      isVisible: pet?.isVisible !== false,
      createdAt: pet?.createdAt || null,
    };
  }

  function normalizePetCatalog(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const petType = String(item?.petType || item?.id || "").trim().toLowerCase();
        if (!PET_TYPES.includes(petType)) return null;
        return {
          petType,
          label: String(item?.label || PET_TYPE_LABELS[petType] || petType).trim(),
          description: String(item?.description || "").trim(),
          assetUrl: String(item?.assetUrl || PET_ASSET_URLS[petType]).trim(),
          price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
        };
      })
      .filter(Boolean);
  }

  function sortPets(items) {
    return (Array.isArray(items) ? items : [])
      .map(normalizePetItem)
      .filter(Boolean)
      .sort((left, right) => {
        const timeA = new Date(left.createdAt || 0).getTime();
        const timeB = new Date(right.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(left.id || "").localeCompare(String(right.id || ""));
      });
  }

  function buildPetDrafts(catalog, pets, previous) {
    const next = { ...(previous && typeof previous === "object" ? previous : {}) };
    const ownedByType = new Map(sortPets(pets).map((pet) => [pet.petType, pet]));
    normalizePetCatalog(catalog).forEach((item) => {
      if (ownedByType.has(item.petType)) {
        next[item.petType] = String(ownedByType.get(item.petType)?.displayName || "").trim();
      } else if (typeof next[item.petType] !== "string") {
        next[item.petType] = "";
      }
    });
    return next;
  }

  function normalizeCardPayload(card) {
    const raw = card && typeof card === "object" ? card : {};
    return {
      name: String(raw.name || "").trim(),
      role: String(raw.role || "").trim(),
      bio: String(raw.bio || "").trim(),
      hashtag: String(raw.hashtag || "").trim(),
      address: String(raw.address || "").trim(),
      postcode: String(raw.postcode || "").trim(),
      email: String(raw.email || "").trim(),
      extraPhone: String(raw.extraPhone || "").trim(),
      avatarUrl: String(raw.avatarUrl || "").trim(),
      tags: Array.isArray(raw.tags)
        ? raw.tags
          .map((item) => String((item && typeof item === "object" ? item.label : item) || "").trim())
          .filter(Boolean)
        : [],
      buttons: Array.isArray(raw.buttons) ? raw.buttons.map(createEditorButton) : [],
      theme: String(raw.theme || "default_dark").trim() || "default_dark",
      customColor: normalizeHexColor(raw.customColor),
      avatarFrame: String(raw.avatarFrame || "none").trim().toLowerCase() || "none",
      emojiBackgroundPack: String(raw.emojiBackgroundPack || "none").trim().toLowerCase() || "none",
      showBranding: raw.showBranding !== false,
      pets: sortPets(raw.pets),
    };
  }

  function selectedPreviewSlug() {
    const items = Array.isArray(state.slugs) ? state.slugs : [];
    const current = items.find((item) => item.fullSlug === state.selectedPreviewSlug) || items[0] || null;
    if (current && state.selectedPreviewSlug !== current.fullSlug) {
      state.selectedPreviewSlug = current.fullSlug;
    }
    return current;
  }

  function slugStatusLabel(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "private") return "Private";
    if (normalized === "active") return "Active";
    if (normalized === "paused") return "Paused";
    if (normalized === "approved") return "Approved";
    if (normalized === "blocked") return "Blocked";
    return normalized ? normalized : "No slug";
  }

  function renderCategories() {
    el.categories.forEach((button) => {
      const current = button.getAttribute("data-card-category") === state.category;
      button.classList.toggle("is-active", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
    });
    el.panels.forEach((panel) => {
      const current = panel.getAttribute("data-card-panel") === state.category;
      panel.classList.toggle("hidden", !current);
    });
  }

  function syncAvatarPreview() {
    const avatarUrl = pendingAvatarPreviewUrl || state.card.avatarUrl || "";
    if (el.avatarCurrent instanceof HTMLImageElement) {
      el.avatarCurrent.src = avatarUrl;
      el.avatarCurrent.classList.toggle("hidden", !avatarUrl);
    }
    if (el.avatarFallback instanceof HTMLElement) {
      el.avatarFallback.classList.toggle("hidden", Boolean(avatarUrl));
    }
    if (el.avatarRemove instanceof HTMLButtonElement) {
      el.avatarRemove.disabled = !avatarUrl;
    }
  }

  function updateBioCounter() {
    if (el.bioCounter instanceof HTMLElement) {
      el.bioCounter.textContent = `${String(el.bio.value || "").length}/120`;
    }
  }

  function saveDraft() {
    if (!state.loaded) {
      return;
    }
    try {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          category: state.category,
          selectedPreviewSlug: state.selectedPreviewSlug,
          card: {
            ...state.card,
            name: el.name.value,
            role: el.role.value,
            bio: el.bio.value,
            hashtag: el.hashtag.value,
            address: el.address.value,
            postcode: el.postcode.value,
            email: el.email.value,
            extraPhone: el.extraPhone.value,
          },
        }),
      );
    } catch {
      // Ignore draft storage failures.
    }
  }

  function applyDraft() {
    let draft = null;
    try {
      draft = JSON.parse(window.localStorage.getItem(draftStorageKey) || "null");
    } catch {
      draft = null;
    }
    if (!draft || typeof draft !== "object") {
      return;
    }

    const draftCard = draft.card && typeof draft.card === "object" ? draft.card : {};
    const nextCategory = String(draft.category || state.category).trim();
    state.category = ["main", "links", "contacts", "design", "pets"].includes(nextCategory) ? nextCategory : state.category;
    state.selectedPreviewSlug = String(draft.selectedPreviewSlug || state.selectedPreviewSlug).trim();
    state.card = {
      ...state.card,
      ...normalizeCardPayload(draftCard),
      avatarUrl: state.card.avatarUrl,
    };
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  function renderTags() {
    const tags = Array.isArray(state.card.tags) ? state.card.tags : [];
    if (!tags.length) {
      el.tagsList.innerHTML = '<div class="admin-card-helper">Теги ещё не добавлены.</div>';
    } else {
      el.tagsList.innerHTML = tags
        .map(
          (tag, index) => `
            <div class="admin-card-tag-chip" data-tag-index="${index}">
              <span>${escapeHtml(tag)}</span>
              <button type="button" data-tag-remove="${index}" aria-label="Удалить тег">x</button>
            </div>
          `,
        )
        .join("");
    }

    if (typeof window.Sortable === "function" && tags.length > 1) {
      if (tagsSortable) {
        tagsSortable.destroy();
      }
      tagsSortable = new window.Sortable(el.tagsList, {
        animation: 120,
        onEnd() {
          const next = [];
          Array.from(el.tagsList.querySelectorAll("[data-tag-index]")).forEach((node) => {
            const index = Number(node.getAttribute("data-tag-index"));
            if (Number.isInteger(index) && state.card.tags[index]) {
              next.push(state.card.tags[index]);
            }
          });
          if (next.length) {
            state.card.tags = next;
            renderTags();
            renderPreview();
            saveDraft();
          }
        },
      });
    } else if (tagsSortable) {
      tagsSortable.destroy();
      tagsSortable = null;
    }
  }

  function buttonRow(button, index) {
    const typeOptions = buttonTypeOptions
      .map(
        ([value, label]) =>
          `<option value="${escapeHtml(value)}"${value === button.type ? " selected" : ""}>${escapeHtml(label)}</option>`,
      )
      .join("");
    return `
      <div class="admin-card-button-row" data-button-index="${index}">
        <button type="button" class="admin-card-drag-handle" data-button-drag aria-label="Перетащить">::</button>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Тип</span>
          <select class="admin-card-select" data-button-field="type">${typeOptions}</select>
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Label</span>
          <input type="text" class="admin-card-input" data-button-field="label" value="${escapeHtml(button.label)}" maxlength="40" />
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">URL / Value</span>
          <input type="text" class="admin-card-input" data-button-field="value" value="${escapeHtml(button.value)}" maxlength="400" placeholder="https://t.me/username" />
        </label>
        <label class="admin-card-button-active">
          <input type="checkbox" data-button-field="active"${button.active ? " checked" : ""} />
          <span>Показывать</span>
        </label>
        <button type="button" class="admin-card-icon-btn text-sm" data-button-remove="${index}" aria-label="Удалить кнопку">x</button>
      </div>
    `;
  }

  function renderButtons() {
    const buttons = Array.isArray(state.card.buttons) ? state.card.buttons : [];
    if (!buttons.length) {
      el.buttonsList.innerHTML = '<div class="admin-card-helper">Кнопки ещё не добавлены.</div>';
    } else {
      el.buttonsList.innerHTML = buttons.map(buttonRow).join("");
    }

    if (typeof window.Sortable === "function" && buttons.length > 1) {
      if (buttonsSortable) {
        buttonsSortable.destroy();
      }
      buttonsSortable = new window.Sortable(el.buttonsList, {
        animation: 120,
        handle: "[data-button-drag]",
        onEnd() {
          const next = [];
          Array.from(el.buttonsList.querySelectorAll("[data-button-index]")).forEach((node) => {
            const index = Number(node.getAttribute("data-button-index"));
            if (Number.isInteger(index) && state.card.buttons[index]) {
              next.push(state.card.buttons[index]);
            }
          });
          if (next.length) {
            state.card.buttons = next;
            renderButtons();
            renderPreview();
            saveDraft();
          }
        },
      });
    } else if (buttonsSortable) {
      buttonsSortable.destroy();
      buttonsSortable = null;
    }
  }

  function renderThemeButtons() {
    const allThemeButtons = Array.isArray(el.themeButtons) ? el.themeButtons : [];
    allThemeButtons.forEach((button) => {
      const current = button.getAttribute("data-theme") === state.card.theme;
      button.classList.toggle("is-selected", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
    });
  }

  function renderFrameButtons() {
    const frameButtons = Array.isArray(el.frameButtons) ? el.frameButtons : [];
    frameButtons.forEach((button) => {
      const current = button.getAttribute("data-avatar-frame") === state.card.avatarFrame;
      button.classList.toggle("is-selected", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
    });
  }

  function renderEmojiPackButtons() {
    const emojiPackButtons = Array.isArray(el.emojiPackButtons) ? el.emojiPackButtons : [];
    emojiPackButtons.forEach((button) => {
      const current = button.getAttribute("data-emoji-background-pack") === state.card.emojiBackgroundPack;
      button.classList.toggle("is-selected", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
    });
  }

  function renderMeta() {
    const owner = state.owner || {};
    const previewSlug = selectedPreviewSlug();
    const slugs = Array.isArray(state.slugs) ? state.slugs : [];

    if (el.ownerName instanceof HTMLElement) {
      el.ownerName.textContent = owner.name || "UNQX User";
    }
    if (el.ownerLogin instanceof HTMLElement) {
      el.ownerLogin.textContent =
        owner.username ? `@${owner.username}` : owner.telegramUsername ? `@${owner.telegramUsername}` : owner.email || owner.id || "—";
    }
    if (el.ownerPlan instanceof HTMLElement) {
      el.ownerPlan.textContent = `Тариф: ${state.tariff === "premium" ? "Премиум" : "Без тарифа"} · Тип профиля: ${owner.profileType === "company" ? "Компания" : "Личность"}`;
    }
    if (el.ownerLink instanceof HTMLAnchorElement) {
      el.ownerLink.href = owner.id ? `/admin/users/${encodeURIComponent(owner.id)}/card` : "#";
      el.ownerLink.classList.toggle("pointer-events-none", !owner.id);
      el.ownerLink.classList.toggle("opacity-50", !owner.id);
    }

    if (el.primarySlug instanceof HTMLElement) {
      el.primarySlug.textContent = previewSlug?.fullSlug || "Нет активного slug";
    }
    if (el.primarySlugStatus instanceof HTMLElement) {
      el.primarySlugStatus.textContent = `Статус slug: ${slugStatusLabel(previewSlug?.status)}`;
    }
    if (el.primarySlugNote instanceof HTMLElement) {
      el.primarySlugNote.textContent =
        previewSlug
          ? `Просмотры на выбранном slug: ${Number(previewSlug.viewsCount || 0).toLocaleString("ru-RU")}`
          : "У пользователя пока нет slug, который можно открыть публично.";
    }

    if (el.previewSlugSelect instanceof HTMLSelectElement) {
      el.previewSlugSelect.innerHTML = slugs.length
        ? slugs
          .map(
            (slug) =>
              `<option value="${escapeHtml(slug.fullSlug)}"${slug.fullSlug === state.selectedPreviewSlug ? " selected" : ""}>${escapeHtml(slug.fullSlug)} · ${escapeHtml(slugStatusLabel(slug.status))}${slug.isPrimary ? " · primary" : ""}</option>`,
          )
          .join("")
        : '<option value="">Нет slug</option>';
    }

    if (el.publicLink instanceof HTMLAnchorElement) {
      const href = previewSlug?.fullSlug ? `/${encodeURIComponent(previewSlug.fullSlug)}` : "#";
      el.publicLink.href = href;
      el.publicLink.classList.toggle("pointer-events-none", href === "#");
      el.publicLink.classList.toggle("opacity-50", href === "#");
    }

    if (el.previewOpenLink instanceof HTMLAnchorElement) {
      const href = previewSlug?.fullSlug ? `/${encodeURIComponent(previewSlug.fullSlug)}` : "#";
      el.previewOpenLink.href = href;
      el.previewOpenLink.classList.toggle("pointer-events-none", href === "#");
      el.previewOpenLink.classList.toggle("opacity-50", href === "#");
    }

    if (el.previewSlugLabel instanceof HTMLElement) {
      el.previewSlugLabel.textContent = previewSlug?.fullSlug ? `unqx.uz/${previewSlug.fullSlug}` : "unqx.uz/[slug]";
    }

    if (el.tariffSelect instanceof HTMLSelectElement) {
      el.tariffSelect.value = state.tariff === "premium" ? "premium" : "legacy";
    }

    if (el.activeToggle instanceof HTMLButtonElement) {
      el.activeToggle.textContent = state.isActive ? "Выключить визитку" : "Включить визитку";
    }

    if (el.verificationState instanceof HTMLElement) {
      const verified = state.verification?.isVerified;
      const requestStatus = String(state.verification?.latestRequest?.status || "").trim();
      if (verified) {
        el.verificationState.textContent = "Пользователь верифицирован";
      } else if (requestStatus) {
        el.verificationState.textContent = `Последняя заявка: ${requestStatus}`;
      } else {
        el.verificationState.textContent = "Верификация не подтверждена";
      }
    }

    if (el.verifiedCompany instanceof HTMLElement) {
      el.verifiedCompany.textContent = `Компания: ${state.verification?.verifiedCompany || "—"}`;
    }
    if (el.verifiedCompanyInput instanceof HTMLInputElement) {
      el.verifiedCompanyInput.value = String(state.verification?.verifiedCompany || "").trim();
    }

    if (el.verificationRequest instanceof HTMLElement) {
      const latest = state.verification?.latestRequest;
      el.verificationRequest.textContent = latest
        ? `Slug ${latest.slug || "—"} · ${latest.companyName || "—"} · ${latest.role || "—"}`
        : "Заявка на верификацию ещё не подавалась.";
    }
  }

  function renderPetsEditor() {
    if (!(el.petsList instanceof HTMLElement)) {
      return;
    }
    const catalog = normalizePetCatalog(state.petCatalog);
    const ownedPets = sortPets(state.card.pets);
    const ownedByType = new Map(ownedPets.map((pet) => [pet.petType, pet]));
    state.petDrafts = buildPetDrafts(catalog, ownedPets, state.petDrafts);

    if (!catalog.length) {
      el.petsList.innerHTML = '<div class="admin-card-helper">Каталог животных пока недоступен.</div>';
      return;
    }

    el.petsList.innerHTML = catalog
      .map((item) => {
        const pet = ownedByType.get(item.petType) || null;
        const inputValue = pet ? pet.displayName : String(state.petDrafts?.[item.petType] || "").trim();
        return `
          <article class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4" data-admin-pet-card="${escapeHtml(item.petType)}">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="flex items-start gap-3">
                <img src="${escapeHtml(item.assetUrl)}" alt="${escapeHtml(item.label)}" class="h-20 w-20 shrink-0 object-contain" />
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="text-base font-bold text-neutral-900">${escapeHtml(item.label)}</h4>
                    <span class="rounded-full border ${pet ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-white text-neutral-500"} px-2 py-1 text-[11px] font-semibold">${pet ? "Выдан" : "Не выдан"}</span>
                  </div>
                  <p class="mt-1 text-sm text-neutral-500">${escapeHtml(item.description || "Декоративный питомец для профиля.")}</p>
                  <p class="mt-2 text-sm font-semibold text-neutral-900">${Number(item.price || 0).toLocaleString("ru-RU")} сум</p>
                </div>
              </div>
              <div class="flex w-full flex-col gap-3 md:max-w-[320px]">
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Имя животного</span>
                  <input type="text" maxlength="120" value="${escapeHtml(inputValue)}" data-pet-name-input="${escapeHtml(item.petType)}" class="admin-card-input" />
                </label>
                ${pet
                  ? `<label class="inline-flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">
                      <span>Показывать на визитке</span>
                      <input type="checkbox" data-pet-visible-toggle="${escapeHtml(pet.id || item.petType)}" ${pet.isVisible ? "checked" : ""} />
                    </label>`
                  : `<button type="button" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100" data-pet-grant="${escapeHtml(item.petType)}">Выдать вручную</button>`
                }
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function buildPreviewPayload() {
    const previewSlug = selectedPreviewSlug();
    const activeButtons = (Array.isArray(state.card.buttons) ? state.card.buttons : [])
      .filter((button) => button.active !== false)
      .map((button) => ({
        type: button.type,
        label: button.label,
        href: button.value,
        value: button.value,
      }));
    return {
      slug: previewSlug?.fullSlug || "UNQ",
      name: el.name.value || state.owner?.name || "UNQX User",
      role: el.role.value || "",
      bio: el.bio.value || "",
      hashtag: el.hashtag.value || "",
      address: el.address.value || "",
      postcode: el.postcode.value || "",
      email: el.email.value || "",
      extraPhone: el.extraPhone.value || "",
      avatarUrl: pendingAvatarPreviewUrl || state.card.avatarUrl || "",
      tags: state.card.tags.slice(0),
      buttons: activeButtons,
      verified: Boolean(state.verification?.isVerified),
      verifiedCompany: String(state.verification?.verifiedCompany || "").trim(),
      tariff: state.tariff === "premium" ? "premium" : "none",
      theme: state.card.theme || "default_dark",
      customColor: normalizeHexColor(state.card.customColor),
      avatarFrame: state.card.avatarFrame || "none",
      emojiBackgroundPack: state.card.emojiBackgroundPack || "none",
      showBranding: state.card.showBranding !== false,
      pets: sortPets(state.card.pets),
    };
  }

  function renderPreview() {
    if (typeof window.CardView === "undefined") {
      return;
    }
    const previewSlug = selectedPreviewSlug();
    const payload = buildPreviewPayload();
    el.preview.dataset.previewTheme = payload.theme || "default_dark";
    el.preview.dataset.previewFrame = payload.avatarFrame || "none";
    window.CardView.mountCardView(el.preview, payload, {
      shareUrl: previewSlug?.fullSlug ? `${window.location.origin}/${encodeURIComponent(previewSlug.fullSlug)}` : window.location.href,
      showPausedBanner: previewSlug?.status === "paused",
      pausedText: "Slug на паузе. Публичный экран сейчас скрыт для посетителей.",
      viewsLabel: `${Number(previewSlug?.viewsCount || 0).toLocaleString("ru-RU")} просмотров`,
    });
  }

  function syncInputsFromState() {
    el.name.value = state.card.name || "";
    el.role.value = state.card.role || "";
    el.bio.value = state.card.bio || "";
    el.hashtag.value = state.card.hashtag || "";
    el.address.value = state.card.address || "";
    el.postcode.value = state.card.postcode || "";
    el.email.value = state.card.email || "";
    el.extraPhone.value = state.card.extraPhone || "";
    if (el.customColor instanceof HTMLInputElement) {
      el.customColor.value = state.card.customColor || "#111111";
    }
    if (el.hideBranding instanceof HTMLInputElement) {
      el.hideBranding.checked = state.card.showBranding === false;
    }
    updateBioCounter();
    syncAvatarPreview();
    renderThemeButtons();
    renderFrameButtons();
    renderEmojiPackButtons();
    renderTags();
    renderButtons();
    renderPetsEditor();
    renderMeta();
    renderCategories();
    renderPreview();
  }

  function readInputsIntoState() {
    state.card.name = String(el.name.value || "").trim();
    state.card.role = String(el.role.value || "").trim();
    state.card.bio = String(el.bio.value || "").trim();
    state.card.hashtag = String(el.hashtag.value || "").trim();
    state.card.address = String(el.address.value || "").trim();
    state.card.postcode = String(el.postcode.value || "").trim();
    state.card.email = String(el.email.value || "").trim();
    state.card.extraPhone = String(el.extraPhone.value || "").trim();
    state.card.customColor = normalizeHexColor(el.customColor?.value);
    state.card.showBranding = !(el.hideBranding instanceof HTMLInputElement && el.hideBranding.checked);
    if (el.verifiedCompanyInput instanceof HTMLInputElement) {
      if (!state.verification || typeof state.verification !== "object") {
        state.verification = {
          isVerified: false,
          latestRequest: null,
          verifiedCompany: "",
        };
      }
      state.verification.verifiedCompany = String(el.verifiedCompanyInput.value || "").trim();
    }
  }

  function handleInputChange() {
    readInputsIntoState();
    updateBioCounter();
    renderPreview();
    saveDraft();
  }

  function addTag() {
    const raw = String(el.tagInput?.value || "").trim().replace(/^#+/, "");
    if (!raw) {
      return;
    }
    const nextTag = `#${raw.slice(0, 30)}`;
    if (!state.card.tags.includes(nextTag)) {
      state.card.tags.push(nextTag);
      renderTags();
      renderPreview();
      saveDraft();
    }
    if (el.tagInput instanceof HTMLInputElement) {
      el.tagInput.value = "";
      el.tagInput.focus();
    }
  }

  function addButton() {
    state.card.buttons.push(createEmptyButton());
    renderButtons();
    renderPreview();
    saveDraft();
  }

  function updateButtonField(row, field, value) {
    const index = Number(row.getAttribute("data-button-index"));
    if (!Number.isInteger(index) || !state.card.buttons[index]) {
      return;
    }
    const button = state.card.buttons[index];
    if (field === "active") {
      button.active = Boolean(value);
    } else if (field === "type") {
      button.type = String(value || "other").trim().toLowerCase() || "other";
    } else if (field === "label") {
      button.label = String(value || "").trim().slice(0, 40);
    } else if (field === "value") {
      button.value = String(value || "").trim().slice(0, 400);
    }
    renderPreview();
    saveDraft();
  }

  function destroyCropper() {
    if (cropper && typeof cropper.destroy === "function") {
      cropper.destroy();
    }
    cropper = null;
    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = "";
    }
    if (el.avatarCropWrap instanceof HTMLElement) {
      el.avatarCropWrap.classList.add("hidden");
    }
  }

  function setPendingAvatarPreview(url, blob) {
    if (pendingAvatarPreviewUrl && pendingAvatarPreviewUrl !== url) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
    }
    pendingAvatarPreviewUrl = url;
    pendingAvatarBlob = blob || null;
    syncAvatarPreview();
    renderPreview();
  }

  function prepareAvatar(file) {
    if (!(file instanceof File)) {
      return;
    }
    destroyCropper();
    sourceObjectUrl = URL.createObjectURL(file);
    if (el.avatarCropImage instanceof HTMLImageElement) {
      el.avatarCropImage.src = sourceObjectUrl;
    }
    if (el.avatarCropWrap instanceof HTMLElement) {
      el.avatarCropWrap.classList.remove("hidden");
    }
    const CropperCtor = window.Cropper;
    if (typeof CropperCtor !== "function" || !(el.avatarCropImage instanceof HTMLImageElement)) {
      return;
    }
    cropper = new CropperCtor(el.avatarCropImage, {
      aspectRatio: 1,
      viewMode: 1,
      background: false,
      autoCropArea: 1,
    });
    if (el.avatarUpload instanceof HTMLButtonElement) {
      el.avatarUpload.textContent = "Сохранить аватар";
    }
  }

  async function uploadAvatar() {
    showFormError("");
    if (!(el.avatarUpload instanceof HTMLButtonElement)) {
      return;
    }

    let blob = pendingAvatarBlob;
    if (!blob && cropper && typeof cropper.getCroppedCanvas === "function") {
      blob = await new Promise((resolve) => {
        cropper.getCroppedCanvas({ width: 720, height: 720 }).toBlob(resolve, "image/webp", 0.92);
      });
    }

    if (!(blob instanceof Blob)) {
      showFormError("Сначала выбери изображение и подготовь crop.");
      return;
    }

    const formData = new FormData();
    formData.append("file", blob, "avatar.webp");
    el.avatarUpload.disabled = true;
    el.avatarUpload.textContent = "Загрузка...";

    try {
      const payload = await api(`/api/admin/cards/${encodeURIComponent(cardId)}/avatar`, {
        method: "POST",
        body: formData,
      });
      state.card.avatarUrl = String(payload.avatarUrl || "").trim();
      if (pendingAvatarPreviewUrl) {
        URL.revokeObjectURL(pendingAvatarPreviewUrl);
      }
      pendingAvatarPreviewUrl = "";
      pendingAvatarBlob = null;
      destroyCropper();
      syncAvatarPreview();
      renderPreview();
      saveDraft();
      setSaveStatus("Аватар обновлён", "success");
    } catch (error) {
      showFormError(error.message || "Не удалось загрузить аватар");
    } finally {
      el.avatarUpload.disabled = false;
      el.avatarUpload.textContent = "Сохранить аватар";
    }
  }

  async function removeAvatar() {
    showFormError("");
    try {
      await api(`/api/admin/cards/${encodeURIComponent(cardId)}/avatar`, {
        method: "DELETE",
      });
      state.card.avatarUrl = "";
      if (pendingAvatarPreviewUrl) {
        URL.revokeObjectURL(pendingAvatarPreviewUrl);
      }
      pendingAvatarPreviewUrl = "";
      pendingAvatarBlob = null;
      destroyCropper();
      syncAvatarPreview();
      renderPreview();
      saveDraft();
      setSaveStatus("Аватар удалён", "success");
    } catch (error) {
      showFormError(error.message || "Не удалось удалить аватар");
    }
  }

  async function applyTariff() {
    showFormError("");
    if (!(el.tariffSelect instanceof HTMLSelectElement) || !(el.tariffApply instanceof HTMLButtonElement)) {
      return;
    }
    const tariff = el.tariffSelect.value === "premium" ? "premium" : "legacy";
    el.tariffApply.disabled = true;
    try {
      const payload = await api(`/api/admin/cards/${encodeURIComponent(cardId)}/tariff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariff }),
      });
      state.tariff = payload.tariff === "premium" ? "premium" : "legacy";
      renderMeta();
      renderPreview();
      setSaveStatus("Тариф обновлён", "success");
    } catch (error) {
      showFormError(error.message || "Не удалось обновить тариф");
    } finally {
      el.tariffApply.disabled = false;
    }
  }

  async function toggleCardActive() {
    showFormError("");
    if (!(el.activeToggle instanceof HTMLButtonElement)) {
      return;
    }
    el.activeToggle.disabled = true;
    try {
      const payload = await api(`/api/admin/cards/${encodeURIComponent(cardId)}/toggle-active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !state.isActive }),
      });
      state.isActive = Boolean(payload.isActive);
      const fresh = await api(`/api/admin/cards/${encodeURIComponent(cardId)}`);
      hydrateFromPayload(fresh);
      setSaveStatus(state.isActive ? "Визитка включена" : "Визитка поставлена на паузу", "success");
    } catch (error) {
      showFormError(error.message || "Не удалось обновить статус");
    } finally {
      el.activeToggle.disabled = false;
    }
  }

  function buildSavePayload() {
    readInputsIntoState();
    return {
      name: state.card.name,
      role: state.card.role,
      bio: state.card.bio,
      hashtag: state.card.hashtag,
      address: state.card.address,
      postcode: state.card.postcode,
      email: state.card.email,
      extraPhone: state.card.extraPhone,
      tags: state.card.tags.slice(0),
      buttons: state.card.buttons.map((button) => ({
        id: button.id,
        type: button.type,
        label: button.label,
        href: button.value,
        value: button.value,
        active: button.active !== false,
      })),
      theme: state.card.theme,
      customColor: normalizeHexColor(state.card.customColor) || null,
      avatarFrame: state.card.avatarFrame,
      emojiBackgroundPack: state.card.emojiBackgroundPack,
      showBranding: state.card.showBranding !== false,
      pets: sortPets(state.card.pets).map((pet) => ({
        id: pet.id || "",
        petType: pet.petType,
        displayName: pet.displayName,
        isVisible: pet.isVisible !== false,
      })),
      verifiedCompany:
        state.verification && typeof state.verification === "object"
          ? String(state.verification.verifiedCompany || "").trim()
          : "",
    };
  }

  async function saveCard() {
    showPageError("");
    showFormError("");
    if (!(el.saveButton instanceof HTMLButtonElement)) {
      return;
    }
    const payload = buildSavePayload();
    if (!payload.name) {
      showFormError("Имя обязательно для сохранения визитки.");
      state.category = "main";
      renderCategories();
      return;
    }
    el.saveButton.disabled = true;
    setSaveStatus("Сохраняем...");

    try {
      const response = await api(`/api/admin/cards/${encodeURIComponent(cardId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      clearDraft();
      hydrateFromPayload(response);
      setSaveStatus("Визитка сохранена", "success");
    } catch (error) {
      showFormError(error.message || "Не удалось сохранить визитку");
      setSaveStatus("Сохранение не удалось", "error");
    } finally {
      el.saveButton.disabled = false;
    }
  }

  function hydrateFromPayload(payload) {
    state.owner = payload?.owner || null;
    state.verification = payload?.verification || null;
    state.slugs = Array.isArray(payload?.slugs) ? payload.slugs.slice(0) : [];
    state.isActive = Boolean(payload?.isActive);
    state.tariff = payload?.tariff === "premium" ? "premium" : "legacy";
    state.petCatalog = normalizePetCatalog(payload?.petCatalog);
    state.card = normalizeCardPayload(payload?.card);
    state.petDrafts = buildPetDrafts(state.petCatalog, state.card.pets, state.petDrafts);
    state.selectedPreviewSlug = String(payload?.previewSlug?.fullSlug || state.selectedPreviewSlug || "").trim();
    if (!state.selectedPreviewSlug && state.slugs[0]?.fullSlug) {
      state.selectedPreviewSlug = state.slugs[0].fullSlug;
    }
    applyDraft();
    syncInputsFromState();
    state.loaded = true;
  }

  async function loadCard() {
    showPageError("");
    showFormError("");
    setSaveStatus("Загрузка...");
    try {
      const payload = await api(`/api/admin/cards/${encodeURIComponent(cardId)}`);
      hydrateFromPayload(payload);
      setSaveStatus("");
    } catch (error) {
      showPageError(error.message || "Не удалось загрузить визитку");
      setSaveStatus("Загрузка не удалась", "error");
    }
  }

  el.categories.forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.getAttribute("data-card-category") || "main";
      renderCategories();
      saveDraft();
    });
  });

  el.name.addEventListener("input", handleInputChange);
  el.role.addEventListener("input", handleInputChange);
  el.bio.addEventListener("input", handleInputChange);
  el.hashtag.addEventListener("input", handleInputChange);
  el.address.addEventListener("input", handleInputChange);
  el.postcode.addEventListener("input", handleInputChange);
  el.email.addEventListener("input", handleInputChange);
  el.extraPhone.addEventListener("input", handleInputChange);
  if (el.verifiedCompanyInput instanceof HTMLInputElement) {
    el.verifiedCompanyInput.addEventListener("input", handleInputChange);
  }
  if (el.customColor instanceof HTMLInputElement) {
    el.customColor.addEventListener("input", handleInputChange);
  }
  if (el.hideBranding instanceof HTMLInputElement) {
    el.hideBranding.addEventListener("change", handleInputChange);
  }

  if (el.tagAdd instanceof HTMLButtonElement) {
    el.tagAdd.addEventListener("click", addTag);
  }
  if (el.tagInput instanceof HTMLInputElement) {
    el.tagInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag();
      }
    });
  }
  el.tagsList.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-tag-remove]") : null;
    if (!button) {
      return;
    }
    const index = Number(button.getAttribute("data-tag-remove"));
    if (!Number.isInteger(index)) {
      return;
    }
    state.card.tags.splice(index, 1);
    renderTags();
    renderPreview();
    saveDraft();
  });

  if (el.buttonAdd instanceof HTMLButtonElement) {
    el.buttonAdd.addEventListener("click", addButton);
  }
  el.buttonsList.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const row = target.closest("[data-button-index]");
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const field = target.getAttribute("data-button-field");
    if (!field) {
      return;
    }
    updateButtonField(row, field, target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : "");
  });
  el.buttonsList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const row = target.closest("[data-button-index]");
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const field = target.getAttribute("data-button-field");
    if (field === "active" && target instanceof HTMLInputElement) {
      updateButtonField(row, field, target.checked);
      return;
    }
    if (field && (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      updateButtonField(row, field, target.value);
    }
  });
  el.buttonsList.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-button-remove]") : null;
    if (!target) {
      return;
    }
    const index = Number(target.getAttribute("data-button-remove"));
    if (!Number.isInteger(index)) {
      return;
    }
    state.card.buttons.splice(index, 1);
    renderButtons();
    renderPreview();
    saveDraft();
  });

  el.petsList?.addEventListener("input", (event) => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    if (!target) return;
    const petType = String(target.getAttribute("data-pet-name-input") || "").trim().toLowerCase();
    if (!PET_TYPES.includes(petType)) return;
    const value = String(target.value || "").trim().slice(0, 120);
    const ownedPets = sortPets(state.card.pets);
    if (ownedPets.some((pet) => pet.petType === petType)) {
      state.card.pets = ownedPets.map((pet) =>
        pet.petType === petType
          ? {
            ...pet,
            displayName: value || PET_TYPE_LABELS[petType],
          }
          : pet,
      );
    } else {
      state.petDrafts = {
        ...(state.petDrafts || {}),
        [petType]: value,
      };
    }
    renderPreview();
    saveDraft();
  });

  el.petsList?.addEventListener("change", (event) => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    if (!target) return;
    const petId = String(target.getAttribute("data-pet-visible-toggle") || "").trim();
    if (!petId) return;
    state.card.pets = sortPets(state.card.pets).map((pet) =>
      (pet.id || pet.petType) === petId
        ? {
          ...pet,
          isVisible: target.checked,
        }
        : pet,
    );
    renderPreview();
    saveDraft();
  });

  el.petsList?.addEventListener("click", (event) => {
    const trigger = event.target instanceof HTMLElement ? event.target.closest("[data-pet-grant]") : null;
    if (!trigger) return;
    const petType = String(trigger.getAttribute("data-pet-grant") || "").trim().toLowerCase();
    if (!PET_TYPES.includes(petType)) return;
    if (sortPets(state.card.pets).some((pet) => pet.petType === petType)) return;
    const draftName = String(state.petDrafts?.[petType] || "").trim();
    const catalogItem = normalizePetCatalog(state.petCatalog).find((item) => item.petType === petType) || null;
    state.card.pets = sortPets([
      ...sortPets(state.card.pets),
      {
        id: "",
        petType,
        label: PET_TYPE_LABELS[petType],
        assetUrl: PET_ASSET_URLS[petType],
        displayName: draftName || PET_TYPE_LABELS[petType],
        priceSnapshot: Number(catalogItem?.price || 0),
        isVisible: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderPetsEditor();
    renderPreview();
    saveDraft();
  });

  el.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.getAttribute("data-theme") || "default_dark";
      state.card.theme = theme;
      renderThemeButtons();
      renderPreview();
      saveDraft();
    });
  });

  el.frameButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const frame = button.getAttribute("data-avatar-frame") || "none";
      state.card.avatarFrame = frame;
      renderFrameButtons();
      renderPreview();
      saveDraft();
    });
  });

  el.emojiPackButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const pack = button.getAttribute("data-emoji-background-pack") || "none";
      state.card.emojiBackgroundPack = pack;
      renderEmojiPackButtons();
      renderPreview();
      saveDraft();
    });
  });

  if (el.previewSlugSelect instanceof HTMLSelectElement) {
    el.previewSlugSelect.addEventListener("change", () => {
      state.selectedPreviewSlug = el.previewSlugSelect.value;
      renderMeta();
      renderPreview();
      saveDraft();
    });
  }

  if (el.avatarFile instanceof HTMLInputElement) {
    el.avatarFile.addEventListener("change", () => {
      const file = el.avatarFile.files && el.avatarFile.files[0];
      if (file) {
        prepareAvatar(file);
      }
    });
  }

  if (el.avatarUpload instanceof HTMLButtonElement) {
    el.avatarUpload.addEventListener("click", () => {
      void uploadAvatar();
    });
  }

  if (el.avatarRemove instanceof HTMLButtonElement) {
    el.avatarRemove.addEventListener("click", () => {
      void removeAvatar();
    });
  }

  if (el.tariffApply instanceof HTMLButtonElement) {
    el.tariffApply.addEventListener("click", () => {
      void applyTariff();
    });
  }

  if (el.activeToggle instanceof HTMLButtonElement) {
    el.activeToggle.addEventListener("click", () => {
      void toggleCardActive();
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveCard();
  });

  window.addEventListener("beforeunload", () => {
    if (pendingAvatarPreviewUrl) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
    }
    destroyCropper();
  });

  void loadCard();
})();
