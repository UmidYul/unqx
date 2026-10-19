(function initProfileMarquees() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hoverPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const pixelsPerSecond = 24;

  document.querySelectorAll(".home-profile-marquee").forEach((viewport) => {
    const track = viewport.querySelector(".home-profile-marquee-track");
    const group = track?.querySelector(".home-profile-marquee-group");
    if (!group || !group.children.length) return;

    const originals = Array.from(group.children);
    let animations = [];
    let loopWidth = 0;
    let duration = 0;
    let layoutKey = "";
    let visible = false;
    let hovered = false;
    let dragging = false;
    let resting = false;
    let resumeTimer;

    const sync = () => {
      const playing = visible && !document.hidden && !reducedMotion.matches && !hovered && !dragging && !resting && !viewport.contains(document.activeElement);
      if (playing && viewport.scrollLeft && duration) {
        // Fold keyboard scrolling into the loop without a jump when motion resumes.
        const time = Number(animations[0]?.currentTime || 0) + viewport.scrollLeft / pixelsPerSecond * 1000;
        animations.forEach((animation) => { animation.currentTime = time % duration; });
        viewport.scrollLeft = 0;
      }
      animations.forEach((animation) => {
        if (playing && animation.playState !== "running") animation.play();
        if (!playing && animation.playState !== "paused") animation.pause();
      });
    };
    const cloneItem = (item) => {
      const clone = item.cloneNode(true);
      clone.dataset.marqueeFill = "";
      clone.setAttribute("aria-hidden", "true");
      clone.tabIndex = -1;
      return clone;
    };
    const resize = () => {
      const gap = Number.parseFloat(getComputedStyle(group).columnGap) || 0;
      const baseWidth = originals.reduce((width, item) => width + item.getBoundingClientRect().width + gap, 0);
      const nextKey = `${viewport.clientWidth}:${baseWidth}:${reducedMotion.matches}`;
      if (nextKey === layoutKey || baseWidth <= 0) return;
      layoutKey = nextKey;
      const progress = duration ? (Number(animations[0]?.currentTime || 0) % duration) / duration : 0;
      animations.forEach((animation) => animation.cancel());
      animations = [];
      group.querySelectorAll("[data-marquee-fill]").forEach((item) => item.remove());
      Array.from(track.children).forEach((item) => { if (item !== group) item.remove(); });
      viewport.scrollLeft = 0;
      viewport.classList.toggle("is-animated", !reducedMotion.matches);
      loopWidth = duration = 0;
      if (reducedMotion.matches) return;

      // Fill both halves, including when the feed contains only one profile.
      const copies = Math.max(1, Math.ceil(viewport.clientWidth / baseWidth));
      for (let i = 1; i < copies; i += 1) originals.forEach((item) => group.appendChild(cloneItem(item)));
      loopWidth = group.getBoundingClientRect().width;
      duration = loopWidth / pixelsPerSecond * 1000;
      const duplicate = group.cloneNode(true);
      duplicate.setAttribute("aria-hidden", "true");
      duplicate.querySelectorAll("a").forEach((link) => { link.tabIndex = -1; });
      track.appendChild(duplicate);

      // Composite each small card separately: no rounded scrollLeft steps and no
      // oversized moving texture that can leave white tiles in mobile Safari.
      animations = Array.from(track.querySelectorAll(".home-profile-marquee-item"), (item) => {
        const animation = item.animate([
          { transform: "translate3d(0, 0, 0)" },
          { transform: `translate3d(${-loopWidth}px, 0, 0)` },
        ], { duration, iterations: Infinity, easing: "linear" });
        animation.pause();
        animation.currentTime = progress * duration;
        return animation;
      });
      sync();
    };

    viewport.addEventListener("pointerenter", () => { hovered = hoverPointer.matches; sync(); });
    viewport.addEventListener("pointerleave", () => { hovered = false; sync(); });
    viewport.addEventListener("pointerdown", () => { dragging = true; sync(); });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      resting = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { resting = false; sync(); }, 1200);
      sync();
    };
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });
    viewport.addEventListener("focusin", (event) => {
      sync();
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const bounds = viewport.getBoundingClientRect();
      const itemBounds = target.getBoundingClientRect();
      if (itemBounds.left < bounds.left || itemBounds.right > bounds.right) {
        animations.forEach((animation) => { animation.currentTime = 0; });
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
    viewport.addEventListener("focusout", () => queueMicrotask(sync));
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", resize);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(viewport);
    new ResizeObserver(resize).observe(viewport);
    document.fonts?.ready.then(resize);
    resize();
  });
})();
