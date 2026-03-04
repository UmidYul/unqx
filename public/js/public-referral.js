(function initPublicReferralPage() {
  const pageNode = document.querySelector('[data-page="public-referral"]');
  if (!(pageNode instanceof HTMLElement)) {
    return;
  }

  const loginButtons = Array.from(document.querySelectorAll("[data-auth-login]"));
  let currentUser = null;

  async function refreshUser() {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      currentUser = payload && payload.authenticated ? payload.user : null;
    } catch {
      currentUser = null;
    }
  }

  loginButtons.forEach((node) => {
    node.addEventListener("click", async () => {
      await refreshUser();
      if (currentUser) {
        window.location.href = "/profile";
        return;
      }

      if (window.UNQOrderModal && typeof window.UNQOrderModal.ensureAuth === "function") {
        window.UNQOrderModal.ensureAuth((user) => {
          if (user) {
            window.location.href = "/profile";
          }
        });
      }
    });
  });

  window.addEventListener("unqx:auth:success", (event) => {
    currentUser = event?.detail || null;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshUser();
    }
  });
  window.addEventListener("focus", () => {
    void refreshUser();
  });

  void refreshUser();
})();
