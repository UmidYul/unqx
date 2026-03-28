(function initUnqxGame() {
  const root = document.body;
  if (!(root instanceof HTMLElement) || root.getAttribute("data-page") !== "unqx-game") {
    return;
  }

  const HISTORY_LIMIT = 30;
  const HISTORY_REFRESH_MS = 12_000;
  const SLOT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const SLOT_DIGITS = "0123456789";
  const SLOT_SPIN_INTERVAL_MS = 46;
  const SLOT_STOP_INITIAL_DELAY_MS = 260;
  const SLOT_STOP_STEP_MS = 210;
  const SLOT_MIN_VISIBLE_SPIN_MS = 900;
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  const spinButton = document.getElementById("unqx-game-spin-button");
  const refreshButton = document.getElementById("unqx-game-history-refresh");
  const statusNode = document.getElementById("unqx-game-status");
  const reelNode = document.getElementById("unqx-game-reel");
  const resultSlugNode = document.getElementById("unqx-game-result-slug");
  const resultPriceNode = document.getElementById("unqx-game-result-price");
  const resultTimeNode = document.getElementById("unqx-game-result-time");
  const slotNodes = Array.from(document.querySelectorAll("[data-slot-index]"));
  const luckyBoxNode = document.getElementById("unqx-game-lucky-box");
  const luckyTextNode = document.getElementById("unqx-game-lucky-text");
  const spinLimitNode = document.getElementById("unqx-game-spin-limit");
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
    slotNodes.length !== 6 ||
    !slotNodes.every((node) => node instanceof HTMLElement) ||
    !(luckyBoxNode instanceof HTMLElement) ||
    !(luckyTextNode instanceof HTMLElement) ||
    !(spinLimitNode instanceof HTMLElement) ||
    !(historyList instanceof HTMLElement) ||
    !(historyEmpty instanceof HTMLElement)
  ) {
    return;
  }

  let isSpinning = false;
  let historyItems = [];
  let toastTimer = null;
  let spinLockedUntil = 0;
  let spinAnimationGeneration = 0;
  const slotIntervals = new Array(6).fill(0);

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

  function normalizeWinner(rawWinner) {
    const profileSlug = String(rawWinner?.profileSlug || "")
      .trim()
      .toUpperCase();
    const profileUrlRaw = String(rawWinner?.profileUrl || "").trim();
    const profileUrl = profileUrlRaw || (profileSlug ? `/${profileSlug}` : "");
    return {
      name: String(rawWinner?.name || "UNQX User").trim() || "UNQX User",
      profileSlug: /^[A-Z]{3}[0-9]{3}$/.test(profileSlug) ? profileSlug : "",
      profileUrl: /^\/[A-Z0-9]+$/i.test(profileUrl) ? profileUrl : "",
    };
  }

  function normalizeLucky(rawLucky, currentSlug = "") {
    const targetSlug = String(rawLucky?.targetSlug || "")
      .trim()
      .toUpperCase();
    const validUntilRaw = rawLucky?.validUntil;
    const validUntilDate = validUntilRaw instanceof Date ? validUntilRaw : new Date(validUntilRaw || "");
    const validUntil = Number.isFinite(validUntilDate.getTime()) ? validUntilDate.toISOString() : "";
    const activeFromPayload = rawLucky && Object.prototype.hasOwnProperty.call(rawLucky, "active")
      ? Boolean(rawLucky.active)
      : null;
    const active = activeFromPayload === null ? Boolean(targetSlug && validUntil) : activeFromPayload;
    const current = String(currentSlug || "").trim().toUpperCase();
    const appliesToCurrentSlug = rawLucky && Object.prototype.hasOwnProperty.call(rawLucky, "appliesToCurrentSlug")
      ? Boolean(rawLucky.appliesToCurrentSlug)
      : Boolean(active && targetSlug && current && targetSlug === current);
    return {
      active,
      discountPercent: Math.max(0, Math.round(Number(rawLucky?.discountPercent || 10))),
      targetSlug: /^[A-Z]{3}[0-9]{3}$/.test(targetSlug) ? targetSlug : "",
      validUntil,
      appliesToCurrentSlug,
    };
  }

  function normalizeEntry(raw) {
    const createdAtRaw = raw?.createdAt;
    const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw || "");
    return {
      id: String(raw?.id || ""),
      slug: String(raw?.slug || "").toUpperCase(),
      price: Math.max(0, Math.round(Number(raw?.price || 0))),
      createdAt: Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString(),
      winner: normalizeWinner(raw?.winner || {}),
    };
  }

  function wait(ms) {
    const duration = Math.max(0, Number(ms) || 0);
    return new Promise((resolve) => {
      window.setTimeout(resolve, duration);
    });
  }

  function normalizeSlugForSlots(value) {
    const normalized = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    return /^[A-Z]{3}[0-9]{3}$/.test(normalized) ? normalized : "";
  }

  function getSlotPool(index) {
    return index < 3 ? SLOT_LETTERS : SLOT_DIGITS;
  }

  function randomPoolChar(index) {
    const pool = getSlotPool(index);
    const pickIndex = Math.floor(Math.random() * pool.length);
    return pool[pickIndex] || (index < 3 ? "A" : "0");
  }

  function setSlotChar(index, char, { spinning = false, stopped = false } = {}) {
    const node = slotNodes[index];
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const safeValue = String(char || "").slice(0, 1) || randomPoolChar(index);
    node.textContent = safeValue;
    node.classList.toggle("is-spinning", Boolean(spinning));
    node.classList.toggle("is-stopped", Boolean(stopped));
  }

  function applySlugToSlots(slug, { stopped = false } = {}) {
    const normalized = normalizeSlugForSlots(slug);
    const fallback = "AAA000";
    const target = (normalized || fallback).split("");
    for (let i = 0; i < 6; i += 1) {
      setSlotChar(i, target[i], {
        spinning: false,
        stopped,
      });
    }
  }

  function stopAllSlotIntervals() {
    for (let i = 0; i < slotIntervals.length; i += 1) {
      if (slotIntervals[i]) {
        window.clearInterval(slotIntervals[i]);
      }
      slotIntervals[i] = 0;
    }
  }

  function startSlotMachineSpin() {
    spinAnimationGeneration += 1;
    const animationId = spinAnimationGeneration;
    stopAllSlotIntervals();

    for (let i = 0; i < 6; i += 1) {
      setSlotChar(i, randomPoolChar(i), { spinning: true, stopped: false });
      slotIntervals[i] = window.setInterval(() => {
        if (animationId !== spinAnimationGeneration) {
          return;
        }
        setSlotChar(i, randomPoolChar(i), { spinning: true, stopped: false });
      }, SLOT_SPIN_INTERVAL_MS);
    }

    return animationId;
  }

  async function settleSlotMachineToSlug(targetSlug, animationId) {
    const normalized = normalizeSlugForSlots(targetSlug);
    if (!normalized || animationId !== spinAnimationGeneration) {
      stopAllSlotIntervals();
      applySlugToSlots(normalized, { stopped: false });
      return;
    }

    const chars = normalized.split("");
    for (let i = 0; i < chars.length; i += 1) {
      if (animationId !== spinAnimationGeneration) {
        return;
      }
      const stopDelay = i === 0 ? SLOT_STOP_INITIAL_DELAY_MS : SLOT_STOP_STEP_MS;
      await wait(stopDelay);
      if (animationId !== spinAnimationGeneration) {
        return;
      }
      if (slotIntervals[i]) {
        window.clearInterval(slotIntervals[i]);
        slotIntervals[i] = 0;
      }
      setSlotChar(i, chars[i], { spinning: false, stopped: true });
    }

    for (let i = 0; i < slotIntervals.length; i += 1) {
      if (slotIntervals[i]) {
        window.clearInterval(slotIntervals[i]);
        slotIntervals[i] = 0;
      }
    }
  }

  function stopSlotMachineInstant() {
    spinAnimationGeneration += 1;
    stopAllSlotIntervals();
    slotNodes.forEach((node, index) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const existing = String(node.textContent || "").trim().slice(0, 1);
      setSlotChar(index, existing || randomPoolChar(index), { spinning: false, stopped: false });
    });
  }

  function isSpinLocked() {
    return Number.isFinite(spinLockedUntil) && spinLockedUntil > Date.now();
  }

  function setSpinLock(nextSpinAt) {
    const lockDate = nextSpinAt instanceof Date ? nextSpinAt : new Date(nextSpinAt || "");
    spinLockedUntil = Number.isFinite(lockDate.getTime()) ? lockDate.getTime() : 0;
    if (isSpinLocked()) {
      spinLimitNode.textContent = `Попытка использована. Следующая: ${formatDateTime(lockDate)}`;
    } else {
      spinLockedUntil = 0;
      spinLimitNode.textContent = "1 попытка в день (Asia/Tashkent)";
    }
  }

  function renderLucky(rawLucky, currentSlug = "") {
    const lucky = normalizeLucky(rawLucky, currentSlug);
    if (!lucky.active || !lucky.targetSlug) {
      luckyBoxNode.classList.add("hidden");
      return;
    }

    const untilLabel = lucky.validUntil ? formatDateTime(lucky.validUntil) : "---";
    luckyTextNode.textContent = `Lucky-бонус: -${lucky.discountPercent}% на ${lucky.targetSlug} до ${untilLabel}`;
    luckyBoxNode.classList.remove("hidden");

    if (lucky.validUntil) {
      setSpinLock(lucky.validUntil);
    }
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
    if (!isSpinning && spinLockedUntil && spinLockedUntil <= Date.now()) {
      spinLockedUntil = 0;
    }
    spinButton.disabled = isSpinning || isSpinLocked();
    refreshButton.disabled = isSpinning;
    if (isSpinning) {
      spinButton.textContent = "Крутим...";
    } else if (isSpinLocked()) {
      spinButton.textContent = "Лимит на сегодня";
    } else {
      spinButton.textContent = "Крутить";
    }
    reelNode.classList.toggle("is-spinning", isSpinning);
  }

  function renderResult(entry) {
    applySlugToSlots(entry.slug, { stopped: true });
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

      const winner = normalizeWinner(entry.winner || {});
      const winnerHtml = winner.profileUrl
        ? `<a class="unqx-game-history-winner-link" href="${escapeHtml(winner.profileUrl)}">${escapeHtml(winner.name)}</a>`
        : `<span class="unqx-game-history-winner-name">${escapeHtml(winner.name)}</span>`;

      li.innerHTML = [
        `<span class="unqx-game-history-slug">${escapeHtml(entry.slug)}</span>`,
        `<span class="unqx-game-history-winner">${winnerHtml}</span>`,
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

  async function loadLuckyState() {
    try {
      const response = await fetch("/api/cards/order-precheck?requestedPlan=premium", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }
      if (payload?.lucky && payload.lucky.active) {
        renderLucky(payload.lucky);
      }
    } catch {
      // ignore lucky preload network errors
    }
  }

  async function spin() {
    if (isSpinning) {
      return;
    }
    if (isSpinLocked()) {
      setStatus(`Лимит на сегодня достигнут. Следующая попытка: ${formatDateTime(spinLockedUntil)}.`, "error");
      showToast("Попробуйте снова после полуночи по Ташкенту.", "error");
      setSpinning(false);
      return;
    }

    setSpinning(true);
    const animationId = startSlotMachineSpin();
    const spinStartedAt = Date.now();
    let spinSucceeded = false;
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
        stopSlotMachineInstant();
        redirectToLogin();
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (response.status === 429 && payload?.code === "DAILY_SPIN_LIMIT") {
        setSpinLock(payload?.nextSpinAt);
        setStatus(
          `Попытка уже использована. Следующая будет: ${formatDateTime(payload?.nextSpinAt)}.`,
          "error",
        );
        showToast("На сегодня лимит 1 попытка. Возвращайся после полуночи.", "error");
        if (payload?.lucky) {
          renderLucky(payload.lucky);
        }
        stopSlotMachineInstant();
        return;
      }

      if (!response.ok || !payload?.ok || !payload?.entry) {
        const message = String(payload?.error || "Не удалось выполнить спин. Попробуйте ещё раз.");
        setStatus(message, "error");
        showToast(message, "error");
        stopSlotMachineInstant();
        return;
      }

      const entry = normalizeEntry(payload.entry);
      const elapsed = Date.now() - spinStartedAt;
      if (elapsed < SLOT_MIN_VISIBLE_SPIN_MS) {
        await wait(SLOT_MIN_VISIBLE_SPIN_MS - elapsed);
      }
      await settleSlotMachineToSlug(entry.slug, animationId);
      renderResult(entry);
      prependEntry(entry);
      setStatus("Новая комбинация получена.", "success");
      renderLucky(payload?.lucky, entry.slug);
      spinSucceeded = true;
      showToast("Lucky-спин сохранён в общей истории.", "success");
    } catch {
      setStatus("Ошибка сети. Повторите попытку.", "error");
      showToast("Ошибка сети. Повторите попытку.", "error");
    } finally {
      if (!spinSucceeded) {
        stopSlotMachineInstant();
      }
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
    if (!isSpinning && spinLockedUntil && spinLockedUntil <= Date.now()) {
      setSpinLock(null);
      setSpinning(false);
    }
    void loadHistory({ silent: true });
  }, HISTORY_REFRESH_MS);

  applySlugToSlots("AAA000", { stopped: false });
  setSpinLock(null);
  setSpinning(false);
  void loadLuckyState();
  void loadHistory({ silent: false });
})();
