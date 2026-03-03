(function initPublicCardPage() {
  const host = document.getElementById("card-view-root");
  const payloadNode = document.getElementById("card-view-data");
  if (!(host instanceof HTMLElement) || !(payloadNode instanceof HTMLScriptElement) || typeof window.CardView === "undefined") {
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(payloadNode.textContent || "{}") || {};
  } catch {
    payload = {};
  }

  const root = window.CardView.mountCardView(host, payload.card || {}, {
    shareUrl: payload.shareUrl || window.location.href,
    viewsLabel: payload.viewsLabel || "",
  });
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const slug = String(payload.slug || root.getAttribute("data-slug") || "");
  const shareUrl = root.getAttribute("data-share-url") || window.location.href;
  const shareButton = root.querySelector("[data-share-card]");
  const shareLabel = root.querySelector("[data-share-label]");
  const avatarImage = root.querySelector("[data-avatar-image]");
  const avatarFallback = root.querySelector("[data-avatar-fallback]");
  const saveContactButton = root.querySelector("[data-save-contact]");

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
      avatarImage.style.display = "none";
    }
    if (avatarFallback instanceof HTMLElement) {
      avatarFallback.classList.remove("hidden");
      avatarFallback.style.display = "flex";
      avatarFallback.setAttribute("aria-hidden", "false");
    }
  }

  function hideAvatarFallback() {
    if (avatarFallback instanceof HTMLElement) {
      avatarFallback.classList.add("hidden");
      avatarFallback.style.display = "none";
      avatarFallback.setAttribute("aria-hidden", "true");
    }
    if (avatarImage instanceof HTMLElement) {
      avatarImage.classList.remove("hidden");
      avatarImage.style.display = "";
    }
  }

  if (avatarImage instanceof HTMLElement) {
    hideAvatarFallback();
    if (avatarImage instanceof HTMLImageElement && avatarImage.complete && avatarImage.naturalWidth > 0) {
      hideAvatarFallback();
    }
    avatarImage.addEventListener("load", hideAvatarFallback, { once: true });
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

  if (saveContactButton instanceof HTMLButtonElement) {
    saveContactButton.addEventListener("click", () => {
      const card = payload && typeof payload.card === "object" && payload.card ? payload.card : {};
      const fullName = String(card.name || "UNQ+ User").trim();
      const phone = String(card.phone || card.extraPhone || "").trim();
      const email = String(card.email || "").trim();
      const url = String(payload.shareUrl || shareUrl || window.location.href).trim();

      const safeName = fullName || "UNQ User";
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${safeName}`];
      if (phone) {
        lines.push(`TEL;TYPE=CELL:${phone}`);
      }
      if (email) {
        lines.push(`EMAIL;TYPE=INTERNET:${email}`);
      }
      if (url) {
        lines.push(`URL:${url}`);
      }
      lines.push("END:VCARD");

      const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = (slug || "unq-card").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      link.href = downloadUrl;
      link.download = `${filename || "contact"}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
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
