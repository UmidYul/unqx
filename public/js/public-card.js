(function initPublicCardPage() {
  const root = document.querySelector("[data-slug]");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const slug = root.getAttribute("data-slug") || "";
  const shareUrl = root.getAttribute("data-share-url") || window.location.href;
  const shareButton = document.querySelector("[data-share-card]");
  const shareLabel = document.querySelector("[data-share-label]");
  const avatarImage = document.querySelector("[data-avatar-image]");
  const avatarFallback = document.querySelector("[data-avatar-fallback]");

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

  async function copyText(value) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      return copyWithFallback(value);
    }

    return copyWithFallback(value);
  }

  function showAvatarFallback() {
    if (avatarImage instanceof HTMLElement) {
      avatarImage.classList.add("hidden");
    }
    if (avatarFallback instanceof HTMLElement) {
      avatarFallback.classList.remove("hidden");
      avatarFallback.setAttribute("aria-hidden", "false");
    }
  }

  if (avatarImage instanceof HTMLElement) {
    avatarImage.addEventListener("error", showAvatarFallback, { once: true });
  }

  if (shareButton instanceof HTMLButtonElement) {
    let resetTimer = null;

    function setShareLabel(value) {
      if (!(shareLabel instanceof HTMLElement)) {
        return;
      }
      shareLabel.textContent = value;
    }

    shareButton.addEventListener("click", async () => {
      let shared = false;

      try {
        if (navigator.share) {
          await navigator.share({
            title: document.title,
            url: shareUrl,
          });
          shared = true;
          setShareLabel("Shared");
        }
      } catch {
        shared = false;
      }

      if (!shared) {
        const copied = await copyText(shareUrl);
        setShareLabel(copied ? "Copied" : "Error");
      }

      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }

      resetTimer = window.setTimeout(() => {
        setShareLabel("Share");
      }, 1600);
    });
  }

  if (!slug) {
    return;
  }

  const viewUrl = `/api/cards/${encodeURIComponent(slug)}/view`;

  if (navigator.sendBeacon) {
    const payload = new Blob(["{}"], { type: "application/json" });
    navigator.sendBeacon(viewUrl, payload);
    return;
  }

  void fetch(viewUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    keepalive: true,
  });
})();
