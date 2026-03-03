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

  const orderApi = initOrderForm();
  initMobileMenu();
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

function initSlugAvailability(orderApi) {
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

  function setFeedback(state, slug) {
    feedback.classList.remove("hidden");

    function setPrimaryAction(options) {
      if (!options.visible) {
        primaryAction.classList.add("hidden");
        primaryAction.removeAttribute("data-order-prefill");
        return;
      }

      primaryAction.classList.remove("hidden");
      primaryAction.href = "#order";
      primaryAction.setAttribute("data-order-prefill", options.slug);
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
      statusNote.textContent = "Slug свободен. Оставь заявку и мы активируем его для тебя.";
      setPrimaryAction({
        visible: true,
        slug,
        label: "Занять slug",
      });
      return;
    }

    if (state === "taken") {
      statusIcon.innerHTML = ICON_INFO;
      statusText.textContent = `unqx.uz/${slug} уже занят`;
      statusNote.textContent = "Этот slug занят, но ты можешь оставить заявку на другой внизу страницы.";
      setPrimaryAction({
        visible: true,
        slug,
        label: "Занять slug",
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

function initOrderForm() {
  const form = document.getElementById("order-form");
  const nameInput = document.getElementById("order-name");
  const lettersInput = document.getElementById("order-letters");
  const digitsInput = document.getElementById("order-digits");
  const contactInput = document.getElementById("order-contact");
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
  const errorContact = document.getElementById("order-error-contact");

  if (
    !(form instanceof HTMLFormElement) ||
    !(nameInput instanceof HTMLInputElement) ||
    !(lettersInput instanceof HTMLInputElement) ||
    !(digitsInput instanceof HTMLInputElement) ||
    !(contactInput instanceof HTMLInputElement) ||
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
    !(errorSlug instanceof HTMLElement) ||
    !(errorContact instanceof HTMLElement)
  ) {
    return null;
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const submitDefaultHtml = submitButton.innerHTML;

  function selectedTariff() {
    const selected = form.querySelector('input[name="order-tariff"]:checked');
    if (!(selected instanceof HTMLInputElement)) {
      return "basic";
    }

    return selected.value === "premium" ? "premium" : "basic";
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
    setError(errorContact, "");
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
      errors.slug = "Slug должен быть в формате AAA000";
    }

    if (!contactInput.value.trim()) {
      errors.contact = "Контакт обязателен";
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

    const { errors, pricing } = validate();
    if (errors.name) {
      setError(errorName, errors.name);
    }
    if (errors.slug) {
      setError(errorSlug, errors.slug);
    }
    if (errors.contact) {
      setError(errorContact, errors.contact);
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
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          letters: pricing.letters,
          digits: pricing.digits,
          tariff,
          products,
          contact: contactInput.value.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload && payload.ok === true) {
        setStatus("✅ Заявка принята! Ожидай сообщения в Telegram.", "success");
        form.reset();
        clearErrors();
        updateOrderTotals();
        return;
      }

      if (response.status === 400 && payload && payload.issues) {
        setError(errorName, payload.issues.name || "");
        setError(errorSlug, payload.issues.slug || "");
        setError(errorContact, payload.issues.contact || "");
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

  updateOrderTotals();

  return {
    prefillSlug,
  };
}
