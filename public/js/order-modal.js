// Заглушка для syncQuickPayState, чтобы не было ReferenceError
async function syncQuickPayState() {
  // TODO: реализовать или восстановить логику, если требуется
  return null;
}
const DEFAULT_SLUG_PRICING = {
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
const DEFAULT_PRICING = {
  planBasicPrice: 50_000,
  planPremiumPrice: 130_000,
  premiumUpgradePrice: 80_000,
  braceletPrice: 300_000,
};
const PENDING_PURCHASE_INTENT_KEY = "unqx.pendingPurchaseIntent.v1";
const PENDING_PURCHASE_INTENT_TTL_MS = 2 * 60 * 60 * 1000;

(function initOrderModal() {
  const root = document.getElementById("order-modal-root");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const dom = {
    root,
    backdrop: document.getElementById("order-modal-backdrop"),
    dialog: document.getElementById("order-modal-dialog"),
    progressBarInner: document.getElementById("order-modal-progress-bar-inner"),
    progressLabel: document.getElementById("order-modal-progress-label"),
    progressAuth: document.getElementById("order-modal-progress-auth"),
    progressNoAuth: document.getElementById("order-modal-progress-no-auth"),
    stepAuth: document.getElementById("order-modal-step-auth"),
    authLogin: document.getElementById("order-modal-auth-login"),
    authRegister: document.getElementById("order-modal-auth-register"),
    stepPending: document.getElementById("order-modal-step-pending"),
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
    planBasicCard: document.getElementById("order-modal-plan-basic-card"),
    planPremiumCard: document.getElementById("order-modal-plan-premium-card"),
    planBasicPrice: document.getElementById("order-modal-plan-basic-price"),
    planBasicNote: document.getElementById("order-modal-plan-basic-note"),
    planPremiumPrice: document.getElementById("order-modal-plan-premium-price"),
    planPremiumNote: document.getElementById("order-modal-plan-premium-note"),
    planSection: document.getElementById("order-modal-plan-section"),
    planActivationNote: document.getElementById("order-modal-plan-activation-note"),
    bracelet: document.getElementById("order-modal-bracelet"),
    promoCode: document.getElementById("order-modal-promo-code"),
    promoCheck: document.getElementById("order-modal-promo-check"),
    campaignHint: document.getElementById("order-modal-campaign-hint"),
    fraudHint: document.getElementById("order-modal-fraud-hint"),
    name: document.getElementById("order-modal-name"),
    totalSlugTitle: document.getElementById("order-modal-total-slug-title"),
    totalSlugValue: document.getElementById("order-modal-total-slug-value"),
    totalPlanRow: document.getElementById("order-modal-total-plan-row"),
    totalPlanTitle: document.getElementById("order-modal-total-plan-title"),
    totalPlanValue: document.getElementById("order-modal-total-plan-value"),
    totalProductDiscountRow: document.getElementById("order-modal-total-product-discount-row"),
    totalProductDiscountValue: document.getElementById("order-modal-total-product-discount-value"),
    totalInviteeDiscountRow: document.getElementById("order-modal-total-invitee-discount-row"),
    totalInviteeDiscountValue: document.getElementById("order-modal-total-invitee-discount-value"),
    totalBonusRow: document.getElementById("order-modal-total-bonus-row"),
    totalBonusValue: document.getElementById("order-modal-total-bonus-value"),
    totalCapRow: document.getElementById("order-modal-total-cap-row"),
    totalCapValue: document.getElementById("order-modal-total-cap-value"),
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
    pendingMeta: document.getElementById("order-modal-pending-meta"),
    pendingStatus: document.getElementById("order-modal-pending-status"),
    pendingContinue: document.getElementById("order-modal-pending-continue"),
    pendingCancel: document.getElementById("order-modal-pending-cancel"),
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
  let currentStep = "auth";
  let lastFocusedElement = null;
  let isCloseConfirming = false;
  let lastTelegramPaymentUrl = "https://t.me/unqx_uz";
  let state = {
    slugLocked: false,
    lockedSlug: "",
    theme: "default_dark",
    braceletForced: false,
    dropId: null,
    refSource: "",
    refOffer: "",
    promoCode: "",
    promoValidationHint: "",
    checkoutContext: null,
    submitBlockedMessage: "",
    lastOpenOptions: {},
    initialFormSnapshot: null,
    pricing: { ...DEFAULT_PRICING, userPlan: "none" },
    slugPricing: { ...DEFAULT_SLUG_PRICING },
    forceAuth: false,
  };

  const STEP_PROGRESS = {
    auth: { width: "25%" },
    form: { width: "25%" },
    pending: { width: "100%", label: "Незавершённый заказ", line: "Продолжите оплату или отмените заказ" },
    success: { width: "100%", label: "Готово", line: "Заявка создана · ожидаем оплату" },
  };

  function setCsrfToken(nextToken) {
    if (typeof nextToken !== "string" || !nextToken) {
      return;
    }
    csrfToken = nextToken;
    document.querySelector('meta[name="csrf-token"]')?.setAttribute("content", nextToken);
  }

  function normalizeOpenIntent(options = {}) {
    const slugParsed = splitSlug(options.slug || "");
    const slug = slugParsed ? slugParsed.slug : "";
    const planRaw = String(options.plan || "").trim().toLowerCase();
    const plan = planRaw === "premium" ? "premium" : planRaw === "basic" ? "basic" : "";
    const theme = String(options.theme || "").trim();
    const dropId = String(options.dropId || "").trim();
    const refSource = String(options.refSource || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    const refOffer = String(options.refOffer || "").trim().toLowerCase().replace(/[^a-z0-9_.:-]/g, "").slice(0, 80);
    const promoCode = String(options.promoCode || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    return {
      slug,
      plan,
      theme,
      bracelet: Boolean(options.bracelet),
      dropId,
      refSource,
      refOffer,
      promoCode,
    };
  }

  function hasMeaningfulIntent(intent) {
    if (!intent || typeof intent !== "object") return false;
    return Boolean(intent.slug || intent.plan || intent.theme || intent.bracelet || intent.dropId || intent.refSource || intent.refOffer || intent.promoCode);
  }

  function readPendingPurchaseIntent() {
    try {
      const raw = window.localStorage.getItem(PENDING_PURCHASE_INTENT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const createdAt = Number(parsed.createdAt || 0);
      if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
      if (Date.now() - createdAt > PENDING_PURCHASE_INTENT_TTL_MS) return null;
      const intent = normalizeOpenIntent(parsed.options || {});
      return hasMeaningfulIntent(intent) ? intent : null;
    } catch {
      return null;
    }
  }

  function clearPendingPurchaseIntent() {
    try {
      window.localStorage.removeItem(PENDING_PURCHASE_INTENT_KEY);
    } catch {
      // ignore localStorage errors
    }
  }

  function savePendingPurchaseIntent(options = {}) {
    const intent = normalizeOpenIntent(options);
    if (!hasMeaningfulIntent(intent)) {
      clearPendingPurchaseIntent();
      return;
    }
    try {
      window.localStorage.setItem(
        PENDING_PURCHASE_INTENT_KEY,
        JSON.stringify({
          createdAt: Date.now(),
          options: intent,
        }),
      );
    } catch {
      // ignore localStorage errors
    }
  }

  function buildAuthNextPath() {
    return `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
  }

  function bindAuthIntentLinks() {
    const intent = normalizeOpenIntent(state.lastOpenOptions || {});
    const nextPath = buildAuthNextPath();

    if (dom.authLogin instanceof HTMLAnchorElement) {
      dom.authLogin.href = `/login?next=${encodeURIComponent(nextPath)}`;
      if (dom.authLogin.dataset.intentBound !== "1") {
        dom.authLogin.dataset.intentBound = "1";
        dom.authLogin.addEventListener("click", () => {
          savePendingPurchaseIntent(state.lastOpenOptions || {});
        });
      }
    }

    if (dom.authRegister instanceof HTMLAnchorElement) {
      dom.authRegister.href = `/register?next=${encodeURIComponent(nextPath)}`;
      if (dom.authRegister.dataset.intentBound !== "1") {
        dom.authRegister.dataset.intentBound = "1";
        dom.authRegister.addEventListener("click", () => {
          savePendingPurchaseIntent(state.lastOpenOptions || intent);
        });
      }
    }
  }

  function restorePurchaseIntentIfNeeded() {
    if (isOpen || !currentUser) {
      return;
    }
    const intent = readPendingPurchaseIntent();
    if (!intent) {
      clearPendingPurchaseIntent();
      return;
    }
    clearPendingPurchaseIntent();
    void open(intent);
  }

  function openTelegramUrl(url) {
    const fallbackUrl = "https://t.me/unqx_uz";
    const telegramUrl = /^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(url || "") ? url : fallbackUrl;
    const [baseUrl, query = ""] = telegramUrl.split("?");
    const username = String(baseUrl.replace(/^https:\/\/t\.me\//i, "")).trim() || "unqx_uz";
    const params = new URLSearchParams(query);
    const text = params.get("text");
    const tgAppUrl = `tg://resolve?domain=${encodeURIComponent(username)}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    if (isMobile) {
      window.location.href = tgAppUrl;
      window.setTimeout(() => {
        window.location.href = telegramUrl;
      }, 900);
      return;
    }
    window.location.href = telegramUrl;
  }


  function formatPrice(number) {
    return Number(number || 0).toLocaleString("ru-RU").replace(/,/g, " ");
  }

  function formatHoursRu(value) {
    const hours = Math.max(1, Math.round(Number(value) || 0));
    const mod10 = hours % 10;
    const mod100 = hours % 100;
    const suffix = mod10 === 1 && mod100 !== 11 ? "час" : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? "часа" : "часов";
    return `${hours} ${suffix}`;
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
    const cfg = state.slugPricing || DEFAULT_SLUG_PRICING;
    const upper = normalizeLetters(letters);
    if (upper.length !== 3) {
      return { multiplier: 1, label: "..." };
    }
    const [a, b, c] = upper.split("");
    if (a === b && b === c) return { multiplier: Number(cfg.lettersAllSame || 5), label: "Все одинаковые" };
    const ca = a.charCodeAt(0);
    const cb = b.charCodeAt(0);
    const cc = c.charCodeAt(0);
    if (cb - ca === 1 && cc - cb === 1) return { multiplier: Number(cfg.lettersSequential || 3), label: "По порядку" };
    if (a === c && a !== b) return { multiplier: Number(cfg.lettersPalindrome || 2), label: "Палиндром" };
    return { multiplier: Number(cfg.lettersRandom || 1), label: "Обычные" };
  }

  function getDigitMultiplier(digits) {
    const cfg = state.slugPricing || DEFAULT_SLUG_PRICING;
    const normalized = normalizeDigits(digits);
    if (normalized.length !== 3) {
      return { multiplier: 1, label: "..." };
    }
    const num = Number.parseInt(normalized, 10);
    const [d1, d2, d3] = normalized.split("");
    if (normalized === "000") return { multiplier: Number(cfg.digitsZeros || 6), label: "000" };
    if (num >= 1 && num <= 9 && normalized.startsWith("00")) return { multiplier: Number(cfg.digitsNearZero || 4), label: "00X" };
    if (d1 === d2 && d2 === d3) return { multiplier: Number(cfg.digitsAllSame || 4), label: "Все одинаковые" };
    const n1 = Number.parseInt(d1, 10);
    const n2 = Number.parseInt(d2, 10);
    const n3 = Number.parseInt(d3, 10);
    if (n2 - n1 === 1 && n3 - n2 === 1) return { multiplier: Number(cfg.digitsSequential || 3), label: "По порядку" };
    if (num % 100 === 0 && num > 0) return { multiplier: Number(cfg.digitsRound || 2), label: "Круглые" };
    if (d1 === d3 && d1 !== d2) return { multiplier: Number(cfg.digitsPalindrome || 1.5), label: "Палиндром" };
    return { multiplier: Number(cfg.digitsRandom || 1), label: "Обычные" };
  }

  function calculateSlugPricing(letters, digits) {
    const normalizedLetters = normalizeLetters(letters);
    const normalizedDigits = normalizeDigits(digits);
    if (normalizedLetters.length !== 3 || normalizedDigits.length !== 3) {
      return null;
    }
    const letterData = getLetterMultiplier(normalizedLetters);
    const digitData = getDigitMultiplier(normalizedDigits);
    const slugValue = `${normalizedLetters}${normalizedDigits}`;
    const multipliedBase = Number(state.slugPricing?.basePrice || DEFAULT_SLUG_PRICING.basePrice) * letterData.multiplier * digitData.multiplier;
    const customRules = Array.isArray(state.slugPricing?.customRules) ? state.slugPricing.customRules : [];
    let customDeltaTotal = 0;
    const customBreakdown = [];
    for (const rawRule of customRules) {
      if (!rawRule || typeof rawRule !== "object") continue;
      const pattern = String(rawRule.pattern || "").trim().toUpperCase();
      const type = String(rawRule.type || "").trim();
      const delta = Number(rawRule.delta || 0);
      if (!pattern || !Number.isFinite(delta) || delta === 0) continue;
      let match = false;
      if (type === "contains" && slugValue.includes(pattern)) match = true;
      if (type === "startsWith" && slugValue.startsWith(pattern)) match = true;
      if (type === "endsWith" && slugValue.endsWith(pattern)) match = true;
      if (type === "regex") {
        try {
          if (new RegExp(pattern).test(slugValue)) match = true;
        } catch {
          match = false;
        }
      }
      if (!match) continue;
      customDeltaTotal += delta;
      customBreakdown.push({ label: String(rawRule.label || pattern).trim() || pattern, delta });
    }
    const total = multipliedBase + customDeltaTotal;
    return {
      slug: slugValue,
      letters: normalizedLetters,
      digits: normalizedDigits,
      letterData,
      digitData,
      multipliedBase,
      customDeltaTotal,
      customBreakdown,
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
    const userPlan = currentUserPlan();
    if (userPlan === "premium") {
      return "premium";
    }
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

  function resolveRequestedPlanFromOpenOptions(options = {}) {
    const params = new URLSearchParams(window.location.search);
    const queryPlan = params.get("tariff");
    const raw = String(options.plan || queryPlan || "").trim().toLowerCase();
    return raw === "premium" ? "premium" : "basic";
  }

  function resolveFallbackAttribution() {
    const path = String(window.location.pathname || "").toLowerCase();
    if (path.startsWith("/drops")) {
      return { refSource: "drops", refOffer: "drop_live" };
    }
    return { refSource: "order_modal", refOffer: "default" };
  }

  function resolveAttributionFromOptions(options = {}) {
    const fallback = resolveFallbackAttribution();
    const source = String(options.refSource || state.refSource || fallback.refSource || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40);
    const offer = String(options.refOffer || state.refOffer || fallback.refOffer || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, "")
      .slice(0, 80);
    return {
      refSource: source || fallback.refSource,
      refOffer: offer || fallback.refOffer,
    };
  }

  async function fetchOrderPrecheck(options = {}) {
    const requestedPlan = resolveRequestedPlanFromOpenOptions(options);
    const attribution = resolveAttributionFromOptions(options);
    const params = new URLSearchParams();
    params.set("requestedPlan", requestedPlan);
    if (attribution.refSource) params.set("refSource", attribution.refSource);
    if (attribution.refOffer) params.set("refOffer", attribution.refOffer);
    const promoCode = String(state.promoCode || (dom.promoCode instanceof HTMLInputElement ? dom.promoCode.value : "") || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 32);
    if (promoCode) {
      params.set("promoCode", promoCode);
    }
    try {
      const response = await fetch(`/api/cards/order-precheck?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      return payload;
    } catch {
      return {
        authenticated: Boolean(currentUser),
        currentPlan: currentUserPlan(),
        requestedPlan,
        resolvedPlan: requestedPlan,
        canPurchase: Boolean(currentUser),
        nextAction: currentUser ? "checkout" : "login",
        message: "",
        referral: {
          enabled: false,
          source: attribution.refSource,
          offer: attribution.refOffer,
          walletBalance: 0,
          hasReferrer: false,
          firstOrderEligible: false,
          inviteeDiscountCandidate: 0,
          bonusSpendCandidate: 0,
          capPercent: 0,
          breakdown: {
            inviteeDiscountApplied: 0,
            bonusSpent: 0,
            discountCapApplied: 0,
            productDiscountAmount: 0,
          },
        },
      };
    }
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

  function syncPlanVisibilityByUserPlan(userPlan) {
    const isBasic = userPlan === "basic";
    const isPremium = userPlan === "premium";

    if (dom.planBasicCard instanceof HTMLElement) {
      dom.planBasicCard.classList.toggle("hidden", isBasic || isPremium);
    }
    if (dom.planPremiumCard instanceof HTMLElement) {
      dom.planPremiumCard.classList.toggle("hidden", isPremium);
    }
    if (dom.planSection instanceof HTMLElement) {
      const hideWholeSection = isPremium;
      dom.planSection.classList.toggle("hidden", hideWholeSection);
    }

    if (isBasic) {
      dom.planBasic.checked = false;
      dom.planPremium.checked = true;
      dom.planBasic.disabled = true;
      dom.planPremium.disabled = false;
    }
    if (isPremium) {
      dom.planBasic.checked = false;
      dom.planPremium.checked = true;
      dom.planBasic.disabled = true;
      dom.planPremium.disabled = true;
    }
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

  async function refreshSlugPricing() {
    try {
      const response = await fetch("/api/cards/slug-pricing-config", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      state.slugPricing = {
        ...DEFAULT_SLUG_PRICING,
        ...(payload && typeof payload === "object" ? payload : {}),
      };
    } catch {
      state.slugPricing = { ...DEFAULT_SLUG_PRICING };
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
        error.reason = payload.reason;
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

  function getCurrentFormSnapshot() {
    return {
      letters: normalizeLetters(dom.letters.value),
      digits: normalizeDigits(dom.digits.value),
      name: String(dom.name.value || "").trim(),
      bracelet: Boolean(dom.bracelet.checked),
      plan: selectedPlan(),
    };
  }

  function isFormDirty() {
    const baseline = state.initialFormSnapshot;
    const current = getCurrentFormSnapshot();
    if (!baseline || typeof baseline !== "object") {
      return Boolean(current.letters || current.digits || current.name || current.bracelet || current.plan === "premium");
    }
    return (
      current.letters !== String(baseline.letters || "") ||
      current.digits !== String(baseline.digits || "") ||
      current.name !== String(baseline.name || "") ||
      current.bracelet !== Boolean(baseline.bracelet) ||
      current.plan !== String(baseline.plan || "basic")
    );
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function getFormStages() {
    const stages = [];
    if (!state.slugLocked) {
      stages.push("Slug");
    }
    if (dom.planSection instanceof HTMLElement && !dom.planSection.classList.contains("hidden")) {
      stages.push("Тариф");
    }
    if (dom.bracelet instanceof HTMLInputElement && !dom.bracelet.disabled) {
      stages.push("Дополнительно");
    }
    stages.push("Подтверждение");
    return stages;
  }

  function formatStagesLine(stages) {
    return stages.map((label, index) => `${String.fromCodePoint(0x2460 + index)} ${label}`).join(" · ");
  }

  function setStep(step) {
    currentStep = step;
    const progress = STEP_PROGRESS[step] || STEP_PROGRESS.form;
    if (dom.progressBarInner instanceof HTMLElement) {
      dom.progressBarInner.style.width = progress.width;
    }

    let label = String(progress.label || "");
    let line = String(progress.line || "");
    if (step === "form") {
      const stages = getFormStages();
      label = `Шаг 1 из ${stages.length}`;
      line = formatStagesLine(stages);
    }
    if (step === "auth") {
      label = "";
      line = "";
    }
    if (dom.progressLabel instanceof HTMLElement) {
      dom.progressLabel.textContent = label;
      dom.progressLabel.classList.toggle("hidden", !label);
    }
    if (dom.progressAuth instanceof HTMLElement) {
      dom.progressAuth.textContent = line;
    }
    if (dom.progressNoAuth instanceof HTMLElement) {
      dom.progressNoAuth.textContent = line;
    }
    setProgress();

    dom.stepAuth.classList.toggle("hidden", step !== "auth");
    dom.stepPending?.classList.toggle("hidden", step !== "pending");
    dom.stepForm.classList.toggle("hidden", step !== "form");
    dom.stepSuccess.classList.toggle("hidden", step !== "success");
  }

  function setProgress() {
    if (!(dom.progressAuth instanceof HTMLElement) || !(dom.progressNoAuth instanceof HTMLElement)) {
      return;
    }
    const lineAuth = String(dom.progressAuth.textContent || "").trim();
    const lineNoAuth = String(dom.progressNoAuth.textContent || "").trim();
    const hasLine = Boolean(lineAuth || lineNoAuth);
    if (currentStep === "auth" || !hasLine) {
      dom.progressAuth.classList.add("hidden");
      dom.progressNoAuth.classList.add("hidden");
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

  function setPendingStatus(text, tone) {
    if (!(dom.pendingStatus instanceof HTMLElement)) {
      return;
    }
    dom.pendingStatus.textContent = text || "";
    dom.pendingStatus.className = "mt-3 text-sm";
    if (tone === "error") dom.pendingStatus.classList.add("text-red-700");
    else if (tone === "success") dom.pendingStatus.classList.add("text-emerald-700");
    else dom.pendingStatus.classList.add("text-neutral-600");
  }

  function formatPendingDateTime(value) {
    try {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  function planLabel(plan) {
    return String(plan || "").toLowerCase() === "premium" ? "Премиум" : "Базовый";
  }

  function buildPendingPaymentUrl(order) {
    if (!order || typeof order !== "object") {
      return "https://t.me/unqx_uz";
    }
    const serverUrl = String(order.paymentUrl || "").trim();
    if (/^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/.test(serverUrl)) {
      return serverUrl;
    }
    const reference = String(order.paymentReference || "").trim() || `UNQX-${String(order.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;
    const slug = String(order.slug || "").trim().toUpperCase();
    const slugPrice = Number(order.slugPrice || 0);
    const inviteeDiscountApplied = Number(order.inviteeDiscountApplied || 0);
    const bonusSpent = Number(order.bonusSpent || 0);
    const planPriceValue = Number(order.planPrice || 0);
    const braceletPriceValue = order.bracelet ? Number(order.braceletPrice || 300000) : 0;
    const totalAmount = Number(order.totalOneTime || Math.max(0, slugPrice - inviteeDiscountApplied - bonusSpent) + planPriceValue + braceletPriceValue);
    const userName = (currentUser?.displayName || currentUser?.firstName || "").trim() || "не указано";
    const userEmail = (currentUser?.email || "").trim() || "не указан";
    const message = `Здравствуйте! Хочу оплатить заказ #️⃣ ${reference}\n\nUNQ: ${slug}\nФИО: ${userName}\nEmail: ${userEmail}\n\n💳 Детализация оплаты:\n• Slug ${slug}: ${formatPrice(slugPrice)} сум\n• Скидка по рефералке: -${formatPrice(inviteeDiscountApplied)} сум\n• Списано бонусов: -${formatPrice(bonusSpent)} сум\n• Тариф ${planLabel(order.requestedPlan)}: ${formatPrice(planPriceValue)} сум\n• Браслет: ${formatPrice(braceletPriceValue)} сум\n\nИтого к оплате: ${formatPrice(totalAmount)} сум`;
    return `https://t.me/unqx_uz?text=${encodeURIComponent(message)}`;
  }

  function renderPendingOrderState(precheck) {
    const wrap = dom.stepPending;
    if (!(wrap instanceof HTMLElement)) {
      return;
    }

    const action = String(precheck?.nextAction || "");
    const pending = precheck?.pendingOrder && typeof precheck.pendingOrder === "object" ? precheck.pendingOrder : null;
    const visible = action === "resume_pending" && Boolean(pending);
    if (!visible) {
      setPendingStatus("", "neutral");
      quickPayState = null;
      quickPayDismissed = false;
      renderQuickPayButton();
      if (dom.pendingMeta instanceof HTMLElement) {
        dom.pendingMeta.textContent = "UNQ: —";
      }
      if (dom.pendingContinue instanceof HTMLAnchorElement) {
        dom.pendingContinue.href = "#";
      }
      if (dom.pendingCancel instanceof HTMLButtonElement) {
        dom.pendingCancel.removeAttribute("data-order-id");
      }
      return;
    }

    const meta = `UNQ: ${String(pending.slug || "—").toUpperCase()} · Тариф: ${planLabel(pending.requestedPlan)} · Резерв до: ${formatPendingDateTime(pending.pendingExpiresAt)}`;
    if (dom.pendingMeta instanceof HTMLElement) {
      dom.pendingMeta.textContent = meta;
    }
    if (dom.pendingContinue instanceof HTMLAnchorElement) {
      const url = buildPendingPaymentUrl(pending);
      dom.pendingContinue.href = url;
      lastTelegramPaymentUrl = url;
      quickPayState = {
        url,
        orderId: String(pending.id || "").trim(),
        slug: String(pending.slug || "").trim().toUpperCase(),
        reference: String(pending.paymentReference || "").trim(),
      };
      quickPayDismissed = false;
      renderQuickPayButton();
    }
    if (dom.pendingCancel instanceof HTMLButtonElement) {
      dom.pendingCancel.setAttribute("data-order-id", String(pending.id || ""));
    }
  }

  function setSubmitBlockedMessage(message) {
    const normalized = String(message || "").trim();
    state.submitBlockedMessage = normalized;
    const blocked = Boolean(normalized);
    if (!(dom.submit instanceof HTMLButtonElement)) {
      return;
    }
    dom.submit.disabled = blocked;
    dom.submit.classList.toggle("opacity-70", blocked);
    dom.submit.classList.toggle("cursor-not-allowed", blocked);
    if (blocked) {
      dom.submit.title = normalized;
    } else {
      dom.submit.removeAttribute("title");
    }
  }

  function applyOrderPrecheck(context) {
    state.checkoutContext = context && typeof context === "object" ? context : null;
    const precheck = state.checkoutContext;
    if (!precheck) {
      renderPendingOrderState(null);
      setSubmitBlockedMessage("");
      setStatus("", "neutral");
      return "form";
    }

    if (precheck.pricing && typeof precheck.pricing === "object") {
      state.pricing = {
        ...DEFAULT_PRICING,
        ...state.pricing,
        ...precheck.pricing,
        userPlan: normalizePlan(precheck.currentPlan || precheck.pricing.userPlan || state.pricing?.userPlan),
      };
    }

    const forceAuth = Boolean(state.forceAuth) && document.body?.getAttribute("data-page") === "profile-page";
    if (forceAuth && (!precheck.authenticated || precheck.nextAction === "login")) {
      if (!currentUser) {
        currentUser = getProfileUserFallback();
      }
      if (currentUser?.plan) {
        precheck.currentPlan = currentUser.plan;
      }
      precheck.authenticated = true;
      precheck.nextAction = "checkout";
      precheck.canPurchase = true;
      precheck.message = "";
    }

    if (!precheck.authenticated || precheck.nextAction === "login") {
      renderPendingOrderState(precheck);
      setSubmitBlockedMessage("");
      setStatus(String(precheck.message || ""), "neutral");
      setPendingStatus("", "neutral");
      return "auth";
    }

    renderPendingOrderState(precheck);

    const action = String(precheck.nextAction || "checkout");
    if (action === "resume_pending" && precheck.pendingOrder) {
      setSubmitBlockedMessage("");
      setStatus("", "neutral");
      setPendingStatus(String(precheck.message || ""), "neutral");
      return "pending";
    }

    const canPurchase = precheck.canPurchase !== false;
    const message = String(precheck.message || "").trim();
    const blockedMessage = canPurchase ? "" : (message || "Покупка сейчас недоступна.");
    setSubmitBlockedMessage(blockedMessage);
    setPendingStatus("", "neutral");

    if (message) {
      const tone = action === "already_basic" || action === "already_premium" || action === "upgrade" ? "neutral" : (canPurchase ? "neutral" : "error");
      setStatus(message, tone);
    } else {
      setStatus("", "neutral");
    }

    void updateTotals();
    return "form";
  }

  function showConfirm(message, options = {}) {
    const title = String(options.title || "Подтверждение");
    const confirmText = String(options.confirmText || "Подтвердить");
    const cancelText = String(options.cancelText || "Отмена");
    if (window.UNQSiteDialog?.confirm) {
      return window.UNQSiteDialog.confirm(message, {
        title,
        confirmText,
        cancelText,
      });
    }
    try {
      return Promise.resolve(window.confirm(String(message || "")));
    } catch {
      return Promise.resolve(false);
    }
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
      return {
        total,
        flash,
        source: String(payload.source || "calculator"),
        calculation: payload?.calculation && typeof payload.calculation === "object" ? payload.calculation : null,
      };
    } catch {
      return { total: fallbackTotal, flash: null, source: "calculator", calculation: null };
    }
  }

  async function updateTotals() {
    dom.letters.value = normalizeLetters(dom.letters.value);
    dom.digits.value = normalizeDigits(dom.digits.value);
    const pricing = calculateSlugPricing(dom.letters.value, dom.digits.value);
    const requestedPlan = selectedPlan();
    const pricingSettings = getPricing();
    const userPlan = currentUserPlan();
    const hasExistingPlan = userPlan === "basic" || userPlan === "premium";
    const planCharge = resolvePlanCharge(requestedPlan, userPlan, pricingSettings);
    const planCardBasic = pricingSettings.planBasicPrice;
    const planCardPremium = userPlan === "basic" ? pricingSettings.premiumUpgradePrice : pricingSettings.planPremiumPrice;
    const bracelet = dom.bracelet.checked;
    const slugBasePrice = Number(state.slugPricing?.basePrice || DEFAULT_SLUG_PRICING.basePrice);
    const fallbackSlugPrice = pricing ? pricing.total : 0;
    const server = pricing ? await resolveServerPrice(pricing.slug, fallbackSlugPrice) : { total: 0, flash: null };
    if (pricing && !server) {
      return;
    }
    const slugPrice = server ? server.total : fallbackSlugPrice;
    const slugBaseForCap = server?.flash?.basePrice ? Number(server.flash.basePrice || slugPrice) : slugPrice;
    const productDiscountAmount = Math.max(0, Math.round(slugBaseForCap - slugPrice));
    const referral = state.checkoutContext?.referral && typeof state.checkoutContext.referral === "object" ? state.checkoutContext.referral : null;
    const capPercent = Number(referral?.capPercent || 0);
    const inviteeCandidate = Number(referral?.inviteeDiscountCandidate || 0);
    const walletBalance = Number(referral?.walletBalance || 0);
    const capAmount = Math.max(0, Math.floor((Math.max(0, slugBaseForCap) * capPercent) / 100));
    const capRemaining = Math.max(0, capAmount - productDiscountAmount);
    const inviteeDiscountApplied = Math.max(0, Math.min(inviteeCandidate, capRemaining, slugPrice));
    const afterInvitee = Math.max(0, slugPrice - inviteeDiscountApplied);
    const bonusSpent = Math.max(0, Math.min(walletBalance, Math.max(0, capRemaining - inviteeDiscountApplied), afterInvitee));
    const slugPayable = Math.max(0, afterInvitee - bonusSpent);
    const discountCapApplied = Math.max(0, (inviteeCandidate - inviteeDiscountApplied) + Math.max(0, walletBalance - bonusSpent));
    const braceletPrice = bracelet ? pricingSettings.braceletPrice : 0;
    const oneTime = slugPayable + planCharge + braceletPrice;
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
    syncPlanVisibilityByUserPlan(userPlan);

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
      } else if (server?.source === "override") {
        dom.formula.textContent = `Персональная цена: ${formatPrice(slugPrice)} сум`;
      } else {
        const calc = server?.calculation;
        const base = Number(calc?.basePrice || slugBasePrice);
        const lettersMultiplier = Number(calc?.lettersMultiplier || pricing?.letterData?.multiplier || 1);
        const digitsMultiplier = Number(calc?.digitsMultiplier || pricing?.digitData?.multiplier || 1);
        const customBreakdown =
          Array.isArray(calc?.customBreakdown) && calc.customBreakdown.length
            ? calc.customBreakdown
            : Array.isArray(pricing?.customBreakdown)
              ? pricing.customBreakdown
              : [];
        const customParts = customBreakdown
          .map((item) => {
            const delta = Number(item?.delta || 0);
            if (!delta) return "";
            const sign = delta > 0 ? "+" : "-";
            const amount = formatPrice(Math.abs(delta));
            const label = String(item?.label || "").trim();
            return `${sign} ${amount}${label ? ` (${label})` : ""}`;
          })
          .filter(Boolean)
          .join(" ");
        const customDeltaTotal = Number(calc?.customDeltaTotal ?? (pricing?.customDeltaTotal || 0));
        const tail = customParts ? ` ${customParts}` : "";
        if (!customParts && customDeltaTotal) {
          const sign = customDeltaTotal > 0 ? "+" : "-";
          dom.formula.textContent = `${formatPrice(base)} × ${lettersMultiplier} × ${digitsMultiplier} ${sign} ${formatPrice(Math.abs(customDeltaTotal))} = ${formatPrice(slugPrice)} сум`;
        } else {
          dom.formula.textContent = `${formatPrice(base)} × ${lettersMultiplier} × ${digitsMultiplier}${tail} = ${formatPrice(slugPrice)} сум`;
        }
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
      dom.totalSlugValue.textContent = `${formatPrice(slugPayable)} сум`;
    }
    if (dom.totalPlanTitle instanceof HTMLElement) {
      dom.totalPlanTitle.textContent = requestedPlan === "premium" ? "Тариф Премиум" : "Тариф Базовый";
    }
    if (dom.totalPlanValue instanceof HTMLElement) {
      dom.totalPlanValue.textContent =
        planCharge > 0 ? `${formatPrice(planCharge)} сум` : (userPlan === "none" ? "0 сум" : "уже куплен");
    }
    if (dom.totalPlanRow instanceof HTMLElement) {
      dom.totalPlanRow.classList.toggle("hidden", hasExistingPlan);
      dom.totalPlanRow.classList.toggle("flex", !hasExistingPlan);
    }
    if (dom.totalBraceletRow instanceof HTMLElement) {
      dom.totalBraceletRow.classList.toggle("hidden", !bracelet);
      dom.totalBraceletRow.classList.toggle("flex", bracelet);
    }
    if (dom.totalProductDiscountRow instanceof HTMLElement) {
      dom.totalProductDiscountRow.classList.toggle("hidden", productDiscountAmount <= 0);
      dom.totalProductDiscountRow.classList.toggle("flex", productDiscountAmount > 0);
    }
    if (dom.totalProductDiscountValue instanceof HTMLElement) {
      dom.totalProductDiscountValue.textContent = `-${formatPrice(productDiscountAmount)} сум`;
    }
    if (dom.totalInviteeDiscountRow instanceof HTMLElement) {
      dom.totalInviteeDiscountRow.classList.toggle("hidden", inviteeDiscountApplied <= 0);
      dom.totalInviteeDiscountRow.classList.toggle("flex", inviteeDiscountApplied > 0);
    }
    if (dom.totalInviteeDiscountValue instanceof HTMLElement) {
      dom.totalInviteeDiscountValue.textContent = `-${formatPrice(inviteeDiscountApplied)} сум`;
    }
    if (dom.totalBonusRow instanceof HTMLElement) {
      dom.totalBonusRow.classList.toggle("hidden", bonusSpent <= 0);
      dom.totalBonusRow.classList.toggle("flex", bonusSpent > 0);
    }
    if (dom.totalBonusValue instanceof HTMLElement) {
      dom.totalBonusValue.textContent = `-${formatPrice(bonusSpent)} сум`;
    }
    if (dom.totalCapRow instanceof HTMLElement) {
      dom.totalCapRow.classList.toggle("hidden", discountCapApplied <= 0);
      dom.totalCapRow.classList.toggle("flex", discountCapApplied > 0);
    }
    if (dom.totalCapValue instanceof HTMLElement) {
      dom.totalCapValue.textContent = `+${formatPrice(discountCapApplied)} сум`;
    }
    if (dom.totalNow instanceof HTMLElement) {
      dom.totalNow.textContent = `${formatPrice(oneTime)} сум`;
    }
    if (dom.totalMonthly instanceof HTMLElement) {
      dom.totalMonthly.textContent = "Единоразово · больше не платишь";
    }
    if (dom.campaignHint instanceof HTMLElement) {
      const campaignApplied = Boolean(referral?.campaignApplied);
      const campaignName = String(referral?.campaignName || "").trim();
      const promoCodeApplied = String(referral?.promoCodeApplied || "").trim();
      if (campaignApplied) {
        dom.campaignHint.classList.remove("hidden");
        dom.campaignHint.textContent = campaignName
          ? `Применена кампания: ${campaignName}${promoCodeApplied ? ` (${promoCodeApplied})` : ""}`
          : `Применена акция${promoCodeApplied ? ` (${promoCodeApplied})` : ""}`;
      } else if (state.promoValidationHint) {
        dom.campaignHint.classList.remove("hidden");
        dom.campaignHint.textContent = state.promoValidationHint;
      } else {
        dom.campaignHint.classList.add("hidden");
        dom.campaignHint.textContent = "";
      }
    }
    if (dom.fraudHint instanceof HTMLElement) {
      const fraudVerdict = String(referral?.fraudVerdict || "").trim().toLowerCase();
      const fraudHint = String(referral?.fraudHint || "").trim();
      if (fraudVerdict === "block") {
        dom.fraudHint.classList.remove("hidden");
        dom.fraudHint.textContent = "Кампанийная скидка недоступна для этого заказа. Применен стандартный расчет.";
      } else if (fraudVerdict === "review") {
        dom.fraudHint.classList.remove("hidden");
        dom.fraudHint.textContent = fraudHint
          ? `Проверка безопасности: ${fraudHint}. Награда рефереру будет после проверки.`
          : "Проверка безопасности: награда рефереру будет после проверки.";
      } else {
        dom.fraudHint.classList.add("hidden");
        dom.fraudHint.textContent = "";
      }
    }
  }

  async function validatePromoCodeManually() {
    if (!(dom.promoCode instanceof HTMLInputElement)) {
      return;
    }
    const promoCode = String(dom.promoCode.value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 32);
    dom.promoCode.value = promoCode;
    state.promoCode = promoCode;
    if (!promoCode) {
      state.promoValidationHint = "";
      if (dom.campaignHint instanceof HTMLElement) {
        dom.campaignHint.classList.add("hidden");
        dom.campaignHint.textContent = "";
      }
      await refreshCheckoutContext();
      return;
    }
    const originalText = dom.promoCheck instanceof HTMLButtonElement ? dom.promoCheck.textContent : "";
    if (dom.promoCheck instanceof HTMLButtonElement) {
      dom.promoCheck.disabled = true;
      dom.promoCheck.textContent = "Проверка...";
    }
    try {
      const payload = await postJson("/api/referrals/promo/validate", {
        promoCode,
        refSource: state.refSource || "order_modal",
        refOffer: state.refOffer || "default",
      });
      if (payload?.valid) {
        state.promoValidationHint = "";
        if (dom.campaignHint instanceof HTMLElement) {
          dom.campaignHint.classList.remove("hidden");
          dom.campaignHint.textContent = `Промокод применен: ${promoCode}${payload?.campaignName ? ` · ${payload.campaignName}` : ""}`;
        }
      } else {
        state.promoValidationHint = "Промокод не найден или не активен.";
        if (dom.campaignHint instanceof HTMLElement) {
          dom.campaignHint.classList.remove("hidden");
          dom.campaignHint.textContent = state.promoValidationHint;
        }
      }
    } catch (error) {
      state.promoValidationHint = "Промокод не найден или не активен.";
      if (dom.campaignHint instanceof HTMLElement) {
        dom.campaignHint.classList.remove("hidden");
        dom.campaignHint.textContent = state.promoValidationHint;
      }
      setStatus(error?.message || "Промокод недействителен", "error");
    } finally {
      if (dom.promoCheck instanceof HTMLButtonElement) {
        dom.promoCheck.disabled = false;
        dom.promoCheck.textContent = originalText || "Проверить";
      }
      await refreshCheckoutContext();
      await updateTotals();
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

  function getProfileUserFallback() {
    const isProfilePage = document.body?.getAttribute("data-page") === "profile-page";
    if (!isProfilePage) {
      return null;
    }
    const candidate = window.UNQProfileUser;
    return candidate && typeof candidate === "object" ? candidate : null;
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
      refreshSlugPricing(),
    ]);
    if (authResult.status !== "fulfilled") {
      currentUser = null;
    }
    if (!currentUser) {
      const fallbackUser = getProfileUserFallback();
      if (fallbackUser) {
        currentUser = fallbackUser;
      }
    }
    renderUser();
    setProgress();
    return currentUser;
  }

  function prefillFromOpenOptions(options = {}, precheck = null) {
    const params = new URLSearchParams(window.location.search);
    const queryPlan = params.get("tariff");
    const queryTheme = params.get("theme");
    const parsed = splitSlug(options.slug || "");
    const currentPlan = normalizePlan(precheck?.currentPlan || currentUserPlan());
    const defaultPlan = currentPlan === "premium" ? "premium" : "basic";
    const contextPlan = precheck?.resolvedPlan === "premium" ? "premium" : precheck?.resolvedPlan === "basic" ? "basic" : "";
    const planCandidate = contextPlan || options.plan || queryPlan || defaultPlan;
    const plan = planCandidate === "premium" ? "premium" : "basic";
    const attribution = resolveAttributionFromOptions({
      ...options,
      refSource: precheck?.referral?.source || options.refSource,
      refOffer: precheck?.referral?.offer || options.refOffer,
    });
    state.theme = typeof options.theme === "string" && options.theme ? options.theme : queryTheme || "default_dark";
    state.slugLocked = Boolean(parsed);
    state.lockedSlug = parsed ? parsed.slug : "";
    state.braceletForced = options.bracelet === true;
    state.dropId = typeof options.dropId === "string" && options.dropId ? options.dropId : null;
    state.refSource = attribution.refSource;
    state.refOffer = attribution.refOffer;
    state.promoCode = String(options.promoCode || precheck?.referral?.promoCodeApplied || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    if (dom.promoCode instanceof HTMLInputElement) {
      dom.promoCode.value = state.promoCode;
    }
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
    syncPlanVisibilityByUserPlan(currentPlan);
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
    setSubmitBlockedMessage("");
    state.initialFormSnapshot = getCurrentFormSnapshot();
    void updateTotals();
  }

  async function open(options = {}) {
    state.lastOpenOptions = options && typeof options === "object" ? { ...options } : {};
    state.forceAuth = document.body?.getAttribute("data-page") === "profile-page";
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
    bindAuthIntentLinks();
    const precheck = await fetchOrderPrecheck(state.lastOpenOptions);
    prefillFromOpenOptions(state.lastOpenOptions, precheck);
    const step = applyOrderPrecheck(precheck);
    setStep(step);
  }

  async function refreshCheckoutContext() {
    const precheck = await fetchOrderPrecheck(state.lastOpenOptions || {});
    prefillFromOpenOptions(state.lastOpenOptions || {}, precheck);
    const step = applyOrderPrecheck(precheck);
    setStep(step);
    return precheck;
  }

  async function close(force = false) {
    if (!isOpen || isClosing || isCloseConfirming) {
      return;
    }
    if (!force && dom.stepForm && !dom.stepForm.classList.contains("hidden") && isFormDirty()) {
      isCloseConfirming = true;
      const ok = await showConfirm("Закрыть? Данные не сохранятся", {
        title: "Подтверждение",
        confirmText: "Закрыть",
        cancelText: "Остаться",
      });
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
    // Сбросить состояние формы и lastOpenOptions
    state.lastOpenOptions = {};
    if (dom.letters) dom.letters.value = "";
    if (dom.digits) dom.digits.value = "";
    if (dom.name) dom.name.value = "";
    if (dom.planBasic) dom.planBasic.checked = false;
    if (dom.planPremium) dom.planPremium.checked = false;
    if (dom.bracelet) dom.bracelet.checked = false;
    if (dom.promoCode) dom.promoCode.value = "";
    // Добавьте очистку других полей по необходимости
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
        dom.countdown.textContent = "--:--:--";
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
    if (state.checkoutContext && state.checkoutContext.canPurchase === false) {
      setStatus(state.submitBlockedMessage || String(state.checkoutContext.message || "Покупка сейчас недоступна."), "error");
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
        refSource: state.refSource || "",
        refOffer: state.refOffer || "",
        refCode: String(state.checkoutContext?.referral?.refCode || "").trim(),
        promoCode:
          String(state.promoCode || (dom.promoCode instanceof HTMLInputElement ? dom.promoCode.value : "") || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "")
            .slice(0, 32),
        products: {
          digitalCard: true,
          bracelet: Boolean(dom.bracelet.checked),
        },
        ...(state.dropId ? { dropId: state.dropId } : {}),
      });
      const expiresAtIso = payload.pendingExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (dom.successSlug instanceof HTMLElement) {
        const expiresAt = new Date(expiresAtIso);
        const hoursLeft = Number.isFinite(expiresAt.getTime())
          ? Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)))
          : 24;
        dom.successSlug.textContent = `${pricing.slug} зарезервирован на ${formatHoursRu(hoursLeft)}`;
      }

      // Generate Telegram contact link with order details
      const telegramLink = dom.root.querySelector('#order-modal-telegram-link');
      if (telegramLink instanceof HTMLAnchorElement && payload.orderId) {
        const userName = dom.name.value.trim();
        const userEmail = (currentUser && currentUser.email ? String(currentUser.email).trim() : "") || "не указан";
        const slugPrice = Number(payload?.pricing?.slugPrice || 0);
        const slugBasePrice = Number(payload?.pricing?.slugBasePrice || slugPrice);
        const inviteeDiscountApplied = Number(payload?.pricing?.inviteeDiscountApplied || 0);
        const bonusSpent = Number(payload?.pricing?.bonusSpent || 0);
        const planPrice = Number(payload?.pricing?.planPrice || 0);
        const braceletPrice = Number(payload?.pricing?.braceletPrice || 0);
        const totalAmount = Number(payload?.pricing?.totalOneTime || 0);
        const orderCode = String(payload?.payment?.reference || "").trim() || `UNQX-${String(payload.orderId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;
        const planLabel = plan === "premium" ? "Тариф Премиум" : "Тариф Базовый";
        const message = `Здравствуйте! Хочу оплатить заказ #️⃣ ${orderCode}

      UNQ: ${pricing.slug}
      Имя: ${userName}
      📧 Email: ${userEmail}

      ━━━━━━━━━━━━
      💳 Детализация оплаты:
      • База slug ${pricing.slug}: ${formatPrice(slugBasePrice)} сум
      • Slug ${pricing.slug}: ${formatPrice(slugPrice)} сум
      • Скидка по рефералке: -${formatPrice(inviteeDiscountApplied)} сум
      • Списано бонусов: -${formatPrice(bonusSpent)} сум
      • ${planLabel}: ${formatPrice(planPrice)} сум
      • Браслет: ${formatPrice(braceletPrice)} сум
      ━━━━━━━━━━━━
      Итого к оплате: ${formatPrice(totalAmount)} сум`;

        const telegramUrl = String(payload?.paymentLinks?.telegramUrl || "").trim() || `https://t.me/unqx_uz?text=${encodeURIComponent(message)}`;
        telegramLink.href = telegramUrl;
        lastTelegramPaymentUrl = telegramUrl;
        quickPayState = {
          url: telegramUrl,
          orderId: String(payload.orderId || "").trim(),
          slug: String(pricing.slug || "").trim().toUpperCase(),
          reference: String(orderCode || "").trim(),
        };
        quickPayDismissed = false;
        renderQuickPayButton();
      }

      startCountdown(expiresAtIso);
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
      if (error.code === "TOO_MANY_ACTIVE_ORDERS") {
        setStatus("У вас уже 3 активных заказа. Дождитесь обработки или отмените один заказ в профиле.", "error");
        return;
      }
      if (error.code === "SLUG_NOT_AVAILABLE") {
        const reason = String(error.reason || "").toLowerCase();
        if (reason === "pending") {
          setStatus("Этот UNQ сейчас резервируется другим пользователем. Попробуй позже или выбери другой.", "error");
          return;
        }
        if (reason === "reserved_drop" || reason === "drop_reserved") {
          setStatus("Этот UNQ доступен только в активном дропе.", "error");
          return;
        }
        if (reason === "blocked") {
          setStatus("Этот UNQ временно недоступен. Выберите другой вариант.", "error");
          return;
        }
        if (["approved", "active", "private", "paused"].includes(reason)) {
          setStatus("Этот UNQ уже активирован другим пользователем.", "error");
          return;
        }
        setStatus("Этот slug уже занят. Выбери другой.", "error");
        return;
      }
      setStatus(error.message || "Ошибка отправки заявки", "error");
    } finally {
      dom.submit.disabled = Boolean(state.submitBlockedMessage);
      dom.submit.classList.toggle("opacity-70", dom.submit.disabled);
      dom.submit.classList.toggle("cursor-not-allowed", dom.submit.disabled);
      dom.submit.innerHTML = submitHtml;
      if (state.submitBlockedMessage) {
        dom.submit.title = state.submitBlockedMessage;
      } else {
        dom.submit.removeAttribute("title");
      }
    }
  }

  window.unqxOrderModalTelegramAuth = () => {
    window.location.href = "/login";
  };

  function inferAttributionFromCta(node) {
    const sourceAttr = String(node.getAttribute("data-order-source") || "").trim().toLowerCase();
    const offerAttr = String(node.getAttribute("data-order-offer") || "").trim().toLowerCase();
    if (sourceAttr || offerAttr) {
      return {
        refSource: sourceAttr,
        refOffer: offerAttr,
      };
    }
    if (node.getAttribute("data-drop-id")) {
      return { refSource: "drops", refOffer: "drop_live" };
    }
    if (node.closest("#pricing")) {
      return { refSource: "pricing", refOffer: "pricing_card" };
    }
    if (node.id === "calc-reserve-link" || node.closest("#calculator")) {
      return { refSource: "home", refOffer: "calculator" };
    }
    if (node.closest("[data-flash-sale-banner]")) {
      return { refSource: "flash", refOffer: "flash_sale" };
    }
    if (node.closest("#hero-check")) {
      return { refSource: "home", refOffer: "hero_check" };
    }
    const fallback = resolveFallbackAttribution();
    return { refSource: fallback.refSource, refOffer: fallback.refOffer };
  }

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
          ...inferAttributionFromCta(node),
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
  dom.promoCode?.addEventListener("input", () => {
    if (!(dom.promoCode instanceof HTMLInputElement)) return;
    dom.promoCode.value = String(dom.promoCode.value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 32);
    state.promoCode = dom.promoCode.value;
    state.promoValidationHint = "";
  });
  dom.promoCode?.addEventListener("change", () => void validatePromoCodeManually());
  dom.promoCheck?.addEventListener("click", () => void validatePromoCodeManually());
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
  dom.pendingContinue?.addEventListener("click", (event) => {
    event.preventDefault();
    const href = dom.pendingContinue instanceof HTMLAnchorElement ? String(dom.pendingContinue.href || "").trim() : "";
    if (!href || href === "#") {
      return;
    }
    openTelegramUrl(href);
  });
  dom.pendingCancel?.addEventListener("click", async () => {
    const orderId = String(dom.pendingCancel?.getAttribute("data-order-id") || "").trim();
    if (!orderId) {
      setPendingStatus("Не удалось определить заказ для отмены.", "error");
      return;
    }
    const confirmed = await showConfirm("Отменить текущий заказ и освободить UNQ?", {
      title: "Отмена заказа",
      confirmText: "Отменить заказ",
      cancelText: "Оставить как есть",
    });
    if (!confirmed) {
      return;
    }
    const originalText = dom.pendingCancel.textContent || "Отменить и создать новый";
    dom.pendingCancel.disabled = true;
    dom.pendingCancel.textContent = "Отмена...";
    try {
      await postJson(`/api/cards/order-request/${encodeURIComponent(orderId)}/cancel`, {});
      if (quickPayState && quickPayState.orderId === orderId) {
        quickPayState = null;
        quickPayDismissed = false;
        renderQuickPayButton();
      }
      await refreshCheckoutContext();
      setStatus("Заказ отменен. Теперь можно создать новый.", "success");
      window.dispatchEvent(new CustomEvent("unqx:order:cancelled", { detail: { orderId } }));
      setPendingStatus("", "neutral");
    } catch (error) {
      setPendingStatus(error?.message || "Не удалось отменить заказ.", "error");
    } finally {
      dom.pendingCancel.disabled = false;
      dom.pendingCancel.textContent = originalText;
    }
  });
  dom.goProfile?.addEventListener("click", () => {
    const telegramLink = dom.root.querySelector("#order-modal-telegram-link");
    const fallbackUrl = "https://t.me/unqx_uz";
    const candidateUrl = telegramLink instanceof HTMLAnchorElement && telegramLink.href ? telegramLink.href : lastTelegramPaymentUrl;
    const telegramUrl = /^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(candidateUrl) ? candidateUrl : (lastTelegramPaymentUrl || fallbackUrl);
    openTelegramUrl(telegramUrl);
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
    openSavedPayment() {
      if (quickPayState?.url) {
        openTelegramUrl(quickPayState.url);
        return true;
      }
      void syncQuickPayState().then((next) => {
        if (next?.url) {
          openTelegramUrl(next.url);
        }
      });
      return false;
    },
  };

  dom.root.style.display = "none";
  dom.root.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  void refreshUser().then(() => {
    restorePurchaseIntentIfNeeded();
  });
  bindCtas();
  void syncQuickPayState();
  window.addEventListener("focus", () => {
    void syncQuickPayState();
  });
  window.addEventListener("unqx:bind-order-ctas", () => {
    bindCtas();
  });
})();





