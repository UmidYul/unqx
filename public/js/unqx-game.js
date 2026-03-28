(function initUnqxGame() {
  const root = document.body;
  if (!(root instanceof HTMLElement) || root.getAttribute("data-page") !== "unqx-game") {
    return;
  }

  const HISTORY_LIMIT = 30;
  const HISTORY_REFRESH_MS = 12_000;
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  const spinButton = document.getElementById("unqx-game-spin-button");
  const refreshButton = document.getElementById("unqx-game-history-refresh");
  const statusNode = document.getElementById("unqx-game-status");
  const reelNode = document.getElementById("unqx-game-reel");
  const resultSlugNode = document.getElementById("unqx-game-result-slug");
  const resultPriceNode = document.getElementById("unqx-game-result-price");
  const resultTimeNode = document.getElementById("unqx-game-result-time");
  const historyList = document.getElementById("unqx-game-history-list");
  const historyEmpty = document.getElementById("unqx-game-history-empty");
  const toastNode = document.getElementById("unqx-game-toast");

  if (
    !(spinButton instanceof HTMLButtonElement) ||
    !(refreshButton instanceof HTMLButtonElement) ||
    !(statusNode instanceof HTMLElement) ||
    !(reelNode instanceof HTMLElement) ||
    !(resultSlugNode instanceof HTMLElement) ||
    !(resultPriceNode instanceof HTMLElement) ||
    !(resultTimeNode instanceof HTMLElement) ||
    !(historyList instanceof HTMLElement) ||
    !(historyEmpty instanceof HTMLElement)
  ) {
    return;
  }

  let isSpinning = false;
  let historyItems = [];
  let toastTimer = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(value) {
    return `${Math.max(0, Math.round(Number(value || 0))).toLocaleString("ru-RU")} сум`;
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value || "");
    if (!Number.isFinite(date.getTime())) {
      return "---";
    }
    return date.toLocaleString("ru-RU", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function normalizeEntry(raw) {
    const createdAtRaw = raw?.createdAt;
    const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw || "");
    return {
      id: String(raw?.id || ""),
      slug: String(raw?.slug || "").toUpperCase(),
      price: Math.max(0, Math.round(Number(raw?.price || 0))),
      createdAt: Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString(),
    };
  }

  function redirectToLogin() {
    const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.href = `/login?next=${next}`;
  }

  function showToast(message, tone = "neutral") {
    if (!(toastNode instanceof HTMLElement)) {
      return;
    }
    const text = String(message || "").trim();
    if (!text) {
      return;
    }

    toastNode.textContent = text;
    toastNode.classList.remove("hidden");
    toastNode.classList.add("is-visible");
    toastNode.classList.remove("border-red-200", "bg-red-50", "text-red-700");
    toastNode.classList.remove("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    toastNode.classList.remove("border-neutral-200", "bg-white", "text-neutral-700");

    if (tone === "error") {
      toastNode.classList.add("border-red-200", "bg-red-50", "text-red-700");
    } else if (tone === "success") {
      toastNode.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    } else {
      toastNode.classList.add("border-neutral-200", "bg-white", "text-neutral-700");
    }

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      toastNode.classList.remove("is-visible");
      toastNode.classList.add("hidden");
    }, 2600);
  }

  function setStatus(message, tone = "neutral") {
    statusNode.textContent = String(message || "");
    statusNode.classList.remove("text-neutral-500", "text-red-600", "text-emerald-700");
    if (tone === "error") {
      statusNode.classList.add("text-red-600");
      return;
    }
    if (tone === "success") {
      statusNode.classList.add("text-emerald-700");
      return;
    }
    statusNode.classList.add("text-neutral-500");
  }

  function setSpinning(nextState) {
    isSpinning = Boolean(nextState);
    spinButton.disabled = isSpinning;
    refreshButton.disabled = isSpinning;
    spinButton.textContent = isSpinning ? "Крутим..." : "Крутить";
    reelNode.classList.toggle("is-spinning", isSpinning);
  }

  function renderResult(entry) {
    resultSlugNode.textContent = entry.slug || "---";
    resultPriceNode.textContent = `Цена: ${formatPrice(entry.price)}`;
    resultTimeNode.textContent = `Время: ${formatDateTime(entry.createdAt)}`;
  }

  function renderHistory(items, highlightedId = "") {
    const list = Array.isArray(items) ? items : [];
    historyList.innerHTML = "";
    historyEmpty.classList.toggle("hidden", list.length > 0);

    list.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "unqx-game-history-item";
      if (highlightedId && entry.id === highlightedId) {
        li.classList.add("is-new");
      }
      li.innerHTML = [
        `<span class="unqx-game-history-slug">${escapeHtml(entry.slug)}</span>`,
        `<span class="unqx-game-history-price">${escapeHtml(formatPrice(entry.price))}</span>`,
        `<span class="unqx-game-history-time">${escapeHtml(formatDateTime(entry.createdAt))}</span>`,
      ].join("");
      historyList.appendChild(li);
    });
  }

  function applyEntries(entries, highlightedId = "") {
    const normalized = Array.isArray(entries) ? entries.map((item) => normalizeEntry(item)) : [];
    historyItems = normalized
      .filter((item) => item.id && /^[A-Z]{3}[0-9]{3}$/.test(item.slug))
      .slice(0, HISTORY_LIMIT);
    renderHistory(historyItems, highlightedId);
  }

  function prependEntry(rawEntry) {
    const entry = normalizeEntry(rawEntry);
    const next = [entry, ...historyItems.filter((item) => item.id !== entry.id)];
    applyEntries(next, entry.id);
  }

  async function loadHistory({ silent = false } = {}) {
    if (!silent) {
      setStatus("Обновляем историю...", "neutral");
    }
    try {
      const response = await fetch(`/api/cards/unqx-game/history?limit=${HISTORY_LIMIT}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        if (!silent) {
          setStatus(payload?.error || "Не удалось загрузить историю.", "error");
          showToast(payload?.error || "Не удалось загрузить историю.", "error");
        }
        return;
      }
      applyEntries(Array.isArray(payload.items) ? payload.items : []);
      if (!silent) {
        setStatus("История обновлена.", "success");
      }
    } catch {
      if (!silent) {
        setStatus("Ошибка сети при обновлении истории.", "error");
        showToast("Ошибка сети при обновлении истории.", "error");
      }
    }
  }

  async function spin() {
    if (isSpinning) {
      return;
    }
    setSpinning(true);
    setStatus("Идёт спин...", "neutral");

    try {
      const response = await fetch("/api/cards/unqx-game/spin", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({}),
      });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.entry) {
        const message = String(payload?.error || "Не удалось выполнить спин. Попробуйте ещё раз.");
        setStatus(message, "error");
        showToast(message, "error");
        return;
      }

      const entry = normalizeEntry(payload.entry);
      renderResult(entry);
      prependEntry(entry);
      setStatus("Новая комбинация получена.", "success");
      showToast("Комбинация успешно добавлена в общую историю.", "success");
    } catch {
      setStatus("Ошибка сети. Повторите попытку.", "error");
      showToast("Ошибка сети. Повторите попытку.", "error");
    } finally {
      setSpinning(false);
    }
  }

  spinButton.addEventListener("click", () => {
    void spin();
  });

  refreshButton.addEventListener("click", () => {
    void loadHistory({ silent: false });
  });

  window.setInterval(() => {
    void loadHistory({ silent: true });
  }, HISTORY_REFRESH_MS);

  void loadHistory({ silent: false });
})();
