(function initUnqxGame() {
  const root = document.body;
  if (!(root instanceof HTMLElement) || root.getAttribute("data-page") !== "unqx-game") {
    return;
  }

  const HISTORY_LIMIT = 5;
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
  const infoButton = document.getElementById("unqx-game-info-button");
  const statusNode = document.getElementById("unqx-game-status");
  const reelNode = document.getElementById("unqx-game-reel");
  const resultMetaNode = document.getElementById("unqx-game-result-meta");
  const resultSlugNode = document.getElementById("unqx-game-result-slug");
  const resultPriceNode = document.getElementById("unqx-game-result-price");
  const resultTimeNode = document.getElementById("unqx-game-result-time");
  const slotNodes = Array.from(document.querySelectorAll("[data-slot-index]"));
  const luckyBoxNode = document.getElementById("unqx-game-lucky-box");
  const luckyTextNode = document.getElementById("unqx-game-lucky-text");
  const spinLimitNode = document.getElementById("unqx-game-spin-limit");
  const historyList = document.getElementById("unqx-game-history-list");
  const historyEmpty = document.getElementById("unqx-game-history-empty");

  const modalOverlayNode = document.getElementById("unqx-game-modal-overlay");
  const modalNode = document.getElementById("unqx-game-modal");
  const modalTitleNode = document.getElementById("unqx-game-modal-title");
  const modalMessageNode = document.getElementById("unqx-game-modal-message");
  const modalActionNode = document.getElementById("unqx-game-modal-action");
  const modalCloseNode = document.getElementById("unqx-game-modal-close");

  if (
    !(spinButton instanceof HTMLButtonElement) ||
    !(refreshButton instanceof HTMLButtonElement) ||
    !(infoButton instanceof HTMLButtonElement) ||
    !(statusNode instanceof HTMLElement) ||
    !(reelNode instanceof HTMLElement) ||
    !(resultMetaNode instanceof HTMLElement) ||
    !(resultSlugNode instanceof HTMLElement) ||
    !(resultPriceNode instanceof HTMLElement) ||
    !(resultTimeNode instanceof HTMLElement) ||
    slotNodes.length !== 6 ||
    !slotNodes.every((node) => node instanceof HTMLElement) ||
    !(luckyBoxNode instanceof HTMLElement) ||
    !(luckyTextNode instanceof HTMLElement) ||
    !(spinLimitNode instanceof HTMLElement) ||
    !(historyList instanceof HTMLElement) ||
    !(historyEmpty instanceof HTMLElement) ||
    !(modalOverlayNode instanceof HTMLElement) ||
    !(modalNode instanceof HTMLElement) ||
    !(modalTitleNode instanceof HTMLElement) ||
    !(modalMessageNode instanceof HTMLElement) ||
    !(modalActionNode instanceof HTMLButtonElement) ||
    !(modalCloseNode instanceof HTMLButtonElement)
  ) {
    return;
  }

  let isSpinning = false;
  let historyItems = [];
  let spinLockedUntil = 0;
  let spinAnimationGeneration = 0;
  const slotIntervals = new Array(6).fill(0);

  function wait(ms) {
    const duration = Math.max(0, Number(ms) || 0);
    return new Promise((resolve) => {
      window.setTimeout(resolve, duration);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(value) {
    return `${Math.max(0, Math.round(Number(value || 0))).toLocaleString("ru-RU")} сум`;
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value || "");
    if (!Number.isFinite(date.getTime())) {
      return "";
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

  function normalizeSlugForSlots(value) {
    const normalized = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    return /^[A-Z]{3}[0-9]{3}$/.test(normalized) ? normalized : "";
  }

  function normalizeWinner(rawWinner) {
    const profileSlug = String(rawWinner?.profileSlug || "").trim().toUpperCase();
    const profileUrlRaw = String(rawWinner?.profileUrl || "").trim();
    const profileUrl = profileUrlRaw || (profileSlug ? `/${profileSlug}` : "");
    return {
      name: String(rawWinner?.name || "UNQX User").trim() || "UNQX User",
      profileSlug: /^[A-Z]{3}[0-9]{3}$/.test(profileSlug) ? profileSlug : "",
      profileUrl: /^\/[A-Z0-9]+$/i.test(profileUrl) ? profileUrl : "",
    };
  }

  function normalizeLucky(rawLucky, currentSlug = "") {
    const targetSlug = normalizeSlugForSlots(rawLucky?.targetSlug || "");
    const validUntilDate = new Date(rawLucky?.validUntil || "");
    const validUntil = Number.isFinite(validUntilDate.getTime()) ? validUntilDate.toISOString() : "";
    const activeFromPayload = rawLucky && Object.prototype.hasOwnProperty.call(rawLucky, "active")
      ? Boolean(rawLucky.active)
      : null;
    const active = activeFromPayload === null ? Boolean(targetSlug && validUntil) : activeFromPayload;
    const current = normalizeSlugForSlots(currentSlug);
    const appliesToCurrentSlug = rawLucky && Object.prototype.hasOwnProperty.call(rawLucky, "appliesToCurrentSlug")
      ? Boolean(rawLucky.appliesToCurrentSlug)
      : Boolean(active && targetSlug && current && targetSlug === current);
    return {
      active,
      discountPercent: Math.max(0, Math.round(Number(rawLucky?.discountPercent || 10))),
      targetSlug,
      validUntil,
      appliesToCurrentSlug,
    };
  }

  function normalizeEntry(raw) {
    const createdAt = new Date(raw?.createdAt || "");
    return {
      id: String(raw?.id || ""),
      slug: normalizeSlugForSlots(raw?.slug || ""),
      price: Math.max(0, Math.round(Number(raw?.price || 0))),
      createdAt: Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString(),
      winner: normalizeWinner(raw?.winner || {}),
    };
  }

  function openModal({ title, message } = {}) {
    modalTitleNode.textContent = String(title || "UNQX Lucky");
    modalMessageNode.textContent = String(message || "");
    modalOverlayNode.classList.add("is-open");
    modalOverlayNode.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      modalActionNode.focus();
    }, 0);
  }

  function closeModal() {
    modalOverlayNode.classList.remove("is-open");
    modalOverlayNode.setAttribute("aria-hidden", "true");
  }

  function setStatus(message) {
    statusNode.textContent = String(message || "");
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
      setSlotChar(i, target[i], { spinning: false, stopped });
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

    stopAllSlotIntervals();
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
    spinLimitNode.textContent = isSpinLocked() ? "Попытка на сегодня использована" : "1 попытка в день";
  }

  function setSpinning(nextState) {
    isSpinning = Boolean(nextState);
    if (!isSpinning && spinLockedUntil && spinLockedUntil <= Date.now()) {
      spinLockedUntil = 0;
    }
    spinButton.disabled = isSpinning || isSpinLocked();
    refreshButton.disabled = isSpinning;
    infoButton.disabled = isSpinning;

    if (isSpinning) {
      spinButton.textContent = "Крутим...";
    } else if (isSpinLocked()) {
      spinButton.textContent = "Лимит на сегодня";
    } else {
      spinButton.textContent = "Крутить";
    }

    reelNode.classList.toggle("is-spinning", isSpinning);
  }

  function renderLucky(rawLucky, currentSlug = "") {
    const lucky = normalizeLucky(rawLucky, currentSlug);
    if (!lucky.active || !lucky.targetSlug) {
      luckyBoxNode.classList.add("hidden");
      return;
    }

    const untilLabel = lucky.validUntil ? formatDateTime(lucky.validUntil) : "";
    luckyTextNode.textContent = `Lucky-бонус: -${lucky.discountPercent}% на ${lucky.targetSlug}${untilLabel ? ` до ${untilLabel}` : ""}`;
    luckyBoxNode.classList.remove("hidden");

    if (lucky.validUntil) {
      setSpinLock(lucky.validUntil);
    }
  }

  function renderResult(entry) {
    resultMetaNode.classList.remove("hidden");
    applySlugToSlots(entry.slug, { stopped: true });
    resultSlugNode.textContent = entry.slug || "";
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

  function redirectToLogin() {
    const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.href = `/login?next=${next}`;
  }

  function openInfoModal() {
    openModal({
      title: "Как это работает",
      message:
        "Нажмите «Крутить», все 6 слотов начнут вращение и остановятся по очереди. Вы получаете только свободный slug. Доступна 1 попытка в день, а на выпавший slug действует авто-скидка 10% до полуночи.",
    });
  }

  async function loadHistory({ silent = false } = {}) {
    if (!silent) {
      setStatus("Обновляем историю");
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
          openModal({
            title: "Ошибка",
            message: String(payload?.error || "Не удалось загрузить историю."),
          });
        }
        return;
      }

      applyEntries(Array.isArray(payload.items) ? payload.items : []);
      if (!silent) {
        setStatus("История обновлена");
      }
    } catch {
      if (!silent) {
        openModal({
          title: "Ошибка сети",
          message: "Не удалось обновить историю. Попробуйте снова.",
        });
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
      if (response.ok && payload?.lucky && payload.lucky.active) {
        renderLucky(payload.lucky);
      }
    } catch {
      // ignore preload errors
    }
  }

  async function spin() {
    if (isSpinning) {
      return;
    }

    if (isSpinLocked()) {
      openModal({
        title: "Лимит на сегодня",
        message: `Следующая попытка: ${formatDateTime(spinLockedUntil)}.`,
      });
      setSpinning(false);
      return;
    }

    setSpinning(true);
    const animationId = startSlotMachineSpin();
    const spinStartedAt = Date.now();
    let spinSucceeded = false;
    setStatus("Идёт спин");

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
        if (payload?.lucky) {
          renderLucky(payload.lucky);
        }
        openModal({
          title: "Лимит на сегодня",
          message: `Следующая попытка: ${formatDateTime(payload?.nextSpinAt)}.`,
        });
        stopSlotMachineInstant();
        return;
      }

      if (!response.ok || !payload?.ok || !payload?.entry) {
        openModal({
          title: "Спин не выполнен",
          message: String(payload?.error || "Попробуйте ещё раз."),
        });
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
      renderLucky(payload?.lucky, entry.slug);
      openModal({
        title: `Ваш slug: ${entry.slug}`,
        message: `Цена: ${formatPrice(entry.price)}.`,
      });

      spinSucceeded = true;
      setStatus("Спин завершён");
    } catch {
      openModal({
        title: "Ошибка сети",
        message: "Во время спина произошла ошибка. Попробуйте снова.",
      });
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

  infoButton.addEventListener("click", openInfoModal);

  modalActionNode.addEventListener("click", closeModal);
  modalCloseNode.addEventListener("click", closeModal);
  modalOverlayNode.addEventListener("click", (event) => {
    if (event.target === modalOverlayNode) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalOverlayNode.classList.contains("is-open")) {
      closeModal();
    }
  });

  window.setInterval(() => {
    if (!isSpinning && spinLockedUntil && spinLockedUntil <= Date.now()) {
      setSpinLock(null);
      setSpinning(false);
    }
    void loadHistory({ silent: true });
  }, HISTORY_REFRESH_MS);

  resultMetaNode.classList.add("hidden");
  luckyBoxNode.classList.add("hidden");
  applySlugToSlots("AAA000", { stopped: false });
  setSpinLock(null);
  setSpinning(false);
  setStatus("Готово");
  void loadLuckyState();
  void loadHistory({ silent: false });
})();
