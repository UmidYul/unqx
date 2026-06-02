(function initPublicRealtime() {
  const flashSurfaces = Array.from(document.querySelectorAll("[data-flash-sale-surface]")).filter(
    (node) => node instanceof HTMLElement,
  );
  const countdownNodes = Array.from(document.querySelectorAll("[data-flash-countdown]")).filter(
    (node) => node instanceof HTMLElement,
  );
  const flashActions = Array.from(document.querySelectorAll("[data-flash-sale-action]")).filter(
    (node) => node instanceof HTMLAnchorElement,
  );

  function hideFlashSale() {
    flashSurfaces.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.remove();
      }
    });
  }

  function formatFlashCountdown(diffMs) {
    const totalSeconds = Math.floor(Math.max(0, diffMs) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return days > 0
      ? `${days}d ${String(hours % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function bindFlashActions() {
    flashActions.forEach((action) => {
      action.addEventListener("click", (event) => {
        const targetId = String(action.getAttribute("data-flash-scroll-target") || "flash-sale-details").trim();
        if (!targetId) return;
        const section = document.getElementById(targetId);
        if (section instanceof HTMLElement) {
          event.preventDefault();
          section.scrollIntoView({ behavior: "smooth", block: "start" });
          const focusId = String(action.getAttribute("data-flash-focus-target") || "").trim();
          if (focusId) {
            window.setTimeout(() => {
              const focusNode = document.getElementById(focusId);
              if (!(focusNode instanceof HTMLElement)) return;
              try {
                focusNode.focus({ preventScroll: true });
              } catch {
                focusNode.focus();
              }
              if (focusNode instanceof HTMLInputElement || focusNode instanceof HTMLTextAreaElement) {
                focusNode.select();
              }
            }, 220);
          }
          try {
            history.replaceState(null, "", `#${encodeURIComponent(targetId)}`);
          } catch {
            // ignore history errors
          }
          return;
        }
        action.href = `/#${encodeURIComponent(targetId)}`;
      });
    });
  }

  bindFlashActions();

  if (flashSurfaces.length > 0) {
    const endsAtRaw = flashSurfaces[0].getAttribute("data-ends-at") || "";
    const target = new Date(endsAtRaw);
    let flashTimer = null;

    const tick = () => {
      if (Number.isNaN(target.getTime())) {
        countdownNodes.forEach((node) => {
          node.textContent = "--:--:--";
        });
        return false;
      }

      const diff = Math.max(0, target.getTime() - Date.now());
      const label = formatFlashCountdown(diff);
      countdownNodes.forEach((node) => {
        node.textContent = label;
      });

      if (diff <= 0) {
        hideFlashSale();
        if (flashTimer) {
          clearInterval(flashTimer);
          flashTimer = null;
        }
        return false;
      }

      return true;
    };

    if (tick()) {
      flashTimer = setInterval(tick, 1000);
    }
  }

  const bar = document.getElementById("home-live-stats");
  const totalNode = document.getElementById("home-live-total");
  const todayNode = document.getElementById("home-live-today");
  const visitorsNode = document.getElementById("home-live-visitors");
  let liveStatsTimer = null;
  let liveStatsFailureCount = 0;

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
      const todayValue =
        Number.isFinite(Number(payload.todayTotal))
          ? Number(payload.todayTotal)
          : Number(payload.todayCreated || 0) + Number(payload.todayActivated || 0);
      animateNumber(todayNode, todayValue);
      animateNumber(visitorsNode, payload.todayVisitors || 0);
      bar.classList.remove("hidden");
      liveStatsFailureCount = 0;
    } catch {
      bar.classList.add("hidden");
      liveStatsFailureCount += 1;
    }
  }

  function scheduleLiveStatsPoll() {
    if (liveStatsTimer) {
      clearTimeout(liveStatsTimer);
    }
    const delayMs = liveStatsFailureCount >= 3 ? 120_000 : 20_000;
    liveStatsTimer = setTimeout(async () => {
      await loadLiveStats();
      scheduleLiveStatsPoll();
    }, delayMs);
  }

  void loadLiveStats().finally(scheduleLiveStatsPoll);
})();
