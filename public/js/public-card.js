(function initPublicCard() {
  const root = document.querySelector("[data-slug]");
  if (!root) {
    return;
  }

  const slug = root.getAttribute("data-slug");
  const copyButton = document.querySelector("[data-copy-phone]");

  function copyWithFallback(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }

  async function copyPhone(value) {
    let ok = false;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      ok = copyWithFallback(value);
    }

    return ok;
  }

  if (copyButton) {
    const defaultIcon = copyButton.querySelector("[data-copy-default]");
    const successIcon = copyButton.querySelector("[data-copy-success]");
    let resetTimer = null;

    copyButton.addEventListener("click", async () => {
      const phone = copyButton.getAttribute("data-copy-phone") || "";
      const ok = await copyPhone(phone);

      if (!ok || !defaultIcon || !successIcon) {
        return;
      }

      defaultIcon.classList.add("hidden");
      successIcon.classList.remove("hidden");

      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }

      resetTimer = window.setTimeout(() => {
        successIcon.classList.add("hidden");
        defaultIcon.classList.remove("hidden");
      }, 2000);
    });
  }

  if (!slug) {
    return;
  }

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
})();
