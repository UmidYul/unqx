(function initProfileMarquees() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hoverPointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  document.querySelectorAll(".home-profile-marquee").forEach((viewport) => {
    const track = viewport.querySelector(".home-profile-marquee-track");
    const group = track?.querySelector(".home-profile-marquee-group");
    if (!group || !group.children.length) return;

    const originals = Array.from(group.children);
    let loopWidth = 0;
    let position = 0;
    let frame = 0;
    let lastTime = 0;
    let visible = false;
    let hovered = false;
    let dragging = false;
    let resumeAt = 0;

    const canRun = () => visible && !document.hidden && !reducedMotion.matches && loopWidth > 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    };
    const tick = (time) => {
      frame = 0;
      if (!canRun()) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 0;
      lastTime = time;
      if (!hovered && !dragging && !viewport.contains(document.activeElement) && time >= resumeAt) {
        // Native scrolling avoids a wide transformed texture and stale clipped tiles on iOS.
        position = (position + elapsed * 0.024) % loopWidth;
        viewport.scrollLeft = position;
      } else {
        position = viewport.scrollLeft % loopWidth;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!canRun()) stop();
      else if (!frame) frame = requestAnimationFrame(tick);
    };
    const cloneItem = (item) => {
      const clone = item.cloneNode(true);
      clone.dataset.marqueeFill = "";
      clone.setAttribute("aria-hidden", "true");
      clone.tabIndex = -1;
      return clone;
    };
    const resize = () => {
      const progress = loopWidth > 0 ? (viewport.scrollLeft % loopWidth) / loopWidth : 0;
      stop();
      group.querySelectorAll("[data-marquee-fill]").forEach((item) => item.remove());
      Array.from(track.children).forEach((item) => { if (item !== group) item.remove(); });
      viewport.scrollLeft = position = 0;
      loopWidth = 0;
      if (!reducedMotion.matches) {
        const baseWidth = group.getBoundingClientRect().width;
        if (baseWidth <= 0) return;
        // Each half must cover the viewport so even one profile loops without blank space.
        const copies = Math.max(1, Math.ceil(viewport.clientWidth / baseWidth));
        for (let i = 1; i < copies; i += 1) {
          originals.forEach((item) => group.appendChild(cloneItem(item)));
        }
        loopWidth = group.getBoundingClientRect().width;
        const duplicate = group.cloneNode(true);
        duplicate.setAttribute("aria-hidden", "true");
        duplicate.querySelectorAll("a").forEach((link) => { link.tabIndex = -1; });
        track.appendChild(duplicate);
        viewport.scrollLeft = position = progress * loopWidth;
      }
      sync();
    };

    viewport.addEventListener("pointerenter", () => { hovered = hoverPointer.matches; });
    viewport.addEventListener("pointerleave", () => { hovered = false; });
    viewport.addEventListener("pointerdown", () => { dragging = true; });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      resumeAt = performance.now() + 2500;
    };
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });
    viewport.addEventListener("wheel", () => { resumeAt = performance.now() + 2500; }, { passive: true });
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", resize);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }).observe(viewport);
    new ResizeObserver(resize).observe(viewport);
    document.fonts?.ready.then(resize);
    resize();
  });
})();
