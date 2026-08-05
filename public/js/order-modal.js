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
  planBasicPrice: 130_000,
  planPremiumPrice: 130_000,
  premiumUpgradePrice: 130_000,
  planPremiumMonthlyPriceUsd: 2,
  planPremiumMonthlyPriceUzs: 130_000,
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
    flashHero: document.getElementById("order-modal-flash-hero"),
    flashTitle: document.getElementById("order-modal-flash-title"),
    flashCopy: document.getElementById("order-modal-flash-copy"),
    flashDiscount: document.getElementById("order-modal-flash-discount"),
    flashRule: document.getElementById("order-modal-flash-rule"),
    flashCountdown: document.getElementById("order-modal-flash-countdown"),
    flashStory: document.getElementById("order-modal-flash-story"),
    flashStoryText: document.getElementById("order-modal-flash-story-text"),
    flashMatchMode: document.getElementById("order-modal-flash-match-mode"),
    flashIncludeWrap: document.getElementById("order-modal-flash-include-wrap"),
    flashIncludeList: document.getElementById("order-modal-flash-include-list"),
    flashExcludeWrap: document.getElementById("order-modal-flash-exclude-wrap"),
    flashExcludeList: document.getElementById("order-modal-flash-exclude-list"),
    flashExamplesWrap: document.getElementById("order-modal-flash-examples-wrap"),
    flashExamples: document.getElementById("order-modal-flash-examples"),
    flashPurchaseCard: document.getElementById("order-modal-flash-purchase-card"),
    flashPurchaseHint: document.getElementById("order-modal-flash-purchase-hint"),
    flashEligibilityBadge: document.getElementById("order-modal-flash-eligibility-badge"),
    flashEligibilityText: document.getElementById("order-modal-flash-eligibility-text"),
    flashPriceLine: document.getElementById("order-modal-flash-price-line"),
    stepLoading: document.getElementById("order-modal-step-loading"),
    stepAuth: document.getElementById("order-modal-step-auth"),
    authTitle: document.getElementById("order-modal-title"),
    authText: document.getElementById("order-modal-auth-text"),
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
    slugPricingCard: document.getElementById("order-modal-slug-pricing-card"),
    letters: document.getElementById("order-modal-letters"),
    digits: document.getElementById("order-modal-digits"),
    slugPreview: document.getElementById("order-modal-slug-preview"),
    officialNotice: document.getElementById("order-modal-official-notice"),
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
    promoSection: document.getElementById("order-modal-promo-section"),
    promoCode: document.getElementById("order-modal-promo-code"),
    promoCheck: document.getElementById("order-modal-promo-check"),
    campaignHint: document.getElementById("order-modal-campaign-hint"),
    fraudHint: document.getElementById("order-modal-fraud-hint"),
    nameSection: document.getElementById("order-modal-name-section"),
    name: document.getElementById("order-modal-name"),
    paymentSection: document.getElementById("order-modal-payment-section"),
    paymentCash: document.getElementById("order-modal-payment-cash"),
    paymentCredit: document.getElementById("order-modal-payment-credit"),
    creditMonthsWrap: document.getElementById("order-modal-credit-months-wrap"),
    creditMonths: document.getElementById("order-modal-credit-months"),
    totalSlugRow: document.getElementById("order-modal-total-slug-row"),
    totalSlugTitle: document.getElementById("order-modal-total-slug-title"),
    totalSlugValue: document.getElementById("order-modal-total-slug-value"),
    totalPlanRow: document.getElementById("order-modal-total-plan-row"),
    totalPlanTitle: document.getElementById("order-modal-total-plan-title"),
    totalPlanValue: document.getElementById("order-modal-total-plan-value"),
    totalProductDiscountRow: document.getElementById("order-modal-total-product-discount-row"),
    totalProductDiscountValue: document.getElementById("order-modal-total-product-discount-value"),
    totalInviteeDiscountRow: document.getElementById("order-modal-total-invitee-discount-row"),
    totalInviteeDiscountLabel: document.getElementById("order-modal-total-invitee-discount-label"),
    totalInviteeDiscountValue: document.getElementById("order-modal-total-invitee-discount-value"),
    totalLuckyRow: document.getElementById("order-modal-total-lucky-row"),
    totalLuckyLabel: document.getElementById("order-modal-total-lucky-label"),
    totalLuckyValue: document.getElementById("order-modal-total-lucky-value"),
    totalBonusRow: document.getElementById("order-modal-total-bonus-row"),
    totalBonusValue: document.getElementById("order-modal-total-bonus-value"),
    totalCapRow: document.getElementById("order-modal-total-cap-row"),
    totalCapValue: document.getElementById("order-modal-total-cap-value"),
    totalNow: document.getElementById("order-modal-total-now"),
    totalMonthly: document.getElementById("order-modal-total-monthly"),
    status: document.getElementById("order-modal-status"),
    submit: document.getElementById("order-modal-submit"),
    closeTop: document.getElementById("order-modal-close-top"),
    closeForm: document.getElementById("order-modal-close-form"),
    successSlug: document.getElementById("order-modal-success-slug"),
    countdown: document.getElementById("order-modal-countdown"),
    successBody: document.getElementById("order-modal-success-body"),
    successNote: document.getElementById("order-modal-success-note"),
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
    !(dom.submit instanceof HTMLButtonElement)
  ) {
    return;
  }

  const DEFAULT_AUTH_TITLE = dom.authTitle instanceof HTMLElement ? String(dom.authTitle.textContent || "") : "";
  const DEFAULT_AUTH_TEXT = dom.authText instanceof HTMLElement ? String(dom.authText.textContent || "") : "";
  const DEFAULT_SUBMIT_LABEL = dom.submit instanceof HTMLButtonElement ? String(dom.submit.textContent || "") : "Отправить заявку";
  const DEFAULT_SUCCESS_BODY = dom.successBody instanceof HTMLElement ? String(dom.successBody.textContent || "") : "";
  const DEFAULT_SUCCESS_NOTE = dom.successNote instanceof HTMLElement ? String(dom.successNote.textContent || "") : "";

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
  let quickPayState = null;
  let state = {
    slugLocked: false,
    lockedSlug: "",
    theme: "default_dark",
    dropId: null,
    refSource: "",
    refOffer: "",
    promoCode: "",
    promoValidationHint: "",
    checkoutContext: null,
    flashSaleMeta: null,
    submitBlockedMessage: "",
    lastOpenOptions: {},
    initialFormSnapshot: null,
    pricing: { ...DEFAULT_PRICING, userPlan: "none" },
    slugPricing: { ...DEFAULT_SLUG_PRICING },
    forceAuth: false,
    orderKind: "slug_purchase",
  };

  function getFlashOfferContext() {
    const flash = document.querySelector("[data-flash-sale-banner]");
    if (!(flash instanceof HTMLElement)) {
      return null;
    }
    const countdownNode = flash.querySelector("[data-flash-countdown]");
    let presentation = null;
    try {
      const rawMeta = String(flash.getAttribute("data-flash-sale-meta") || "").trim();
      if (rawMeta) {
        const parsed = JSON.parse(rawMeta);
        if (parsed && typeof parsed === "object") {
          presentation = parsed;
        }
      }
    } catch {
      presentation = null;
    }
    if (!presentation || typeof presentation !== "object") {
      const ruleText = String(flash.getAttribute("data-flash-sale-rule") || "").trim() || "Подходящие UNQ";
      presentation = {
        explanation:
          String(flash.getAttribute("data-flash-sale-summary") || "").trim() ||
          "Скидка применяется автоматически к UNQ, которые подходят под условия акции.",
        purchaseHint: "Введите свой UNQ ниже. Если он участвует в акции, мы сразу покажем цену со скидкой.",
        matchModeLabel: `Условие акции: ${ruleText}.`,
        includeRules: [ruleText],
        excludeRules: [],
        examples: [],
        outcomeHint: "Если UNQ не подходит под условия акции, останется обычная цена без скидки.",
      };
    }
    return {
      title: String(flash.getAttribute("data-flash-sale-title") || "").trim() || "Flash Sale",
      summary:
        String(flash.getAttribute("data-flash-sale-summary") || "").trim() ||
        "Откройте покупку, и скидка применится автоматически к подходящим UNQ.",
      discountText: `-${String(flash.getAttribute("data-flash-sale-discount") || "").trim() || "0"}%`,
      ruleText: String(flash.getAttribute("data-flash-sale-rule") || "").trim() || "Подходящие UNQ",
      countdownText: countdownNode instanceof HTMLElement ? String(countdownNode.textContent || "").trim() || "--:--:--" : "--:--:--",
      presentation,
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveFlashPresentationContext(preferredMeta = null) {
    const flashContext = getFlashOfferContext();
    const rawPresentation =
      preferredMeta?.presentation && typeof preferredMeta.presentation === "object"
        ? preferredMeta.presentation
        : state.flashSaleMeta?.presentation && typeof state.flashSaleMeta.presentation === "object"
          ? state.flashSaleMeta.presentation
          : flashContext?.presentation && typeof flashContext.presentation === "object"
            ? flashContext.presentation
            : null;
    const ruleLabel =
      String(preferredMeta?.conditionLabel || state.flashSaleMeta?.conditionLabel || flashContext?.ruleText || "").trim() ||
      "Подходящие UNQ";
    return {
      explanation:
        String(rawPresentation?.explanation || flashContext?.summary || "").trim() ||
        "Скидка применяется автоматически к UNQ, которые подходят под условия акции.",
      purchaseHint:
        String(rawPresentation?.purchaseHint || "").trim() ||
        "Введите свой UNQ ниже. Если он участвует в акции, мы сразу покажем цену со скидкой.",
      matchModeLabel:
        String(rawPresentation?.matchModeLabel || "").trim() ||
        `Условие акции: ${ruleLabel}.`,
      includeRules:
        Array.isArray(rawPresentation?.includeRules) && rawPresentation.includeRules.length
          ? rawPresentation.includeRules.map((item) => String(item || "").trim()).filter(Boolean)
          : [ruleLabel],
      excludeRules:
        Array.isArray(rawPresentation?.excludeRules) && rawPresentation.excludeRules.length
          ? rawPresentation.excludeRules.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
      examples:
        Array.isArray(rawPresentation?.examples) && rawPresentation.examples.length
          ? rawPresentation.examples.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
          : [],
      outcomeHint:
        String(rawPresentation?.outcomeHint || "").trim() ||
        "Если UNQ не подходит под условия акции, останется обычная цена без скидки.",
    };
  }

  function renderFlashRuleItems(listNode, items) {
    if (!(listNode instanceof HTMLElement)) {
      return;
    }
    listNode.innerHTML = "";
    (Array.isArray(items) ? items : []).forEach((item) => {
      const normalized = String(item || "").trim();
      if (!normalized) {
        return;
      }
      const node = document.createElement("li");
      node.className = "order-modal-flash-rule-item";
      node.textContent = normalized;
      listNode.appendChild(node);
    });
  }

  function applyFlashExampleSlug(slug) {
    const parsed = splitSlug(slug);
    if (!parsed || isSubscriptionRenewalMode()) {
      return;
    }
    state.lastOpenOptions = {
      ...(state.lastOpenOptions && typeof state.lastOpenOptions === "object" ? state.lastOpenOptions : {}),
      slug: parsed.slug,
      refSource: state.refSource || "flash",
      refOffer: state.refOffer || "flash_sale",
    };
    state.slugLocked = false;
    state.lockedSlug = "";
    dom.slugReadonlyWrap?.classList.add("hidden");
    dom.slugInputsWrap?.classList.remove("hidden");
    if (dom.letters instanceof HTMLInputElement) {
      dom.letters.value = parsed.letters;
    }
    if (dom.digits instanceof HTMLInputElement) {
      dom.digits.value = parsed.digits;
    }
    if (!dom.stepForm.classList.contains("hidden")) {
      dom.letters?.focus();
    }
    void updateTotals();
  }

  function renderFlashExampleButtons(examples) {
    if (!(dom.flashExamples instanceof HTMLElement) || !(dom.flashExamplesWrap instanceof HTMLElement)) {
      return;
    }
    dom.flashExamples.innerHTML = "";
    const normalizedExamples = Array.from(
      new Set((Array.isArray(examples) ? examples : []).map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)),
    );
    dom.flashExamplesWrap.classList.toggle("hidden", normalizedExamples.length === 0);
    normalizedExamples.forEach((example) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "interactive-btn order-modal-flash-example-button";
      button.textContent = example;
      button.addEventListener("click", () => {
        applyFlashExampleSlug(example);
      });
      dom.flashExamples.appendChild(button);
    });
  }

  function syncFlashStoryUi(preferredMeta = null) {
    const flashMode = isFlashOfferMode();
    if (dom.flashStory instanceof HTMLElement) {
      dom.flashStory.classList.toggle("hidden", !flashMode);
      dom.flashStory.setAttribute("aria-hidden", flashMode ? "false" : "true");
    }
    if (!flashMode) {
      return;
    }

    const presentation = resolveFlashPresentationContext(preferredMeta);
    if (dom.flashStoryText instanceof HTMLElement) {
      dom.flashStoryText.textContent = presentation.explanation;
    }
    if (dom.flashMatchMode instanceof HTMLElement) {
      dom.flashMatchMode.textContent = presentation.matchModeLabel;
      dom.flashMatchMode.classList.toggle("hidden", !presentation.matchModeLabel);
    }
    if (dom.flashPurchaseHint instanceof HTMLElement) {
      dom.flashPurchaseHint.textContent = presentation.purchaseHint;
    }
    renderFlashRuleItems(dom.flashIncludeList, presentation.includeRules);
    renderFlashRuleItems(dom.flashExcludeList, presentation.excludeRules);
    if (dom.flashIncludeWrap instanceof HTMLElement) {
      dom.flashIncludeWrap.classList.toggle("hidden", presentation.includeRules.length === 0);
    }
    if (dom.flashExcludeWrap instanceof HTMLElement) {
      dom.flashExcludeWrap.classList.toggle("hidden", presentation.excludeRules.length === 0);
    }
    renderFlashExampleButtons(presentation.examples);
  }

  function syncFlashPurchaseStatus({ pricing = null, server = null } = {}) {
    if (!isFlashOfferMode()) {
      return;
    }
    const presentation = resolveFlashPresentationContext(server?.flashSale || state.flashSaleMeta);
    if (dom.flashEligibilityBadge instanceof HTMLElement) {
      dom.flashEligibilityBadge.className = "order-modal-flash-eligibility-badge";
    }

    if (!(pricing && pricing.slug)) {
      if (dom.flashEligibilityBadge instanceof HTMLElement) {
        dom.flashEligibilityBadge.textContent = "Введите UNQ";
        dom.flashEligibilityBadge.classList.add("is-idle");
      }
      if (dom.flashEligibilityText instanceof HTMLElement) {
        dom.flashEligibilityText.textContent = "Выберите подходящий slug или нажмите на пример из акции.";
      }
      if (dom.flashPriceLine instanceof HTMLElement) {
        dom.flashPriceLine.textContent = presentation.purchaseHint;
      }
      return;
    }

    const slug = String(pricing.slug || "").trim().toUpperCase();
    const flashInfo = server?.flash && typeof server.flash === "object" ? server.flash : null;
    if (flashInfo) {
      if (dom.flashEligibilityBadge instanceof HTMLElement) {
        dom.flashEligibilityBadge.textContent = "Скидка активна";
        dom.flashEligibilityBadge.classList.add("is-active");
      }
      if (dom.flashEligibilityText instanceof HTMLElement) {
        dom.flashEligibilityText.textContent = `${slug} подходит под условия акции.`;
      }
      if (dom.flashPriceLine instanceof HTMLElement) {
        dom.flashPriceLine.innerHTML = `Сейчас <strong>${escapeHtml(formatPrice(flashInfo.finalPrice))} сум</strong> вместо ${escapeHtml(formatPrice(flashInfo.basePrice))} сум.`;
      }
      return;
    }

    if (dom.flashEligibilityBadge instanceof HTMLElement) {
      dom.flashEligibilityBadge.textContent = "Обычная цена";
      dom.flashEligibilityBadge.classList.add("is-muted");
    }
    if (dom.flashEligibilityText instanceof HTMLElement) {
      dom.flashEligibilityText.textContent = `${slug} не подходит под текущие условия акции.`;
    }
    if (dom.flashPriceLine instanceof HTMLElement) {
      dom.flashPriceLine.textContent = `${presentation.outcomeHint} Для этого UNQ действует обычная цена.`;
    }
  }

  function isFlashOfferMode() {
    return !isSubscriptionRenewalMode() && state.refSource === "flash";
  }

  function syncModalToneUi() {
    const flashMode = isFlashOfferMode();
    const flashContext = flashMode ? getFlashOfferContext() : null;
    if (flashMode && flashContext?.presentation) {
      state.flashSaleMeta = {
        ...(state.flashSaleMeta && typeof state.flashSaleMeta === "object" ? state.flashSaleMeta : {}),
        conditionLabel: flashContext.ruleText,
        discountPercent: Number(String(flashContext.discountText || "").replace(/[^0-9]/g, "") || 0),
        presentation: flashContext.presentation,
      };
    }
    if (flashMode) {
      dom.root.dataset.modalTone = "flash";
      dom.dialog?.setAttribute("data-modal-tone", "flash");
    } else {
      delete dom.root.dataset.modalTone;
      dom.dialog?.removeAttribute("data-modal-tone");
    }

    if (!(dom.flashHero instanceof HTMLElement)) {
      syncFlashStoryUi(state.flashSaleMeta);
      return;
    }

    dom.flashHero.classList.toggle("hidden", !flashMode);
    dom.flashHero.setAttribute("aria-hidden", flashMode ? "false" : "true");
    if (!flashMode) {
      syncFlashStoryUi(state.flashSaleMeta);
      return;
    }

    if (dom.flashTitle instanceof HTMLElement) {
      dom.flashTitle.textContent = flashContext?.title || "Flash Sale";
    }
    if (dom.flashCopy instanceof HTMLElement) {
      dom.flashCopy.textContent =
        flashContext?.summary || "Откройте покупку, и скидка применится автоматически к подходящим UNQ.";
    }
    if (dom.flashDiscount instanceof HTMLElement) {
      dom.flashDiscount.textContent = flashContext?.discountText || "-0%";
    }
    if (dom.flashRule instanceof HTMLElement) {
      dom.flashRule.textContent = flashContext?.ruleText || "Подходящие UNQ";
    }
    if (dom.flashCountdown instanceof HTMLElement) {
      dom.flashCountdown.textContent = flashContext?.countdownText || "--:--:--";
    }
    syncFlashStoryUi(state.flashSaleMeta);
    syncFlashPurchaseStatus();
  }

  const STEP_PROGRESS = {
    loading: { width: "12%" },
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

  function normalizeOrderKind(value) {
    const raw = String(value || "").trim().toLowerCase();
    return raw === "subscription_renewal" ? "subscription_renewal" : "slug_purchase";
  }

  function isSubscriptionRenewalMode(orderKind = state.orderKind) {
    return normalizeOrderKind(orderKind) === "subscription_renewal";
  }

  function normalizeOpenIntent(options = {}) {
    const slugParsed = splitSlug(options.slug || "");
    const slug = slugParsed ? slugParsed.slug : "";
    const planRaw = String(options.plan || "").trim().toLowerCase();
    const plan = planRaw === "premium" ? "premium" : "";
    const orderKind = normalizeOrderKind(options.orderKind || options.mode || "");
    const theme = String(options.theme || "").trim();
    const dropId = String(options.dropId || "").trim();
    const refSource = String(options.refSource || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    const refOffer = String(options.refOffer || "").trim().toLowerCase().replace(/[^a-z0-9_.:-]/g, "").slice(0, 80);
    const promoCode = String(options.promoCode || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    return {
      slug,
      plan,
      orderKind,
      theme,
      dropId,
      refSource,
      refOffer,
      promoCode,
    };
  }

  function hasMeaningfulIntent(intent) {
    if (!intent || typeof intent !== "object") return false;
    return Boolean(
      intent.slug ||
      intent.plan ||
      intent.theme ||
      intent.dropId ||
      intent.refSource ||
      intent.refOffer ||
      intent.promoCode ||
      normalizeOrderKind(intent.orderKind) === "subscription_renewal"
    );
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

  function renderQuickPayButton() {
    let node = document.getElementById("order-modal-quickpay");
    const shouldShow = Boolean(quickPayState?.url) && !isOpen;

    if (!shouldShow) {
      if (node) {
        node.classList.add("hidden");
      }
      return;
    }

    if (!(node instanceof HTMLElement)) {
      node = document.createElement("div");
      node.id = "order-modal-quickpay";
      node.className =
        "fixed bottom-4 right-4 z-[90] hidden items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 shadow-lg";
      node.innerHTML = `
        <button type="button" data-quickpay-action class="interactive-btn inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
          Оплатить
        </button>
      `;
      document.body.appendChild(node);
      node.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-quickpay-action]")) {
          if (quickPayState?.url) {
            openTelegramUrl(quickPayState.url);
          }
        }
      });
    }

    const label = quickPayState?.slug ? `Оплатить ${quickPayState.slug}` : "Оплатить";
    const actionBtn = node.querySelector("[data-quickpay-action]");
    if (actionBtn instanceof HTMLButtonElement) {
      actionBtn.textContent = label;
    }
    node.classList.remove("hidden");
  }

  function getPendingPaymentUrl() {
    if (!(dom.pendingContinue instanceof HTMLAnchorElement)) return "";
    const href = String(dom.pendingContinue.href || "").trim();
    if (!href || href === "#") return "";
    return href;
  }

  function getRequiredPaymentUrl() {
    if (currentStep === "success" && quickPayState?.url) {
      return String(quickPayState.url).trim();
    }
    if (currentStep === "pending") {
      return getPendingPaymentUrl();
    }
    return "";
  }

  function hasPaymentStepLock() {
    return Boolean(getRequiredPaymentUrl());
  }

  function safeRenderQuickPayButton() {
    if (typeof renderQuickPayButton === "function") {
      renderQuickPayButton();
    }
  }


  function formatPrice(number) {
    return Number(number || 0).toLocaleString("ru-RU").replace(/,/g, " ");
  }

  function selectedPaymentMode() {
    return dom.paymentCredit instanceof HTMLInputElement && dom.paymentCredit.checked ? "credit" : "cash";
  }

  function selectedCreditMonths() {
    const raw = dom.creditMonths instanceof HTMLSelectElement ? dom.creditMonths.value : "6";
    const parsed = Number.parseInt(String(raw || ""), 10);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(6, parsed)) : 6;
  }

  function buildClientCreditPlan(slugAmount) {
    const principal = Math.max(0, Math.round(Number(slugAmount || 0)));
    const months = selectedCreditMonths();
    const downPayment = Math.floor(principal * 0.5);
    const financed = Math.max(0, principal - downPayment);
    const monthly = months > 0 ? Math.ceil(financed / months) : 0;
    return { downPayment, financed, months, monthly };
  }

  function formatPremiumMonthlyUsdLabel(value = state.pricing?.planPremiumMonthlyPriceUsd || DEFAULT_PRICING.planPremiumMonthlyPriceUsd) {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return "$2";
    }
    const amount = Number.isInteger(normalized)
      ? String(normalized)
      : normalized.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    return `$${amount}`;
  }

  function shouldUseTelegramPremiumUsdLabel(requestedPlan, planPrice) {
    return normalizePlan(requestedPlan) === "premium" && Number(planPrice || 0) > 0;
  }

  function formatTelegramPlanPriceLabel(planPrice, requestedPlan) {
    if (shouldUseTelegramPremiumUsdLabel(requestedPlan, planPrice)) {
      return formatPremiumMonthlyUsdLabel();
    }
    return `${formatPrice(planPrice)} сум`;
  }

  function formatTelegramTotalPriceLabel({ requestedPlan, slugPrice = 0, planPrice = 0, totalAmount = 0 }) {
    if (
      shouldUseTelegramPremiumUsdLabel(requestedPlan, planPrice) &&
      Number(slugPrice || 0) <= 0
    ) {
      return formatPremiumMonthlyUsdLabel();
    }
    return `${formatPrice(totalAmount)} сум`;
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
    return "premium";
  }

  function normalizePlan(value) {
    if (value === "premium") return "premium";
    if (value === "basic") return "premium";
    return "none";
  }

  function currentUserPlan() {
    return normalizePlan(currentUser?.plan || state.pricing?.userPlan || "none");
  }

  function resolveRequestedPlanFromOpenOptions(options = {}) {
    const params = new URLSearchParams(window.location.search);
    const queryPlan = params.get("tariff");
    const raw = String(options.plan || queryPlan || "").trim().toLowerCase();
    return raw === "premium" ? "premium" : "premium";
  }

  function shouldUseProfileRenewalFallback(options = {}) {
    if (document.body?.getAttribute("data-page") !== "profile-page") {
      return false;
    }
    const explicitOrderKind = String(options.orderKind || options.mode || "").trim();
    if (explicitOrderKind) {
      return normalizeOrderKind(explicitOrderKind) === "subscription_renewal";
    }
    const requestedPlan = resolveRequestedPlanFromOpenOptions(options);
    if (requestedPlan !== "premium") {
      return false;
    }
    if (options.slug || options.dropId) {
      return false;
    }
    const profileSubscription = window.UNQProfileSubscription;
    return Boolean(
      profileSubscription &&
      typeof profileSubscription === "object" &&
      (profileSubscription.isExpired || profileSubscription.expiresAt),
    );
  }

  function resolveOrderKindFromOpenOptions(options = {}) {
    if (shouldUseProfileRenewalFallback(options)) {
      return "subscription_renewal";
    }
    return normalizeOrderKind(options.orderKind || options.mode || "");
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
    const orderKind = resolveOrderKindFromOpenOptions(options);
    const attribution = resolveAttributionFromOptions(options);
    const params = new URLSearchParams();
    params.set("requestedPlan", requestedPlan);
    params.set("orderKind", orderKind);
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
    const fallbackSlugCandidate = splitSlug(
      `${normalizeLetters(dom.letters instanceof HTMLInputElement ? dom.letters.value : "")}${normalizeDigits(dom.digits instanceof HTMLInputElement ? dom.digits.value : "")}`,
    );
    const optionSlugCandidate = splitSlug(options.slug || "");
    const precheckSlug = optionSlugCandidate?.slug || fallbackSlugCandidate?.slug || "";
    if (precheckSlug) {
      params.set("slug", precheckSlug);
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
        orderKind,
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
        promo: {
          code: promoCode,
          applied: false,
          name: "",
          discountType: "",
          discountValue: 0,
          reason: "",
          policy: {
            enabled: true,
            firstOrderOnly: true,
          },
        },
        lucky: {
          active: false,
          discountPercent: 10,
          targetSlug: null,
          validUntil: null,
          appliesToCurrentSlug: false,
        },
      };
    }
  }

  function getPricing() {
    const raw = state.pricing || {};
    const premiumMonthlyPriceUzs = Number(
      raw.planPremiumMonthlyPriceUzs || raw.planPremiumPrice || DEFAULT_PRICING.planPremiumMonthlyPriceUzs,
    );
    return {
      planBasicPrice: premiumMonthlyPriceUzs,
      planPremiumPrice: premiumMonthlyPriceUzs,
      premiumUpgradePrice: premiumMonthlyPriceUzs,
      planPremiumMonthlyPriceUsd: Number(raw.planPremiumMonthlyPriceUsd || DEFAULT_PRICING.planPremiumMonthlyPriceUsd),
      planPremiumMonthlyPriceUzs: premiumMonthlyPriceUzs,
      userPlan: normalizePlan(raw.userPlan || "none"),
    };
  }

  function resolvePlanCharge(selected, userPlan, pricing, orderKind = state.orderKind) {
    if (selected !== "premium") {
      return 0;
    }
    if (isSubscriptionRenewalMode(orderKind)) {
      return Number(pricing.planPremiumMonthlyPriceUzs || pricing.planPremiumPrice || 0);
    }
    if (userPlan === "premium") {
      return 0;
    }
    return Number(pricing.planPremiumMonthlyPriceUzs || pricing.planPremiumPrice || 0);
  }

  function syncPlanVisibilityByUserPlan(userPlan, orderKind = state.orderKind) {
    const isPremium = userPlan === "premium";
    const renewalMode = isSubscriptionRenewalMode(orderKind);

    if (dom.planBasicCard instanceof HTMLElement) {
      dom.planBasicCard.classList.add("hidden");
    }
    if (dom.planPremiumCard instanceof HTMLElement) {
      dom.planPremiumCard.classList.remove("hidden");
    }
    if (dom.planSection instanceof HTMLElement) {
      dom.planSection.classList.toggle("hidden", isPremium && !renewalMode);
    }

    dom.planBasic.checked = false;
    dom.planBasic.disabled = true;
    dom.planPremium.checked = true;
    dom.planPremium.disabled = renewalMode ? true : isPremium;
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
        error.payload = payload;
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
    const publicHandle = String(currentUser?.login || currentUser?.username || "").trim().replace(/^@+/, "");
    const username = publicHandle ? ` · @${publicHandle}` : "";
    dom.userName.textContent = `${safeName}${username}`;
    dom.userAvatar.src = currentUser?.photoUrl || "/brand/logo.PNG";
  }

  function getCurrentFormSnapshot() {
    return {
      letters: normalizeLetters(dom.letters.value),
      digits: normalizeDigits(dom.digits.value),
      name: String(dom.name.value || "").trim(),
      plan: selectedPlan(),
    };
  }

  function isFormDirty() {
    const baseline = state.initialFormSnapshot;
    const current = getCurrentFormSnapshot();
    if (!baseline || typeof baseline !== "object") {
      return Boolean(current.letters || current.digits || current.name || current.plan === "premium");
    }
    return (
      current.letters !== String(baseline.letters || "") ||
      current.digits !== String(baseline.digits || "") ||
      current.name !== String(baseline.name || "") ||
      current.plan !== String(baseline.plan || "premium")
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
    if (!isSubscriptionRenewalMode() && !state.slugLocked) {
      stages.push("UNQ");
    }
    if (dom.planSection instanceof HTMLElement && !dom.planSection.classList.contains("hidden")) {
      stages.push("Тариф");
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
    if (step === "loading") {
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

    dom.stepLoading?.classList.toggle("hidden", step !== "loading");
    dom.stepAuth.classList.toggle("hidden", step !== "auth");
    dom.stepPending?.classList.toggle("hidden", step !== "pending");
    dom.stepForm.classList.toggle("hidden", step !== "form");
    dom.stepSuccess.classList.toggle("hidden", step !== "success");

    const lockClose = step === "success" || step === "pending";
    if (dom.closeTop instanceof HTMLButtonElement) {
      dom.closeTop.classList.toggle("opacity-0", lockClose);
      dom.closeTop.classList.toggle("pointer-events-none", lockClose);
    }
    if (dom.closeSuccess instanceof HTMLButtonElement) {
      dom.closeSuccess.classList.toggle("hidden", step === "success");
    }
  }

  function setProgress() {
    if (!(dom.progressAuth instanceof HTMLElement) || !(dom.progressNoAuth instanceof HTMLElement)) {
      return;
    }
    const lineAuth = String(dom.progressAuth.textContent || "").trim();
    const lineNoAuth = String(dom.progressNoAuth.textContent || "").trim();
    const hasLine = Boolean(lineAuth || lineNoAuth);
    if (currentStep === "auth" || currentStep === "loading" || !hasLine) {
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

  function syncCheckoutModeCopy() {
    const renewalMode = isSubscriptionRenewalMode();
    const flashMode = isFlashOfferMode();
    if (dom.authTitle instanceof HTMLElement) {
      dom.authTitle.textContent = renewalMode
        ? "Войдите в аккаунт"
        : flashMode
          ? "Акция Flash Sale активна"
          : DEFAULT_AUTH_TITLE;
    }
    if (dom.authText instanceof HTMLElement) {
      dom.authText.textContent = renewalMode
        ? "Нужно, чтобы привязать продление Premium к вашему аккаунту."
        : flashMode
          ? "Изучите условия акции ниже. После входа вы сможете сразу купить UNQ, а если выбранный slug подходит под акцию, скидка применится автоматически."
          : DEFAULT_AUTH_TEXT;
    }
    if (dom.submit instanceof HTMLButtonElement) {
      dom.submit.textContent = renewalMode
        ? "Перейти к оплате"
        : flashMode
          ? "Оформить со скидкой"
          : DEFAULT_SUBMIT_LABEL;
    }
    if (dom.successBody instanceof HTMLElement) {
      dom.successBody.textContent = renewalMode
        ? "Мы подготовили заявку на продление тарифа. Нажмите кнопку ниже, чтобы открыть Telegram с готовым сообщением для оплаты."
        : flashMode
          ? "Мы подготовили flash-sale заявку. Нажмите кнопку ниже, чтобы открыть Telegram с готовым сообщением для оплаты."
          : DEFAULT_SUCCESS_BODY;
    }
    if (dom.successNote instanceof HTMLElement) {
      dom.successNote.textContent = renewalMode
        ? "После оплаты мы продлим Premium на 30 дней."
        : flashMode
          ? "Если выбранный UNQ участвует в акции, скидка уже учтена в итоговой цене."
          : DEFAULT_SUCCESS_NOTE;
    }
    if (dom.countdown instanceof HTMLElement) {
      dom.countdown.classList.toggle("hidden", renewalMode);
    }
    syncModalToneUi();
  }

  function applyCheckoutModeUi() {
    const renewalMode = isSubscriptionRenewalMode();
    if (renewalMode) {
      state.promoCode = "";
      state.promoValidationHint = "";
      if (dom.promoCode instanceof HTMLInputElement) {
        dom.promoCode.value = "";
      }
      if (dom.campaignHint instanceof HTMLElement) {
        dom.campaignHint.classList.add("hidden");
        dom.campaignHint.textContent = "";
      }
      if (dom.fraudHint instanceof HTMLElement) {
        dom.fraudHint.classList.add("hidden");
        dom.fraudHint.textContent = "";
      }
      if (dom.name instanceof HTMLInputElement) {
        dom.name.value = currentUser?.firstName || currentUser?.displayName || dom.name.value || "";
      }
    }

    dom.slugPricingCard?.classList.toggle("hidden", renewalMode);
    dom.promoSection?.classList.toggle("hidden", renewalMode);
    dom.nameSection?.classList.toggle("hidden", renewalMode);
    dom.totalSlugRow?.classList.toggle("hidden", renewalMode);
    if (renewalMode && dom.officialNotice instanceof HTMLElement) {
      dom.officialNotice.innerHTML = "";
      dom.officialNotice.classList.add("hidden");
    }

    syncCheckoutModeCopy();
  }

  function setCampaignHint(text, tone) {
    if (!(dom.campaignHint instanceof HTMLElement)) {
      return;
    }
    const normalized = String(text || "").trim();
    if (!normalized) {
      dom.campaignHint.textContent = "";
      dom.campaignHint.className = "mt-2 hidden text-xs";
      return;
    }
    dom.campaignHint.textContent = normalized;
    dom.campaignHint.className = "mt-2 text-xs";
    if (tone === "error") dom.campaignHint.classList.add("text-red-600");
    else if (tone === "success") dom.campaignHint.classList.add("text-emerald-700");
    else dom.campaignHint.classList.add("text-neutral-600");
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
    return "Премиум";
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
    const promoDiscountApplied = Number(order.promoDiscountApplied || 0);
    const promoCodeApplied = String(order.promoCodeApplied || "").trim();
    const bonusSpent = Number(order.bonusSpent || 0);
    const planPriceValue = Number(order.planPrice || 0);
    const totalAmount = Number(order.totalOneTime || slugPrice + planPriceValue);
    const userName = (currentUser?.displayName || currentUser?.firstName || "").trim() || "не указано";
    const userEmail = (currentUser?.email || "").trim() || "не указан";
    const renewalMode = normalizeOrderKind(order.orderKind) === "subscription_renewal";
    const planPriceLabel = formatTelegramPlanPriceLabel(planPriceValue, order.requestedPlan);
    const totalPriceLabel = formatTelegramTotalPriceLabel({
      requestedPlan: order.requestedPlan,
      slugPrice,
      planPrice: planPriceValue,
      totalAmount,
    });
    const message =
      renewalMode
        ? `Здравствуйте! Хочу оплатить продление тарифа #️⃣ ${reference}\n\n` +
          `ФИО: ${userName}\n` +
          `Email: ${userEmail}\n\n` +
          `💳 Детализация оплаты:\n` +
          `• Продление тарифа ${planLabel(order.requestedPlan)}: ${planPriceLabel}\n\n` +
          `Итого к оплате: ${totalPriceLabel}`
        : `Здравствуйте! Хочу оплатить заказ #️⃣ ${reference}\n\n` +
          `UNQ: ${slug}\n` +
          `ФИО: ${userName}\n` +
          `Email: ${userEmail}\n\n` +
          `💳 Детализация оплаты:\n` +
          `• UNQ ${slug}: ${formatPrice(slugPrice)} сум\n` +
          (inviteeDiscountApplied > 0 ? `• Скидка по рефералке: -${formatPrice(inviteeDiscountApplied)} сум\n` : "") +
          (promoDiscountApplied > 0 ? `• Скидка по промокоду${promoCodeApplied ? ` (${promoCodeApplied})` : ""}: -${formatPrice(promoDiscountApplied)} сум\n` : "") +
          (bonusSpent > 0 ? `• Списано бонусов: -${formatPrice(bonusSpent)} сум\n` : "") +
          `• Тариф ${planLabel(order.requestedPlan)}: ${planPriceLabel}\n\n` +
          `Итого к оплате: ${totalPriceLabel}`;
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
      safeRenderQuickPayButton();
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

    const renewalMode = normalizeOrderKind(pending.orderKind) === "subscription_renewal";
    const meta = renewalMode
      ? `Продление тарифа: ${planLabel(pending.requestedPlan)} · Создано: ${formatPendingDateTime(pending.createdAt)}`
      : `UNQ: ${String(pending.slug || "—").toUpperCase()} · Тариф: ${planLabel(pending.requestedPlan)} · Резерв до: ${formatPendingDateTime(pending.pendingExpiresAt)}`;
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
        slug: renewalMode ? "" : String(pending.slug || "").trim().toUpperCase(),
        reference: String(pending.paymentReference || "").trim(),
      };
      safeRenderQuickPayButton();
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
      state.orderKind = resolveOrderKindFromOpenOptions(state.lastOpenOptions || {});
      applyCheckoutModeUi();
      renderPendingOrderState(null);
      setSubmitBlockedMessage("");
      setStatus("", "neutral");
      return "form";
    }

    state.orderKind = normalizeOrderKind(precheck.orderKind || resolveOrderKindFromOpenOptions(state.lastOpenOptions || {}));
    applyCheckoutModeUi();

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
        currentUser = getSessionUserFallback();
      }
      if (currentUser?.plan) {
        precheck.currentPlan = currentUser.plan;
      }
      precheck.authenticated = true;
      precheck.nextAction = "checkout";
      precheck.canPurchase = true;
      precheck.message = isSubscriptionRenewalMode()
        ? "Подготовим оплату продления Premium после проверки аккаунта."
        : "";
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
    if (isSubscriptionRenewalMode() && action !== "resume_pending") {
      precheck.message =
        precheck.canPurchase === false
          ? String(precheck.message || "Покупка сейчас недоступна.")
          : "Продление Premium на 30 дней без покупки нового UNQ.";
    }
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
      const tone = action === "already_premium" || action === "upgrade" ? "neutral" : (canPurchase ? "neutral" : "error");
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
    if (isSubscriptionRenewalMode()) {
      dom.slugReadonlyWrap?.classList.add("hidden");
      dom.slugInputsWrap?.classList.add("hidden");
      return;
    }
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
        return { total: fallbackTotal, flash: null, flashSale: null };
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
        flashSale: payload?.flashSale && typeof payload.flashSale === "object" ? payload.flashSale : null,
        source: String(payload.source || "calculator"),
        calculation: payload?.calculation && typeof payload.calculation === "object" ? payload.calculation : null,
      };
    } catch {
      return { total: fallbackTotal, flash: null, flashSale: null, source: "calculator", calculation: null };
    }
  }

  async function updateTotals() {
    dom.letters.value = normalizeLetters(dom.letters.value);
    dom.digits.value = normalizeDigits(dom.digits.value);
    const renewalMode = isSubscriptionRenewalMode();
    applyCheckoutModeUi();
    const creditMode = !renewalMode && selectedPaymentMode() === "credit";
    if (dom.paymentSection instanceof HTMLElement) {
      dom.paymentSection.classList.toggle("hidden", renewalMode);
    }
    if (dom.creditMonthsWrap instanceof HTMLElement) {
      dom.creditMonthsWrap.classList.toggle("hidden", !creditMode);
    }
    const pricing = renewalMode ? null : calculateSlugPricing(dom.letters.value, dom.digits.value);
    const requestedPlan = selectedPlan();
    const pricingSettings = getPricing();
    const userPlan = currentUserPlan();
    const planCharge = resolvePlanCharge(requestedPlan, userPlan, pricingSettings, state.orderKind);
    const planCardBasic = pricingSettings.planBasicPrice;
    const planCardPremium = Number(pricingSettings.planPremiumMonthlyPriceUzs || pricingSettings.planPremiumPrice || 0);
    const slugBasePrice = Number(state.slugPricing?.basePrice || DEFAULT_SLUG_PRICING.basePrice);
    const fallbackSlugPrice = pricing ? pricing.total : 0;
    const server = renewalMode
      ? { total: 0, flash: null, flashSale: null, source: "renewal", calculation: null }
      : pricing
        ? await resolveServerPrice(pricing.slug, fallbackSlugPrice)
        : { total: 0, flash: null, flashSale: null };
    if (pricing && !server) {
      if (dom.officialNotice instanceof HTMLElement) {
        dom.officialNotice.innerHTML = "";
        dom.officialNotice.classList.add("hidden");
      }
      return;
    }
    const slugPrice = server ? server.total : fallbackSlugPrice;
    const slugBaseForCap = server?.flash?.basePrice ? Number(server.flash.basePrice || slugPrice) : slugPrice;
    const productDiscountAmount = Math.max(0, Math.round(slugBaseForCap - slugPrice));
    const referral = state.checkoutContext?.referral && typeof state.checkoutContext.referral === "object" ? state.checkoutContext.referral : null;
    const promo = state.checkoutContext?.promo && typeof state.checkoutContext.promo === "object" ? state.checkoutContext.promo : null;
    const promoApplied = renewalMode ? false : Boolean(promo?.applied);
    const promoDiscountType = String(promo?.discountType || "").trim().toLowerCase();
    const promoDiscountValue = Math.max(0, Math.round(Number(promo?.discountValue || 0)));
    const applyPromo = (price) => {
      const base = Math.max(0, Math.round(Number(price || 0)));
      if (!promoApplied) {
        return { finalPrice: base, discountApplied: 0 };
      }
      if (promoDiscountType === "fixed_price") {
        const finalPrice = Math.max(0, Math.min(base, promoDiscountValue));
        return { finalPrice, discountApplied: Math.max(0, base - finalPrice) };
      }
      if (promoDiscountType === "discount_percent") {
        const percent = Math.max(0, Math.min(100, promoDiscountValue));
        const discountApplied = Math.min(base, Math.round((base * percent) / 100));
        return { finalPrice: Math.max(0, base - discountApplied), discountApplied };
      }
      const discountApplied = Math.min(base, promoDiscountValue);
      return { finalPrice: Math.max(0, base - discountApplied), discountApplied };
    };
    const promoPricing = applyPromo(slugPrice);
    const promoDiscountApplied = promoPricing.discountApplied;
    const slugAfterPromo = promoPricing.finalPrice;
    let inviteeDiscountApplied = 0;
    let bonusSpent = 0;
    let discountCapApplied = 0;
    let slugPayable = slugAfterPromo;
    if (!promoApplied) {
      const capPercent = Number(referral?.capPercent || 0);
      const inviteeCandidate = Number(referral?.inviteeDiscountCandidate || 0);
      const walletBalance = Number(referral?.walletBalance || 0);
      const capAmount = Math.max(0, Math.floor((Math.max(0, slugBaseForCap) * capPercent) / 100));
      const capRemaining = Math.max(0, capAmount - productDiscountAmount);
      inviteeDiscountApplied = Math.max(0, Math.min(inviteeCandidate, capRemaining, slugPrice));
      const afterInvitee = Math.max(0, slugPrice - inviteeDiscountApplied);
      bonusSpent = Math.max(0, Math.min(walletBalance, Math.max(0, capRemaining - inviteeDiscountApplied), afterInvitee));
      slugPayable = Math.max(0, afterInvitee - bonusSpent);
      discountCapApplied = Math.max(0, (inviteeCandidate - inviteeDiscountApplied) + Math.max(0, walletBalance - bonusSpent));
    }
    const lucky = state.checkoutContext?.lucky && typeof state.checkoutContext.lucky === "object"
      ? state.checkoutContext.lucky
      : null;
    const luckyApplied = renewalMode ? false : Boolean(lucky?.active && lucky?.appliesToCurrentSlug);
    const luckyPercent = Math.max(0, Math.min(100, Math.round(Number(lucky?.discountPercent || 10))));
    const luckyTargetSlug = String(lucky?.targetSlug || "").trim().toUpperCase();
    const luckyDiscountApplied = luckyApplied ? Math.min(slugPayable, Math.round((slugPayable * luckyPercent) / 100)) : 0;
    const slugAfterLucky = Math.max(0, slugPayable - luckyDiscountApplied);
    const creditPlan = creditMode ? buildClientCreditPlan(slugAfterLucky) : null;
    const oneTime = (creditPlan ? creditPlan.downPayment : slugAfterLucky) + planCharge;
    const slugLabel = pricing ? pricing.slug : "___ ___";
    const rarity = getRarity(slugPrice);
    const hasExistingPlan = !renewalMode && userPlan === "premium" && planCharge <= 0;
    if (server?.flashSale && typeof server.flashSale === "object") {
      state.flashSaleMeta = server.flashSale;
    }

    setSlugMode(pricing);
    syncFlashStoryUi(server?.flashSale || state.flashSaleMeta);
    syncFlashPurchaseStatus({ pricing, server });

    if (!renewalMode && dom.officialNotice instanceof HTMLElement) {
      const api = window.UNQOfficialLetters;
      const slugForCheck = pricing ? String(pricing.slug || "").replace(/\s/g, "") : "";
      const show =
        api &&
        typeof api.isOfficialSlug === "function" &&
        typeof api.renderPurchaseNoticeHtml === "function" &&
        slugForCheck &&
        api.isOfficialSlug(slugForCheck);
      if (show) {
        dom.officialNotice.innerHTML = api.renderPurchaseNoticeHtml();
        dom.officialNotice.classList.remove("hidden");
      } else {
        dom.officialNotice.innerHTML = "";
        dom.officialNotice.classList.add("hidden");
      }
    }

    if (dom.planBasicPrice instanceof HTMLElement) {
      dom.planBasicPrice.textContent = `${formatPrice(planCardBasic)} сум`;
    }
    if (dom.planBasicNote instanceof HTMLElement) {
      dom.planBasicNote.textContent = "legacy";
    }
    if (dom.planPremiumPrice instanceof HTMLElement) {
      dom.planPremiumPrice.textContent = `${formatPrice(planCardPremium)} сум`;
    }
    if (dom.planPremiumNote instanceof HTMLElement) {
      dom.planPremiumNote.textContent = renewalMode ? "продление на 30 дней" : (userPlan === "premium" ? "подписка активна ✓" : "$2/мес");
    }
    if (dom.planActivationNote instanceof HTMLElement) {
      dom.planActivationNote.textContent = renewalMode
        ? "После оплаты продлим Premium на 30 дней."
        : "После оплаты активируем Premium на 30 дней.";
    }
    syncPlanVisibilityByUserPlan(userPlan, state.orderKind);

    if (!renewalMode && dom.slugPreview instanceof HTMLElement) {
      dom.slugPreview.textContent = `unqx.uz/${slugLabel.replace(" ", "")}`;
    }
    if (!renewalMode && dom.slugPrice instanceof HTMLElement) {
      if (server?.flash) {
        dom.slugPrice.innerHTML = `<span class=\"line-through text-neutral-400\">${formatPrice(server.flash.basePrice)}</span> <span class=\"text-emerald-700\">${formatPrice(slugPrice)}</span>`;
      } else {
        dom.slugPrice.textContent = formatPrice(slugPrice);
      }
    }
    if (!renewalMode && dom.formula instanceof HTMLElement) {
      if (server?.flash) {
        const flashRuleLabel = String(server?.flashSale?.conditionLabel || state.flashSaleMeta?.conditionLabel || "").trim();
        const flashTitle = String(server?.flashSale?.title || state.flashSaleMeta?.title || "Акция").trim();
        dom.formula.textContent = flashRuleLabel
          ? `${flashTitle}: -${server.flash.discountPercent}% · ${flashRuleLabel} · цена со скидкой ${formatPrice(slugPrice)} сум.`
          : `${flashTitle}: -${server.flash.discountPercent}% · цена со скидкой ${formatPrice(slugPrice)} сум.`;
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
        const markupPercent = Number(calc?.markupPercent || 0);
        const markupAmount = Number(calc?.markupAmount || 0);
        const markupTail = markupPercent > 0 && markupAmount > 0
          ? ` + ${formatPrice(markupAmount)} (${markupPercent}% наценка)`
          : "";
        if (!customParts && customDeltaTotal) {
          const sign = customDeltaTotal > 0 ? "+" : "-";
          dom.formula.textContent = `${formatPrice(base)} × ${lettersMultiplier} × ${digitsMultiplier} ${sign} ${formatPrice(Math.abs(customDeltaTotal))}${markupTail} = ${formatPrice(slugPrice)} сум`;
        } else {
          dom.formula.textContent = `${formatPrice(base)} × ${lettersMultiplier} × ${digitsMultiplier}${tail}${markupTail} = ${formatPrice(slugPrice)} сум`;
        }
      }
    }
    if (!renewalMode && dom.rarity instanceof HTMLElement) {
      dom.rarity.className = `inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider ${rarity.cls}`;
      dom.rarity.textContent = rarity.label;
    }
    if (!renewalMode && dom.totalSlugTitle instanceof HTMLElement) {
      dom.totalSlugTitle.textContent = `UNQ ${pricing ? pricing.slug : "AAA000"}`;
    }
    if (!renewalMode && dom.totalSlugValue instanceof HTMLElement) {
      dom.totalSlugValue.textContent = creditPlan
        ? `${formatPrice(creditPlan.downPayment)} сум сейчас`
        : `${formatPrice(slugAfterLucky)} сум`;
    }
    if (dom.totalPlanTitle instanceof HTMLElement) {
      dom.totalPlanTitle.textContent = "Подписка Premium";
    }
    if (dom.totalPlanValue instanceof HTMLElement) {
      dom.totalPlanValue.textContent =
        planCharge > 0 ? `${formatPrice(planCharge)} сум` : (userPlan === "none" ? "0 сум" : "уже куплен");
    }
    if (dom.totalPlanRow instanceof HTMLElement) {
      dom.totalPlanRow.classList.toggle("hidden", hasExistingPlan);
      dom.totalPlanRow.classList.toggle("flex", !hasExistingPlan);
    }
    if (dom.totalProductDiscountRow instanceof HTMLElement) {
      dom.totalProductDiscountRow.classList.toggle("hidden", productDiscountAmount <= 0);
      dom.totalProductDiscountRow.classList.toggle("flex", productDiscountAmount > 0);
    }
    if (dom.totalProductDiscountValue instanceof HTMLElement) {
      dom.totalProductDiscountValue.textContent = `-${formatPrice(productDiscountAmount)} сум`;
    }
    const discountRowAmount = promoApplied ? promoDiscountApplied : inviteeDiscountApplied;
    if (dom.totalInviteeDiscountRow instanceof HTMLElement) {
      dom.totalInviteeDiscountRow.classList.toggle("hidden", discountRowAmount <= 0);
      dom.totalInviteeDiscountRow.classList.toggle("flex", discountRowAmount > 0);
    }
    if (dom.totalInviteeDiscountLabel instanceof HTMLElement) {
      dom.totalInviteeDiscountLabel.textContent = promoApplied ? "Скидка по промокоду" : "Скидка по рефералке";
    }
    if (dom.totalInviteeDiscountValue instanceof HTMLElement) {
      dom.totalInviteeDiscountValue.textContent = `-${formatPrice(discountRowAmount)} сум`;
    }
    if (dom.totalLuckyRow instanceof HTMLElement) {
      dom.totalLuckyRow.classList.toggle("hidden", luckyDiscountApplied <= 0);
      dom.totalLuckyRow.classList.toggle("flex", luckyDiscountApplied > 0);
    }
    if (dom.totalLuckyLabel instanceof HTMLElement) {
      const luckyTargetPart = luckyTargetSlug ? ` (${luckyTargetSlug})` : "";
      dom.totalLuckyLabel.textContent = `UNQX Lucky -${luckyPercent}%${luckyTargetPart}`;
    }
    if (dom.totalLuckyValue instanceof HTMLElement) {
      dom.totalLuckyValue.textContent = `-${formatPrice(luckyDiscountApplied)} сум`;
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
      dom.totalMonthly.textContent = renewalMode
        ? "Продление Premium · 30 дней после оплаты"
        : creditPlan
          ? `Кредит 0% · остаток ${formatPrice(creditPlan.financed)} сум · ${formatPrice(creditPlan.monthly)} сум/мес на ${creditPlan.months} мес.`
          : "Premium подписка · $2/мес · продление вручную";
    }
    if (renewalMode) {
      setCampaignHint("");
      if (dom.fraudHint instanceof HTMLElement) {
        dom.fraudHint.classList.add("hidden");
        dom.fraudHint.textContent = "";
      }
      return;
    }
    {
      const campaignApplied = Boolean(referral?.campaignApplied);
      const campaignName = String(referral?.campaignName || "").trim();
      const promo = state.checkoutContext?.promo && typeof state.checkoutContext.promo === "object" ? state.checkoutContext.promo : null;
      const promoCodeApplied = String(promo?.code || "").trim();
      const promoApplied = Boolean(promo?.applied);
      const promoReason = String(promo?.reason || "").trim();
      const promoHasInput = Boolean(state.promoCode || promoCodeApplied);
      const lucky = state.checkoutContext?.lucky && typeof state.checkoutContext.lucky === "object" ? state.checkoutContext.lucky : null;
      const luckyApplied = Boolean(lucky?.active && lucky?.appliesToCurrentSlug);
      const luckyTargetSlug = String(lucky?.targetSlug || "").trim().toUpperCase();
      const luckyPercent = Math.max(0, Math.min(100, Math.round(Number(lucky?.discountPercent || 10))));
      if (promoApplied && promoCodeApplied) {
        setCampaignHint(`Промокод применен: ${promoCodeApplied}`, "success");
      } else if (luckyApplied) {
        setCampaignHint(
          `Применен UNQX Lucky: -${luckyPercent}%${luckyTargetSlug ? ` на ${luckyTargetSlug}` : ""}`,
          "success",
        );
      } else if (promoHasInput && promoReason) {
        const reasonLabel =
          promoReason === "promo_disabled"
            ? "Промокоды временно отключены."
            : promoReason === "promo_first_order_only"
            ? "Промокод доступен только для первого заказа."
            : promoReason === "per_user_cap_reached"
            ? "Лимит использования промокода исчерпан."
            : promoReason === "promo_budget_exhausted"
            ? "Бюджет промокода исчерпан."
            : "Промокод не найден или не активен.";
        setCampaignHint(reasonLabel, "error");
      } else if (campaignApplied) {
        setCampaignHint(campaignName ? `Применена кампания: ${campaignName}` : "Применена акция", "success");
      } else if (state.promoValidationHint) {
        setCampaignHint(state.promoValidationHint, "error");
      } else {
        setCampaignHint("");
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
    if (isSubscriptionRenewalMode()) {
      return;
    }
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
    let shouldRefresh = true;
    try {
      const payload = await postJson("/api/referrals/promo/validate", {
        promoCode,
        refSource: state.refSource || "order_modal",
        refOffer: state.refOffer || "default",
      });
      if (payload?.valid) {
        state.promoValidationHint = "";
        const policyHints = [];
        if (payload?.policy?.firstOrderOnly) policyHints.push("только первый заказ");
        const discountType = String(payload?.discountType || "").trim().toLowerCase();
        const discountValue = Math.max(0, Math.round(Number(payload?.discountValue || 0)));
        const discountLabel =
          discountValue > 0
            ? discountType === "fixed_price"
              ? `фикс. цена ${formatPrice(discountValue)} сум`
              : discountType === "discount_percent"
              ? `скидка ${discountValue}%`
              : `скидка ${formatPrice(discountValue)} сум`
            : "";
        const namePart = payload?.name ? ` · ${payload.name}` : "";
        const discountPart = discountLabel ? ` · ${discountLabel}` : "";
        setCampaignHint(
          `Промокод применен: ${promoCode}${namePart}${discountPart}${policyHints.length ? ` (${policyHints.join(", ")})` : ""}`,
          "success",
        );
      } else {
        const reason = String(payload?.reason || "").trim().toLowerCase();
        state.promoValidationHint =
          reason === "promo_disabled"
            ? "Промокоды временно отключены."
            : reason === "promo_first_order_only"
            ? "Промокод доступен только для первого заказа."
            : reason === "per_user_cap_reached"
            ? "Лимит использования промокода исчерпан."
            : reason === "promo_budget_exhausted"
            ? "Бюджет промокода исчерпан."
            : "Промокод не найден или не активен.";
        shouldRefresh = false;
        if (state.checkoutContext && typeof state.checkoutContext === "object") {
          state.checkoutContext.promo = {
            ...(state.checkoutContext.promo && typeof state.checkoutContext.promo === "object" ? state.checkoutContext.promo : {}),
            code: promoCode,
            applied: false,
            name: "",
            discountType: "",
            discountValue: 0,
            reason,
            policy: payload?.policy && typeof payload.policy === "object" ? payload.policy : (state.checkoutContext.promo?.policy || {}),
          };
        }
        setCampaignHint(state.promoValidationHint, "error");
      }
    } catch (error) {
      state.promoValidationHint = "Промокод не найден или не активен.";
      shouldRefresh = false;
      if (state.checkoutContext && typeof state.checkoutContext === "object") {
        state.checkoutContext.promo = {
          ...(state.checkoutContext.promo && typeof state.checkoutContext.promo === "object" ? state.checkoutContext.promo : {}),
          code: promoCode,
          applied: false,
          name: "",
          discountType: "",
          discountValue: 0,
          reason: "promo_not_active",
        };
      }
      setCampaignHint(state.promoValidationHint, "error");
      setStatus(error?.message || "Промокод недействителен", "error");
    } finally {
      if (dom.promoCheck instanceof HTMLButtonElement) {
        dom.promoCheck.disabled = false;
        dom.promoCheck.textContent = originalText || "Проверить";
      }
      if (shouldRefresh) {
        await refreshCheckoutContext();
      }
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

  function getSessionUserFallback() {
    const sessionCandidate = window.UNQOrderModalSessionUser;
    if (sessionCandidate && typeof sessionCandidate === "object") {
      return sessionCandidate;
    }
    const isProfilePage = document.body?.getAttribute("data-page") === "profile-page";
    if (!isProfilePage) {
      return null;
    }
    const profileCandidate = window.UNQProfileUser;
    return profileCandidate && typeof profileCandidate === "object" ? profileCandidate : null;
  }

  async function refreshUser() {
    if (!currentUser) {
      const fallbackUser = getSessionUserFallback();
      if (fallbackUser) {
        currentUser = fallbackUser;
      }
    }
    renderUser();
    setProgress();
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
      const fallbackUser = getSessionUserFallback();
      if (fallbackUser) {
        currentUser = fallbackUser;
      }
    }
    renderUser();
    setProgress();
    return currentUser;
  }

  function prefillFromOpenOptions(options = {}, precheck = null, preserveSlug = false) {
    const params = new URLSearchParams(window.location.search);
    const queryPlan = params.get("tariff");
    const queryTheme = params.get("theme");
    const parsed = splitSlug(options.slug || "");
    state.orderKind = normalizeOrderKind(precheck?.orderKind || resolveOrderKindFromOpenOptions(options));
    const currentPlan = normalizePlan(precheck?.currentPlan || currentUserPlan());
    const defaultPlan = "premium";
    const contextPlan = precheck?.resolvedPlan === "premium" ? "premium" : "";
    const planCandidate = contextPlan || options.plan || queryPlan || defaultPlan;
    const plan = planCandidate === "premium" ? "premium" : "premium";
    const attribution = resolveAttributionFromOptions({
      ...options,
      refSource: precheck?.referral?.source || options.refSource,
      refOffer: precheck?.referral?.offer || options.refOffer,
    });
    state.theme = typeof options.theme === "string" && options.theme ? options.theme : queryTheme || "default_dark";
    state.slugLocked = Boolean(parsed);
    state.lockedSlug = parsed ? parsed.slug : "";
    state.dropId = typeof options.dropId === "string" && options.dropId ? options.dropId : null;
    state.refSource = attribution.refSource;
    state.refOffer = attribution.refOffer;
    state.promoCode = isSubscriptionRenewalMode()
      ? ""
      : String(options.promoCode || precheck?.promo?.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    if (dom.promoCode instanceof HTMLInputElement) {
      dom.promoCode.value = state.promoCode;
    }
    if (currentPlan === "none" && !isSubscriptionRenewalMode()) {
      dom.planPremium.disabled = false;
      dom.planPremium.checked = plan === "premium";
    } else {
      dom.planPremium.disabled = true;
      dom.planPremium.checked = true;
    }
    dom.planBasic.disabled = true;
    dom.planBasic.checked = false;
    syncPlanVisibilityByUserPlan(currentPlan, state.orderKind);
    if (parsed && !isSubscriptionRenewalMode()) {
      dom.letters.value = parsed.letters;
      dom.digits.value = parsed.digits;
    } else if (!preserveSlug) {
      dom.letters.value = "";
      dom.digits.value = "";
    }
    if (currentUser && !dom.name.value.trim()) {
      dom.name.value = currentUser.firstName || currentUser.displayName || "";
    }
    applyCheckoutModeUi();
    setStatus("", "neutral");
    setSubmitBlockedMessage("");
    state.initialFormSnapshot = getCurrentFormSnapshot();
    void updateTotals();
  }

  async function open(options = {}) {
    state.lastOpenOptions = options && typeof options === "object" ? { ...options } : {};
    state.forceAuth = document.body?.getAttribute("data-page") === "profile-page";
    state.orderKind = normalizeOrderKind(state.lastOpenOptions.orderKind || state.lastOpenOptions.mode || "");
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    isOpen = true;
    isClosing = false;
    stopCountdown();
    safeRenderQuickPayButton();
    applyCheckoutModeUi();
    setStep("loading");
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
    prefillFromOpenOptions(state.lastOpenOptions || {}, precheck, true);
    const step = applyOrderPrecheck(precheck);
    setStep(step);
    return precheck;
  }

  async function close(force = false) {
    if (!isOpen || isClosing || isCloseConfirming) {
      return;
    }
    if (!force && hasPaymentStepLock()) {
      const paymentUrl = getRequiredPaymentUrl();
      if (paymentUrl) {
        openTelegramUrl(paymentUrl);
      }
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
    safeRenderQuickPayButton();
    dom.root.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    setStatus("", "neutral");
    // Сбросить состояние формы и lastOpenOptions
    state.lastOpenOptions = {};
    state.checkoutContext = null;
    state.flashSaleMeta = null;
    state.orderKind = "slug_purchase";
    state.refSource = "";
    state.refOffer = "";
    state.promoValidationHint = "";
    delete dom.root.dataset.modalTone;
    dom.dialog?.removeAttribute("data-modal-tone");
    if (dom.letters) dom.letters.value = "";
    if (dom.digits) dom.digits.value = "";
    if (dom.name) dom.name.value = "";
    if (dom.planBasic) dom.planBasic.checked = false;
    if (dom.planPremium) dom.planPremium.checked = false;
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
    const renewalMode = isSubscriptionRenewalMode();
    const pricing = renewalMode ? null : calculateSlugPricing(dom.letters.value, dom.digits.value);
    if (!renewalMode && !pricing) {
      setStatus("Заполни UNQ в формате AAA000", "error");
      return;
    }
    if (!renewalMode && !dom.name.value.trim()) {
      setStatus("Имя для визитки обязательно", "error");
      return;
    }
    const plan = selectedPlan();
    const submitHtml = dom.submit.innerHTML;
    dom.submit.disabled = true;
    dom.submit.classList.add("opacity-70", "cursor-not-allowed");
    dom.submit.textContent = "Отправка...";

    try {
      if (renewalMode) {
        const payload = await postJson("/api/profile/subscription/renew", {});
        const paymentUrl = String(payload?.paymentUrl || "").trim();
        const orderId = String(payload?.order?.id || "").trim();
        const renewalEndAt = payload?.renewalWindow?.endAt ? new Date(payload.renewalWindow.endAt) : null;
        if (dom.successSlug instanceof HTMLElement) {
          dom.successSlug.textContent =
            renewalEndAt && Number.isFinite(renewalEndAt.getTime())
              ? `Premium будет продлён до ${renewalEndAt.toLocaleDateString("ru-RU")}`
              : "Продление Premium готово к оплате";
        }
        if (dom.successNote instanceof HTMLElement && renewalEndAt && Number.isFinite(renewalEndAt.getTime())) {
          dom.successNote.textContent = `После оплаты Premium будет активен до ${renewalEndAt.toLocaleDateString("ru-RU")}.`;
        }
        if (dom.countdown instanceof HTMLElement) {
          stopCountdown();
          dom.countdown.textContent = "";
          dom.countdown.classList.add("hidden");
        }
        const telegramLink = dom.root.querySelector("#order-modal-telegram-link");
        if (telegramLink instanceof HTMLAnchorElement) {
          telegramLink.href = paymentUrl || "#";
        }
        if (paymentUrl) {
          lastTelegramPaymentUrl = paymentUrl;
          quickPayState = {
            url: paymentUrl,
            orderId,
            slug: "",
            reference: "",
          };
          safeRenderQuickPayButton();
        }
        setStep("success");
        if (paymentUrl) {
          openTelegramUrl(paymentUrl);
        }
        window.dispatchEvent(new CustomEvent("unqx:subscription-renewal:submitted", { detail: payload }));
        return;
      }

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
        },
        paymentMode: selectedPaymentMode(),
        creditMonths: selectedCreditMonths(),
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
        const promoDiscountApplied = Number(payload?.pricing?.promoDiscountApplied || 0);
        const promoCodeApplied = String(payload?.pricing?.promoCodeApplied || "").trim();
        const luckyDiscountApplied = Number(payload?.pricing?.luckyDiscountApplied || 0);
        const bonusSpent = Number(payload?.pricing?.bonusSpent || 0);
        const planPrice = Number(payload?.pricing?.planPrice || 0);
        const totalAmount = Number(payload?.pricing?.totalOneTime || 0);
        const orderCode = String(payload?.payment?.reference || "").trim() || `UNQX-${String(payload.orderId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;
        const planLabel = "Подписка Premium";
        const planPriceLabel = formatTelegramPlanPriceLabel(planPrice, "premium");
        const totalPriceLabel = formatTelegramTotalPriceLabel({
          requestedPlan: "premium",
          slugPrice,
          planPrice,
          totalAmount,
        });
        const baseLine = slugBasePrice > slugPrice ? `• База UNQ ${pricing.slug}: ${formatPrice(slugBasePrice)} сум\n` : "";
        const referralLine = inviteeDiscountApplied > 0 ? `• Скидка по рефералке: -${formatPrice(inviteeDiscountApplied)} сум\n` : "";
        const promoLine = promoDiscountApplied > 0 ? `• Скидка по промокоду${promoCodeApplied ? ` (${promoCodeApplied})` : ""}: -${formatPrice(promoDiscountApplied)} сум\n` : "";
        const luckyLine = luckyDiscountApplied > 0 ? `• Скидка UNQX Lucky: -${formatPrice(luckyDiscountApplied)} сум\n` : "";
        const bonusLine = bonusSpent > 0 ? `• Списано бонусов: -${formatPrice(bonusSpent)} сум\n` : "";
        const message = `Здравствуйте! Хочу оплатить заказ #️⃣ ${orderCode}

      UNQ: ${pricing.slug}
      Имя: ${userName}
      📧 Email: ${userEmail}

      ━━━━━━━━━━━━
      💳 Детализация оплаты:
      ${baseLine}• UNQ ${pricing.slug}: ${formatPrice(slugPrice)} сум
      ${referralLine}${promoLine}${luckyLine}${bonusLine}• ${planLabel}: ${planPriceLabel}
      ━━━━━━━━━━━━
      Итого к оплате: ${totalPriceLabel}`;

        const telegramUrl = String(payload?.paymentLinks?.telegramUrl || "").trim() || `https://t.me/unqx_uz?text=${encodeURIComponent(message)}`;
        telegramLink.href = telegramUrl;
        lastTelegramPaymentUrl = telegramUrl;
        quickPayState = {
          url: telegramUrl,
          orderId: String(payload.orderId || "").trim(),
          slug: String(pricing.slug || "").trim().toUpperCase(),
          reference: String(orderCode || "").trim(),
        };
        safeRenderQuickPayButton();
      }

      startCountdown(expiresAtIso);
      setStep("success");
      const requiredUrl = String(quickPayState?.url || "").trim() || lastTelegramPaymentUrl;
      openTelegramUrl(requiredUrl);
      window.dispatchEvent(new CustomEvent("unqx:order:submitted", { detail: payload }));
    } catch (error) {
      if (renewalMode && error.code === "SUBSCRIPTION_RENEWAL_PENDING") {
        const paymentUrl = String(error?.payload?.paymentUrl || "").trim();
        const orderId = String(error?.payload?.order?.id || "").trim();
        if (paymentUrl) {
          lastTelegramPaymentUrl = paymentUrl;
          quickPayState = {
            url: paymentUrl,
            orderId,
            slug: "",
            reference: "",
          };
          safeRenderQuickPayButton();
        }
        await refreshCheckoutContext();
        if (paymentUrl) {
          openTelegramUrl(paymentUrl);
        }
        return;
      }
      if (renewalMode && error.code === "SUBSCRIPTION_RENEWAL_UNAVAILABLE") {
        setStatus("Продление Premium сейчас недоступно. Попробуйте позже.", "error");
        return;
      }
      if (error.code === "AUTH_REQUIRED") {
        setStep("auth");
        return;
      }
      if (error.code === "BASIC_SLUG_LIMIT_REACHED") {
        setStatus("Продлите Premium, чтобы добавить UNQ.", "error");
        return;
      }
      if (error.code === "PREMIUM_SLUG_LIMIT_REACHED") {
        setStatus("Достигнут лимит 3 UNQ", "error");
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
        setStatus("Этот UNQ уже занят. Выбери другой.", "error");
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
          orderKind: node.getAttribute("data-order-kind") || "",
          theme: node.getAttribute("data-order-theme") || "",
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
  dom.paymentCash?.addEventListener("change", () => void updateTotals());
  dom.paymentCredit?.addEventListener("change", () => void updateTotals());
  dom.creditMonths?.addEventListener("change", () => void updateTotals());
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
  dom.closeSuccess?.addEventListener("click", () => close(false));
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
        safeRenderQuickPayButton();
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
