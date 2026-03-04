(function initLeaderboard() {
  const buttons = Array.from(document.querySelectorAll("[data-share-slug]"));
  if (!buttons.length) return;

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    }
  }

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.getAttribute("data-share-slug") || "UNQ";
      const rank = button.getAttribute("data-share-rank") || "?";
      const text = `Я на #${rank} в топе UNQ+ этой недели 🔥\nМоя визитка: unqx.uz/${slug}`;
      const ok = await copyText(text);
      const old = button.textContent;
      button.textContent = ok ? "Скопировано" : "Ошибка";
      setTimeout(() => {
        button.textContent = old;
      }, 1200);
    });
  });
})();
