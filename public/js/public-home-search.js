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
  const orderApi = initOrderModalBridge();
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
  const loginButtons = Array.from(document.querySelectorAll("[data-auth-login]"));
  const profileLinks = Array.from(document.querySelectorAll("[data-auth-profile]"));
  const profileNames = Array.from(document.querySelectorAll("[data-auth-name]"));
  const profileAvatars = Array.from(document.querySelectorAll("[data-auth-avatar]"));
  let currentUser = null;

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
          node.src = currentUser.photoUrl || "/brand/unq-mark.svg";
        }
      }
    }
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

  loginButtons.forEach((node) => {
    node.addEventListener("click", () => {
      if (currentUser) {
        window.location.href = "/profile";
        return;
      }
      if (window.UNQOrderModal && typeof window.UNQOrderModal.ensureAuth === "function") {
        window.UNQOrderModal.ensureAuth((user) => {
          if (user) {
            window.location.href = "/profile";
          }
        });
      }
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

function initSlugCounter() {
  const section = document.getElementById("slug-counter-wrap");
  const wrap = document.getElementById("slug-counter");
  const valueNode = document.getElementById("slug-counter-value");
  const totalNode = document.getElementById("slug-counter-total");
  const fillNode = document.getElementById("slug-counter-fill");

  if (
    !(section instanceof HTMLElement) ||
    !(wrap instanceof HTMLElement) ||
    !(valueNode instanceof HTMLElement) ||
    !(totalNode instanceof HTMLElement) ||
    !(fillNode instanceof HTMLElement)
  ) {
    return;
  }

  function animateCounter(toValue, toTotal) {
    const safeValue = Math.max(0, Number(toValue) || 0);
    const safeTotal = Math.max(1, Number(toTotal) || 1);
    const durationMs = 1200;
    const startAt = performance.now();
    const startValue = 0;

    const easeOutCubic = (t) => 1 - (1 - t) ** 3;

    function frame(now) {
      const progress = Math.min((now - startAt) / durationMs, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(startValue + (safeValue - startValue) * eased);
      const ratio = Math.max(0, Math.min(1, current / safeTotal));

      valueNode.textContent = Number(current).toLocaleString("ru-RU");
      fillNode.style.width = `${(ratio * 100).toFixed(2)}%`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        valueNode.textContent = Number(safeValue).toLocaleString("ru-RU");
        fillNode.style.width = `${(Math.max(0, Math.min(1, safeValue / safeTotal)) * 100).toFixed(2)}%`;
      }
    }

    requestAnimationFrame(frame);
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

      totalNode.textContent = Number(payload.total).toLocaleString("ru-RU");
      section.classList.remove("hidden");
      wrap.classList.remove("hidden");
      animateCounter(payload.taken, payload.total);
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
          orderApi.open({ slug: item });
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
    reserveLink.href = "#";
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
        orderApi.open({ slug: `${lettersInput.value}${digitsInput.value}` });
      }
    });
  });

  updatePreview("", "");
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

