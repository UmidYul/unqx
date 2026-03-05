const DEFAULT_HOME_SLUG_PRICING = {
  basePrice: 100_000,
  lettersAllSame: 5,
  lettersSequential: 3,
  lettersPalindrome: 2,
  lettersRandom: 1,
  digitsZeros: 6,
  digitsNearZero: 4,
  digitsAllSame: 4,
  digitsSequential: 3,
  digitsRound: 2,
  digitsPalindrome: 1.5,
  digitsRandom: 1,
};
let slugPricingConfig = { ...DEFAULT_HOME_SLUG_PRICING };

(function initPublicHomePage() {
  const pageNode = document.querySelector('[data-page="public-home"]');
  if (!(pageNode instanceof HTMLElement)) {
    return;
  }

  const authApi = initTelegramAuth(pageNode);
  const orderApi = initOrderModalBridge();
  initMobileMenu();
  initHeroSlugOccupancy();
  initSlugAvailability(orderApi);
  initSlugCalculator(orderApi);
  void loadSlugPricingConfig();
  initNextDropOneClick();
  initOrderLinks(orderApi);
  initHomeMotion();
})();

async function loadSlugPricingConfig() {
  try {
    const response = await fetch("/api/cards/slug-pricing-config", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({}));
    if (payload && typeof payload === "object") {
      slugPricingConfig = { ...DEFAULT_HOME_SLUG_PRICING, ...payload };
    }
  } catch {
    slugPricingConfig = { ...DEFAULT_HOME_SLUG_PRICING };
  }
}

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

