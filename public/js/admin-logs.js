(function initAdminLogs() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-logs") {
    return;
  }

  const button = document.getElementById("cleanup-logs-btn");
  const message = document.getElementById("cleanup-message");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  if (!(button instanceof HTMLButtonElement) || !(message instanceof HTMLElement)) {
    return;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    message.textContent = "";

    try {
      const response = await fetch("/api/admin/logs/cleanup", {
        method: "POST",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        message.textContent = payload.error || "Ошибка очистки";
        return;
      }

      message.textContent = `Удалено: ${payload.deleted || 0}`;
      window.location.reload();
    } finally {
      button.disabled = false;
    }
  });
})();
