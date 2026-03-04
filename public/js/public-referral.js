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
      });
      const payload = await response.json().catch(() => ({}));
      currentUser = payload && payload.authenticated ? payload.user : null;
    } catch {
      currentUser = null;
    }
  }

  loginButtons.forEach((node) => {
    node.addEventListener("click", () => {
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

  void refreshUser();
})();
