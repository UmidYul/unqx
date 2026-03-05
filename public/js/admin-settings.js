(function initAdminSettings() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") return;
  const activeTab = body.getAttribute("data-active-tab") || "analytics";
  if (activeTab !== "settings") return;

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const groups = ["pricing", "algorithm", "bracelet", "contacts", "platform"];
  const state = {
    activeSubtab: "pricing",
    loaded: {},
    originalByGroup: {},
    currentByGroup: {},
    dirtyByGroup: {},
    changesPage: 1,
  };

  const panelByGroup = Object.fromEntries(
    ["pricing", "algorithm", "bracelet", "contacts", "platform", "changes"].map((group) => [group, document.querySelector(`[data-settings-panel="${group}"]`)]),
  );

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function jsonFetch(url, init) {
    return fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...(init?.headers || {}),
      },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || `HTTP ${response.status}`;
        const error = new Error(message);
        error.payload = payload;
        throw error;
      }
      return payload;
    });
  }

  function showAlert(message) {
    if (window.UNQAdminDialog?.alert) {
      return window.UNQAdminDialog.alert(message);
    }
    if (typeof window.alert === "function") {
      window.alert(message);
    }
    return Promise.resolve();
  }

  function showConfirm(message) {
    if (window.UNQAdminDialog?.confirm) {
      return window.UNQAdminDialog.confirm(message);
    }
    if (typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(message));
    }
    return Promise.resolve(false);
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function equals(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function setDirty(group, dirty) {
    state.dirtyByGroup[group] = dirty;
    const dot = document.querySelector(`[data-settings-unsaved-dot="${group}"]`);
    if (dot instanceof HTMLElement) {
      dot.classList.toggle("hidden", !dirty);
    }
  }

  function refreshDirty(group) {
    const original = state.originalByGroup[group] || {};
    const current = state.currentByGroup[group] || {};
    setDirty(group, !equals(original, current));
  }

  function parseInputValue(field, item) {
    const t = item.type;
    if (t === "number") return Number(field.value || 0);
    if (t === "boolean") return Boolean(field.checked);
    if (t === "json") {
      try {
        return JSON.parse(field.value || "[]");
      } catch {
        return Array.isArray(item.value) ? [] : {};
      }
    }
    return String(field.value || "");
  }

  function updateCurrentFromForm(group) {
    const form = document.getElementById(`settings-form-${group}`);
    const loaded = state.loaded[group] || [];
    if (!(form instanceof HTMLFormElement)) return;
    const next = {};
    loaded.forEach((item) => {
      const field = form.elements.namedItem(item.key);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        next[item.key] = parseInputValue(field, item);
      }
    });
    state.currentByGroup[group] = next;
    refreshDirty(group);
    if (group === "algorithm") {
      renderAlgorithmPreview();
    }
  }

  function buildArrayEditor(group, item, values) {
    const key = item.key;
    const listId = `${group}-${key}-list`;
    const rows = values
      .map(
        (v, idx) => `
        <div class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2" data-array-row="${idx}">
          <span class="cursor-move text-neutral-400">::</span>
          <input type="text" value="${esc(v)}" class="min-h-11 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" data-array-input="${idx}" />
          <button type="button" data-array-remove="${idx}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700">Удалить</button>
        </div>`,
      )
      .join("");
    return `
      <div id="${listId}" class="space-y-2" data-array-list="${key}">${rows}</div>
      <button type="button" data-array-add="${key}" class="interactive-btn mt-2 min-h-11 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700">Добавить строку</button>
    `;
  }

  function renderGroup(group, items) {
    const form = document.getElementById(`settings-form-${group}`);
    if (!(form instanceof HTMLFormElement)) return;
    state.loaded[group] = items;
    const current = {};
    items.forEach((item) => {
      current[item.key] = item.value;
    });
    state.originalByGroup[group] = clone(current);
    state.currentByGroup[group] = clone(current);
    setDirty(group, false);

    form.innerHTML = items
      .map((item) => {
        const description = item.description ? `<div class="mt-1 text-xs text-neutral-500">${esc(item.description)}</div>` : "";
        const reset = `<button type="button" data-settings-reset="${group}:${item.key}" class="mt-1 text-xs font-semibold text-neutral-500 underline">Сбросить</button>`;
        if (item.type === "boolean") {
          return `<label class="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm md:col-span-2">
            <input type="checkbox" name="${esc(item.key)}" ${item.value ? "checked" : ""} class="mt-1 h-4 w-4 rounded border-neutral-300" />
            <span><span class="font-semibold text-neutral-800">${esc(item.label)}</span>${description}${reset}</span>
          </label>`;
        }
        if (item.type === "json" && Array.isArray(item.value)) {
          return `<label class="block md:col-span-2"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
            ${buildArrayEditor(group, item, item.value)}
            <textarea name="${esc(item.key)}" class="hidden">${esc(JSON.stringify(item.value || []))}</textarea>
            ${description}${reset}
          </label>`;
        }
        if (item.type === "textarea" || item.type === "json") {
          return `<label class="block md:col-span-2"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
            <textarea name="${esc(item.key)}" rows="3" class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm">${esc(item.type === "json" ? JSON.stringify(item.value ?? null, null, 2) : String(item.value ?? ""))}</textarea>
            ${description}${reset}
          </label>`;
        }
        return `<label class="block"><span class="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">${esc(item.label)}</span>
          <input type="${item.type === "number" ? "number" : "text"}" ${item.type === "number" ? 'step="any"' : ""} name="${esc(item.key)}" value="${esc(item.value ?? "")}" class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          ${description}${reset}
        </label>`;
      })
      .join("");

    form.addEventListener("input", () => updateCurrentFromForm(group));
    form.addEventListener("change", () => updateCurrentFromForm(group));
    form.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const resetTarget = target.getAttribute("data-settings-reset");
      if (resetTarget) {
        event.preventDefault();
        const [, key] = resetTarget.split(":");
        await jsonFetch(`/api/admin/settings/${encodeURIComponent(group)}/reset/${encodeURIComponent(key)}`, { method: "POST" });
        await loadGroup(group, { force: true });
        return;
      }

      const addKey = target.getAttribute("data-array-add");
      if (addKey) {
        event.preventDefault();
        const hidden = form.elements.namedItem(addKey);
        if (!(hidden instanceof HTMLTextAreaElement)) return;
        let arr = [];
        try {
          arr = JSON.parse(hidden.value || "[]");
        } catch {
          arr = [];
        }
        if (!Array.isArray(arr)) arr = [];
        arr.push("");
        hidden.value = JSON.stringify(arr);
        await loadGroup(group, { force: true, override: { [addKey]: arr } });
        return;
      }
    });

    form.querySelectorAll("[data-array-list]").forEach((listNode) => {
      if (!(listNode instanceof HTMLElement) || typeof window.Sortable !== "function") return;
      const key = listNode.getAttribute("data-array-list");
      if (!key) return;
      window.Sortable.create(listNode, {
        handle: ".cursor-move",
        animation: 120,
        onSort: () => {
          const values = Array.from(listNode.querySelectorAll("[data-array-input]")).map((node) => node.value || "");
          const hidden = form.elements.namedItem(key);
          if (hidden instanceof HTMLTextAreaElement) {
            hidden.value = JSON.stringify(values);
            updateCurrentFromForm(group);
          }
        },
      });
    });

    form.querySelectorAll("[data-array-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest("[data-array-list]");
        if (!(row instanceof HTMLElement)) return;
        const key = row.getAttribute("data-array-list");
        if (!key) return;
        const values = Array.from(row.querySelectorAll("[data-array-input]")).map((node) => node.value || "");
        const hidden = form.elements.namedItem(key);
        if (hidden instanceof HTMLTextAreaElement) {
          hidden.value = JSON.stringify(values);
          updateCurrentFromForm(group);
        }
      });
    });
  }

  function toggleSubtab(nextSubtab) {
    Object.entries(panelByGroup).forEach(([name, node]) => {
      if (node instanceof HTMLElement) {
        node.classList.toggle("hidden", name !== nextSubtab);
      }
    });
    document.querySelectorAll("[data-settings-subtab]").forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const active = btn.getAttribute("data-settings-subtab") === nextSubtab;
      btn.classList.toggle("bg-neutral-900", active);
      btn.classList.toggle("text-white", active);
      btn.classList.toggle("text-neutral-700", !active);
    });
    state.activeSubtab = nextSubtab;
  }

  async function loadGroup(group, opts = {}) {
    const payload = await jsonFetch(`/api/admin/settings/${encodeURIComponent(group)}`);
    let items = Array.isArray(payload.items) ? payload.items : [];
    if (opts.override && typeof opts.override === "object") {
      items = items.map((item) => (Object.prototype.hasOwnProperty.call(opts.override, item.key) ? { ...item, value: opts.override[item.key] } : item));
    }
    renderGroup(group, items);
    if (group === "algorithm") {
      renderAlgorithmPreview(payload.previewConfig || null);
    }
  }

  function renderAlgorithmPreview(previewConfig) {
    const box = document.getElementById("settings-algorithm-preview");
    const form = document.getElementById("settings-form-algorithm");
    if (!(box instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;
    const fromState = state.currentByGroup.algorithm || {};
    const cfg = {
      basePrice: Number(fromState.slug_base_price || previewConfig?.basePrice || 100000),
      letterSame: Number(fromState.slug_mult_letters_all_same || previewConfig?.lettersAllSame || 5),
      letterSeq: Number(fromState.slug_mult_letters_sequential || previewConfig?.lettersSequential || 3),
      letterPal: Number(fromState.slug_mult_letters_palindrome || previewConfig?.lettersPalindrome || 2),
      letterRnd: Number(fromState.slug_mult_letters_random || previewConfig?.lettersRandom || 1),
      dig000: Number(fromState.slug_mult_digits_zeros || previewConfig?.digitsZeros || 6),
      dig009: Number(fromState.slug_mult_digits_near_zero || previewConfig?.digitsNearZero || 4),
      digSame: Number(fromState.slug_mult_digits_all_same || previewConfig?.digitsAllSame || 4),
      digSeq: Number(fromState.slug_mult_digits_sequential || previewConfig?.digitsSequential || 3),
      digRound: Number(fromState.slug_mult_digits_round || previewConfig?.digitsRound || 2),
      digPal: Number(fromState.slug_mult_digits_palindrome || previewConfig?.digitsPalindrome || 1.5),
      digRnd: Number(fromState.slug_mult_digits_random || previewConfig?.digitsRandom || 1),
    };
    const rows = [
      { slug: "AAA000", l: cfg.letterSame, d: cfg.dig000 },
      { slug: "ZZZ999", l: cfg.letterSame, d: cfg.digSame },
      { slug: "ABC123", l: cfg.letterSeq, d: cfg.digSeq },
      { slug: "ABA001", l: cfg.letterPal, d: cfg.dig009 },
      { slug: "XYZ500", l: cfg.letterSeq, d: cfg.digRound },
      { slug: "ABX374", l: cfg.letterRnd, d: cfg.digRnd },
    ];
    box.innerHTML = `
      <table class="min-w-full text-left text-sm">
        <thead class="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr><th class="px-3 py-2">Slug</th><th class="px-3 py-2">Буквы</th><th class="px-3 py-2">Цифры</th><th class="px-3 py-2">Итого</th></tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const total = Math.round(cfg.basePrice * row.l * row.d);
              return `<tr class="border-t border-neutral-100"><td class="px-3 py-2 font-mono">${row.slug}</td><td class="px-3 py-2">×${row.l}</td><td class="px-3 py-2">×${row.d}</td><td class="px-3 py-2 font-semibold">${total.toLocaleString("ru-RU")} сум</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  async function saveGroup(group) {
    updateCurrentFromForm(group);
    const payload = state.currentByGroup[group] || {};
    try {
      const result = await jsonFetch(`/api/admin/settings/${encodeURIComponent(group)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (result.warning) {
        await showAlert(result.warning);
      } else {
        await showAlert("Настройки обновлены");
      }
      await loadGroup(group, { force: true });
    } catch (error) {
      const issues = error?.payload?.issues;
      if (Array.isArray(issues) && issues.length) {
        await showAlert(issues.map((item) => `${item.key}: ${item.message}`).join("\n"));
      } else {
        await showAlert(error.message || "Не удалось сохранить настройки");
      }
    }
  }

  async function loadChanges(page = 1) {
    const table = document.getElementById("settings-changes-table");
    const pager = document.getElementById("settings-changes-pagination");
    const form = document.getElementById("settings-changes-filters");
    if (!(table instanceof HTMLElement) || !(pager instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;
    const group = String(form.elements.namedItem("group")?.value || "");
    const dateFrom = String(form.elements.namedItem("dateFrom")?.value || "");
    const dateTo = String(form.elements.namedItem("dateTo")?.value || "");
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (group) params.set("group", group);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const payload = await jsonFetch(`/api/admin/settings/changes?${params.toString()}`);
    const rows = Array.isArray(payload.items) ? payload.items : [];
    table.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${new Date(row.changedAt).toLocaleString("ru-RU")}</td><td class="px-3 py-2">${esc(row.settingKey)}</td><td class="px-3 py-2"><span class="line-clamp-2">${esc(JSON.stringify(row.oldValue))}</span></td><td class="px-3 py-2"><span class="line-clamp-2">${esc(JSON.stringify(row.newValue))}</span></td><td class="px-3 py-2">${esc(row.changedBy || "admin")}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">Нет данных</td></tr>`;
    const current = Number(payload.page || 1);
    const totalPages = Math.max(1, Number(payload.totalPages || 1));
    pager.innerHTML = "";
    if (totalPages > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700";
      prev.textContent = "← Назад";
      prev.disabled = current <= 1;
      prev.addEventListener("click", () => void loadChanges(current - 1));
      const next = document.createElement("button");
      next.type = "button";
      next.className = "rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700";
      next.textContent = "Вперёд →";
      next.disabled = current >= totalPages;
      next.addEventListener("click", () => void loadChanges(current + 1));
      const label = document.createElement("span");
      label.className = "text-xs text-neutral-500";
      label.textContent = `${current}/${totalPages}`;
      pager.append(prev, label, next);
    }
  }

  function hasAnyDirty() {
    return Object.values(state.dirtyByGroup).some(Boolean);
  }

  document.querySelectorAll("[data-settings-subtab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextSubtab = btn.getAttribute("data-settings-subtab");
      if (!nextSubtab) return;
      if (nextSubtab !== state.activeSubtab && hasAnyDirty()) {
        const ok = await showConfirm("Есть несохранённые изменения. Уйти?");
        if (!ok) return;
      }
      toggleSubtab(nextSubtab);
      if (groups.includes(nextSubtab) && !state.loaded[nextSubtab]) {
        await loadGroup(nextSubtab);
      }
      if (nextSubtab === "changes") {
        await loadChanges(1);
      }
    });
  });

  document.querySelectorAll("[data-settings-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const group = btn.getAttribute("data-settings-save");
      if (!group) return;
      await saveGroup(group);
    });
  });

  document.getElementById("settings-changes-filters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadChanges(1);
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasAnyDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  void (async () => {
    toggleSubtab("pricing");
    for (const group of groups) {
      await loadGroup(group);
    }
    await loadChanges(1);
  })();
})();
