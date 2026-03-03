const UNQ_BASE_PRICE = 100_000;
const UNQ_BRACELET_PRICE = 300_000;
const UNQ_TARIFFS = {
  basic: 29_000,
  premium: 79_000,
};

(function initOrderModal() {
  const root = document.getElementById("order-modal-root");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const dom = {
    root,
    backdrop: document.getElementById("order-modal-backdrop"),
    dialog: document.getElementById("order-modal-dialog"),
    progressAuth: document.getElementById("order-modal-progress-auth"),
    progressNoAuth: document.getElementById("order-modal-progress-no-auth"),
    stepAuth: document.getElementById("order-modal-step-auth"),
    stepForm: document.getElementById("order-modal-step-form"),
    stepSuccess: document.getElementById("order-modal-step-success"),
    widgetWrap: document.getElementById("order-modal-telegram-widget"),
    userAvatar: document.getElementById("order-modal-user-avatar"),
    userName: document.getElementById("order-modal-user-name"),
    logout: document.getElementById("order-modal-logout"),
    slugReadonlyWrap: document.getElementById("order-modal-slug-readonly-wrap"),
    slugReadonly: document.getElementById("order-modal-slug-readonly"),
    slugInputsWrap: document.getElementById("order-modal-slug-inputs-wrap"),
    letters: document.getElementById("order-modal-letters"),
    digits: document.getElementById("order-modal-digits"),
    slugPreview: document.getElementById("order-modal-slug-preview"),
    rarity: document.getElementById("order-modal-rarity"),
    slugPrice: document.getElementById("order-modal-slug-price"),
    formula: document.getElementById("order-modal-formula"),
    planBasic: document.getElementById("order-modal-plan-basic"),
    planPremium: document.getElementById("order-modal-plan-premium"),
    bracelet: document.getElementById("order-modal-bracelet"),
    name: document.getElementById("order-modal-name"),
    totalSlugTitle: document.getElementById("order-modal-total-slug-title"),
    totalSlugValue: document.getElementById("order-modal-total-slug-value"),
    totalPlanTitle: document.getElementById("order-modal-total-plan-title"),
    totalPlanValue: document.getElementById("order-modal-total-plan-value"),
    totalBraceletRow: document.getElementById("order-modal-total-bracelet-row"),
    totalNow: document.getElementById("order-modal-total-now"),
    totalMonthly: document.getElementById("order-modal-total-monthly"),
    status: document.getElementById("order-modal-status"),
    submit: document.getElementById("order-modal-submit"),
    closeForm: document.getElementById("order-modal-close-form"),
    successSlug: document.getElementById("order-modal-success-slug"),
    countdown: document.getElementById("order-modal-countdown"),
    goProfile: document.getElementById("order-modal-go-profile"),
    closeSuccess: document.getElementById("order-modal-close-success"),
  };

  if (
    !(dom.backdrop instanceof HTMLElement) ||
    !(dom.stepAuth instanceof HTMLElement) ||
    !(dom.stepForm instanceof HTMLFormElement) ||
    !(dom.stepSuccess instanceof HTMLElement) ||
    !(dom.widgetWrap instanceof HTMLElement) ||
    !(dom.letters instanceof HTMLInputElement) ||
    !(dom.digits instanceof HTMLInputElement) ||
    !(dom.name instanceof HTMLInputElement) ||
    !(dom.planBasic instanceof HTMLInputElement) ||
    !(dom.planPremium instanceof HTMLInputElement) ||
    !(dom.bracelet instanceof HTMLInputElement) ||
    !(dom.submit instanceof HTMLButtonElement)
  ) {
    return;
  }

  let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  let currentUser = null;
  let isOpen = false;
  let countdownTimer = null;
  let pendingAuthCallback = null;
  let state = {
    slugLocked: false,
    lockedSlug: "",
    theme: "default_dark",
    braceletForced: false,
  };

  function setCsrfToken(nextToken) {
    if (typeof nextToken !== "string" || !nextToken) {
      return;
    }
    csrfToken = nextToken;
    document.querySelector('meta[name="csrf-token"]')?.setAttribute("content", nextToken);
  }

  function formatPrice(number) {
    return Number(number || 0).toLocaleString("ru-RU").replace(/,/g, " ");
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
      slug: normalized,
    };
  }

  function getLetterMultiplier(letters) {
    const upper = normalizeLetters(letters);
    if (upper.length !== 3) {
      return { multiplier: 1, label: "..." };
    }
    const [a, b, c] = upper.split("");
    if (a === b && b === c) return { multiplier: 5, label: "Все одинаковые" };
    const ca = a.charCodeAt(0);
    const cb = b.charCodeAt(0);
    const cc = c.charCodeAt(0);
    if (cb - ca === 1 && cc - cb === 1) return { multiplier: 3, label: "По порядку" };
    if (a === c && a !== b) return { multiplier: 2, label: "Палиндром" };
    return { multiplier: 1, label: "Обычные" };
  }

  function getDigitMultiplier(digits) {
    const normalized = normalizeDigits(digits);
    if (normalized.length !== 3) {
      return { multiplier: 1, label: "..." };
    }
    const num = Number.parseInt(normalized, 10);
    const [d1, d2, d3] = normalized.split("");
    if (normalized === "000") return { multiplier: 6, label: "000" };
    if (num >= 1 && num <= 9 && normalized.startsWith("00")) return { multiplier: 4, label: "00X" };
    if (d1 === d2 && d2 === d3) return { multiplier: 4, label: "Все одинаковые" };
    const n1 = Number.parseInt(d1, 10);
    const n2 = Number.parseInt(d2, 10);
    const n3 = Number.parseInt(d3, 10);
    if (n2 - n1 === 1 && n3 - n2 === 1) return { multiplier: 3, label: "По порядку" };
    if (num % 100 === 0 && num > 0) return { multiplier: 2, label: "Круглые" };
    if (d1 === d3 && d1 !== d2) return { multiplier: 1.5, label: "Палиндром" };
    return { multiplier: 1, label: "Обычные" };
  }

  function calculateSlugPricing(letters, digits) {
    const normalizedLetters = normalizeLetters(letters);
    const normalizedDigits = normalizeDigits(digits);
    if (normalizedLetters.length !== 3 || normalizedDigits.length !== 3) {
      return null;
    }
    const letterData = getLetterMultiplier(normalizedLetters);
    const digitData = getDigitMultiplier(normalizedDigits);
    const total = UNQ_BASE_PRICE * letterData.multiplier * digitData.multiplier;
    return {
      slug: `${normalizedLetters}${normalizedDigits}`,
      letters: normalizedLetters,
      digits: normalizedDigits,
      letterData,
      digitData,
      total,
    };
  }

  function getRarity(total) {
    if (total >= 2_000_000) return { label: "LEGENDARY", cls: "border-amber-200 bg-amber-100 text-amber-800" };
    if (total >= 1_000_000) return { label: "EPIC", cls: "border-violet-200 bg-violet-100 text-violet-800" };
    if (total >= 400_000) return { label: "RARE", cls: "border-sky-200 bg-sky-100 text-sky-800" };
    return { label: "COMMON", cls: "border-neutral-200 bg-white text-neutral-600" };
  }

  function selectedPlan() {
    return dom.planPremium.checked ? "premium" : "basic";
  }

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: JSON.stringify(body),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `HTTP ${response.status}`);
        error.code = payload.code;
        error.issues = payload.issues;
        throw error;
      }
      if (payload && typeof payload.csrfToken === "string") {
        setCsrfToken(payload.csrfToken);
      }
      return payload;
    });
  }

  function renderUser() {
    if (!(dom.userName instanceof HTMLElement) || !(dom.userAvatar instanceof HTMLImageElement)) {
      return;
    }
    const safeName = currentUser?.firstName || currentUser?.displayName || "Пользователь";
    const username = currentUser?.username ? ` · @${currentUser.username}` : "";
    dom.userName.textContent = `${safeName}${username}`;
    dom.userAvatar.src = currentUser?.photoUrl || "/brand/unq-mark.svg";
  }

  function isFormDirty() {
    const hasSlug = Boolean(normalizeLetters(dom.letters.value) || normalizeDigits(dom.digits.value));
    const hasName = Boolean(dom.name.value.trim());
    return hasSlug || hasName || dom.bracelet.checked || dom.planPremium.checked;
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function setStep(step) {
    dom.stepAuth.classList.toggle("hidden", step !== "auth");
    dom.stepForm.classList.toggle("hidden", step !== "form");
    dom.stepSuccess.classList.toggle("hidden", step !== "success");
  }

  function setProgress() {
    if (!(dom.progressAuth instanceof HTMLElement) || !(dom.progressNoAuth instanceof HTMLElement)) {
      return;
    }
    const showAuth = !currentUser;
    dom.progressAuth.classList.toggle("hidden", !showAuth);
    dom.progressNoAuth.classList.toggle("hidden", showAuth);
  }

  function setStatus(text, tone) {
    if (!(dom.status instanceof HTMLElement)) {
      return;
    }
    dom.status.textContent = text || "";
    dom.status.className = "mt-3 text-sm";
    if (tone === "error") dom.status.classList.add("text-red-700");
    else if (tone === "success") dom.status.classList.add("text-emerald-700");
    else dom.status.classList.add("text-neutral-600");
  }

  function setSlugMode(pricing) {
    const hasLocked = Boolean(state.slugLocked && pricing);
    dom.slugReadonlyWrap?.classList.toggle("hidden", !hasLocked);
    dom.slugInputsWrap?.classList.toggle("hidden", hasLocked);
    if (hasLocked && dom.slugReadonly instanceof HTMLElement) {
      dom.slugReadonly.textContent = pricing.slug;
    }
  }

  function updateTotals() {
    dom.letters.value = normalizeLetters(dom.letters.value);
    dom.digits.value = normalizeDigits(dom.digits.value);
    const pricing = calculateSlugPricing(dom.letters.value, dom.digits.value);
    const plan = selectedPlan();
    const monthly = UNQ_TARIFFS[plan];
    const bracelet = dom.bracelet.checked;
    const slugPrice = pricing ? pricing.total : 0;
    const oneTime = slugPrice + (bracelet ? UNQ_BRACELET_PRICE : 0);
    const slugLabel = pricing ? pricing.slug : "___ ___";
    const rarity = getRarity(slugPrice);

    setSlugMode(pricing);

    if (dom.slugPreview instanceof HTMLElement) {
      dom.slugPreview.textContent = `unqx.uz/${slugLabel.replace(" ", "")}`;
    }
    if (dom.slugPrice instanceof HTMLElement) {
      dom.slugPrice.textContent = formatPrice(slugPrice);
    }
    if (dom.formula instanceof HTMLElement) {
      const m = pricing ? pricing.letterData.multiplier * pricing.digitData.multiplier : 1;
      dom.formula.textContent = `${formatPrice(UNQ_BASE_PRICE)} × ${m} = ${formatPrice(slugPrice)} сум`;
    }
    if (dom.rarity instanceof HTMLElement) {
      dom.rarity.className = `inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider ${rarity.cls}`;
      dom.rarity.textContent = rarity.label;
    }
    if (dom.totalSlugTitle instanceof HTMLElement) {
      dom.totalSlugTitle.textContent = `Slug ${pricing ? pricing.slug : "AAA000"}`;
    }
    if (dom.totalSlugValue instanceof HTMLElement) {
      dom.totalSlugValue.textContent = `${formatPrice(slugPrice)} сум`;
    }
    if (dom.totalPlanTitle instanceof HTMLElement) {
      dom.totalPlanTitle.textContent = plan === "premium" ? "Тариф Премиум" : "Тариф Базовый";
    }
    if (dom.totalPlanValue instanceof HTMLElement) {
      dom.totalPlanValue.textContent = `${formatPrice(monthly)}/мес`;
    }
    if (dom.totalBraceletRow instanceof HTMLElement) {
      dom.totalBraceletRow.classList.toggle("hidden", !bracelet);
      dom.totalBraceletRow.classList.toggle("flex", bracelet);
    }
    if (dom.totalNow instanceof HTMLElement) {
      dom.totalNow.textContent = `${formatPrice(oneTime)} сум`;
    }
    if (dom.totalMonthly instanceof HTMLElement) {
      dom.totalMonthly.textContent = `${formatPrice(monthly)} сум/мес`;
    }
  }

  function mountWidget() {
    const botUsername =
      document.body?.getAttribute("data-telegram-bot-username") ||
      document.querySelector("[data-telegram-bot-username]")?.getAttribute("data-telegram-bot-username") ||
      "";
    if (!botUsername || !(dom.widgetWrap instanceof HTMLElement)) {
      return;
    }
    dom.widgetWrap.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "unqxOrderModalTelegramAuth(user)");
    dom.widgetWrap.appendChild(script);
    decorateWidget(dom.widgetWrap);
  }

  function decorateWidget(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    if (!container.querySelector(".order-modal-tg-fake")) {
      const fake = document.createElement("div");
      fake.className = "order-modal-tg-fake";
      fake.innerHTML = '<span>Войти через Telegram</span>';
      container.appendChild(fake);
    }
    const apply = () => {
      const iframe = container.querySelector("iframe");
      if (iframe instanceof HTMLIFrameElement) {
        iframe.classList.add("order-modal-tg-iframe");
      }
    };
    apply();
    window.setTimeout(apply, 150);
    window.setTimeout(apply, 500);
    window.setTimeout(apply, 1200);
  }

  async function refreshUser() {
    try {
      const response = await fetch("/api/auth/me", { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      currentUser = payload && payload.authenticated ? payload.user : null;
    } catch {
      currentUser = null;
    }
    renderUser();
    setProgress();
    return currentUser;
  }

  function prefillFromOpenOptions(options = {}) {
    const params = new URLSearchParams(window.location.search);
    const queryPlan = params.get("tariff");
    const queryTheme = params.get("theme");
    const parsed = splitSlug(options.slug || "");
    const planCandidate = options.plan || queryPlan || "";
    const plan = planCandidate === "premium" ? "premium" : "basic";
    state.theme = typeof options.theme === "string" && options.theme ? options.theme : queryTheme || "default_dark";
    state.slugLocked = Boolean(parsed);
    state.lockedSlug = parsed ? parsed.slug : "";
    state.braceletForced = options.bracelet === true;
    dom.planBasic.checked = plan === "basic";
    dom.planPremium.checked = plan === "premium";
    dom.bracelet.checked = state.braceletForced;
    dom.bracelet.disabled = state.braceletForced;
    if (parsed) {
      dom.letters.value = parsed.letters;
      dom.digits.value = parsed.digits;
    } else {
      dom.letters.value = "";
      dom.digits.value = "";
    }
    if (currentUser && !dom.name.value.trim()) {
      dom.name.value = currentUser.firstName || currentUser.displayName || "";
    }
    setStatus("", "neutral");
    updateTotals();
  }

  async function open(options = {}) {
    isOpen = true;
    stopCountdown();
    dom.root.style.display = "block";
    dom.root.classList.remove("hidden");
    dom.root.classList.add("block");
    await refreshUser();
    prefillFromOpenOptions(options);
    if (currentUser) {
      setStep("form");
    } else {
      setStep("auth");
      mountWidget();
    }
  }

  function close(force = false) {
    if (!isOpen) {
      return;
    }
    if (!force && dom.stepForm && !dom.stepForm.classList.contains("hidden") && isFormDirty()) {
      if (!window.confirm("Закрыть? Данные не сохранятся")) {
        return;
      }
    }
    isOpen = false;
    stopCountdown();
    dom.root.style.display = "none";
    dom.root.classList.remove("block");
    dom.root.classList.add("hidden");
    setStatus("", "neutral");
  }

  function startCountdown(expiresAt) {
    stopCountdown();
    const targetTs = new Date(expiresAt).getTime();
    if (!Number.isFinite(targetTs)) {
      if (dom.countdown instanceof HTMLElement) {
        dom.countdown.textContent = "⏰ 24:00:00";
      }
      return;
    }
    const tick = () => {
      const diff = Math.max(0, targetTs - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      if (dom.countdown instanceof HTMLElement) {
        dom.countdown.textContent = `⏰ ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("", "neutral");
    if (!currentUser) {
      setStep("auth");
      mountWidget();
      return;
    }
    const pricing = calculateSlugPricing(dom.letters.value, dom.digits.value);
    if (!pricing) {
      setStatus("Заполни slug в формате AAA000", "error");
      return;
    }
    if (!dom.name.value.trim()) {
      setStatus("Имя для визитки обязательно", "error");
      return;
    }
    const plan = selectedPlan();
    const submitHtml = dom.submit.innerHTML;
    dom.submit.disabled = true;
    dom.submit.classList.add("opacity-70", "cursor-not-allowed");
    dom.submit.textContent = "Отправка...";

    try {
      const payload = await postJson("/api/cards/order-request", {
        name: dom.name.value.trim(),
        letters: pricing.letters,
        digits: pricing.digits,
        tariff: plan,
        theme: state.theme || "default_dark",
        products: {
          digitalCard: true,
          bracelet: Boolean(dom.bracelet.checked),
        },
      });
      if (dom.successSlug instanceof HTMLElement) {
        dom.successSlug.textContent = `${pricing.slug} зарезервирован на 24 часа`;
      }
      startCountdown(payload.pendingExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      setStep("success");
      window.dispatchEvent(new CustomEvent("unqx:order:submitted", { detail: payload }));
    } catch (error) {
      if (error.code === "AUTH_REQUIRED") {
        setStep("auth");
        mountWidget();
        return;
      }
      if (error.code === "BASIC_SLUG_LIMIT_REACHED") {
        setStatus("Перейди на Премиум чтобы добавить slug", "error");
        return;
      }
      if (error.code === "PREMIUM_SLUG_LIMIT_REACHED") {
        setStatus("Достигнут лимит 3 slug", "error");
        return;
      }
      if (error.code === "SLUG_NOT_AVAILABLE") {
        setStatus("Этот slug уже занят. Выбери другой.", "error");
        return;
      }
      setStatus(error.message || "Ошибка отправки заявки", "error");
    } finally {
      dom.submit.disabled = false;
      dom.submit.classList.remove("opacity-70", "cursor-not-allowed");
      dom.submit.innerHTML = submitHtml;
    }
  }

  async function handleTelegramAuth(telegramUser) {
    try {
      const payload = await postJson("/api/auth/telegram/callback", telegramUser);
      currentUser = payload.user || null;
      renderUser();
      setProgress();
      if (currentUser && !dom.name.value.trim()) {
        dom.name.value = currentUser.firstName || currentUser.displayName || "";
      }
      setStep("form");
      updateTotals();
      window.dispatchEvent(new CustomEvent("unqx:auth:success", { detail: currentUser }));
      if (typeof pendingAuthCallback === "function") {
        const callback = pendingAuthCallback;
        pendingAuthCallback = null;
        callback(currentUser);
      }
    } catch (error) {
      setStatus(error.message || "Ошибка входа через Telegram", "error");
    }
  }

  window.unqxOrderModalTelegramAuth = (user) => {
    void handleTelegramAuth(user);
  };

  function bindCtas() {
    document.querySelectorAll("[data-order-link]").forEach((node) => {
      if (!(node instanceof HTMLElement) || node.dataset.orderLinkBound === "1") {
        return;
      }
      node.dataset.orderLinkBound = "1";
      node.addEventListener("click", (event) => {
        const waitlistSlug = node.getAttribute("data-waitlist-slug");
        if (waitlistSlug) {
          return;
        }
        event.preventDefault();
        const options = {
          slug: node.getAttribute("data-order-prefill") || "",
          plan: node.getAttribute("data-order-plan") || "",
          theme: node.getAttribute("data-order-theme") || "",
          bracelet: node.getAttribute("data-order-bracelet") === "true",
        };
        void open(options);
      });
    });

    document.querySelectorAll("[data-waitlist-slug]").forEach((node) => {
      if (!(node instanceof HTMLElement) || node.dataset.waitlistBound === "1") {
        return;
      }
      node.dataset.waitlistBound = "1";
      node.addEventListener("click", async (event) => {
        event.preventDefault();
        const slug = node.getAttribute("data-waitlist-slug");
        if (!slug) {
          return;
        }
        try {
          const response = await fetch("/api/cards/waitlist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
            },
            body: JSON.stringify({ slug }),
          });
          if (!response.ok) {
            throw new Error("waitlist_failed");
          }
          if (node instanceof HTMLButtonElement) {
            node.disabled = true;
          }
          node.textContent = "Добавлено в wishlist ✓";
        } catch {
          node.textContent = "Не удалось. Повтори";
        }
      });
    });
  }

  dom.stepForm.addEventListener("submit", handleSubmit);
  dom.letters.addEventListener("input", updateTotals);
  dom.digits.addEventListener("input", updateTotals);
  dom.planBasic.addEventListener("change", updateTotals);
  dom.planPremium.addEventListener("change", updateTotals);
  dom.bracelet.addEventListener("change", updateTotals);
  dom.logout?.addEventListener("click", () => {
    void postJson("/api/auth/logout", {})
      .then(async () => {
        currentUser = null;
        await refreshUser();
        setStep("auth");
        mountWidget();
        window.dispatchEvent(new CustomEvent("unqx:auth:logout"));
      })
      .catch(() => {
        setStatus("Не удалось выйти", "error");
      });
  });
  dom.backdrop.addEventListener("click", () => close(false));
  dom.closeForm?.addEventListener("click", () => close(false));
  dom.closeSuccess?.addEventListener("click", () => close(true));
  dom.goProfile?.addEventListener("click", () => {
    close(true);
    window.location.href = "/profile";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      close(false);
    }
  });

  window.UNQOrderModal = {
    open(options = {}) {
      void open(options);
    },
    close(force = false) {
      close(force);
    },
    ensureAuth(onSuccess) {
      pendingAuthCallback = typeof onSuccess === "function" ? onSuccess : null;
      void open({});
    },
    getUser() {
      return currentUser;
    },
  };

  dom.root.style.display = "none";
  void refreshUser();
  bindCtas();
})();
