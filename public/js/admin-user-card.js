(function () {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-user-card") {
    return;
  }

  const userId = String(body.getAttribute("data-user-id") || "").trim();
  if (!userId) {
    return;
  }

  const $ = (s) => document.querySelector(s);
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const el = {
    title: $("#user-card-title"),
    subtitle: $("#user-card-subtitle"),
    error: $("#user-card-error"),
    form: $("#user-card-form"),
    name: $("#user-card-name"),
    company: $("#user-card-company"),
    role: $("#user-card-role"),
    bio: $("#user-card-bio"),
    hashtag: $("#user-card-hashtag"),
    address: $("#user-card-address"),
    postcode: $("#user-card-postcode"),
    email: $("#user-card-email"),
    extraPhone: $("#user-card-extra-phone"),
    tagInput: $("#user-card-tag-input"),
    tagAdd: $("#user-card-tag-add"),
    tagsList: $("#user-card-tags-list"),
    tagsLimit: $("#user-card-tags-limit"),
    buttonAdd: $("#user-card-button-add"),
    buttonsList: $("#user-card-buttons-list"),
    buttonsLimit: $("#user-card-buttons-limit"),
    theme: $("#user-card-theme"),
    customColor: $("#user-card-custom-color"),
    branding: $("#user-card-show-branding"),
    save: $("#user-card-save"),
    avatarPreview: $("#user-card-avatar-preview"),
    avatarFallback: $("#user-card-avatar-fallback"),
    avatarFile: $("#user-card-avatar-file"),
    avatarUpload: $("#user-card-avatar-upload"),
    avatarRemove: $("#user-card-avatar-remove"),
  };

  if (
    !(el.form instanceof HTMLFormElement) ||
    !(el.name instanceof HTMLInputElement) ||
    !(el.tagsList instanceof HTMLElement) ||
    !(el.buttonsList instanceof HTMLElement) ||
    !(el.theme instanceof HTMLSelectElement)
  ) {
    return;
  }

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  const buttonTypeLabels = {
    phone: "Позвонить",
    telegram: "Telegram",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    whatsapp: "WhatsApp",
    website: "Сайт",
    card: "Карта",
    other: "Другое",
  };
  const buttonTypeOptions = Object.entries(buttonTypeLabels);

  const state = {
    user: null,
    card: null,
    tags: [],
    buttons: [],
    limits: { tags: 0, buttons: 0 },
    themes: [],
    plan: "none",
    theme: "default_dark",
  };

  let pendingAvatarFile = null;
  let pendingAvatarPreviewUrl = "";

  function showAlert(message, title) {
    if (window.UNQAdminDialog && typeof window.UNQAdminDialog.alert === "function") {
      return window.UNQAdminDialog.alert(String(message || ""), { title: String(title || "Сообщение") });
    }
    alert(message);
    return Promise.resolve();
  }

  function setError(message) {
    if (!(el.error instanceof HTMLElement)) return;
    if (!message) {
      el.error.classList.add("hidden");
      el.error.textContent = "";
      return;
    }
    el.error.textContent = String(message || "");
    el.error.classList.remove("hidden");
  }

  function setLoading(loading) {
    if (!(el.form instanceof HTMLElement)) return;
    el.form.classList.toggle("opacity-60", loading);
    el.form.classList.toggle("pointer-events-none", loading);
  }

  async function api(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
    const response = await fetch(url, { ...options, headers });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error((payload && payload.error) || "Ошибка запроса");
      error.status = response.status;
      error.code = payload && payload.code ? payload.code : "";
      throw error;
    }
    return payload || {};
  }

  function planLabel(plan) {
    if (plan === "premium") return "Премиум";
    if (plan === "basic") return "Базовый";
    return "Без тарифа";
  }

  function updateHeader() {
    const name =
      state.user?.displayName ||
      state.user?.firstName ||
      state.user?.username ||
      state.user?.email ||
      state.user?.id ||
      "Пользователь";
    if (el.title) {
      el.title.textContent = `Визитка: ${name}`;
    }
    if (el.subtitle) {
      el.subtitle.textContent = `План: ${planLabel(state.plan)} · ID: ${state.user?.id || userId}`;
    }
  }

  function updateAvatar(url) {
    if (!(el.avatarPreview instanceof HTMLImageElement) || !(el.avatarFallback instanceof HTMLElement)) return;
    const hasUrl = Boolean(url);
    el.avatarPreview.src = hasUrl ? url : "";
    el.avatarPreview.classList.toggle("hidden", !hasUrl);
    el.avatarFallback.classList.toggle("hidden", hasUrl);
  }

  function renderTags() {
    if (!(el.tagsList instanceof HTMLElement)) return;
    el.tagsList.innerHTML = state.tags
      .map(
        (tag, index) =>
          `<span class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs">${esc(tag)} <button data-a="rm-tag" data-i="${index}" class="text-neutral-500">x</button></span>`,
      )
      .join("");
  }

  function buttonRow(button, index) {
    const url =
      typeof button.url === "string" && button.url.length > 0
        ? button.url
        : typeof button.href === "string" && button.href.length > 0
          ? button.href
          : typeof button.value === "string"
            ? button.value
            : "";
    const selectedType = Object.prototype.hasOwnProperty.call(buttonTypeLabels, button.type) ? button.type : "other";
    const options = buttonTypeOptions
      .map(([value, label]) => `<option value="${value}" ${selectedType === value ? "selected" : ""}>${label}</option>`)
      .join("");

    return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_1fr_auto]" data-bi="${index}">
      <select data-bf="type" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">${options}</select>
      <input data-bf="label" value="${esc(button.label || "")}" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <input data-bf="href" value="${esc(url)}" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <button data-a="rm-btn" data-i="${index}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Удалить</button>
    </div>`;
  }

  function renderButtons() {
    if (!(el.buttonsList instanceof HTMLElement)) return;
    el.buttonsList.innerHTML = state.buttons.map((button, index) => buttonRow(button, index)).join("");
  }

  function renderThemes() {
    if (!(el.theme instanceof HTMLSelectElement)) return;
    const isPremium = state.plan === "premium";
    const themes = state.themes.length ? state.themes : ["default_dark"];
    el.theme.innerHTML = themes
      .map((theme) => {
        const disabled = !isPremium && theme !== "default_dark";
        const label = theme.replace(/_/g, " ");
        return `<option value="${theme}" ${theme === state.theme ? "selected" : ""} ${disabled ? "disabled" : ""}>${label}</option>`;
      })
      .join("");

    if (el.customColor instanceof HTMLInputElement) {
      el.customColor.disabled = !isPremium;
    }
    if (el.branding instanceof HTMLInputElement) {
      el.branding.disabled = !isPremium;
    }
  }

  function updateLimits() {
    if (el.tagsLimit) {
      el.tagsLimit.textContent = state.limits.tags ? `Лимит: ${state.limits.tags}` : "";
    }
    if (el.buttonsLimit) {
      el.buttonsLimit.textContent = state.limits.buttons ? `Лимит: ${state.limits.buttons}` : "";
    }
  }

  function setFormValues() {
    const card = state.card || {};
    const fallbackName =
      state.user?.displayName || state.user?.firstName || state.user?.username || state.user?.email || "";
    if (el.name) el.name.value = card.name || fallbackName || "";
    if (el.company) el.company.value = state.user?.verifiedCompany || "";
    if (el.role) el.role.value = card.role || "";
    if (el.bio) el.bio.value = card.bio || "";
    if (el.hashtag) el.hashtag.value = card.hashtag || "";
    if (el.address) el.address.value = card.address || "";
    if (el.postcode) el.postcode.value = card.postcode || "";
    if (el.email) el.email.value = card.email || "";
    if (el.extraPhone) el.extraPhone.value = card.extraPhone || "";
    if (el.customColor) el.customColor.value = card.customColor || "#111111";
    if (el.branding) el.branding.checked = card.showBranding === false;
    state.theme = typeof card.theme === "string" ? card.theme : "default_dark";
    if (state.plan !== "premium" && state.theme !== "default_dark") {
      state.theme = "default_dark";
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/card`);
      state.user = payload.user || null;
      state.card = payload.card || null;
      state.limits = payload.limits || { tags: 0, buttons: 0 };
      state.themes = Array.isArray(payload.themes) ? payload.themes : ["default_dark"];
      state.plan = state.user?.plan || "none";

      state.tags = Array.isArray(state.card?.tags) ? state.card.tags.slice(0) : [];
      state.buttons = Array.isArray(state.card?.buttons)
        ? state.card.buttons.map((b) => ({
          ...b,
          url: typeof b.url === "string" ? b.url : (typeof b.href === "string" ? b.href : (typeof b.value === "string" ? b.value : "")),
        }))
        : [];

      setFormValues();
      updateHeader();
      updateAvatar(state.card?.avatarUrl || "");
      renderThemes();
      renderTags();
      renderButtons();
      updateLimits();
    } catch (error) {
      setError(error.message || "Не удалось загрузить визитку");
    } finally {
      setLoading(false);
    }
  }

  async function saveCard() {
    const name = (el.name?.value || "").trim();
    if (!name) {
      await showAlert("Имя обязательно для визитки.", "Проверь поля");
      return;
    }
    const email = (el.email?.value || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await showAlert("Некорректный email.", "Проверь поля");
      return;
    }

    try {
      setLoading(true);
      const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/card`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company: el.company?.value || "",
          role: el.role?.value || "",
          bio: el.bio?.value || "",
          hashtag: el.hashtag?.value || "",
          address: el.address?.value || "",
          postcode: el.postcode?.value || "",
          email,
          extraPhone: el.extraPhone?.value || "",
          tags: state.tags,
          buttons: (state.buttons || []).map((b) => ({
            id: b.id,
            type: b.type || "other",
            label: b.label || "",
            href: typeof b.url === "string" ? b.url : (typeof b.href === "string" ? b.href : ""),
            value: typeof b.url === "string" ? b.url : (typeof b.value === "string" ? b.value : ""),
          })),
          theme: state.theme,
          customColor: el.customColor?.value || null,
          showBranding: el.branding ? !el.branding.checked : true,
        }),
      });
      if (payload.card) {
        state.card = payload.card;
        state.user = { ...(state.user || {}), verifiedCompany: payload.user?.verifiedCompany || el.company?.value || "" };
        state.tags = Array.isArray(payload.card.tags) ? payload.card.tags.slice(0) : [];
        state.buttons = Array.isArray(payload.card.buttons) ? payload.card.buttons.slice(0) : [];
        state.theme = typeof payload.card.theme === "string" ? payload.card.theme : state.theme;
        if (el.customColor) el.customColor.value = payload.card.customColor || "#111111";
        if (el.branding) el.branding.checked = payload.card.showBranding === false;
        renderTags();
        renderButtons();
        renderThemes();
      }
      await showAlert("Изменения сохранены.");
    } catch (error) {
      if (error.code === "UPGRADE_REQUIRED") {
        await showAlert("Эта функция доступна только для Премиум тарифа.");
        return;
      }
      if (error.code === "PLAN_REQUIRED") {
        await showAlert("У пользователя не активирован тариф.", "Недоступно");
        return;
      }
      await showAlert(error.message || "Не удалось сохранить визитку");
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar() {
    if (!pendingAvatarFile) {
      await showAlert("Сначала выберите файл.");
      return;
    }
    const formData = new FormData();
    formData.append("file", pendingAvatarFile);
    try {
      setLoading(true);
      const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/card/avatar`, {
        method: "POST",
        body: formData,
      });
      if (payload && payload.avatarUrl) {
        updateAvatar(payload.avatarUrl);
        state.card = { ...(state.card || {}), avatarUrl: payload.avatarUrl };
      }
      if (pendingAvatarPreviewUrl) {
        URL.revokeObjectURL(pendingAvatarPreviewUrl);
        pendingAvatarPreviewUrl = "";
      }
      pendingAvatarFile = null;
      if (el.avatarFile instanceof HTMLInputElement) {
        el.avatarFile.value = "";
      }
      await showAlert("Аватар обновлен.");
    } catch (error) {
      await showAlert(error.message || "Не удалось загрузить аватар");
    } finally {
      setLoading(false);
    }
  }

  async function removeAvatar() {
    try {
      setLoading(true);
      await api(`/api/admin/users/${encodeURIComponent(userId)}/card/avatar`, {
        method: "DELETE",
      });
      updateAvatar("");
      state.card = { ...(state.card || {}), avatarUrl: "" };
      await showAlert("Аватар удален.");
    } catch (error) {
      await showAlert(error.message || "Не удалось удалить аватар");
    } finally {
      setLoading(false);
    }
  }

  el.tagAdd?.addEventListener("click", async () => {
    const raw = el.tagInput instanceof HTMLInputElement ? el.tagInput.value.trim() : "";
    if (!raw) return;
    const limit = state.limits.tags || 0;
    if (limit && state.tags.length >= limit) {
      await showAlert(`Можно добавить до ${limit} тегов.`);
      return;
    }
    state.tags.push((raw.startsWith("#") ? raw : `#${raw}`).slice(0, 32));
    if (el.tagInput) el.tagInput.value = "";
    renderTags();
  });

  el.tagsList?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const removeBtn = target?.closest('[data-a="rm-tag"]');
    if (!(removeBtn instanceof HTMLElement)) return;
    event.preventDefault();
    const index = Number(removeBtn.getAttribute("data-i"));
    if (!Number.isFinite(index) || index < 0 || index >= state.tags.length) return;
    state.tags.splice(index, 1);
    renderTags();
  });

  el.buttonAdd?.addEventListener("click", async () => {
    const limit = state.limits.buttons || 0;
    if (limit && state.buttons.length >= limit) {
      await showAlert("Для большего количества кнопок нужен Премиум.");
      return;
    }
    state.buttons.push({
      id: `${Date.now()}_${Math.random()}`,
      type: "other",
      label: buttonTypeLabels.other,
      href: "",
      value: "",
    });
    renderButtons();
  });

  const handleButtonsChange = (event) => {
    const node = event.target instanceof HTMLElement ? event.target : null;
    if (!node) return;
    const row = node.closest("[data-bi]");
    if (!(row instanceof HTMLElement)) return;
    const index = Number(row.getAttribute("data-bi"));
    if (!state.buttons[index]) return;

    const typeField = row.querySelector('[data-bf="type"]');
    const labelField = row.querySelector('[data-bf="label"]');
    const hrefField = row.querySelector('[data-bf="href"]');

    const prev = state.buttons[index];
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

    state.buttons[index] = {
      ...prev,
      type,
      label,
      href,
      value: href,
      url: href,
    };
  };

  el.buttonsList?.addEventListener("input", handleButtonsChange);
  el.buttonsList?.addEventListener("change", handleButtonsChange);

  el.buttonsList?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const removeBtn = target?.closest('[data-a="rm-btn"]');
    if (!(removeBtn instanceof HTMLElement)) return;
    event.preventDefault();
    const index = Number(removeBtn.getAttribute("data-i"));
    if (!Number.isFinite(index) || index < 0 || index >= state.buttons.length) return;
    state.buttons.splice(index, 1);
    renderButtons();
  });

  el.theme?.addEventListener("change", () => {
    if (!(el.theme instanceof HTMLSelectElement)) return;
    state.theme = el.theme.value || "default_dark";
  });

  el.save?.addEventListener("click", saveCard);

  el.avatarFile?.addEventListener("change", () => {
    const file = el.avatarFile?.files && el.avatarFile.files[0];
    if (!file) return;
    pendingAvatarFile = file;
    if (pendingAvatarPreviewUrl) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
    }
    pendingAvatarPreviewUrl = URL.createObjectURL(file);
    updateAvatar(pendingAvatarPreviewUrl);
  });

  el.avatarUpload?.addEventListener("click", uploadAvatar);
  el.avatarRemove?.addEventListener("click", removeAvatar);

  load();
})();
