(function initAdminLayout() {
  const body = document.body;
  if (!body || body.getAttribute("data-admin-layout") !== "1") {
    return;
  }

  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const sidebar = document.getElementById("admin-sidebar");
  const backdrop = document.getElementById("admin-sidebar-backdrop");
  const openButton = document.getElementById("admin-sidebar-toggle");
  const closeButton = document.getElementById("admin-sidebar-close");
  const notifyButton = document.getElementById("admin-notify-toggle");
  const notifyMenu = document.getElementById("admin-notify-menu");
  const notifyList = document.getElementById("admin-notify-list");
  const notifyDot = document.getElementById("admin-notify-dot");
  const badgeNodes = Array.from(document.querySelectorAll(".js-nav-badge"));

  function isMobileViewport() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function setSidebarOpen(isOpen) {
    if (!isMobileViewport()) {
      body.classList.remove("is-sidebar-open");
      if (openButton instanceof HTMLButtonElement) {
        openButton.setAttribute("aria-expanded", "false");
      }
      return;
    }
    body.classList.toggle("is-sidebar-open", isOpen);
    if (openButton instanceof HTMLButtonElement) {
      openButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function setNotifyOpen(isOpen) {
    if (!(notifyMenu instanceof HTMLElement) || !(notifyButton instanceof HTMLButtonElement)) {
      return;
    }
    notifyMenu.classList.toggle("is-hidden", !isOpen);
    notifyButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function formatRelativeTime(value) {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) {
      return "";
    }
    const diffSec = Math.max(0, Math.floor((Date.now() - at.getTime()) / 1000));
    if (diffSec < 60) {
      return "только что";
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `${diffMin} мин назад`;
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return `${diffHour} ч назад`;
    }
    return at.toLocaleString("ru-RU");
  }

  function renderBadges(badges) {
    const map = {
      orders: Number(badges?.orders || 0),
      bracelets: Number(badges?.bracelets || 0),
    };

    badgeNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const type = node.getAttribute("data-badge-type");
      const count = Number(type ? map[type] || 0 : 0);
      if (count > 0) {
        node.textContent = String(count);
        node.classList.remove("is-hidden");
      } else {
        node.textContent = "";
        node.classList.add("is-hidden");
      }
    });
  }

  function renderEvents(events) {
    if (!(notifyList instanceof HTMLElement)) {
      return;
    }
    const items = Array.isArray(events) ? events.slice(0, 5) : [];
    if (!items.length) {
      notifyList.innerHTML = '<p class="admin-notify-empty">Нет новых событий</p>';
      if (notifyDot instanceof HTMLElement) {
        notifyDot.classList.add("is-hidden");
      }
      return;
    }

    notifyList.innerHTML = items
      .map((event) => {
        const title = String(event?.title || "Событие");
        const slug = String(event?.slug || "").trim();
        const href = String(event?.href || "/admin/dashboard");
        const relative = formatRelativeTime(event?.at);
        const suffix = slug ? ` · ${slug}` : "";
        return `<a class="admin-notify-item" href="${href}">${title}${suffix} · ${relative}</a>`;
      })
      .join("");

    if (notifyDot instanceof HTMLElement) {
      notifyDot.classList.remove("is-hidden");
    }
  }

  async function loadNavigationMeta() {
    try {
      const response = await fetch("/api/admin/navigation-summary", {
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      renderBadges(payload?.badges || {});
      renderEvents(payload?.events || []);
    } catch {
      // no-op
    }
  }

  openButton?.addEventListener("click", () => setSidebarOpen(!body.classList.contains("is-sidebar-open")));
  closeButton?.addEventListener("click", () => setSidebarOpen(false));
  backdrop?.addEventListener("click", () => setSidebarOpen(false));

  notifyButton?.addEventListener("click", () => {
    const shouldOpen = notifyMenu instanceof HTMLElement ? notifyMenu.classList.contains("is-hidden") : false;
    setNotifyOpen(shouldOpen);
  });

  window.addEventListener("resize", () => {
    if (!isMobileViewport()) {
      setSidebarOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSidebarOpen(false);
      setNotifyOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (
      notifyMenu instanceof HTMLElement &&
      notifyButton instanceof HTMLButtonElement &&
      !notifyMenu.classList.contains("is-hidden") &&
      !notifyMenu.contains(target) &&
      !notifyButton.contains(target)
    ) {
      setNotifyOpen(false);
    }

    if (isMobileViewport()) {
      const link = target instanceof Element ? target.closest(".admin-sidebar-link") : null;
      if (link) {
        setSidebarOpen(false);
      }
    }
  });

  loadNavigationMeta();
})();
