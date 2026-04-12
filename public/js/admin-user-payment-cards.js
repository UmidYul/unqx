(function () {
    const body = document.body;
    if (!body || body.getAttribute("data-page") !== "admin-user-payment-cards") return;

    const userId = String(body.getAttribute("data-user-id") || "").trim();
    if (!userId) return;

    const cardBasePath = String(body.getAttribute("data-card-base-path") || "/admin/users");
    const $ = (s) => document.querySelector(s);
    const esc = (v) =>
        String(v ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    const el = {
        title: $("#pc-title"),
        subtitle: $("#pc-subtitle"),
        backLink: $("#pc-back-link"),
        error: $("#pc-error"),
        listSection: $("#pc-list-section"),
        list: $("#pc-list"),
        createBtn: $("#pc-create-btn"),
        editor: $("#pc-editor"),
        editorTitle: $("#pc-editor-title"),
        editorCancel: $("#pc-editor-cancel"),
        number: $("#pc-number"),
        numberPreview: $("#pc-number-preview"),
        name: $("#pc-name"),
        role: $("#pc-role"),
        bio: $("#pc-bio"),
        hashtag: $("#pc-hashtag"),
        address: $("#pc-address"),
        postcode: $("#pc-postcode"),
        email: $("#pc-email"),
        extraPhone: $("#pc-extra-phone"),
        tagInput: $("#pc-tag-input"),
        tagAdd: $("#pc-tag-add"),
        tagsList: $("#pc-tags-list"),
        buttonAdd: $("#pc-button-add"),
        buttonsList: $("#pc-buttons-list"),
        save: $("#pc-save"),
        deleteBtn: $("#pc-delete-btn"),
        avatarPreview: $("#pc-avatar-preview"),
        avatarFallback: $("#pc-avatar-fallback"),
        avatarFile: $("#pc-avatar-file"),
        avatarUpload: $("#pc-avatar-upload"),
        avatarRemove: $("#pc-avatar-remove"),
    };

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
        cards: [],
        editing: null, // null = list mode, "new" = creating, card id = editing
        tags: [],
        buttons: [],
    };

    let pendingAvatarFile = null;

    // Back link
    if (el.backLink) {
        el.backLink.href = `${cardBasePath}/${encodeURIComponent(userId)}/card`;
    }

    function showAlert(message, title) {
        if (window.UNQAdminDialog && typeof window.UNQAdminDialog.alert === "function") {
            return window.UNQAdminDialog.alert(String(message || ""), { title: String(title || "Сообщение") });
        }
        alert(message);
        return Promise.resolve();
    }

    function showConfirm(message) {
        if (window.UNQAdminDialog && typeof window.UNQAdminDialog.confirm === "function") {
            return window.UNQAdminDialog.confirm(String(message || ""));
        }
        return Promise.resolve(confirm(message));
    }

    function setError(message) {
        if (!el.error) return;
        if (!message) {
            el.error.classList.add("hidden");
            el.error.textContent = "";
            return;
        }
        el.error.textContent = String(message);
        el.error.classList.remove("hidden");
    }

    function setLoading(loading) {
        if (el.editor) {
            el.editor.classList.toggle("opacity-60", loading);
            el.editor.classList.toggle("pointer-events-none", loading);
        }
    }

    async function api(url, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (csrf) headers["X-CSRF-Token"] = csrf;
        const response = await fetch(url, { ...options, headers });
        let payload = null;
        try { payload = await response.json(); } catch { payload = null; }
        if (!response.ok) {
            const error = new Error((payload && payload.error) || "Ошибка запроса");
            error.status = response.status;
            error.code = payload && payload.code ? payload.code : "";
            throw error;
        }
        return payload || {};
    }

    function updateHeader() {
        if (el.subtitle) el.subtitle.textContent = `User ID: ${userId}`;
    }

    function updateAvatar(url) {
        if (!(el.avatarPreview instanceof HTMLImageElement) || !el.avatarFallback) return;
        const hasUrl = Boolean(url);
        el.avatarPreview.src = hasUrl ? url : "";
        el.avatarPreview.classList.toggle("hidden", !hasUrl);
        el.avatarFallback.classList.toggle("hidden", hasUrl);
    }

    /* ─── List rendering ─── */
    function renderList() {
        if (!el.list) return;
        if (!state.cards.length) {
            el.list.innerHTML = '<p class="text-sm text-neutral-500">Нет payment карточек.</p>';
            return;
        }
        el.list.innerHTML = state.cards.map((c) => `
      <div class="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white flex-shrink-0">
            ${c.avatarUrl ? `<img src="${esc(c.avatarUrl)}" class="h-full w-full object-cover" />` : '<span class="text-[10px] text-neutral-400">#' + esc(c.number) + '</span>'}
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">${esc(c.name)}</p>
            <p class="text-xs text-neutral-500">/payment/${esc(c.number)} · ${Number(c.viewsCount || 0)} просмотров</p>
          </div>
        </div>
        <div class="flex gap-2">
          <a href="/payment/${esc(c.number)}" target="_blank"
            class="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100">Открыть</a>
          <button data-act="edit" data-id="${esc(c.id)}"
            class="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100">Редактировать</button>
        </div>
      </div>
    `).join("");
    }

    function showEditor(mode) {
        state.editing = mode;
        el.listSection?.classList.add("hidden");
        el.editor?.classList.remove("hidden");
        if (mode === "new") {
            el.editorTitle && (el.editorTitle.textContent = "Новая Payment карточка");
            el.deleteBtn?.classList.add("hidden");
            if (el.number) { el.number.value = ""; el.number.disabled = false; }
        } else {
            el.editorTitle && (el.editorTitle.textContent = "Редактирование Payment карточки");
            el.deleteBtn?.classList.remove("hidden");
            if (el.number) el.number.disabled = true;
        }
    }

    function hideEditor() {
        state.editing = null;
        pendingAvatarFile = null;
        el.listSection?.classList.remove("hidden");
        el.editor?.classList.add("hidden");
    }

    function clearForm() {
        if (el.number) el.number.value = "";
        if (el.name) el.name.value = "";
        if (el.role) el.role.value = "";
        if (el.bio) el.bio.value = "";
        if (el.hashtag) el.hashtag.value = "";
        if (el.address) el.address.value = "";
        if (el.postcode) el.postcode.value = "";
        if (el.email) el.email.value = "";
        if (el.extraPhone) el.extraPhone.value = "";
        if (el.avatarFile) el.avatarFile.value = "";
        state.tags = [];
        state.buttons = [];
        updateAvatar("");
        renderTags();
        renderButtons();
        pendingAvatarFile = null;
    }

    function fillForm(card) {
        if (el.number) el.number.value = String(card.number ?? "");
        if (el.name) el.name.value = card.name || "";
        if (el.role) el.role.value = card.role || "";
        if (el.bio) el.bio.value = card.bio || "";
        if (el.hashtag) el.hashtag.value = card.hashtag || "";
        if (el.address) el.address.value = card.address || "";
        if (el.postcode) el.postcode.value = card.postcode || "";
        if (el.email) el.email.value = card.email || "";
        if (el.extraPhone) el.extraPhone.value = card.extraPhone || "";
        state.tags = Array.isArray(card.tags) ? card.tags.slice(0) : [];
        state.buttons = Array.isArray(card.buttons)
            ? card.buttons.map((b) => ({
                ...b,
                url: typeof b.url === "string" ? b.url : (typeof b.href === "string" ? b.href : (typeof b.value === "string" ? b.value : "")),
            }))
            : [];
        updateAvatar(card.avatarUrl || "");
        renderTags();
        renderButtons();
    }

    /* ─── Tags ─── */
    function renderTags() {
        if (!el.tagsList) return;
        el.tagsList.innerHTML = state.tags
            .map((tag, i) => `<span class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs">${esc(tag)} <button data-a="rm-tag" data-i="${i}" class="text-neutral-500">x</button></span>`)
            .join("");
    }

    el.tagAdd?.addEventListener("click", async () => {
        const raw = el.tagInput instanceof HTMLInputElement ? el.tagInput.value.trim() : "";
        if (!raw) return;
        if (state.tags.length >= 5) { await showAlert("Лимит: 5 тегов."); return; }
        state.tags.push((raw.startsWith("#") ? raw : `#${raw}`).slice(0, 32));
        if (el.tagInput) el.tagInput.value = "";
        renderTags();
    });

    el.tagsList?.addEventListener("click", (e) => {
        const btn = e.target instanceof HTMLElement ? e.target.closest('[data-a="rm-tag"]') : null;
        if (!btn) return;
        e.preventDefault();
        const i = Number(btn.getAttribute("data-i"));
        if (Number.isFinite(i) && i >= 0 && i < state.tags.length) { state.tags.splice(i, 1); renderTags(); }
    });

    /* ─── Buttons ─── */
    function buttonRow(button, index) {
        const url = typeof button.url === "string" ? button.url : (typeof button.href === "string" ? button.href : "");
        const selectedType = Object.prototype.hasOwnProperty.call(buttonTypeLabels, button.type) ? button.type : "other";
        const options = buttonTypeOptions
            .map(([v, l]) => `<option value="${v}" ${selectedType === v ? "selected" : ""}>${l}</option>`)
            .join("");
        return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_1fr_auto]" data-bi="${index}">
      <select data-bf="type" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">${options}</select>
      <input data-bf="label" value="${esc(button.label || "")}" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm" placeholder="Название">
      <input data-bf="href" value="${esc(url)}" class="rounded-lg border border-neutral-200 px-2.5 py-2 text-sm" placeholder="URL / номер">
      <button data-a="rm-btn" data-i="${index}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Удалить</button>
    </div>`;
    }

    function renderButtons() {
        if (!el.buttonsList) return;
        el.buttonsList.innerHTML = state.buttons.map((b, i) => buttonRow(b, i)).join("");
    }

    el.buttonAdd?.addEventListener("click", async () => {
        if (state.buttons.length >= 6) { await showAlert("Лимит: 6 кнопок."); return; }
        state.buttons.push({ id: `${Date.now()}_${Math.random()}`, type: "other", label: buttonTypeLabels.other, href: "", value: "" });
        renderButtons();
    });

    const handleButtonsChange = (e) => {
        const node = e.target instanceof HTMLElement ? e.target : null;
        if (!node) return;
        const row = node.closest("[data-bi]");
        if (!row) return;
        const index = Number(row.getAttribute("data-bi"));
        if (!state.buttons[index]) return;
        const prev = state.buttons[index];
        const type = row.querySelector('[data-bf="type"]')?.value || "other";
        let label = row.querySelector('[data-bf="label"]')?.value || "";
        const href = row.querySelector('[data-bf="href"]')?.value || "";
        if (type !== prev.type && label === (buttonTypeLabels[prev.type] || "")) {
            label = buttonTypeLabels[type] || "";
            const labelEl = row.querySelector('[data-bf="label"]');
            if (labelEl) labelEl.value = label;
        }
        state.buttons[index] = { ...prev, type, label, href, value: href, url: href };
    };
    el.buttonsList?.addEventListener("input", handleButtonsChange);
    el.buttonsList?.addEventListener("change", handleButtonsChange);

    el.buttonsList?.addEventListener("click", (e) => {
        const btn = e.target instanceof HTMLElement ? e.target.closest('[data-a="rm-btn"]') : null;
        if (!btn) return;
        e.preventDefault();
        const i = Number(btn.getAttribute("data-i"));
        if (Number.isFinite(i) && i >= 0 && i < state.buttons.length) { state.buttons.splice(i, 1); renderButtons(); }
    });

    /* ─── Number preview ─── */
    el.number?.addEventListener("input", () => {
        if (el.numberPreview) el.numberPreview.textContent = el.number.value || "0";
    });

    /* ─── CRUD ─── */
    async function loadList() {
        setError("");
        try {
            const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/payment-cards`);
            state.cards = Array.isArray(payload.paymentCards) ? payload.paymentCards : [];
            renderList();
            updateHeader();
        } catch (err) {
            setError(err.message || "Не удалось загрузить список");
        }
    }

    async function saveCard() {
        const name = (el.name?.value || "").trim();
        if (!name) { await showAlert("Имя обязательно."); return; }
        const email = (el.email?.value || "").trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await showAlert("Некорректный email."); return; }

        const cardData = {
            name,
            role: el.role?.value || "",
            bio: el.bio?.value || "",
            hashtag: el.hashtag?.value || "",
            address: el.address?.value || "",
            postcode: el.postcode?.value || "",
            email,
            extraPhone: el.extraPhone?.value || "",
            tags: state.tags,
            buttons: state.buttons.map((b) => ({
                id: b.id, type: b.type || "other", label: b.label || "",
                href: typeof b.url === "string" ? b.url : (typeof b.href === "string" ? b.href : ""),
                value: typeof b.url === "string" ? b.url : (typeof b.value === "string" ? b.value : ""),
            })),
        };

        try {
            setLoading(true);
            if (state.editing === "new") {
                const num = Number(el.number?.value);
                if (!Number.isInteger(num) || num < 0) { await showAlert("Номер должен быть целым числом ≥ 0."); return; }
                cardData.number = num;
                const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/payment-cards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(cardData),
                });
                await showAlert("Payment карточка создана.");
                hideEditor();
                await loadList();
            } else {
                const payload = await api(`/api/admin/payment-cards/${encodeURIComponent(state.editing)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(cardData),
                });
                await showAlert("Изменения сохранены.");
                hideEditor();
                await loadList();
            }
        } catch (err) {
            if (err.code === "NUMBER_TAKEN") { await showAlert("Этот номер уже занят."); return; }
            if (err.code === "PLAN_REQUIRED") { await showAlert("У пользователя не активирован тариф."); return; }
            await showAlert(err.message || "Ошибка сохранения");
        } finally {
            setLoading(false);
        }
    }

    async function deleteCard() {
        if (!state.editing || state.editing === "new") return;
        const ok = await showConfirm("Удалить эту Payment карточку? Действие необратимо.");
        if (!ok) return;
        try {
            setLoading(true);
            await api(`/api/admin/payment-cards/${encodeURIComponent(state.editing)}`, { method: "DELETE" });
            await showAlert("Удалено.");
            hideEditor();
            await loadList();
        } catch (err) {
            await showAlert(err.message || "Ошибка удаления");
        } finally {
            setLoading(false);
        }
    }

    async function uploadAvatar() {
        if (!state.editing || state.editing === "new") {
            await showAlert("Сначала сохраните карточку, потом загружайте аватар.");
            return;
        }
        if (!pendingAvatarFile) { await showAlert("Сначала выберите файл."); return; }
        const formData = new FormData();
        formData.append("file", pendingAvatarFile);
        try {
            setLoading(true);
            const payload = await api(`/api/admin/payment-cards/${encodeURIComponent(state.editing)}/avatar`, {
                method: "POST",
                body: formData,
            });
            if (payload.avatarUrl) {
                updateAvatar(payload.avatarUrl);
                const card = state.cards.find((c) => c.id === state.editing);
                if (card) card.avatarUrl = payload.avatarUrl;
            }
            pendingAvatarFile = null;
            if (el.avatarFile) el.avatarFile.value = "";
            await showAlert("Аватар обновлён.");
        } catch (err) {
            await showAlert(err.message || "Не удалось загрузить аватар");
        } finally {
            setLoading(false);
        }
    }

    async function removeAvatar() {
        if (!state.editing || state.editing === "new") return;
        try {
            setLoading(true);
            await api(`/api/admin/payment-cards/${encodeURIComponent(state.editing)}/avatar`, { method: "DELETE" });
            updateAvatar("");
            const card = state.cards.find((c) => c.id === state.editing);
            if (card) card.avatarUrl = "";
            await showAlert("Аватар удалён.");
        } catch (err) {
            await showAlert(err.message || "Не удалось удалить аватар");
        } finally {
            setLoading(false);
        }
    }

    /* ─── Events ─── */
    el.createBtn?.addEventListener("click", () => {
        clearForm();
        showEditor("new");
    });

    el.editorCancel?.addEventListener("click", () => hideEditor());
    el.save?.addEventListener("click", () => saveCard());
    el.deleteBtn?.addEventListener("click", () => deleteCard());
    el.avatarUpload?.addEventListener("click", () => uploadAvatar());
    el.avatarRemove?.addEventListener("click", () => removeAvatar());

    el.avatarFile?.addEventListener("change", () => {
        const file = el.avatarFile?.files?.[0];
        if (!file) return;
        pendingAvatarFile = file;
        updateAvatar(URL.createObjectURL(file));
    });

    el.list?.addEventListener("click", (e) => {
        const btn = e.target instanceof HTMLElement ? e.target.closest('[data-act="edit"]') : null;
        if (!btn) return;
        const id = btn.getAttribute("data-id");
        const card = state.cards.find((c) => c.id === id);
        if (!card) return;
        clearForm();
        fillForm(card);
        showEditor(card.id);
    });

    loadList();
})();
