const BASE_PRICE = 100_000;
const BRACELET_PRICE = 300_000;
const TARIFFS = {
  basic: 29_000,
  premium: 79_000,
};

(function initPublicHomePage() {
  const pageNode = document.querySelector('[data-page="public-home"]');
  if (!(pageNode instanceof HTMLElement)) {
    return;
  }

  const authApi = initTelegramAuth(pageNode);
  const orderApi = initOrderForm(authApi);
  initMobileMenu();
  initSlugCounter();
  initSlugAvailability(orderApi);
  initSlugCalculator(orderApi);
  initOrderLinks(orderApi);
})();

function formatPrice(number) {
  return Number(number).toLocaleString("ru-RU").replace(/,/g, " ");
}

function normalizeLetters(value) {
  return (value || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
}

function normalizeDigits(value) {
  return (value || "").replace(/[^0-9]/g, "").slice(0, 3);
}

function normalizeSlug(value) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function splitSlug(value) {
  const normalized = normalizeSlug(value);
  if (!/^[A-Z]{3}[0-9]{3}$/.test(normalized)) {
    return null;
  }

  return {
    letters: normalized.slice(0, 3),
    digits: normalized.slice(3),
  };
}

function getLetterMultiplier(letters) {
  const upper = normalizeLetters(letters);
  if (upper.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const [a, b, c] = upper.split("");

  if (a === b && b === c) {
    return { multiplier: 5, label: "Все одинаковые" };
  }

  const ca = a.charCodeAt(0);
  const cb = b.charCodeAt(0);
  const cc = c.charCodeAt(0);
  if (cb - ca === 1 && cc - cb === 1) {
    return { multiplier: 3, label: "По порядку" };
  }

  if (a === c && a !== b) {
    return { multiplier: 2, label: "Палиндром" };
  }

  return { multiplier: 1, label: "Обычные" };
}

function getDigitMultiplier(digits) {
  const normalized = normalizeDigits(digits);
  if (normalized.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const num = Number.parseInt(normalized, 10);
  const [d1, d2, d3] = normalized.split("");

  if (normalized === "000") {
    return { multiplier: 6, label: "Тройной ноль" };
  }
  if (num >= 1 && num <= 9 && normalized.startsWith("00")) {
    return { multiplier: 4, label: "Первые девять" };
  }
  if (d1 === d2 && d2 === d3) {
    return { multiplier: 4, label: "Все одинаковые" };
  }

  const n1 = Number.parseInt(d1, 10);
  const n2 = Number.parseInt(d2, 10);
  const n3 = Number.parseInt(d3, 10);
  if (n2 - n1 === 1 && n3 - n2 === 1) {
    return { multiplier: 3, label: "По порядку" };
  }
  if (num % 100 === 0 && num > 0) {
    return { multiplier: 2, label: "Круглое" };
  }
  if (d1 === d3 && d1 !== d2) {
    return { multiplier: 1.5, label: "Палиндром" };
  }

  return { multiplier: 1, label: "Обычные" };
}

function calculateSlugPricing(letters, digits) {
  const normalizedLetters = normalizeLetters(letters);
  const normalizedDigits = normalizeDigits(digits);
  const isComplete = normalizedLetters.length === 3 && normalizedDigits.length === 3;

  if (!isComplete) {
    return null;
  }

  const letterData = getLetterMultiplier(normalizedLetters);
  const digitData = getDigitMultiplier(normalizedDigits);
  const total = BASE_PRICE * letterData.multiplier * digitData.multiplier;

  return {
    letters: normalizedLetters,
    digits: normalizedDigits,
    slug: `${normalizedLetters}${normalizedDigits}`,
    letterData,
    digitData,
    total,
  };
}

function getRarityBadge(total) {
  if (total >= 2_000_000) {
    return { label: "LEGENDARY", color: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  if (total >= 1_000_000) {
    return { label: "EPIC", color: "bg-violet-100 text-violet-800 border-violet-200" };
  }
  if (total >= 400_000) {
    return { label: "RARE", color: "bg-sky-100 text-sky-800 border-sky-200" };
  }
  if (total >= 200_000) {
    return { label: "UNCOMMON", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }
  return { label: "COMMON", color: "bg-neutral-100 text-neutral-600 border-neutral-200" };
}

function initTelegramAuth(pageNode) {
  const botUsername = pageNode.getAttribute("data-telegram-bot-username") || "";
  const loginButtons = Array.from(document.querySelectorAll("[data-auth-login]"));
  const profileLinks = Array.from(document.querySelectorAll("[data-auth-profile]"));
  const profileNames = Array.from(document.querySelectorAll("[data-auth-name]"));
  const profileAvatars = Array.from(document.querySelectorAll("[data-auth-avatar]"));
  const orderAuthBadge = document.getElementById("order-auth-badge");
  const orderAuthUser = document.getElementById("order-auth-user");
  const orderAuthAvatar = document.getElementById("order-auth-avatar");
  const orderAuthLogout = document.getElementById("order-auth-logout");
  const inlineWrap = document.getElementById("order-auth-inline");
  const inlineWidget = document.getElementById("order-auth-inline-widget");
  let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  let currentUser = null;
  let widgetCallback = null;

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    if (payload && typeof payload.csrfToken === "string") {
      csrfToken = payload.csrfToken;
      document.querySelector('meta[name="csrf-token"]')?.setAttribute("content", csrfToken);
    }
    return payload;
  }

  function renderAuthUi() {
    for (const node of loginButtons) {
      node.classList.toggle("hidden", Boolean(currentUser));
    }
    for (const node of profileLinks) {
      node.classList.toggle("hidden", !currentUser);
      node.classList.toggle("inline-flex", Boolean(currentUser));
    }
    if (orderAuthBadge instanceof HTMLElement) {
      orderAuthBadge.classList.toggle("hidden", !currentUser);
    }
    if (inlineWrap instanceof HTMLElement && currentUser) {
      inlineWrap.classList.add("hidden");
    }
    if (currentUser) {
      for (const node of profileNames) {
        node.textContent = `${currentUser.firstName || currentUser.displayName || "Мой профиль"} · Мой профиль`;
      }
      for (const node of profileAvatars) {
        if (node instanceof HTMLImageElement) {
          node.src = currentUser.photoUrl || "/brand/unq-mark.svg";
        }
      }
      if (orderAuthUser instanceof HTMLElement) {
        const username = currentUser.username ? ` · @${currentUser.username}` : "";
        orderAuthUser.textContent = `${currentUser.firstName || currentUser.displayName || "Пользователь"}${username}`;
      }
      if (orderAuthAvatar instanceof HTMLImageElement) {
        orderAuthAvatar.src = currentUser.photoUrl || "/brand/unq-mark.svg";
      }
    }
  }

  async function handleWidgetAuth(telegramUser) {
    const payload = await postJson("/api/auth/telegram/callback", telegramUser);
    currentUser = payload.user || null;
    renderAuthUi();
    window.dispatchEvent(
      new CustomEvent("unqx:auth:success", {
        detail: currentUser,
      }),
    );
    if (typeof widgetCallback === "function") {
      const callback = widgetCallback;
      widgetCallback = null;
      callback(currentUser);
    }
  }

  window.unqxTelegramAuth = (user) => {
    void handleWidgetAuth(user).catch((error) => {
      console.error("[unqx] telegram auth failed", error);
    });
  };

  function mountWidget(container, onSuccess) {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    if (!botUsername) {
      console.error("[unqx] TELEGRAM_BOT_USERNAME is missing");
      return;
    }
    widgetCallback = onSuccess || null;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "unqxTelegramAuth(user)");
    container.appendChild(script);
  }

  async function refreshUser() {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      currentUser = payload && payload.authenticated ? payload.user : null;
    } catch {
      currentUser = null;
    }
    renderAuthUi();
    window.dispatchEvent(
      new CustomEvent("unqx:auth:ready", {
        detail: currentUser,
      }),
    );
    return currentUser;
  }

  async function logout() {
    await postJson("/api/auth/logout", {});
    currentUser = null;
    renderAuthUi();
    window.dispatchEvent(new CustomEvent("unqx:auth:logout"));
  }

  function ensureAuthInline(onSuccess) {
    if (currentUser) {
      if (typeof onSuccess === "function") {
        onSuccess(currentUser);
      }
      return;
    }
    if (inlineWrap instanceof HTMLElement) {
      inlineWrap.classList.remove("hidden");
    }
    mountWidget(inlineWidget, onSuccess || null);
  }

  loginButtons.forEach((node) => {
    node.addEventListener("click", () => {
      if (currentUser) {
        window.location.href = "/profile";
        return;
      }
      ensureAuthInline((user) => {
        if (user) {
          window.location.href = "/profile";
        }
      });
      const section = document.getElementById("order");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  orderAuthLogout?.addEventListener("click", () => {
    void logout().catch((error) => {
      console.error("[unqx] logout failed", error);
    });
  });

  void refreshUser();

  return {
    getUser() {
      return currentUser;
    },
    ensureAuthInline,
    refreshUser,
  };
}

function initMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  const openIcon = document.querySelector("[data-menu-open-icon]");
  const closeIcon = document.querySelector("[data-menu-close-icon]");

  if (!(toggle instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
    return;
  }

  function setOpen(nextOpen) {
    menu.classList.toggle("hidden", !nextOpen);
    toggle.setAttribute("aria-expanded", String(nextOpen));
    if (openIcon instanceof HTMLElement) {
      openIcon.classList.toggle("hidden", nextOpen);
    }
    if (closeIcon instanceof HTMLElement) {
      closeIcon.classList.toggle("hidden", !nextOpen);
    }
  }

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setOpen(false);
    });
  });
}

function initOrderLinks(orderApi) {
  document.querySelectorAll("[data-order-link]").forEach((node) => {
    node.addEventListener("click", () => {
      if (!orderApi) {
        return;
      }

      const slug = node.getAttribute("data-order-prefill");
      if (slug) {
        orderApi.prefillSlug(slug);
      }
    });
  });
}

function initSlugCounter() {
  const section = document.getElementById("slug-counter-wrap");
  const wrap = document.getElementById("slug-counter");
  const valueNode = document.getElementById("slug-counter-value");
  const totalNode = document.getElementById("slug-counter-total");

  if (
    !(section instanceof HTMLElement) ||
    !(wrap instanceof HTMLElement) ||
    !(valueNode instanceof HTMLElement) ||
    !(totalNode instanceof HTMLElement)
  ) {
    return;
  }

  (async () => {
    try {
      const response = await fetch("/api/cards/slug-counter", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      if (!payload || typeof payload.taken !== "number" || typeof payload.total !== "number") {
        return;
      }

      valueNode.textContent = Number(payload.taken).toLocaleString("ru-RU");
      totalNode.textContent = Number(payload.total).toLocaleString("ru-RU");
      section.classList.remove("hidden");
      wrap.classList.remove("hidden");
    } catch {
      // keep hidden on failure
    }
  })();
}

function initSlugAvailability(orderApi) {
  const slugInput = document.getElementById("home-slug-input");
  const checkButton = document.getElementById("home-slug-check");
  const feedback = document.getElementById("home-slug-feedback");
  const statusIcon = document.getElementById("home-slug-status-icon");
  const statusText = document.getElementById("home-slug-status-text");
  const statusNote = document.getElementById("home-slug-note");
  const suggestionsWrap = document.getElementById("home-slug-suggestions-wrap");
  const suggestionsNode = document.getElementById("home-slug-suggestions");
  const primaryAction = document.getElementById("home-slug-primary-action");
  const calculatorAction = document.getElementById("home-slug-calculator-action");

  if (
    !(slugInput instanceof HTMLInputElement) ||
    !(checkButton instanceof HTMLButtonElement) ||
    !(feedback instanceof HTMLElement) ||
    !(statusIcon instanceof HTMLElement) ||
    !(statusText instanceof HTMLElement) ||
    !(statusNote instanceof HTMLElement) ||
    !(suggestionsWrap instanceof HTMLElement) ||
    !(suggestionsNode instanceof HTMLElement) ||
    !(primaryAction instanceof HTMLAnchorElement)
  ) {
    return;
  }

  const SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;
  const ICON_OK =
    '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"></path></svg>';
  const ICON_BAD =
    '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"></path></svg>';
  const ICON_INFO =
    '<svg class="icon-stroke h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8h0M12 11v5"></path></svg>';
  const ICON_LOADING =
    '<svg class="icon-stroke h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9"></path></svg>';
  const ARROW_ICON =
    '<svg class="icon-stroke h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>';

  function renderSuggestions(items) {
    suggestionsNode.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      suggestionsWrap.classList.add("hidden");
      return;
    }

    items.slice(0, 3).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-mono text-[11px] text-neutral-700 transition-colors hover:bg-neutral-50";
      button.textContent = item;
      button.addEventListener("click", () => {
        slugInput.value = item;
        if (orderApi) {
          orderApi.prefillSlug(item);
        }
      });
      suggestionsNode.appendChild(button);
    });

    suggestionsWrap.classList.remove("hidden");
  }

  function setFeedback(state, slug, suggestions = []) {
    feedback.classList.remove("hidden");

    function setPrimaryAction(options) {
      if (!options.visible) {
        primaryAction.classList.add("hidden");
        primaryAction.removeAttribute("data-order-prefill");
        primaryAction.removeAttribute("data-waitlist-slug");
        return;
      }

      primaryAction.classList.remove("hidden");
      primaryAction.href = options.href || "#order";
      if (options.mode === "waitlist") {
        primaryAction.removeAttribute("data-order-prefill");
        primaryAction.setAttribute("data-waitlist-slug", options.slug);
      } else {
        primaryAction.removeAttribute("data-waitlist-slug");
        primaryAction.setAttribute("data-order-prefill", options.slug);
      }
      primaryAction.innerHTML = `${options.label}${ARROW_ICON}`;
    }

    if (state === "loading") {
      statusIcon.innerHTML = ICON_LOADING;
      statusText.textContent = "Проверяем UNQ...";
      statusNote.textContent = "";
      renderSuggestions([]);
      setPrimaryAction({ visible: false });
      return;
    }

    if (state === "invalid") {
      statusIcon.innerHTML = ICON_BAD;
      statusText.textContent = "Формат UNQ должен быть AAA001";
      statusNote.textContent = "Используйте 3 латинские буквы и 3 цифры.";
      renderSuggestions([]);
      setPrimaryAction({ visible: false });
      return;
    }

    if (state === "available") {
      statusIcon.innerHTML = ICON_OK;
      statusText.textContent = `unqx.uz/${slug} доступен`;
      statusNote.textContent = "UNQ свободен. Оставь заявку и мы активируем его для тебя.";
      renderSuggestions([]);
      setPrimaryAction({
        visible: true,
        slug,
        label: "Занять UNQ",
      });
      return;
    }

    if (state === "taken") {
      statusIcon.innerHTML = ICON_BAD;
      statusText.textContent = `❌ ${slug} занят`;
      statusNote.textContent = "Этот UNQ занят, выбери похожий свободный вариант.";
      renderSuggestions(suggestions);
      setPrimaryAction({
        visible: true,
        slug,
        label: "Занять UNQ",
      });
      return;
    }

    if (state === "pending") {
      statusIcon.innerHTML = ICON_INFO;
      statusText.textContent = `${slug} на рассмотрении — скоро освободится`;
      statusNote.textContent = "Добавь UNQ в лист ожидания, и мы сообщим в Telegram.";
      renderSuggestions([]);
      setPrimaryAction({
        visible: true,
        slug,
        mode: "waitlist",
        href: "#hero-check",
        label: "Уведомить меня",
      });
      return;
    }

    statusIcon.innerHTML = ICON_BAD;
    statusText.textContent = "Не удалось проверить UNQ";
    statusNote.textContent = "Повторите попытку через несколько секунд.";
    renderSuggestions([]);
    setPrimaryAction({ visible: false });
  }

  async function verifySlug() {
    const slug = normalizeSlug(slugInput.value);
    slugInput.value = slug;

    if (!slug) {
      feedback.classList.add("hidden");
      return;
    }

    if (!SLUG_REGEX.test(slug)) {
      setFeedback("invalid", slug);
      return;
    }

    checkButton.disabled = true;
    checkButton.classList.add("opacity-75");
    setFeedback("loading", slug);

    try {
      const response = await fetch(`/api/cards/availability?slug=${encodeURIComponent(slug)}&source=hero`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("bad response");
      }

      const payload = await response.json();

      if (!payload || payload.validFormat !== true) {
        setFeedback("invalid", slug);
        return;
      }

      const state =
        payload.available === true
          ? "available"
          : payload.reason === "pending"
            ? "pending"
            : "taken";
      setFeedback(state, slug, Array.isArray(payload.suggestions) ? payload.suggestions : []);
      if (orderApi) {
        orderApi.prefillSlug(slug);
      }
    } catch {
      setFeedback("error", slug);
    } finally {
      checkButton.disabled = false;
      checkButton.classList.remove("opacity-75");
    }
  }

  slugInput.addEventListener("input", () => {
    slugInput.value = normalizeSlug(slugInput.value);
  });

  slugInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void verifySlug();
    }
  });

  checkButton.addEventListener("click", () => {
    void verifySlug();
  });

  primaryAction.addEventListener("click", async (event) => {
    const waitlistSlug = primaryAction.getAttribute("data-waitlist-slug");
    if (!waitlistSlug) {
      return;
    }

    event.preventDefault();

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
      const response = await fetch("/api/cards/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ slug: waitlistSlug }),
      });

      if (!response.ok) {
        throw new Error("waitlist_failed");
      }

      statusNote.textContent = "Готово. Добавили в лист ожидания и уведомим, когда UNQ освободится.";
      primaryAction.classList.add("hidden");
    } catch {
      statusNote.textContent = "Не удалось добавить в лист ожидания. Попробуй ещё раз.";
    }
  });

  if (calculatorAction instanceof HTMLAnchorElement) {
    calculatorAction.addEventListener("click", () => {
      const parsed = splitSlug(slugInput.value);
      if (!parsed) {
        return;
      }

      const calcLettersInput = document.getElementById("calc-letters");
      const calcDigitsInput = document.getElementById("calc-digits");
      if (!(calcLettersInput instanceof HTMLInputElement) || !(calcDigitsInput instanceof HTMLInputElement)) {
        return;
      }

      calcLettersInput.value = parsed.letters;
      calcDigitsInput.value = parsed.digits;
      calcLettersInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

function initSlugCalculator(orderApi) {
  const lettersInput = document.getElementById("calc-letters");
  const digitsInput = document.getElementById("calc-digits");
  const preview = document.getElementById("calc-preview");
  const resultWrap = document.getElementById("calc-result");
  const rarityBadge = document.getElementById("calc-rarity-badge");
  const rarityText = document.getElementById("calc-rarity-text");
  const resultSlug = document.getElementById("calc-result-slug");
  const resultPrice = document.getElementById("calc-result-price");
  const resultFormula = document.getElementById("calc-result-formula");
  const letterMeta = document.getElementById("calc-letter-meta");
  const digitMeta = document.getElementById("calc-digit-meta");
  const reserveLink = document.getElementById("calc-reserve-link");

  if (
    !(lettersInput instanceof HTMLInputElement) ||
    !(digitsInput instanceof HTMLInputElement) ||
    !(preview instanceof HTMLElement) ||
    !(resultWrap instanceof HTMLElement) ||
    !(rarityBadge instanceof HTMLElement) ||
    !(rarityText instanceof HTMLElement) ||
    !(resultSlug instanceof HTMLElement) ||
    !(resultPrice instanceof HTMLElement) ||
    !(resultFormula instanceof HTMLElement) ||
    !(letterMeta instanceof HTMLElement) ||
    !(digitMeta instanceof HTMLElement) ||
    !(reserveLink instanceof HTMLAnchorElement)
  ) {
    return;
  }

  const RESERVE_ICON =
    '<svg class="icon-stroke h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>';
  let hasRevealed = false;

  function updatePreview(letters, digits) {
    preview.textContent = `unqx.uz/${letters || "___"}${digits || "___"}`;
  }

  function updateResult() {
    lettersInput.value = normalizeLetters(lettersInput.value);
    digitsInput.value = normalizeDigits(digitsInput.value);

    const pricing = calculateSlugPricing(lettersInput.value, digitsInput.value);
    updatePreview(lettersInput.value, digitsInput.value);

    if (!pricing) {
      return;
    }

    if (!hasRevealed) {
      hasRevealed = true;
      resultWrap.classList.remove("hidden");
      resultWrap.classList.add("animate-fade-up");
    }

    const rarity = getRarityBadge(pricing.total);

    rarityBadge.className = `inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-wider ${rarity.color}`;
    rarityText.textContent = rarity.label;
    resultSlug.textContent = pricing.slug;
    resultPrice.textContent = formatPrice(pricing.total);
    resultFormula.textContent = `${formatPrice(BASE_PRICE)} x ${pricing.letterData.multiplier} x ${pricing.digitData.multiplier} = ${formatPrice(pricing.total)} сум`;
    letterMeta.textContent = `${pricing.letterData.label} x${pricing.letterData.multiplier}`;
    digitMeta.textContent = `${pricing.digitData.label} x${pricing.digitData.multiplier}`;
    reserveLink.href = "#order";
    reserveLink.setAttribute("data-order-prefill", pricing.slug);
    reserveLink.innerHTML = `Занять ${pricing.slug}${RESERVE_ICON}`;
  }

  lettersInput.addEventListener("input", () => {
    updateResult();
  });

  digitsInput.addEventListener("input", () => {
    updateResult();
  });

  document.querySelectorAll(".calc-example-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      lettersInput.value = (button.getAttribute("data-letters") || "").slice(0, 3);
      digitsInput.value = (button.getAttribute("data-digits") || "").slice(0, 3);
      updateResult();

      if (orderApi) {
        orderApi.prefillSlug(`${lettersInput.value}${digitsInput.value}`);
      }
    });
  });

  updatePreview("", "");
}

