(function initPublicHomePage() {
  const pageNode = document.querySelector('[data-page="public-home"]');
  if (!(pageNode instanceof HTMLElement)) {
    return;
  }

  initMobileMenu();
  initSlugAvailability();
  initSlugCalculator();
})();

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

function initSlugAvailability() {
  const slugInput = document.getElementById("home-slug-input");
  const checkButton = document.getElementById("home-slug-check");
  const feedback = document.getElementById("home-slug-feedback");
  const statusIcon = document.getElementById("home-slug-status-icon");
  const statusText = document.getElementById("home-slug-status-text");
  const statusNote = document.getElementById("home-slug-note");
  const primaryAction = document.getElementById("home-slug-primary-action");

  if (
    !(slugInput instanceof HTMLInputElement) ||
    !(checkButton instanceof HTMLButtonElement) ||
    !(feedback instanceof HTMLElement) ||
    !(statusIcon instanceof HTMLElement) ||
    !(statusText instanceof HTMLElement) ||
    !(statusNote instanceof HTMLElement) ||
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

  function normalizeSlug(value) {
    return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function setFeedback(state, slug) {
    feedback.classList.remove("hidden");

    function setPrimaryAction(options) {
      if (!options.visible) {
        primaryAction.classList.add("hidden");
        return;
      }

      primaryAction.classList.remove("hidden");
      primaryAction.href = options.href;
      primaryAction.innerHTML = `${options.label}${ARROW_ICON}`;
    }

    if (state === "loading") {
      statusIcon.innerHTML = ICON_LOADING;
      statusText.textContent = "Проверяем slug...";
      statusNote.textContent = "";
      setPrimaryAction({ visible: false });
      return;
    }

    if (state === "invalid") {
      statusIcon.innerHTML = ICON_BAD;
      statusText.textContent = "Формат slug должен быть AAA001";
      statusNote.textContent = "Используйте 3 латинские буквы и 3 цифры.";
      setPrimaryAction({ visible: false });
      return;
    }

    if (state === "available") {
      statusIcon.innerHTML = ICON_OK;
      statusText.textContent = `unqx.uz/${slug} доступен`;
      statusNote.textContent = "Slug свободен. Можно занимать и публиковать визитку.";
      setPrimaryAction({
        visible: true,
        href: `/admin/cards/new?slug=${encodeURIComponent(slug)}`,
        label: `Занять ${slug}`,
      });
      return;
    }

    if (state === "taken") {
      statusIcon.innerHTML = ICON_INFO;
      statusText.textContent = `unqx.uz/${slug} уже занят`;
      statusNote.textContent = "Этот slug уже используется. Открой карточку или проверь другой.";
      setPrimaryAction({
        visible: true,
        href: `/${encodeURIComponent(slug)}`,
        label: `Открыть ${slug}`,
      });
      return;
    }

    statusIcon.innerHTML = ICON_BAD;
    statusText.textContent = "Не удалось проверить slug";
    statusNote.textContent = "Повторите попытку через несколько секунд.";
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
      const response = await fetch(`/api/cards/availability?slug=${encodeURIComponent(slug)}`, {
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

      setFeedback(payload.available ? "available" : "taken", slug);
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
}

function initSlugCalculator() {
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

  const BASE_PRICE = 100_000;
  let hasRevealed = false;

  function formatPrice(number) {
    return Number(number).toLocaleString("ru-RU").replace(/,/g, " ");
  }

  function getLetterMultiplier(letters) {
    const upper = letters.toUpperCase();
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
    if (digits.length !== 3) {
      return { multiplier: 1, label: "..." };
    }

    const num = Number.parseInt(digits, 10);
    const [d1, d2, d3] = digits.split("");

    if (digits === "000") {
      return { multiplier: 6, label: "Тройной ноль" };
    }

    if (num >= 1 && num <= 9 && digits.startsWith("00")) {
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

  function updatePreview(letters, digits) {
    preview.textContent = `unqx.uz/${letters || "___"}${digits || "___"}`;
  }

  function updateResult() {
    const letters = lettersInput.value;
    const digits = digitsInput.value;
    const isFilled = letters.length === 3 && digits.length === 3;

    updatePreview(letters, digits);

    if (!isFilled) {
      return;
    }

    if (!hasRevealed) {
      hasRevealed = true;
      resultWrap.classList.remove("hidden");
      resultWrap.classList.add("animate-fade-up");
    }

    const letterData = getLetterMultiplier(letters);
    const digitData = getDigitMultiplier(digits);
    const total = BASE_PRICE * letterData.multiplier * digitData.multiplier;
    const rarity = getRarityBadge(total);
    const slug = `${letters}${digits}`;

    rarityBadge.className = `inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-wider ${rarity.color}`;
    rarityText.textContent = rarity.label;
    resultSlug.textContent = slug;
    resultPrice.textContent = formatPrice(total);
    resultFormula.textContent = `${formatPrice(BASE_PRICE)} x ${letterData.multiplier} x ${digitData.multiplier} = ${formatPrice(total)} сум`;
    letterMeta.textContent = `${letterData.label} x${letterData.multiplier}`;
    digitMeta.textContent = `${digitData.label} x${digitData.multiplier}`;
    reserveLink.href = `/admin/cards/new?slug=${encodeURIComponent(slug)}`;
    reserveLink.innerHTML = `Занять ${slug}<svg class="icon-stroke h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>`;
  }

  lettersInput.addEventListener("input", () => {
    lettersInput.value = lettersInput.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
    updateResult();
  });

  digitsInput.addEventListener("input", () => {
    digitsInput.value = digitsInput.value.replace(/[^0-9]/g, "").slice(0, 3);
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
    });
  });

  updatePreview("", "");
}
