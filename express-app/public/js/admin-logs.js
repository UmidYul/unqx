(function initAdminLogs() {
  const button = document.getElementById("cleanup-logs-btn");
  const message = document.getElementById("cleanup-message");

  if (!button || !message) {
    return;
  }

  button.addEventListener("click", async () => {
    button.setAttribute("disabled", "disabled");
    message.textContent = "";

    try {
      const response = await fetch("/api/admin/logs/cleanup", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        message.textContent = payload.error || "Ошибка очистки";
        return;
      }

      message.textContent = `Удалено: ${payload.deleted || 0}`;
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } finally {
      button.removeAttribute("disabled");
    }
  });
})();