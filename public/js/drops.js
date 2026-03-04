(function initDropsPage() {
  if (document.body?.getAttribute("data-page") !== "drops-page") return;

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const cards = Array.from(document.querySelectorAll("[data-drop-card]"));
  const poolHost = document.getElementById("drops-live-pool");

  function tickCountdown(card) {
    const dropAt = new Date(card.getAttribute("data-drop-at") || "");
    const countdown = card.querySelector("[data-drop-countdown]");
    const liveLabel = card.querySelector("[data-drop-live-label]");
    if (!(countdown instanceof HTMLElement) || !(liveLabel instanceof HTMLElement) || Number.isNaN(dropAt.getTime())) return;

    const diff = dropAt.getTime() - Date.now();
    if (diff <= 0) {
      countdown.classList.add("hidden");
      liveLabel.classList.remove("hidden");
      return;
    }

    const total = Math.floor(diff / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    countdown.textContent = `Старт через ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  cards.forEach((card) => tickCountdown(card));
  setInterval(() => cards.forEach((card) => tickCountdown(card)), 1000);

  async function joinWaitlist(dropId, button) {
    const response = await fetch(`/api/drops/${encodeURIComponent(dropId)}/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: JSON.stringify({}),
    });

    if (response.status === 401) {
      if (window.UNQOrderModal && typeof window.UNQOrderModal.ensureAuth === "function") {
        window.UNQOrderModal.ensureAuth(() => joinWaitlist(dropId, button));
      }
      return;
    }

    if (!response.ok) {
      button.textContent = "Ошибка";
      return;
    }

    button.textContent = "✅ Мы уведомим тебя за 15 минут до дропа";
    button.disabled = true;
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-drop-join]") : null;
    if (!(target instanceof HTMLButtonElement)) return;
    const dropId = target.getAttribute("data-drop-join");
    if (!dropId) return;
    void joinWaitlist(dropId, target);
  });

  async function refreshLivePools() {
    const live = [];
    for (const card of cards) {
      const dropId = card.getAttribute("data-drop-id");
      if (!dropId) continue;
      try {
        const response = await fetch(`/api/drops/${encodeURIComponent(dropId)}/live`);
        if (!response.ok) continue;
        const payload = await response.json();
        const node = card.querySelector("[data-drop-remaining]");
        if (node instanceof HTMLElement) {
          node.textContent = `Осталось ${payload.remaining} из ${payload.total}`;
        }
        if (payload.isLive) {
          live.push(payload);
        }
      } catch {
        // noop
      }
    }

    if (poolHost instanceof HTMLElement) {
      if (!live.length) {
        poolHost.innerHTML = '<p class="text-sm text-neutral-500">Сейчас нет активного дропа.</p>';
      } else {
        poolHost.innerHTML = live
          .map((drop) => {
            const options = (drop.slugsPool || [])
              .filter((slug) => !(drop.soldSlugs || []).includes(slug))
              .slice(0, 50)
              .map((slug) => `<button type="button" data-order-link data-order-prefill="${slug}" data-drop-id="${drop.id}" class="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold">${slug}</button>`)
              .join("");
            return `<div class="mb-3 rounded-xl border border-neutral-200 p-3"><p class="text-sm font-semibold">${drop.title} · осталось ${drop.remaining}</p><div class="mt-2 flex flex-wrap gap-2">${options || '<span class="text-xs text-neutral-500">Все slug распроданы</span>'}</div></div>`;
          })
          .join("");
      }
      window.dispatchEvent(new Event("unqx:bind-order-ctas"));
    }
  }

  void refreshLivePools();
  setInterval(refreshLivePools, 12000);
})();
