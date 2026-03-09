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
    name: document.getElementById("order-modal-name"),
    totalSlugTitle: document.getElementById("order-modal-total-slug-title"),
    totalSlugValue: document.getElementById("order-modal-total-slug-value"),
    totalPlanRow: document.getElementById("order-modal-total-plan-row"),
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
    pendingMeta: document.getElementById("order-modal-pending-meta"),
    pendingStatus: document.getElementById("order-modal-pending-status"),
    pendingContinue: document.getElementById("order-modal-pending-continue"),
    pendingCancel: document.getElementById("order-modal-pending-cancel"),
    closePending: document.getElementById("order-modal-close-pending"),
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
  let lastTelegramPaymentUrl = "https://t.me/unqx_uz";
  let quickPayNode = null;
  let quickPayState = null;
  let quickPayDismissed = false;
  let state = {
    slugLocked: false,
    lockedSlug: "",
    theme: "default_dark",
    braceletForced: false,
    dropId: null,
    checkoutContext: null,
    submitBlockedMessage: "",
    lastOpenOptions: {},
    pricing: { ...DEFAULT_PRICING, userPlan: "none" },
    slugPricing: { ...DEFAULT_SLUG_PRICING },
  };

  const STEP_PROGRESS = {
    auth: { width: "25%", label: "РЁР°Рі 1 РёР· 4", line: "в‘  Slug В· в‘Ў РўР°СЂРёС„ В· в‘ў Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ В· в‘Ј РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ" },
    form: { width: "25%", label: "РЁР°Рі 1 РёР· 4", line: "в‘  Slug В· в‘Ў РўР°СЂРёС„ В· в‘ў Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ В· в‘Ј РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ" },
    pending: { width: "100%", label: "РќРµР·Р°РІРµСЂС€С‘РЅРЅС‹Р№ Р·Р°РєР°Р·", line: "РџСЂРѕРґРѕР»Р¶РёС‚Рµ РѕРїР»Р°С‚Сѓ РёР»Рё РѕС‚РјРµРЅРёС‚Рµ Р·Р°РєР°Р·" },
    success: { width: "100%", label: "Р“РѕС‚РѕРІРѕ", line: "Р—Р°СЏРІРєР° СЃРѕР·РґР°РЅР° В· РѕР¶РёРґР°РµРј РѕРїР»Р°С‚Сѓ" },
  };

  function setCsrfToken(nextToken) {
    if (typeof nextToken !== "string" || !nextToken) {
      return;
    }
    csrfToken = nextToken;
    document.querySelector('meta[name="csrf-token"]')?.setAttribute("content", nextToken);
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

  function upsertQuickPayButton() {
    if (quickPayNode instanceof HTMLElement && document.body.contains(quickPayNode)) {
      return quickPayNode;
    }
    const wrap = document.createElement("div");
    wrap.id = "order-quick-pay";
    wrap.style.position = "fixed";
    wrap.style.right = "16px";
    wrap.style.bottom = "16px";
    wrap.style.zIndex = "85";
    wrap.style.display = "none";
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;background:#111827;color:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:90vw;">
        <button type="button" data-a="open" class="interactive-btn" style="border:0;background:transparent;color:inherit;font-weight:600;cursor:pointer;white-space:nowrap;">РџСЂРѕРґРѕР»Р¶РёС‚СЊ РѕРїР»Р°С‚Сѓ</button>
        <button type="button" data-a="clear" class="interactive-btn" aria-label="РЎРєСЂС‹С‚СЊ" style="border:0;background:transparent;color:#cbd5e1;cursor:pointer;font-size:16px;line-height:1;">Г—</button>
      </div>
    `;
    wrap.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-a]") : null;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-a");
      if (action === "clear") {
        quickPayDismissed = true;
        renderQuickPayButton();
        return;
      }
      if (quickPayState?.url) {
        openTelegramUrl(quickPayState.url);
        return;
      }
      void syncQuickPayState();
    });
    document.body.appendChild(wrap);
    quickPayNode = wrap;
    return wrap;
  }

  function renderQuickPayButton() {
    const node = upsertQuickPayButton();
    const draft = quickPayState;
    if (!draft || quickPayDismissed) {
      node.style.display = "none";
      return;
    }
    const openBtn = node.querySelector('[data-a="open"]');
    if (openBtn instanceof HTMLButtonElement) {
      const tail = draft.reference || draft.slug || "Р·Р°РєР°Р·";
      openBtn.textContent = `РџСЂРѕРґРѕР»Р¶РёС‚СЊ РѕРїР»Р°С‚Сѓ В· ${tail}`;
    }
    node.style.display = "block";
  }

  async function syncQuickPayState(precheck = null) {
    try {
      const context =
        precheck && typeof precheck === "object"
          ? precheck
          : await fetchOrderPrecheck(state.lastOpenOptions || {});
      const pending = context?.pendingOrder && typeof context.pendingOrder === "object" ? context.pendingOrder : null;
      const isPendingFlow = String(context?.nextAction || "") === "resume_pending" && Boolean(pending);
      if (!isPendingFlow) {
        quickPayState = null;
        quickPayDismissed = false;
        renderQuickPayButton();
        return null;
      }
      const url = buildPendingPaymentUrl(pending);
      quickPayState = {
        url,
        orderId: String(pending.id || "").trim(),
        slug: String(pending.slug || "").trim().toUpperCase(),
        reference: String(pending.paymentReference || "").trim(),
      };
      quickPayDismissed = false;
    } catch {
      quickPayState = null;
    }
    renderQuickPayButton();
    return quickPayState;
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
    const cfg = state.slugPricing || DEFAULT_SLUG_PRICING;
    const upper = normalizeLetters(letters);
    if (upper.length !== 3) {
      return { multiplier: 1, label: "..." };
    }
    const [a, b, c] = upper.split("");
    if (a === b && b === c) return { multiplier: Number(cfg.lettersAllSame || 5), label: "Р’СЃРµ РѕРґРёРЅР°РєРѕРІС‹Рµ" };
    const ca = a.charCodeAt(0);
    const cb = b.charCodeAt(0);
    const cc = c.charCodeAt(0);
    if (cb - ca === 1 && cc - cb === 1) return { multiplier: Number(cfg.lettersSequential || 3), label: "РџРѕ РїРѕСЂСЏРґРєСѓ" };
    if (a === c && a !== b) return { multiplier: Number(cfg.lettersPalindrome || 2), label: "РџР°Р»РёРЅРґСЂРѕРј" };
    return { multiplier: Number(cfg.lettersRandom || 1), label: "РћР±С‹С‡РЅС‹Рµ" };
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
    if (d1 === d2 && d2 === d3) return { multiplier: Number(cfg.digitsAllSame || 4), label: "Р’СЃРµ РѕРґРёРЅР°РєРѕРІС‹Рµ" };
    const n1 = Number.parseInt(d1, 10);
    const n2 = Number.parseInt(d2, 10);
    const n3 = Number.parseInt(d3, 10);
    if (n2 - n1 === 1 && n3 - n2 === 1) return { multiplier: Number(cfg.digitsSequential || 3), label: "РџРѕ РїРѕСЂСЏРґРєСѓ" };
    if (num % 100 === 0 && num > 0) return { multiplier: Number(cfg.digitsRound || 2), label: "РљСЂСѓРіР»С‹Рµ" };
    if (d1 === d3 && d1 !== d2) return { multiplier: Number(cfg.digitsPalindrome || 1.5), label: "РџР°Р»РёРЅРґСЂРѕРј" };
    return { multiplier: Number(cfg.digitsRandom || 1), label: "РћР±С‹С‡РЅС‹Рµ" };
  }

  function calculateSlugPricing(letters, digits) {
    const normalizedLetters = normalizeLetters(letters);
    const normalizedDigits = normalizeDigits(digits);
    if (normalizedLetters.length !== 3 || normalizedDigits.length !== 3) {
      return null;
    }
    const letterData = getLetterMultiplier(normalizedLetters);
    const digitData = getDigitMultiplier(normalizedDigits);
    const total = Number(state.slugPricing?.basePrice || DEFAULT_SLUG_PRICING.basePrice) * letterData.multiplier * digitData.multiplier;
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

  async function fetchOrderPrecheck(options = {}) {
    const requestedPlan = resolveRequestedPlanFromOpenOptions(options);
    try {
      const response = await fetch(`/api/cards/order-precheck?requestedPlan=${encodeURIComponent(requestedPlan)}`, {
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
    const safeName = currentUser?.firstName || currentUser?.displayName || "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ";
    const username = currentUser?.username ? ` В· @${currentUser.username}` : "";
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
    const progress = STEP_PROGRESS[step] || STEP_PROGRESS.form;
    if (dom.progressBarInner instanceof HTMLElement) {
      dom.progressBarInner.style.width = progress.width;
    }
    if (dom.progressLabel instanceof HTMLElement) {
      dom.progressLabel.textContent = progress.label;
    }
    if (dom.progressAuth instanceof HTMLElement) {
      dom.progressAuth.textContent = progress.line;
    }
    if (dom.progressNoAuth instanceof HTMLElement) {
      dom.progressNoAuth.textContent = progress.line;
    }

    dom.stepAuth.classList.toggle("hidden", step !== "auth");
    dom.stepPending?.classList.toggle("hidden", step !== "pending");
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
      if (!value) return "вЂ”";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "вЂ”";
      return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "вЂ”";
    }
  }

  function planLabel(plan) {
    return String(plan || "").toLowerCase() === "premium" ? "РџСЂРµРјРёСѓРј" : "Р‘Р°Р·РѕРІС‹Р№";
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
    const planPriceValue = Number(order.planPrice || 0);
    const braceletPriceValue = order.bracelet ? Number(order.braceletPrice || 300000) : 0;
    const totalAmount = Number(order.totalOneTime || slugPrice + planPriceValue + braceletPriceValue);
    const userName = (currentUser?.displayName || currentUser?.firstName || "").trim() || "не указано";
    const userEmail = (currentUser?.email || "").trim() || "не указан";
    const message = `Здравствуйте! Хочу оплатить заказ #️⃣ ${reference}\n\nUNQ: ${slug}\nФИО: ${userName}\nEmail: ${userEmail}\n\n💳 Детализация оплаты:\n• Slug ${slug}: ${formatPrice(slugPrice)} сум\n• Тариф ${planLabel(order.requestedPlan)}: ${formatPrice(planPriceValue)} сум\n• Браслет: ${formatPrice(braceletPriceValue)} сум\n\nИтого к оплате: ${formatPrice(totalAmount)} сум`;
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
        dom.pendingMeta.textContent = "UNQ: вЂ”";
      }
      if (dom.pendingContinue instanceof HTMLAnchorElement) {
        dom.pendingContinue.href = "#";
      }
      if (dom.pendingCancel instanceof HTMLButtonElement) {
        dom.pendingCancel.removeAttribute("data-order-id");
      }
      return;
    }

    const meta = `UNQ: ${String(pending.slug || "вЂ”").toUpperCase()} В· РўР°СЂРёС„: ${planLabel(pending.requestedPlan)} В· Р РµР·РµСЂРІ РґРѕ: ${formatPendingDateTime(pending.pendingExpiresAt)}`;
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
    const blockedMessage = canPurchase ? "" : (message || "РџРѕРєСѓРїРєР° СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅР°.");
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

  function showConfirm(message) {
    if (window.UNQSiteDialog?.confirm) {
      return window.UNQSiteDialog.confirm(message, {
        title: "РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ",
        confirmText: "Р—Р°РєСЂС‹С‚СЊ",
        cancelText: "РћСЃС‚Р°С‚СЊСЃСЏ",
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
      return { total, flash, source: String(payload.source || "calculator") };
    } catch {
      return { total: fallbackTotal, flash: null, source: "calculator" };
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
    const braceletPrice = bracelet ? pricingSettings.braceletPrice : 0;
    const oneTime = slugPrice + planCharge + braceletPrice;
    const slugLabel = pricing ? pricing.slug : "___ ___";
    const rarity = getRarity(slugPrice);

    setSlugMode(pricing);

    if (dom.planBasicPrice instanceof HTMLElement) {
      dom.planBasicPrice.textContent = `${formatPrice(planCardBasic)} СЃСѓРј`;
    }
    if (dom.planBasicNote instanceof HTMLElement) {
      dom.planBasicNote.textContent =
        userPlan === "basic" || userPlan === "premium" ? "СѓР¶Рµ РєСѓРїР»РµРЅ вњ“" : "РѕРґРёРЅ СЂР°Р· В· РЅР°РІСЃРµРіРґР°";
    }
    if (dom.planPremiumPrice instanceof HTMLElement) {
      dom.planPremiumPrice.textContent = `${formatPrice(planCardPremium)} СЃСѓРј`;
    }
    if (dom.planPremiumNote instanceof HTMLElement) {
      dom.planPremiumNote.textContent =
        userPlan === "premium"
          ? "СѓР¶Рµ РєСѓРїР»РµРЅ вњ“"
          : userPlan === "basic"
            ? `${formatPrice(pricingSettings.premiumUpgradePrice)} СЃСѓРј В· Р°РїРіСЂРµР№Рґ`
            : "РѕРґРёРЅ СЂР°Р· В· РЅР°РІСЃРµРіРґР°";
    }
    if (dom.planActivationNote instanceof HTMLElement) {
      dom.planActivationNote.textContent = "РџРѕСЃР»Рµ РѕРїР»Р°С‚С‹ РјС‹ Р°РєС‚РёРІРёСЂСѓРµРј С‚РІРѕР№ С‚Р°СЂРёС„ Рё slug.";
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
        dom.formula.textContent = `Flash sale РїСЂРёРјРµРЅС‘РЅ (-${server.flash.discountPercent}%)`;
      } else if (server?.source === "override") {
        dom.formula.textContent = `РџРµСЂСЃРѕРЅР°Р»СЊРЅР°СЏ С†РµРЅР°: ${formatPrice(slugPrice)} СЃСѓРј`;
      } else {
        const m = pricing ? pricing.letterData.multiplier * pricing.digitData.multiplier : 1;
        dom.formula.textContent = `${formatPrice(slugBasePrice)} Г— ${m} = ${formatPrice(slugPrice)} СЃСѓРј`;
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
      dom.totalSlugValue.textContent = `${formatPrice(slugPrice)} СЃСѓРј`;
    }
    if (dom.totalPlanTitle instanceof HTMLElement) {
      dom.totalPlanTitle.textContent = requestedPlan === "premium" ? "РўР°СЂРёС„ РџСЂРµРјРёСѓРј" : "РўР°СЂРёС„ Р‘Р°Р·РѕРІС‹Р№";
    }
    if (dom.totalPlanValue instanceof HTMLElement) {
      dom.totalPlanValue.textContent =
        planCharge > 0 ? `${formatPrice(planCharge)} СЃСѓРј` : (userPlan === "none" ? "0 СЃСѓРј" : "СѓР¶Рµ РєСѓРїР»РµРЅ");
    }
    if (dom.totalPlanRow instanceof HTMLElement) {
      dom.totalPlanRow.classList.toggle("hidden", hasExistingPlan);
      dom.totalPlanRow.classList.toggle("flex", !hasExistingPlan);
    }
    if (dom.totalBraceletRow instanceof HTMLElement) {
      dom.totalBraceletRow.classList.toggle("hidden", !bracelet);
      dom.totalBraceletRow.classList.toggle("flex", bracelet);
    }
    if (dom.totalNow instanceof HTMLElement) {
      dom.totalNow.textContent = `${formatPrice(oneTime)} СЃСѓРј`;
    }
    if (dom.totalMonthly instanceof HTMLElement) {
      dom.totalMonthly.textContent = "Р•РґРёРЅРѕСЂР°Р·РѕРІРѕ В· Р±РѕР»СЊС€Рµ РЅРµ РїР»Р°С‚РёС€СЊ";
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
      fake.innerHTML = '<span>Р’РѕР№С‚Рё</span>';
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
      refreshSlugPricing(),
    ]);
    if (authResult.status !== "fulfilled") {
      currentUser = null;
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
    void updateTotals();
  }

  async function open(options = {}) {
    state.lastOpenOptions = options && typeof options === "object" ? { ...options } : {};
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
      const ok = await showConfirm("Р—Р°РєСЂС‹С‚СЊ? Р”Р°РЅРЅС‹Рµ РЅРµ СЃРѕС…СЂР°РЅСЏС‚СЃСЏ");
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
      setStatus(state.submitBlockedMessage || String(state.checkoutContext.message || "РџРѕРєСѓРїРєР° СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅР°."), "error");
      return;
    }
    const pricing = calculateSlugPricing(dom.letters.value, dom.digits.value);
    if (!pricing) {
      setStatus("Р—Р°РїРѕР»РЅРё slug РІ С„РѕСЂРјР°С‚Рµ AAA000", "error");
      return;
    }
    if (!dom.name.value.trim()) {
      setStatus("РРјСЏ РґР»СЏ РІРёР·РёС‚РєРё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", "error");
      return;
    }
    const plan = selectedPlan();
    const submitHtml = dom.submit.innerHTML;
    dom.submit.disabled = true;
    dom.submit.classList.add("opacity-70", "cursor-not-allowed");
    dom.submit.textContent = "РћС‚РїСЂР°РІРєР°...";

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
      const expiresAtIso = payload.pendingExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (dom.successSlug instanceof HTMLElement) {
        const expiresAt = new Date(expiresAtIso);
        const hoursLeft = Number.isFinite(expiresAt.getTime()) ? Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000))) : 24;
        dom.successSlug.textContent = `${pricing.slug} Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅ РЅР° ${hoursLeft} С‡Р°СЃР°`;
      }

      // Generate Telegram contact link with order details
      const telegramLink = dom.root.querySelector('#order-modal-telegram-link');
      if (telegramLink instanceof HTMLAnchorElement && payload.orderId) {
        const userName = dom.name.value.trim();
        const userEmail = (currentUser && currentUser.email ? String(currentUser.email).trim() : "") || "РЅРµ СѓРєР°Р·Р°РЅ";
        const slugPrice = Number(payload?.pricing?.slugPrice || 0);
        const planPrice = Number(payload?.pricing?.planPrice || 0);
        const braceletPrice = Number(payload?.pricing?.braceletPrice || 0);
        const totalAmount = Number(payload?.pricing?.totalOneTime || 0);
        const orderCode = String(payload?.payment?.reference || "").trim() || `UNQX-${String(payload.orderId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;
        const planLabel = plan === "premium" ? "РўР°СЂРёС„ РџСЂРµРјРёСѓРј" : "РўР°СЂРёС„ Р‘Р°Р·РѕРІС‹Р№";
        const message = `Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! РҐРѕС‡Сѓ РѕРїР»Р°С‚РёС‚СЊ Р·Р°РєР°Р· #пёЏвѓЈ ${orderCode}

      UNQ: ${pricing.slug}
      РРјСЏ: ${userName}
      рџ“§ Email: ${userEmail}

      в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ
      рџ’і Р”РµС‚Р°Р»РёР·Р°С†РёСЏ РѕРїР»Р°С‚С‹:
      вЂў Slug ${pricing.slug}: ${formatPrice(slugPrice)} СЃСѓРј
      вЂў ${planLabel}: ${formatPrice(planPrice)} СЃСѓРј
      вЂў Р‘СЂР°СЃР»РµС‚: ${formatPrice(braceletPrice)} СЃСѓРј
      в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ
      РС‚РѕРіРѕ Рє РѕРїР»Р°С‚Рµ: ${formatPrice(totalAmount)} СЃСѓРј`;

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
        setStatus("РљСѓРїРё РџСЂРµРјРёСѓРј С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ slug", "error");
        return;
      }
      if (error.code === "PREMIUM_SLUG_LIMIT_REACHED") {
        setStatus("Р”РѕСЃС‚РёРіРЅСѓС‚ Р»РёРјРёС‚ 3 slug", "error");
        return;
      }
      if (error.code === "TOO_MANY_ACTIVE_ORDERS") {
        setStatus("РЈ РІР°СЃ СѓР¶Рµ 3 Р°РєС‚РёРІРЅС‹С… Р·Р°РєР°Р·Р°. Р”РѕР¶РґРёС‚РµСЃСЊ РѕР±СЂР°Р±РѕС‚РєРё РёР»Рё РѕС‚РјРµРЅРёС‚Рµ РѕРґРёРЅ Р·Р°РєР°Р· РІ РїСЂРѕС„РёР»Рµ.", "error");
        return;
      }
      if (error.code === "SLUG_NOT_AVAILABLE") {
        const reason = String(error.reason || "").toLowerCase();
        if (reason === "pending") {
          setStatus("Р­С‚РѕС‚ UNQ СЃРµР№С‡Р°СЃ СЂРµР·РµСЂРІРёСЂСѓРµС‚СЃСЏ РґСЂСѓРіРёРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј. РџРѕРїСЂРѕР±СѓР№ РїРѕР·Р¶Рµ РёР»Рё РІС‹Р±РµСЂРё РґСЂСѓРіРѕР№.", "error");
          return;
        }
        if (reason === "reserved_drop" || reason === "drop_reserved") {
          setStatus("Р­С‚РѕС‚ UNQ РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РІ Р°РєС‚РёРІРЅРѕРј РґСЂРѕРїРµ.", "error");
          return;
        }
        if (reason === "blocked") {
          setStatus("Р­С‚РѕС‚ UNQ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ. Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіРѕР№ РІР°СЂРёР°РЅС‚.", "error");
          return;
        }
        if (["approved", "active", "private", "paused"].includes(reason)) {
          setStatus("Р­С‚РѕС‚ UNQ СѓР¶Рµ Р°РєС‚РёРІРёСЂРѕРІР°РЅ РґСЂСѓРіРёРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј.", "error");
          return;
        }
        setStatus("Р­С‚РѕС‚ slug СѓР¶Рµ Р·Р°РЅСЏС‚. Р’С‹Р±РµСЂРё РґСЂСѓРіРѕР№.", "error");
        return;
      }
      setStatus(error.message || "РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё Р·Р°СЏРІРєРё", "error");
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
          node.textContent = "Р”РѕР±Р°РІР»РµРЅРѕ РІ wishlist";
        } catch {
          node.textContent = "РќРµ СѓРґР°Р»РѕСЃСЊ. РџРѕРІС‚РѕСЂРё";
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
        setStatus("РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹Р№С‚Рё", "error");
      });
  });
  dom.backdrop.addEventListener("click", () => close(false));
  dom.closeTop?.addEventListener("click", () => close(false));
  dom.closeForm?.addEventListener("click", () => close(false));
  dom.closeSuccess?.addEventListener("click", () => close(true));
  dom.closePending?.addEventListener("click", () => close(false));
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
      setPendingStatus("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ Р·Р°РєР°Р· РґР»СЏ РѕС‚РјРµРЅС‹.", "error");
      return;
    }
    const confirmed = await showConfirm("РћС‚РјРµРЅРёС‚СЊ С‚РµРєСѓС‰РёР№ Р·Р°РєР°Р· Рё РѕСЃРІРѕР±РѕРґРёС‚СЊ UNQ?");
    if (!confirmed) {
      return;
    }
    const originalText = dom.pendingCancel.textContent || "РћС‚РјРµРЅРёС‚СЊ Рё СЃРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№";
    dom.pendingCancel.disabled = true;
    dom.pendingCancel.textContent = "РћС‚РјРµРЅР°...";
    try {
      await postJson(`/api/cards/order-request/${encodeURIComponent(orderId)}/cancel`, {});
      if (quickPayState && quickPayState.orderId === orderId) {
        quickPayState = null;
        quickPayDismissed = false;
        renderQuickPayButton();
      }
      await refreshCheckoutContext();
      setStatus("Заказ отменён. Теперь можно создать новый.", "success");
      window.dispatchEvent(new CustomEvent("unqx:order:cancelled", { detail: { orderId } }));
      setPendingStatus("", "neutral");
    } catch (error) {
      setPendingStatus(error?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РјРµРЅРёС‚СЊ Р·Р°РєР°Р·.", "error");
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
  void refreshUser();
  bindCtas();
  void syncQuickPayState();
  window.addEventListener("focus", () => {
    void syncQuickPayState();
  });
  window.addEventListener("unqx:bind-order-ctas", () => {
    bindCtas();
  });
})();



