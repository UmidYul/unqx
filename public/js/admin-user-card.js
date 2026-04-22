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
    profileForm: $("#user-profile-form"),
    profileFirstName: $("#user-profile-first-name"),
    profileDisplayName: $("#user-profile-display-name"),
    profileCity: $("#user-profile-city"),
    profileType: $("#user-profile-type"),
    profileTelegram: $("#user-profile-telegram"),
    profileEmail: $("#user-profile-email"),
    profileSave: $("#user-profile-save"),
    profileStatus: $("#user-profile-status"),
    slugsList: $("#user-card-slugs-list"),
    slugAdd: $("#user-card-slug-add"),
    slugsStatus: $("#user-card-slugs-status"),
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
  const RESERVED_ASSIGNABLE_SLUGS = new Set(["ADMIN", "API", "AUTH", "FAQ", "MANAGER", "PROFILE", "QR", "TERMS"]);
  const assignableSlugHint = "AAA000, 0-999 или A-Z до 3 букв";
  const normalizeSlug = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const isLegacySlug = (value) => /^[A-Z]{3}[0-9]{3}$/.test(String(value || ""));
  const isManagedUsernameSlug = (value) => {
    const slug = String(value || "").toUpperCase();
    return /^(0|[1-9][0-9]{0,2})$/.test(slug) || /^[A-Z]{1,3}$/.test(slug);
  };
  const isAssignableSlug = (value) => {
    const slug = String(value || "").toUpperCase();
    return !RESERVED_ASSIGNABLE_SLUGS.has(slug) && (isLegacySlug(slug) || isManagedUsernameSlug(slug));
  };

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
    slugs: [],
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

  function showConfirm(message, title) {
    if (window.UNQAdminDialog && typeof window.UNQAdminDialog.confirm === "function") {
      return window.UNQAdminDialog.confirm(String(message || ""), { title: String(title || "Подтверждение") });
    }
    return Promise.resolve(window.confirm(String(message || "")));
  }

  function showPrompt(message, defaultValue = "", title = "Введите значение") {
    if (window.UNQAdminDialog && typeof window.UNQAdminDialog.prompt === "function") {
      return window.UNQAdminDialog.prompt(String(message || ""), String(defaultValue || ""), {
        title: String(title || "Введите значение"),
      });
    }
    return Promise.resolve(window.prompt(String(message || ""), String(defaultValue || "")));
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

  function setProfileLoading(loading) {
    if (!(el.profileForm instanceof HTMLElement)) return;
    el.profileForm.classList.toggle("opacity-60", loading);
    el.profileForm.classList.toggle("pointer-events-none", loading);
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
      error.payload = payload && typeof payload === "object" ? payload : {};
      throw error;
    }
    return payload || {};
  }

  function planLabel(plan) {
    if (plan === "premium" || plan === "basic") return "Премиум";
    return "Без тарифа";
  }

  function normalizeProfileTypeValue(value) {
    return String(value || "").trim().toLowerCase() === "company" ? "company" : "person";
  }

  function updateHeader() {
    const name =
      state.user?.displayName ||
      state.user?.firstName ||
      state.user?.username ||
      state.user?.telegramUsername ||
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

  function statusLabel(status) {
    const labels = {
      active: "Активен",
      approved: "Одобрен",
      private: "Приватный",
      paused: "Пауза",
      free: "Свободен",
      blocked: "Заблокирован",
      reserved: "Зарезервирован",
      pending: "Ожидает",
    };
    return labels[String(status || "").toLowerCase()] || String(status || "—");
  }

  function renderSlugs() {
    if (!(el.slugsList instanceof HTMLElement)) return;
    const rows = Array.isArray(state.slugs) ? state.slugs : [];
    if (el.slugsStatus instanceof HTMLElement) {
      el.slugsStatus.textContent = rows.length ? `Всего ссылок: ${rows.length}` : "Ссылок пока нет";
    }
    if (!rows.length) {
      el.slugsList.innerHTML = '<div class="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-500">Нет ссылок</div>';
      return;
    }
    el.slugsList.innerHTML = rows
      .map((row) => {
        const slug = normalizeSlug(row.fullSlug || row.slug || "");
        const primary = row.isPrimary ? '<span class="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">primary</span>' : "";
        return `<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2" data-slug="${esc(slug)}">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-sm font-semibold">${esc(slug)}</span>
              ${primary}
              <span class="text-xs text-neutral-500">${esc(statusLabel(row.status))}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-a="open-slug" class="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-white">Открыть</button>
            <button type="button" data-a="edit-slug" class="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-white">Изменить</button>
            <button type="button" data-a="delete-slug" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Удалить</button>
          </div>
        </div>`;
      })
      .join("");
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

  function setProfileValues() {
    if (!state.user) return;
    const tg = String(state.user.telegramUsername || state.user.username || "").replace(/^@+/, "");
    if (el.profileFirstName) el.profileFirstName.value = state.user.firstName || "";
    if (el.profileDisplayName) el.profileDisplayName.value = state.user.displayName || "";
    if (el.profileCity) el.profileCity.value = state.user.city || "";
    if (el.profileType instanceof HTMLSelectElement) el.profileType.value = normalizeProfileTypeValue(state.user.profileType);
    if (el.profileTelegram) el.profileTelegram.value = tg;
    if (el.profileEmail) el.profileEmail.value = state.user.email || "";
  }

  async function load() {
    setLoading(true);
    setProfileLoading(true);
    setError("");
    try {
      const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/card`);
      state.user = payload.user || null;
      state.card = payload.card || null;
      state.limits = payload.limits || { tags: 0, buttons: 0 };
      state.themes = Array.isArray(payload.themes) ? payload.themes : ["default_dark"];
      state.slugs = Array.isArray(payload.slugs) ? payload.slugs.slice(0) : [];
      state.plan = state.user?.plan || "none";

      state.tags = Array.isArray(state.card?.tags) ? state.card.tags.slice(0) : [];
      state.buttons = Array.isArray(state.card?.buttons)
        ? state.card.buttons.map((b) => ({
          ...b,
          url: typeof b.url === "string" ? b.url : (typeof b.href === "string" ? b.href : (typeof b.value === "string" ? b.value : "")),
        }))
        : [];

      setFormValues();
      setProfileValues();
      updateHeader();
      updateAvatar(state.card?.avatarUrl || "");
      renderThemes();
      renderSlugs();
      renderTags();
      renderButtons();
      updateLimits();
    } catch (error) {
      setError(error.message || "Не удалось загрузить визитку");
    } finally {
      setLoading(false);
      setProfileLoading(false);
    }
  }

  async function saveProfile() {
    const firstName = String(el.profileFirstName?.value || "").trim();
    if (!firstName) {
      await showAlert("Имя обязательно для профиля.", "Проверь поля");
      return;
    }
    const email = String(el.profileEmail?.value || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await showAlert("Некорректный email.", "Проверь поля");
      return;
    }
    const telegramUsername = String(el.profileTelegram?.value || "").replace(/^@+/, "").trim();
    const profileType = normalizeProfileTypeValue(el.profileType?.value || "person");
    try {
      if (el.profileStatus) {
        el.profileStatus.textContent = "";
        el.profileStatus.className = "text-xs text-neutral-500";
      }
      setProfileLoading(true);
      const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          displayName: el.profileDisplayName?.value || "",
          city: el.profileCity?.value || "",
          profileType,
          telegramUsername,
          email,
        }),
      });
      if (payload.user) {
        state.user = { ...(state.user || {}), ...payload.user };
        setProfileValues();
        updateHeader();
      }
      if (el.profileStatus) {
        el.profileStatus.textContent = "Профиль сохранён";
        el.profileStatus.className = "text-xs text-emerald-700";
      }
    } catch (error) {
      if (el.profileStatus) {
        el.profileStatus.textContent = error.message || "Не удалось сохранить профиль";
        el.profileStatus.className = "text-xs text-red-700";
      } else {
        await showAlert(error.message || "Не удалось сохранить профиль");
      }
    } finally {
      setProfileLoading(false);
    }
  }

  function currentUserSlugs() {
    return (Array.isArray(state.slugs) ? state.slugs : [])
      .map((row) => normalizeSlug(row.fullSlug || row.slug || ""))
      .filter(Boolean);
  }

  async function promptAssignableSlug(message, defaultValue = "") {
    const entered = await showPrompt(message, defaultValue);
    if (entered === null) return null;
    const slug = normalizeSlug(entered);
    if (!isAssignableSlug(slug)) {
      await showAlert(`Slug должен быть в формате ${assignableSlugHint}.`);
      return "";
    }
    return slug;
  }

  async function addUserSlug() {
    const userName = state.user?.displayName || state.user?.firstName || "пользователь";
    const nextSlug = await promptAssignableSlug(`Новый slug для ${userName} (${assignableSlugHint})`, "");
    if (!nextSlug) return;
    const ok = await showConfirm(`Назначить ${nextSlug} пользователю ${userName}?`);
    if (!ok) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(userId)}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: nextSlug }),
      });
      await load();
    } catch (error) {
      if (error.status === 409 && error.code === "SLUG_LIMIT_REACHED") {
        const ownedSlugs = Array.isArray(error.payload?.ownedSlugs) && error.payload.ownedSlugs.length
          ? error.payload.ownedSlugs.map(normalizeSlug).filter(Boolean)
          : currentUserSlugs();
        const enteredCurrent = await promptAssignableSlug(
          `Лимит slug достигнут. Укажи slug, который нужно заменить.${ownedSlugs.length ? `\nСейчас: ${ownedSlugs.join(", ")}` : ""}`,
          ownedSlugs[0] || "",
        );
        if (!enteredCurrent) return;
        const replaceOk = await showConfirm(`Заменить ${enteredCurrent} на ${nextSlug}?`);
        if (!replaceOk) return;
        try {
          await api(`/api/admin/users/${encodeURIComponent(userId)}/slugs/${encodeURIComponent(enteredCurrent)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: nextSlug }),
          });
          await load();
        } catch (replaceError) {
          await showAlert(replaceError.message || "Не удалось заменить slug");
        }
        return;
      }
      await showAlert(error.message || "Не удалось добавить slug");
    }
  }

  async function editUserSlug(currentSlug) {
    const userName = state.user?.displayName || state.user?.firstName || "пользователь";
    let selectedCurrent = currentSlug;
    if (!selectedCurrent) {
      selectedCurrent = await promptAssignableSlug(`Текущий slug (${currentUserSlugs().join(", ")})`, currentUserSlugs()[0] || "");
      if (!selectedCurrent) return;
    }
    const nextSlug = await promptAssignableSlug(`Новый slug для ${userName} (${assignableSlugHint})`, selectedCurrent);
    if (!nextSlug) return;
    if (nextSlug === selectedCurrent) {
      await showAlert("Новый slug должен отличаться от текущего.");
      return;
    }
    const ok = await showConfirm(`Заменить ${selectedCurrent} на ${nextSlug}?`);
    if (!ok) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(userId)}/slugs/${encodeURIComponent(selectedCurrent)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: nextSlug }),
      });
      await load();
    } catch (error) {
      await showAlert(error.message || "Не удалось изменить slug");
    }
  }

  async function deleteUserSlug(targetSlug) {
    const slug = targetSlug || (await promptAssignableSlug(`Какой slug удалить? (${currentUserSlugs().join(", ")})`, currentUserSlugs()[0] || ""));
    if (!slug) return;
    const ok = await showConfirm(`Удалить slug ${slug}?\n\nБудут удалены аналитические записи по этому slug.`);
    if (!ok) return;
    try {
      const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/slugs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const nextPrimary = payload?.nextPrimarySlug ? ` Новый основной: ${payload.nextPrimarySlug}.` : "";
      await showAlert(`Slug ${slug} удалён.${nextPrimary}`);
      await load();
    } catch (error) {
      await showAlert(error.message || "Не удалось удалить slug");
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

  el.profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveProfile();
  });

  el.slugAdd?.addEventListener("click", () => {
    void addUserSlug();
  });

  el.slugsList?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const action = target?.closest("[data-a]");
    if (!(action instanceof HTMLElement)) return;
    const row = action.closest("[data-slug]");
    const slug = row instanceof HTMLElement ? normalizeSlug(row.getAttribute("data-slug")) : "";
    if (!slug) return;
    const type = action.getAttribute("data-a");
    if (type === "open-slug") {
      window.open(`/${encodeURIComponent(slug)}`, "_blank", "noopener");
      return;
    }
    if (type === "edit-slug") {
      void editUserSlug(slug);
      return;
    }
    if (type === "delete-slug") {
      void deleteUserSlug(slug);
    }
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
