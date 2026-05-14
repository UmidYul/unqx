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

  // --- RANDOM SLUG ON HOMEPAGE CALCULATOR ---
  // Only for homepage main calculator input (home-slug-input)
  (async function setRandomSlugOnHomeCalculator() {
    const lettersInput = document.getElementById("calc-letters");
    const digitsInput = document.getElementById("calc-digits");
    if (!(lettersInput instanceof HTMLInputElement) || !(digitsInput instanceof HTMLInputElement)) return;
    try {
      const response = await fetch("/api/random-free-slug", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const slug = typeof payload.slug === "string" ? payload.slug.toUpperCase() : "";
      if (/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
        lettersInput.value = slug.slice(0, 3);
        digitsInput.value = slug.slice(3);
        lettersInput.dispatchEvent(new Event("input", { bubbles: true }));
        digitsInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch { }
  })();

  const authApi = initTelegramAuth(pageNode);
  const orderApi = initOrderModalBridge();
  initMobileMenu();
  initHeroSlugOccupancy();
  initSlugAvailability(orderApi);
  initSlugCalculator(orderApi);
  void loadSlugPricingConfig();
  initNextDropOneClick();
  initOrderLinks(orderApi);
  const requestJson = createHomeJsonRequester();
  initHomeFollowButtons(pageNode, authApi, requestJson);
  initHomeLatestPostButtons(pageNode, requestJson);
  initHomeMotion();
})();

function createHomeJsonRequester() {
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');

  function getCsrfToken() {
    return csrfMeta instanceof HTMLMetaElement ? String(csrfMeta.getAttribute("content") || "") : "";
  }

  function updateCsrfToken(nextToken) {
    if (!(csrfMeta instanceof HTMLMetaElement)) return;
    const value = String(nextToken || "").trim();
    if (value) {
      csrfMeta.setAttribute("content", value);
    }
  }

  return async function requestJson(url, options = {}, allowRetry = true) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    const method = String(options.method || "GET").toUpperCase();
    const csrfToken = getCsrfToken();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (data && data.csrfToken) {
      updateCsrfToken(data.csrfToken);
    }
    if (!response.ok && allowRetry && data && data.code === "CSRF_INVALID" && data.csrfToken) {
      return requestJson(url, options, false);
    }
    return { response, data: data && typeof data === "object" ? data : {} };
  };
}

function initHomeFollowButtons(pageNode, authApi, requestJson) {
  function setButtonsState(slug, following) {
    const normalizedSlug = String(slug || "").trim().toUpperCase();
    if (!normalizedSlug) return;
    const buttons = pageNode.querySelectorAll("[data-home-follow-button]");
    buttons.forEach((node) => {
      if (!(node instanceof HTMLButtonElement)) return;
      if (String(node.getAttribute("data-follow-slug") || "").trim().toUpperCase() !== normalizedSlug) return;
      node.dataset.following = following ? "true" : "false";
      node.classList.toggle("is-following", following);
      node.classList.remove("is-busy");
      const label = following ? "Отписаться" : "Подписаться";
      node.setAttribute("aria-label", label);
      node.setAttribute("title", label);
    });
  }

  pageNode.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-home-follow-button]") : null;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();
    const followSlug = String(target.getAttribute("data-follow-slug") || "").trim().toUpperCase();
    const followingNow = String(target.getAttribute("data-following") || "").trim() === "true";
    const loginNext = String(target.getAttribute("data-login-next") || "").trim() || window.location.pathname;
    if (!followSlug || target.disabled) {
      return;
    }

    target.disabled = true;
    target.classList.add("is-busy");

    try {
      const { response, data } = await requestJson(`/api/cards/${encodeURIComponent(followSlug)}/follow`, {
        method: followingNow ? "DELETE" : "POST",
      });

      if (response.status === 401) {
        const user = authApi && typeof authApi.getUser === "function" ? authApi.getUser() : null;
        if (!user) {
          window.location.href = `/login?next=${encodeURIComponent(loginNext)}`;
          return;
        }
      }

      if (!response.ok) {
        target.classList.remove("is-busy");
        window.setTimeout(() => {
          setButtonsState(followSlug, followingNow);
        }, 900);
        return;
      }

      setButtonsState(followSlug, !followingNow);
    } catch {
      setButtonsState(followSlug, followingNow);
    } finally {
      window.setTimeout(() => {
        const buttons = pageNode.querySelectorAll("[data-home-follow-button]");
        buttons.forEach((node) => {
          if (!(node instanceof HTMLButtonElement)) return;
          if (String(node.getAttribute("data-follow-slug") || "").trim().toUpperCase() !== followSlug) return;
          node.disabled = false;
        });
      }, 120);
    }
  });
}