function normalizeStrictSlug(value) {
  const raw = String(value || "").toUpperCase();
  let letters = "";
  let digits = "";

  for (const char of raw) {
    if (letters.length < 3) {
      if (/[A-Z]/.test(char)) {
        letters += char;
      }
      continue;
    }

    if (digits.length < 3 && /[0-9]/.test(char)) {
      digits += char;
    }

    if (digits.length >= 3) {
      break;
    }
  }

  return `${letters}${digits}`;
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
  const cfg = slugPricingConfig || DEFAULT_HOME_SLUG_PRICING;
  const upper = normalizeLetters(letters);
  if (upper.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const [a, b, c] = upper.split("");

  if (a === b && b === c) {
    return { multiplier: Number(cfg.lettersAllSame || 5), label: "Все одинаковые" };
  }

  const ca = a.charCodeAt(0);
  const cb = b.charCodeAt(0);
  const cc = c.charCodeAt(0);
  if (cb - ca === 1 && cc - cb === 1) {
    return { multiplier: Number(cfg.lettersSequential || 3), label: "По порядку" };
  }

  if (a === c && a !== b) {
    return { multiplier: Number(cfg.lettersPalindrome || 2), label: "Палиндром" };
  }

  return { multiplier: Number(cfg.lettersRandom || 1), label: "Обычные" };
}

function getDigitMultiplier(digits) {
  const cfg = slugPricingConfig || DEFAULT_HOME_SLUG_PRICING;
  const normalized = normalizeDigits(digits);
  if (normalized.length !== 3) {
    return { multiplier: 1, label: "..." };
  }

  const num = Number.parseInt(normalized, 10);
  const [d1, d2, d3] = normalized.split("");

  if (normalized === "000") {
    return { multiplier: Number(cfg.digitsZeros || 6), label: "Тройной ноль" };
  }
  if (num >= 1 && num <= 9 && normalized.startsWith("00")) {
    return { multiplier: Number(cfg.digitsNearZero || 4), label: "Первые девять" };
  }
  if (d1 === d2 && d2 === d3) {
    return { multiplier: Number(cfg.digitsAllSame || 4), label: "Все одинаковые" };
  }

  const n1 = Number.parseInt(d1, 10);
  const n2 = Number.parseInt(d2, 10);
  const n3 = Number.parseInt(d3, 10);
  if (n2 - n1 === 1 && n3 - n2 === 1) {
    return { multiplier: Number(cfg.digitsSequential || 3), label: "По порядку" };
  }
  if (num % 100 === 0 && num > 0) {
    return { multiplier: Number(cfg.digitsRound || 2), label: "Круглое" };
  }
  if (d1 === d3 && d1 !== d2) {
    return { multiplier: Number(cfg.digitsPalindrome || 1.5), label: "Палиндром" };
  }

  return { multiplier: Number(cfg.digitsRandom || 1), label: "Обычные" };
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
  const total = Number(slugPricingConfig?.basePrice || DEFAULT_HOME_SLUG_PRICING.basePrice) * letterData.multiplier * digitData.multiplier;

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
  const loginButtons = Array.from(document.querySelectorAll("[data-auth-login]"));
  const profileLinks = Array.from(document.querySelectorAll("[data-auth-profile]"));
  const profileNames = Array.from(document.querySelectorAll("[data-auth-name]"));
  const profileAvatars = Array.from(document.querySelectorAll("[data-auth-avatar]"));
  let currentUser = null;

  function getSafeNextPath(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      return "/profile";
    }
    return raw;
  }

  function renderAuthUi() {
    for (const node of loginButtons) {
      node.classList.toggle("hidden", Boolean(currentUser));
    }
    for (const node of profileLinks) {
      node.classList.toggle("hidden", !currentUser);
      node.classList.toggle("inline-flex", Boolean(currentUser));
    }
    if (currentUser) {
      for (const node of profileNames) {
        node.textContent = `${currentUser.firstName || currentUser.displayName || "Мой профиль"} · Мой профиль`;
      }
      for (const node of profileAvatars) {
        if (node instanceof HTMLImageElement) {
          node.src = currentUser.photoUrl || "/brand/logo.PNG";
        }
      }
    }
  }

  async function refreshUser() {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
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

  loginButtons.forEach((node) => {
    node.addEventListener("click", async () => {
      await refreshUser();
      if (currentUser) {
        window.location.href = "/profile";
        return;
      }
      window.location.href = "/login";
    });
  });

  profileLinks.forEach((node) => {
    node.addEventListener("click", async (event) => {
      event.preventDefault();
      await refreshUser();
      if (currentUser) {
        window.location.href = "/profile";
        return;
      }
      window.location.href = "/login";
    });
  });

  window.addEventListener("unqx:auth:success", (event) => {
    currentUser = event?.detail || null;
    renderAuthUi();
  });
  window.addEventListener("unqx:auth:logout", () => {
    currentUser = null;
    renderAuthUi();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshUser();
    }
  });
  window.addEventListener("focus", () => {
    void refreshUser();
  });

  void refreshUser();

  return {
    getUser() {
      return currentUser;
    },
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

function initHeroSlugOccupancy() {
  const lineNode = document.getElementById("hero-slug-occupancy");
  if (!(lineNode instanceof HTMLElement)) {
    return;
  }

  const TOTAL_LIMIT = 17_576;
  const format = (value) => Number(value || 0).toLocaleString("ru-RU");

  async function loadOccupancy() {
    try {
      const response = await fetch("/api/cards/slug-counter", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("counter_failed");
      }

      const payload = await response.json();
      const taken = Number(payload?.taken);
      if (!Number.isFinite(taken)) {
        throw new Error("invalid_payload");
      }

      const safeTaken = Math.max(0, Math.min(TOTAL_LIMIT, taken));
      const left = Math.max(0, TOTAL_LIMIT - safeTaken);
      lineNode.textContent = `Занято ${format(safeTaken)} из ${format(TOTAL_LIMIT)} · осталось ${format(left)}`;
      lineNode.classList.remove("hidden");
    } catch {
      lineNode.classList.add("hidden");
      lineNode.textContent = "";
    }
  }

  void loadOccupancy();
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
  const takenOwnerWrap = document.getElementById("home-slug-taken-owner");
  const takenOwnerPhoto = document.getElementById("home-slug-taken-owner-photo");
  const takenOwnerName = document.getElementById("home-slug-taken-owner-name");
  const takenOwnerView = document.getElementById("home-slug-taken-owner-view");
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
    !(takenOwnerWrap instanceof HTMLElement) ||
    !(takenOwnerPhoto instanceof HTMLImageElement) ||
    !(takenOwnerName instanceof HTMLElement) ||
    !(takenOwnerView instanceof HTMLAnchorElement) ||
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
          orderApi.open({ slug: item });
        }
      });
      suggestionsNode.appendChild(button);
    });

    suggestionsWrap.classList.remove("hidden");
  }

  function setFeedback(state, slug, suggestions = [], owner = null) {
    feedback.classList.remove("hidden");

    function setTakenOwner(owner) {
      if (!owner || typeof owner !== "object") {
        takenOwnerWrap.classList.add("hidden");
        takenOwnerName.textContent = "UNQ+ User";
        takenOwnerPhoto.src = "/brand/logo.PNG";
        takenOwnerView.href = `/${slug}`;
        return;
      }

      const ownerName = String(owner.name || "").trim() || "UNQ+ User";
      const ownerPhoto = String(owner.photoUrl || "").trim() || "/brand/logo.PNG";
      const ownerHref = String(owner.href || "").trim() || `/${slug}`;
      takenOwnerName.textContent = ownerName;
      takenOwnerPhoto.src = ownerPhoto;
      takenOwnerView.href = ownerHref;
      takenOwnerWrap.classList.remove("hidden");
    }

    function setPrimaryAction(options) {
      if (!options.visible) {
        primaryAction.classList.add("hidden");
        primaryAction.removeAttribute("data-order-prefill");
        primaryAction.removeAttribute("data-waitlist-slug");
        return;
      }

      primaryAction.classList.remove("hidden");
      primaryAction.href = options.href || "#";
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
      setTakenOwner(null);
      setPrimaryAction({ visible: false });
      return;
    }

    if (state === "invalid") {
      statusIcon.innerHTML = ICON_BAD;
      statusText.textContent = "Формат UNQ должен быть AAA001";
      statusNote.textContent = "Используйте 3 латинские буквы и 3 цифры.";
      renderSuggestions([]);
      setTakenOwner(null);
      setPrimaryAction({ visible: false });
      return;
    }

    if (state === "available") {
      statusIcon.innerHTML = ICON_OK;
      statusText.textContent = `Такой UNQ свободен: ${slug}`;
      statusNote.textContent = "Можешь сразу купить и занять его.";
      renderSuggestions([]);
      setTakenOwner(null);
      setPrimaryAction({
        visible: true,
        slug,
        label: "Купить",
      });
      return;
    }

    if (state === "taken") {
      statusIcon.innerHTML = ICON_BAD;
      statusText.textContent = `UNQ ${slug} занят этим пользователем.`;
      statusNote.textContent = "Выбери похожий свободный UNQ или открой визитку владельца.";
      renderSuggestions(suggestions);
      setTakenOwner(owner);
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
      setTakenOwner(null);
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
    setTakenOwner(null);
    setPrimaryAction({ visible: false });
  }

  async function verifySlug() {
    const slug = normalizeStrictSlug(slugInput.value);
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
    const prevButtonHtml = checkButton.innerHTML;
    checkButton.textContent = "Проверяем...";
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
      setFeedback(
        state,
        slug,
        Array.isArray(payload.suggestions) ? payload.suggestions : [],
        payload.owner && typeof payload.owner === "object" ? payload.owner : null,
      );
    } catch {
      setFeedback("error", slug);
    } finally {
      checkButton.disabled = false;
      checkButton.classList.remove("opacity-75");
      checkButton.innerHTML = prevButtonHtml;
    }
  }

  slugInput.addEventListener("input", () => {
    slugInput.value = normalizeStrictSlug(slugInput.value);
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
      showToast("Добавили в лист ожидания", "success");
    } catch {
      statusNote.textContent = "Не удалось добавить в лист ожидания. Попробуй ещё раз.";
      showToast("Не удалось добавить в лист ожидания", "error");
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

  const buySlugFromQuery = normalizeStrictSlug(new URLSearchParams(window.location.search).get("buySlug") || "");
  if (buySlugFromQuery && SLUG_REGEX.test(buySlugFromQuery)) {
    slugInput.value = buySlugFromQuery;
    if (orderApi && typeof orderApi.open === "function") {
      orderApi.open({ slug: buySlugFromQuery });
    } else {
      void verifySlug();
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("buySlug");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
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
  const similarWrap = document.getElementById("calc-similar-wrap");
  const similarItems = document.getElementById("calc-similar-items");

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
    !(reserveLink instanceof HTMLAnchorElement) ||
    !(similarWrap instanceof HTMLElement) ||
    !(similarItems instanceof HTMLElement)
  ) {
    return;
  }

  const RESERVE_ICON =
    '<svg class="icon-stroke h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>';
  let hasRevealed = false;
  let requestSeq = 0;
  let lastAnimatedPrice = 0;

  function updatePreview(letters, digits) {
    preview.textContent = `unqx.uz/${letters || "___"}${digits || "___"}`;
  }

  async function applyServerPrice(slug, fallbackTotal) {
    const seq = ++requestSeq;
    try {
      const response = await fetch(`/api/cards/slug-price?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) {
        return { total: fallbackTotal, flash: null };
      }
      const payload = await response.json();
      if (seq !== requestSeq) {
        return null;
      }
      const total = Number(payload.price || fallbackTotal);
      const flash =
        payload.hasFlashSale && Number(payload.basePrice || 0) > total
          ? {
              basePrice: Number(payload.basePrice || total),
              finalPrice: total,
              discountPercent: Number(payload.discountPercent || 0),
            }
          : null;
      return { total, flash };
    } catch {
      return { total: fallbackTotal, flash: null };
    }
  }

  async function loadSimilarAvailable(slug) {
    try {
      const response = await fetch(`/api/cards/availability?slug=${encodeURIComponent(slug)}&source=calculator`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      if (payload?.available === true) {
        return [];
      }
      return Array.isArray(payload?.suggestions) ? payload.suggestions.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  function renderSimilarAvailable(items) {
    similarItems.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      similarWrap.classList.add("hidden");
      return;
    }
    items.forEach((slug) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-mono text-[11px] text-neutral-700 transition-colors hover:bg-neutral-50";
      button.textContent = slug;
      button.addEventListener("click", () => {
        const parsed = splitSlug(slug);
        if (!parsed) {
          return;
        }
        lettersInput.value = parsed.letters;
        digitsInput.value = parsed.digits;
        void updateResult();
        if (orderApi) {
          orderApi.open({ slug });
        }
      });
      similarItems.appendChild(button);
    });
    similarWrap.classList.remove("hidden");
  }

  async function updateResult() {
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

    const serverPricing = await applyServerPrice(pricing.slug, pricing.total);
    if (!serverPricing) {
      return;
    }
    const similarSuggestions = await loadSimilarAvailable(pricing.slug);
    const finalPrice = serverPricing.total;
    const rarity = getRarityBadge(finalPrice);

    rarityBadge.className = `inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-wider ${rarity.color}`;
    rarityText.textContent = rarity.label;
    resultSlug.textContent = pricing.slug;
    if (serverPricing.flash) {
      resultPrice.innerHTML = `<span class=\"text-neutral-400 line-through\">${formatPrice(serverPricing.flash.basePrice)}</span> <span class=\"text-emerald-700\" id=\"calc-flash-final-price\">${formatPrice(lastAnimatedPrice)}</span>`;
      const flashFinalNode = resultPrice.querySelector("#calc-flash-final-price");
      if (flashFinalNode instanceof HTMLElement) {
        animateNumberText(flashFinalNode, lastAnimatedPrice, finalPrice);
      }
      resultFormula.textContent = `Flash sale применён (-${serverPricing.flash.discountPercent}%)`;
    } else {
      animateNumberText(resultPrice, lastAnimatedPrice, finalPrice);
      resultFormula.textContent = `${formatPrice(slugPricingConfig.basePrice || DEFAULT_HOME_SLUG_PRICING.basePrice)} x ${pricing.letterData.multiplier} x ${pricing.digitData.multiplier} = ${formatPrice(finalPrice)} сум`;
    }
    lastAnimatedPrice = finalPrice;
    letterMeta.textContent = `${pricing.letterData.label} x${pricing.letterData.multiplier}`;
    digitMeta.textContent = `${pricing.digitData.label} x${pricing.digitData.multiplier}`;
    reserveLink.href = "#";
    reserveLink.setAttribute("data-order-prefill", pricing.slug);
    reserveLink.innerHTML = `Занять ${pricing.slug}${RESERVE_ICON}`;
    renderSimilarAvailable(similarSuggestions);
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
        orderApi.open({ slug: `${lettersInput.value}${digitsInput.value}` });
      }
    });
  });

  updatePreview("", "");
}

