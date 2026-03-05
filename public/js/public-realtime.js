(function initPublicRealtime() {
  const flash = document.querySelector("[data-flash-sale-banner]");
  if (flash instanceof HTMLElement) {
    const node = flash.querySelector("[data-flash-countdown]");
    const endsAtRaw = flash.getAttribute("data-ends-at") || "";
    const target = new Date(endsAtRaw);

    const tick = () => {
      if (!(node instanceof HTMLElement)) return;
      if (Number.isNaN(target.getTime())) {
        node.textContent = "--:--:--";
        return;
      }
      const diff = Math.max(0, target.getTime() - Date.now());
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      node.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      if (diff <= 0) {
        flash.remove();
      }
    };

    tick();
    setInterval(tick, 1000);
  }

  const bar = document.getElementById("home-live-stats");
  const totalNode = document.getElementById("home-live-total");
  const todayNode = document.getElementById("home-live-today");
  const onlineNode = document.getElementById("home-live-online");

  function animateNumber(node, value) {
    if (!(node instanceof HTMLElement)) return;
    const target = Math.max(0, Number(value || 0));
    const start = performance.now();
    const duration = 800;
    const from = Number(node.getAttribute("data-value") || 0);
    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const next = Math.round(from + (target - from) * progress);
      node.textContent = next.toLocaleString("ru-RU");
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        node.setAttribute("data-value", String(target));
      }
    };
    requestAnimationFrame(tick);
  }

  async function loadLiveStats() {
    if (!(bar instanceof HTMLElement)) return;
    try {
      const response = await fetch("/api/public/live-stats", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      animateNumber(totalNode, payload.activeCardsTotal || 0);
      animateNumber(todayNode, (payload.todayCreated || 0) + (payload.todayActivated || 0));
      animateNumber(onlineNode, payload.onlineNow || 0);
      bar.classList.remove("hidden");
    } catch {
      bar.classList.add("hidden");
    }
  }

  void loadLiveStats();
  setInterval(loadLiveStats, 60_000);
})();