function initHomeLatestPostButtons(pageNode, requestJson) {
  function trimMetricDecimal(value) {
    return String(value).replace(/\.0$/, "");
  }

  function formatMetric(value) {
    const amount = Math.max(0, Number(value || 0));
    if (!Number.isFinite(amount)) {
      return "0";
    }
    if (amount >= 1_000_000) {
      return `${trimMetricDecimal((amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1))}M`;
    }
    if (amount >= 1_000) {
      return `${trimMetricDecimal((amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1))}K`;
    }
    return amount.toLocaleString("ru-RU");
  }

  async function copyText(value) {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      return false;
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(normalizedValue);
        return true;
      }
    } catch { }

    const textarea = document.createElement("textarea");
    textarea.value = normalizedValue;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    textarea.remove();
    return copied;
  }

  function resolvePostUrl(value) {
    const fallback = window.location.href;
    try {
      return new URL(String(value || "").trim() || fallback, window.location.origin).toString();
    } catch {
      return fallback;
    }
  }

  function navigateToPost(value) {
    const postHref = String(value || "").trim();
    if (!postHref) {
      return;
    }
    window.location.assign(postHref);
  }

  function updateLikeButton(button, options = {}) {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const liked = Boolean(options.liked);
    const busy = Boolean(options.busy);
    const disabledByData =
      !String(button.getAttribute("data-post-id") || "").trim() ||
      !String(button.getAttribute("data-post-slug") || "").trim();
    const likesCount = Math.max(
      0,
      Number(options.likesCount !== undefined ? options.likesCount : button.getAttribute("data-likes-count") || 0),
    );
    button.dataset.liked = liked ? "true" : "false";
    button.dataset.likesCount = String(likesCount);
    button.disabled = busy || disabledByData;
    button.classList.toggle("is-liked", liked);
    button.classList.toggle("is-busy", busy);
    button.setAttribute("aria-pressed", liked ? "true" : "false");
    const label = liked ? "Убрать лайк" : "Поставить лайк";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    const countNode = button.querySelector("[data-home-post-like-count]");
    if (countNode instanceof HTMLElement) {
      countNode.textContent = formatMetric(likesCount);
    }
  }

  async function handleLike(button) {
    const postId = String(button.getAttribute("data-post-id") || "").trim();
    const postSlug = String(button.getAttribute("data-post-slug") || "").trim().toUpperCase();
    const loginNext = String(button.getAttribute("data-login-next") || "").trim() || window.location.pathname;
    const likedNow = String(button.getAttribute("data-liked") || "").trim() === "true";
    const likesCountNow = Number(button.getAttribute("data-likes-count") || 0);
    if (!postId || !postSlug || button.disabled) {
      return;
    }

    updateLikeButton(button, { liked: likedNow, likesCount: likesCountNow, busy: true });

    try {
      const { response, data } = await requestJson(
        `/api/cards/${encodeURIComponent(postSlug)}/wall-posts/${encodeURIComponent(postId)}/like`,
        { method: likedNow ? "DELETE" : "PUT" },
      );

      if (response.status === 401 || data.code === "AUTH_REQUIRED") {
        window.location.assign(`/login?next=${encodeURIComponent(loginNext)}`);
        return;
      }

      if (!response.ok || !data || typeof data.post !== "object") {
        showToast(data.error || "Не удалось обновить лайк", "error");
        updateLikeButton(button, { liked: likedNow, likesCount: likesCountNow, busy: false });
        return;
      }

      updateLikeButton(button, {
        liked: Boolean(data.post.viewerHasLiked),
        likesCount: Number(data.post.likesCount || 0),
        busy: false,
      });
    } catch {
      showToast("Не удалось обновить лайк", "error");
      updateLikeButton(button, { liked: likedNow, likesCount: likesCountNow, busy: false });
    }
  }

  async function handleShare(button) {
    const shareUrl = resolvePostUrl(button.getAttribute("data-post-href"));
    let shared = false;

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          url: shareUrl,
        });
        shared = true;
        showToast("Ссылка на пост отправлена", "success");
      }
    } catch {
      shared = false;
    }

    if (shared) {
      return;
    }

    const copied = await copyText(shareUrl);
    showToast(copied ? "Ссылка на пост скопирована" : "Не удалось скопировать ссылку", copied ? "success" : "error");
  }

  pageNode.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return;
    }

    const postCard = target.closest("[data-home-post-card]");
    const interactiveTarget = target.closest("a, button, input, textarea, select, label");
    if (postCard instanceof HTMLElement && !interactiveTarget) {
      event.preventDefault();
      navigateToPost(postCard.getAttribute("data-post-href"));
      return;
    }

    const likeButton = target.closest("[data-home-post-like]");
    if (likeButton instanceof HTMLButtonElement) {
      event.preventDefault();
      await handleLike(likeButton);
      return;
    }

    const commentButton = target.closest("[data-home-post-comment]");
    if (commentButton instanceof HTMLButtonElement) {
      event.preventDefault();
      const postHref = String(commentButton.getAttribute("data-post-href") || "").trim();
      window.location.assign(postHref || "/");
      return;
    }

    const shareButton = target.closest("[data-home-post-share]");
    if (shareButton instanceof HTMLButtonElement) {
      event.preventDefault();
      await handleShare(shareButton);
    }
  });

  pageNode.addEventListener("keydown", (event) => {
    const origin = event.target instanceof HTMLElement ? event.target : null;
    const target = origin ? origin.closest("[data-home-post-card]") : null;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const interactiveTarget = origin ? origin.closest("a, button, input, textarea, select, label") : null;
    if (interactiveTarget && interactiveTarget !== target) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    navigateToPost(target.getAttribute("data-post-href"));
  });
}

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
  const slug = `${normalizedLetters}${normalizedDigits}`;
  const multipliedBase = Number(slugPricingConfig?.basePrice || DEFAULT_HOME_SLUG_PRICING.basePrice) * letterData.multiplier * digitData.multiplier;
  const customRules = Array.isArray(slugPricingConfig?.customRules) ? slugPricingConfig.customRules : [];
  let customDeltaTotal = 0;
  const customBreakdown = [];
  for (const rawRule of customRules) {
    if (!rawRule || typeof rawRule !== "object") continue;
    const pattern = String(rawRule.pattern || "").trim().toUpperCase();
    const type = String(rawRule.type || "").trim();
    const delta = Number(rawRule.delta || 0);
    if (!pattern || !Number.isFinite(delta) || delta === 0) continue;
    let match = false;
    if (type === "contains" && slug.includes(pattern)) match = true;
    if (type === "startsWith" && slug.startsWith(pattern)) match = true;
    if (type === "endsWith" && slug.endsWith(pattern)) match = true;
    if (type === "regex") {
      try {
        if (new RegExp(pattern).test(slug)) match = true;
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
    letters: normalizedLetters,
    digits: normalizedDigits,
    slug,
    letterData,
    digitData,
    multipliedBase,
    customDeltaTotal,
    customBreakdown,
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
  let authRetryAfter = 0;

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
          node.src = currentUser.photoUrl || "/brand/profile-user.svg";
        }
      }
    }
  }

  async function refreshUser() {
    if (Date.now() < authRetryAfter) {
      renderAuthUi();
      return currentUser;
    }
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      currentUser = payload && payload.authenticated ? payload.user : null;
      authRetryAfter = 0;
    } catch {
      currentUser = null;
      authRetryAfter = Date.now() + 30_000;
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
  const officialHeroNotice = document.getElementById("home-slug-official-notice");

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

  function syncHeroOfficialNotice(slug) {
    if (!(officialHeroNotice instanceof HTMLElement)) {
      return;
    }
    const api = window.UNQOfficialLetters;
    if (
      !api ||
      typeof api.isOfficialSlug !== "function" ||
      typeof api.renderPurchaseNoticeHtml !== "function"
    ) {
      officialHeroNotice.classList.add("hidden");
      officialHeroNotice.innerHTML = "";
      return;
    }
    if (slug && api.isOfficialSlug(slug)) {
      officialHeroNotice.innerHTML = api.renderPurchaseNoticeHtml();
      officialHeroNotice.classList.remove("hidden");
    } else {
      officialHeroNotice.classList.add("hidden");
      officialHeroNotice.innerHTML = "";
    }
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
        takenOwnerName.textContent = "UNQX User";
        takenOwnerPhoto.src = "/brand/logo.PNG";
        takenOwnerView.href = `/${slug}`;
        return;
      }

      const ownerName = String(owner.name || "").trim() || "UNQX User";
      const ownerPhoto = String(owner.avatarUrl || owner.photoUrl || "").trim() || "/brand/logo.PNG";
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
      syncHeroOfficialNotice("");
      return;
    }

    if (state === "invalid") {
      statusIcon.innerHTML = ICON_BAD;
      statusText.textContent = "Формат UNQ должен быть AAA001";
      statusNote.textContent = "Используйте 3 латинские буквы и 3 цифры.";
      renderSuggestions([]);
      setTakenOwner(null);
      setPrimaryAction({ visible: false });
      syncHeroOfficialNotice("");
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
      syncHeroOfficialNotice(slug);
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
      syncHeroOfficialNotice(slug);
      return;
    }

    if (state === "pending") {
      statusIcon.innerHTML = ICON_INFO;
      statusText.textContent = `${slug} на рассмотрении - скоро освободится`;
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
      syncHeroOfficialNotice(slug);
      return;
    }

    statusIcon.innerHTML = ICON_BAD;
    statusText.textContent = "Не удалось проверить UNQ";
    statusNote.textContent = "Повторите попытку через несколько секунд.";
    renderSuggestions([]);
    setTakenOwner(null);
    setPrimaryAction({ visible: false });
    syncHeroOfficialNotice("");
  }

  async function verifySlug() {
    const slug = normalizeStrictSlug(slugInput.value);
    slugInput.value = slug;

    if (!slug) {
      feedback.classList.add("hidden");
      syncHeroOfficialNotice("");
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

}

function initSlugCalculator(orderApi) {
  const lettersInput = document.getElementById("calc-letters");
  const digitsInput = document.getElementById("calc-digits");
  const generateButton = document.getElementById("calc-generate-button");
  const preview = document.getElementById("calc-preview");
  const emptyState = document.getElementById("calc-empty-state");
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
  const calcOfficialNotice = document.getElementById("calc-official-notice");

  if (
    !(lettersInput instanceof HTMLInputElement) ||
    !(digitsInput instanceof HTMLInputElement) ||
    !(preview instanceof HTMLElement) ||
    !(emptyState instanceof HTMLElement) ||
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
  let isApplyingDefaultSlug = false;
  let isGeneratingSlug = false;
  const unavailableSlugCache = new Set();

  function updatePreview(letters, digits) {
    preview.textContent = `unqx.uz/${letters || "___"}${digits || "___"}`;
  }

  function showEmptyState() {
    emptyState.classList.remove("hidden");
    resultWrap.classList.add("hidden");
    if (calcOfficialNotice instanceof HTMLElement) {
      calcOfficialNotice.innerHTML = "";
      calcOfficialNotice.classList.add("hidden");
    }
  }

  function showResultState() {
    emptyState.classList.add("hidden");
    resultWrap.classList.remove("hidden");
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
      return {
        total,
        flash,
        source: String(payload?.source || "calculator"),
        calculation: payload?.calculation && typeof payload.calculation === "object" ? payload.calculation : null,
      };
    } catch {
      return { total: fallbackTotal, flash: null, source: "calculator", calculation: null };
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

  async function isSlugAvailable(slug) {
    if (unavailableSlugCache.has(slug)) {
      return false;
    }
    try {
      const response = await fetch(`/api/cards/availability?slug=${encodeURIComponent(slug)}&source=calculator_generate`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return false;
      }
      const payload = await response.json().catch(() => ({}));
      const available = payload?.available === true;
      if (!available) {
        unavailableSlugCache.add(slug);
      }
      return available;
    } catch {
      return false;
    }
  }

  async function getBulkAvailability(slugs) {
    const normalized = Array.from(
      new Set(
        (Array.isArray(slugs) ? slugs : [])
          .map((slug) => normalizeStrictSlug(slug))
          .filter((slug) => /^[A-Z]{3}[0-9]{3}$/.test(slug)),
      ),
    ).slice(0, 60);

    if (normalized.length === 0) {
      return new Map();
    }

    const params = new URLSearchParams({
      slugs: normalized.join(","),
      source: "calculator_generate",
    });

    try {
      const response = await fetch(`/api/cards/availability-bulk?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return new Map();
      }
      const payload = await response.json().catch(() => ({}));
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const out = new Map();
      items.forEach((item) => {
        const slug = normalizeStrictSlug(item?.slug || "");
        if (!slug) return;
        const available = item?.available === true;
        out.set(slug, available);
        if (!available) {
          unavailableSlugCache.add(slug);
        }
      });
      return out;
    } catch {
      return new Map();
    }
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)] || "";
  }

  function buildRandomLetters() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const mode = randomFrom(["random", "random", "random", "sequential", "palindrome"]);
    if (mode === "sequential") {
      const startIndex = Math.floor(Math.random() * 24);
      return `${alphabet[startIndex]}${alphabet[startIndex + 1]}${alphabet[startIndex + 2]}`;
    }
    if (mode === "palindrome") {
      const a = randomFrom(alphabet);
      const b = randomFrom(alphabet.filter((char) => char !== a));
      return `${a}${b}${a}`;
    }
    return `${randomFrom(alphabet)}${randomFrom(alphabet)}${randomFrom(alphabet)}`;
  }

  function buildRandomDigits() {
    const mode = randomFrom(["random", "random", "palindrome", "round", "sequential"]);
    if (mode === "round") {
      const first = Math.floor(Math.random() * 9) + 1;
      return `${first}00`;
    }
    if (mode === "sequential") {
      const start = Math.floor(Math.random() * 8);
      return `${start}${start + 1}${start + 2}`;
    }
    if (mode === "palindrome") {
      const a = Math.floor(Math.random() * 10);
      const b = Math.floor(Math.random() * 10);
      return `${a}${b}${a}`;
    }
    return `${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
  }

  function buildAffordableCandidates() {
    const basePrice = Number(slugPricingConfig?.basePrice || DEFAULT_HOME_SLUG_PRICING.basePrice);
    const minTotal = Math.max(1, Math.round(basePrice));
    const maxTotal = Math.max(minTotal, Math.round(basePrice * 8));
    const candidates = [];
    const seen = new Set();
    const attempts = 280;

    for (let i = 0; i < attempts; i += 1) {
      const letters = buildRandomLetters();
      const digits = buildRandomDigits();
      const pricing = calculateSlugPricing(letters, digits);
      if (!pricing) {
        continue;
      }
      if (pricing.total < minTotal || pricing.total > maxTotal) {
        continue;
      }
      if (seen.has(pricing.slug)) {
        continue;
      }
      seen.add(pricing.slug);
      candidates.push({ slug: pricing.slug, total: Number(pricing.total || 0) });
      if (candidates.length >= 160) {
        break;
      }
    }

    return candidates
      .sort((left, right) => {
        if (left.total !== right.total) {
          return left.total - right.total;
        }
        return left.slug.localeCompare(right.slug);
      })
      .map((item) => item.slug);
  }

  async function findFirstAvailableCandidate(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return "";
    }

    const maxChecks = 24;
    const batchSize = 24;
    const shortlist = candidates.slice(0, maxChecks);

    for (let offset = 0; offset < shortlist.length; offset += batchSize) {
      const chunk = shortlist.slice(offset, offset + batchSize);
      // Server-side bulk availability significantly reduces round-trips.
      // eslint-disable-next-line no-await-in-loop
      const bulkMap = await getBulkAvailability(chunk);
      if (bulkMap.size > 0) {
        for (const slug of chunk) {
          if (bulkMap.get(slug) === true) {
            return slug;
          }
        }
        continue;
      }
      // Fallback to direct checks if bulk endpoint is temporarily unavailable.
      // eslint-disable-next-line no-await-in-loop
      const checks = await Promise.all(chunk.map((slug) => isSlugAvailable(slug)));
      const foundIndex = checks.findIndex((isFree) => isFree === true);
      if (foundIndex !== -1) {
        return chunk[foundIndex] || "";
      }
    }
    return "";
  }

  async function requestServerGeneratedSlug() {
    try {
      const response = await fetch("/api/cards/slug-generate-affordable?source=calculator_generate", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return "";
      }
      const payload = await response.json().catch(() => ({}));
      const slug = normalizeStrictSlug(payload?.slug || "");
      if (!payload?.ok || !/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
        return "";
      }
      return slug;
    } catch {
      return "";
    }
  }

  async function handleGenerateSlug() {
    if (isGeneratingSlug) {
      return;
    }
    isGeneratingSlug = true;
    if (generateButton instanceof HTMLButtonElement) {
      generateButton.disabled = true;
    }
    const icon = generateButton instanceof HTMLElement ? generateButton.querySelector("svg") : null;
    if (icon instanceof SVGElement) {
      icon.classList.add("animate-spin");
    }

    try {
      let slug = await requestServerGeneratedSlug();
      if (!slug) {
        const candidates = buildAffordableCandidates();
        slug = await findFirstAvailableCandidate(candidates);
      }
      if (slug) {
        const parsed = splitSlug(slug);
        if (parsed) {
          lettersInput.value = parsed.letters;
          digitsInput.value = parsed.digits;
          void updateResult();
          return;
        }
      }
    } finally {
      isGeneratingSlug = false;
      if (icon instanceof SVGElement) {
        icon.classList.remove("animate-spin");
      }
      if (generateButton instanceof HTMLButtonElement) {
        generateButton.disabled = false;
      }
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
      if (!isApplyingDefaultSlug && !lettersInput.value && !digitsInput.value) {
        isApplyingDefaultSlug = true;
        lettersInput.value = "AAA";
        digitsInput.value = "000";
        await updateResult();
        isApplyingDefaultSlug = false;
        return;
      }
      showEmptyState();
      return;
    }

    if (!hasRevealed) {
      hasRevealed = true;
      resultWrap.classList.add("animate-fade-up");
    }
    showResultState();

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
    } else if (serverPricing.source === "override") {
      animateNumberText(resultPrice, lastAnimatedPrice, finalPrice);
      resultFormula.textContent = `Персональная цена: ${formatPrice(finalPrice)} сум`;
    } else {
      animateNumberText(resultPrice, lastAnimatedPrice, finalPrice);
      const calc = serverPricing.calculation;
      const base = Number(calc?.basePrice || slugPricingConfig.basePrice || DEFAULT_HOME_SLUG_PRICING.basePrice);
      const lettersMultiplier = Number(calc?.lettersMultiplier || pricing.letterData.multiplier || 1);
      const digitsMultiplier = Number(calc?.digitsMultiplier || pricing.digitData.multiplier || 1);
      const customParts = Array.isArray(calc?.customBreakdown)
        ? calc.customBreakdown
          .map((item) => {
            const delta = Number(item?.delta || 0);
            if (!delta) return "";
            const sign = delta > 0 ? "+" : "-";
            const amount = formatPrice(Math.abs(delta));
            const label = String(item?.label || "").trim();
            return `${sign} ${amount}${label ? ` (${label})` : ""}`;
          })
          .filter(Boolean)
          .join(" ")
        : "";
      const tail = customParts ? ` ${customParts}` : "";
      resultFormula.textContent = `${formatPrice(base)} x ${lettersMultiplier} x ${digitsMultiplier}${tail} = ${formatPrice(finalPrice)} сум`;
    }
    lastAnimatedPrice = finalPrice;
    letterMeta.textContent = `${pricing.letterData.label} x${pricing.letterData.multiplier}`;
    digitMeta.textContent = `${pricing.digitData.label} x${pricing.digitData.multiplier}`;
    reserveLink.href = "#";
    reserveLink.setAttribute("data-order-prefill", pricing.slug);
    reserveLink.innerHTML = `Занять ${pricing.slug}${RESERVE_ICON}`;
    renderSimilarAvailable(similarSuggestions);

    if (calcOfficialNotice instanceof HTMLElement) {
      const api = window.UNQOfficialLetters;
      if (
        api &&
        typeof api.isOfficialSlug === "function" &&
        typeof api.renderPurchaseNoticeHtml === "function" &&
        api.isOfficialSlug(pricing.slug)
      ) {
        calcOfficialNotice.innerHTML = api.renderPurchaseNoticeHtml();
        calcOfficialNotice.classList.remove("hidden");
      } else {
        calcOfficialNotice.innerHTML = "";
        calcOfficialNotice.classList.add("hidden");
      }
    }
  }

  lettersInput.addEventListener("input", () => {
    updateResult();
  });

  digitsInput.addEventListener("input", () => {
    updateResult();
  });

  if (generateButton instanceof HTMLButtonElement) {
    generateButton.addEventListener("click", () => {
      void handleGenerateSlug();
    });
  }

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

  const params = new URLSearchParams(window.location.search);
  const slugFromQuery = normalizeStrictSlug(params.get("calcSlug") || params.get("buySlug") || "");
  if (slugFromQuery && /^[A-Z]{3}[0-9]{3}$/.test(slugFromQuery)) {
    const parsed = splitSlug(slugFromQuery);
    if (parsed) {
      lettersInput.value = parsed.letters;
      digitsInput.value = parsed.digits;
      void updateResult();
      const heroInput = document.getElementById("home-slug-input");
      if (heroInput instanceof HTMLInputElement) {
        heroInput.value = slugFromQuery;
      }
    }
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("calcSlug");
    nextUrl.searchParams.delete("buySlug");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  } else {
    lettersInput.value = "AAA";
    digitsInput.value = "000";
    void updateResult();
  }
}

function initNextDropOneClick() {
  const cta = document.querySelector("[data-next-drop-waitlist]");
  const card = document.querySelector("[data-next-drop-card]");
  const heroInput = document.getElementById("home-slug-input");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const telegramBotUsername = String(document.body?.getAttribute("data-telegram-bot-username") || "")
    .replace(/^@+/, "")
    .trim();

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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = String(payload.code || "").toUpperCase();
        if (code === "TELEGRAM_NOT_LINKED") {
          if (telegramBotUsername) {
            window.open(`https://t.me/${encodeURIComponent(telegramBotUsername)}?start=notify`, "_blank", "noopener,noreferrer");
            showToast("Подключи Telegram-бота и повтори подписку.", "info");
          } else {
            showToast("Подключи Telegram в профиле, затем повтори подписку.", "error");
          }
          cta.disabled = false;
          cta.textContent = previous;
          return;
        }
        if (code === "DROP_ALREADY_LIVE") {
          showToast("Дроп уже стартовал. Перейди в раздел релизов и выбери UNQ.", "info");
          cta.disabled = false;
          cta.textContent = previous;
          return;
        }
        if (code === "DROP_CLOSED") {
          showToast("Этот дроп уже завершён.", "error");
          cta.disabled = false;
          cta.textContent = previous;
          return;
        }
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
