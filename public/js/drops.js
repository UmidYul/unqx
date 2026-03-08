(function initDropsPage() {
  const root = document.body;
  if (!(root instanceof HTMLElement) || root.getAttribute("data-page") !== "drops-page") return;

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const telegramBotUsername = String(root.getAttribute("data-telegram-bot-username") || "")
    .replace(/^@+/, "")
    .trim();
  const cards = Array.from(document.querySelectorAll("[data-drop-card]")).filter((node) => node instanceof HTMLElement);
  const cardsById = new Map(cards.map((card) => [String(card.getAttribute("data-drop-id") || ""), card]));
  const poolHost = document.getElementById("drops-live-pool");
  const toastRegion = document.getElementById("drops-toast-region");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message, tone = "neutral") {
    if (!(toastRegion instanceof HTMLElement)) return;
    const text = String(message || "").trim();
    if (!text) return;

    toastRegion.textContent = text;
    toastRegion.classList.remove("hidden");
    toastRegion.classList.remove("border-red-200", "bg-red-50", "text-red-700");
    toastRegion.classList.remove("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    toastRegion.classList.remove("border-neutral-200", "bg-white", "text-neutral-700");

    if (tone === "error") {
      toastRegion.classList.add("border-red-200", "bg-red-50", "text-red-700");
    } else if (tone === "success") {
      toastRegion.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    } else {
      toastRegion.classList.add("border-neutral-200", "bg-white", "text-neutral-700");
    }

    if (showToast.timer) {
      window.clearTimeout(showToast.timer);
    }
    showToast.timer = window.setTimeout(() => {
      toastRegion.classList.add("hidden");
    }, 2800);
  }
  showToast.timer = null;

  function formatCountdown(diffMs) {
    const total = Math.max(0, Math.floor(diffMs / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (d > 0) {
      return `${d}д ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function parseCardState(card) {
    const dropAtRaw = String(card.getAttribute("data-drop-at") || "");
    const dropAt = new Date(dropAtRaw);
    const statusRaw = String(card.getAttribute("data-drop-status") || "").toLowerCase();
    const status = ["live", "upcoming", "past"].includes(statusRaw) ? statusRaw : "upcoming";
    const total = Math.max(0, Number(card.getAttribute("data-drop-total") || 0));
    const remaining = Math.max(0, Number(card.getAttribute("data-drop-remaining") || 0));
    const joined = card.getAttribute("data-drop-joined") === "1";
    return {
      status,
      total,
      remaining,
      joined,
      dropAt: Number.isNaN(dropAt.getTime()) ? null : dropAt,
    };
  }

  function applyCardState(card, nextState = {}) {
    const prev = parseCardState(card);
    const status = nextState.status || prev.status;
    const total = Number.isFinite(nextState.total) ? Math.max(0, Number(nextState.total)) : prev.total;
    const remaining = Number.isFinite(nextState.remaining) ? Math.max(0, Number(nextState.remaining)) : prev.remaining;
    const joined = typeof nextState.joined === "boolean" ? nextState.joined : prev.joined;

    card.setAttribute("data-drop-status", status);
    card.setAttribute("data-drop-total", String(total));
    card.setAttribute("data-drop-remaining", String(remaining));
    card.setAttribute("data-drop-joined", joined ? "1" : "0");

    const badge = card.querySelector("[data-drop-status-badge]");
    if (badge instanceof HTMLElement) {
      badge.classList.remove("border-red-200", "bg-red-50", "text-red-700");
      badge.classList.remove("border-neutral-300", "text-neutral-700");
      badge.classList.remove("border-neutral-200", "bg-neutral-100", "text-neutral-500");
      if (status === "live") {
        badge.textContent = "LIVE";
        badge.classList.add("border-red-200", "bg-red-50", "text-red-700");
      } else if (status === "past") {
        badge.textContent = "Завершён";
        badge.classList.add("border-neutral-200", "bg-neutral-100", "text-neutral-500");
      } else {
        badge.textContent = "Ожидается";
        badge.classList.add("border-neutral-300", "text-neutral-700");
      }
    }

    const remainingNode = card.querySelector("[data-drop-remaining]");
    if (remainingNode instanceof HTMLElement) {
      remainingNode.textContent = `Осталось ${remaining} из ${total}`;
    }

    const liveLabel = card.querySelector("[data-drop-live-label]");
    if (liveLabel instanceof HTMLElement) {
      liveLabel.classList.toggle("hidden", status !== "live");
    }

    const countdown = card.querySelector("[data-drop-countdown]");
    if (countdown instanceof HTMLElement) {
      countdown.classList.toggle("hidden", status !== "upcoming");
    }

    const note = card.querySelector("[data-drop-note]");
    if (note instanceof HTMLElement) {
      note.classList.toggle("hidden", status !== "past");
    }

    const joinButton = card.querySelector("[data-drop-join]");
    if (joinButton instanceof HTMLButtonElement) {
      const showJoin = status === "upcoming";
      joinButton.classList.toggle("hidden", !showJoin);
      if (showJoin) {
        if (joined) {
          joinButton.textContent = "Уведомление включено";
          joinButton.disabled = true;
        } else {
          joinButton.textContent = "Напомнить в Telegram";
          joinButton.disabled = false;
        }
      } else {
        joinButton.disabled = true;
      }
    }

    const openLive = card.querySelector("[data-drop-open-live]");
    if (openLive instanceof HTMLElement) {
      openLive.classList.toggle("hidden", status !== "live");
    }
  }

  function tickCountdown(card) {
    const state = parseCardState(card);
    const countdown = card.querySelector("[data-drop-countdown]");
    if (!(countdown instanceof HTMLElement) || state.status !== "upcoming" || !(state.dropAt instanceof Date)) {
      return;
    }
    const diff = state.dropAt.getTime() - Date.now();
    if (diff <= 0) {
      countdown.textContent = "Запуск релиза, обновляем статус...";
      return;
    }
    countdown.textContent = `Старт через ${formatCountdown(diff)}`;
  }

  function refreshSummary() {
    const stats = {
      live: 0,
      upcoming: 0,
      past: 0,
      remaining: 0,
    };
    cards.forEach((card) => {
      const state = parseCardState(card);
      if (state.status === "live") {
        stats.live += 1;
        stats.remaining += state.remaining;
      } else if (state.status === "past") {
        stats.past += 1;
      } else {
        stats.upcoming += 1;
      }
    });

    const liveNode = document.getElementById("drops-stat-live");
    const upcomingNode = document.getElementById("drops-stat-upcoming");
    const pastNode = document.getElementById("drops-stat-past");
    const remainingNode = document.getElementById("drops-stat-remaining");
    if (liveNode instanceof HTMLElement) liveNode.textContent = String(stats.live);
    if (upcomingNode instanceof HTMLElement) upcomingNode.textContent = String(stats.upcoming);
    if (pastNode instanceof HTMLElement) pastNode.textContent = String(stats.past);
    if (remainingNode instanceof HTMLElement) remainingNode.textContent = String(stats.remaining);
  }

  async function ensureAuth(onSuccess) {
    if (window.UNQOrderModal && typeof window.UNQOrderModal.ensureAuth === "function") {
      window.UNQOrderModal.ensureAuth(onSuccess);
      return;
    }
    const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.href = `/login?next=${next}`;
  }

  async function suggestTelegramLink() {
    let shouldOpen = true;
    if (window.UNQSiteDialog && typeof window.UNQSiteDialog.confirm === "function") {
      shouldOpen = await window.UNQSiteDialog.confirm("Подключить Telegram-бота для уведомлений сейчас?", {
        title: "Подключение Telegram",
        confirmText: "Подключить",
        cancelText: "Позже",
      });
    }
    if (shouldOpen) {
      let url = "";
      try {
        const response = await fetch("/api/profile/telegram/link/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          },
          body: JSON.stringify({}),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          url = String(payload.url || "").trim();
        }
      } catch {
        // Fallback to plain t.me URL below.
      }
      if (!url && telegramBotUsername) {
        url = `https://t.me/${encodeURIComponent(telegramBotUsername)}?start=notify`;
      }
      if (!url) {
        showToast("Не удалось получить ссылку Telegram-бота.", "error");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      showToast("После подключения вернись и нажми кнопку ещё раз.", "neutral");
    }
  }

  async function joinWaitlist(dropId, button) {
    if (!(button instanceof HTMLButtonElement) || !dropId) return;
    if (joinWaitlist.inFlight.has(dropId)) return;
    joinWaitlist.inFlight.add(dropId);
    const initialLabel = button.textContent || "Напомнить в Telegram";
    button.disabled = true;
    button.textContent = "Подписываем...";

    try {
      const response = await fetch(`/api/drops/${encodeURIComponent(dropId)}/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        await ensureAuth(() => joinWaitlist(dropId, button));
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = String(payload.code || "").toUpperCase();
        if (code === "DROP_ALREADY_LIVE") {
          const card = cardsById.get(dropId);
          if (card) {
            applyCardState(card, { status: "live" });
          }
          const target = document.getElementById("drop-order");
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
          showToast("Дроп уже в LIVE. Выбери slug в блоке ниже.", "neutral");
          return;
        }
        if (code === "DROP_CLOSED") {
          const card = cardsById.get(dropId);
          if (card) {
            applyCardState(card, { status: "past" });
          }
          showToast("Этот релиз уже завершён.", "error");
          return;
        }
        if (code === "TELEGRAM_NOT_LINKED") {
          await suggestTelegramLink();
          return;
        }
        showToast(payload.error || "Не удалось подписаться на дроп.", "error");
        return;
      }

      const card = cardsById.get(dropId);
      if (card) {
        applyCardState(card, { joined: true });
      }
      if (Number.isFinite(Number(payload.waitlistCount))) {
        showToast(`Подписка оформлена. В waitlist: ${Number(payload.waitlistCount)}.`, "success");
      } else {
        showToast("Подписка оформлена. Напомним перед стартом.", "success");
      }
    } catch {
      showToast("Ошибка сети. Повтори попытку.", "error");
    } finally {
      const card = cardsById.get(dropId);
      if (card) {
        const state = parseCardState(card);
        applyCardState(card, { joined: state.joined });
      } else {
        button.disabled = false;
        button.textContent = initialLabel;
      }
      joinWaitlist.inFlight.delete(dropId);
    }
  }
  joinWaitlist.inFlight = new Set();

  function renderLivePool(drops, hasError) {
    if (!(poolHost instanceof HTMLElement)) return;
    const liveDrops = Array.isArray(drops) ? drops : [];
    if (!liveDrops.length) {
      if (hasError) {
        poolHost.innerHTML =
          '<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Не удалось обновить live-список. <button type="button" id="drops-retry-live" class="interactive-btn ml-2 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold">Повторить</button></div>';
      } else {
        poolHost.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Сейчас нет live-релиза. Подпишись на ближайший и получи уведомление перед стартом.</div>';
      }
      return;
    }

    poolHost.innerHTML = liveDrops
      .map((drop) => {
        const pool = Array.isArray(drop.slugsPool) ? drop.slugsPool : [];
        const soldSet = new Set(Array.isArray(drop.soldSlugs) ? drop.soldSlugs : []);
        const available = pool.filter((slug) => !soldSet.has(slug)).slice(0, 120);
        const options = available.length
          ? available
            .map(
              (slug) =>
                `<button type="button" data-order-link data-order-prefill="${escapeHtml(slug)}" data-drop-id="${escapeHtml(drop.id)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900">${escapeHtml(slug)}</button>`,
            )
            .join("")
          : '<span class="text-xs text-neutral-500">Все slug уже заняты</span>';

        return `
          <div class="mb-3 rounded-xl border border-neutral-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-semibold text-neutral-900">${escapeHtml(drop.title || "LIVE drop")}</p>
              <span class="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">LIVE · осталось ${Number(drop.remaining || 0)}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">${options}</div>
          </div>
        `;
      })
      .join("");

    window.dispatchEvent(new Event("unqx:bind-order-ctas"));
  }

  async function refreshLivePools() {
    let hasError = false;
    const liveDrops = [];

    await Promise.all(
      cards.map(async (card) => {
        const dropId = String(card.getAttribute("data-drop-id") || "");
        if (!dropId) return;
        try {
          const response = await fetch(`/api/drops/${encodeURIComponent(dropId)}/live`, { cache: "no-store" });
          if (!response.ok) {
            hasError = true;
            return;
          }
          const payload = await response.json();
          const isPast = Boolean(payload.isFinished || payload.isSoldOut);
          const status = payload.isLive && !isPast ? "live" : isPast ? "past" : "upcoming";
          const total = Number(payload.total || 0);
          const remaining = Number(payload.remaining || 0);
          applyCardState(card, { status, total, remaining });
          if (status === "live") {
            liveDrops.push(payload);
          }
        } catch {
          hasError = true;
        }
      }),
    );

    refreshSummary();
    renderLivePool(liveDrops, hasError);
  }

  cards.forEach((card) => applyCardState(card));
  cards.forEach((card) => tickCountdown(card));
  refreshSummary();

  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-drop-join]") : null;
    if (!(target instanceof HTMLButtonElement)) return;
    const dropId = String(target.getAttribute("data-drop-join") || "");
    if (!dropId) return;
    void joinWaitlist(dropId, target);
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (target.id === "drops-retry-live" || target.id === "drops-live-refresh") {
      event.preventDefault();
      void refreshLivePools();
    }
  });

  window.setInterval(() => {
    cards.forEach((card) => tickCountdown(card));
  }, 1000);

  void refreshLivePools();
  window.setInterval(() => {
    void refreshLivePools();
  }, 12000);
})();
