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
  };

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
    upg: $("#profile-upgrade-banner"),
    av: $("#profile-sidebar-avatar"),
    nm: $("#profile-sidebar-name"),
    un: $("#profile-sidebar-username"),
    pl: $("#profile-sidebar-plan"),
    ex: $("#profile-sidebar-expiry"),

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
    cSaveStatus: $("#profile-card-save-status"),
    cSlugNote: $("#profile-card-slug-note"),
    cPrev: $("#profile-card-live-preview"),

    reqBanner: $("#profile-requests-banner"),
    reqTable: $("#profile-requests-table"),

    stName: $("#profile-settings-display-name"),
    stTg: $("#profile-settings-telegram"),
    stNotif: $("#profile-settings-notifications"),
    stSave: $("#profile-settings-save"),
    stStatus: $("#profile-settings-status"),
    stDeact: $("#profile-settings-deactivate"),

    modal: $("#profile-modal"),
    modalTitle: $("#profile-modal-title"),
    modalText: $("#profile-modal-text"),
    modalOk: $("#profile-modal-confirm"),
    modalClose: $("#profile-modal-close"),
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
  };

  const showModal = (title, text, confirmLabel, onConfirm) => {
    if (!el.modal || !el.modalTitle || !el.modalText || !el.modalOk) return;
    el.modalTitle.textContent = title;
    el.modalText.textContent = text;
    el.modalOk.textContent = confirmLabel || "Ок";
    el.modal.classList.remove("hidden");
    el.modal.classList.add("flex");

    const once = () => {
      if (typeof onConfirm === "function") onConfirm();
      closeModal();
      el.modalOk.removeEventListener("click", once);
    };

    el.modalOk.addEventListener("click", once);
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
    return ["slugs", "card", "requests", "settings"].includes(raw) ? raw : "slugs";
  };

  const setTab = () => {
    const active = currentTab();
    el.tabs.forEach((button) => {
      const on = button.getAttribute("data-tab-target") === active;
      button.classList.toggle("bg-neutral-900", on);
      button.classList.toggle("text-white", on);
    });
    el.panels.forEach((panel) => panel.classList.toggle("hidden", panel.getAttribute("data-tab-panel") !== active));
  };

  const renderSidebar = () => {
    if (!s.user) return;
    if (el.av) el.av.src = s.user.photoUrl || "/brand/unq-mark.svg";
    if (el.nm) el.nm.textContent = s.user.displayName || s.user.firstName || "UNQ+ User";
    if (el.un) el.un.textContent = s.user.username ? `@${s.user.username}` : "@—";
    if (el.pl) el.pl.textContent = s.user.effectivePlan === "premium" ? "ПРЕМИУМ" : "БАЗОВЫЙ";
    if (el.ex) el.ex.textContent = s.user.planExpiresAt ? `до ${fd(s.user.planExpiresAt)}` : "до —";
    if (el.upg) el.upg.classList.toggle("hidden", !s.user.isExpiredPremium);
  };

  const renderSlugs = () => {
    if (!el.slugs) return;

    if (!s.slugs.length) {
      el.slugs.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Пока нет slug. Оставь заявку на главной.</div>';
    } else {
      el.slugs.innerHTML = s.slugs
        .map((slugItem) => {
          const statusLabel =
            slugItem.status === "active"
              ? "🟢 Активен"
              : slugItem.status === "paused"
                ? "🟡 Пауза"
                : slugItem.status === "private"
                  ? "🔴 Приватный"
                  : slugItem.statusLabel;

          return `<article class="rounded-xl border border-neutral-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xl font-black">${esc(slugItem.fullSlug)}</p>
                <a href="/${encodeURIComponent(slugItem.fullSlug)}" target="_blank" class="text-sm text-neutral-500 hover:underline">unqx.uz/${esc(slugItem.fullSlug)}</a>
              </div>
              <div class="flex items-center gap-2">
                ${slugItem.isPrimary ? '<span class="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold">Основной</span>' : ""}
                <button data-a="cycle" data-slug="${esc(slugItem.fullSlug)}" data-st="${esc(slugItem.status)}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">${statusLabel}</button>
              </div>
            </div>
            ${
              slugItem.status === "paused"
                ? `<div class="mt-3 flex gap-2"><input data-pm="${esc(slugItem.fullSlug)}" value="${esc(slugItem.pauseMessage || "")}" placeholder="Скоро вернусь · Пишите в Telegram" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"><button data-a="save-pm" data-slug="${esc(slugItem.fullSlug)}" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm">Сохранить</button></div>`
                : ""
            }
            <div class="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
              ${slugItem.isPrimary ? "" : `<button data-a="primary" data-slug="${esc(slugItem.fullSlug)}" class="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Сделать основным</button>`}
              <span>👁 ${Number(slugItem.stats?.views || 0).toLocaleString("ru-RU")} просмотров</span>
              <span>📅 с ${fd(slugItem.stats?.since || slugItem.createdAt)}</span>
            </div>
          </article>`;
        })
        .join("");
    }

    const plan = s.user?.effectivePlan || "basic";
    const count = s.slugs.length;

    if (el.addSlug && el.addSlugNote) {
      if (plan !== "premium" && count >= 1) {
        el.addSlug.disabled = true;
        el.addSlug.textContent = "Доступно только на Премиум";
        el.addSlugNote.textContent = "Перейди на Премиум чтобы добавить до 3 slug";
      } else if (plan === "premium" && count >= 3) {
        el.addSlug.disabled = false;
        el.addSlug.textContent = "+ Добавить slug";
        el.addSlugNote.textContent = "Достигнут лимит 3 slug для Премиум тарифа";
      } else {
        el.addSlug.disabled = false;
        el.addSlug.textContent = "+ Добавить slug";
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

  const renderPreview = () => {
    if (!el.cPrev || !el.cName) return;
    const previewButtons = s.buttons.slice(0, 6);
    el.cPrev.innerHTML = `<div class="rounded-xl border border-neutral-200 bg-white p-4">
      <div class="flex items-center gap-3">
        <img src="${esc(el.cAv?.getAttribute("src") || "/brand/unq-mark.svg")}" class="h-12 w-12 rounded-full border border-neutral-200 object-cover">
        <div>
          <p class="text-sm font-semibold text-neutral-900">${esc(el.cName.value || s.user?.displayName || "Имя")}</p>
          <p class="text-xs text-neutral-500">${esc(el.cRole?.value || "")}</p>
        </div>
      </div>
      <p class="mt-3 text-xs text-neutral-600">${esc(el.cBio?.value || "")}</p>
      <div class="mt-3 flex flex-wrap gap-1.5">${s.tags.map((tag) => `<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px]">${esc(tag)}</span>`).join("")}</div>
      <div class="mt-3 space-y-1.5">${previewButtons.map((btn) => `<div class="rounded-lg bg-neutral-900 px-3 py-1.5 text-center text-xs font-semibold text-white">${esc(btn.label || "Кнопка")}</div>`).join("")}</div>
    </div>`;
  };

  const renderCard = () => {
    const card = s.card || {};

    if (el.cAv) el.cAv.src = card.avatarUrl || s.user?.photoUrl || "/brand/unq-mark.svg";
    if (el.cName) el.cName.value = card.name || s.user?.displayName || s.user?.firstName || "";
    if (el.cRole) el.cRole.value = card.role || "";
    if (el.cBio) el.cBio.value = card.bio || "";
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

    if (el.cSlugNote) {
      const slugNames = s.slugs.map((item) => item.fullSlug).join(", ");
      el.cSlugNote.textContent = slugNames
        ? `Все твои slug (${slugNames}) показывают эту визитку`
        : "Все твои slug будут показывать эту визитку";
    }
  };

  const renderRequests = () => {
    if (!el.reqTable) return;

    el.reqTable.innerHTML = s.requests.length
      ? s.requests
          .map(
            (requestItem) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${fdt(requestItem.createdAt)}</td><td class="px-3 py-2 font-mono">${esc(requestItem.slug)}</td><td class="px-3 py-2">${fp(requestItem.slugPrice)}</td><td class="px-3 py-2">${requestItem.requestedPlan === "premium" ? "Премиум" : "Базовый"}</td><td class="px-3 py-2">${requestItem.bracelet ? "Да" : "Нет"}</td><td class="px-3 py-2">${esc(requestItem.statusBadge || requestItem.status)}</td><td class="px-3 py-2">${esc(requestItem.adminNote || "—")}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="7" class="px-3 py-8 text-center text-neutral-500">Заявок пока нет</td></tr>';

    const approved = s.requests.find((item) => item.status === "approved");
    const paid = s.requests.find((item) => item.status === "paid");

    if (!el.reqBanner) return;

    if (approved) {
      el.reqBanner.classList.remove("hidden");
      el.reqBanner.className = "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800";
      el.reqBanner.innerHTML = `Твой slug ${esc(approved.slug)} одобрен! Перейди во вкладку 'Моя визитка' чтобы создать карточку. <button data-a="goto-card" class="underline">Создать визитку →</button>`;
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
    if (el.stTg) el.stTg.value = s.user.username ? `@${s.user.username}` : "@—";
    if (el.stNotif) el.stNotif.checked = Boolean(s.user.notificationsEnabled);
  };

  const renderAll = () => {
    renderSidebar();
    renderSlugs();
    renderCard();
    renderRequests();
    renderSettings();
  };

  const load = async () => {
    const payload = await api("/api/profile/bootstrap");
    s.user = payload.user || null;
    s.limits = payload.limits || {};
    s.slugs = payload.slugs || [];
    s.card = payload.card || null;
    s.requests = payload.requests || [];
    renderAll();
  };

  const saveCard = async () => {
    if (!el.cSaveStatus) return;
    el.cSaveStatus.textContent = "";

    try {
      await api("/api/profile/card", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: el.cName?.value || "",
          role: el.cRole?.value || "",
          bio: el.cBio?.value || "",
          tags: s.tags,
          buttons: s.buttons,
          theme: s.theme,
          customColor: el.cColor?.value || null,
          showBranding: el.cBranding ? !el.cBranding.checked : true,
        }),
      });

      el.cSaveStatus.textContent = "✅ Визитка обновлена";
      el.cSaveStatus.className = "text-sm text-emerald-700";
      await load();
    } catch (error) {
      el.cSaveStatus.textContent = "❌ Ошибка. Попробуй ещё раз";
      el.cSaveStatus.className = "text-sm text-red-700";
      if (error.code === "UPGRADE_REQUIRED") {
        showModal("Доступно на Премиум", "Эта функция доступна только для Премиум тарифа.");
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

  window.addEventListener("hashchange", setTab);
  setTab();

  el.modalClose?.addEventListener("click", closeModal);
  el.modal?.addEventListener("click", (event) => {
    if (event.target === el.modal) closeModal();
  });

  el.addSlug?.addEventListener("click", () => {
    const plan = s.user?.effectivePlan || "basic";
    const count = s.slugs.length;

    if (plan === "premium" && count >= 3) {
      showModal("Лимит достигнут", "Достигнут лимит 3 slug для Премиум тарифа");
      return;
    }

    if (plan !== "premium" && count >= 1) {
      showModal(
        "Нужен Премиум",
        "Перейди на Премиум чтобы добавить до 3 slug",
        "Улучшить тариф →",
        () => {
          location.href = "/#order";
        },
      );
      return;
    }

    location.href = "/?tariff=premium#order";
  });

  el.cBio?.addEventListener("input", () => {
    if (el.cBioC) el.cBioC.textContent = `${el.cBio.value.length}/120`;
    renderPreview();
  });

  el.cName?.addEventListener("input", renderPreview);
  el.cRole?.addEventListener("input", renderPreview);
  el.cColor?.addEventListener("input", renderPreview);
  el.cBranding?.addEventListener("change", renderPreview);
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
          notificationsEnabled: Boolean(el.stNotif?.checked),
        }),
      });

      if (s.user) {
        s.user.displayName = payload.user.displayName;
        s.user.notificationsEnabled = payload.user.notificationsEnabled;
      }

      renderSidebar();
      el.stStatus.textContent = "✅ Сохранено";
      el.stStatus.className = "text-sm text-emerald-700";
    } catch (error) {
      el.stStatus.textContent = `❌ ${error.message}`;
      el.stStatus.className = "text-sm text-red-700";
    }
  });

  el.stDeact?.addEventListener("click", () => {
    showModal("Деактивировать аккаунт?", "Все твои slug станут недоступны", "Подтвердить", async () => {
      try {
        await api("/api/profile/deactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        location.href = "/";
      } catch (error) {
        if (el.stStatus) {
          el.stStatus.textContent = `❌ ${error.message}`;
          el.stStatus.className = "text-sm text-red-700";
        }
      }
    });
  });

  load().catch((error) => showModal("Ошибка", error.message || "Не удалось загрузить профиль"));
})();
