(function initPublicCard() {
  const root = document.querySelector("[data-slug]");
  if (!root) {
    return;
  }

  const slug = root.getAttribute("data-slug");
  const copyButton = document.querySelector("[data-copy-phone]");
  const avatarImage = document.querySelector("[data-avatar-image]");
  const avatarFallback = document.querySelector("[data-avatar-fallback]");
  const brandImage = document.querySelector("[data-brand-image]");
  const extraPhoto = document.querySelector("[data-extra-photo]");

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

  function showAvatarFallback() {
    if (avatarImage) {
      avatarImage.classList.add("is-hidden");
    }
    if (avatarFallback) {
      avatarFallback.classList.remove("is-hidden");
      avatarFallback.setAttribute("aria-hidden", "false");
    }
  }

  if (avatarImage) {
    avatarImage.addEventListener("error", showAvatarFallback, { once: true });
  }

  if (brandImage) {
    brandImage.addEventListener(
      "error",
      () => {
        const wrapper = brandImage.closest(".public-brand-mark");
        if (wrapper) {
          wrapper.classList.add("is-hidden");
        }
      },
      { once: true },
    );
  }

  if (extraPhoto) {
    extraPhoto.addEventListener(
      "error",
      () => {
        const wrapper = extraPhoto.closest(".public-extra-photo");
        if (!wrapper) {
          return;
        }

        extraPhoto.remove();
        const placeholder = document.createElement("div");
        placeholder.className = "public-extra-photo-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        wrapper.appendChild(placeholder);
      },
      { once: true },
    );
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

      defaultIcon.classList.add("is-hidden");
      successIcon.classList.remove("is-hidden");

      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }

      resetTimer = window.setTimeout(() => {
        successIcon.classList.add("is-hidden");
        defaultIcon.classList.remove("is-hidden");
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
