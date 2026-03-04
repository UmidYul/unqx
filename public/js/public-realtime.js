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
})();
