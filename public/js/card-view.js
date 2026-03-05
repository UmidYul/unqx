(function initCardViewGlobal() {
  function normalizeHexColor(value) {
    const raw = String(value || "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(raw) ? raw : "";
  }

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
          type: String(button?.type || "other")
            .trim()
            .toLowerCase(),
          label: String(button?.label || "").trim(),
          url: String(button?.url || button?.href || "").trim(),
        }))
        .filter((button) => button.label && /^https?:\/\//i.test(button.url))
        .slice(0, buttonLimit)
      : [];
    const name = String(card.name || "").trim() || "UNQX User";
    const avatarUrl = String(card.avatarUrl || "").trim();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => (part[0] ? part[0].toUpperCase() : ""))
      .join("");
    return {
      slug: String(card.slug || "").toUpperCase(),
      slugPrice: Number.isFinite(Number(card.slugPrice)) ? Number(card.slugPrice) : null,
      tariff: plan,
      theme:
        typeof card.theme === "string" &&
        ["default_dark", "light_minimal", "gradient", "neon", "corporate"].includes(card.theme)
          ? card.theme
          : "default_dark",
      customColor: normalizeHexColor(card.customColor),
      name,
      role: String(card.role || "").trim(),
      phone: String(card.phone || "").trim(),
      avatarUrl: avatarUrl || null,
      initials: initials || "UN",
      tags,
      buttons,
      verified: Boolean(card.verified),
      verifiedCompany: String(card.verifiedCompany || "").trim(),
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
      share:
        '<svg class="icon-stroke h-[15px] w-[15px]" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.25"></circle><circle cx="6" cy="12" r="2.25"></circle><circle cx="18" cy="19" r="2.25"></circle><path d="m8 11 7.5-4.3M8 13l7.5 4.3"></path></svg>',
      verified:
        '<svg class="h-4 w-4 text-neutral-500" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.5l2.2 1.8 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L21.5 12l-1.8 2.2.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 21.5l-2.2-1.8-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2.5 12l1.8-2.2-.3-2.8 2.5-1.2 1.2-2.5 2.8.3L12 2.5Zm-1.1 13.1 5-5-1.1-1.1-3.9 3.9-1.8-1.8-1.1 1.1 2.9 2.9Z"></path></svg>',
      phone: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.7 1.9Z"></path></svg>',
      telegram:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3 2.7 10.4a1 1 0 0 0 .1 1.9l4.6 1.4 1.7 5.3a1 1 0 0 0 1.7.4l2.6-3 4.8 3.6a1 1 0 0 0 1.6-.6L22 4a1 1 0 0 0-1.4-1Z"></path><path d="m7.5 13.5 10.1-7.3"></path></svg>',
      message: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5A8.7 8.7 0 0 1 8 19.2L3 21l1.8-5A8.7 8.7 0 0 1 3.5 12 8.5 8.5 0 1 1 21 12Z"></path></svg>',
      instagram:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="0.8"></circle></svg>',
      click:
        '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7M12 2v4M12 18v4M2 12h4M18 12h4"></path></svg>',
      globe: '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>',
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
    switch (button.type) {
      case "phone":
        return "phone";
      case "telegram":
        return "telegram";
      case "instagram":
        return "instagram";
      case "tiktok":
        return "tiktok";
      case "youtube":
        return "youtube";
      case "website":
        return "globe";
      case "email":
        return "email";
      case "whatsapp":
        return "message";
      default:
        break;
    }

    const signature = `${button.label} ${button.url}`.toLowerCase();
    if (/(telegram|t\.me|message|chat)/.test(signature)) {
      return "telegram";
    }
    if (/(instagram|insta)/.test(signature)) {
      return "instagram";
    }
    if (/(youtube|youtu\.be)/.test(signature)) {
      return "youtube";
    }
    if (/(tiktok|tik tok)/.test(signature)) {
      return "tiktok";
    }
    if (/(phone|call|tel)/.test(signature)) {
      return "phone";
    }
    if (/(mail|email)/.test(signature)) {
      return "email";
    }
    if (/(site|web|link|globe|www)/.test(signature)) {
      return "globe";
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
    const slugPriceLabel =
      Number.isFinite(Number(card.slugPrice)) && Number(card.slugPrice) > 0
        ? `${Number(card.slugPrice).toLocaleString("ru-RU")} сум`
        : "";
    const score = options.score && typeof options.score === "object" ? options.score : null;
    const topBadge = options.topBadge && typeof options.topBadge === "object" ? options.topBadge : null;

    const tagsHtml =
      card.tags.length > 0
        ? `<div class="unq-ref-tags">${card.tags.map((tag) => `<span class="unq-ref-tag">${esc(tag)}</span>`).join("")}</div>`
        : "";

    const buttonsHtml =
      card.buttons.length > 0
        ? card.buttons
          .map(
            (button) =>
              `<a href="${esc(button.url)}" target="_blank" rel="noopener noreferrer" data-track-action data-button-type="${esc(button.type || "other")}" class="public-card-button unq-ref-action-btn">${iconSvg(classifyButton(button))}<span>${esc(button.label)}</span></a>`,
          )
          .join("")
        : '<p class="rounded-xl border border-neutral-200 bg-neutral-50 py-3 text-center text-xs text-neutral-500">Владелец пока не добавил контактные кнопки.</p>';
    const scoreBlock = score
      ? `<div class="unq-score-block">
          <div class="unq-score-head">
            <span class="unq-score-label">UNQ SCORE</span>
            ${score.rarityLabel ? `<span class="unq-rarity-badge">${esc(score.rarityLabel)}</span>` : ""}
          </div>
          <div class="unq-score-row">
            <span class="unq-score-value">${Number(score.score || 0)}</span>
            <span class="unq-score-top">Топ ${Number(score.topPercent || 100)}%</span>
          </div>
          ${score.isForming
        ? '<p class="unq-score-note">UNQ Score формируется · обновляется каждые 24ч</p>'
        : `<div class="unq-score-progress"><span style="width:${Math.max(0, Math.min(100, (Number(score.score || 0) / 999) * 100)).toFixed(2)}%"></span></div>`
      }
        </div>`
      : "";

    const socialLinks = [
      { label: "Telegram", url: findSocialUrl(card.buttons, [/telegram/i, /t\.me/i]), icon: "telegram" },
      { label: "WhatsApp", url: findSocialUrl(card.buttons, [/whatsapp/i, /wa\.me/i]), icon: "message" },
      { label: "Instagram", url: findSocialUrl(card.buttons, [/instagram/i, /insta/i]), icon: "instagram" },
      { label: "LinkedIn", url: findSocialUrl(card.buttons, [/linkedin/i]), icon: "linkedin" },
      { label: "TikTok", url: findSocialUrl(card.buttons, [/tiktok/i, /tik tok/i]), icon: "tiktok" },
      { label: "YouTube", url: findSocialUrl(card.buttons, [/youtube/i, /youtu\.be/i]), icon: "youtube" },
    ];
    const activeSocialLinks = socialLinks.filter((link) => /^https?:\/\//i.test(link.url));

    const mainHashtag = card.hashtag ? (card.hashtag.startsWith("#") ? card.hashtag : `#${card.hashtag}`) : "#UnqPower2026";
    const aboutAddress = card.address;
    const aboutEmail = card.email;
    const aboutPhone = card.extraPhone;
    const aboutPostcode = card.postcode;
    const aboutItems = [
      aboutAddress ? `<p>${iconSvg("location")}<span>${esc(aboutAddress)}</span></p>` : "",
      aboutEmail ? `<p>${iconSvg("email")}<span>${esc(aboutEmail)}</span></p>` : "",
      aboutPhone ? `<p>${iconSvg("phone")}<span>${esc(aboutPhone)}</span></p>` : "",
      aboutPostcode ? `<p>${iconSvg("hashtag")}<span>Postcode: ${esc(aboutPostcode)}</span></p>` : "",
    ].filter(Boolean);
    const aboutHtml =
      aboutItems.length > 0
        ? `<div class="unq-ref-about">
            <p class="unq-ref-about-title">КОНТАКТЫ</p>
            ${aboutItems.join("")}
          </div>`
        : "";
    const topBadgeHtml =
      topBadge && Number.isFinite(Number(topBadge.rank)) && Number(topBadge.rank) > 0
        ? `<div class="unq-ref-top-badge">Топ #${Math.round(Number(topBadge.rank))} этой недели</div>`
        : "";
    const useCustomColor = card.tariff === "premium" && Boolean(card.customColor);
    const rootStyle = useCustomColor ? ` style="--card-button-bg:${esc(card.customColor)};"` : "";
    const companyRoleText = [card.verifiedCompany, card.role].filter(Boolean).join(" • ");
    const companyRoleHtml =
      companyRoleText || card.verified
        ? `<p class="unq-ref-verified-company">${esc(companyRoleText)}${card.verified ? ` ${iconSvg("verified")}` : ""}</p>`
        : "";

    return `
      <div data-card-view data-card-theme="${esc(card.theme)}" data-slug="${esc(card.slug)}" data-share-url="${esc(shareUrl)}"${rootStyle}>
        ${showPausedBanner ? `<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${esc(pausedText)}</div>` : ""}
        <div class="unq-ref-top">
          <div class="unq-ref-slug-wrap">
            <span class="unq-ref-slug"># ${esc(card.slug)}</span>
            ${slugPriceLabel ? `<span class="unq-ref-slug-price">${esc(slugPriceLabel)}</span>` : ""}
          </div>
          <button type="button" data-share-card class="unq-ref-share" aria-label="Поделиться">
            ${iconSvg("share")}
            <span class="sr-only" data-share-label>Поделиться</span>
          </button>
        </div>
        <div class="public-card-shell unq-ref-shell">
          ${topBadgeHtml}
          ${card.showBranding
        ? `<div class="unq-ref-brand">
            <h2>UNQX</h2>
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
              <h1 class="unq-ref-name">${esc(card.name)}</h1>
              ${companyRoleHtml}
              ${card.phone ? `<a href="tel:${esc(card.phone.replace(/\s+/g, ""))}" class="unq-ref-phone">${iconSvg("phone")}<span>${esc(card.phone)}</span></a>` : ""}
            </div>
          </div>
          ${tagsHtml}
          ${scoreBlock}
          <div class="unq-ref-divider"></div>
          <div class="unq-ref-actions">${buttonsHtml}</div>
          <div class="unq-ref-divider"></div>
          <p class="unq-ref-hashtag">${esc(mainHashtag)}</p>
          ${aboutHtml}
          ${activeSocialLinks.length ? `<div class="unq-ref-social">${activeSocialLinks.map(renderSocialLink).join("")}</div>` : ""}
          <button type="button" class="unq-ref-save interactive-btn" data-save-contact>${iconSvg("save")}<span>Сохранить контакт (.vcf)</span></button>
        </div>
        <div class="unq-ref-footline">
          <div>© ${esc(viewsLabel)}</div>
          <div>${card.showBranding ? "• UNQX" : ""}</div>
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
