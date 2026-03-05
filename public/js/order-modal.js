const UNQ_BASE_PRICE = 100_000;
const DEFAULT_PRICING = {
  planBasicPrice: 50_000,
  planPremiumPrice: 130_000,
  premiumUpgradePrice: 80_000,
  braceletPrice: 300_000,
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
    planBasicPrice: document.getElementById("order-modal-plan-basic-price"),
    planBasicNote: document.getElementById("order-modal-plan-basic-note"),
    planPremiumPrice: document.getElementById("order-modal-plan-premium-price"),
    planPremiumNote: document.getElementById("order-modal-plan-premium-note"),
    planActivationNote: document.getElementById("order-modal-plan-activation-note"),
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
    closeTop: document.getElementById("order-modal-close-top"),
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
  let isClosing = false;
  let countdownTimer = null;
  let pendingAuthCallback = null;
  let priceRequestSeq = 0;
  let lastFocusedElement = null;
  let isCloseConfirming = false;
  let state = {
    slugLocked: false,
    lockedSlug: "",
    theme: "default_dark",
    braceletForced: false,
    dropId: null,
    pricing: { ...DEFAULT_PRICING, userPlan: "none" },
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

  function normalizePlan(value) {
    if (value === "premium") return "premium";
    if (value === "basic") return "basic";
    return "none";
  }

  function currentUserPlan() {
    return normalizePlan(currentUser?.plan || state.pricing?.userPlan || "none");
  }

  function getPricing() {
    const raw = state.pricing || {};
    return {
      planBasicPrice: Number(raw.planBasicPrice || DEFAULT_PRICING.planBasicPrice),
      planPremiumPrice: Number(raw.planPremiumPrice || DEFAULT_PRICING.planPremiumPrice),
      premiumUpgradePrice: Number(raw.premiumUpgradePrice || DEFAULT_PRICING.premiumUpgradePrice),
      braceletPrice: Number(raw.braceletPrice || DEFAULT_PRICING.braceletPrice),
      userPlan: normalizePlan(raw.userPlan || "none"),
    };
  }

  function resolvePlanCharge(selected, userPlan, pricing) {
    if (userPlan === "none") {
      return selected === "premium" ? pricing.planPremiumPrice : pricing.planBasicPrice;
    }
    if (userPlan === "basic" && selected === "premium") {
      return pricing.premiumUpgradePrice;
    }
    return 0;
  }

  async function refreshPricing() {
    try {
      const response = await fetch("/api/cards/pricing", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json().catch(() => ({}));
      state.pricing = {
        ...DEFAULT_PRICING,
        ...payload,
        userPlan: normalizePlan(payload.userPlan),
      };
    } catch {
      state.pricing = { ...DEFAULT_PRICING, userPlan: "none" };
    }
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
    dom.userAvatar.src = currentUser?.photoUrl || "/brand/logo.PNG";
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

  function showConfirm(message) {
    if (window.UNQSiteDialog?.confirm) {
      return window.UNQSiteDialog.confirm(message, {
        title: "Подтверждение",
        confirmText: "Закрыть",
        cancelText: "Остаться",
      });
    }
    if (typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(message));
    }
    return Promise.resolve(false);
  }

  function setSlugMode(pricing) {
    const hasLocked = Boolean(state.slugLocked && pricing);
    dom.slugReadonlyWrap?.classList.toggle("hidden", !hasLocked);
    dom.slugInputsWrap?.classList.toggle("hidden", hasLocked);
    if (hasLocked && dom.slugReadonly instanceof HTMLElement) {
      dom.slugReadonly.textContent = pricing.slug;
    }
  }

  async function resolveServerPrice(slug, fallbackTotal) {
    const seq = ++priceRequestSeq;
    try {
      const response = await fetch(`/api/cards/slug-price?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) {
        return { total: fallbackTotal, flash: null };
      }
      const payload = await response.json();
      if (seq !== priceRequestSeq) {
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

  async function updateTotals() {
    dom.letters.value = normalizeLetters(dom.letters.value);
    dom.digits.value = normalizeDigits(dom.digits.value);
    const pricing = calculateSlugPricing(dom.letters.value, dom.digits.value);
    const requestedPlan = selectedPlan();
    const pricingSettings = getPricing();
    const userPlan = currentUserPlan();
    const planCharge = resolvePlanCharge(requestedPlan, userPlan, pricingSettings);
    const planCardBasic = pricingSettings.planBasicPrice;
    const planCardPremium = userPlan === "basic" ? pricingSettings.premiumUpgradePrice : pricingSettings.planPremiumPrice;
    const bracelet = dom.bracelet.checked;
    const fallbackSlugPrice = pricing ? pricing.total : 0;
    const server = pricing ? await resolveServerPrice(pricing.slug, fallbackSlugPrice) : { total: 0, flash: null };
    if (pricing && !server) {
      return;
    }
    const slugPrice = server ? server.total : fallbackSlugPrice;
    const braceletPrice = bracelet ? pricingSettings.braceletPrice : 0;
    const oneTime = slugPrice + planCharge + braceletPrice;
    const slugLabel = pricing ? pricing.slug : "___ ___";
    const rarity = getRarity(slugPrice);

    setSlugMode(pricing);

    if (dom.planBasicPrice instanceof HTMLElement) {
      dom.planBasicPrice.textContent = `${formatPrice(planCardBasic)} сум`;
    }
    if (dom.planBasicNote instanceof HTMLElement) {
      dom.planBasicNote.textContent =
        userPlan === "basic" || userPlan === "premium" ? "уже куплен ✓" : "один раз · навсегда";
    }
    if (dom.planPremiumPrice instanceof HTMLElement) {
      dom.planPremiumPrice.textContent = `${formatPrice(planCardPremium)} сум`;
    }
    if (dom.planPremiumNote instanceof HTMLElement) {
      dom.planPremiumNote.textContent =
        userPlan === "premium"
          ? "уже куплен ✓"
          : userPlan === "basic"
            ? `${formatPrice(pricingSettings.premiumUpgradePrice)} сум · апгрейд`
            : "один раз · навсегда";
    }
    if (dom.planActivationNote instanceof HTMLElement) {
      dom.planActivationNote.textContent = "После оплаты мы активируем твой тариф и slug.";
    }

    if (dom.slugPreview instanceof HTMLElement) {
      dom.slugPreview.textContent = `unqx.uz/${slugLabel.replace(" ", "")}`;
    }
    if (dom.slugPrice instanceof HTMLElement) {
      if (server?.flash) {
        dom.slugPrice.innerHTML = `<span class=\"line-through text-neutral-400\">${formatPrice(server.flash.basePrice)}</span> <span class=\"text-emerald-700\">${formatPrice(slugPrice)}</span>`;
      } else {
        dom.slugPrice.textContent = formatPrice(slugPrice);
      }
    }
    if (dom.formula instanceof HTMLElement) {
      if (server?.flash) {
        dom.formula.textContent = `Flash sale применён (-${server.flash.discountPercent}%)`;
      } else {
        const m = pricing ? pricing.letterData.multiplier * pricing.digitData.multiplier : 1;
        dom.formula.textContent = `${formatPrice(UNQ_BASE_PRICE)} × ${m} = ${formatPrice(slugPrice)} сум`;
      }
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
      dom.totalPlanTitle.textContent = requestedPlan === "premium" ? "Тариф Премиум" : "Тариф Базовый";
    }
    if (dom.totalPlanValue instanceof HTMLElement) {
      dom.totalPlanValue.textContent =
        planCharge > 0 ? `${formatPrice(planCharge)} сум` : (userPlan === "none" ? "0 сум" : "уже куплен");
    }
    if (dom.totalBraceletRow instanceof HTMLElement) {
      dom.totalBraceletRow.classList.toggle("hidden", !bracelet);
      dom.totalBraceletRow.classList.toggle("flex", bracelet);
    }
    if (dom.totalNow instanceof HTMLElement) {
      dom.totalNow.textContent = `${formatPrice(oneTime)} сум`;
    }
    if (dom.totalMonthly instanceof HTMLElement) {
      dom.totalMonthly.textContent = "Единоразово · больше не платишь";
    }
  }

  function mountWidget() {
    // Telegram auth widget removed in favor of email/password authentication.
  }

  function decorateWidget(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    if (!container.querySelector(".order-modal-tg-fake")) {
      const fake = document.createElement("div");
      fake.className = "order-modal-tg-fake";
      fake.innerHTML = '<span>Войти</span>';
      container.appendChild(fake);
    }
    if (container.dataset.tgFallbackBound !== "1") {
      container.dataset.tgFallbackBound = "1";
      container.addEventListener("click", () => {
        const iframe = container.querySelector("iframe");
        if (!(iframe instanceof HTMLIFrameElement)) {
          // Re-mount widget only when iframe failed to initialize.
          mountWidget();
        }
      });
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
    const [authResult] = await Promise.allSettled([
      (async () => {
        const response = await fetch("/api/auth/me", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        currentUser = payload && payload.authenticated ? payload.user : null;
      })(),
      refreshPricing(),
    ]);
    if (authResult.status !== "fulfilled") {
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
    const currentPlan = currentUserPlan();
    const defaultPlan = currentPlan === "premium" ? "premium" : "basic";
    const planCandidate = options.plan || queryPlan || defaultPlan;
    const plan = planCandidate === "premium" ? "premium" : "basic";
    state.theme = typeof options.theme === "string" && options.theme ? options.theme : queryTheme || "default_dark";
    state.slugLocked = Boolean(parsed);
    state.lockedSlug = parsed ? parsed.slug : "";
    state.braceletForced = options.bracelet === true;
    state.dropId = typeof options.dropId === "string" && options.dropId ? options.dropId : null;
    if (currentPlan === "none") {
      dom.planBasic.disabled = false;
      dom.planPremium.disabled = false;
      dom.planBasic.checked = plan === "basic";
      dom.planPremium.checked = plan === "premium";
    } else if (currentPlan === "basic") {
      dom.planBasic.disabled = true;
      dom.planPremium.disabled = false;
      dom.planBasic.checked = plan !== "premium";
      dom.planPremium.checked = plan === "premium";
    } else {
      dom.planBasic.disabled = true;
      dom.planPremium.disabled = true;
      dom.planBasic.checked = false;
      dom.planPremium.checked = true;
    }
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
    void updateTotals();
  }

  async function open(options = {}) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    isOpen = true;
    isClosing = false;
    stopCountdown();
    dom.root.style.display = "block";
    dom.root.classList.remove("hidden");
    dom.root.classList.add("block");
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => {
      dom.root.classList.add("is-open");
      dom.dialog?.focus();
    });
    await refreshUser();
    prefillFromOpenOptions(options);
    if (currentUser) {
      setStep("form");
    } else {
      setStep("auth");
    }
  }

  async function close(force = false) {
    if (!isOpen || isClosing || isCloseConfirming) {
      return;
    }
    if (!force && dom.stepForm && !dom.stepForm.classList.contains("hidden") && isFormDirty()) {
      isCloseConfirming = true;
      const ok = await showConfirm("Закрыть? Данные не сохранятся");
      isCloseConfirming = false;
      if (!ok || !isOpen || isClosing) {
        return;
      }
    }
    isOpen = false;
    isClosing = true;
    stopCountdown();
    dom.root.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    setStatus("", "neutral");
    window.setTimeout(() => {
      dom.root.style.display = "none";
      dom.root.classList.remove("block");
      dom.root.classList.add("hidden");
      isClosing = false;
      if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
      }
    }, 200);
  }

  function startCountdown(expiresAt) {
    stopCountdown();
    const targetTs = new Date(expiresAt).getTime();
    if (!Number.isFinite(targetTs)) {
      if (dom.countdown instanceof HTMLElement) {
        dom.countdown.textContent = "24:00:00";
      }
      return;
    }
    const tick = () => {
      const diff = Math.max(0, targetTs - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      if (dom.countdown instanceof HTMLElement) {
        dom.countdown.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
        ...(state.dropId ? { dropId: state.dropId } : {}),
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
        return;
      }
      if (error.code === "BASIC_SLUG_LIMIT_REACHED") {
        setStatus("Купи Премиум чтобы добавить slug", "error");
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

  window.unqxOrderModalTelegramAuth = () => {
    window.location.href = "/login";
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
          dropId: node.getAttribute("data-drop-id") || "",
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
          node.textContent = "Добавлено в wishlist";
        } catch {
          node.textContent = "Не удалось. Повтори";
        }
      });
    });
  }

  dom.stepForm.addEventListener("submit", handleSubmit);
  dom.letters.addEventListener("input", () => void updateTotals());
  dom.digits.addEventListener("input", () => void updateTotals());
  dom.planBasic.addEventListener("change", () => void updateTotals());
  dom.planPremium.addEventListener("change", () => void updateTotals());
  dom.bracelet.addEventListener("change", () => void updateTotals());
  dom.logout?.addEventListener("click", () => {
    void postJson("/api/auth/logout", {})
      .then(async () => {
        currentUser = null;
        await refreshUser();
        setStep("auth");
        window.dispatchEvent(new CustomEvent("unqx:auth:logout"));
      })
      .catch(() => {
        setStatus("Не удалось выйти", "error");
      });
  });
  dom.backdrop.addEventListener("click", () => close(false));
  dom.closeTop?.addEventListener("click", () => close(false));
  dom.closeForm?.addEventListener("click", () => close(false));
  dom.closeSuccess?.addEventListener("click", () => close(true));
  dom.goProfile?.addEventListener("click", () => {
    close(true);
    window.location.href = "/profile";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      close(false);
      return;
    }
    if (event.key === "Tab" && isOpen) {
      trapFocus(event);
    }
  });

  function trapFocus(event) {
    if (!(dom.dialog instanceof HTMLElement)) {
      return;
    }

    const focusable = Array.from(
      dom.dialog.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el instanceof HTMLElement && el.offsetParent !== null);

    if (!focusable.length) {
      event.preventDefault();
      dom.dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
  dom.root.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  void refreshUser();
  bindCtas();
  window.addEventListener("unqx:bind-order-ctas", () => {
    bindCtas();
  });
})();