function initOrderForm(authApi) {
  const form = document.getElementById("order-form");
  const nameInput = document.getElementById("order-name");
  const lettersInput = document.getElementById("order-letters");
  const digitsInput = document.getElementById("order-digits");
  const themeInput = document.getElementById("order-theme");
  const themePreview = document.getElementById("order-theme-preview");
  const slugPreview = document.getElementById("order-slug-preview");
  const slugPriceCard = document.getElementById("order-slug-price-card");
  const slugPriceValue = document.getElementById("order-slug-price-value");
  const totalSlug = document.getElementById("order-total-slug");
  const totalTariff = document.getElementById("order-total-tariff");
  const totalBraceletRow = document.getElementById("order-total-bracelet-row");
  const totalBracelet = document.getElementById("order-total-bracelet");
  const totalNow = document.getElementById("order-total-now");
  const totalMonthly = document.getElementById("order-total-monthly");
  const submitButton = document.getElementById("order-submit");
  const submitStatus = document.getElementById("order-submit-status");
  const errorName = document.getElementById("order-error-name");
  const errorSlug = document.getElementById("order-error-slug");
  const orderAuthInline = document.getElementById("order-auth-inline");

  if (
    !(form instanceof HTMLFormElement) ||
    !(nameInput instanceof HTMLInputElement) ||
    !(lettersInput instanceof HTMLInputElement) ||
    !(digitsInput instanceof HTMLInputElement) ||
    !(themeInput instanceof HTMLInputElement) ||
    !(themePreview instanceof HTMLElement) ||
    !(slugPreview instanceof HTMLElement) ||
    !(slugPriceCard instanceof HTMLElement) ||
    !(slugPriceValue instanceof HTMLElement) ||
    !(totalSlug instanceof HTMLElement) ||
    !(totalTariff instanceof HTMLElement) ||
    !(totalBraceletRow instanceof HTMLElement) ||
    !(totalBracelet instanceof HTMLElement) ||
    !(totalNow instanceof HTMLElement) ||
    !(totalMonthly instanceof HTMLElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(submitStatus instanceof HTMLElement) ||
    !(errorName instanceof HTMLElement) ||
    !(errorSlug instanceof HTMLElement)
  ) {
    return null;
  }

  const submitDefaultHtml = submitButton.innerHTML;
  let pendingAutoSubmit = false;

  function selectedTariff() {
    const selected = form.querySelector('input[name="order-tariff"]:checked');
    if (!(selected instanceof HTMLInputElement)) {
      return "basic";
    }

    return selected.value === "premium" ? "premium" : "basic";
  }

  function normalizeTheme(theme) {
    const value = String(theme || "").trim();
    const allowed = ["default_dark", "light_minimal", "gradient", "neon", "corporate"];
    if (!allowed.includes(value)) {
      return "default_dark";
    }
    return value;
  }

  function applyTheme(theme) {
    const normalized = normalizeTheme(theme);
    themeInput.value = normalized;
    themePreview.textContent = normalized;
  }

  function applyQueryPrefill() {
    const params = new URLSearchParams(window.location.search);
    const tariff = params.get("tariff");
    if (tariff === "premium" || tariff === "basic") {
      const target = form.querySelector(`input[name="order-tariff"][value="${tariff}"]`);
      if (target instanceof HTMLInputElement) {
        target.checked = true;
      }
    }

    applyTheme(params.get("theme"));
  }

  function productFlags() {
    const digitalCard = form.querySelector("#order-product-card");
    const bracelet = form.querySelector("#order-product-bracelet");
    return {
      digitalCard: digitalCard instanceof HTMLInputElement ? digitalCard.checked : false,
      bracelet: bracelet instanceof HTMLInputElement ? bracelet.checked : false,
    };
  }

  function setError(node, message) {
    if (!message) {
      node.textContent = "";
      node.classList.add("hidden");
      return;
    }

    node.textContent = message;
    node.classList.remove("hidden");
  }

  function clearErrors() {
    setError(errorName, "");
    setError(errorSlug, "");
  }

  function setStatus(text, tone) {
    submitStatus.textContent = text;
    submitStatus.className = "mt-2 text-sm";

    if (tone === "success") {
      submitStatus.classList.add("text-emerald-700");
    } else if (tone === "error") {
      submitStatus.classList.add("text-red-700");
    } else {
      submitStatus.classList.add("text-neutral-500");
    }
  }

  function getSlugPricing() {
    lettersInput.value = normalizeLetters(lettersInput.value);
    digitsInput.value = normalizeDigits(digitsInput.value);
    return calculateSlugPricing(lettersInput.value, digitsInput.value);
  }

  function updateOrderTotals() {
    const pricing = getSlugPricing();
    const tariff = selectedTariff();
    const tariffPrice = TARIFFS[tariff] ?? TARIFFS.basic;
    const products = productFlags();
    const braceletValue = products.bracelet ? BRACELET_PRICE : 0;
    const slugValue = pricing ? pricing.total : 0;
    const oneTime = slugValue + braceletValue;

    slugPreview.textContent = `unqx.uz/${lettersInput.value || "___"}${digitsInput.value || "___"}`;
    slugPriceCard.classList.toggle("hidden", !pricing);
    slugPriceValue.textContent = formatPrice(slugValue);

    totalSlug.textContent = `${formatPrice(slugValue)} сум (разово)`;
    totalTariff.textContent = `${formatPrice(tariffPrice)} сум/мес`;
    totalBracelet.textContent = `${formatPrice(BRACELET_PRICE)} сум`;
    totalBraceletRow.classList.toggle("hidden", !products.bracelet);
    totalBraceletRow.classList.toggle("flex", products.bracelet);
    totalNow.textContent = `${formatPrice(oneTime)} сум`;
    totalMonthly.textContent = `${formatPrice(tariffPrice)} сум/мес`;
  }

  function prefillSlug(slug) {
    const parsed = splitSlug(slug);
    if (!parsed) {
      return;
    }

    lettersInput.value = parsed.letters;
    digitsInput.value = parsed.digits;
    updateOrderTotals();
  }

  function validate() {
    const errors = {};
    const pricing = getSlugPricing();

    if (!nameInput.value.trim()) {
      errors.name = "Имя обязательно";
    }

    if (!pricing) {
      errors.slug = "UNQ должен быть в формате AAA000";
    }

    return {
      errors,
      pricing,
    };
  }

  lettersInput.addEventListener("input", () => {
    updateOrderTotals();
  });

  digitsInput.addEventListener("input", () => {
    updateOrderTotals();
  });

  form.querySelectorAll('input[name="order-tariff"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateOrderTotals();
    });
  });

  const productCard = form.querySelector("#order-product-card");
  const productBracelet = form.querySelector("#order-product-bracelet");
  if (productCard instanceof HTMLInputElement) {
    productCard.addEventListener("change", () => {
      updateOrderTotals();
    });
  }
  if (productBracelet instanceof HTMLInputElement) {
    productBracelet.addEventListener("change", () => {
      updateOrderTotals();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    setStatus("", "neutral");

    const user = authApi && typeof authApi.getUser === "function" ? authApi.getUser() : null;
    if (!user) {
      pendingAutoSubmit = true;
      setStatus("Войди через Telegram чтобы оставить заявку", "error");
      if (orderAuthInline instanceof HTMLElement) {
        orderAuthInline.classList.remove("hidden");
      }
      if (authApi && typeof authApi.ensureAuthInline === "function") {
        authApi.ensureAuthInline(() => {
          if (pendingAutoSubmit) {
            pendingAutoSubmit = false;
            form.requestSubmit();
          }
        });
      }
      return;
    }

    const { errors, pricing } = validate();
    if (errors.name) {
      setError(errorName, errors.name);
    }
    if (errors.slug) {
      setError(errorSlug, errors.slug);
    }

    if (Object.keys(errors).length > 0 || !pricing) {
      return;
    }

    const tariff = selectedTariff();
    const products = productFlags();

    submitButton.disabled = true;
    submitButton.classList.add("opacity-70", "cursor-not-allowed");
    submitButton.textContent = "Отправка...";

    try {
      const response = await fetch("/api/cards/order-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "",
        },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          letters: pricing.letters,
          digits: pricing.digits,
          tariff,
          theme: tariff === "premium" ? normalizeTheme(themeInput.value) : undefined,
          products,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload && payload.ok === true) {
        setStatus("✅ Заявка принята! Ожидай сообщения в Telegram.", "success");
        form.reset();
        clearErrors();
        applyQueryPrefill();
        const currentUser = authApi && typeof authApi.getUser === "function" ? authApi.getUser() : null;
        if (currentUser && !nameInput.value.trim()) {
          nameInput.value = currentUser.firstName || currentUser.displayName || "";
        }
        updateOrderTotals();
        return;
      }

      if (response.status === 400 && payload && payload.issues) {
        setError(errorName, payload.issues.name || "");
        setError(errorSlug, payload.issues.slug || "");
      }

      if (response.status === 401 && payload && payload.code === "AUTH_REQUIRED") {
        pendingAutoSubmit = true;
        setStatus("Войди через Telegram чтобы оставить заявку", "error");
        if (authApi && typeof authApi.ensureAuthInline === "function") {
          authApi.ensureAuthInline(() => {
            if (pendingAutoSubmit) {
              pendingAutoSubmit = false;
              form.requestSubmit();
            }
          });
        }
        return;
      }

      if (response.status === 403 && payload && payload.code === "BASIC_SLUG_LIMIT_REACHED") {
        setStatus("Перейди на Премиум чтобы добавить до 3 UNQ", "error");
        return;
      }

      if (response.status === 403 && payload && payload.code === "PREMIUM_SLUG_LIMIT_REACHED") {
        setStatus("Достигнут лимит 3 UNQ для Премиум тарифа", "error");
        return;
      }
      if (response.status === 409 && payload && payload.code === "SLUG_NOT_AVAILABLE") {
        setStatus(payload.error || "Этот UNQ только что заняли. Выбери другой.", "error");
        return;
      }

      setStatus("❌ Ошибка отправки. Напиши нам напрямую: @unqx_uz", "error");
    } catch {
      setStatus("❌ Ошибка отправки. Напиши нам напрямую: @unqx_uz", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("opacity-70", "cursor-not-allowed");
      submitButton.innerHTML = submitDefaultHtml;
    }
  });

  applyQueryPrefill();
  updateOrderTotals();
  const initialUser = authApi && typeof authApi.getUser === "function" ? authApi.getUser() : null;
  if (initialUser && !nameInput.value.trim()) {
    nameInput.value = initialUser.firstName || initialUser.displayName || "";
  }
  function handleAuthPrefill(event) {
    const user = event && event.detail ? event.detail : null;
    if (user && !nameInput.value.trim()) {
      nameInput.value = user.firstName || user.displayName || "";
    }
    if (pendingAutoSubmit) {
      pendingAutoSubmit = false;
      form.requestSubmit();
    }
  }
  window.addEventListener("unqx:auth:success", handleAuthPrefill);
  window.addEventListener("unqx:auth:ready", handleAuthPrefill);

  return {
    prefillSlug,
  };
}