function initNextDropOneClick() {
  const cta = document.querySelector("[data-next-drop-waitlist]");
  const card = document.querySelector("[data-next-drop-card]");
  const heroInput = document.getElementById("home-slug-input");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  if (!(cta instanceof HTMLButtonElement) || !(card instanceof HTMLElement)) {
    return;
  }

  const dropId = card.getAttribute("data-next-drop-id");
  if (!dropId) {
    return;
  }

  cta.addEventListener("click", async () => {
    const preferredSlug = heroInput instanceof HTMLInputElement ? normalizeStrictSlug(heroInput.value) : "";
    const previous = cta.textContent;
    cta.disabled = true;
    cta.textContent = "Отправка...";

    try {
      const response = await fetch(`/api/drops/${encodeURIComponent(dropId)}/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          preferredSlug,
        }),
      });

      if (response.status === 401) {
        if (window.UNQOrderModal && typeof window.UNQOrderModal.ensureAuth === "function") {
          window.UNQOrderModal.ensureAuth(() => {
            cta.click();
          });
        }
        cta.disabled = false;
        cta.textContent = previous;
        return;
      }

      if (!response.ok) {
        throw new Error("waitlist_failed");
      }

      cta.textContent = "Уведомление включено";
      cta.disabled = true;
      showToast(
        preferredSlug && /^[A-Z]{3}[0-9]{3}$/.test(preferredSlug)
          ? `Уведомим о дропе для ${preferredSlug}`
          : "Уведомление о следующем дропе включено",
        "success",
      );
    } catch {
      cta.disabled = false;
      cta.textContent = previous;
      showToast("Не удалось подписаться на дроп", "error");
    }
  });
}

function animateNumberText(node, from, to) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const start = Number.isFinite(from) ? from : 0;
  const end = Number.isFinite(to) ? to : 0;
  const duration = 450;
  const startedAt = performance.now();
  const distance = end - start;

  const step = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    const value = Math.round(start + distance * eased);
    node.textContent = formatPrice(value);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

function initOrderModalBridge() {
  return {
    open(options = {}) {
      if (window.UNQOrderModal && typeof window.UNQOrderModal.open === "function") {
        window.UNQOrderModal.open(options);
      }
    },
  };
}

function initOrderLinks(orderApi) {
  if (!orderApi || typeof orderApi.open !== "function") {
    return;
  }
  document.querySelectorAll("[data-order-link]").forEach((node) => {
    if (!(node instanceof HTMLElement) || node.dataset.orderLinkHomeBound === "1") {
      return;
    }
    node.dataset.orderLinkHomeBound = "1";
    node.addEventListener("click", (event) => {
      if (node.getAttribute("data-waitlist-slug")) {
        return;
      }
      event.preventDefault();
      orderApi.open({
        slug: node.getAttribute("data-order-prefill") || "",
        plan: node.getAttribute("data-order-plan") || "",
        theme: node.getAttribute("data-order-theme") || "",
        bracelet: node.getAttribute("data-order-bracelet") === "true",
      });
    });
  });
}

function initHomeMotion() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    return;
  }
  document.body.classList.add("motion-ready");

  document.querySelectorAll("[data-reveal-index]").forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const index = Number(node.getAttribute("data-reveal-index") || 0);
    node.style.animationDelay = `${Math.max(0, index) * 0.1}s`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        const section = entry.target;
        if (section instanceof HTMLElement) {
          section.classList.add("is-visible");
        }
        observer.unobserve(section);
      }
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    },
  );

  document.querySelectorAll("[data-observe-reveal]").forEach((node) => {
    observer.observe(node);
  });
}

function showToast(message, tone = "neutral") {
  if (!message) {
    return;
  }
  let container = document.getElementById("unqx-toast-container");
  if (!(container instanceof HTMLElement)) {
    container = document.createElement("div");
    container.id = "unqx-toast-container";
    container.style.position = "fixed";
    container.style.right = "16px";
    container.style.top = "16px";
    container.style.zIndex = "80";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    container.style.maxWidth = "92vw";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "unqx-toast";
  if (tone === "error") {
    toast.classList.add("is-error");
  }
  if (tone === "success") {
    toast.classList.add("is-success");
  }
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.remove();
    }, 200);
  }, 3200);
}

