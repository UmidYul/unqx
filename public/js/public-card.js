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
    score: payload.score || null,
    topBadge: payload.topBadge || null,
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
  const actionButtons = Array.from(root.querySelectorAll("[data-track-action]"));
  const slugSearchForm = document.getElementById("card-slug-search-form");
  const slugSearchInput = document.getElementById("card-slug-search-input");
  const slugSearchResults = document.getElementById("card-slug-search-results");
  let searchTimer = null;
  let lastQuery = "";
  let lastItems = [];
  const liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.style.position = "absolute";
  liveRegion.style.width = "1px";
  liveRegion.style.height = "1px";
  liveRegion.style.padding = "0";
  liveRegion.style.margin = "-1px";
  liveRegion.style.overflow = "hidden";
  liveRegion.style.clip = "rect(0, 0, 0, 0)";
  liveRegion.style.whiteSpace = "nowrap";
  liveRegion.style.border = "0";
  document.body.appendChild(liveRegion);

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

  function announce(text) {
    liveRegion.textContent = text;
  }

  function normalizeSearchSlug(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
  }
  const STRICT_SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;

  function hideResults() {
    if (!(slugSearchResults instanceof HTMLElement)) return;
    slugSearchResults.classList.add("hidden");
    slugSearchResults.innerHTML = "";
  }

  function renderResults(items, query) {
    if (!(slugSearchResults instanceof HTMLElement)) return;
    slugSearchResults.innerHTML = "";
    if (!query) {
      hideResults();
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const buyLink = `/?buySlug=${encodeURIComponent(query)}#hero-check`;
      slugSearchResults.innerHTML = `
        <div class="px-2 py-2">
          <p class="text-sm text-neutral-500">Ничего не найдено</p>
          <a href="${buyLink}" class="interactive-btn mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">
            Купить ${query}
            <svg class="icon-stroke h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>
          </a>
        </div>
      `;
      slugSearchResults.classList.remove("hidden");
      return;
    }

    const list = document.createElement("div");
    list.className = "flex flex-col";
    for (const item of items.slice(0, 8)) {
      const slugValue = String(item?.slug || "").toUpperCase();
      if (!slugValue) continue;
      const nameValue = String(item?.name || "UNQ+ User").trim() || "UNQ+ User";
      const row = document.createElement("a");
      row.href = `/${encodeURIComponent(slugValue)}`;
      row.className =
        "interactive-btn flex items-center justify-between rounded-lg px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-50";
      row.innerHTML = `<span class="font-semibold text-neutral-800">${slugValue}</span><span class="truncate pl-3 text-xs text-neutral-500">${nameValue}</span>`;
      list.appendChild(row);
    }
    slugSearchResults.appendChild(list);
    slugSearchResults.classList.remove("hidden");
  }

  async function searchSlugs(query) {
    if (!query) {
      lastItems = [];
      renderResults([], "");
      return;
    }

    if (!STRICT_SLUG_REGEX.test(query)) {
      slugSearchResults.innerHTML = '<p class="px-2 py-2 text-sm text-neutral-500">Формат: 3 буквы и 3 цифры (например, AAA001)</p>';
      slugSearchResults.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (query !== lastQuery) {
        return;
      }
      lastItems = items;
      renderResults(items, query);
    } catch {
      if (query === lastQuery) {
        renderResults([], query);
      }
    }
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
          setShareLabel("Отправлено");
          announce("Ссылка отправлена");
        }
      } catch {
        shared = false;
      }

      if (!shared) {
        const copied = await copyText(shareUrl);
        setShareLabel(copied ? "Скопировано" : "Ошибка");
        announce(copied ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
      }

      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }

      resetTimer = window.setTimeout(() => {
        setShareLabel("Поделиться");
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
      announce("Контакт сохранен");
    });
  }

  if (actionButtons.length && slug) {
    const clickUrl = `/api/cards/${encodeURIComponent(slug)}/click`;
    actionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const buttonType = String(button.getAttribute("data-button-type") || "other").toLowerCase();
        const bodyText = JSON.stringify({ buttonType });
        if (navigator.sendBeacon) {
          const body = new Blob([bodyText], { type: "application/json" });
          navigator.sendBeacon(clickUrl, body);
          return;
        }
        void fetch(clickUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText,
          keepalive: true,
        });
      });
    });
  }

  if (slugSearchInput instanceof HTMLInputElement) {
    slugSearchInput.addEventListener("input", () => {
      const query = normalizeSearchSlug(slugSearchInput.value);
      slugSearchInput.value = query;
      slugSearchInput.setCustomValidity("");
      lastQuery = query;
      if (searchTimer) {
        window.clearTimeout(searchTimer);
      }
      if (query.length < 6) {
        hideResults();
        return;
      }
      searchTimer = window.setTimeout(() => {
        void searchSlugs(query);
      }, 140);
    });
    slugSearchInput.addEventListener("focus", () => {
      if (lastQuery) {
        renderResults(lastItems, lastQuery);
      }
    });
  }

  if (slugSearchForm instanceof HTMLFormElement && slugSearchInput instanceof HTMLInputElement) {
    slugSearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = normalizeSearchSlug(slugSearchInput.value);
      slugSearchInput.value = query;
      slugSearchInput.setCustomValidity("");
      if (!STRICT_SLUG_REGEX.test(query)) {
        slugSearchInput.setCustomValidity("Введите UNQ в формате 3 буквы и 3 цифры (AAA001)");
        slugSearchInput.reportValidity();
        void searchSlugs(query);
        return;
      }
      lastQuery = query;
      if (searchTimer) {
        window.clearTimeout(searchTimer);
      }
      void searchSlugs(query);
    });
  }

  document.addEventListener("click", (event) => {
    if (!(slugSearchResults instanceof HTMLElement) || !(slugSearchForm instanceof HTMLFormElement)) return;
    const target = event.target;
    if (target instanceof Node && !slugSearchForm.contains(target) && !slugSearchResults.contains(target)) {
      hideResults();
    }
  });

  if (!slug) {
    return;
  }

  const src = new URLSearchParams(window.location.search).get("src");
  const viewUrl = `/api/cards/${encodeURIComponent(slug)}/view${src ? `?src=${encodeURIComponent(src)}` : ""}`;

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
