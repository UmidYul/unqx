(function initCardViewGlobal() {
  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeCard(input) {
    const card = input && typeof input === "object" ? input : {};
    const plan = card.tariff === "premium" ? "premium" : "basic";
    const buttonLimit = plan === "premium" ? 6 : 3;
    const tags = Array.isArray(card.tags)
      ? card.tags
          .map((tag) => String((tag && typeof tag === "object" ? tag.label : tag) || "").trim())
          .filter(Boolean)
      : [];
    const buttons = Array.isArray(card.buttons)
      ? card.buttons
          .map((button) => ({
            label: String(button?.label || "").trim(),
            url: String(button?.url || button?.href || "").trim(),
          }))
          .filter((button) => button.label && /^https?:\/\//i.test(button.url))
          .slice(0, buttonLimit)
      : [];
    const name = String(card.name || "").trim() || "UNQ+ User";
    const avatarUrl = String(card.avatarUrl || "").trim();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => (part[0] ? part[0].toUpperCase() : ""))
      .join("");
    return {
      slug: String(card.slug || "").toUpperCase(),
      tariff: plan,
      name,
      phone: String(card.phone || "").trim(),
      avatarUrl: avatarUrl || null,
      initials: initials || "UN",
      tags,
      buttons,
      showBranding: card.showBranding !== false,
      viewsLabel: String(card.viewsLabel || "").trim(),
    };
  }

  function buttonIcon() {
    return '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"></path></svg>';
  }

  function renderCardView(input, options = {}) {
    const card = normalizeCard(input);
    const shareUrl = String(options.shareUrl || "").trim() || window.location.href;
    const showPausedBanner = Boolean(options.showPausedBanner);
    const pausedText = String(options.pausedText || "Визитка на паузе — посетители видят заглушку");
    const viewsLabel = String(options.viewsLabel || card.viewsLabel || "0 views");

    const tagsHtml =
      card.tags.length > 0
        ? `<div class="mt-5 flex flex-wrap justify-center gap-1.5">${card.tags.map((tag) => `<span class="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600">${esc(tag)}</span>`).join("")}</div>`
        : "";

    const buttonsHtml =
      card.buttons.length > 0
        ? card.buttons
            .map(
              (button) =>
                `<a href="${esc(button.url)}" target="_blank" rel="noopener noreferrer" class="public-card-button btn-shimmer flex items-center justify-center gap-2.5 rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-neutral-800">${buttonIcon()}${esc(button.label)}</a>`,
            )
            .join("")
        : '<p class="py-2 text-center text-xs uppercase tracking-wider text-neutral-400">Coming soon</p>';

    return `
      <div data-card-view data-slug="${esc(card.slug)}" data-share-url="${esc(shareUrl)}">
        ${showPausedBanner ? `<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${esc(pausedText)}</div>` : ""}
        <div class="mb-4 flex items-center justify-between px-1">
          <span class="text-[11px] font-mono uppercase tracking-wider text-neutral-400">${esc(card.slug)}</span>
          <button type="button" data-share-card class="flex items-center gap-1.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900" aria-label="Поделиться">
            <span data-share-label>Share</span>
          </button>
        </div>
        <div class="public-card-shell rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div class="text-center">
            <h2 class="text-2xl font-black tracking-tight text-neutral-900">UNQ+</h2>
            <p class="mt-0.5 text-[10px] uppercase tracking-widest text-neutral-400">powered by scxr</p>
          </div>
          <div class="mt-8 flex flex-col items-center">
            <div class="relative">
              ${card.avatarUrl ? `<img src="${esc(card.avatarUrl)}" alt="${esc(card.name)}" class="h-20 w-20 rounded-full object-cover" data-avatar-image />` : ""}
              <div class="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-700 ${card.avatarUrl ? "hidden" : ""}" data-avatar-fallback aria-hidden="${card.avatarUrl ? "true" : "false"}">${esc(card.initials)}</div>
            </div>
            <div class="mt-4 text-center">
              <h1 class="text-lg font-semibold text-neutral-900">${esc(card.name)}</h1>
              ${card.phone ? `<a href="tel:${esc(card.phone.replace(/\s+/g, ""))}" class="mt-1 flex items-center justify-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900">${esc(card.phone)}</a>` : ""}
            </div>
          </div>
          ${tagsHtml}
          <div class="my-6 h-px bg-neutral-100"></div>
          <div class="flex flex-col gap-2.5">${buttonsHtml}</div>
        </div>
        <div class="mt-4 flex items-center justify-between px-1">
          <div class="text-[11px] text-neutral-400">${esc(viewsLabel)}</div>
          ${
            card.showBranding
              ? '<a href="/" class="text-[10px] text-neutral-400 hover:text-neutral-700">Создать свою →</a>'
              : '<div class="text-[10px] text-neutral-400">UNQ+</div>'
          }
        </div>
      </div>
    `;
  }

  function mountCardView(container, input, options = {}) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }
    container.innerHTML = renderCardView(input, options);
    return container.querySelector("[data-card-view]");
  }

  window.CardView = {
    renderCardView,
    mountCardView,
  };
})();
