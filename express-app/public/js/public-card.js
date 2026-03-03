(function initPublicCard() {
  const root = document.querySelector("[data-slug]");
  if (!root) {
    return;
  }

  const slug = root.getAttribute("data-slug");
  const copyButton = document.querySelector("[data-copy-phone]");
  const shareButton = document.querySelector("[data-share-button]");
  const shareHint = document.querySelector("[data-share-hint]");

  function showHint(message) {
    if (!shareHint) {
      return;
    }

    shareHint.textContent = message;
    window.setTimeout(() => {
      shareHint.textContent = "";
    }, 1500);
  }

  function copyWithFallback(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const phone = copyButton.getAttribute("data-copy-phone") || "";
      let ok = false;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(phone);
          ok = true;
        }
      } catch {
        ok = false;
      }

      if (!ok) {
        ok = copyWithFallback(phone);
      }

      showHint(ok ? "Телефон скопирован" : "Не удалось скопировать");
    });
  }

  if (shareButton) {
    shareButton.addEventListener("click", async () => {
      const url = window.location.href;
      const title = document.title;

      try {
        if (navigator.share) {
          await navigator.share({
            title,
            url,
          });
          showHint("Ссылка отправлена");
          return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          showHint("Ссылка скопирована");
          return;
        }

        const ok = copyWithFallback(url);
        showHint(ok ? "Ссылка скопирована" : "Не удалось поделиться");
      } catch {
        showHint("Не удалось поделиться");
      }
    });
  }

  if (slug) {
    const url = `/api/cards/${slug}/view`;

    if (navigator.sendBeacon) {
      const payload = new Blob(["{}"], { type: "application/json" });
      navigator.sendBeacon(url, payload);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
      keepalive: true,
    });
  }
})();