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
      verified: Boolean(card.verified),
      hashtag: String(card.hashtag || "").trim(),
      address: String(card.address || "").trim(),
      postcode: String(card.postcode || "").trim(),
      email: String(card.email || "").trim(),
      extraPhone: String(card.extraPhone || "").trim(),
      showBranding: card.showBranding !== false,
      viewsLabel: String(card.viewsLabel || "").trim(),
    };
  }

  function iconSvg(name) {
    const map = {
      share: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12a3.5 3.5 0 1 0-3.4-4.3M15.5 6.7a3.5 3.5 0 1 0 0 10.6M8.2 10.8l7.6-4.3M8.2 13.2l7.6 4.3"></path></svg>',
      verified:
        '<svg class="h-4 w-4 text-neutral-500" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.5l2.2 1.8 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L21.5 12l-1.8 2.2.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 21.5l-2.2-1.8-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2.5 12l1.8-2.2-.3-2.8 2.5-1.2 1.2-2.5 2.8.3L12 2.5Zm-1.1 13.1 5-5-1.1-1.1-3.9 3.9-1.8-1.8-1.1 1.1 2.9 2.9Z"></path></svg>',
      phone: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.7 1.9Z"></path></svg>',
      message: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5A8.7 8.7 0 0 1 8 19.2L3 21l1.8-5A8.7 8.7 0 0 1 3.5 12 8.5 8.5 0 1 1 21 12Z"></path></svg>',
      instagram:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="0.8"></circle></svg>',
      click:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7M12 2v4M12 18v4M2 12h4M18 12h4"></path></svg>',
      arrow: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"></path></svg>',
      location:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.8"></circle></svg>',
      email: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"></path><path d="m4 7 8 6 8-6"></path></svg>',
      hashtag: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3-2 18M16 3l-2 18M4 9h16M3 15h16"></path></svg>',
      linkedin:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M8 10v6M8 8.2v.1M12 16v-3.2c0-1.2.9-2.1 2-2.1 1.2 0 2 .9 2 2.1V16"></path></svg>',
      tiktok:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3v8.7a3.7 3.7 0 1 1-2.5-3.5"></path><path d="M15 3c.6 1.5 2 2.6 3.5 2.8"></path></svg>',
      youtube:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="3"></rect><path d="m10 10 5 2-5 2z"></path></svg>',
      save: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 11l4 4 4-4M4 20h16"></path></svg>',
    };

    return map[name] || map.arrow;
  }

  function classifyButton(button) {
    const signature = `${button.label} ${button.url}`.toLowerCase();
    if (/(telegram|t\.me|message|chat)/.test(signature)) {
      return "message";
    }
    if (/(instagram|insta)/.test(signature)) {
      return "instagram";
    }
    if (/(click|pay|payment|card|merchant)/.test(signature)) {
      return "click";
    }
    if (/(steam|trade|shop|store|market)/.test(signature)) {
      return "arrow";
    }
    return "arrow";
  }

  function findSocialUrl(buttons, patterns) {
    const found = buttons.find((button) => patterns.some((pattern) => pattern.test(`${button.label} ${button.url}`)));
    return found ? found.url : "";
  }

  function renderSocialLink(link) {
    const active = /^https?:\/\//i.test(link.url);
    if (!active) return "";

    return `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" class="unq-ref-social-link" aria-label="${esc(link.label)}">${iconSvg(link.icon)}</a>`;
  }

  function renderCardView(input, options = {}) {
    const card = normalizeCard(input);
    const shareUrl = String(options.shareUrl || "").trim() || window.location.href;
    const showPausedBanner = Boolean(options.showPausedBanner);
    const pausedText = String(options.pausedText || "Визитка на паузе — посетители видят заглушку");
    const viewsLabel = String(options.viewsLabel || card.viewsLabel || "0 просмотров");

    const tagsHtml =
      card.tags.length > 0
        ? `<div class="unq-ref-tags">${card.tags.map((tag) => `<span class="unq-ref-tag">${esc(tag)}</span>`).join("")}</div>`
        : "";

    const buttonsHtml =
      card.buttons.length > 0
        ? card.buttons
            .map(
              (button) =>
                `<a href="${esc(button.url)}" target="_blank" rel="noopener noreferrer" class="public-card-button unq-ref-action-btn">${iconSvg(classifyButton(button))}<span>${esc(button.label)}</span></a>`,
            )
            .join("")
        : '<p class="rounded-xl border border-neutral-200 bg-neutral-50 py-3 text-center text-xs text-neutral-500">Владелец пока не добавил контактные кнопки.</p>';

    const socialLinks = [
      { label: "Instagram", url: findSocialUrl(card.buttons, [/instagram/i, /insta/i]), icon: "instagram" },
      { label: "LinkedIn", url: findSocialUrl(card.buttons, [/linkedin/i]), icon: "linkedin" },
      { label: "TikTok", url: findSocialUrl(card.buttons, [/tiktok/i, /tik tok/i]), icon: "tiktok" },
      { label: "YouTube", url: findSocialUrl(card.buttons, [/youtube/i, /youtu\.be/i]), icon: "youtube" },
    ];
    const activeSocialLinks = socialLinks.filter((link) => /^https?:\/\//i.test(link.url));

    const mainHashtag = card.hashtag ? (card.hashtag.startsWith("#") ? card.hashtag : `#${card.hashtag}`) : "#UnqPower2026";
    const aboutAddress = card.address || "Farghona, Mustaqillik 13";
    const aboutEmail = card.email || "unq@uz.com";
    const aboutPhone = card.extraPhone || card.phone || "+998200001360";
    const aboutPostcode = card.postcode || "150100";

    return `
      <div data-card-view data-slug="${esc(card.slug)}" data-share-url="${esc(shareUrl)}">
        ${showPausedBanner ? `<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${esc(pausedText)}</div>` : ""}
        <div class="unq-ref-top">
          <span class="unq-ref-slug"># ${esc(card.slug)}</span>
          <button type="button" data-share-card class="unq-ref-share" aria-label="Поделиться">
            ${iconSvg("share")}
            <span data-share-label>Поделиться</span>
          </button>
        </div>
        <div class="public-card-shell unq-ref-shell">
          ${
            card.showBranding
              ? `<div class="unq-ref-brand">
            <h2>UNQ+</h2>
            <p>POWERED BY SCXR</p>
          </div>`
              : ""
          }
          <div class="unq-ref-profile">
            <div class="unq-ref-avatar-wrap">
              ${card.avatarUrl ? `<img src="${esc(card.avatarUrl)}" alt="${esc(card.name)}" class="unq-ref-avatar-img" data-avatar-image />` : ""}
              <div class="unq-ref-avatar-fallback ${card.avatarUrl ? "hidden" : ""}" data-avatar-fallback aria-hidden="${card.avatarUrl ? "true" : "false"}" ${card.avatarUrl ? "hidden" : ""} style="${card.avatarUrl ? "display:none;" : ""}">${esc(card.initials)}</div>
            </div>
            <div class="unq-ref-name-wrap">
              <h1 class="unq-ref-name">${esc(card.name)} ${card.verified ? iconSvg("verified") : ""}</h1>
              ${card.phone ? `<a href="tel:${esc(card.phone.replace(/\s+/g, ""))}" class="unq-ref-phone">${iconSvg("phone")}<span>${esc(card.phone)}</span></a>` : ""}
            </div>
          </div>
          ${tagsHtml}
          <div class="unq-ref-divider"></div>
          <div class="unq-ref-actions">${buttonsHtml}</div>
          <div class="unq-ref-divider"></div>
          <p class="unq-ref-hashtag">${esc(mainHashtag)}</p>
          <div class="unq-ref-about">
            <p class="unq-ref-about-title">КОНТАКТЫ</p>
            <p>${iconSvg("location")}<span>${esc(aboutAddress)}</span></p>
            <p>${iconSvg("email")}<span>${esc(aboutEmail)}</span></p>
            <p>${iconSvg("phone")}<span>${esc(aboutPhone)}</span></p>
            <p>${iconSvg("hashtag")}<span>Postcode: ${esc(aboutPostcode)}</span></p>
          </div>
          ${activeSocialLinks.length ? `<div class="unq-ref-social">${activeSocialLinks.map(renderSocialLink).join("")}</div>` : ""}
          <button type="button" class="unq-ref-save interactive-btn" data-save-contact>${iconSvg("save")}<span>Сохранить контакт (.vcf)</span></button>
        </div>
        <div class="unq-ref-footline">
          <div>© ${esc(viewsLabel)}</div>
          <div>${card.showBranding ? "• UNQ+" : ""}</div>
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
