(function () {
  let s = {};
  let csrf = null;
  (function () {
    const root = document.body;
    if (!root || root.getAttribute("data-page") !== "profile-page") return;
    const reactivationWindowDays = Math.max(1, Number(root.getAttribute("data-reactivation-window-days") || 30));

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const esc = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const toDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const fd = (value) => {
      const date = toDate(value);
      return date ? date.toLocaleDateString("ru-RU") : "—";
    };
    const fdt = (value) => {
      const date = toDate(value);
      return date ? date.toLocaleString("ru-RU") : "—";
    };
    const fp = (value) => `${Number(value || 0).toLocaleString("ru-RU")} сум`;
    const parseMoneyInput = (value) => {
      const digits = String(value || "").replace(/[^\d]/g, "");
      return digits ? Number(digits) : 0;
    };
    const formatMoneyInput = (value) => {
      const amount = parseMoneyInput(value);
      return amount > 0 ? amount.toLocaleString("ru-RU") : "";
    };
    const cssEscape = (value) =>
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(String(value || ""))
        : String(value || "").replace(/["\\]/g, "\\$&");
    const fh = (value) => {
      const date = toDate(value);
      return date
        ? date.toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        : "—";
    };
    const fht = (value) => {
      const date = toDate(value);
      if (!date) return "—";
      const formatter = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Tashkent",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const parts = Object.create(null);
      for (const part of formatter.formatToParts(date)) {
        if (part.type !== "literal") {
          parts[part.type] = part.value;
        }
      }
      return `${parts.hour || "00"}:${parts.minute || "00"} ${parts.day || "00"}.${parts.month || "00"}.${parts.year || "0000"}`;
    };
    const copyWithFallback = (value) => {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    };
    const copyText = async (value) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch {
        return copyWithFallback(value);
      }
      return copyWithFallback(value);
    };
    const PROFILE_THEMES = [
      "default_dark",
      "arctic",
      "linen",
      "marble",
      "forest",
      "sage_luxe",
      "midnight_obsidian",
      "golden_noir",
      "aurora_codex",
      "nebula_glass",
      "galaxy",
      "volt_sport",
      "minion_yellow",
      "soviet_carpet",
      "vintage_mickey",
      "velours",
      "graffiti_neon",
      "heritage_crest",
      "ivory_tennis",
      "grand_slam_clay",
      "racing_green",
      "polo_navy",
      "alpine_ski",
      "boxing_legend",
      "basketball_court",
      "football_pitch",
      "olympic_gold",
      "anime_blush",
      "cheetah_spots",
      "serpent_scale",
      "color_red",
      "color_orange",
      "color_yellow",
      "color_green",
      "color_teal",
      "color_blue",
      "color_purple",
      "color_pink",
    ];
    const PROFILE_AVATAR_FRAMES = [
      "none",
      "chrome_ring",
      "neon_spray",
      "sticker_bubble",
      "chain_link",
      "pixel_glow",
      "starburst",
      "drip_outline",
      "tape_collage",
      "orbit_dots",
      "laurel_wreath",
      "trophy_gold",
      "tennis_lines",
      "racing_stripes",
      "varsity_patch",
      "boxing_rope",
      "basketball_arc",
      "football_stitch",
      "stopwatch_ring",
      "medal_ribbon",
    ];
    try {
      const presetNode = document.getElementById("profile-style-presets-data");
      const presetPayload = presetNode instanceof HTMLScriptElement ? JSON.parse(presetNode.textContent || "{}") : {};
      if (Array.isArray(presetPayload.themes)) {
        presetPayload.themes.forEach((theme) => {
          const key = String(theme || "").trim();
          if (key && !PROFILE_THEMES.includes(key)) PROFILE_THEMES.push(key);
        });
      }
      if (Array.isArray(presetPayload.frames)) {
        presetPayload.frames.forEach((frame) => {
          const key = String(frame || "").trim();
          if (key && !PROFILE_AVATAR_FRAMES.includes(key)) PROFILE_AVATAR_FRAMES.push(key);
        });
      }
    } catch {
      // Keep static presets if server preset payload is unavailable.
    }
    const PROFILE_EMOJI_BACKGROUND_PACKS = [
      "none",
      "ghosts",
      "stars",
      "lightning",
      "crowns",
      "webs",
      "hearts",
    ];
    const PET_TYPES = ["kitten", "puppy", "snake"];
    const PET_TYPE_LABELS = {
      kitten: "Коала",
      puppy: "Котик",
      snake: "Леопард",
    };
    const PET_ASSET_URLS = {
      kitten: "/assets/pets/pet1.png",
      puppy: "/assets/pets/pet2.png",
      snake: "/assets/pets/pet3.png",
    };
    const PREMIUM_ONLY_THEMES = new Set(PROFILE_THEMES.filter((theme) => theme !== "default_dark"));
    const PREMIUM_ONLY_AVATAR_FRAMES = new Set(PROFILE_AVATAR_FRAMES.filter((frame) => frame !== "none"));
    const PREMIUM_ONLY_EMOJI_BACKGROUND_PACKS = new Set(
      PROFILE_EMOJI_BACKGROUND_PACKS.filter((pack) => pack !== "none"),
    );
    const TELEGRAM_PAYMENT_USERNAME = String(root.getAttribute("data-telegram-bot-username") || "")
      .replace(/^@+/, "")
      .trim();
    const DEFAULT_PROFILE_AVATAR = "/brand/profile-thin.svg";
    const PREMIUM_REQUIRED_TITLE = "Нужен Премиум";
    const PREMIUM_CTA_LABEL = "Подключить Премиум →";
    const PREMIUM_UPSELL_NOTE = "Подключить Премиум · $2/мес";
    const PREMIUM_ACTIVATION_TITLE = "Сначала подключите Премиум";
    const PREMIUM_ACTIVATION_TEXT = "Чтобы зарезервировать UNQ и опубликовать визитку, подключите Премиум.";
    const SUBSCRIPTION_ACTIVE_LABEL = "Подписка активна";
    const SUBSCRIPTION_INACTIVE_LABEL = "Подписка неактивна";
    const SUBSCRIPTION_RENEWAL_ORDER_KIND = "subscription_renewal";
    const WALL_POST_CONTENT_MAX = 280;
    const WALL_COMMENT_CONTENT_MAX = 1000;
    const WALL_VISIBLE_COMMENT_COUNT = 5;
    const WALL_POST_PAGE_SIZE = 20;
    const COMMUNITY_PAGE_SIZE = 20;
    const LOGIN_MIN_LENGTH = 3;
    const LOGIN_MAX_LENGTH = 190;
    const LOGIN_REGEX = /^[a-z0-9._@+-]+$/;
    const PROFILE_LOGIN_INVALID_MESSAGE = "Логин может содержать только латиницу, цифры и символы . _ -";
    const PROFILE_LOGIN_EMPTY_MESSAGE = "Можно задать новый логин или оставить текущий.";
    const PROFILE_LOGIN_CHECKING_MESSAGE = "Проверяем логин...";
    const PROFILE_LOGIN_AVAILABLE_MESSAGE = "Логин свободен.";
    const PROFILE_LOGIN_CHECK_FAILED_MESSAGE = "Не удалось проверить логин. Попробуй еще раз.";
    const PROFILE_LOGIN_CURRENT_MESSAGE = "Это твой текущий логин.";
    const PROFILE_LOGIN_REQUIRED_MESSAGE = "Логин не может быть пустым.";

    const avatarSrc = (url) => {
      const base = String(url || "").trim() || DEFAULT_PROFILE_AVATAR;
      const version = Number(s.avatarVersion || 0);
      if (!version || base === DEFAULT_PROFILE_AVATAR) return base;
      const joiner = base.includes("?") ? "&" : "?";
      return `${base}${joiner}v=${version}`;
    };


    const LEGACY_DRAFT_KEY = "unqx_profile_card_draft";

    const getDraftOwnerKey = () => {
      if (s.user?.id) return `id:${s.user.id}`;
      if (s.user?.login) return `l:${s.user.login}`;
      if (s.user?.username) return `u:${s.user.username}`;
      if (s.user?.email) return `e:${s.user.email}`;
      return "";
    };

    const getDraftStorageKey = () => {
      const ownerKey = getDraftOwnerKey();
      return ownerKey ? `${LEGACY_DRAFT_KEY}:${ownerKey}` : LEGACY_DRAFT_KEY;
    };

    const hasPublicProfileAccess = () =>
      Boolean(
        s.user?.hasPublicProfile ||
        s.user?.publicHandle?.value ||
        (Array.isArray(s.slugs) && s.slugs.length > 0),
      );

    const clearLegacyDraftStorage = () => {
      try {
        const key = getDraftStorageKey();
        localStorage.removeItem(key);
        if (key !== LEGACY_DRAFT_KEY) {
          localStorage.removeItem(LEGACY_DRAFT_KEY);
        }
      } catch {
        // Ignore storage access issues; drafts are no longer persisted.
      }
    };

    const normalizeCardTagsState = (tags) =>
      Array.isArray(tags)
        ? tags.map((tag) => String(tag || "").trim()).filter(Boolean)
        : [];

    const normalizeTrackId = (value) => {
      const id = Math.trunc(Number(value || 0));
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    };

    const normalizeTracks = (items) =>
      (Array.isArray(items) ? items : [])
        .map((item) => ({
          id: normalizeTrackId(item?.id),
          title: String(item?.title || "").trim(),
          audioUrl: String(item?.audioUrl || item?.audio_url || "").trim(),
        }))
        .filter((item) => item.id && item.title && item.audioUrl);

    const normalizePetLibrary = (items) =>
      (Array.isArray(items) ? items : [])
        .map((item) => ({
          id: normalizeTrackId(item?.id),
          name: String(item?.name || "").trim(),
          imageUrl: String(item?.imageUrl || item?.image_url || "").trim(),
          isActive: item?.isActive !== false && item?.is_active !== false,
        }))
        .filter((item) => item.id && item.name && item.imageUrl);

    const normalizeCardButtonState = (button) => {
      const type = String(button?.type || "other")
        .trim()
        .toLowerCase() || "other";
      const label = typeof button?.label === "string" ? button.label : "";
      const url =
        typeof button?.url === "string" && button.url.length > 0
          ? button.url
          : typeof button?.href === "string" && button.href.length > 0
            ? button.href
            : typeof button?.value === "string"
              ? button.value
              : "";

      return { type, label, url };
    };

    const normalizeEditorButtons = (buttons) =>
      Array.isArray(buttons)
        ? buttons.map((button) => {
          const normalized = normalizeCardButtonState(button);
          return {
            ...button,
            type: normalized.type,
            label: normalized.label,
            href: normalized.url,
            value: normalized.url,
            url: normalized.url,
          };
        })
        : [];

    const normalizeOwnedPet = (pet) => {
      const petType = String(pet?.petType || "").trim().toLowerCase();
      if (!PET_TYPES.includes(petType)) return null;
      return {
        id: String(pet?.id || "").trim(),
        petType,
        label: String(pet?.label || PET_TYPE_LABELS[petType] || petType).trim(),
        assetUrl: String(pet?.assetUrl || PET_ASSET_URLS[petType]).trim(),
        displayName: String(pet?.displayName || PET_TYPE_LABELS[petType] || "").trim(),
        priceSnapshot: Number.isFinite(Number(pet?.priceSnapshot)) ? Number(pet.priceSnapshot) : 0,
        isVisible: typeof pet?.isVisible === "boolean" ? pet.isVisible : true,
        createdAt: pet?.createdAt || null,
      };
    };

    const normalizeOwnedPets = (pets) =>
      (Array.isArray(pets) ? pets : [])
        .map(normalizeOwnedPet)
        .filter(Boolean)
        .sort((left, right) => {
          const timeA = new Date(left.createdAt || 0).getTime();
          const timeB = new Date(right.createdAt || 0).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return String(left.id || "").localeCompare(String(right.id || ""));
        });

    const normalizePetCatalog = (items) =>
      (Array.isArray(items) ? items : [])
        .map((item) => {
          const petType = String(item?.petType || item?.id || "").trim().toLowerCase();
          if (!PET_TYPES.includes(petType)) return null;
          return {
            petType,
            label: String(item?.label || PET_TYPE_LABELS[petType] || petType).trim(),
            description: String(item?.description || "").trim(),
            assetUrl: String(item?.assetUrl || PET_ASSET_URLS[petType]).trim(),
            price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
          };
        })
        .filter(Boolean);

    const normalizePetDraftMap = (drafts) => {
      const next = {};
      PET_TYPES.forEach((petType) => {
        const value = drafts && typeof drafts === "object" ? drafts[petType] : "";
        next[petType] = String(value || "").trim().slice(0, 120);
      });
      return next;
    };

    const buildPetDraftMap = ({ catalog = [], pets = [], requests = [], previous = {} } = {}) => {
      const next = normalizePetDraftMap(previous);
      const ownedByType = new Map((Array.isArray(pets) ? pets : []).map((pet) => [pet.petType, pet]));
      const pendingByType = new Map(
        (Array.isArray(requests) ? requests : [])
          .filter((item) => item?.type === "pet" && String(item?.status || "").toLowerCase() === "pending")
          .map((item) => [String(item.petType || "").trim().toLowerCase(), item]),
      );
      (Array.isArray(catalog) ? catalog : []).forEach((item) => {
        const petType = String(item?.petType || "").trim().toLowerCase();
        if (!PET_TYPES.includes(petType)) return;
        if (ownedByType.has(petType)) {
          next[petType] = String(ownedByType.get(petType)?.displayName || "").trim();
          return;
        }
        if (pendingByType.has(petType)) {
          next[petType] = String(pendingByType.get(petType)?.displayName || "").trim();
          return;
        }
        if (!next[petType]) {
          next[petType] = "";
        }
      });
      return next;
    };

    const toComparableButtonStateList = (buttons) =>
      normalizeEditorButtons(buttons).map(({ type, label, url }) => ({ type, label, url }));

    const toComparablePetStateList = (pets) =>
      normalizeOwnedPets(pets).map((pet) => ({
        id: pet.id,
        petType: pet.petType,
        displayName: pet.displayName,
        isVisible: pet.isVisible,
      }));

    const resolveEditableTheme = (theme) => {
      const normalizedTheme = PROFILE_THEMES.includes(theme) ? theme : "default_dark";
      return getCurrentPlan() === "premium" || !PREMIUM_ONLY_THEMES.has(normalizedTheme)
        ? normalizedTheme
        : "default_dark";
    };

    const resolveEditableAvatarFrame = (frame) => {
      const normalizedFrame = String(frame || "").trim().toLowerCase();
      const safeFrame = PROFILE_AVATAR_FRAMES.includes(normalizedFrame) ? normalizedFrame : "none";
      return getCurrentPlan() === "premium" || !PREMIUM_ONLY_AVATAR_FRAMES.has(safeFrame)
        ? safeFrame
        : "none";
    };

    const resolveEditableEmojiBackgroundPack = (pack) => {
      const normalizedPack = String(pack || "").trim().toLowerCase();
      const safePack = PROFILE_EMOJI_BACKGROUND_PACKS.includes(normalizedPack) ? normalizedPack : "none";
      return getCurrentPlan() === "premium" || !PREMIUM_ONLY_EMOJI_BACKGROUND_PACKS.has(safePack)
        ? safePack
        : "none";
    };

    const getSavedCardDraftState = () => {
      if (!s.user || getCurrentPlan() === "none") return null;
      const card = s.card || {};
      return {
        name: String(card.name || s.user?.displayName || s.user?.firstName || ""),
        bio: String(card.bio || ""),
        hashtag: String(card.hashtag || ""),
        address: String(card.address || ""),
        postcode: String(card.postcode || ""),
        email: String(card.email || ""),
        extraPhone: String(card.extraPhone || ""),
        tags: normalizeCardTagsState(card.tags),
        buttons: toComparableButtonStateList(card.buttons),
        pets: toComparablePetStateList(card.pets || s.pets),
        theme: resolveEditableTheme(card.theme),
        avatarFrame: resolveEditableAvatarFrame(card.avatarFrame),
        emojiBackgroundPack: resolveEditableEmojiBackgroundPack(card.emojiBackgroundPack),
        selectedTrackId: getCurrentPlan() === "premium" ? normalizeTrackId(card.selectedTrackId) : null,
        selectedPetId: getCurrentPlan() === "premium" ? normalizeTrackId(card.selectedPetId) : null,
        showBranding: card.showBranding !== false,
      };
    };

    const getCurrentCardDraftState = () => {
      if (!(el.cName instanceof HTMLInputElement) || getCurrentPlan() === "none") return null;
      return {
        name: String(el.cName?.value || ""),
        bio: String(el.cBio?.value || ""),
        hashtag: String(el.cHashtag?.value || ""),
        address: String(el.cAddress?.value || ""),
        postcode: String(el.cPostcode?.value || ""),
        email: String(el.cEmail?.value || ""),
        extraPhone: String(el.cExtraPhone?.value || ""),
        tags: normalizeCardTagsState(s.tags),
        buttons: toComparableButtonStateList(s.buttons),
        pets: toComparablePetStateList(s.pets),
        theme: resolveEditableTheme(s.theme),
        avatarFrame: resolveEditableAvatarFrame(s.avatarFrame),
        emojiBackgroundPack: resolveEditableEmojiBackgroundPack(s.emojiBackgroundPack),
        selectedTrackId: getCurrentPlan() === "premium" ? normalizeTrackId(s.selectedTrackId) : null,
        selectedPetId: getCurrentPlan() === "premium" ? normalizeTrackId(s.selectedPetId) : null,
        showBranding: el.cBranding ? !el.cBranding.checked : true,
      };
    };

    const syncCardDraftState = () => {
      const savedState = getSavedCardDraftState();
      const currentState = getCurrentCardDraftState();
      const dirty =
        Boolean(savedState && currentState) &&
        JSON.stringify(savedState) !== JSON.stringify(currentState);
      s.cardDraftDirty = dirty;
      return dirty;
    };

    function saveDraft() {
      syncCardDraftState();
    }

    function clearDraft() {
      s.cardDraftDirty = false;
      clearLegacyDraftStorage();
    }

    function hasPendingDraft() {
      return syncCardDraftState();
    }

    function restoreDraft() {
      clearLegacyDraftStorage();
      syncCardDraftState();
    }
    let scoreChart = null;
    let analyticsCharts = {};
    let modalLastFocused = null;
    let modalIsOpen = false;
    let modalConfirmHandler = null;
    let wallComposerModalLastFocused = null;
    let wallComposerModalOpen = false;
    let saveAlertTimer = null;
    let profileRefreshTimer = null;
    let profileRefreshInFlight = false;
    let emailModalLastFocused = null;
    let emailModalOpen = false;
    let emailModalStep = "request";
    let emailRequiredModalShown = false;
    let passwordModalLastFocused = null;
    let passwordModalOpen = false;
    let privatePasswordAddModalLastFocused = null;
    let privatePasswordAddModalOpen = false;
    let privatePasswordChangeModalLastFocused = null;
    let privatePasswordChangeModalOpen = false;
    let privatePasswordChangeId = "";
    let settingsLoginDraft = "";
    let settingsLoginCheckTimer = null;
    let settingsLoginRequestId = 0;
    let settingsLoginAvailability = {
      state: "idle",
      login: "",
      message: "",
    };
    const PROFILE_SAVE_SUCCESS_MESSAGE = "Изменения сохранены";

    const toOrderPaymentReference = (orderId) => `UNQX-${String(orderId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;

    const planLabel = (value) => {
      const plan = String(value || "").toLowerCase();
      return plan === "premium" || plan === "basic" ? "Премиум" : "Без тарифа";
    };

    const formatTelegramPremiumUsdLabel = () => "$2";

    const shouldUseTelegramPremiumUsdLabel = (requestedPlan, planPrice) =>
      String(requestedPlan || "").toLowerCase() === "premium" && Number(planPrice || 0) > 0;

    const formatTelegramPlanPriceLabel = (requestedPlan, planPrice) =>
      shouldUseTelegramPremiumUsdLabel(requestedPlan, planPrice)
        ? formatTelegramPremiumUsdLabel()
        : `${Number(planPrice || 0).toLocaleString("ru-RU")} сум`;

    const formatTelegramTotalPriceLabel = ({ requestedPlan, slugPrice = 0, planPrice = 0, total = 0 }) =>
      shouldUseTelegramPremiumUsdLabel(requestedPlan, planPrice) &&
        Number(slugPrice || 0) <= 0
        ? formatTelegramPremiumUsdLabel()
        : `${Number(total || 0).toLocaleString("ru-RU")} сум`;

    const buildTelegramPaymentUrl = (requestItem) => {
      const serverUrl = String(requestItem?.paymentUrl || "").trim();
      if (/^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(serverUrl)) {
        return serverUrl;
      }
      const orderCode = toOrderPaymentReference(requestItem?.id);
      const slug = String(requestItem?.slug || "").toUpperCase();
      const slugPrice = Number(requestItem?.slugPrice || 0);
      const planPrice = Number(requestItem?.planPrice || 0);
      const total = Number(requestItem?.totalOneTime || slugPrice + planPrice);
      const userName = String(s.user?.displayName || s.user?.firstName || "").trim() || "не указано";
      const userEmail = String(s.user?.email || "").trim() || "не указан";
      const planPriceLabel = formatTelegramPlanPriceLabel(requestItem?.requestedPlan, planPrice);
      const totalPriceLabel = formatTelegramTotalPriceLabel({
        requestedPlan: requestItem?.requestedPlan,
        slugPrice,
        planPrice,
        total,
      });
      const message = `Здравствуйте! Хочу оплатить заказ #?? ${orderCode}\n\nUNQ: ${slug}\nФИО: ${userName}\nEmail: ${userEmail}\n\n?? Детализация оплаты:\n• UNQ ${slug}: ${Number(slugPrice).toLocaleString("ru-RU")} сум\n• Тариф ${planLabel(requestItem?.requestedPlan)}: ${planPriceLabel}\n\nИтого к оплате: ${totalPriceLabel}`;
      return `https://t.me/${TELEGRAM_PAYMENT_USERNAME}?text=${encodeURIComponent(message)}`;
    };

    const openTelegramUrl = (url) => {
      const fallbackUrl = `https://t.me/${TELEGRAM_PAYMENT_USERNAME}`;
      const telegramUrl = /^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(url || "") ? url : fallbackUrl;
      const [baseUrl, query = ""] = telegramUrl.split("?");
      const username = String(baseUrl.replace(/^https:\/\/t\.me\//i, "")).trim() || TELEGRAM_PAYMENT_USERNAME;
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
    };

    const buildPendingPaymentUrl = (order) => {
      const serverUrl = String(order?.paymentUrl || "").trim();
      if (/^https:\/\/t\.me\/[a-zA-Z0-9_]{4,}(?:\?|$)/i.test(serverUrl)) {
        return serverUrl;
      }
      const reference = String(order?.paymentReference || "").trim() || toOrderPaymentReference(order?.id);
      const slug = String(order?.slug || "").trim().toUpperCase();
      const slugPrice = Number(order?.slugPrice || 0);
      const planPrice = Number(order?.planPrice || 0);
      const total = Number(order?.totalOneTime || slugPrice + planPrice);
      const userName = String(s.user?.displayName || s.user?.firstName || "").trim() || "не указано";
      const userEmail = String(s.user?.email || "").trim() || "не указан";
      const planPriceLabel = formatTelegramPlanPriceLabel(order?.requestedPlan, planPrice);
      const totalPriceLabel = formatTelegramTotalPriceLabel({
        requestedPlan: order?.requestedPlan,
        slugPrice,
        planPrice,
        total,
      });
      const message = `Здравствуйте! Хочу оплатить заказ #?? ${reference}

UNQ: ${slug}
ФИО: ${userName}
Email: ${userEmail}

?? Детализация оплаты:
• UNQ ${slug}: ${Number(slugPrice).toLocaleString("ru-RU")} сум
• Тариф ${planLabel(order?.requestedPlan)}: ${planPriceLabel}

Итого к оплате: ${totalPriceLabel}`;
      return `https://t.me/${TELEGRAM_PAYMENT_USERNAME}?text=${encodeURIComponent(message)}`;
    };

    const buttonTypeLabels = {
      phone: "Позвонить",
      telegram: "Telegram",
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      website: "Сайт",
      card: "Карта",
      whatsapp: "WhatsApp",
      other: "Другое",
    };

    const buttonTypeOptions = Object.entries(buttonTypeLabels);

    const el = {
      tabs: $$(".profile-tab-btn"),
      panels: $$(".profile-tab-panel"),
      communityTabUnread: $("#profile-community-tab-unread"),
      welcomeBanner: $("#profile-welcome-banner"),
      welcomeDismiss: $("#profile-welcome-dismiss"),
      upg: $("#profile-upgrade-banner"),
      av: $("#profile-sidebar-avatar"),
      nm: $("#profile-sidebar-name"),
      un: $("#profile-sidebar-username"),
      pl: $("#profile-sidebar-plan"),
      ex: $("#profile-sidebar-expiry"),
      choosePlan: $("#profile-sidebar-choose-plan"),
      hdrViews: $("#profile-header-stat-views"),
      hdrCards: $("#profile-header-stat-cards"),
      hdrCtr: $("#profile-header-stat-ctr"),

      slugs: $("#profile-slugs-list"),
      addSlug: $("#profile-add-slug-btn"),
      addSlugNote: $("#profile-add-slug-note"),
      slugsKpiViews: $("#profile-slugs-kpi-views"),
      slugsKpiUnique: $("#profile-slugs-kpi-unique"),
      slugsMiniBars: $("#profile-slugs-mini-bars"),
      slugsSourceBars: $("#profile-slugs-source-bars"),

      cAv: $("#profile-card-avatar-preview"),
      cAvFile: $("#profile-card-avatar-file"),
      cAvRemove: $("#profile-card-avatar-remove"),
      cAvCropWrap: $("#profile-card-avatar-crop-wrap"),
      cAvCropImage: $("#profile-card-avatar-crop-image"),
      cAvCropSave: $("#profile-card-avatar-crop-save"),
      cName: $("#profile-card-name"),
      cBio: $("#profile-card-bio"),
      cBioC: $("#profile-card-bio-counter"),
      cHashtag: $("#profile-card-hashtag"),
      cAddress: $("#profile-card-address"),
      cPostcode: $("#profile-card-postcode"),
      cEmail: $("#profile-card-email"),
      cExtraPhone: $("#profile-card-extra-phone"),
      cTagInput: $("#profile-card-tag-input"),
      cTagAdd: $("#profile-card-tag-add"),
      cTags: $("#profile-card-tags-list"),
      cBtns: $("#profile-card-buttons-list"),
      cBtnAdd: $("#profile-card-button-add"),
      cCategoryNav: $("#profile-card-categories"),
      cCategoryButtons: $$("[data-card-editor-category]"),
      cCategoryPanels: $$("[data-card-editor-panel]"),
      cPetsList: $("#profile-card-pets-list"),
      cThemes: $$(".profile-theme-btn"),
      cThemeLock: $("#profile-card-theme-lock-note"),
      cThemeWrap: $("#profile-card-theme-wrap"),
      cEmojiPacks: $$(".profile-emoji-pack-btn"),
      cEmojiPackLock: $("#profile-card-emoji-background-lock-note"),
      cEmojiPackWrap: $("#profile-card-emoji-background-wrap"),
      cFrames: $$(".profile-avatar-frame-btn"),
      cFrameLock: $("#profile-card-frame-lock-note"),
      cFrameWrap: $("#profile-card-frame-wrap"),
      cTrackOptions: $("#profile-card-track-options"),
      cMusicWrap: $("#profile-card-music-wrap"),
      cMusicNote: $("#profile-card-music-note"),
      cMusicCurrent: $("#profile-card-music-current"),
      cPetLibraryWrap: $("#profile-card-pet-library-wrap"),
      cPetLibraryOptions: $("#profile-card-pet-library-options"),
      cPetLibraryCurrent: $("#profile-card-pet-library-current"),
      cPetLibraryNote: $("#profile-card-pet-library-note"),
      cBranding: $("#profile-card-show-branding"),
      cSave: $("#profile-card-save"),
      cContent: $("#profile-card-content"),
      cEmpty: $("#profile-card-empty-state"),
      cPrev: $("#profile-card-live-preview"),
      cPrevLabel: $("#profile-preview-slug-label"),
      cPrevLink: $("#profile-preview-open-link"),
      wallSummary: $("#profile-wall-summary"),
      wallOpenComposer: $("#profile-wall-open-composer"),
      wallComposerModal: $("#profile-wall-composer-modal"),
      wallComposerDialog: $("#profile-wall-composer-dialog"),
      wallComposer: $("#profile-wall-composer"),
      wallComposerClose: $("#profile-wall-composer-close"),
      wallComposerCloseTop: $("#profile-wall-composer-close-top"),
      wallEditorTitle: $("#profile-wall-editor-title"),
      wallEditorNote: $("#profile-wall-editor-note"),
      wallEditor: $("#profile-wall-editor"),
      wallCommentsEnabled: $("#profile-wall-comments-enabled"),
      wallCounter: $("#profile-wall-counter"),
      wallSubmit: $("#profile-wall-submit"),
      wallCancel: $("#profile-wall-cancel"),
      wallList: $("#profile-wall-list"),
      wallLoadMore: $("#profile-wall-load-more"),
      communitySummary: $("#profile-community-summary"),
      communityFilters: $("#profile-community-filters"),
      communityList: $("#profile-community-list"),
      communityLoadMore: $("#profile-community-load-more"),
      scoreValue: $("#profile-score-value"),
      scoreTop: $("#profile-score-top"),
      scoreUpdated: $("#profile-score-updated"),
      scoreBreakdown: $("#profile-score-breakdown"),
      scoreTipsList: $("#profile-score-tips-list"),
      scoreHistoryChart: $("#profile-score-history-chart"),
      scoreHistoryLock: $("#profile-score-history-lock"),
      analyticsContent: $("#profile-analytics-content"),
      analyticsEmpty: $("#profile-analytics-empty-state"),
      analyticsSlug: $("#profile-analytics-slug"),
      analyticsPeriods: $("#profile-analytics-periods"),
      analyticsViews: $("#profile-analytics-views"),
      analyticsUnique: $("#profile-analytics-unique"),
      analyticsCtr: $("#profile-analytics-ctr"),
      analyticsViewsChart: $("#profile-analytics-views-chart"),
      analyticsSourcesChart: $("#profile-analytics-sources-chart"),
      analyticsDevicesChart: $("#profile-analytics-devices-chart"),
      analyticsButtonsChart: $("#profile-analytics-buttons-chart"),
      analyticsGeoChart: $("#profile-analytics-geo-chart"),
      analyticsLock: $("#profile-analytics-lock"),

      reqBanner: $("#profile-requests-banner"),
      reqSummary: $("#profile-requests-summary"),
      reqTable: $("#profile-requests-table"),
      reqTableWrap: $("#profile-requests-table-wrap"),
      reqFilters: $("#profile-requests-filters"),
      reqDesktopList: $("#profile-requests-desktop-list"),
      reqMobileList: $("#profile-requests-mobile-list"),
      reqEmpty: $("#profile-requests-empty-state"),
      reqNewBtn: $("#profile-new-request-btn"),
      refLink: $("#profile-ref-link"),
      refCopy: $("#profile-ref-copy"),
      refTg: $("#profile-ref-tg"),
      refInvited: $("#profile-ref-stat-invited"),
      refPaid: $("#profile-ref-stat-paid"),
      refRewarded: $("#profile-ref-stat-rewarded"),
      refBonusBalance: $("#profile-ref-bonus-balance"),
      refBonusEarned: $("#profile-ref-bonus-earned"),
      refBonusSpent: $("#profile-ref-bonus-spent"),
      refTable: $("#profile-ref-table"),
      refRewards: $("#profile-ref-rewards"),
      refBonusHistory: $("#profile-ref-bonus-history"),
      refCampaigns: $("#profile-ref-campaigns"),
      refFraud: $("#profile-ref-fraud"),

      stName: $("#profile-settings-display-name"),
      stCategoryNav: $("#profile-settings-categories"),
      stCategoryButtons: $$("[data-settings-category]"),
      stCategoryPanels: $$("[data-settings-panel]"),
      stSaveWrap: $("#profile-settings-save-wrap"),
      stCity: $("#profile-settings-city"),
      stLogin: $("#profile-settings-login"),
      stLoginStatus: $("#profile-settings-login-status"),
      stEmail: $("#profile-settings-email"),
      stTg: $("#profile-settings-telegram"),
      stChangeEmail: $("#profile-settings-change-email"),
      stChangePassword: $("#profile-settings-change-password"),
      emailModal: $("#profile-email-modal"),
      emailModalDialog: $("#profile-email-modal-dialog"),
      emailModalCloseTop: $("#profile-email-modal-close-top"),
      emailModalCancel: $("#profile-email-modal-cancel"),
      emailModalStepRequest: $("#profile-email-modal-step-request"),
      emailModalStepVerify: $("#profile-email-modal-step-verify"),
      emailModalPending: $("#profile-email-modal-pending"),
      emailModalError: $("#profile-email-modal-error"),
      emailModalErrorVerify: $("#profile-email-modal-error-verify"),
      emailModalSubmit: $("#profile-email-modal-submit"),
      emailModalVerify: $("#profile-email-modal-verify"),
      emailModalBack: $("#profile-email-modal-back"),
      emailNewEmail: $("#profile-email-new-email"),
      emailCurrentPassword: $("#profile-email-current-password"),
      emailVerifyCode: $("#profile-email-verify-code"),
      emailRequiredModal: $("#profile-email-required-modal"),
      emailRequiredClose: $("#profile-email-required-close"),
      emailRequiredLater: $("#profile-email-required-later"),
      emailRequiredOpen: $("#profile-email-required-open"),
      passwordModal: $("#profile-password-modal"),
      passwordModalDialog: $("#profile-password-modal-dialog"),
      passwordModalCloseTop: $("#profile-password-modal-close-top"),
      passwordModalClose: $("#profile-password-modal-close"),
      passwordModalError: $("#profile-password-modal-error"),
      passwordModalSubmit: $("#profile-password-modal-submit"),
      passwordCurrent: $("#profile-password-current"),
      passwordNew: $("#profile-password-new"),
      passwordConfirm: $("#profile-password-confirm"),
      stLinkTelegram: $("#profile-settings-link-telegram"),
      stUnlinkTelegram: $("#profile-settings-unlink-telegram"),
      stNotif: $("#profile-settings-notifications"),
      stDirectory: $("#profile-settings-directory"),
      privatePasswordOpenAdd: $("#profile-private-password-open-add"),
      privatePasswordsList: $("#profile-private-passwords-list"),
      privatePasswordAddModal: $("#profile-private-password-add-modal"),
      privatePasswordAddDialog: $("#profile-private-password-add-dialog"),
      privatePasswordAddCloseTop: $("#profile-private-password-add-close-top"),
      privatePasswordAddCancel: $("#profile-private-password-add-cancel"),
      privatePasswordAddSubmit: $("#profile-private-password-add-submit"),
      privatePasswordAddLabel: $("#profile-private-password-add-label"),
      privatePasswordAddValue: $("#profile-private-password-add-value"),
      privatePasswordAddError: $("#profile-private-password-add-error"),
      privatePasswordChangeModal: $("#profile-private-password-change-modal"),
      privatePasswordChangeDialog: $("#profile-private-password-change-dialog"),
      privatePasswordChangeCloseTop: $("#profile-private-password-change-close-top"),
      privatePasswordChangeCancel: $("#profile-private-password-change-cancel"),
      privatePasswordChangeSubmit: $("#profile-private-password-change-submit"),
      privatePasswordChangeOld: $("#profile-private-password-change-old"),
      privatePasswordChangeNew: $("#profile-private-password-change-new"),
      privatePasswordChangeMeta: $("#profile-private-password-change-meta"),
      privatePasswordChangeError: $("#profile-private-password-change-error"),
      stSave: $("#profile-settings-save"),
      stStatus: $("#profile-settings-status"),
      stDeact: $("#profile-settings-deactivate"),
      verificationStatus: $("#profile-verification-status"),
      verificationNote: $("#profile-verification-note"),
      verificationOpen: $("#profile-verification-open"),
      verificationModal: $("#profile-verification-modal"),
      verificationClose: $("#profile-verification-close"),
      verificationCompany: $("#profile-verification-company"),
      verificationRole: $("#profile-verification-role"),
      verificationSector: $("#profile-verification-sector"),
      verificationProofType: $("#profile-verification-proof-type"),
      verificationProofValue: $("#profile-verification-proof-value"),
      verificationComment: $("#profile-verification-comment"),
      verificationSubmit: $("#profile-verification-submit"),
      verificationCorrectionWrap: $("#profile-verification-correction-wrap"),
      verificationCorrection: $("#profile-verification-correction"),
      verificationCorrectionSubmit: $("#profile-verification-correction-submit"),
      badgeOpen: $("#profile-badge-open"),
      badgeModal: $("#profile-badge-modal"),
      badgeClose: $("#profile-badge-close"),
      badgeType: $("#profile-badge-type"),
      badgeWorkplace: $("#profile-badge-workplace"),
      badgeRole: $("#profile-badge-role"),
      badgeProofText: $("#profile-badge-proof-text"),
      badgeProofLink: $("#profile-badge-proof-link"),
      badgeSubmit: $("#profile-badge-submit"),
      badgeGovStatus: $("#profile-badge-gov-status"),
      badgeGovNote: $("#profile-badge-gov-note"),
      badgeStaffStatus: $("#profile-badge-staff-status"),
      badgeStaffNote: $("#profile-badge-staff-note"),
      qrModal: $("#profile-qr-modal"),
      qrClose: $("#profile-qr-close"),
      qrBox: $("#profile-qr-box"),
      qrLink: $("#profile-qr-link"),
      qrCopy: $("#profile-qr-copy"),
      qrDownloadPng: $("#profile-qr-download-png"),
      logout: $("#profile-logout-btn"),


      modal: $("#profile-modal"),
      modalDialog: $("#profile-modal-dialog"),
      modalTitle: $("#profile-modal-title"),
      modalText: $("#profile-modal-text"),
      modalOk: $("#profile-modal-confirm"),
      modalClose: $("#profile-modal-close"),
      modalCloseTop: $("#profile-modal-close-top"),
      cardNameError: $("#profile-card-name-error"),

      // Payment cards tab
      pcEmpty: $("#pc-empty-state"),
      pcList: $("#pc-list"),
      pcEditor: $("#pc-editor"),
      pcBack: $("#pc-back"),
      pcNumber: $("#pc-number"),
      pcAvPreview: $("#pc-avatar-preview"),
      pcAvFile: $("#pc-avatar-file"),
      pcAvRemove: $("#pc-avatar-remove"),
      pcName: $("#pc-name"),
      pcRole: $("#pc-role"),
      pcBio: $("#pc-bio"),
      pcBioC: $("#pc-bio-counter"),
      pcHashtag: $("#pc-hashtag"),
      pcAddress: $("#pc-address"),
      pcPostcode: $("#pc-postcode"),
      pcEmail: $("#pc-email"),
      pcExtraPhone: $("#pc-extra-phone"),
      pcTagInput: $("#pc-tag-input"),
      pcTagAdd: $("#pc-tag-add"),
      pcTags: $("#pc-tags-list"),
      pcBtns: $("#pc-buttons-list"),
      pcBtnAdd: $("#pc-button-add"),
      pcSave: $("#pc-save"),
      pcOpenLink: $("#pc-open-link"),
    };

    let avatarCropper = null;

    const hasButtonLimit = () => Number.isFinite(s.limits?.buttons);
    const getButtonLimit = () => (hasButtonLimit() ? Number(s.limits.buttons) : Number.POSITIVE_INFINITY);
    const getTagLimit = () => (Number.isFinite(s.limits?.tags) ? Number(s.limits.tags) : 3);
    const emptyWallSummary = () => ({
      canUseWall: false,
      canPostNow: false,
      nextPostAt: null,
      todayPostCount: 0,
    });
    const emptyWallPagination = () => ({
      page: 1,
      pageSize: WALL_POST_PAGE_SIZE,
      total: 0,
      hasMore: false,
    });

    const normalizeWallSummary = (summary) => {
      const source = summary && typeof summary === "object" ? summary : {};
      return {
        canUseWall: Boolean(source.canUseWall),
        canPostNow: Boolean(source.canPostNow),
        nextPostAt: source.nextPostAt || null,
        todayPostCount: Math.max(0, Number(source.todayPostCount || 0)),
      };
    };

    const normalizeWallPagination = (pagination) => {
      const source = pagination && typeof pagination === "object" ? pagination : {};
      return {
        page: Math.max(1, Number(source.page || 1)),
        pageSize: Math.max(1, Number(source.pageSize || WALL_POST_PAGE_SIZE)),
        total: Math.max(0, Number(source.total || 0)),
        hasMore: Boolean(source.hasMore),
      };
    };

    const normalizeWallComment = (item) => {
      if (!item || typeof item !== "object") return null;
      const id = String(item.id || "").trim();
      if (!id) return null;
      const authorSource = item.author && typeof item.author === "object" ? item.author : {};
      return {
        ...item,
        id,
        postId: String(item.postId || "").trim(),
        userId: String(item.userId || "").trim(),
        content: String(item.content || ""),
        viewerCanDelete: Boolean(item.viewerCanDelete),
        author: {
          id: String(authorSource.id || item.userId || "").trim(),
          name: String(authorSource.name || "UNQX User").trim() || "UNQX User",
          avatarUrl: String(authorSource.avatarUrl || "").trim() || null,
          initials: String(authorSource.initials || "").trim() || "UN",
        },
      };
    };

    const normalizeWallPost = (item) => {
      if (!item || typeof item !== "object") return null;
      const id = String(item.id || "").trim();
      if (!id) return null;
      const comments = Array.isArray(item.comments) ? item.comments.map(normalizeWallComment).filter(Boolean) : [];
      return {
        ...item,
        id,
        content: String(item.content || ""),
        commentsEnabled: item.commentsEnabled !== false,
        status: String(item.status || "published"),
        statusLabel: String(item.statusLabel || ""),
        likesCount: Number(item.likesCount || 0),
        commentsCount: Math.max(0, Number(item.commentsCount || comments.length)),
        comments,
        isEdited: Boolean(item.isEdited),
      };
    };
    const mergeWallItems = (currentItems, nextItems) => {
      const existingIds = new Set((Array.isArray(currentItems) ? currentItems : []).map((item) => String(item?.id || "")));
      const merged = Array.isArray(currentItems) ? currentItems.slice(0) : [];
      for (const item of Array.isArray(nextItems) ? nextItems : []) {
        if (!item || !item.id || existingIds.has(item.id)) continue;
        merged.push(item);
        existingIds.add(item.id);
      }
      return merged;
    };

    const emptyCommunityPagination = () => ({
      page: 1,
      pageSize: COMMUNITY_PAGE_SIZE,
      total: 0,
      hasMore: false,
    });

    const normalizeCommunityType = (value) => (String(value || "").trim().toLowerCase() === "followers" ? "followers" : "following");

    const normalizeCommunityPagination = (pagination) => {
      const source = pagination && typeof pagination === "object" ? pagination : {};
      return {
        page: Math.max(1, Number(source.page || 1)),
        pageSize: Math.max(1, Number(source.pageSize || COMMUNITY_PAGE_SIZE)),
        total: Math.max(0, Number(source.total || 0)),
        hasMore: Boolean(source.hasMore),
      };
    };

    const normalizeCommunityItem = (item) => {
      if (!item || typeof item !== "object") return null;
      const name = String(item.name || "UNQX User").trim() || "UNQX User";
      const primarySlug = String(item.primarySlug || "").trim().toUpperCase() || "";
      return {
        userId: String(item.userId || "").trim(),
        name,
        initials:
          String(item.initials || "").trim() ||
          name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => (part[0] ? part[0].toUpperCase() : ""))
            .join("") ||
          "UN",
        avatarUrl: String(item.avatarUrl || "").trim() || null,
        primarySlug,
        role: String(item.role || "").trim(),
        verified: Boolean(item.verified),
        followedAt: item.followedAt || null,
        isFollowing: Boolean(item.isFollowing),
        canFollow: item.canFollow !== false && Boolean(primarySlug),
        requiresAuth: Boolean(item.requiresAuth),
        isPubliclyReachable: item.isPubliclyReachable !== false && Boolean(primarySlug),
        profileHref: String(item.profileHref || "").trim() || (primarySlug ? `/${encodeURIComponent(primarySlug)}` : ""),
      };
    };

    const normalizeFollowSummary = (summary) => {
      const source = summary && typeof summary === "object" ? summary : {};
      const counts = source.counts && typeof source.counts === "object" ? source.counts : {};
      const viewer = source.viewer && typeof source.viewer === "object" ? source.viewer : {};
      const previews = source.previews && typeof source.previews === "object" ? source.previews : {};
      return {
        counts: {
          followers: Math.max(0, Number(counts.followers || 0)),
          following: Math.max(0, Number(counts.following || 0)),
        },
        viewer: {
          isFollowing: Boolean(viewer.isFollowing),
          canFollow: Boolean(viewer.canFollow),
          requiresAuth: Boolean(viewer.requiresAuth),
        },
        unreadFollowersCount: Math.max(0, Number(source.unreadFollowersCount || 0)),
        previews: {
          following: Array.isArray(previews.following)
            ? previews.following.map(normalizeCommunityItem).filter(Boolean)
            : [],
        },
      };
    };

    const resetWallComposer = () => {
      s.wallEditingId = "";
      s.wallDraftContent = "";
      s.wallDraftCommentsEnabled = true;
    };

    const currentWallPost = () => {
      const items = Array.isArray(s.wallPosts) ? s.wallPosts : [];
      return items.find((item) => item.id === s.wallEditingId) || null;
    };

    const focusWallEditor = () => {
      if (!(el.wallEditor instanceof HTMLTextAreaElement)) {
        return;
      }
      el.wallEditor.focus();
      const cursor = el.wallEditor.value.length;
      el.wallEditor.setSelectionRange(cursor, cursor);
    };

    const syncModalOpenClass = () => {
      document.body.classList.toggle("modal-open", modalIsOpen || wallComposerModalOpen);
    };

    const closeWallComposerModal = ({ restoreFocus = true } = {}) => {
      if (!(el.wallComposerModal instanceof HTMLElement)) {
        return;
      }
      el.wallComposerModal.classList.add("hidden");
      el.wallComposerModal.classList.remove("flex");
      wallComposerModalOpen = false;
      syncModalOpenClass();
      if (restoreFocus && wallComposerModalLastFocused instanceof HTMLElement) {
        wallComposerModalLastFocused.focus();
      }
      wallComposerModalLastFocused = null;
    };

    const openWallComposerModal = ({ mode = "current" } = {}) => {
      const summary = normalizeWallSummary(s.wallSummary);
      if (!summary.canUseWall) {
        openOrderModal({});
        return;
      }
      if (mode === "new" && !summary.canPostNow) {
        showWallLimitReachedModal(summary);
        return;
      }
      if (mode === "new" && s.wallEditingId) {
        resetWallComposer();
      }
      if (!(el.wallComposerModal instanceof HTMLElement)) {
        return;
      }
      if (!wallComposerModalOpen) {
        wallComposerModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      el.wallComposerModal.classList.remove("hidden");
      el.wallComposerModal.classList.add("flex");
      wallComposerModalOpen = true;
      syncModalOpenClass();
      updateWallComposerState();
      requestAnimationFrame(() => {
        el.wallComposerDialog?.focus();
        focusWallEditor();
      });
    };

    const replaceWallPost = (nextPost) => {
      const normalized = normalizeWallPost(nextPost);
      if (!normalized) return;
      const items = Array.isArray(s.wallPosts) ? s.wallPosts : [];
      const hasExisting = items.some((item) => item.id === normalized.id);
      s.wallPosts = hasExisting
        ? items.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...items];
      syncWallCommentsExpandedState(normalized.id, normalized.commentsCount || normalized.comments?.length || 0);
    };

    const getWallCommentDraft = (postId) =>
      String(s.wallCommentDrafts?.[String(postId || "").trim()] || "");

    const setWallCommentDraft = (postId, value) => {
      const normalizedPostId = String(postId || "").trim();
      if (!normalizedPostId) return;
      const nextValue = String(value || "").slice(0, WALL_COMMENT_CONTENT_MAX);
      s.wallCommentDrafts = {
        ...(s.wallCommentDrafts || {}),
        [normalizedPostId]: nextValue,
      };
    };

    const clearWallCommentDraft = (postId) => {
      const normalizedPostId = String(postId || "").trim();
      if (!normalizedPostId || !s.wallCommentDrafts) return;
      const nextDrafts = { ...s.wallCommentDrafts };
      delete nextDrafts[normalizedPostId];
      s.wallCommentDrafts = nextDrafts;
    };

    const getWallCommentInput = (postId) => {
      const normalizedPostId = String(postId || "").trim();
      if (!normalizedPostId || !(el.wallList instanceof HTMLElement)) return null;
      const candidates = el.wallList.querySelectorAll("[data-wall-comment-input]");
      for (const candidate of candidates) {
        if (
          candidate instanceof HTMLTextAreaElement &&
          String(candidate.getAttribute("data-wall-post-id") || "").trim() === normalizedPostId
        ) {
          return candidate;
        }
      }
      return null;
    };

    const readWallCommentDraft = (postId) => {
      const input = getWallCommentInput(postId);
      if (input instanceof HTMLTextAreaElement) {
        return String(input.value || "");
      }
      return getWallCommentDraft(postId);
    };

    const isWallCommentsExpanded = (postId) =>
      s.wallExpandedCommentPostIds instanceof Set && s.wallExpandedCommentPostIds.has(String(postId || "").trim());

    const setWallCommentsExpanded = (postId, expanded) => {
      const normalizedPostId = String(postId || "").trim();
      if (!normalizedPostId) return;
      if (!(s.wallExpandedCommentPostIds instanceof Set)) {
        s.wallExpandedCommentPostIds = new Set();
      }
      if (expanded) {
        s.wallExpandedCommentPostIds.add(normalizedPostId);
      } else {
        s.wallExpandedCommentPostIds.delete(normalizedPostId);
      }
    };

    const syncWallCommentsExpandedState = (postId, commentsCount) => {
      if (Number(commentsCount || 0) <= WALL_VISIBLE_COMMENT_COUNT) {
        setWallCommentsExpanded(postId, false);
      }
    };

    const initCsrfFromMeta = () => {
      if (csrf) return;
      const token = $('meta[name="csrf-token"]')?.getAttribute("content") || "";
      if (token) csrf = token;
    };

    const refreshCsrfToken = async () => {
      try {
        const response = await fetch("/api/auth/me", { method: "GET" });
        const payload = await response.json().catch(() => ({}));
        if (payload.csrfToken) {
          csrf = payload.csrfToken;
          $('meta[name="csrf-token"]')?.setAttribute("content", csrf);
        }
      } catch {
        // best effort
      }
    };

    const api = async (url, options = {}) => {
      initCsrfFromMeta();
      const headers = { ...(options.headers || {}) };
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const { _csrfRetried, ...fetchOptions } = options;
      const response = await fetch(url, { ...fetchOptions, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorText = String(payload.error || "").toLowerCase();
        if (!_csrfRetried && errorText.includes("invalid csrf token")) {
          await refreshCsrfToken();
          return api(url, { ...options, _csrfRetried: true });
        }
        const error = new Error(payload.error || `HTTP ${response.status}`);
        error.code = payload.code;
        error.payload = payload;
        throw error;
      }
      if (payload.csrfToken) {
        csrf = payload.csrfToken;
        $('meta[name="csrf-token"]')?.setAttribute("content", csrf);
      }
      return payload;
    };

    const uploadAvatarBlob = async (blob) => {
      const form = new FormData();
      form.append("file", blob, "avatar.webp");
      return api("/api/profile/card/avatar", {
        method: "POST",
        body: form,
      });
    };

    const closeModal = () => {
      if (!el.modal) return;
      el.modal.classList.add("hidden");
      el.modal.classList.remove("flex");
      modalIsOpen = false;
      syncModalOpenClass();
      if (modalLastFocused instanceof HTMLElement) {
        modalLastFocused.focus();
      }
      if (el.modalOk && modalConfirmHandler) {
        el.modalOk.removeEventListener("click", modalConfirmHandler);
        modalConfirmHandler = null;
      }
    };

    const showModal = (title, text, confirmLabel, onConfirm) => {
      if (!el.modal || !el.modalTitle || !el.modalText || !el.modalOk) return;
      el.modalTitle.textContent = title;
      el.modalText.textContent = text;
      el.modalOk.textContent = confirmLabel || "Ок";
      modalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.modal.classList.remove("hidden");
      el.modal.classList.add("flex");
      modalIsOpen = true;
      syncModalOpenClass();
      requestAnimationFrame(() => {
        el.modalDialog?.focus();
      });

      if (el.modalOk && modalConfirmHandler) {
        el.modalOk.removeEventListener("click", modalConfirmHandler);
      }

      const once = () => {
        if (typeof onConfirm === "function") onConfirm();
        closeModal();
        modalConfirmHandler = null;
      };

      modalConfirmHandler = once;
      el.modalOk.addEventListener("click", once);
    };

    const setEmailModalError = (message) => {
      if (!el.emailModalError) return;
      const value = String(message || "").trim();
      el.emailModalError.textContent = value;
      el.emailModalError.classList.toggle("hidden", !value);
    };

    const setEmailModalVerifyError = (message) => {
      if (!el.emailModalErrorVerify) return;
      const value = String(message || "").trim();
      el.emailModalErrorVerify.textContent = value;
      el.emailModalErrorVerify.classList.toggle("hidden", !value);
    };

    const setPasswordModalError = (message) => {
      if (!el.passwordModalError) return;
      const value = String(message || "").trim();
      el.passwordModalError.textContent = value;
      el.passwordModalError.classList.toggle("hidden", !value);
    };

    const setPrivatePasswordAddError = (message) => {
      if (!(el.privatePasswordAddError instanceof HTMLElement)) return;
      const value = String(message || "").trim();
      el.privatePasswordAddError.textContent = value;
      el.privatePasswordAddError.classList.toggle("hidden", !value);
    };

    const setPrivatePasswordChangeError = (message) => {
      if (!(el.privatePasswordChangeError instanceof HTMLElement)) return;
      const value = String(message || "").trim();
      el.privatePasswordChangeError.textContent = value;
      el.privatePasswordChangeError.classList.toggle("hidden", !value);
    };

    const resetPrivatePasswordAddModal = () => {
      if (el.privatePasswordAddLabel instanceof HTMLInputElement) el.privatePasswordAddLabel.value = "";
      if (el.privatePasswordAddValue instanceof HTMLInputElement) el.privatePasswordAddValue.value = "";
      setPrivatePasswordAddError("");
      if (el.privatePasswordAddSubmit instanceof HTMLButtonElement) {
        el.privatePasswordAddSubmit.disabled = false;
      }
    };

    const openPrivatePasswordAddModal = () => {
      if (!(el.privatePasswordAddModal instanceof HTMLElement)) return;
      const limit = Number.isFinite(Number(s.privatePasswordLimit)) ? Number(s.privatePasswordLimit) : 10;
      const passwords = Array.isArray(s.privatePasswords) ? s.privatePasswords : [];
      if (passwords.length >= limit) {
        showModal("Лимит достигнут", `Доступно максимум ${limit} паролей.`);
        return;
      }
      resetPrivatePasswordAddModal();
      privatePasswordAddModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.privatePasswordAddModal.classList.remove("hidden");
      el.privatePasswordAddModal.classList.add("flex");
      privatePasswordAddModalOpen = true;
      requestAnimationFrame(() => {
        if (el.privatePasswordAddLabel instanceof HTMLInputElement) {
          el.privatePasswordAddLabel.focus();
        }
      });
    };

    const closePrivatePasswordAddModal = () => {
      if (!(el.privatePasswordAddModal instanceof HTMLElement)) return;
      el.privatePasswordAddModal.classList.add("hidden");
      el.privatePasswordAddModal.classList.remove("flex");
      privatePasswordAddModalOpen = false;
      if (privatePasswordAddModalLastFocused instanceof HTMLElement) {
        privatePasswordAddModalLastFocused.focus();
      }
    };

    const resetPrivatePasswordChangeModal = () => {
      privatePasswordChangeId = "";
      if (el.privatePasswordChangeOld instanceof HTMLInputElement) el.privatePasswordChangeOld.value = "";
      if (el.privatePasswordChangeNew instanceof HTMLInputElement) el.privatePasswordChangeNew.value = "";
      if (el.privatePasswordChangeMeta instanceof HTMLElement) el.privatePasswordChangeMeta.textContent = "";
      setPrivatePasswordChangeError("");
      if (el.privatePasswordChangeSubmit instanceof HTMLButtonElement) {
        el.privatePasswordChangeSubmit.disabled = false;
      }
    };

    const openPrivatePasswordChangeModal = (passwordId) => {
      if (!(el.privatePasswordChangeModal instanceof HTMLElement)) return;
      const id = String(passwordId || "").trim();
      if (!id) return;
      const passwords = Array.isArray(s.privatePasswords) ? s.privatePasswords : [];
      const item = passwords.find((candidate) => String(candidate?.id || "") === id);
      if (!item) {
        showModal("Ошибка", "Пароль не найден.");
        return;
      }
      resetPrivatePasswordChangeModal();
      privatePasswordChangeId = id;
      const label = String(item?.label || "").trim() || "Без метки";
      if (el.privatePasswordChangeMeta instanceof HTMLElement) {
        el.privatePasswordChangeMeta.textContent = `Метка: ${label}`;
      }
      privatePasswordChangeModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.privatePasswordChangeModal.classList.remove("hidden");
      el.privatePasswordChangeModal.classList.add("flex");
      privatePasswordChangeModalOpen = true;
      requestAnimationFrame(() => {
        if (el.privatePasswordChangeOld instanceof HTMLInputElement) {
          el.privatePasswordChangeOld.focus();
        }
      });
    };

    const closePrivatePasswordChangeModal = () => {
      if (!(el.privatePasswordChangeModal instanceof HTMLElement)) return;
      el.privatePasswordChangeModal.classList.add("hidden");
      el.privatePasswordChangeModal.classList.remove("flex");
      privatePasswordChangeModalOpen = false;
      resetPrivatePasswordChangeModal();
      if (privatePasswordChangeModalLastFocused instanceof HTMLElement) {
        privatePasswordChangeModalLastFocused.focus();
      }
    };

    const setEmailModalStep = (step) => {
      const nextStep = step === "verify" ? "verify" : "request";
      emailModalStep = nextStep;
      if (el.emailModalStepRequest) {
        el.emailModalStepRequest.classList.toggle("hidden", nextStep !== "request");
      }
      if (el.emailModalStepVerify) {
        el.emailModalStepVerify.classList.toggle("hidden", nextStep !== "verify");
      }
    };

    const resetEmailModal = () => {
      if (el.emailNewEmail instanceof HTMLInputElement) el.emailNewEmail.value = "";
      if (el.emailCurrentPassword instanceof HTMLInputElement) el.emailCurrentPassword.value = "";
      if (el.emailVerifyCode instanceof HTMLInputElement) el.emailVerifyCode.value = "";
      if (el.emailModalPending) el.emailModalPending.textContent = "";
      setEmailModalError("");
      setEmailModalVerifyError("");
      setEmailModalStep("request");
      if (el.emailModalSubmit instanceof HTMLButtonElement) el.emailModalSubmit.disabled = false;
      if (el.emailModalVerify instanceof HTMLButtonElement) el.emailModalVerify.disabled = false;
    };

    const openEmailModal = () => {
      if (!(el.emailModal instanceof HTMLElement)) return;
      resetEmailModal();
      emailModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.emailModal.classList.remove("hidden");
      el.emailModal.classList.add("flex");
      emailModalOpen = true;
      requestAnimationFrame(() => {
        if (el.emailNewEmail instanceof HTMLInputElement) el.emailNewEmail.focus();
      });
    };

    const closeEmailModal = () => {
      if (!(el.emailModal instanceof HTMLElement)) return;
      el.emailModal.classList.add("hidden");
      el.emailModal.classList.remove("flex");
      emailModalOpen = false;
      if (emailModalLastFocused instanceof HTMLElement) {
        emailModalLastFocused.focus();
      }
    };

    const openEmailRequiredModal = () => {
      if (!(el.emailRequiredModal instanceof HTMLElement)) return;
      el.emailRequiredModal.classList.remove("hidden");
      el.emailRequiredModal.classList.add("flex");
      emailRequiredModalShown = true;
    };

    const closeEmailRequiredModal = () => {
      if (!(el.emailRequiredModal instanceof HTMLElement)) return;
      el.emailRequiredModal.classList.add("hidden");
      el.emailRequiredModal.classList.remove("flex");
    };

    const resetPasswordModal = () => {
      if (el.passwordCurrent instanceof HTMLInputElement) el.passwordCurrent.value = "";
      if (el.passwordNew instanceof HTMLInputElement) el.passwordNew.value = "";
      if (el.passwordConfirm instanceof HTMLInputElement) el.passwordConfirm.value = "";
      setPasswordModalError("");
      if (el.passwordModalSubmit instanceof HTMLButtonElement) el.passwordModalSubmit.disabled = false;
    };

    const openPasswordModal = () => {
      if (!(el.passwordModal instanceof HTMLElement)) return;
      resetPasswordModal();
      passwordModalLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.passwordModal.classList.remove("hidden");
      el.passwordModal.classList.add("flex");
      passwordModalOpen = true;
      requestAnimationFrame(() => {
        if (el.passwordCurrent instanceof HTMLInputElement) el.passwordCurrent.focus();
      });
    };

    const closePasswordModal = () => {
      if (!(el.passwordModal instanceof HTMLElement)) return;
      el.passwordModal.classList.add("hidden");
      el.passwordModal.classList.remove("flex");
      passwordModalOpen = false;
      if (passwordModalLastFocused instanceof HTMLElement) {
        passwordModalLastFocused.focus();
      }
    };

    const handleEmailRequest = async () => {
      const email = String(el.emailNewEmail?.value || "").trim();
      const currentPassword = String(el.emailCurrentPassword?.value || "");
      setEmailModalError("");

      if (!email) {
        setEmailModalError("Введите новый email.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailModalError("Введите корректный email.");
        return;
      }
      if (!currentPassword) {
        setEmailModalError("Введите текущий пароль.");
        return;
      }

      if (el.emailModalSubmit instanceof HTMLButtonElement) {
        el.emailModalSubmit.disabled = true;
      }
      try {
        const payload = await api("/api/auth/change-email/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, currentPassword }),
        });
        const pendingEmail = String(payload?.pendingEmail || email).trim();
        if (el.emailModalPending) {
          el.emailModalPending.textContent = pendingEmail
            ? `Код отправлен на ${pendingEmail}.`
            : "Код отправлен на ваш email.";
        }
        setEmailModalStep("verify");
        requestAnimationFrame(() => {
          if (el.emailVerifyCode instanceof HTMLInputElement) el.emailVerifyCode.focus();
        });
      } catch (error) {
        setEmailModalError(error.message || "Не удалось отправить код");
      } finally {
        if (el.emailModalSubmit instanceof HTMLButtonElement) {
          el.emailModalSubmit.disabled = false;
        }
      }
    };

    const handleEmailVerify = async () => {
      const rawCode = String(el.emailVerifyCode?.value || "");
      const code = rawCode.replace(/\D/g, "").slice(0, 6);
      if (el.emailVerifyCode instanceof HTMLInputElement) {
        el.emailVerifyCode.value = code;
      }
      setEmailModalVerifyError("");
      if (!code) {
        setEmailModalVerifyError("Введите код из письма.");
        return;
      }
      if (el.emailModalVerify instanceof HTMLButtonElement) {
        el.emailModalVerify.disabled = true;
      }
      try {
        const verified = await api("/api/auth/change-email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (verified?.user && s.user) {
          s.user = { ...s.user, ...verified.user };
        }
        renderSettings();
        closeEmailModal();
        showModal("Готово", "Email обновлён.");
      } catch (error) {
        setEmailModalVerifyError(error.message || "Не удалось подтвердить email");
      } finally {
        if (el.emailModalVerify instanceof HTMLButtonElement) {
          el.emailModalVerify.disabled = false;
        }
      }
    };

    const handlePasswordChange = async () => {
      const currentPassword = String(el.passwordCurrent?.value || "");
      const newPassword = String(el.passwordNew?.value || "");
      const confirmPassword = String(el.passwordConfirm?.value || "");
      setPasswordModalError("");

      if (!currentPassword) {
        setPasswordModalError("Введите текущий пароль.");
        return;
      }
      if (newPassword.length < 8) {
        setPasswordModalError("Пароль должен быть минимум 8 символов.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordModalError("Пароли не совпадают.");
        return;
      }

      if (el.passwordModalSubmit instanceof HTMLButtonElement) {
        el.passwordModalSubmit.disabled = true;
      }
      try {
        await api("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        closePasswordModal();
        showModal("Готово", "Пароль обновлён.");
      } catch (error) {
        setPasswordModalError(error.message || "Не удалось изменить пароль");
      } finally {
        if (el.passwordModalSubmit instanceof HTMLButtonElement) {
          el.passwordModalSubmit.disabled = false;
        }
      }
    };

    const handlePrivatePasswordAdd = async () => {
      const password = String(el.privatePasswordAddValue?.value || "").trim();
      const label = String(el.privatePasswordAddLabel?.value || "").trim();
      const minLength = Number.isFinite(Number(s.privatePasswordMinLength)) ? Number(s.privatePasswordMinLength) : 4;
      setPrivatePasswordAddError("");

      if (password.length < minLength) {
        setPrivatePasswordAddError(`Минимальная длина пароля: ${minLength} символа.`);
        return;
      }

      if (el.privatePasswordAddSubmit instanceof HTMLButtonElement) {
        el.privatePasswordAddSubmit.disabled = true;
      }
      try {
        await api("/api/profile/privacy/passwords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, password }),
        });
        closePrivatePasswordAddModal();
        await refreshPrivateAccessData();
        showSaveAlert("Пароль добавлен");
      } catch (error) {
        setPrivatePasswordAddError(error.message || "Не удалось добавить пароль");
      } finally {
        if (el.privatePasswordAddSubmit instanceof HTMLButtonElement) {
          el.privatePasswordAddSubmit.disabled = false;
        }
      }
    };

    const handlePrivatePasswordChange = async () => {
      const passwordId = String(privatePasswordChangeId || "").trim();
      if (!passwordId) {
        setPrivatePasswordChangeError("Пароль не найден.");
        return;
      }
      const oldPassword = String(el.privatePasswordChangeOld?.value || "").trim();
      const newPassword = String(el.privatePasswordChangeNew?.value || "").trim();
      const minLength = Number.isFinite(Number(s.privatePasswordMinLength)) ? Number(s.privatePasswordMinLength) : 4;
      setPrivatePasswordChangeError("");

      if (!oldPassword) {
        setPrivatePasswordChangeError("Введите текущий пароль.");
        return;
      }
      if (newPassword.length < minLength) {
        setPrivatePasswordChangeError(`Новый пароль должен быть минимум ${minLength} символа.`);
        return;
      }

      if (el.privatePasswordChangeSubmit instanceof HTMLButtonElement) {
        el.privatePasswordChangeSubmit.disabled = true;
      }
      try {
        await api(`/api/profile/privacy/passwords/${encodeURIComponent(passwordId)}/change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        closePrivatePasswordChangeModal();
        await refreshPrivateAccessData();
        showSaveAlert("Пароль обновлён");
      } catch (error) {
        setPrivatePasswordChangeError(error.message || "Не удалось сменить пароль");
      } finally {
        if (el.privatePasswordChangeSubmit instanceof HTMLButtonElement) {
          el.privatePasswordChangeSubmit.disabled = false;
        }
      }
    };

    const showSaveAlert = (message) => {
      let node = document.getElementById("profile-save-success-alert");
      if (!(node instanceof HTMLElement)) {
        node = document.createElement("div");
        node.id = "profile-save-success-alert";
        node.setAttribute("role", "status");
        node.setAttribute("aria-live", "polite");
        document.body.appendChild(node);
      }
      node.className = "";
      node.style.position = "fixed";
      node.style.right = "16px";
      node.style.bottom = "16px";
      node.style.zIndex = "9999";
      node.style.pointerEvents = "none";
      node.style.maxWidth = "min(92vw, 420px)";
      node.style.border = "1px solid #6ee7b7";
      node.style.borderRadius = "12px";
      node.style.background = "#ecfdf5";
      node.style.padding = "12px 14px";
      node.style.color = "#065f46";
      node.style.fontSize = "14px";
      node.style.fontWeight = "600";
      node.style.boxShadow = "0 10px 30px rgba(6, 95, 70, 0.18)";
      node.style.opacity = "0";
      node.style.transform = "translateY(10px) scale(0.98)";
      node.style.transition = "opacity 180ms ease, transform 180ms ease";
      node.style.display = "block";
      node.style.visibility = "visible";
      node.textContent = message;
      node.style.opacity = "1";
      node.style.transform = "translateY(0) scale(1)";
      if (saveAlertTimer) clearTimeout(saveAlertTimer);
      saveAlertTimer = setTimeout(() => {
        if (!node) return;
        node.style.opacity = "0";
        node.style.transform = "translateY(10px) scale(0.98)";
        window.setTimeout(() => {
          if (!node) return;
          node.style.visibility = "hidden";
        }, 180);
      }, 4000);
    };

    const destroyCropper = () => {
      if (avatarCropper) {
        avatarCropper.destroy();
        avatarCropper = null;
      }
    };

    const hideAvatarCrop = () => {
      destroyCropper();
      if (el.cAvCropWrap) el.cAvCropWrap.classList.add("hidden");
      if (el.cAvCropImage) el.cAvCropImage.removeAttribute("src");
      if (el.cAvFile) el.cAvFile.value = "";
    };

    const currentTab = () => {
      const raw = (location.hash || "#slugs").replace("#", "");
      return ["slugs", "card", "posts", "community", "analytics", "requests", "referrals", "settings", "payment-cards"].includes(raw) ? raw : "slugs";
    };

    const setTab = () => {
      const active = currentTab();
      if (active !== "posts" && wallComposerModalOpen) {
        closeWallComposerModal({ restoreFocus: false });
      }
      el.tabs.forEach((button) => {
        const on = button.getAttribute("data-tab-target") === active;
        button.classList.toggle("profile-tab-btn--active", on);
      });
      el.panels.forEach((panel) => panel.classList.toggle("hidden", panel.getAttribute("data-tab-panel") !== active));
      // Не вызываем load() или renderAll() при переключении вкладок, чтобы не сбрасывать прогресс
      // Только для вкладки аналитики подгружаем данные
      if (active === "card") {
        restoreDraft();
        renderCardEditorCategory();
      }
      if (active === "analytics") {
        void refreshAnalytics();
      }
      if (active === "posts" && !s.wallLoaded && normalizeWallSummary(s.wallSummary).canUseWall) {
        void loadWallPosts();
      }
      if (active === "community" && s.user && !s.communityLoaded && !s.communityLoading) {
        void loadCommunity();
      }
      if (active === "community" && Number(s.followSummary?.unreadFollowersCount || 0) > 0 && !s.communityUnreadMarking) {
        const previousUnreadFollowersCount = Math.max(0, Number(s.followSummary?.unreadFollowersCount || 0));
        s.followSummary = {
          ...normalizeFollowSummary(s.followSummary),
          unreadFollowersCount: 0,
        };
        renderCommunity();
        renderCommunityTabBadge();
        void markCommunityNotificationsRead(previousUnreadFollowersCount);
      }
      if (active === "payment-cards") {
        void loadPaymentCards();
      }
    };

    const getCurrentPlan = () => {
      const raw = String(s.user?.capabilityPlan || s.user?.effectivePlan || s.user?.plan || "none")
        .trim()
        .toLowerCase();
      return raw === "premium" ? "premium" : "none";
    };

    const getActualPlan = () => {
      const raw = String(s.user?.plan || "none").trim().toLowerCase();
      return raw === "premium" || raw === "basic" ? "premium" : "none";
    };

    const normalizeCardVisibilityStatus = (status) => {
      const normalized = String(status || "")
        .trim()
        .toLowerCase();
      if (normalized === "paused") return "paused";
      if (normalized === "private") return "private";
      return "active";
    };

    const cardVisibilityLabel = (status) => {
      const normalized = normalizeCardVisibilityStatus(status);
      if (normalized === "paused") return "Пауза";
      if (normalized === "private") return "Приватная";
      return "Активная";
    };

    const cardVisibilityTone = (status) => {
      const normalized = normalizeCardVisibilityStatus(status);
      if (normalized === "paused") return "is-paused";
      if (normalized === "private") return "is-private";
      return "is-active";
    };

    const resolveCardVisibility = () => {
      const slugItems = Array.isArray(s.slugs) ? s.slugs : [];
      if (!slugItems.length) {
        return { status: "active", mixed: false };
      }

      const normalizedStatuses = slugItems.map((item) => normalizeCardVisibilityStatus(item?.status));
      const uniqueStatuses = Array.from(new Set(normalizedStatuses));
      const primarySlug = slugItems.find((item) => item?.isPrimary) || slugItems[0];
      const primaryStatus = normalizeCardVisibilityStatus(primarySlug?.status);
      return {
        status: primaryStatus,
        mixed: uniqueStatuses.length > 1,
      };
    };

    const stateIcon = (name) => {
      if (name === "shopping") {
        return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 8h12l-1.3 10.5a2 2 0 0 1-2 1.5H9.3a2 2 0 0 1-2-1.5L6 8Zm3-2a3 3 0 1 1 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      if (name === "credit-card") {
        return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/></svg>';
      }
      if (name === "bar-chart-2") {
        return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10m8 10V4m8 16v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 20h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      }
      if (name === "file-text") {
        return '<svg class="mx-auto h-12 w-12 text-neutral-400" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3h6l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M10 12h6M10 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      }
      return "";
    };

    const renderStateCard = ({ icon, title, text, buttonId, buttonLabel }) =>
      `<div class="mx-auto max-w-md text-center">${stateIcon(icon)}<h3 class="mt-4 text-lg font-bold text-neutral-900">${esc(title)}</h3><p class="mt-2 text-sm text-neutral-600">${esc(text)}</p><button id="${buttonId}" type="button" class="interactive-btn mt-5 min-h-11 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">${esc(buttonLabel)}</button></div>`;

    const renderWelcomeBanner = () => {
      if (!(el.welcomeBanner instanceof HTMLElement)) return;
      const show = !hasPublicProfileAccess() && !Boolean(s.user?.welcomeDismissed);
      el.welcomeBanner.classList.toggle("hidden", !show);
    };

    const renderSidebar = () => {
      if (!s.user) return;
      const publicHandle = normalizeProfileLoginValue(s.user?.login || s.user?.username);
      if (el.av) {
        const sidebarAvatar = s.card?.avatarUrl || s.user.photoUrl;
        el.av.src = avatarSrc(sidebarAvatar);
      }
      if (el.nm) el.nm.textContent = s.user.displayName || s.user.firstName || "UNQX User";
      if (el.un) el.un.textContent = publicHandle ? `@${publicHandle}` : "@—";
      const plan = getActualPlan();
      if (el.pl) {
        el.pl.dataset.plan = plan;
        el.pl.textContent = plan === "premium" ? "PREMIUM" : hasPublicProfileAccess() ? "FREE" : "No plan";
        el.pl.className = "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold";
        if (plan === "none") {
          el.pl.classList.add("border-neutral-300", "bg-neutral-100", "text-neutral-700");
        } else {
          el.pl.classList.add("border-neutral-300");
        }
      }
      if (el.ex) {
        const expiresAt = s.subscription?.expiresAt || s.user.subscriptionExpiresAt || null;
        const isActive = plan === "premium";
        el.ex.classList.remove("hidden");
        el.ex.textContent = isActive
          ? (expiresAt ? `Активна до: ${fd(expiresAt)}` : SUBSCRIPTION_ACTIVE_LABEL)
          : SUBSCRIPTION_INACTIVE_LABEL;
        if (isActive && expiresAt) {
          el.ex.title = `Подписка активна до ${fd(expiresAt)}`;
        } else {
          el.ex.removeAttribute("title");
        }
      }
      if (el.choosePlan instanceof HTMLButtonElement) {
        el.choosePlan.classList.toggle("hidden", plan !== "none");
      }
      if (el.upg) {
        const link = el.upg.querySelector('[data-order-link][data-order-plan="premium"]');
        const messageNode = el.upg.firstChild;
        if (messageNode && messageNode.nodeType === Node.TEXT_NODE) {
          messageNode.textContent = `${PREMIUM_UPSELL_NOTE}. `;
        }
        if (link instanceof HTMLElement) {
          link.textContent = PREMIUM_CTA_LABEL;
        }
        el.upg.classList.toggle("hidden", plan !== "none");
      }
    };

    const renderHeaderStats = () => {
      const slugItems = Array.isArray(s.slugs) ? s.slugs : [];
      const analyticsSlugItems = Array.isArray(s.analyticsBootstrap?.slugs) ? s.analyticsBootstrap.slugs : [];
      const hasProfileSlugItems = slugItems.length > 0;
      const totalViews = hasProfileSlugItems
        ? slugItems.reduce((sum, item) => sum + Number(item?.stats?.views || 0), 0)
        : Number(s.analyticsPayload?.kpi?.views || 0);
      const cardsCount = hasProfileSlugItems ? slugItems.length : analyticsSlugItems.length;
      const ctrRaw = Number(s.analyticsPayload?.kpi?.ctr || 0);
      const unique = Number(s.analyticsPayload?.kpi?.uniqueVisitors || 0);
      const bestViews = Math.max(
        1,
        ...slugItems.map((item) => Number(item?.stats?.views || 0)),
      );
      const bars = slugItems.length
        ? slugItems.slice(0, 8).map((item) => {
          const ratio = Math.max(0.15, Number(item?.stats?.views || 0) / bestViews);
          return `<span class="${ratio > 0.75 ? "is-active" : ""}" style="height:${Math.round(ratio * 44)}px"></span>`;
        })
        : ['<span style="height:14px"></span>', '<span style="height:20px"></span>', '<span class="is-active" style="height:34px"></span>', '<span style="height:18px"></span>'];

      if (el.hdrViews) el.hdrViews.textContent = Number(totalViews).toLocaleString("ru-RU");
      if (el.hdrCards) el.hdrCards.textContent = String(cardsCount);
      if (el.hdrCtr) el.hdrCtr.textContent = `${Number(ctrRaw).toLocaleString("ru-RU")}%`;
      if (el.slugsKpiViews) el.slugsKpiViews.textContent = Number(totalViews).toLocaleString("ru-RU");
      if (el.slugsKpiUnique) el.slugsKpiUnique.textContent = Number(unique).toLocaleString("ru-RU");
      if (el.slugsMiniBars) el.slugsMiniBars.innerHTML = bars.join("");
      if (el.slugsSourceBars) {
        const sources = Object.entries(s.analyticsPayload?.chart?.trafficSources || {}).slice(0, 3);
        if (sources.length) {
          const total = Math.max(1, sources.reduce((sum, entry) => sum + Number(entry[1] || 0), 0));
          el.slugsSourceBars.innerHTML = sources
            .map((entry) => {
              const width = Math.max(8, Math.round((Number(entry[1] || 0) / total) * 100));
              return `<div class="source-track"><div class="source-fill" style="width:${width}%"></div></div>`;
            })
            .join("");
        } else {
          el.slugsSourceBars.innerHTML = '<div class="source-track"><div class="source-fill" style="width:60%"></div></div><div class="source-track"><div class="source-fill" style="width:36%"></div></div><div class="source-track"><div class="source-fill" style="width:22%"></div></div>';
        }
      }
    };

    const renderSlugs = () => {
      if (!el.slugs) return;
      const plan = getCurrentPlan();

      if (plan === "none") {
        if (el.addSlug instanceof HTMLButtonElement) {
          el.addSlug.classList.add("hidden");
        }
        if (el.addSlugNote) {
          el.addSlugNote.textContent = "";
        }
        el.slugs.innerHTML = renderStateCard({
          icon: "shopping",
          title: PREMIUM_ACTIVATION_TITLE,
          text: PREMIUM_ACTIVATION_TEXT,
          buttonId: "profile-slugs-order-btn",
          buttonLabel: PREMIUM_CTA_LABEL,
        });
        return;
      }

      if (!s.slugs.length) {
        el.slugs.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Пока нет UNQ. Оставь заявку на главной.</div>';
      } else {
        const canUseQr = plan === "premium";
        const qrAction = canUseQr
          ? (slug) =>
            `<button data-a="open-qr" data-slug="${esc(slug)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Мой QR</button>`
          : () => "";
        const visibility = resolveCardVisibility();
        const primarySlug = s.slugs.find((item) => item?.isPrimary) || s.slugs[0];
        const pauseMessage = String(primarySlug?.pauseMessage || "");
        const controls = `
          <article class="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-neutral-900">Статус визитки</p>
                <p class="mt-1 text-xs text-neutral-500">Выбранный статус применяется сразу ко всем вашим UNQ.</p>
              </div>
              ${visibility.mixed ? '<span class="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Разные статусы у UNQ</span>' : ""}
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              ${["active", "paused", "private"]
            .map((status) => {
              const isActive = visibility.status === status && !visibility.mixed;
              const statusLabel = cardVisibilityLabel(status);
              const statusTone = cardVisibilityTone(status);
              return `<button data-a="card-status" data-status="${status}" class="interactive-btn inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${isActive ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-900"}"><span class="status-dot ${statusTone}" aria-hidden="true"></span>${statusLabel}</button>`;
            })
            .join("")}
            </div>
            ${visibility.status === "paused"
            ? `<div class="mt-3 flex gap-2"><input data-card-pm value="${esc(pauseMessage)}" placeholder="Скоро вернусь · Пишите в Telegram" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"><button data-a="save-card-pm" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-3 py-2 text-sm">Сохранить сообщение</button></div>`
            : ""}
          </article>
        `;

        const slugCards = s.slugs
          .map((slugItem) => {
            const isPaused = normalizeCardVisibilityStatus(slugItem.status) === "paused";
            const canSellSlug = slugItem.type !== "free";
            const isOnSale = Boolean(slugItem.onSale);
            const salePriceValue = formatMoneyInput(slugItem.salePrice || "");

            return `<article class="interactive-card rounded-xl border border-neutral-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xl font-black">${esc(slugItem.fullSlug)}</p>
                <a href="/${encodeURIComponent(slugItem.fullSlug)}" target="_blank" class="text-sm text-neutral-500 hover:underline">unqx.uz/${esc(slugItem.fullSlug)}</a>
              </div>
              <div class="flex items-center gap-2">
                ${slugItem.isPrimary ? '<span class="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold">Основной</span>' : ""}
              </div>
            </div>
            ${isPaused && slugItem.pauseMessage
                ? `<p class="mt-3 text-xs text-neutral-500">Сообщение паузы: ${esc(slugItem.pauseMessage)}</p>`
                : ""
              }
            ${canSellSlug
                ? `<div class="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <label class="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-900">
                    <input type="checkbox" data-sale-toggle data-slug="${esc(slugItem.fullSlug)}" class="h-5 w-5 rounded border-neutral-300" ${isOnSale ? "checked" : ""}>
                    <span>Выставить на продажу</span>
                  </label>
                  <span class="text-xs font-medium text-neutral-500">${isOnSale ? "Показывается в профиле" : "Баббл скрыт"}</span>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <label class="min-w-[180px] flex-1">
                    <span class="sr-only">Цена продажи в UZS</span>
                    <input data-sale-price data-slug="${esc(slugItem.fullSlug)}" inputmode="numeric" value="${esc(salePriceValue)}" placeholder="120 000 000" class="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900" ${isOnSale ? "" : "disabled"}>
                  </label>
                  <button type="button" data-a="save-slug-sale" data-slug="${esc(slugItem.fullSlug)}" class="interactive-btn min-h-11 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold">Сохранить</button>
                </div>
              </div>`
                : ""
              }
            <div class="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
              ${slugItem.isPrimary ? "" : `<button data-a="primary" data-slug="${esc(slugItem.fullSlug)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Сделать основным</button>`}
              ${qrAction(slugItem.fullSlug)}
              <span>${Number(slugItem.stats?.views || 0).toLocaleString("ru-RU")} просмотров</span>
              <span>с ${fd(slugItem.stats?.since || slugItem.createdAt)}</span>
            </div>
          </article>`;
          })
          .join("");

        el.slugs.innerHTML = `${controls}${slugCards}`;
      }

      const count = s.slugs.length;

      if (el.addSlug && el.addSlugNote) {
        el.addSlug.classList.remove("hidden");
        if (plan !== "premium" && count >= 1) {
          el.addSlug.disabled = true;
          el.addSlug.textContent = PREMIUM_REQUIRED_TITLE;
          el.addSlugNote.textContent = PREMIUM_UPSELL_NOTE;
        } else if (plan === "premium" && count >= 3) {
          el.addSlug.disabled = true;
          el.addSlug.textContent = "Добавить UNQ";
          el.addSlugNote.textContent = "Достигнут лимит 3 UNQ для Премиум тарифа";
        } else {
          el.addSlug.disabled = false;
          el.addSlug.textContent = "Добавить UNQ";
          el.addSlugNote.textContent = "";
        }
      }
    };

    const renderTags = () => {
      if (!el.cTags) return;
      el.cTags.innerHTML = s.tags
        .map(
          (tag, index) =>
            `<span class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs">${esc(tag)} <button data-a="rm-tag" data-i="${index}" class="text-neutral-500">x</button></span>`,
        )
        .join("");
    };

    const buttonRow = (button, index) => {
      // Always use 'url' for editing; initialize from href/value if needed
      const url = typeof button.url === 'string' && button.url.length > 0
        ? button.url
        : (typeof button.href === 'string' && button.href.length > 0
          ? button.href
          : (typeof button.value === 'string' ? button.value : ''));
      const selectedType = Object.prototype.hasOwnProperty.call(buttonTypeLabels, button.type) ? button.type : "other";
      const options = buttonTypeOptions
        .map(([value, label]) => `<option value="${value}" ${selectedType === value ? "selected" : ""}>${label}</option>`)
        .join("");

      return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_1fr_auto]" data-bi="${index}">
      <select data-bf="type" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">${options}</select>
      <input data-bf="label" value="${esc(button.label || "")}" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <input data-bf="href" value="${esc(url)}" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
      <button data-a="rm-btn" data-i="${index}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" aria-label="Удалить">×</button>
    </div>`;
    };

    const renderButtons = () => {
      if (!el.cBtns) return;
      el.cBtns.innerHTML = s.buttons.map((button, index) => buttonRow(button, index)).join("");

      if (typeof Sortable !== "undefined" && !el.cBtns.dataset.sortable) {
        el.cBtns.dataset.sortable = "1";
        new Sortable(el.cBtns, {
          animation: 120,
          onEnd() {
            const rows = Array.from(el.cBtns.querySelectorAll("[data-bi]"));
            const next = [];
            rows.forEach((row) => {
              const i = Number(row.getAttribute("data-bi"));
              if (s.buttons[i]) next.push(s.buttons[i]);
            });
            s.buttons = next;
            renderButtons();
            renderPreview();
            saveDraft();
          },
        });
      }

      if (el.cBtnAdd) {
        const limit = getButtonLimit();
        const reached = Number.isFinite(limit) && s.buttons.length >= limit;
        el.cBtnAdd.disabled = reached;
        el.cBtnAdd.title = reached ? "Доступно на Премиум" : "";
      }
    };

    const renderPetsEditor = () => {
      if (!(el.cPetsList instanceof HTMLElement)) return;
      const catalog = normalizePetCatalog(s.petCatalog);
      const ownedPets = normalizeOwnedPets(s.pets);
      const ownedByType = new Map(ownedPets.map((pet) => [pet.petType, pet]));
      const pendingByType = new Map(
        (Array.isArray(s.requests) ? s.requests : [])
          .filter((item) => item?.type === "pet" && String(item?.status || "").toLowerCase() === "pending")
          .map((item) => [String(item.petType || "").trim().toLowerCase(), item]),
      );
      s.petDrafts = buildPetDraftMap({
        catalog,
        pets: ownedPets,
        requests: s.requests,
        previous: s.petDrafts,
      });

      if (!catalog.length) {
        el.cPetsList.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Каталог животных пока недоступен.</div>';
        return;
      }

      el.cPetsList.innerHTML = catalog
        .map((item) => {
          const owned = ownedByType.get(item.petType) || null;
          const pending = pendingByType.get(item.petType) || null;
          const draftName = String(s.petDrafts?.[item.petType] || "").trim();
          const inputValue = owned
            ? String(owned.displayName || "").trim()
            : pending
              ? String(pending.displayName || "").trim()
              : draftName;
          const stateBadge = owned
            ? '<span class="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Уже на визитке</span>'
            : pending
              ? '<span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Ожидает оплату</span>'
              : '<span class="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500">Доступен к покупке</span>';
          return `<article class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4" data-pet-card="${esc(item.petType)}">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="flex items-start gap-3">
                <img src="${esc(item.assetUrl)}" alt="${esc(item.label)}" class="h-20 w-20 shrink-0 object-contain" />
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="text-base font-bold text-neutral-900">${esc(item.label)}</h4>
                    ${stateBadge}
                  </div>
                  <p class="mt-1 text-sm text-neutral-500">${esc(item.description || "Декоративный питомец для профиля.")}</p>
                </div>
              </div>
              <div class="flex w-full flex-col gap-3 md:max-w-[320px]">
                <label class="block">
                  <span class="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Имя животного</span>
                  <input type="text" value="${esc(inputValue)}" maxlength="120" data-a="pet-name-input" data-pet-type="${esc(item.petType)}" class="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" placeholder="Например, Барсик" />
                </label>
                ${owned
                  ? `<label class="inline-flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">
                      <span>Показывать на визитке</span>
                      <input type="checkbox" data-a="pet-visible-toggle" data-pet-id="${esc(owned.id)}" ${owned.isVisible ? "checked" : ""} />
                    </label>`
                  : ""
                }
                ${owned
                  ? '<p class="text-xs text-neutral-500">Имя и видимость сохранятся вместе с визиткой.</p>'
                  : pending
                    ? `<button type="button" data-a="pay-request" data-order-id="${esc(pending.id)}" class="interactive-btn min-h-11 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">Продолжить оплату</button>`
                    : `<button type="button" data-a="buy-pet" data-pet-type="${esc(item.petType)}" class="interactive-btn min-h-11 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">Купить</button>`
                }
              </div>
            </div>
          </article>`;
        })
        .join("");
    };

    const renderTheme = () => {
      const premium = getCurrentPlan() === "premium";
      if (el.cThemeLock) el.cThemeLock.classList.toggle("hidden", premium);
      if (el.cThemeWrap) el.cThemeWrap.classList.toggle("opacity-60", !premium);

      el.cThemes.forEach((button) => {
        const on = button.getAttribute("data-theme") === s.theme;
        const themeId = button.getAttribute("data-theme") || "default_dark";
        const premiumOnly = PREMIUM_ONLY_THEMES.has(themeId);
        const locked = !premium && premiumOnly;
        button.setAttribute("aria-pressed", on ? "true" : "false");
        button.classList.toggle("selected", on);
        button.classList.toggle("bg-neutral-900", on);
        button.classList.toggle("text-white", on);
        button.disabled = locked;
        const swatchNode = button.querySelector("[data-theme-swatch]");
        if (swatchNode instanceof HTMLElement) {
          swatchNode.style.boxShadow = on
            ? "0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(17, 24, 39, 0.35)"
            : "none";
          swatchNode.style.transform = on ? "scale(1.06)" : "scale(1)";
          swatchNode.style.transition = "transform 140ms ease, box-shadow 140ms ease";
        }
        const lockNode = button.querySelector("[data-theme-lock]");
        if (lockNode instanceof HTMLElement) {
          lockNode.classList.toggle("hidden", premium || !locked);
          lockNode.classList.toggle("inline-flex", !premium && locked);
          // Force hide for premium users
          if (premium) {
            lockNode.style.display = 'none';
          } else if (!premium && locked) {
            lockNode.style.display = 'flex';
          } else {
            lockNode.style.display = '';
          }
        }
      });

      if (el.cBranding) el.cBranding.disabled = !premium;
    };

    const renderFrame = () => {
      const premium = getCurrentPlan() === "premium";
      if (el.cFrameLock) el.cFrameLock.classList.toggle("hidden", premium);
      if (el.cFrameWrap) el.cFrameWrap.classList.toggle("opacity-60", !premium);

      el.cFrames.forEach((button) => {
        const frameId = button.getAttribute("data-avatar-frame") || "none";
        const on = frameId === s.avatarFrame;
        const premiumOnly = PREMIUM_ONLY_AVATAR_FRAMES.has(frameId);
        const locked = !premium && premiumOnly;
        button.setAttribute("aria-pressed", on ? "true" : "false");
        button.classList.toggle("selected", on);
        button.classList.toggle("bg-neutral-900", on);
        button.classList.toggle("text-white", on);
        button.disabled = locked;

        const lockNode = button.querySelector("[data-frame-lock]");
        if (lockNode instanceof HTMLElement) {
          lockNode.classList.toggle("hidden", premium || !locked);
          lockNode.classList.toggle("inline-flex", !premium && locked);
          if (premium) {
            lockNode.style.display = "none";
          } else if (!premium && locked) {
            lockNode.style.display = "flex";
          } else {
            lockNode.style.display = "";
          }
        }
      });
    };

    const renderMusicTracks = () => {
      const premium = getCurrentPlan() === "premium";
      const tracks = normalizeTracks(s.tracks);
      if (el.cMusicWrap) el.cMusicWrap.classList.toggle("opacity-60", !premium);
      if (el.cMusicNote) {
        el.cMusicNote.textContent = premium
          ? (tracks.length ? "Трек будет доступен в публичном профиле." : "Администратор ещё не добавил треки.")
          : "Музыка профиля доступна на Премиум.";
      }
      const current = premium ? normalizeTrackId(s.selectedTrackId) : null;
      const currentTrack = current ? tracks.find((track) => track.id === current) : null;
      if (el.cMusicCurrent) {
        el.cMusicCurrent.textContent = !premium
          ? "Доступно на Премиум"
          : currentTrack
            ? currentTrack.title
            : (tracks.length ? "Без музыки" : "Треки не добавлены");
      }
      if (el.cMusicWrap) {
        el.cMusicWrap.classList.toggle("is-active", Boolean(currentTrack));
        el.cMusicWrap.classList.toggle("is-locked", !premium);
      }
      if (!el.cTrackOptions) return;
      const locked = !premium;
      const emptySelected = !current;
      const emptyLockedAttr = locked ? ' aria-disabled="true"' : "";
      const emptyClasses = [
        "profile-music-track-btn",
        "profile-style-choice-btn",
        emptySelected ? "selected bg-neutral-900 text-white" : "",
      ].filter(Boolean).join(" ");
      const trackButtons = tracks.map((track) => {
        const selected = track.id === current;
        const disabledAttr = locked ? ' aria-disabled="true"' : "";
        const classes = [
          "profile-music-track-btn",
          "profile-style-choice-btn",
          selected ? "selected bg-neutral-900 text-white" : "",
        ].filter(Boolean).join(" ");
        return `<button type="button" class="${classes}" data-profile-track-id="${esc(String(track.id))}" aria-pressed="${selected ? "true" : "false"}"${disabledAttr}>
          <span class="profile-music-track-swatch" aria-hidden="true">
            <svg class="icon-stroke" viewBox="0 0 24 24">
              <path d="M9 18V5l10-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="16" cy="16" r="3"></circle>
            </svg>
          </span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block font-semibold leading-tight">${esc(track.title)}</span>
            <span class="block truncate text-[10px] text-neutral-500">Трек профиля</span>
          </span>
        </button>`;
      });
      el.cTrackOptions.innerHTML = [
        `<button type="button" class="${emptyClasses}" data-profile-track-id="" aria-pressed="${emptySelected ? "true" : "false"}"${emptyLockedAttr}>
          <span class="profile-music-track-swatch" aria-hidden="true">
            <svg class="icon-stroke" viewBox="0 0 24 24">
              <path d="M4 4l16 16"></path>
              <path d="M9 15V5l10-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
            </svg>
          </span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block font-semibold leading-tight">Без музыки</span>
            <span class="block truncate text-[10px] text-neutral-500">Отключить плеер</span>
          </span>
        </button>`,
        ...trackButtons,
        !tracks.length
          ? `<p class="profile-music-empty-note">Администратор ещё не добавил треки.</p>`
          : "",
      ].join("");
    };

    const renderPetLibraryChoices = () => {
      const premium = getCurrentPlan() === "premium";
      const pets = normalizePetLibrary(s.petLibrary);
      const current = premium ? normalizeTrackId(s.selectedPetId) : null;
      const currentPet = current ? pets.find((pet) => pet.id === current) : null;
      if (el.cPetLibraryWrap) {
        el.cPetLibraryWrap.classList.toggle("opacity-60", !premium);
        el.cPetLibraryWrap.classList.toggle("is-active", Boolean(currentPet));
        el.cPetLibraryWrap.classList.toggle("is-locked", !premium);
      }
      if (el.cPetLibraryNote) {
        el.cPetLibraryNote.textContent = premium
          ? (pets.length ? "Питомец появится в правом нижнем углу визитки." : "Администратор ещё не добавил питомцев.")
          : "Питомцы профиля доступны на Премиум.";
      }
      if (el.cPetLibraryCurrent) {
        el.cPetLibraryCurrent.textContent = !premium
          ? "Доступно на Премиум"
          : currentPet
            ? currentPet.name
            : (pets.length ? "Без питомца" : "Питомцы не добавлены");
      }
      if (!el.cPetLibraryOptions) return;
      const locked = !premium;
      const disabledAttr = locked ? ' aria-disabled="true"' : "";
      const emptySelected = !current;
      const emptyClasses = [
        "profile-pet-library-btn",
        "profile-style-choice-btn",
        emptySelected ? "selected bg-neutral-900 text-white" : "",
      ].filter(Boolean).join(" ");
      const petButtons = pets.map((pet) => {
        const selected = pet.id === current;
        const classes = [
          "profile-pet-library-btn",
          "profile-style-choice-btn",
          selected ? "selected bg-neutral-900 text-white" : "",
        ].filter(Boolean).join(" ");
        return `<button type="button" class="${classes}" data-profile-pet-id="${esc(String(pet.id))}" aria-pressed="${selected ? "true" : "false"}"${disabledAttr}>
          <span class="profile-pet-library-swatch" aria-hidden="true">
            <img src="${esc(pet.imageUrl)}" alt="" loading="lazy" />
          </span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block font-semibold leading-tight">${esc(pet.name)}</span>
            <span class="block truncate text-[10px] text-neutral-500">Питомец профиля</span>
          </span>
        </button>`;
      });
      el.cPetLibraryOptions.innerHTML = [
        `<button type="button" class="${emptyClasses}" data-profile-pet-id="" aria-pressed="${emptySelected ? "true" : "false"}"${disabledAttr}>
          <span class="profile-pet-library-swatch" aria-hidden="true">Ø</span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block font-semibold leading-tight">Без питомца</span>
            <span class="block truncate text-[10px] text-neutral-500">Скрыть питомца</span>
          </span>
        </button>`,
        ...petButtons,
        !pets.length
          ? `<p class="profile-music-empty-note">Администратор ещё не добавил питомцев.</p>`
          : "",
      ].join("");
    };

    const renderEmojiBackgroundPack = () => {
      const premium = getCurrentPlan() === "premium";
      if (el.cEmojiPackLock) el.cEmojiPackLock.classList.toggle("hidden", premium);
      if (el.cEmojiPackWrap) el.cEmojiPackWrap.classList.toggle("opacity-60", !premium);

      el.cEmojiPacks.forEach((button) => {
        const packId = button.getAttribute("data-emoji-background-pack") || "none";
        const on = packId === s.emojiBackgroundPack;
        const premiumOnly = PREMIUM_ONLY_EMOJI_BACKGROUND_PACKS.has(packId);
        const locked = !premium && premiumOnly;
        button.setAttribute("aria-pressed", on ? "true" : "false");
        button.classList.toggle("selected", on);
        button.classList.toggle("bg-neutral-900", on);
        button.classList.toggle("text-white", on);
        button.disabled = locked;

        const swatchNode = button.querySelector("[data-emoji-pack-swatch]");
        if (swatchNode instanceof HTMLElement) {
          swatchNode.style.boxShadow = on
            ? "0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(17, 24, 39, 0.35)"
            : "none";
          swatchNode.style.transform = on ? "scale(1.06)" : "scale(1)";
          swatchNode.style.transition = "transform 140ms ease, box-shadow 140ms ease";
        }

        const lockNode = button.querySelector("[data-emoji-pack-lock]");
        if (lockNode instanceof HTMLElement) {
          lockNode.classList.toggle("hidden", premium || !locked);
          lockNode.classList.toggle("inline-flex", !premium && locked);
          if (premium) {
            lockNode.style.display = "none";
          } else if (!premium && locked) {
            lockNode.style.display = "flex";
          } else {
            lockNode.style.display = "";
          }
        }
      });
    };

    function buildPreviewCardData() {
      const avatarUrl = String(el.cAv?.getAttribute("src") || "").trim();
      const slugs = Array.isArray(s.slugs) ? s.slugs : [];
      const primarySlug =
        slugs.find((item) => item.isPrimary) ||
        slugs.find((item) => ["active", "approved", "paused", "private"].includes(item.status)) ||
        slugs[0] ||
        null;
      const effectivePlan = getCurrentPlan() === "premium" ? "premium" : "none";
      const effectiveTheme =
        effectivePlan === "premium" && PROFILE_THEMES.includes(s.theme) ? s.theme : "default_dark";
      const effectiveAvatarFrame =
        effectivePlan === "premium" && PROFILE_AVATAR_FRAMES.includes(s.avatarFrame) ? s.avatarFrame : "none";
      const effectiveEmojiBackgroundPack =
        effectivePlan === "premium" && PROFILE_EMOJI_BACKGROUND_PACKS.includes(s.emojiBackgroundPack)
          ? s.emojiBackgroundPack
          : "none";
      const selectedPetId = effectivePlan === "premium" ? normalizeTrackId(s.selectedPetId) : null;
      const selectedPet = selectedPetId
        ? normalizePetLibrary(s.petLibrary).find((pet) => pet.id === selectedPetId) || null
        : null;
      return {
        card: {
          slug: primarySlug?.fullSlug || "UNQ",
          name: el.cName?.value || s.user?.displayName || s.user?.firstName || "UNQX User",
          role:
            Boolean(s.user?.isVerified) &&
              String(s.verification?.latestRequest?.status || "").toLowerCase() === "approved"
              ? String(s.verification?.latestRequest?.role || "").trim()
              : "",
          phone: "",
          hashtag: String(el.cHashtag?.value || "").trim(),
          address: String(el.cAddress?.value || "").trim(),
          postcode: String(el.cPostcode?.value || "").trim(),
          email: String(el.cEmail?.value || "").trim(),
          extraPhone: String(el.cExtraPhone?.value || "").trim(),
          avatarUrl: avatarUrl && !avatarUrl.includes(DEFAULT_PROFILE_AVATAR) ? avatarUrl : null,
          tags: (s.tags || []).map((tag) => ({ label: String(tag || "") })),
          buttons: (s.buttons || []).map((button) => ({
            type: String(button?.type || "other")
              .trim()
              .toLowerCase(),
            label: button?.label || "",
            url: String(button?.href || button?.value || "").trim(),
          })),
          verified: Boolean(s.user?.isVerified),
          verifiedCompany: String(s.user?.verifiedCompany || "").trim(),
          tariff: effectivePlan,
          theme: effectiveTheme,
          avatarFrame: effectiveAvatarFrame,
          emojiBackgroundPack: effectiveEmojiBackgroundPack,
          showBranding: el.cBranding ? !el.cBranding.checked : true,
          bio: String(el.cBio?.value || "").trim(),
          pets: normalizeOwnedPets(s.pets),
          selectedPet,
        },
        primarySlug,
      };
    }

    const renderPreview = () => {
      if (!(el.cPrev instanceof HTMLElement) || typeof window.CardView === "undefined") return;
      const { card, primarySlug } = buildPreviewCardData();
      el.cPrev.dataset.previewTheme = String(card.theme || "default_dark");
      el.cPrev.dataset.previewFrame = String(card.avatarFrame || "none");
      el.cPrev.dataset.previewEmojiBackgroundPack = String(card.emojiBackgroundPack || "none");
      const slugLabel = primarySlug?.fullSlug || "[UNQ]";
      if (el.cPrevLabel) {
        el.cPrevLabel.textContent = `unqx.uz/${slugLabel}`;
      }
      if (el.cPrevLink) {
        el.cPrevLink.href = primarySlug ? `/${encodeURIComponent(primarySlug.fullSlug)}` : "#";
        el.cPrevLink.classList.toggle("pointer-events-none", !primarySlug);
        el.cPrevLink.classList.toggle("opacity-50", !primarySlug);
      }

      window.CardView.mountCardView(el.cPrev, card, {
        shareUrl: primarySlug ? `${location.origin}/${encodeURIComponent(primarySlug.fullSlug)}` : location.href,
        showPausedBanner: primarySlug?.status === "paused",
        pausedText: "Визитка на паузе - посетители видят заглушку",
        viewsLabel: `${Number(primarySlug?.stats?.views || 0).toLocaleString("ru-RU")} просмотров`,
      });
    };

    const renderCard = () => {
      const plan = getCurrentPlan();
      if (plan === "none") {
        if (el.cContent instanceof HTMLElement) el.cContent.classList.add("hidden");
        if (el.cEmpty instanceof HTMLElement) {
          el.cEmpty.classList.remove("hidden");
          el.cEmpty.innerHTML = renderStateCard({
            icon: "credit-card",
            title: "Визитка недоступна",
            text: "Создать визитку можно после покупки тарифа и активации UNQ.",
            buttonId: "profile-card-order-btn",
            buttonLabel: "Выбрать тариф >",
          });
        }
        return;
      }
      if (el.cContent instanceof HTMLElement) el.cContent.classList.remove("hidden");
      if (el.cEmpty instanceof HTMLElement) el.cEmpty.classList.add("hidden");

      const card = s.card || {};

      if (el.cAv) el.cAv.src = avatarSrc(card.avatarUrl || s.user?.photoUrl);
      if (el.cName) el.cName.value = card.name || s.user?.displayName || s.user?.firstName || "";
      if (el.cBio) el.cBio.value = card.bio || "";
      if (el.cHashtag) el.cHashtag.value = card.hashtag || "";
      if (el.cAddress) el.cAddress.value = card.address || "";
      if (el.cPostcode) el.cPostcode.value = card.postcode || "";
      if (el.cEmail) el.cEmail.value = card.email || "";
      if (el.cExtraPhone) el.cExtraPhone.value = card.extraPhone || "";
      if (el.cBranding) el.cBranding.checked = card.showBranding === false;

      s.tags = Array.isArray(card.tags) ? card.tags.slice(0) : [];
      s.buttons = normalizeEditorButtons(card.buttons);
      s.pets = normalizeOwnedPets(card.pets || s.pets);
      s.selectedPetId = getCurrentPlan() === "premium" ? normalizeTrackId(card.selectedPetId) : null;
      s.petDrafts = buildPetDraftMap({
        catalog: s.petCatalog,
        pets: s.pets,
        requests: s.requests,
        previous: s.petDrafts,
      });
      s.theme = PROFILE_THEMES.includes(card.theme) ? card.theme : "default_dark";
      if (plan !== "premium" && PREMIUM_ONLY_THEMES.has(s.theme)) {
        s.theme = "default_dark";
      }
      const cardAvatarFrame = String(card.avatarFrame || "").trim().toLowerCase();
      s.avatarFrame = PROFILE_AVATAR_FRAMES.includes(cardAvatarFrame) ? cardAvatarFrame : "none";
      if (plan !== "premium" && PREMIUM_ONLY_AVATAR_FRAMES.has(s.avatarFrame)) {
        s.avatarFrame = "none";
      }
      const cardEmojiBackgroundPack = String(card.emojiBackgroundPack || "").trim().toLowerCase();
      s.emojiBackgroundPack = PROFILE_EMOJI_BACKGROUND_PACKS.includes(cardEmojiBackgroundPack)
        ? cardEmojiBackgroundPack
        : "none";
      if (plan !== "premium" && PREMIUM_ONLY_EMOJI_BACKGROUND_PACKS.has(s.emojiBackgroundPack)) {
        s.emojiBackgroundPack = "none";
      }

      if (el.cBioC) el.cBioC.textContent = `${el.cBio?.value.length || 0}/120`;

      renderTags();
      renderButtons();
      renderPetsEditor();
      renderCardEditorCategory();
      renderTheme();
      renderEmojiBackgroundPack();
      renderFrame();
      renderMusicTracks();
      renderPetLibraryChoices();
      renderPreview();
      syncCardDraftState();

    };

    const renderWallSummary = () => {
      if (!(el.wallSummary instanceof HTMLElement)) return;
      const summary = normalizeWallSummary(s.wallSummary);
      if (!summary.canUseWall) {
        el.wallSummary.classList.remove("hidden");
        el.wallSummary.innerHTML = renderStateCard({
          icon: "credit-card",
          title: "Стена недоступна без Премиум",
          text: "Подключи Премиум, чтобы публиковать посты на своей визитке, собирать лайки и комментарии.",
          buttonId: "profile-posts-order-btn",
          buttonLabel: PREMIUM_CTA_LABEL,
        });
        return;
      }
      el.wallSummary.innerHTML = "";
      el.wallSummary.classList.add("hidden");
    };

    const showWallLimitReachedModal = (summaryLike) => {
      const summary = normalizeWallSummary(summaryLike);
      showModal(
        "Лимит дня исчерпан",
        `Сегодняшний лимит публикаций использован (${Math.max(1, Number(summary.todayPostCount || 1))}/1). Следующий пост можно опубликовать после ${fht(summary.nextPostAt)}.`,
      );
    };

    const updateWallComposerState = () => {
      if (!(el.wallEditor instanceof HTMLTextAreaElement)) return;
      const summary = normalizeWallSummary(s.wallSummary);
      const draftValue = String(s.wallDraftContent || "").slice(0, WALL_POST_CONTENT_MAX);
      if (el.wallOpenComposer instanceof HTMLButtonElement) {
        el.wallOpenComposer.disabled = Boolean(s.wallSaving);
        el.wallOpenComposer.textContent = summary.canUseWall ? "Добавить пост" : PREMIUM_CTA_LABEL;
      }
      if (el.wallEditor.value !== draftValue) {
        el.wallEditor.value = draftValue;
      }
      if (el.wallCounter instanceof HTMLElement) {
        el.wallCounter.textContent = `${draftValue.length}/${WALL_POST_CONTENT_MAX}`;
      }
      if (el.wallEditorTitle instanceof HTMLElement) {
        el.wallEditorTitle.textContent = s.wallEditingId ? "Редактировать пост" : "Новый пост";
      }
      if (el.wallEditorNote instanceof HTMLElement) {
        if (s.wallEditingId) {
          const activePost = currentWallPost();
          el.wallEditorNote.textContent =
            activePost?.status === "hidden"
              ? "Пост скрыт админом. После сохранения текст обновится, но пост останется скрытым."
              : "Редактирование не тратит дневной лимит.";
        } else if (summary.canUseWall && !summary.canPostNow) {
          el.wallEditorNote.textContent = `Сегодня лимит уже использован. Следующий пост после ${fht(summary.nextPostAt)}.`;
        } else if (summary.canUseWall) {
          el.wallEditorNote.textContent = "Короткий текст без фото, до 280 символов.";
        } else {
          el.wallEditorNote.textContent = "Подключи Премиум, чтобы открыть стену.";
        }
      }
      if (el.wallCommentsEnabled instanceof HTMLInputElement) {
        el.wallCommentsEnabled.checked = s.wallDraftCommentsEnabled !== false;
        el.wallCommentsEnabled.disabled = !summary.canUseWall || Boolean(s.wallSaving);
      }
      if (el.wallSubmit instanceof HTMLButtonElement) {
        const canSubmit = summary.canUseWall && draftValue.trim().length > 0 && (s.wallEditingId || summary.canPostNow);
        el.wallSubmit.textContent = s.wallEditingId ? "Сохранить" : "Опубликовать";
        el.wallSubmit.disabled = !canSubmit || Boolean(s.wallSaving);
      }
      if (el.wallCancel instanceof HTMLButtonElement) {
        el.wallCancel.classList.toggle("hidden", !s.wallEditingId);
        el.wallCancel.disabled = Boolean(s.wallSaving);
      }
      if (el.wallComposerClose instanceof HTMLButtonElement) {
        el.wallComposerClose.disabled = Boolean(s.wallSaving);
      }
      if (el.wallComposerCloseTop instanceof HTMLButtonElement) {
        el.wallComposerCloseTop.disabled = Boolean(s.wallSaving);
      }
      if (el.wallComposer instanceof HTMLElement) {
        el.wallComposer.classList.toggle("opacity-60", !summary.canUseWall);
      }
      el.wallEditor.disabled = !summary.canUseWall || Boolean(s.wallSaving);
    };

    const renderWallComments = (post) => {
      const comments = Array.isArray(post.comments) ? post.comments : [];
      const commentsEnabled = post.commentsEnabled !== false;
      if (!commentsEnabled) {
        return "";
      }
      const isExpanded = isWallCommentsExpanded(post.id);
      const hasHiddenComments = comments.length > WALL_VISIBLE_COMMENT_COUNT;
      const visibleComments =
        hasHiddenComments && !isExpanded
          ? comments.slice(-WALL_VISIBLE_COMMENT_COUNT)
          : comments;
      const draftValue = getWallCommentDraft(post.id);
      const isCommentBusy = s.wallBusyCommentPostIds instanceof Set && s.wallBusyCommentPostIds.has(post.id);
      const commentsHtml = visibleComments.length
        ? visibleComments
          .map((comment) => `
            <article class="profile-wall-comment rounded-xl border border-neutral-200 bg-neutral-50 p-3" data-wall-comment-id="${esc(comment.id)}">
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <div class="profile-wall-comment-avatar">
                    ${comment.author?.avatarUrl
                ? `<img src="${esc(comment.author.avatarUrl)}" alt="${esc(comment.author.name || "UNQX User")}" class="profile-wall-comment-avatar-img" />`
                : `<span>${esc(comment.author?.initials || "UN")}</span>`}
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold text-neutral-900">${esc(comment.author?.name || "UNQX User")}</p>
                      <p class="text-xs text-neutral-500">${esc(fht(comment.createdAt))}</p>
                    </div>
                    <div class="mt-1 whitespace-pre-line text-sm leading-6 text-neutral-700">${esc(comment.content)}</div>
                  </div>
                </div>
                ${comment.viewerCanDelete
              ? `<button type="button" data-wall-comment-action="delete" data-wall-post-id="${esc(post.id)}" data-wall-comment-id="${esc(comment.id)}" class="interactive-btn rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700" ${(s.wallBusyCommentIds instanceof Set && s.wallBusyCommentIds.has(comment.id)) ? "disabled" : ""}>${(s.wallBusyCommentIds instanceof Set && s.wallBusyCommentIds.has(comment.id)) ? "Удаление..." : "Удалить"}</button>`
              : ""}
              </div>
            </article>
          `)
          .join("")
        : `<div class="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-500">${commentsEnabled ? "Комментариев пока нет." : "Комментарии отключены автором."}</div>`;
      const commentsToggleHtml = hasHiddenComments
        ? `
          <button
            type="button"
            data-wall-comments-toggle
            data-wall-post-id="${esc(post.id)}"
            class="interactive-btn mt-3 inline-flex min-h-9 items-center rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700"
            aria-expanded="${isExpanded ? "true" : "false"}"
          >${isExpanded ? "Свернуть комментарии" : `Показать ещё ${comments.length - visibleComments.length}`}</button>
        `
        : "";
      const formHtml =
        post.status === "published" && commentsEnabled
          ? `
            <div class="profile-wall-comment-form mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <label class="sr-only" for="profile-wall-comment-${esc(post.id)}">Комментарий</label>
              <textarea id="profile-wall-comment-${esc(post.id)}" data-wall-comment-input data-wall-post-id="${esc(post.id)}" rows="3" maxlength="${WALL_COMMENT_CONTENT_MAX}" placeholder="Напиши комментарий..." class="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400">${esc(draftValue)}</textarea>
              <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p data-wall-comment-counter class="text-xs font-semibold text-neutral-500">${draftValue.length}/${WALL_COMMENT_CONTENT_MAX}</p>
                <button type="button" data-wall-comment-submit data-wall-post-id="${esc(post.id)}" class="interactive-btn min-h-11 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white" ${isCommentBusy ? "disabled" : ""}>${isCommentBusy ? "Отправка..." : "Отправить"}</button>
              </div>
            </div>
          `
          : post.status !== "published"
            ? '<p class="mt-3 text-xs text-neutral-500">Новые комментарии доступны только для опубликованных постов.</p>'
            : '<p class="mt-3 text-xs text-neutral-500">Комментарии отключены автором для этого поста.</p>';
      return `
        <section class="mt-4 border-t border-neutral-100 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.12em] text-neutral-500">Комментарии</p>
            <p class="text-xs text-neutral-500">${Number(post.commentsCount || comments.length).toLocaleString("ru-RU")} всего</p>
          </div>
          <div class="mt-3 space-y-3${isExpanded && hasHiddenComments ? " overflow-y-auto pr-1" : ""}"${isExpanded && hasHiddenComments ? ' style="max-height:420px;"' : ""}>${commentsHtml}</div>
          ${commentsToggleHtml}
          ${formHtml}
        </section>
      `;
    };

    const renderWallList = () => {
      if (!(el.wallList instanceof HTMLElement)) return;
      const summary = normalizeWallSummary(s.wallSummary);
      const items = Array.isArray(s.wallPosts) ? s.wallPosts : [];

      if (!summary.canUseWall) {
        el.wallList.innerHTML = "";
        if (el.wallLoadMore instanceof HTMLButtonElement) {
          el.wallLoadMore.classList.add("hidden");
        }
        return;
      }

      if (s.wallLoading && !s.wallLoaded) {
        el.wallList.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Загружаем посты...</div>';
        return;
      }

      if (!items.length) {
        el.wallList.innerHTML = '<div class="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">Пока нет постов. Опубликуй первый пост для своей публичной визитки.</div>';
      } else {
        el.wallList.innerHTML = items
          .map((item) => {
            const statusTone = item.status === "hidden" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
            const commentsStatusHtml = item.commentsEnabled === false
              ? '<span class="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">Комментарии отключены</span>'
              : "";
            return `
              <article class="profile-wall-post rounded-xl border border-neutral-200 bg-white p-4" data-wall-post-id="${esc(item.id)}">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold text-neutral-900">${esc(s.user?.displayName || s.user?.firstName || s.user?.username || "UNQX User")}</p>
                      <span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}">${esc(item.statusLabel || (item.status === "hidden" ? "Скрыт" : "Опубликован"))}</span>
                      ${commentsStatusHtml}
                    </div>
                    <p class="mt-1 text-xs text-neutral-500">${esc(fht(item.createdAt))}${item.isEdited ? " • изменено" : ""}</p>
                  </div>
                  <div class="text-right text-xs text-neutral-500">
                    <p>${Number(item.likesCount || 0).toLocaleString("ru-RU")} лайков</p>
                    <p class="mt-1">${Number(item.commentsCount || 0).toLocaleString("ru-RU")} комментариев</p>
                  </div>
                </div>
                <div class="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-800">${esc(item.content)}</div>
                ${renderWallComments(item)}
                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" data-wall-action="edit" data-wall-post-id="${esc(item.id)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700">Редактировать</button>
                  <button type="button" data-wall-action="delete" data-wall-post-id="${esc(item.id)}" class="interactive-btn min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Удалить</button>
                </div>
              </article>
            `;
          })
          .join("");
      }

      if (el.wallLoadMore instanceof HTMLButtonElement) {
        el.wallLoadMore.textContent = s.wallLoading && s.wallLoaded ? "Загрузка..." : "Показать ещё";
        el.wallLoadMore.disabled = Boolean(s.wallLoading);
        el.wallLoadMore.classList.toggle("hidden", !s.wallPagination?.hasMore);
      }
    };

    const renderWall = () => {
      renderWallSummary();
      updateWallComposerState();
      renderWallList();
    };

    const renderCommunityTabBadge = () => {
      if (!(el.communityTabUnread instanceof HTMLElement)) {
        return;
      }
      const unread = Math.max(0, Number(s.followSummary?.unreadFollowersCount || 0));
      el.communityTabUnread.textContent = unread > 99 ? "99+" : String(unread || "");
      el.communityTabUnread.classList.toggle("hidden", unread <= 0);
    };

    const renderCommunity = () => {
      const summary = normalizeFollowSummary(s.followSummary);
      const type = normalizeCommunityType(s.communityType);
      const items = Array.isArray(s.communityItems) ? s.communityItems : [];

      renderCommunityTabBadge();

      if (el.communitySummary instanceof HTMLElement) {
        el.communitySummary.innerHTML = `
          <article class="rounded-xl border border-neutral-200 bg-white p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-neutral-500">Подписчики</p>
            <p class="mt-2 text-2xl font-black text-neutral-900">${Number(summary.counts.followers || 0).toLocaleString("ru-RU")}</p>
            <p class="mt-1 text-sm text-neutral-500">Люди, которые следят за твоей визиткой.</p>
          </article>
          <article class="rounded-xl border border-neutral-200 bg-white p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-neutral-500">Подписки</p>
            <p class="mt-2 text-2xl font-black text-neutral-900">${Number(summary.counts.following || 0).toLocaleString("ru-RU")}</p>
            <p class="mt-1 text-sm text-neutral-500">Кого ты читаешь и поддерживаешь.</p>
          </article>
          <article class="rounded-xl border border-neutral-200 bg-white p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-neutral-500">Новые подписчики</p>
            <p class="mt-2 text-2xl font-black text-neutral-900">${Number(summary.unreadFollowersCount || 0).toLocaleString("ru-RU")}</p>
            <p class="mt-1 text-sm text-neutral-500">Сбрасывается, когда открываешь вкладку сообщества.</p>
          </article>
        `;
      }

      if (el.communityFilters instanceof HTMLElement) {
        el.communityFilters.innerHTML = `
          <button type="button" data-community-type="followers" class="interactive-btn min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${type === "followers" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}">
            Подписчики
          </button>
          <button type="button" data-community-type="following" class="interactive-btn min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${type === "following" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}">
            Подписки
          </button>
        `;
      }

      if (el.communityList instanceof HTMLElement) {
        if (s.communityLoading && !s.communityLoaded) {
          el.communityList.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Загружаем сообщество...</div>';
        } else if (!items.length) {
          el.communityList.innerHTML = `<div class="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">${type === "followers" ? "У тебя пока нет подписчиков." : "Ты пока ни на кого не подписан."}</div>`;
        } else {
          el.communityList.innerHTML = items
            .map((item) => {
              const unavailableBadge = item.isPubliclyReachable
                ? ""
                : '<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Визитка недоступна</span>';
              const isBusyFollow = s.communityBusySlugs instanceof Set && s.communityBusySlugs.has(String(item.primarySlug || "").trim().toUpperCase());
              const followButton = item.canFollow
                ? `<button type="button" data-community-follow-toggle data-community-slug="${esc(item.primarySlug)}" data-community-following="${item.isFollowing ? "true" : "false"}" class="interactive-btn min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${item.isFollowing ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}" ${isBusyFollow ? "disabled" : ""}>
                    ${isBusyFollow ? "..." : item.isFollowing ? "Отписаться" : "Подписаться"}
                  </button>`
                : "";
              return `
                <article class="rounded-xl border border-neutral-200 bg-white p-4">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex min-w-0 items-center gap-3">
                      <span class="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-sm font-semibold text-neutral-600">
                        ${item.avatarUrl
                          ? `<img src="${esc(item.avatarUrl)}" alt="${esc(item.name)}" class="h-full w-full object-cover" />`
                          : esc(item.initials)}
                      </span>
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          ${item.profileHref
                            ? `<a href="${esc(item.profileHref)}" target="_blank" rel="noopener noreferrer" class="truncate text-sm font-semibold text-neutral-900 hover:underline">${esc(item.name)}</a>`
                            : `<span class="truncate text-sm font-semibold text-neutral-900">${esc(item.name)}</span>`}
                          ${unavailableBadge}
                        </div>
                        <p class="mt-1 truncate text-xs text-neutral-500">${esc(item.primarySlug ? `unqx.uz/${item.primarySlug}` : "Публичный адрес недоступен")}</p>
                        <p class="mt-1 text-xs text-neutral-500">${esc(item.role || "Без роли")}</p>
                        ${item.followedAt ? `<p class="mt-1 text-[11px] uppercase tracking-[0.12em] text-neutral-400">${type === "followers" ? "Подписался" : "Ты подписан"}: ${esc(fdt(item.followedAt))}</p>` : ""}
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      ${followButton}
                    </div>
                  </div>
                </article>
              `;
            })
            .join("");
        }
      }

      if (el.communityLoadMore instanceof HTMLButtonElement) {
        el.communityLoadMore.textContent = s.communityLoading && s.communityLoaded ? "Загрузка..." : "Показать ещё";
        el.communityLoadMore.disabled = Boolean(s.communityLoading);
        el.communityLoadMore.classList.toggle("hidden", !s.communityPagination?.hasMore);
      }
    };

    const loadCommunity = async ({ append = false } = {}) => {
      if (s.communityLoading) {
        return;
      }
      s.communityLoading = true;
      renderCommunity();

      try {
        const type = normalizeCommunityType(s.communityType);
        const nextPage = append ? Number(s.communityPagination?.page || 1) + 1 : 1;
        const payload = await api(`/api/profile/follows?type=${encodeURIComponent(type)}&page=${encodeURIComponent(nextPage)}&pageSize=${encodeURIComponent(COMMUNITY_PAGE_SIZE)}`);
        const nextItems = Array.isArray(payload.items) ? payload.items.map(normalizeCommunityItem).filter(Boolean) : [];
        s.communityType = type;
        s.communityItems = append
          ? [...(Array.isArray(s.communityItems) ? s.communityItems : []), ...nextItems]
          : nextItems;
        s.communityPagination = normalizeCommunityPagination(payload.pagination);
        s.communityLoaded = true;
        renderCommunity();
      } catch (error) {
        s.communityLoaded = true;
        showModal("Ошибка", error.message || "Не удалось загрузить подписки");
      } finally {
        s.communityLoading = false;
        renderCommunity();
      }
    };

    const markCommunityNotificationsRead = async (fallbackUnreadCount = 0) => {
      if (s.communityUnreadMarking) {
        return;
      }
      s.communityUnreadMarking = true;
      try {
        await api("/api/profile/follows/notifications/read-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch (error) {
        s.followSummary = {
          ...normalizeFollowSummary(s.followSummary),
          unreadFollowersCount: Math.max(0, Number(fallbackUnreadCount || 0)),
        };
        renderCommunity();
      } finally {
        s.communityUnreadMarking = false;
        renderCommunityTabBadge();
      }
    };

    const setCommunityType = (value) => {
      const nextType = normalizeCommunityType(value);
      if (nextType === normalizeCommunityType(s.communityType) && s.communityLoaded) {
        renderCommunity();
        return;
      }
      s.communityType = nextType;
      s.communityItems = [];
      s.communityPagination = emptyCommunityPagination();
      s.communityLoaded = false;
      renderCommunity();
      void loadCommunity();
    };

    const patchCommunityFollowingCount = (delta) => {
      const normalizedDelta = Number(delta);
      if (!Number.isFinite(normalizedDelta) || !normalizedDelta) {
        return;
      }
      const summary = normalizeFollowSummary(s.followSummary);
      s.followSummary = {
        ...summary,
        counts: {
          ...summary.counts,
          following: Math.max(0, Number(summary.counts.following || 0) + normalizedDelta),
        },
      };
    };

    const patchCommunityItemsFollowState = (slug, isFollowing) => {
      const normalizedSlug = String(slug || "").trim().toUpperCase();
      if (!normalizedSlug) {
        return;
      }
      s.communityItems = Array.isArray(s.communityItems)
        ? s.communityItems.map((item) => {
          if (String(item?.primarySlug || "").trim().toUpperCase() !== normalizedSlug) {
            return item;
          }
          return {
            ...item,
            isFollowing,
          };
        })
        : [];
    };

    const toggleCommunityFollow = async (slug, following) => {
      const normalizedSlug = String(slug || "").trim().toUpperCase();
      if (!normalizedSlug) {
        return;
      }
      if (!(s.communityBusySlugs instanceof Set)) {
        s.communityBusySlugs = new Set();
      }
      if (s.communityBusySlugs.has(normalizedSlug)) {
        return;
      }
      s.communityBusySlugs.add(normalizedSlug);
      renderCommunity();

      try {
        await api(`/api/cards/${encodeURIComponent(normalizedSlug)}/follow`, {
          method: following ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        const type = normalizeCommunityType(s.communityType);
        const nextIsFollowing = !following;
        patchCommunityFollowingCount(nextIsFollowing ? 1 : -1);

        if (type === "following" && !nextIsFollowing) {
          s.communityItems = Array.isArray(s.communityItems)
            ? s.communityItems.filter((item) => String(item?.primarySlug || "").trim().toUpperCase() !== normalizedSlug)
            : [];
          s.communityPagination = {
            ...normalizeCommunityPagination(s.communityPagination),
            total: Math.max(0, Number(s.communityPagination?.total || 0) - 1),
          };
        } else {
          patchCommunityItemsFollowState(normalizedSlug, nextIsFollowing);
        }
        renderCommunity();
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось обновить подписку");
      } finally {
        s.communityBusySlugs.delete(normalizedSlug);
        renderCommunity();
      }
    };

    const loadWallPosts = async ({ append = false } = {}) => {
      const summary = normalizeWallSummary(s.wallSummary);
      if (!summary.canUseWall || s.wallLoading) {
        return;
      }

      s.wallLoading = true;
      renderWallList();

      try {
        const nextPage = append ? Number(s.wallPagination?.page || 1) + 1 : 1;
        const payload = await api(`/api/profile/wall-posts?page=${encodeURIComponent(nextPage)}&pageSize=${encodeURIComponent(WALL_POST_PAGE_SIZE)}`);
        const nextItems = Array.isArray(payload.items) ? payload.items.map(normalizeWallPost).filter(Boolean) : [];
        s.wallPosts = append ? mergeWallItems(s.wallPosts, nextItems) : nextItems;
        s.wallPagination = normalizeWallPagination(payload.pagination);
        s.wallLoaded = true;
        renderWall();
      } catch (error) {
        s.wallLoaded = true;
        showModal("Ошибка", error.message || "Не удалось загрузить посты");
      } finally {
        s.wallLoading = false;
        renderWallList();
      }
    };

    const startWallEdit = (postId) => {
      const post = Array.isArray(s.wallPosts) ? s.wallPosts.find((item) => item.id === postId) : null;
      if (!post) return;
      s.wallEditingId = post.id;
      s.wallDraftContent = String(post.content || "");
      s.wallDraftCommentsEnabled = post.commentsEnabled !== false;
      updateWallComposerState();
      openWallComposerModal({ mode: "edit" });
    };

    const submitWallPost = async () => {
      const summary = normalizeWallSummary(s.wallSummary);
      const content = String(s.wallDraftContent || "").trim();
      const commentsEnabled = s.wallDraftCommentsEnabled !== false;
      if (!summary.canUseWall || !content) {
        return;
      }
      if (!s.wallEditingId && !summary.canPostNow) {
        showWallLimitReachedModal(summary);
        return;
      }

      s.wallSaving = true;
      updateWallComposerState();

      try {
        if (s.wallEditingId) {
          const payload = await api(`/api/profile/wall-posts/${encodeURIComponent(s.wallEditingId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, commentsEnabled }),
          });
          replaceWallPost(payload.post);
          resetWallComposer();
          closeWallComposerModal();
          renderWall();
          showSaveAlert("Пост обновлён");
          return;
        }

        const payload = await api("/api/profile/wall-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, commentsEnabled }),
        });
        const nextPost = normalizeWallPost(payload.post);
        s.wallSummary = normalizeWallSummary(payload.wallSummary);
        if (nextPost) {
          s.wallPosts = [nextPost, ...(Array.isArray(s.wallPosts) ? s.wallPosts : [])];
          s.wallPagination = {
            ...normalizeWallPagination(s.wallPagination),
            total: Math.max(Number(s.wallPagination?.total || 0) + 1, 1),
            hasMore: Math.max(Number(s.wallPagination?.total || 0) + 1, 1) > Number(s.wallPagination?.pageSize || WALL_POST_PAGE_SIZE),
          };
        }
        s.wallLoaded = true;
        resetWallComposer();
        closeWallComposerModal();
        renderWall();
        showSaveAlert("Пост опубликован");
      } catch (error) {
        if (error.code === "WALL_POST_LIMIT_REACHED") {
          s.wallSummary = {
            ...normalizeWallSummary(s.wallSummary),
            canUseWall: true,
            canPostNow: false,
            nextPostAt: error?.payload?.nextPostAt || summary.nextPostAt,
            todayPostCount: Math.max(1, Number(error?.payload?.todayPostCount || 1)),
          };
          renderWall();
          showWallLimitReachedModal(s.wallSummary);
          return;
        }
        showModal("Ошибка", error.message || "Не удалось сохранить пост");
      } finally {
        s.wallSaving = false;
        updateWallComposerState();
      }
    };

    const submitWallComment = async (postId) => {
      const normalizedPostId = String(postId || "").trim();
      const currentPost = Array.isArray(s.wallPosts) ? s.wallPosts.find((item) => item.id === normalizedPostId) : null;
      if (currentPost && currentPost.commentsEnabled === false) {
        showModal("Комментарии недоступны", "Комментарии отключены автором для этого поста.");
        return;
      }
      const liveDraft = readWallCommentDraft(normalizedPostId);
      if (liveDraft !== getWallCommentDraft(normalizedPostId)) {
        setWallCommentDraft(normalizedPostId, liveDraft);
      }
      const content = getWallCommentDraft(normalizedPostId).trim();
      if (!normalizedPostId) {
        return;
      }
      if (!content) {
        getWallCommentInput(normalizedPostId)?.focus();
        showModal("Комментарий пустой", "Введите текст комментария перед отправкой.");
        return;
      }

      if (!(s.wallBusyCommentPostIds instanceof Set)) {
        s.wallBusyCommentPostIds = new Set();
      }
      s.wallBusyCommentPostIds.add(normalizedPostId);
      renderWall();

      try {
        const payload = await api(`/api/profile/wall-posts/${encodeURIComponent(normalizedPostId)}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        replaceWallPost(payload.post);
        setWallCommentsExpanded(normalizedPostId, true);
        clearWallCommentDraft(normalizedPostId);
        renderWall();
        showSaveAlert("Комментарий опубликован");
      } catch (error) {
        if (error.code === "WALL_POST_NOT_COMMENTABLE") {
          showModal("Комментарии недоступны", error.message || "Комментирование доступно только для опубликованных постов.");
          return;
        }
        showModal("Ошибка", error.message || "Не удалось отправить комментарий");
      } finally {
        s.wallBusyCommentPostIds.delete(normalizedPostId);
        renderWall();
      }
    };

    const deleteWallComment = (postId, commentId) => {
      const normalizedPostId = String(postId || "").trim();
      const normalizedCommentId = String(commentId || "").trim();
      if (!normalizedPostId || !normalizedCommentId) return;
      showModal("Удалить комментарий", "Комментарий будет удалён без возможности восстановления.", "Удалить", async () => {
        if (!(s.wallBusyCommentIds instanceof Set)) {
          s.wallBusyCommentIds = new Set();
        }
        s.wallBusyCommentIds.add(normalizedCommentId);
        renderWall();
        try {
          const payload = await api(`/api/profile/wall-posts/${encodeURIComponent(normalizedPostId)}/comments/${encodeURIComponent(normalizedCommentId)}`, {
            method: "DELETE",
          });
          replaceWallPost(payload.post);
          renderWall();
          showSaveAlert("Комментарий удалён");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось удалить комментарий");
        } finally {
          s.wallBusyCommentIds.delete(normalizedCommentId);
          renderWall();
        }
      });
    };

    const deleteWallPost = (postId) => {
      const post = Array.isArray(s.wallPosts) ? s.wallPosts.find((item) => item.id === postId) : null;
      if (!post) return;
      showModal("Удалить пост", "Пост исчезнет со стены, но дневной лимит за сегодня не сбросится.", "Удалить", async () => {
        try {
          const payload = await api(`/api/profile/wall-posts/${encodeURIComponent(postId)}`, {
            method: "DELETE",
          });
          s.wallPosts = Array.isArray(s.wallPosts) ? s.wallPosts.filter((item) => item.id !== postId) : [];
          s.wallSummary = normalizeWallSummary(payload.wallSummary);
          s.wallPagination = {
            ...normalizeWallPagination(s.wallPagination),
            total: Math.max(0, Number(s.wallPagination?.total || 0) - 1),
            hasMore: Math.max(0, Number(s.wallPagination?.total || 0) - 1) > Number(s.wallPagination?.pageSize || WALL_POST_PAGE_SIZE),
          };
          if (s.wallEditingId === postId) {
            resetWallComposer();
            closeWallComposerModal({ restoreFocus: false });
          }
          clearWallCommentDraft(postId);
          renderWall();
          showSaveAlert("Пост удалён");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось удалить пост");
        }
      });
    };

    const renderRequests = () => {
      if (!el.reqTable) return;
      const normalizeRequestFilter = (value) => {
        const normalized = String(value || "").trim().toLowerCase();
        return ["approved", "pending", "rejected"].includes(normalized) ? normalized : "approved";
      };
      const getRequestFilterKey = (requestItem) => {
        const status = String(requestItem?.status || "").trim().toLowerCase();
        if (status === "approved") {
          return "approved";
        }
        if (["rejected", "expired"].includes(status)) {
          return "rejected";
        }
        return "pending";
      };
      const filterLabels = {
        approved: "Одобренные",
        pending: "В процессе",
        rejected: "Отклонённые",
      };
      const getRequestStatusMeta = (requestItem) => {
        const requestType = String(requestItem?.type || "slug").trim().toLowerCase();
        const status = String(requestItem?.status || "").trim().toLowerCase();
        if (requestType === "pet") {
          if (status === "approved") {
            return { label: "Активировано", className: "is-approved" };
          }
          if (status === "rejected") {
            return { label: "Отклонено", className: "is-rejected" };
          }
          return { label: "Ожидает оплаты", className: "is-pending" };
        }
        if (status === "approved") {
          return { label: "Активировано", className: "is-approved" };
        }
        if (status === "paid") {
          return { label: "Оплачено", className: "is-paid" };
        }
        if (status === "new" || status === "contacted") {
          return { label: "Ожидает оплаты", className: "is-pending" };
        }
        if (status === "rejected" || status === "expired") {
          return { label: status === "rejected" ? "Отклонено" : "Истекло", className: "is-rejected" };
        }
        return { label: String(requestItem?.statusBadge || requestItem?.status || "В обработке"), className: "is-neutral" };
      };

      const getRequestMetaChips = (requestItem) => {
        const chips = [];
        if (requestItem.type === "pet") {
          chips.push(`<span class="profile-request-chip">${esc(requestItem.petLabel || "Питомец")}</span>`);
        } else {
          chips.push(`<span class="profile-request-chip">${requestItem.requestedPlan === "premium" ? "Премиум" : "Без тарифа"}</span>`);
        }
        chips.push(`<span class="profile-request-chip">Создано: ${fdt(requestItem.createdAt)}</span>`);
        if (requestItem.purchasedAt) {
          chips.push(`<span class="profile-request-chip">Оплачено: ${fdt(requestItem.purchasedAt)}</span>`);
        }
        return chips.join("");
      };

      const renderRequestActions = (requestItem, compact = false) => {
        const normalizedStatus = String(requestItem.status || "").toLowerCase();
        const actions = [];
        if ((requestItem.type === "pet" && normalizedStatus === "pending") || normalizedStatus === "new" || normalizedStatus === "contacted") {
          actions.push(`<button type="button" data-a="pay-request" data-order-id="${esc(requestItem.id)}" class="interactive-btn ${compact ? "w-full" : ""} rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Продолжить оплату</button>`);
        }
        if (requestItem.type !== "pet" && normalizedStatus === "new") {
          actions.push(`<button type="button" data-a="cancel-request" data-order-id="${esc(requestItem.id)}" class="interactive-btn ${compact ? "w-full" : ""} rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Отменить</button>`);
        }
        return actions.length ? `<div class="profile-request-actions">${actions.join("")}</div>` : "";
      };

      const renderRequestCard = (requestItem, compact = false) => {
        const normalizedStatus = String(requestItem.status || "").toLowerCase();
        const totalPrice = requestItem.type === "pet"
          ? Number(requestItem.totalOneTime || requestItem.priceSnapshot || 0)
          : Number(requestItem.slugPrice || 0) +
            Number(requestItem.planPrice || 0);
        const statusMeta = getRequestStatusMeta(requestItem);
        const note = ["rejected", "expired"].includes(normalizedStatus)
          ? `<div class="profile-request-note"><strong>Причина:</strong> ${esc(requestItem.adminNote || "Без дополнительного комментария")}</div>`
          : "";
        return `<article class="profile-request-card">
          <div class="profile-request-card-head">
            <div>
              <div class="profile-request-kicker">${requestItem.type === "pet" ? "Питомец" : "UNQ заявка"}</div>
              <div class="profile-request-slug">${esc(requestItem.type === "pet" ? (requestItem.displayName || requestItem.petLabel || "—") : (requestItem.slug || "—"))}</div>
              ${requestItem.type === "pet" ? `<div class="mt-1 text-xs text-neutral-500">${esc(requestItem.petLabel || "")}</div>` : ""}
            </div>
            <div class="${compact ? "w-full" : "text-right"}">
              <div class="profile-request-status ${statusMeta.className}">${esc(statusMeta.label)}</div>
              <div class="${compact ? "mt-3" : "mt-2"} profile-request-amount">${fp(totalPrice)}</div>
            </div>
          </div>
          <div class="profile-request-meta">${getRequestMetaChips(requestItem)}</div>
          ${note}
          ${renderRequestActions(requestItem, compact)}
        </article>`;
      };

      const plan = getCurrentPlan();
      if (plan === "none" && !s.requests.length) {
        if (el.reqBanner) el.reqBanner.classList.add("hidden");
        if (el.reqSummary instanceof HTMLElement) el.reqSummary.classList.add("hidden");
        if (el.reqFilters instanceof HTMLElement) el.reqFilters.classList.add("hidden");
        if (el.reqDesktopList instanceof HTMLElement) el.reqDesktopList.classList.add("hidden");
        if (el.reqTableWrap instanceof HTMLElement) el.reqTableWrap.classList.add("hidden");
        if (el.reqMobileList instanceof HTMLElement) el.reqMobileList.classList.add("hidden");
        if (el.reqEmpty instanceof HTMLElement) {
          el.reqEmpty.classList.remove("hidden");
          el.reqEmpty.innerHTML = renderStateCard({
            icon: "file-text",
            title: "Заявок пока нет",
            text: "Подай заявку на UNQ чтобы начать.",
            buttonId: "profile-requests-order-btn",
            buttonLabel: "Занять UNQ >",
          });
        }
        return;
      }
      if (el.reqSummary instanceof HTMLElement) el.reqSummary.classList.remove("hidden");
      if (el.reqFilters instanceof HTMLElement) el.reqFilters.classList.remove("hidden");
      if (el.reqDesktopList instanceof HTMLElement) el.reqDesktopList.classList.remove("hidden");
      if (el.reqTableWrap instanceof HTMLElement) el.reqTableWrap.classList.remove("hidden");
      if (el.reqMobileList instanceof HTMLElement) el.reqMobileList.classList.remove("hidden");
      if (el.reqEmpty instanceof HTMLElement) el.reqEmpty.classList.add("hidden");

      s.requestFilter = normalizeRequestFilter(s.requestFilter);

      const requestsTotal = s.requests.length;
      const requestsActive = s.requests.filter((item) => String(item.status || "").toLowerCase() === "approved").length;
      const requestsPending = s.requests.filter((item) => ["new", "contacted", "paid", "pending"].includes(String(item.status || "").toLowerCase())).length;
      const requestsProblem = s.requests.filter((item) => ["rejected", "expired"].includes(String(item.status || "").toLowerCase())).length;
      const filteredRequests = s.requests.filter((item) => getRequestFilterKey(item) === s.requestFilter);

      if (el.reqSummary) {
        el.reqSummary.innerHTML = [
          { label: "Всего", value: requestsTotal, note: "Все заявки по аккаунту" },
          { label: "Активно", value: requestsActive, note: "UNQ уже активированы" },
          { label: "В процессе", value: requestsPending, note: "Ждут оплату или подтверждение" },
          { label: "Нужна реакция", value: requestsProblem, note: "Отклонены или истекли" },
        ]
          .map((item) => `<article class="profile-request-summary-card"><p class="profile-request-summary-label">${esc(item.label)}</p><p class="profile-request-summary-value">${esc(String(item.value))}</p><p class="profile-request-summary-note">${esc(item.note)}</p></article>`)
          .join("");
      }

      if (el.reqFilters) {
        el.reqFilters.innerHTML = [
          { key: "approved", count: requestsActive },
          { key: "pending", count: requestsPending },
          { key: "rejected", count: requestsProblem },
        ]
          .map((item) => {
            const isActive = s.requestFilter === item.key;
            return `<button type="button" data-a="request-filter" data-filter="${esc(item.key)}" aria-pressed="${isActive ? "true" : "false"}" class="interactive-btn profile-request-filter ${isActive ? "is-active" : ""}"><span>${esc(filterLabels[item.key])}</span><span class="profile-request-filter-count">${esc(String(item.count))}</span></button>`;
          })
          .join("");
      }

      const emptyFilteredState = `<div class="profile-request-filter-empty">В категории \"${esc(filterLabels[s.requestFilter])}\" пока нет заявок.</div>`;

      if (el.reqMobileList) {
        el.reqMobileList.innerHTML = filteredRequests.length
          ? filteredRequests
            .map((requestItem) => renderRequestCard(requestItem, true))
            .join("")
          : emptyFilteredState;
      }
      if (el.reqDesktopList) {
        el.reqDesktopList.innerHTML = filteredRequests.length
          ? filteredRequests.map((requestItem) => renderRequestCard(requestItem)).join("")
          : emptyFilteredState;
      }
      el.reqTable.innerHTML = "";

      const approved = s.requests.find((item) => item.type !== "pet" && item.status === "approved");
      const approvedPet = s.requests.find((item) => item.type === "pet" && item.status === "approved");
      const needsPayment = s.requests.find((item) => ["new", "contacted", "pending"].includes(String(item.status || "").toLowerCase()));
      const paid = s.requests.find((item) => item.status === "paid");
      const count = s.slugs.length;
      if (el.reqNewBtn instanceof HTMLButtonElement) {
        if (plan !== "premium" && count >= 1) {
          el.reqNewBtn.disabled = false;
          el.reqNewBtn.title = PREMIUM_UPSELL_NOTE;
        } else if (plan === "premium" && count >= 3) {
          el.reqNewBtn.disabled = true;
          el.reqNewBtn.title = "Достигнут лимит 3 UNQ";
        } else {
          el.reqNewBtn.disabled = false;
          el.reqNewBtn.title = "";
        }
      }

      if (!el.reqBanner) return;

      if (approved && !s.card) {
        el.reqBanner.classList.remove("hidden");
        el.reqBanner.className = "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800";
        el.reqBanner.innerHTML = `Твой UNQ ${esc(approved.slug)} одобрен! Перейди во вкладку 'Моя визитка' чтобы создать карточку. <button data-a="goto-card" class="underline">Создать визитку</button>`;
        return;
      }

      if (needsPayment) {
        el.reqBanner.classList.remove("hidden");
        el.reqBanner.className = "mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900";
        el.reqBanner.innerHTML = needsPayment.type === "pet"
          ? `Есть незавершенная оплата по питомцу <span class="font-semibold">${esc(needsPayment.displayName || needsPayment.petLabel || "")}</span>. <button type="button" data-a="pay-request" data-order-id="${esc(needsPayment.id)}" class="underline font-semibold">Продолжить в Telegram</button>`
          : `Есть незавершенная оплата по заявке <span class="font-mono">${esc(needsPayment.slug || "")}</span>. <button type="button" data-a="pay-request" data-order-id="${esc(needsPayment.id)}" class="underline font-semibold">Продолжить в Telegram</button>`;
        return;
      }

      if (paid) {
        el.reqBanner.classList.remove("hidden");
        el.reqBanner.className = "mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700";
        el.reqBanner.textContent = "Ожидаем оплату. Реквизиты отправлены в Telegram.";
        return;
      }

      if (approvedPet) {
        el.reqBanner.classList.remove("hidden");
        el.reqBanner.className = "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800";
        el.reqBanner.textContent = `Питомец ${approvedPet.displayName || approvedPet.petLabel || ""} уже добавлен на визитку.`;
        return;
      }

      el.reqBanner.classList.add("hidden");
    };

    const renderTelegramNotificationActions = (enabled) => {
      const resolvedEnabled =
        typeof enabled === "boolean" ? enabled : Boolean(s.user && s.user.notificationsEnabled);
      if (el.stLinkTelegram instanceof HTMLButtonElement) {
        el.stLinkTelegram.classList.toggle("hidden", resolvedEnabled);
      }
      if (el.stUnlinkTelegram instanceof HTMLButtonElement) {
        el.stUnlinkTelegram.classList.toggle("hidden", !resolvedEnabled);
      }
    };

    const renderPrivateAccessSettings = () => {
      const passwords = Array.isArray(s.privatePasswords) ? s.privatePasswords : [];
      const limit = Number.isFinite(Number(s.privatePasswordLimit)) ? Number(s.privatePasswordLimit) : 10;
      const minLength = Number.isFinite(Number(s.privatePasswordMinLength)) ? Number(s.privatePasswordMinLength) : 4;

      if (el.privatePasswordAddValue instanceof HTMLInputElement) {
        el.privatePasswordAddValue.minLength = minLength;
      }
      if (el.privatePasswordChangeNew instanceof HTMLInputElement) {
        el.privatePasswordChangeNew.minLength = minLength;
      }
      if (el.privatePasswordOpenAdd instanceof HTMLButtonElement) {
        const reached = passwords.length >= limit;
        el.privatePasswordOpenAdd.disabled = reached;
        el.privatePasswordOpenAdd.classList.toggle("opacity-60", reached);
        el.privatePasswordOpenAdd.title = reached ? `Достигнут лимит ${limit} паролей` : "";
      }

      if (el.privatePasswordsList instanceof HTMLElement) {
        if (!passwords.length) {
          el.privatePasswordsList.innerHTML = '<p class="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs text-neutral-500">Пока нет паролей. Добавьте первый пароль для приватного режима.</p>';
        } else {
          el.privatePasswordsList.innerHTML = passwords
            .map((item) => {
              const id = String(item?.id || "");
              const label = String(item?.label || "").trim() || "Без метки";
              const createdAt = item?.createdAt ? fdt(item.createdAt) : "—";
              const lastUsed = item?.lastUsedAt ? fdt(item.lastUsedAt) : "ещё не использовался";
              return `<article class="rounded-xl border border-neutral-200 bg-white p-3" data-private-password-row="${esc(id)}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-neutral-900">${esc(label)}</p>
                    <p class="text-xs text-neutral-500">Создан: ${esc(createdAt)} · Последнее открытие: ${esc(lastUsed)}</p>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button data-a="open-private-change" data-password-id="${esc(id)}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Сменить пароль</button>
                    <button data-a="delete-private-password" data-password-id="${esc(id)}" class="interactive-btn min-h-11 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700">Удалить</button>
                  </div>
                </div>
              </article>`;
            })
            .join("");
        }
      }
    };

    const normalizeSettingsCategory = (value) => {
      const normalized = String(value || "").trim().toLowerCase();
      return ["account", "security", "privacy"].includes(normalized) ? normalized : "account";
    };

    const normalizeCardEditorCategory = (value) => {
      const normalized = String(value || "").trim().toLowerCase();
      return ["main", "links", "contacts", "design", "pets"].includes(normalized) ? normalized : "main";
    };

    const normalizeProfileLoginValue = (value) => String(value || "").trim().toLowerCase();

    const isValidProfileLogin = (value) => {
      const normalized = normalizeProfileLoginValue(value);
      if (normalized.length < LOGIN_MIN_LENGTH || normalized.length > LOGIN_MAX_LENGTH) {
        return false;
      }
      return LOGIN_REGEX.test(normalized);
    };

    const canEditProfileLogin = () => true;

    const setSettingsLoginStatus = (message, tone = "muted") => {
      if (!(el.stLoginStatus instanceof HTMLElement)) return;
      const normalizedMessage = String(message || "").trim();
      el.stLoginStatus.textContent = normalizedMessage;
      let className = "mt-1 text-xs text-neutral-500";
      if (tone === "success") {
        className = "mt-1 text-xs text-emerald-700";
      } else if (tone === "error") {
        className = "mt-1 text-xs text-red-700";
      } else if (tone === "neutral") {
        className = "mt-1 text-xs text-neutral-600";
      }
      el.stLoginStatus.className = className;
    };

    const renderSettingsLoginField = () => {
      if (!(el.stLogin instanceof HTMLInputElement)) {
        return;
      }

      const savedLogin = normalizeProfileLoginValue(s.user?.login);
      const editable = true;

      el.stLogin.readOnly = !editable;
      el.stLogin.value = settingsLoginDraft;
      el.stLogin.placeholder = savedLogin ? "Измени логин" : "Придумай логин";
      el.stLogin.classList.toggle("bg-neutral-50", !editable);
      el.stLogin.classList.toggle("cursor-not-allowed", !editable);

      const normalizedDraft = normalizeProfileLoginValue(settingsLoginDraft);
      if (!normalizedDraft) {
        setSettingsLoginStatus(savedLogin ? PROFILE_LOGIN_REQUIRED_MESSAGE : PROFILE_LOGIN_EMPTY_MESSAGE, savedLogin ? "error" : "muted");
        return;
      }

      if (settingsLoginAvailability.login !== normalizedDraft) {
        settingsLoginAvailability = {
          state: "idle",
          login: normalizedDraft,
          message: "",
        };
      }

      switch (settingsLoginAvailability.state) {
        case "checking":
          setSettingsLoginStatus(settingsLoginAvailability.message || PROFILE_LOGIN_CHECKING_MESSAGE, "neutral");
          break;
        case "available":
          setSettingsLoginStatus(settingsLoginAvailability.message || PROFILE_LOGIN_AVAILABLE_MESSAGE, "success");
          break;
        case "taken":
        case "invalid":
        case "error":
          setSettingsLoginStatus(settingsLoginAvailability.message || PROFILE_LOGIN_CHECK_FAILED_MESSAGE, "error");
          break;
        default:
          if (savedLogin && normalizedDraft === savedLogin) {
            setSettingsLoginStatus(PROFILE_LOGIN_CURRENT_MESSAGE, "neutral");
            break;
          }
          if (!isValidProfileLogin(normalizedDraft)) {
            setSettingsLoginStatus(PROFILE_LOGIN_INVALID_MESSAGE, "error");
          } else {
            setSettingsLoginStatus("Логин должен быть уникальным. Изменения сохраняются сразу в аккаунте.", "neutral");
          }
          break;
      }
    };

    const applySettingsLoginAvailability = (nextState, login, message = "") => {
      settingsLoginAvailability = {
        state: nextState,
        login: normalizeProfileLoginValue(login),
        message: String(message || "").trim(),
      };
      renderSettingsLoginField();
    };

    const resetSettingsLoginAvailability = () => {
      settingsLoginAvailability = {
        state: "idle",
        login: normalizeProfileLoginValue(settingsLoginDraft),
        message: "",
      };
      renderSettingsLoginField();
    };

    const checkSettingsLoginAvailability = async (loginValue, options = {}) => {
      const normalizedLogin = normalizeProfileLoginValue(loginValue);
      const currentLogin = normalizeProfileLoginValue(s.user?.login);
      const requestId = Number(options.requestId || 0);
      if (!normalizedLogin) {
        applySettingsLoginAvailability("idle", "", "");
        return { ok: true, available: false, login: "" };
      }

      if (currentLogin && normalizedLogin === currentLogin) {
        applySettingsLoginAvailability("idle", normalizedLogin, PROFILE_LOGIN_CURRENT_MESSAGE);
        return { ok: true, available: true, login: normalizedLogin, current: true };
      }

      if (!isValidProfileLogin(normalizedLogin)) {
        applySettingsLoginAvailability("invalid", normalizedLogin, PROFILE_LOGIN_INVALID_MESSAGE);
        return { ok: false, available: false, login: normalizedLogin };
      }

      applySettingsLoginAvailability("checking", normalizedLogin, PROFILE_LOGIN_CHECKING_MESSAGE);

      try {
        const payload = await api(`/api/auth/check-availability?login=${encodeURIComponent(normalizedLogin)}`, {
          method: "GET",
        });
        if (requestId && requestId !== settingsLoginRequestId) {
          return { ok: false, stale: true, login: normalizedLogin };
        }
        const loginMeta = payload?.login && typeof payload.login === "object" ? payload.login : {};
        if (loginMeta.valid === false) {
          applySettingsLoginAvailability("invalid", normalizedLogin, loginMeta.message || PROFILE_LOGIN_INVALID_MESSAGE);
          return { ok: false, available: false, login: normalizedLogin };
        }
        if (loginMeta.available) {
          applySettingsLoginAvailability("available", normalizedLogin, PROFILE_LOGIN_AVAILABLE_MESSAGE);
          return { ok: true, available: true, login: normalizedLogin };
        }
        applySettingsLoginAvailability("taken", normalizedLogin, loginMeta.message || "Этот логин уже занят");
        return { ok: false, available: false, login: normalizedLogin };
      } catch {
        if (requestId && requestId !== settingsLoginRequestId) {
          return { ok: false, stale: true, login: normalizedLogin };
        }
        applySettingsLoginAvailability("error", normalizedLogin, PROFILE_LOGIN_CHECK_FAILED_MESSAGE);
        return { ok: false, available: false, login: normalizedLogin };
      }
    };

    const scheduleSettingsLoginAvailabilityCheck = () => {
      if (!canEditProfileLogin()) {
        return;
      }

      const normalizedLogin = normalizeProfileLoginValue(settingsLoginDraft);
      if (settingsLoginCheckTimer) {
        window.clearTimeout(settingsLoginCheckTimer);
      }

      if (!normalizedLogin) {
        resetSettingsLoginAvailability();
        return;
      }

      if (!isValidProfileLogin(normalizedLogin)) {
        applySettingsLoginAvailability("invalid", normalizedLogin, PROFILE_LOGIN_INVALID_MESSAGE);
        return;
      }

      const requestId = ++settingsLoginRequestId;
      settingsLoginCheckTimer = window.setTimeout(() => {
        void checkSettingsLoginAvailability(normalizedLogin, { requestId });
      }, 260);
    };

    const ensureSettingsLoginReadyForSubmit = async () => {
      const normalizedLogin = normalizeProfileLoginValue(settingsLoginDraft);
      const currentLogin = normalizeProfileLoginValue(s.user?.login);
      if (!normalizedLogin) {
        if (currentLogin) {
          applySettingsLoginAvailability("invalid", normalizedLogin, PROFILE_LOGIN_REQUIRED_MESSAGE);
          return { ok: false, login: normalizedLogin };
        }
        return { ok: true, login: "" };
      }

      if (settingsLoginCheckTimer) {
        window.clearTimeout(settingsLoginCheckTimer);
        settingsLoginCheckTimer = null;
      }

      if (currentLogin && normalizedLogin === currentLogin) {
        applySettingsLoginAvailability("idle", normalizedLogin, PROFILE_LOGIN_CURRENT_MESSAGE);
        return { ok: true, login: normalizedLogin };
      }

      if (!isValidProfileLogin(normalizedLogin)) {
        applySettingsLoginAvailability("invalid", normalizedLogin, PROFILE_LOGIN_INVALID_MESSAGE);
        return { ok: false, login: normalizedLogin };
      }

      if (settingsLoginAvailability.state === "available" && settingsLoginAvailability.login === normalizedLogin) {
        return { ok: true, login: normalizedLogin };
      }

      const requestId = ++settingsLoginRequestId;
      const result = await checkSettingsLoginAvailability(normalizedLogin, { requestId });
      return {
        ok: Boolean(result?.ok && result?.available),
        login: normalizedLogin,
      };
    };

    const renderSettingsCategory = () => {
      s.settingsCategory = normalizeSettingsCategory(s.settingsCategory);
      const activeCategory = s.settingsCategory;

      if (Array.isArray(el.stCategoryButtons)) {
        el.stCategoryButtons.forEach((button) => {
          if (!(button instanceof HTMLElement)) return;
          const category = normalizeSettingsCategory(button.getAttribute("data-settings-category"));
          const isActive = category === activeCategory;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      if (Array.isArray(el.stCategoryPanels)) {
        el.stCategoryPanels.forEach((panel) => {
          if (!(panel instanceof HTMLElement)) return;
          const category = normalizeSettingsCategory(panel.getAttribute("data-settings-panel"));
          panel.classList.toggle("hidden", category !== activeCategory);
        });
      }

      if (el.stSaveWrap instanceof HTMLElement) {
        el.stSaveWrap.classList.remove("hidden");
      }
    };

    const renderCardEditorCategory = () => {
      s.cardEditorCategory = normalizeCardEditorCategory(s.cardEditorCategory);
      const activeCategory = s.cardEditorCategory;

      if (Array.isArray(el.cCategoryButtons)) {
        el.cCategoryButtons.forEach((button) => {
          if (!(button instanceof HTMLElement)) return;
          const category = normalizeCardEditorCategory(button.getAttribute("data-card-editor-category"));
          const isActive = category === activeCategory;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      if (Array.isArray(el.cCategoryPanels)) {
        el.cCategoryPanels.forEach((panel) => {
          if (!(panel instanceof HTMLElement)) return;
          const category = normalizeCardEditorCategory(panel.getAttribute("data-card-editor-panel"));
          panel.classList.toggle("hidden", category !== activeCategory);
        });
      }
    };

    const renderSettings = () => {
      if (!s.user) return;
      if (el.stName) el.stName.value = s.user.displayName || s.user.firstName || "";
      if (el.stCity) el.stCity.value = String(s.user.city || "");
      if (!settingsLoginDraft && normalizeProfileLoginValue(s.user.login)) {
        settingsLoginDraft = normalizeProfileLoginValue(s.user.login);
      }
      renderSettingsLoginField();
      if (el.stEmail) {
        const accountEmail = String(s.user.email || "").trim();
        const pendingEmail = String(s.user.pendingEmail || "").trim();
        el.stEmail.value = pendingEmail || accountEmail || "Не указан";
        if (pendingEmail) {
          el.stEmail.title = "Ожидает подтверждения";
        } else {
          el.stEmail.removeAttribute("title");
        }
      }
      if (el.stTg) el.stTg.value = s.user.telegramUsername ? `@${s.user.telegramUsername}` : "";
      if (el.stNotif) el.stNotif.checked = Boolean(s.user.notificationsEnabled);
      renderTelegramNotificationActions(Boolean(s.user.notificationsEnabled));
      if (el.stDirectory) el.stDirectory.checked = Boolean(s.user.showInDirectory);
      if (el.verificationStatus) {
        const latest = s.verification?.latestRequest;
        const latestStatus = String(latest?.status || "").toLowerCase();
        let label = "Статус: не запрошено";
        if (latestStatus === "pending") {
          label = "Статус: на проверке";
        } else if (s.user.isVerified) {
          label = "Статус: верифицировано";
        } else if (latestStatus === "rejected") {
          label = "Статус: отклонено";
        }
        el.verificationStatus.textContent = label;

        if (el.verificationNote instanceof HTMLElement) {
          if (latestStatus === "pending") {
            el.verificationNote.textContent = "Новая заявка недоступна до решения администратора. Для правок используйте форму исправления ниже.";
            el.verificationNote.classList.remove("hidden");
          } else if (latestStatus === "rejected" && latest?.adminNote) {
            el.verificationNote.textContent = `Причина отклонения: ${latest.adminNote}`;
            el.verificationNote.classList.remove("hidden");
          } else {
            el.verificationNote.textContent = "";
            el.verificationNote.classList.add("hidden");
          }
        }
      }

      if (el.verificationOpen instanceof HTMLButtonElement) {
        const latest = s.verification?.latestRequest;
        const latestStatus = String(latest?.status || "").toLowerCase();
        const canSubmit =
          typeof s.verification?.canSubmitRequest === "boolean"
            ? s.verification.canSubmitRequest
            : latestStatus !== "pending";
        el.verificationOpen.disabled = !canSubmit;
        el.verificationOpen.classList.toggle("opacity-60", !canSubmit);
        if (latestStatus === "pending") {
          el.verificationOpen.textContent = "Заявка отправлена";
        } else if (s.user.isVerified) {
          el.verificationOpen.textContent = "Запросить повторно";
        } else if (latestStatus === "rejected") {
          el.verificationOpen.textContent = "Подать повторно";
        } else {
          el.verificationOpen.textContent = "Подать заявку";
        }
      }

      if (el.verificationCorrectionWrap instanceof HTMLElement) {
        const latestStatus = String(s.verification?.latestRequest?.status || "").toLowerCase();
        const canSendCorrection =
          typeof s.verification?.canSendCorrection === "boolean"
            ? s.verification.canSendCorrection
            : latestStatus === "pending";
        el.verificationCorrectionWrap.classList.toggle("hidden", !canSendCorrection);
      }

      renderBadgeStatuses();

      if (!emailRequiredModalShown) {
        const hasEmail = Boolean(String(s.user.email || s.user.pendingEmail || "").trim());
        if (!hasEmail) {
          openEmailRequiredModal();
        }
      }

      renderPrivateAccessSettings();
      renderSettingsCategory();
    };

    const renderReferrals = () => {
      const payload = s.referrals || {};
      if (el.refLink instanceof HTMLInputElement) {
        el.refLink.value = payload.refLink || "";
      }
      if (el.refTg instanceof HTMLAnchorElement) {
        const text = encodeURIComponent("Зарегистрируйся на UNQX по моей ссылке");
        const url = encodeURIComponent(payload.refLink || "");
        el.refTg.href = `tg://msg_url?url=${url}&text=${text}`;
      }
      if (el.refInvited) el.refInvited.textContent = String(payload.stats?.invited || 0);
      if (el.refPaid) el.refPaid.textContent = String(payload.stats?.paid || 0);
      if (el.refRewarded) el.refRewarded.textContent = `${Number(payload.stats?.rewardsAmount || 0).toLocaleString("ru-RU")} сум`;
      if (el.refBonusBalance) el.refBonusBalance.textContent = `${Number(payload.bonus?.balance || 0).toLocaleString("ru-RU")} сум`;
      if (el.refBonusEarned) el.refBonusEarned.textContent = `${Number(payload.bonus?.totalEarned || 0).toLocaleString("ru-RU")} сум`;
      if (el.refBonusSpent) el.refBonusSpent.textContent = `${Number(payload.bonus?.totalSpent || 0).toLocaleString("ru-RU")} сум`;

      if (el.refTable) {
        const rows = Array.isArray(payload.referrals) ? payload.referrals : [];
        el.refTable.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${esc(item.name || "UNQX User")}</td><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(item.status)}</td><td class="px-3 py-2">${Number(item.rewardAmount || 0).toLocaleString("ru-RU")} сум</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-500">Пока нет рефералов</td></tr>';
      }

      if (el.refRewards) {
        const rules = Array.isArray(payload.rewards) ? payload.rewards : [];
        el.refRewards.innerHTML = rules
          .map((rule) => {
            const statusLabel =
              rule.status === "received"
                ? "Получено"
                : rule.status === "available"
                  ? "Доступно к получению"
                  : "Ожидает";
            const claimButton =
              rule.status === "available"
                ? `<button data-a="claim-reward" data-rule="${rule.id}" class="interactive-btn mt-2 min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">Забрать награду</button>`
                : "";
            return `<article class="rounded-xl border border-neutral-200 p-3"><p class="text-sm font-semibold">За ${rule.threshold} оплативших</p><p class="mt-1 text-sm text-neutral-600">${esc(rule.rewardLabel || "")}</p><p class="mt-2 text-xs text-neutral-500">${statusLabel}</p>${claimButton}</article>`;
          })
          .join("");
      }
      if (el.refBonusHistory) {
        const rows = Array.isArray(payload.bonus?.history) ? payload.bonus.history : [];
        el.refBonusHistory.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(item.kind || "—")}</td><td class="px-3 py-2">${item.direction === "debit" ? "-" : "+"}${Number(item.amount || 0).toLocaleString("ru-RU")} сум</td><td class="px-3 py-2">${Number(item.balanceAfter || 0).toLocaleString("ru-RU")} сум</td><td class="px-3 py-2">${esc(item.note || "—")}</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-500">История бонусов появится после операций</td></tr>';
      }
      if (el.refCampaigns) {
        const rows = Array.isArray(payload.campaigns) ? payload.campaigns : [];
        el.refCampaigns.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${esc(item.name || "Campaign")}</td><td class="px-3 py-2">${esc(item.type || "-")}</td><td class="px-3 py-2">${esc(`${item.source || "-"} / ${item.offer || "-"}`)}</td><td class="px-3 py-2">${esc(item.promoCode || "-")}</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="4" class="px-3 py-8 text-center text-neutral-500">Активных кампаний нет</td></tr>';
      }
      if (el.refFraud) {
        const rows = Array.isArray(payload.fraud) ? payload.fraud : [];
        el.refFraud.innerHTML = rows.length
          ? rows
            .map(
              (item) =>
                `<tr class="border-t border-neutral-100"><td class="px-3 py-2">${fdt(item.createdAt)}</td><td class="px-3 py-2">${esc(String(item.verdict || "").toUpperCase())}</td><td class="px-3 py-2">${esc(item.reason || "—")}</td></tr>`,
            )
            .join("")
          : '<tr><td colspan="3" class="px-3 py-8 text-center text-neutral-500">Проверок пока нет</td></tr>';
      }
    };

    const renderScore = () => {
      const score = s.score || {};
      const rows = [
        ["Просмотры", Number(score.scoreViews || 0), 300],
        ["Редкость UNQ", Number(score.scoreSlugRarity || 0), 200],
        ["Срок владения", Number(score.scoreTenure || 0), 150],
        ["Активность", Number(score.scoreCtr || 0), 200],
        ["Браслет", Number(score.scoreBracelet || 0), 100],
        ["Тариф", Number(score.scorePlan || 0), 49],
      ];
      if (el.scoreValue) el.scoreValue.textContent = String(Number(score.score || 0));
      if (el.scoreTop) el.scoreTop.textContent = `Топ ${Math.max(1, Number(score.topPercent || 100))}%`;
      if (el.scoreUpdated) el.scoreUpdated.textContent = `Обновлено ${fh(score.calculatedAt)}`;
      if (el.scoreBreakdown) {
        el.scoreBreakdown.innerHTML = rows
          .map(([label, value, max]) => {
            const width = Math.max(0, Math.min(100, (Number(value || 0) / Number(max || 1)) * 100));
            return `<div class="grid grid-cols-[150px_1fr_auto] items-center gap-2 text-sm">
              <span class="text-neutral-600">${esc(label)}</span>
              <span class="h-1.5 rounded-full bg-neutral-200"><span class="block h-1.5 rounded-full bg-neutral-900" style="width:${width.toFixed(2)}%"></span></span>
              <span class="text-xs text-neutral-500">${value} / ${max}</span>
            </div>`;
          })
          .join("");
      }

      const tips = [];
      if (Number(score.scorePlan || 0) === 0) {
        tips.push(`<div class="flex items-center justify-between gap-2"><span>${PREMIUM_UPSELL_NOTE} · +49 к Score</span><button type="button" data-order-link data-order-plan="premium" data-order-kind="${SUBSCRIPTION_RENEWAL_ORDER_KIND}" class="interactive-btn min-h-11 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold">${PREMIUM_CTA_LABEL}</button></div>`);
      }
      if (Number(score.scoreViews || 0) < 150) tips.push("<p>Поделись визиткой чтобы получить больше просмотров</p>");
      if (Number(score.scoreTenure || 0) < 100) tips.push("<p>Score растёт каждый месяц автоматически</p>");
      if (Number(score.scoreCtr || 0) < 100) tips.push("<p>Добавь больше кнопок чтобы повысить активность</p>");
      if (el.scoreTipsList) {
        el.scoreTipsList.innerHTML = tips.length ? tips.join("") : "<p>Отличный прогресс. Поддерживай активность визитки.</p>";
        window.dispatchEvent(new CustomEvent("unqx:bind-order-ctas"));
      }

      const rawHistory = Array.isArray(score.history) ? score.history : [];
      const history =
        rawHistory.length > 0
          ? rawHistory
          : [
            {
              date: score.calculatedAt || new Date().toISOString(),
              score: Number(score.score || 0),
            },
          ];
      const labels = history.map((item) => {
        try {
          return new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
        } catch {
          return "";
        }
      });
      const values = history.map((item) => Number(item.score || 0));
      const isSinglePoint = values.length <= 1;
      if (scoreChart) {
        scoreChart.destroy();
        scoreChart = null;
      }
      if (el.scoreHistoryChart && typeof Chart !== "undefined") {
        scoreChart = new Chart(el.scoreHistoryChart, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                data: values,
                borderColor: "#111827",
                borderWidth: 2,
                tension: 0.25,
                pointRadius: isSinglePoint ? 3 : 0,
                pointHoverRadius: 4,
                pointBackgroundColor: "#111827",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { min: 0, max: 999, ticks: { stepSize: 200 } },
            },
            plugins: { legend: { display: false } },
          },
        });
      }
      const premium = s.user?.effectivePlan === "premium";
      if (el.scoreHistoryLock) {
        el.scoreHistoryLock.classList.toggle("hidden", premium);
      }
    };

    const destroyAnalyticsCharts = () => {
      Object.values(analyticsCharts).forEach((instance) => {
        if (instance && typeof instance.destroy === "function") {
          instance.destroy();
        }
      });
      analyticsCharts = {};
    };

    const buildChart = (canvas, config, key) => {
      if (!(canvas instanceof HTMLCanvasElement) || typeof Chart === "undefined") return;
      if (analyticsCharts[key] && typeof analyticsCharts[key].destroy === "function") {
        analyticsCharts[key].destroy();
      }
      analyticsCharts[key] = new Chart(canvas, config);
    };

    const hasAnalyticsSlugs = () => {
      const bootstrapSlugs = Array.isArray(s.analyticsBootstrap?.slugs) ? s.analyticsBootstrap.slugs : [];
      if (bootstrapSlugs.length > 0) return true;
      const profileSlugs = Array.isArray(s.slugs) ? s.slugs : [];
      return profileSlugs.length > 0;
    };

    const renderAnalytics = () => {
      const hasSlugs = hasAnalyticsSlugs();
      if (!hasSlugs) {
        destroyAnalyticsCharts();
        if (el.analyticsContent instanceof HTMLElement) el.analyticsContent.classList.add("hidden");
        if (el.analyticsEmpty instanceof HTMLElement) {
          el.analyticsEmpty.classList.remove("hidden");
          el.analyticsEmpty.innerHTML = renderStateCard({
            icon: "bar-chart-2",
            title: "Нет данных",
            text: "Аналитика появится, когда у вас будут просмотры визитки.",
            buttonId: "profile-analytics-order-btn",
            buttonLabel: "Занять UNQ >",
          });
        }
        return;
      }
      if (el.analyticsContent instanceof HTMLElement) el.analyticsContent.classList.remove("hidden");
      if (el.analyticsEmpty instanceof HTMLElement) el.analyticsEmpty.classList.add("hidden");
      const payload = s.analyticsPayload;
      if (!payload) {
        destroyAnalyticsCharts();
        return;
      }

      if (el.analyticsViews) el.analyticsViews.textContent = String(Number(payload.kpi?.views || 0));
      if (el.analyticsUnique) el.analyticsUnique.textContent = String(Number(payload.kpi?.uniqueVisitors || 0));
      if (el.analyticsCtr) el.analyticsCtr.textContent = `${Number(payload.kpi?.ctr || 0)}%`;
      if (el.analyticsLock) el.analyticsLock.classList.toggle("hidden", Boolean(payload.flags?.isPremium));
      renderHeaderStats();

      const viewsByDay = Array.isArray(payload.chart?.viewsByDay) ? payload.chart.viewsByDay : [];
      const sourceEntries = Object.entries(payload.chart?.trafficSources || {});
      const deviceEntries = Object.entries(payload.chart?.devices || {});
      const buttonEntries = Object.entries(payload.chart?.buttonActivity || {});
      const geoEntries = Object.entries(payload.chart?.geography || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8);

      buildChart(
        el.analyticsViewsChart,
        {
          type: "line",
          data: {
            labels: viewsByDay.map((item) => item.date),
            datasets: [{ data: viewsByDay.map((item) => Number(item.value || 0)), borderColor: "#111827", borderWidth: 2, tension: 0.25 }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        },
        "views",
      );
      buildChart(
        el.analyticsSourcesChart,
        {
          type: "doughnut",
          data: {
            labels: sourceEntries.map((item) => item[0]),
            datasets: [{ data: sourceEntries.map((item) => Number(item[1] || 0)), backgroundColor: ["#111827", "#374151", "#6b7280", "#d1d5db", "#9ca3af"] }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
        },
        "sources",
      );
      buildChart(
        el.analyticsDevicesChart,
        {
          type: "bar",
          data: {
            labels: deviceEntries.map((item) => item[0]),
            datasets: [{ data: deviceEntries.map((item) => Number(item[1] || 0)), backgroundColor: "#111827" }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        },
        "devices",
      );
      buildChart(
        el.analyticsButtonsChart,
        {
          type: "bar",
          data: {
            labels: buttonEntries.map((item) => item[0]),
            datasets: [{ data: buttonEntries.map((item) => Number(item[1] || 0)), backgroundColor: "#374151" }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        },
        "buttons",
      );
      buildChart(
        el.analyticsGeoChart,
        {
          type: "bar",
          data: {
            labels: geoEntries.map((item) => item[0]),
            datasets: [{ data: geoEntries.map((item) => Number(item[1] || 0)), backgroundColor: "#6b7280" }],
          },
          options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        },
        "geo",
      );
    };

    const fillAnalyticsControls = () => {
      const bootstrap = s.analyticsBootstrap;
      if (!bootstrap) return;
      if (el.analyticsSlug instanceof HTMLSelectElement) {
        el.analyticsSlug.innerHTML = (Array.isArray(bootstrap.slugs) ? bootstrap.slugs : [])
          .map((item) => `<option value="${esc(item.fullSlug)}">${esc(item.fullSlug)} · ${esc(item.status || "")}</option>`)
          .join("");
        if (s.analyticsSelectedSlug) {
          el.analyticsSlug.value = s.analyticsSelectedSlug;
        }
      }
      if (el.analyticsPeriods instanceof HTMLElement) {
        const allowed = Array.isArray(bootstrap.periods) ? bootstrap.periods : [7];
        el.analyticsPeriods.innerHTML = [7, 30, 90]
          .map((period) => {
            const isAllowed = allowed.includes(period);
            const isActive = s.analyticsSelectedPeriod === period;
            return `<button type="button" data-analytics-period="${period}" class="interactive-btn rounded-lg border px-3 py-1.5 text-xs font-semibold ${isActive ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"} ${isAllowed ? "" : "opacity-50"}" ${isAllowed ? "" : "disabled"}>${period}д</button>`;
          })
          .join("");
      }
    };

    const refreshAnalytics = async () => {
      if (!s.analyticsBootstrap) {
        try {
          s.analyticsBootstrap = await api("/api/profile/analytics/bootstrap");
          s.analyticsSelectedSlug = s.analyticsBootstrap.selectedSlug || s.analyticsBootstrap.slugs?.[0]?.fullSlug || "";
          s.analyticsSelectedPeriod = 7;
        } catch {
          s.analyticsBootstrap = { slugs: [], periods: [7] };
        }
      }
      fillAnalyticsControls();
      if (!s.analyticsSelectedSlug) {
        s.analyticsPayload = null;
        renderAnalytics();
        return;
      }
      try {
        s.analyticsPayload = await api(
          `/api/profile/analytics?slug=${encodeURIComponent(s.analyticsSelectedSlug)}&period=${encodeURIComponent(s.analyticsSelectedPeriod)}`,
        );
      } catch {
        s.analyticsPayload = null;
      }
      renderAnalytics();
    };

    // ── Payment Cards Tab ─────────────────────────────────────────
    s.paymentCards = [];
    s.pcEditing = null; // card id being edited
    s.pcTags = [];
    s.pcButtons = [];

    const loadPaymentCards = async () => {
      try {
        const payload = await api("/api/profile/payment-cards");
        s.paymentCards = Array.isArray(payload.paymentCards) ? payload.paymentCards : [];
      } catch {
        s.paymentCards = [];
      }
      renderPaymentCardsList();
    };

    const renderPaymentCardsList = () => {
      if (!el.pcList) return;
      if (!s.paymentCards.length) {
        if (el.pcEmpty) el.pcEmpty.classList.remove("hidden");
        el.pcList.innerHTML = "";
        return;
      }
      if (el.pcEmpty) el.pcEmpty.classList.add("hidden");
      el.pcList.innerHTML = s.paymentCards
        .map(
          (c) =>
            `<div class="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div class="flex items-center gap-3 min-w-0">
                <img src="${esc(c.avatarUrl || "/brand/profile-thin.svg")}" alt="" class="h-10 w-10 shrink-0 rounded-full border border-neutral-200 object-cover" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">${esc(c.name || "Без имени")}</p>
                  <p class="truncate text-xs text-neutral-500">/payment/${esc(c.number)}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-xs text-neutral-400">${Number(c.viewsCount || 0)} просмотров</span>
                <button data-pc-edit="${esc(c.id)}" class="interactive-btn min-h-9 rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold">Редактировать</button>
              </div>
            </div>`,
        )
        .join("");
    };

    const pcShowEditor = (card) => {
      s.pcEditing = card.id;
      s.pcTags = Array.isArray(card.tags) ? card.tags.slice(0) : [];
      s.pcButtons = Array.isArray(card.buttons)
        ? card.buttons.map((b) => {
          const urlValue = typeof b.url === "string" && b.url.length > 0 ? b.url : typeof b.href === "string" && b.href.length > 0 ? b.href : typeof b.value === "string" ? b.value : "";
          return { ...b, href: b.href || urlValue, value: b.value || urlValue, url: urlValue };
        })
        : [];

      if (el.pcNumber) el.pcNumber.value = card.number;
      if (el.pcAvPreview) el.pcAvPreview.src = card.avatarUrl || "/brand/profile-thin.svg";
      if (el.pcName) el.pcName.value = card.name || "";
      if (el.pcRole) el.pcRole.value = card.role || "";
      if (el.pcBio) el.pcBio.value = card.bio || "";
      if (el.pcBioC) el.pcBioC.textContent = `${(card.bio || "").length}/120`;
      if (el.pcHashtag) el.pcHashtag.value = card.hashtag || "";
      if (el.pcAddress) el.pcAddress.value = card.address || "";
      if (el.pcPostcode) el.pcPostcode.value = card.postcode || "";
      if (el.pcEmail) el.pcEmail.value = card.email || "";
      if (el.pcExtraPhone) el.pcExtraPhone.value = card.extraPhone || "";
      if (el.pcOpenLink) el.pcOpenLink.href = `/payment/${card.number}`;

      pcRenderTags();
      pcRenderButtons();

      if (el.pcList) el.pcList.classList.add("hidden");
      if (el.pcEmpty) el.pcEmpty.classList.add("hidden");
      if (el.pcEditor) el.pcEditor.classList.remove("hidden");
    };

    const pcHideEditor = () => {
      s.pcEditing = null;
      if (el.pcEditor) el.pcEditor.classList.add("hidden");
      if (el.pcList) el.pcList.classList.remove("hidden");
      renderPaymentCardsList();
    };

    const pcRenderTags = () => {
      if (!el.pcTags) return;
      el.pcTags.innerHTML = s.pcTags
        .map(
          (tag, i) =>
            `<span class="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs">${esc(tag)} <button data-pc-rm-tag="${i}" class="text-neutral-500">x</button></span>`,
        )
        .join("");
    };

    const pcButtonRow = (button, index) => {
      const url = typeof button.url === "string" && button.url.length > 0 ? button.url : typeof button.href === "string" && button.href.length > 0 ? button.href : typeof button.value === "string" ? button.value : "";
      const selectedType = Object.prototype.hasOwnProperty.call(buttonTypeLabels, button.type) ? button.type : "other";
      const options = buttonTypeOptions.map(([value, label]) => `<option value="${value}" ${selectedType === value ? "selected" : ""}>${label}</option>`).join("");
      return `<div class="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_1fr_auto]" data-pc-bi="${index}">
        <select data-pc-bf="type" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">${options}</select>
        <input data-pc-bf="label" value="${esc(button.label || "")}" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
        <input data-pc-bf="href" value="${esc(url)}" class="min-w-0 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-sm">
        <button data-pc-rm-btn="${index}" class="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" aria-label="Удалить">×</button>
      </div>`;
    };

    const pcRenderButtons = () => {
      if (!el.pcBtns) return;
      el.pcBtns.innerHTML = s.pcButtons.map((b, i) => pcButtonRow(b, i)).join("");
    };

    const pcSave = async () => {
      const name = (el.pcName?.value || "").trim();
      if (!name) {
        showModal("Проверь поля", "Имя обязательно.");
        return;
      }
      try {
        // Collect button values from DOM
        const btns = [];
        el.pcBtns?.querySelectorAll("[data-pc-bi]").forEach((row) => {
          const typeField = row.querySelector('[data-pc-bf="type"]');
          const labelField = row.querySelector('[data-pc-bf="label"]');
          const hrefField = row.querySelector('[data-pc-bf="href"]');
          btns.push({
            type: typeField?.value || "other",
            label: labelField?.value || "",
            href: hrefField?.value || "",
            value: hrefField?.value || "",
          });
        });

        await api(`/api/profile/payment-cards/${s.pcEditing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            role: el.pcRole?.value || "",
            bio: el.pcBio?.value || "",
            hashtag: el.pcHashtag?.value || "",
            address: el.pcAddress?.value || "",
            postcode: el.pcPostcode?.value || "",
            email: el.pcEmail?.value || "",
            extraPhone: el.pcExtraPhone?.value || "",
            tags: s.pcTags,
            buttons: btns,
          }),
        });
        showSaveAlert("Платёжная карта сохранена");
        await loadPaymentCards();
        // Re-open editor with refreshed data
        const updated = s.paymentCards.find((c) => c.id === s.pcEditing);
        if (updated) pcShowEditor(updated);
        else pcHideEditor();
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось сохранить");
      }
    };

    const pcUploadAvatar = async (file) => {
      if (!s.pcEditing || !file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const payload = await api(`/api/profile/payment-cards/${s.pcEditing}/avatar`, { method: "POST", body: fd });
        if (el.pcAvPreview) el.pcAvPreview.src = payload.avatarUrl || "/brand/profile-thin.svg";
        await loadPaymentCards();
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось загрузить аватар");
      }
    };

    const pcRemoveAvatar = async () => {
      if (!s.pcEditing) return;
      try {
        await api(`/api/profile/payment-cards/${s.pcEditing}/avatar`, { method: "DELETE" });
        if (el.pcAvPreview) el.pcAvPreview.src = "/brand/profile-thin.svg";
        await loadPaymentCards();
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось удалить аватар");
      }
    };

    // Payment cards event listeners
    el.pcList?.addEventListener("click", async (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest("[data-pc-edit]") : null;
      if (!btn) return;
      const cardId = btn.getAttribute("data-pc-edit");
      try {
        const payload = await api(`/api/profile/payment-cards/${cardId}`);
        pcShowEditor(payload.paymentCard || payload);
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось загрузить карточку");
      }
    });

    el.pcBack?.addEventListener("click", () => pcHideEditor());
    el.pcSave?.addEventListener("click", () => pcSave());

    el.pcAvFile?.addEventListener("change", () => {
      const file = el.pcAvFile?.files?.[0];
      if (file) pcUploadAvatar(file);
    });
    el.pcAvRemove?.addEventListener("click", () => pcRemoveAvatar());

    el.pcBio?.addEventListener("input", () => {
      if (el.pcBioC) el.pcBioC.textContent = `${(el.pcBio?.value || "").length}/120`;
    });

    el.pcTagAdd?.addEventListener("click", () => {
      const raw = (el.pcTagInput?.value || "").trim();
      if (!raw) return;
      if (s.pcTags.length >= 5) {
        showModal("Лимит тегов", "Можно добавить до 5 тегов.");
        return;
      }
      s.pcTags.push((raw.startsWith("#") ? raw : `#${raw}`).slice(0, 32));
      if (el.pcTagInput) el.pcTagInput.value = "";
      pcRenderTags();
    });

    el.pcTags?.addEventListener("click", (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest("[data-pc-rm-tag]") : null;
      if (!btn) return;
      const i = Number(btn.getAttribute("data-pc-rm-tag"));
      if (Number.isFinite(i) && i >= 0 && i < s.pcTags.length) {
        s.pcTags.splice(i, 1);
        pcRenderTags();
      }
    });

    el.pcBtnAdd?.addEventListener("click", () => {
      if (s.pcButtons.length >= 6) {
        showModal("Лимит кнопок", "Можно добавить до 6 кнопок.");
        return;
      }
      s.pcButtons.push({ type: "other", label: buttonTypeLabels.other, href: "", value: "", url: "" });
      pcRenderButtons();
    });

    el.pcBtns?.addEventListener("click", (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest("[data-pc-rm-btn]") : null;
      if (!btn) return;
      const i = Number(btn.getAttribute("data-pc-rm-btn"));
      if (Number.isFinite(i) && i >= 0 && i < s.pcButtons.length) {
        s.pcButtons.splice(i, 1);
        pcRenderButtons();
      }
    });

    el.pcBtns?.addEventListener("input", (e) => {
      const node = e.target instanceof HTMLElement ? e.target : null;
      if (!node) return;
      const row = node.closest("[data-pc-bi]");
      if (!(row instanceof HTMLElement)) return;
      const i = Number(row.getAttribute("data-pc-bi"));
      if (!s.pcButtons[i]) return;
      const typeField = row.querySelector('[data-pc-bf="type"]');
      const labelField = row.querySelector('[data-pc-bf="label"]');
      const hrefField = row.querySelector('[data-pc-bf="href"]');
      if (typeField instanceof HTMLSelectElement) s.pcButtons[i].type = typeField.value;
      if (labelField instanceof HTMLInputElement) s.pcButtons[i].label = labelField.value;
      if (hrefField instanceof HTMLInputElement) s.pcButtons[i].url = hrefField.value;
    });
    // ── End Payment Cards Tab ─────────────────────────────────────

    const renderAll = () => {
      renderWelcomeBanner();
      renderSidebar();
      renderHeaderStats();
      renderSlugs();
      renderCard();
      renderWall();
      renderCommunity();
      renderAnalytics();
      renderRequests();
      renderSettings();
      renderReferrals();
      renderScore();
      renderPaymentCardsList();
    };

    const setLoading = (loading) => {
      el.panels.forEach((panel) => {
        panel.classList.toggle("opacity-60", loading);
        panel.classList.toggle("pointer-events-none", loading);
      });
      if (loading && el.slugs) {
        el.slugs.innerHTML = '<div class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">Загрузка данных профиля...</div>';
      }
    };

    const load = async () => {
      setLoading(true);
      try {
        const prevAvatarUrl = s.card?.avatarUrl || "";
        const payload = await api("/api/profile/bootstrap");
        s.user = payload.user || null;
        if (typeof window !== "undefined") {
          window.UNQProfileUser = s.user;
          window.UNQProfileSubscription = payload.subscription || null;
        }
        settingsLoginDraft = normalizeProfileLoginValue(s.user?.login);
        settingsLoginAvailability = {
          state: "idle",
          login: settingsLoginDraft,
          message: "",
        };
        if (settingsLoginCheckTimer) {
          window.clearTimeout(settingsLoginCheckTimer);
          settingsLoginCheckTimer = null;
        }
        settingsLoginRequestId = 0;
        if (s.user && typeof s.user === "object") {
          s.user.effectivePlan = getCurrentPlan();
        }
        s.limits = payload.limits || {};
        s.slugs = payload.slugs || [];
        s.card = payload.card || null;
        s.tracks = normalizeTracks(payload.tracks);
        s.selectedTrackId = getCurrentPlan() === "premium" ? normalizeTrackId(s.card?.selectedTrackId) : null;
        s.petLibrary = normalizePetLibrary(payload.petLibrary);
        s.selectedPetId = getCurrentPlan() === "premium" ? normalizeTrackId(s.card?.selectedPetId) : null;
        const nextAvatarUrl = s.card?.avatarUrl || "";
        if (nextAvatarUrl !== prevAvatarUrl) {
          s.avatarVersion = Date.now();
        }
        s.requests = payload.requests || [];
        s.petCatalog = normalizePetCatalog(payload.petCatalog);
        s.pets = normalizeOwnedPets(payload.pets || payload.card?.pets);
        s.petDrafts = buildPetDraftMap({
          catalog: s.petCatalog,
          pets: s.pets,
          requests: s.requests,
          previous: s.petDrafts,
        });
        s.score = payload.score || null;
        s.pricing = payload.pricing || s.pricing;
        s.privatePasswords = Array.isArray(payload?.privacy?.passwords) ? payload.privacy.passwords : [];
        s.privatePasswordMinLength = Number(payload?.privacy?.passwordMinLength || 4) || 4;
        s.privatePasswordLimit = Number(payload?.privacy?.passwordLimit || 10) || 10;
        s.wallSummary = normalizeWallSummary(payload.wallSummary);
        s.followSummary = normalizeFollowSummary(payload.followSummary);
        s.wallPosts = [];
        s.wallPagination = emptyWallPagination();
        s.wallLoaded = !s.wallSummary.canUseWall;
        s.wallLoading = false;
        s.wallSaving = false;
        s.wallCommentDrafts = {};
        s.wallBusyCommentPostIds = new Set();
        s.wallBusyCommentIds = new Set();
        s.wallExpandedCommentPostIds = new Set();
        s.communityType = normalizeCommunityType(s.communityType || "followers");
        s.communityItems = [];
        s.communityPagination = emptyCommunityPagination();
        s.communityLoaded = false;
        s.communityLoading = false;
        s.communityUnreadMarking = false;
        s.communityBusySlugs = new Set();
        resetWallComposer();
        closeWallComposerModal({ restoreFocus: false });
        if (!s.slugs.find((item) => item.fullSlug === s.analyticsSelectedSlug)) {
          s.analyticsBootstrap = null;
          s.analyticsPayload = null;
          s.analyticsSelectedSlug = "";
        }
        try {
          s.referrals = await api("/api/referrals/bootstrap");
        } catch {
          s.referrals = null;
        }
        try {
          s.verification = await api("/api/profile/verification");
        } catch {
          s.verification = null;
        }
        renderAll();
        if (s.wallSummary.canUseWall) {
          void loadWallPosts();
        }
        if (currentTab() === "community") {
          void loadCommunity();
        }
        // Синхронизировать dirty-state и убрать legacy-черновики из localStorage
        restoreDraft();
      } catch (error) {
        if (error?.code === "AUTH_REQUIRED" || error?.code === "ACCOUNT_DISABLED") {
          location.replace("/");
          return;
        }
        throw error;
      } finally {
        setLoading(false);
      }
    };

    const refreshPrivateAccessData = async () => {
      try {
        const passwordsPayload = await api("/api/profile/privacy/passwords");
        s.privatePasswords = Array.isArray(passwordsPayload?.items) ? passwordsPayload.items : [];
        s.privatePasswordMinLength = Number(passwordsPayload?.minLength || s.privatePasswordMinLength || 4) || 4;
        s.privatePasswordLimit = Number(passwordsPayload?.limit || s.privatePasswordLimit || 10) || 10;
        renderPrivateAccessSettings();
      } catch (error) {
        console.error("[profile] failed to refresh private access data", error);
      }
    };

    const saveCard = async () => {
      if ((el.cName?.value || "").trim().length === 0) {
        if (el.cardNameError) {
          el.cardNameError.classList.remove("hidden");
        }
        showModal("Проверь поля", "Имя для визитки обязательно.");
        return;
      }
      if (el.cardNameError) {
        el.cardNameError.classList.add("hidden");
      }

      try {
        await api("/api/profile/card", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: el.cName?.value || "",
            bio: el.cBio?.value || "",
            hashtag: el.cHashtag?.value || "",
            address: el.cAddress?.value || "",
            postcode: el.cPostcode?.value || "",
            email: el.cEmail?.value || "",
            extraPhone: el.cExtraPhone?.value || "",
            tags: s.tags,
            buttons: (s.buttons || []).map((b) => ({
              type: b.type || 'other',
              label: b.label || '',
              href: typeof b.url === 'string' ? b.url : (typeof b.href === 'string' ? b.href : ''),
              value: typeof b.url === 'string' ? b.url : (typeof b.value === 'string' ? b.value : ''),
            })),
            theme: s.theme,
            avatarFrame: s.avatarFrame || "none",
            emojiBackgroundPack: s.emojiBackgroundPack || "none",
            selectedTrackId: getCurrentPlan() === "premium" ? normalizeTrackId(s.selectedTrackId) : null,
            selectedPetId: getCurrentPlan() === "premium" ? normalizeTrackId(s.selectedPetId) : null,
            showBranding: el.cBranding ? !el.cBranding.checked : true,
            pets: normalizeOwnedPets(s.pets).map((pet) => ({
              id: pet.id,
              displayName: pet.displayName,
              isVisible: pet.isVisible,
            })),
          }),
        });

        clearDraft();
        try {
          await load();
        } catch (loadError) {
          console.error("[profile] reload after card save failed", loadError);
        }
        showSaveAlert(PROFILE_SAVE_SUCCESS_MESSAGE);
      } catch (error) {
        if (error.code === "UPGRADE_REQUIRED") {
          showModal("Доступно на Премиум", "Эта функция доступна только для Премиум тарифа.");
          return;
        }
        showModal("Ошибка", error.message || "Не удалось сохранить визитку");
      }
    };

    const closeQrModal = () => {
      if (!(el.qrModal instanceof HTMLElement)) return;
      el.qrModal.classList.add("hidden");
      el.qrModal.classList.remove("flex");
      if (el.qrBox) el.qrBox.innerHTML = "";
    };

    const applyLogoToQrCanvas = async (canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = Math.round(canvas.width * 0.22);
      const x = Math.round((canvas.width - size) / 2);
      const y = Math.round((canvas.height - size) / 2);
      const pad = Math.max(6, Math.round(size * 0.14));
      const boxX = x - pad;
      const boxY = y - pad;
      const boxSize = size + pad * 2;
      const radius = Math.max(8, Math.round(boxSize * 0.18));

      const logo = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "/brand/logo.PNG";
      });
      if (!logo) return;

      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.lineTo(boxX + boxSize - radius, boxY);
      ctx.quadraticCurveTo(boxX + boxSize, boxY, boxX + boxSize, boxY + radius);
      ctx.lineTo(boxX + boxSize, boxY + boxSize - radius);
      ctx.quadraticCurveTo(boxX + boxSize, boxY + boxSize, boxX + boxSize - radius, boxY + boxSize);
      ctx.lineTo(boxX + radius, boxY + boxSize);
      ctx.quadraticCurveTo(boxX, boxY + boxSize, boxX, boxY + boxSize - radius);
      ctx.lineTo(boxX, boxY + radius);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.drawImage(logo, x, y, size, size);
      ctx.restore();
    };

    const openQrModal = async (slug) => {
      if (getCurrentPlan() !== "premium") {
        showModal("Доступно на Премиум", "QR-код доступен только для Премиум тарифа.");
        return;
      }
      const payload = await api(`/api/profile/slugs/${encodeURIComponent(slug)}/qr`);
      if (!(el.qrModal instanceof HTMLElement)) return;
      el.qrModal.classList.remove("hidden");
      el.qrModal.classList.add("flex");
      if (el.qrLink) el.qrLink.textContent = payload.url || "";
      if (el.qrBox) {
        el.qrBox.innerHTML = "";
        if (typeof QRCode !== "undefined" && payload.url) {
          await new Promise((resolve) => {
            QRCode.toCanvas(payload.url, { width: 300, margin: 2, errorCorrectionLevel: "H" }, async (error, canvas) => {
              if (!error && canvas instanceof HTMLCanvasElement && el.qrBox) {
                await applyLogoToQrCanvas(canvas);
                el.qrBox.innerHTML = "";
                el.qrBox.appendChild(canvas);
              }
              resolve();
            });
          });
        }
      }
    };

    const openOrderModal = (options = {}) => {
      const modalApi = window.UNQOrderModal;
      if (modalApi && typeof modalApi.open === "function") {
        modalApi.open(options);
        return true;
      }

      const fallbackRoot = document.getElementById("order-modal-root");
      if (fallbackRoot instanceof HTMLElement) {
        if (fallbackRoot.dataset.fallbackBound !== "1") {
          fallbackRoot.dataset.fallbackBound = "1";
          const closeFallback = () => {
            fallbackRoot.classList.remove("is-open", "block");
            fallbackRoot.classList.add("hidden");
            fallbackRoot.style.display = "none";
            document.body.classList.remove("modal-open");
          };
          const fallbackBackdrop = document.getElementById("order-modal-backdrop");
          const fallbackCloseTop = document.getElementById("order-modal-close-top");
          const fallbackCloseForm = document.getElementById("order-modal-close-form");
          const fallbackCloseSuccess = document.getElementById("order-modal-close-success");
          fallbackBackdrop?.addEventListener("click", closeFallback);
          fallbackCloseTop?.addEventListener("click", closeFallback);
          fallbackCloseForm?.addEventListener("click", closeFallback);
          fallbackCloseSuccess?.addEventListener("click", closeFallback);
        }
        fallbackRoot.style.display = "block";
        fallbackRoot.classList.remove("hidden");
        fallbackRoot.classList.add("block", "is-open");
        document.body.classList.add("modal-open");
        const fallbackDialog = document.getElementById("order-modal-dialog");
        if (fallbackDialog instanceof HTMLElement) {
          requestAnimationFrame(() => fallbackDialog.focus());
        }
        return true;
      }

      showModal("Ошибка", "Не удалось открыть форму заказа. Обновите страницу.");
      return false;
    };

    const openPremiumRenewalModal = () =>
      openOrderModal({
        plan: "premium",
        orderKind: SUBSCRIPTION_RENEWAL_ORDER_KIND,
      });

    el.tabs.forEach((button) =>
      button.addEventListener("click", () => {
        location.hash = `#${button.getAttribute("data-tab-target") || "slugs"}`;
      }),
    );

    el.wallEditor?.addEventListener("input", () => {
      if (!(el.wallEditor instanceof HTMLTextAreaElement)) return;
      s.wallDraftContent = el.wallEditor.value.slice(0, WALL_POST_CONTENT_MAX);
      if (el.wallEditor.value !== s.wallDraftContent) {
        el.wallEditor.value = s.wallDraftContent;
      }
      updateWallComposerState();
    });

    el.wallCommentsEnabled?.addEventListener("change", () => {
      if (!(el.wallCommentsEnabled instanceof HTMLInputElement)) return;
      s.wallDraftCommentsEnabled = el.wallCommentsEnabled.checked;
      updateWallComposerState();
    });

    el.wallOpenComposer?.addEventListener("click", () => {
      openWallComposerModal({ mode: "new" });
    });

    el.wallComposerClose?.addEventListener("click", () => {
      if (s.wallSaving) return;
      closeWallComposerModal();
    });

    el.wallComposerCloseTop?.addEventListener("click", () => {
      if (s.wallSaving) return;
      closeWallComposerModal();
    });

    el.wallComposerModal?.addEventListener("click", (event) => {
      if (s.wallSaving) return;
      if (event.target === el.wallComposerModal) {
        closeWallComposerModal();
      }
    });

    el.wallSubmit?.addEventListener("click", () => {
      void submitWallPost();
    });

    el.wallCancel?.addEventListener("click", () => {
      resetWallComposer();
      updateWallComposerState();
      closeWallComposerModal();
    });

    el.wallLoadMore?.addEventListener("click", () => {
      void loadWallPosts({ append: true });
    });

    el.wallList?.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!(target instanceof HTMLTextAreaElement)) return;
      if (!target.matches("[data-wall-comment-input]")) return;
      const postId = String(target.getAttribute("data-wall-post-id") || "").trim();
      if (!postId) return;
      setWallCommentDraft(postId, target.value);
      if (target.value !== getWallCommentDraft(postId)) {
        target.value = getWallCommentDraft(postId);
      }
      const form = target.closest(".profile-wall-comment-form");
      const counter = form instanceof HTMLElement ? form.querySelector("[data-wall-comment-counter]") : null;
      if (counter instanceof HTMLElement) {
        counter.textContent = `${getWallCommentDraft(postId).length}/${WALL_COMMENT_CONTENT_MAX}`;
      }
      const submit = form instanceof HTMLElement ? form.querySelector("[data-wall-comment-submit]") : null;
      if (submit instanceof HTMLButtonElement) {
        const isBusy = s.wallBusyCommentPostIds instanceof Set && s.wallBusyCommentPostIds.has(postId);
        submit.disabled = isBusy;
      }
    });

    el.wallList?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const toggleComments = target?.closest("[data-wall-comments-toggle]");
      if (toggleComments instanceof HTMLElement) {
        const postId = String(toggleComments.getAttribute("data-wall-post-id") || "").trim();
        if (!postId) return;
        setWallCommentsExpanded(postId, !isWallCommentsExpanded(postId));
        renderWallList();
        return;
      }
      const submitComment = target?.closest("[data-wall-comment-submit]");
      if (submitComment instanceof HTMLElement) {
        const postId = String(submitComment.getAttribute("data-wall-post-id") || "").trim();
        if (!postId) return;
        void submitWallComment(postId);
        return;
      }
      const commentAction = target?.closest("[data-wall-comment-action]");
      if (commentAction instanceof HTMLElement) {
        const postId = String(commentAction.getAttribute("data-wall-post-id") || "").trim();
        const commentId = String(commentAction.getAttribute("data-wall-comment-id") || "").trim();
        const type = String(commentAction.getAttribute("data-wall-comment-action") || "").trim();
        if (type === "delete" && postId && commentId) {
          deleteWallComment(postId, commentId);
        }
        return;
      }
      const action = target?.closest("[data-wall-action]");
      if (!(action instanceof HTMLElement)) return;
      const postId = String(action.getAttribute("data-wall-post-id") || "").trim();
      if (!postId) return;
      const type = String(action.getAttribute("data-wall-action") || "");
      if (type === "edit") {
        startWallEdit(postId);
        return;
      }
      if (type === "delete") {
        deleteWallPost(postId);
      }
    });

    el.communityFilters?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-community-type]") : null;
      if (!(target instanceof HTMLElement)) return;
      const type = String(target.getAttribute("data-community-type") || "").trim();
      setCommunityType(type);
    });

    el.communityLoadMore?.addEventListener("click", () => {
      void loadCommunity({ append: true });
    });

    el.communityList?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-community-follow-toggle]") : null;
      if (!(target instanceof HTMLElement)) return;
      const slug = String(target.getAttribute("data-community-slug") || "").trim();
      const following = String(target.getAttribute("data-community-following") || "").trim() === "true";
      void toggleCommunityFollow(slug, following);
    });

    el.analyticsSlug?.addEventListener("change", () => {
      if (!(el.analyticsSlug instanceof HTMLSelectElement)) return;
      s.analyticsSelectedSlug = el.analyticsSlug.value;
      void refreshAnalytics();
    });

    document.addEventListener("click", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const periodButton = target.closest("[data-analytics-period]");
      if (!(periodButton instanceof HTMLElement)) return;
      const nextPeriod = Number(periodButton.getAttribute("data-analytics-period"));
      if (!Number.isFinite(nextPeriod)) return;
      s.analyticsSelectedPeriod = nextPeriod;
      void refreshAnalytics();
    });

    el.refCopy?.addEventListener("click", async () => {
      const value = el.refLink instanceof HTMLInputElement ? el.refLink.value : "";
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        if (el.refCopy) {
          el.refCopy.textContent = "Скопировано";
          setTimeout(() => {
            if (el.refCopy) el.refCopy.textContent = "Скопировать ссылку";
          }, 1200);
        }
      } catch {
        showModal("Ошибка", "Не удалось скопировать ссылку");
      }
    });

    window.addEventListener("hashchange", setTab);
    setTab();

    el.modalClose?.addEventListener("click", closeModal);
    el.modalCloseTop?.addEventListener("click", closeModal);
    el.modal?.addEventListener("click", (event) => {
      if (event.target === el.modal) closeModal();
    });
    el.emailModalCloseTop?.addEventListener("click", closeEmailModal);
    el.emailModalCancel?.addEventListener("click", closeEmailModal);
    el.emailModal?.addEventListener("click", (event) => {
      if (event.target === el.emailModal) closeEmailModal();
    });
    el.emailRequiredClose?.addEventListener("click", closeEmailRequiredModal);
    el.emailRequiredLater?.addEventListener("click", closeEmailRequiredModal);
    el.emailRequiredOpen?.addEventListener("click", () => {
      closeEmailRequiredModal();
      openEmailModal();
    });
    el.emailRequiredModal?.addEventListener("click", (event) => {
      if (event.target === el.emailRequiredModal) closeEmailRequiredModal();
    });
    el.emailModalSubmit?.addEventListener("click", () => {
      void handleEmailRequest();
    });
    el.emailModalVerify?.addEventListener("click", () => {
      void handleEmailVerify();
    });
    el.emailModalBack?.addEventListener("click", () => {
      setEmailModalStep("request");
      requestAnimationFrame(() => {
        if (el.emailNewEmail instanceof HTMLInputElement) el.emailNewEmail.focus();
      });
    });
    el.emailVerifyCode?.addEventListener("input", () => {
      if (!(el.emailVerifyCode instanceof HTMLInputElement)) return;
      el.emailVerifyCode.value = el.emailVerifyCode.value.replace(/\D/g, "").slice(0, 6);
    });
    el.passwordModalCloseTop?.addEventListener("click", closePasswordModal);
    el.passwordModalClose?.addEventListener("click", closePasswordModal);
    el.passwordModal?.addEventListener("click", (event) => {
      if (event.target === el.passwordModal) closePasswordModal();
    });
    el.passwordModalSubmit?.addEventListener("click", () => {
      void handlePasswordChange();
    });
    el.privatePasswordAddCloseTop?.addEventListener("click", closePrivatePasswordAddModal);
    el.privatePasswordAddCancel?.addEventListener("click", closePrivatePasswordAddModal);
    el.privatePasswordAddModal?.addEventListener("click", (event) => {
      if (event.target === el.privatePasswordAddModal) closePrivatePasswordAddModal();
    });
    el.privatePasswordAddSubmit?.addEventListener("click", () => {
      void handlePrivatePasswordAdd();
    });
    el.privatePasswordAddValue?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handlePrivatePasswordAdd();
    });
    el.privatePasswordChangeCloseTop?.addEventListener("click", closePrivatePasswordChangeModal);
    el.privatePasswordChangeCancel?.addEventListener("click", closePrivatePasswordChangeModal);
    el.privatePasswordChangeModal?.addEventListener("click", (event) => {
      if (event.target === el.privatePasswordChangeModal) closePrivatePasswordChangeModal();
    });
    el.privatePasswordChangeSubmit?.addEventListener("click", () => {
      void handlePrivatePasswordChange();
    });
    el.privatePasswordChangeNew?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handlePrivatePasswordChange();
    });
    const trapFocus = (dialog, event) => {
      if (!(dialog instanceof HTMLElement)) return;
      const focusable = Array.from(
        dialog.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => item instanceof HTMLElement && item.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
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
    };
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (wallComposerModalOpen && !s.wallSaving) {
          closeWallComposerModal();
          return;
        }
        if (emailModalOpen) {
          closeEmailModal();
          return;
        }
        if (passwordModalOpen) {
          closePasswordModal();
          return;
        }
        if (privatePasswordChangeModalOpen) {
          closePrivatePasswordChangeModal();
          return;
        }
        if (privatePasswordAddModalOpen) {
          closePrivatePasswordAddModal();
          return;
        }
        if (modalIsOpen) {
          closeModal();
        }
        return;
      }
      if (event.key !== "Tab") return;
      if (wallComposerModalOpen && el.wallComposerDialog instanceof HTMLElement) {
        trapFocus(el.wallComposerDialog, event);
        return;
      }
      if (emailModalOpen && el.emailModalDialog instanceof HTMLElement) {
        trapFocus(el.emailModalDialog, event);
        return;
      }
      if (passwordModalOpen && el.passwordModalDialog instanceof HTMLElement) {
        trapFocus(el.passwordModalDialog, event);
        return;
      }
      if (privatePasswordChangeModalOpen && el.privatePasswordChangeDialog instanceof HTMLElement) {
        trapFocus(el.privatePasswordChangeDialog, event);
        return;
      }
      if (privatePasswordAddModalOpen && el.privatePasswordAddDialog instanceof HTMLElement) {
        trapFocus(el.privatePasswordAddDialog, event);
        return;
      }
      if (modalIsOpen && el.modalDialog instanceof HTMLElement) {
        trapFocus(el.modalDialog, event);
      }
    });

    el.addSlug?.addEventListener("click", () => {
      const plan = getCurrentPlan();
      const count = s.slugs.length;
      if (plan === "none") {
        openOrderModal({});
        return;
      }

      if (plan === "premium" && count >= 3) {
        showModal("Лимит достигнут", "Достигнут лимит 3 UNQ для Премиум тарифа");
        return;
      }

      if (plan !== "premium" && count >= 1) {
        showModal(
          PREMIUM_REQUIRED_TITLE,
          PREMIUM_UPSELL_NOTE,
          PREMIUM_CTA_LABEL,
          () => {
            openPremiumRenewalModal();
          },
        );
        return;
      }
      openOrderModal({});
    });

    el.reqNewBtn?.addEventListener("click", () => {
      const plan = getCurrentPlan();
      const count = s.slugs.length;
      if (plan === "none") {
        openOrderModal({});
        return;
      }
      if (plan !== "premium" && count >= 1) {
        showModal(
          PREMIUM_REQUIRED_TITLE,
          PREMIUM_UPSELL_NOTE,
          PREMIUM_CTA_LABEL,
          () => {
            openPremiumRenewalModal();
          },
        );
        return;
      }
      if (plan === "premium" && count >= 3) {
        showModal("Лимит достигнут", "Достигнут лимит 3 UNQ");
        return;
      }
      openOrderModal({});
    });

    document.addEventListener("change", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const toggle = target?.closest("[data-sale-toggle]");
      if (!(toggle instanceof HTMLInputElement)) return;
      const slug = String(toggle.getAttribute("data-slug") || "").trim();
      if (!slug) return;
      const input = document.querySelector(`[data-sale-price][data-slug="${cssEscape(slug)}"]`);
      if (input instanceof HTMLInputElement) {
        input.disabled = !toggle.checked;
        if (!toggle.checked) {
          input.value = "";
        } else {
          input.focus();
        }
      }
    });

    document.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const input = target?.closest("[data-sale-price]");
      if (!(input instanceof HTMLInputElement)) return;
      input.value = formatMoneyInput(input.value);
    });

    document.addEventListener("click", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const actionNode = target.closest("[data-a]");
      const action = actionNode instanceof HTMLElement ? actionNode.getAttribute("data-a") : "";

      if (action === "request-filter") {
        const nextFilter = actionNode instanceof HTMLElement ? actionNode.getAttribute("data-filter") : "";
        s.requestFilter = nextFilter;
        renderRequests();
        return;
      }

      if (action === "settings-category") {
        const nextCategory = actionNode instanceof HTMLElement ? actionNode.getAttribute("data-settings-category") : "";
        s.settingsCategory = nextCategory;
        renderSettingsCategory();
        return;
      }

      if (action === "card-editor-category") {
        const nextCategory = actionNode instanceof HTMLElement ? actionNode.getAttribute("data-card-editor-category") : "";
        s.cardEditorCategory = nextCategory;
        renderCardEditorCategory();
        return;
      }

      if (action === "open-qr") {
        const slug = String(actionNode.getAttribute("data-slug") || "").trim();
        if (!slug) return;
        try {
          await openQrModal(slug);
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось открыть QR");
        }
        return;
      }

      if (action === "card-status") {
        const requested = normalizeCardVisibilityStatus(actionNode.getAttribute("data-status"));
        const slugs = Array.isArray(s.slugs) ? s.slugs : [];
        if (!slugs.length) {
          showModal("Ошибка", "UNQ не найден");
          return;
        }

        const visibility = resolveCardVisibility();
        if (!visibility.mixed && visibility.status === requested) {
          return;
        }

        try {
          await api("/api/profile/card/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: requested }),
          });

          slugs.forEach((item) => {
            item.status = requested;
            item.statusLabel = cardVisibilityLabel(requested);
          });

          renderSlugs();
          renderPreview();
          showSaveAlert("Статус визитки обновлён");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось обновить статус визитки");
        }
        return;
      }

      if (action === "save-card-pm") {
        const slugs = Array.isArray(s.slugs) ? s.slugs : [];
        const pausedSlugs = slugs.filter((item) => normalizeCardVisibilityStatus(item?.status) === "paused");
        if (!pausedSlugs.length) {
          showModal("Ошибка", "Сначала включите статус Пауза");
          return;
        }
        const input = document.querySelector("[data-card-pm]");
        const message = input instanceof HTMLInputElement ? String(input.value || "").trim() : "";

        try {
          await Promise.all(
            pausedSlugs.map((item) =>
              api(`/api/profile/slugs/${encodeURIComponent(item.fullSlug)}/pause-message`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
              })),
          );

          pausedSlugs.forEach((item) => {
            item.pauseMessage = message;
          });

          renderSlugs();
          showSaveAlert(PROFILE_SAVE_SUCCESS_MESSAGE);
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось сохранить сообщение паузы");
        }
        return;
      }

      if (action === "save-slug-sale") {
        const slug = String(actionNode.getAttribute("data-slug") || "").trim();
        if (!slug) return;
        const checkbox = document.querySelector(`[data-sale-toggle][data-slug="${cssEscape(slug)}"]`);
        const priceInput = document.querySelector(`[data-sale-price][data-slug="${cssEscape(slug)}"]`);
        const onSale = checkbox instanceof HTMLInputElement ? checkbox.checked : false;
        const salePrice = priceInput instanceof HTMLInputElement ? parseMoneyInput(priceInput.value) : 0;
        if (onSale && salePrice <= 0) {
          showModal("Цена продажи", "Укажите сумму в UZS, чтобы выставить UNQ на продажу.");
          return;
        }

        try {
          const payload = await api(`/api/profile/slugs/${encodeURIComponent(slug)}/sale`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onSale, salePrice }),
          });
          const slugs = Array.isArray(s.slugs) ? s.slugs : [];
          const targetSlug = slugs.find((item) => String(item.fullSlug) === slug);
          if (targetSlug) {
            targetSlug.onSale = Boolean(payload.onSale);
            targetSlug.salePrice = payload.salePrice || null;
          }
          renderSlugs();
          renderPreview();
          showSaveAlert(onSale ? "UNQ выставлен на продажу" : "UNQ снят с продажи");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось сохранить продажу");
        }
        return;
      }

      if (action === "primary") {
        const slug = String(actionNode.getAttribute("data-slug") || "").trim();
        if (!slug) return;
        try {
          await api(`/api/profile/slugs/${encodeURIComponent(slug)}/primary`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const slugs = Array.isArray(s.slugs) ? s.slugs : [];
          slugs.forEach((item) => {
            item.isPrimary = String(item.fullSlug) === slug;
          });
          renderSlugs();
          renderPreview();
          showSaveAlert("Основной UNQ обновлён");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось обновить основной UNQ");
        }
        return;
      }

      if (action === "open-private-change") {
        const passwordId = String(actionNode.getAttribute("data-password-id") || "").trim();
        if (!passwordId) return;
        openPrivatePasswordChangeModal(passwordId);
        return;
      }

      if (action === "delete-private-password") {
        const passwordId = String(actionNode.getAttribute("data-password-id") || "").trim();
        if (!passwordId) return;
        showModal("Удалить пароль?", "Этот пароль больше не будет открывать приватную визитку.", "Удалить", async () => {
          try {
            await api(`/api/profile/privacy/passwords/${encodeURIComponent(passwordId)}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            await refreshPrivateAccessData();
            showSaveAlert("Пароль удалён");
          } catch (error) {
            showModal("Ошибка", error.message || "Не удалось удалить пароль");
          }
        });
        return;
      }

      if (action === "goto-card") {
        location.hash = "#card";
        return;
      }

      if (action === "claim-reward") {
        const ruleId = String(actionNode.getAttribute("data-rule") || "").trim();
        if (!ruleId) return;
        try {
          await api(`/api/features/referrals/rewards/${encodeURIComponent(ruleId)}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          try {
            s.referrals = await api("/api/referrals/bootstrap");
          } catch {
            s.referrals = null;
          }
          renderReferrals();
          showSaveAlert("Награда начислена");
        } catch (error) {
          showModal("Ошибка", error.message || "Не удалось забрать награду");
        }
        return;
      }

      const shareButton = target.closest("[data-share-card]");
      if (shareButton instanceof HTMLElement) {
        const cardRoot = shareButton.closest("[data-card-view]");
        const shareUrl = String(cardRoot?.getAttribute("data-share-url") || location.href || "").trim();
        const labelNode = cardRoot?.querySelector("[data-share-label]");
        let shared = false;
        try {
          if (navigator.share && shareUrl) {
            await navigator.share({ title: document.title, url: shareUrl });
            shared = true;
          }
        } catch {
          shared = false;
        }

        if (!shared) {
          const copied = await copyText(shareUrl);
          if (labelNode instanceof HTMLElement) {
            labelNode.textContent = copied ? "Скопировано" : "Ошибка";
          }
          if (copied) {
            showSaveAlert("Ссылка скопирована");
          } else {
            showModal("Ошибка", "Не удалось скопировать ссылку");
          }
        } else if (labelNode instanceof HTMLElement) {
          labelNode.textContent = "Отправлено";
        }

        if (labelNode instanceof HTMLElement) {
          window.setTimeout(() => {
            labelNode.textContent = "Поделиться";
          }, 1600);
        }
        return;
      }

      const saveContactButton = target.closest("[data-save-contact]");
      if (saveContactButton instanceof HTMLElement) {
        const { card, primarySlug } = buildPreviewCardData();
        const cardRoot = saveContactButton.closest("[data-card-view]");
        const shareUrl = String(cardRoot?.getAttribute("data-share-url") || location.href || "").trim();
        const fullName = String(card?.name || "UNQX User").trim();
        const phone = String(card?.extraPhone || "").trim();
        const email = String(card?.email || "").trim();
        const safeName = fullName || "UNQX User";
        const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${safeName}`];
        if (phone) {
          lines.push(`TEL;TYPE=CELL:${phone}`);
        }
        if (email) {
          lines.push(`EMAIL;TYPE=INTERNET:${email}`);
        }
        if (shareUrl) {
          lines.push(`URL:${shareUrl}`);
        }
        lines.push("END:VCARD");
        const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filename = String(primarySlug?.fullSlug || "unq-card").toLowerCase().replace(/[^a-z0-9_-]/g, "");
        link.href = downloadUrl;
        link.download = `${filename || "contact"}.vcf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        showSaveAlert("Контакт сохранён");
        return;
      }

      const copyCardButton = target.closest("[data-copy-card]");
      if (copyCardButton instanceof HTMLElement) {
        const cardToCopy = String(copyCardButton.getAttribute("data-copy-card") || "").trim();
        if (!cardToCopy) return;
        const copied = await copyText(cardToCopy);
        const labelNode = copyCardButton.querySelector("span");
        const previousText = labelNode instanceof HTMLElement ? labelNode.textContent || "" : "";
        if (labelNode instanceof HTMLElement) {
          labelNode.textContent = copied ? "Скопировано" : "Ошибка копирования";
          window.setTimeout(() => {
            labelNode.textContent = previousText;
          }, 1400);
        }
        if (copied) {
          showSaveAlert("Номер карты скопирован");
        } else {
          showModal("Ошибка", "Не удалось скопировать номер карты");
        }
        return;
      }

      const buyPetNode = target.closest('[data-a="buy-pet"]');
      if (buyPetNode instanceof HTMLElement) {
        const petType = String(buyPetNode.getAttribute("data-pet-type") || "").trim().toLowerCase();
        const displayName = String(s.petDrafts?.[petType] || "").trim();
        if (!PET_TYPES.includes(petType)) {
          showModal("Ошибка", "Не удалось определить тип питомца");
          return;
        }
        if (!displayName) {
          showModal("Нужно имя", "Сначала задай имя животному.");
          return;
        }
        try {
          await api("/api/profile/pet-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ petType, displayName }),
          });
          await load();
          location.hash = "#requests";
          showSaveAlert("Заявка на питомца создана");
        } catch (error) {
          showModal("Не удалось создать заявку", error.message || "Попробуйте позже");
        }
        return;
      }

      const payNode = target.closest('[data-a="pay-request"]');
      if (payNode instanceof HTMLElement) {
        const orderId = String(payNode.getAttribute("data-order-id") || "").trim();
        const requestItem = s.requests.find((item) => String(item.id) === orderId);
        let url = "";
        if (requestItem?.type === "pet") {
          url = String(requestItem?.paymentUrl || "").trim();
        } else {
          try {
            const requestedPlan = String(requestItem?.requestedPlan || "premium").toLowerCase() === "premium" ? "premium" : "premium";
            const precheck = await api(`/api/cards/order-precheck?requestedPlan=${encodeURIComponent(requestedPlan)}`);
            const pending = precheck?.pendingOrder && typeof precheck.pendingOrder === "object" ? precheck.pendingOrder : null;
            if (pending) {
              url = buildPendingPaymentUrl(pending);
            }
          } catch {
            // fallback to local request snapshot
          }
        }
        if (!url) {
          url = requestItem?.type === "pet"
            ? String(requestItem?.paymentUrl || "").trim()
            : buildTelegramPaymentUrl(requestItem || { id: orderId, slug: "", requestedPlan: "premium" });
        }
        openTelegramUrl(url);
        return;
      }
      const cancelNode = target.closest('[data-a="cancel-request"]');
      if (cancelNode instanceof HTMLElement) {
        const orderId = String(cancelNode.getAttribute("data-order-id") || "").trim();
        if (!orderId) {
          return;
        }
        showModal("Отменить заявку", "UNQ будет освобожден сразу. Продолжить?", "Отменить заявку", async () => {
          try {
            await api(`/api/cards/order-request/${encodeURIComponent(orderId)}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            await load();
            location.hash = "#requests";
            showSaveAlert("Заявка отменена, UNQ освобожден");
          } catch (error) {
            showModal("Не удалось отменить", error.message || "Попробуйте позже");
          }
        });
        return;
      }
      if (
        target.id === "profile-slugs-order-btn" ||
        target.id === "profile-card-order-btn" ||
        target.id === "profile-posts-order-btn"
      ) {
        openPremiumRenewalModal();
        return;
      }
      if (
        target.id === "profile-requests-order-btn" ||
        target.id === "profile-analytics-order-btn"
      ) {
        openOrderModal({});
      }
    });

    el.welcomeDismiss?.addEventListener("click", async () => {
      try {
        await api("/api/profile/welcome-dismiss", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (s.user) {
          s.user.welcomeDismissed = true;
        }
        renderWelcomeBanner();
      } catch {
        renderWelcomeBanner();
      }
    });

    el.cBio?.addEventListener("input", () => {
      if (el.cBioC) el.cBioC.textContent = `${el.cBio.value.length}/120`;
      renderPreview();
      saveDraft();
    });

    el.cName?.addEventListener("input", () => {
      if (el.cardNameError && (el.cName?.value || "").trim().length > 0) {
        el.cardNameError.classList.add("hidden");
      }
      renderPreview();
      saveDraft();
    });
    el.cBranding?.addEventListener("change", () => { renderPreview(); saveDraft(); });
    el.cHashtag?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cAddress?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cPostcode?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cEmail?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cExtraPhone?.addEventListener("input", () => { renderPreview(); saveDraft(); });
    el.cSave?.addEventListener("click", saveCard);
    el.cPetsList?.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target || target.getAttribute("data-a") !== "pet-name-input") return;
      const petType = String(target.getAttribute("data-pet-type") || "").trim().toLowerCase();
      const value = String(target.value || "").trim().slice(0, 120);
      if (!PET_TYPES.includes(petType)) return;
      const ownedPets = normalizeOwnedPets(s.pets);
      if (ownedPets.some((pet) => pet.petType === petType)) {
        s.pets = ownedPets.map((pet) =>
          pet.petType === petType
            ? {
              ...pet,
              displayName: value || (PET_TYPE_LABELS[petType] || ""),
            }
            : pet,
        );
      } else {
        s.petDrafts = {
          ...(s.petDrafts || {}),
          [petType]: value,
        };
      }
      renderPreview();
      saveDraft();
    });
    el.cPetsList?.addEventListener("change", (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target || target.getAttribute("data-a") !== "pet-visible-toggle") return;
      const petId = String(target.getAttribute("data-pet-id") || "").trim();
      const nextPets = normalizeOwnedPets(s.pets).map((pet) =>
        pet.id === petId
          ? {
            ...pet,
            isVisible: target.checked,
          }
          : pet,
      );
      s.pets = nextPets;
      renderPreview();
      saveDraft();
    });

    el.cTagAdd?.addEventListener("click", () => {
      const raw = el.cTagInput instanceof HTMLInputElement ? el.cTagInput.value.trim() : "";
      if (!raw) return;

      const limit = getTagLimit();
      if (s.tags.length >= limit) {
        showModal("Лимит тегов", `Можно добавить до ${limit} тегов.`);
        return;
      }

      s.tags.push((raw.startsWith("#") ? raw : `#${raw}`).slice(0, 32));
      if (el.cTagInput) el.cTagInput.value = "";
      renderTags();
      renderPreview();
      saveDraft();
    });

    el.cTags?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const removeBtn = target?.closest('[data-a="rm-tag"]');
      if (!(removeBtn instanceof HTMLElement)) return;
      event.preventDefault();

      const index = Number(removeBtn.getAttribute("data-i"));
      if (!Number.isFinite(index) || index < 0 || index >= s.tags.length) return;

      s.tags.splice(index, 1);
      renderTags();
      renderPreview();
      saveDraft();
    });

    el.cBtnAdd?.addEventListener("click", () => {
      const limit = getButtonLimit();
      if (Number.isFinite(limit) && s.buttons.length >= limit) {
        showModal("Лимит кнопок", "Для большего количества кнопок нужен Премиум.");
        return;
      }

      s.buttons.push({
        id: `${Date.now()}_${Math.random()}`,
        type: "other",
        label: buttonTypeLabels.other,
        href: "",
        value: "",
      });

      renderButtons();
      renderPreview();
      saveDraft();
    });

    el.cBtns?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const removeBtn = target?.closest('[data-a="rm-btn"]');
      if (!(removeBtn instanceof HTMLElement)) return;
      event.preventDefault();

      const index = Number(removeBtn.getAttribute("data-i"));
      if (!Number.isFinite(index) || index < 0 || index >= s.buttons.length) return;

      s.buttons.splice(index, 1);
      renderButtons();
      renderPreview();
      saveDraft();
    });

    el.cBtns?.addEventListener("input", (event) => {
      const node = event.target instanceof HTMLElement ? event.target : null;
      if (!node) return;

      const row = node.closest("[data-bi]");
      if (!(row instanceof HTMLElement)) return;

      const index = Number(row.getAttribute("data-bi"));
      if (!s.buttons[index]) return;

      const typeField = row.querySelector('[data-bf="type"]');
      const labelField = row.querySelector('[data-bf="label"]');
      const hrefField = row.querySelector('[data-bf="href"]');

      const prev = s.buttons[index];
      const type = typeField instanceof HTMLSelectElement ? typeField.value : "other";
      let label = labelField instanceof HTMLInputElement ? labelField.value : "";
      const href = hrefField instanceof HTMLInputElement ? hrefField.value : "";

      const previousDefault = buttonTypeLabels[prev.type] || "";
      const nextDefault = buttonTypeLabels[type] || "";
      if (type !== prev.type && label === previousDefault) {
        label = nextDefault;
        if (labelField instanceof HTMLInputElement) {
          labelField.value = label;
        }
      }

      s.buttons[index] = {
        ...prev,
        type,
        label,
        href,
        value: href,
        url: href,
      };

      renderPreview();
      saveDraft();
    });

    el.cThemes.forEach((button) =>
      button.addEventListener("click", () => {
        const selectedTheme = button.getAttribute("data-theme") || "default_dark";
        const premiumOnly = PREMIUM_ONLY_THEMES.has(selectedTheme);
        if (premiumOnly && getCurrentPlan() !== "premium") {
          showModal("Доступно на Премиум", "Эта тема доступна только для Премиум тарифа.");
          return;
        }
        s.theme = PROFILE_THEMES.includes(selectedTheme) ? selectedTheme : "default_dark";
        renderTheme();
        renderPreview();
        saveDraft();
      }),
    );

    el.cEmojiPacks.forEach((button) =>
      button.addEventListener("click", () => {
        const selectedPack = button.getAttribute("data-emoji-background-pack") || "none";
        const premiumOnly = PREMIUM_ONLY_EMOJI_BACKGROUND_PACKS.has(selectedPack);
        if (premiumOnly && getCurrentPlan() !== "premium") {
          showModal("Доступно на Премиум", "Этот фоновый pack доступен только для Премиум тарифа.");
          return;
        }
        s.emojiBackgroundPack = PROFILE_EMOJI_BACKGROUND_PACKS.includes(selectedPack) ? selectedPack : "none";
        renderEmojiBackgroundPack();
        renderPreview();
        saveDraft();
      }),
    );

    el.cFrames.forEach((button) =>
      button.addEventListener("click", () => {
        const selectedFrame = button.getAttribute("data-avatar-frame") || "none";
        const premiumOnly = PREMIUM_ONLY_AVATAR_FRAMES.has(selectedFrame);
        if (premiumOnly && getCurrentPlan() !== "premium") {
          showModal("Доступно на Премиум", "Эта рамка доступна только для Премиум тарифа.");
          return;
        }
        s.avatarFrame = PROFILE_AVATAR_FRAMES.includes(selectedFrame) ? selectedFrame : "none";
        renderFrame();
        renderPreview();
        saveDraft();
      }),
    );

    el.cTrackOptions?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const button = target?.closest("[data-profile-track-id]");
      if (!(button instanceof HTMLButtonElement)) return;
      event.preventDefault();
      if (getCurrentPlan() !== "premium") {
        showModal("Доступно на Премиум", "Музыка профиля доступна только для Премиум тарифа.");
        return;
      }
      s.selectedTrackId = normalizeTrackId(button.getAttribute("data-profile-track-id"));
      renderMusicTracks();
      renderPreview();
      saveDraft();
    });

    el.cPetLibraryOptions?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const button = target?.closest("[data-profile-pet-id]");
      if (!(button instanceof HTMLButtonElement)) return;
      event.preventDefault();
      if (getCurrentPlan() !== "premium") {
        showModal("Доступно на Премиум", "Питомцы профиля доступны только для Премиум тарифа.");
        return;
      }
      s.selectedPetId = normalizeTrackId(button.getAttribute("data-profile-pet-id"));
      renderPetLibraryChoices();
      renderPreview();
      saveDraft();
    });

    el.cAvFile?.addEventListener("change", async () => {
      const file = el.cAvFile?.files && el.cAvFile.files[0];
      if (!file) return;

      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        showModal("Ошибка", "Поддерживаются только PNG, JPG и WEBP");
        hideAvatarCrop();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (!(el.cAvCropImage instanceof HTMLImageElement) || !(el.cAvCropWrap instanceof HTMLElement)) return;

        el.cAvCropImage.src = String(reader.result || "");
        el.cAvCropWrap.classList.remove("hidden");

        destroyCropper();
        if (typeof Cropper !== "undefined") {
          avatarCropper = new Cropper(el.cAvCropImage, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            dragMode: "move",
            background: false,
            responsive: true,
            guides: false,
          });
        }
      };
      reader.onerror = () => showModal("Ошибка", "Не удалось прочитать файл");
      reader.readAsDataURL(file);
    });

    el.cAvCropSave?.addEventListener("click", async () => {
      if (!avatarCropper) return;

      try {
        const canvas = avatarCropper.getCroppedCanvas({
          width: 512,
          height: 512,
          imageSmoothingQuality: "high",
        });

        if (!canvas) {
          showModal("Ошибка", "Не удалось подготовить изображение");
          return;
        }

        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/webp", 0.92);
        });

        if (!(blob instanceof Blob)) {
          showModal("Ошибка", "Не удалось сохранить изображение");
          return;
        }

        await uploadAvatarBlob(blob);
        hideAvatarCrop();
        await load();
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось загрузить аватар");
      }
    });

    el.cAvRemove?.addEventListener("click", async () => {
      try {
        await api("/api/profile/card/avatar", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        hideAvatarCrop();
        await load();
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось удалить аватар");
      }
    });

    el.stChangeEmail?.addEventListener("click", openEmailModal);

    el.stChangePassword?.addEventListener("click", openPasswordModal);

    el.stLogin?.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target) return;
      const normalizedValue = normalizeProfileLoginValue(target.value);
      settingsLoginDraft = normalizedValue;
      if (target.value !== normalizedValue) {
        target.value = normalizedValue;
      }
      resetSettingsLoginAvailability();
      scheduleSettingsLoginAvailabilityCheck();
    });

    el.stLogin?.addEventListener("blur", () => {
      const normalizedValue = normalizeProfileLoginValue(el.stLogin?.value || "");
      settingsLoginDraft = normalizedValue;
      if (el.stLogin instanceof HTMLInputElement && el.stLogin.value !== normalizedValue) {
        el.stLogin.value = normalizedValue;
      }
      if (!normalizedValue) {
        resetSettingsLoginAvailability();
        return;
      }
      void ensureSettingsLoginReadyForSubmit();
    });

    el.privatePasswordOpenAdd?.addEventListener("click", openPrivatePasswordAddModal);

    el.stSave?.addEventListener("click", async () => {
      if (!el.stStatus) return;
      el.stStatus.textContent = "";

      try {
        const loginGuard = await ensureSettingsLoginReadyForSubmit();
        if (!loginGuard.ok) {
          const loginField = el.stLogin instanceof HTMLInputElement ? el.stLogin : null;
          loginField?.focus();
          el.stStatus.textContent = "Проверь логин перед сохранением";
          el.stStatus.className = "text-sm text-red-700";
          return;
        }

        const payload = await api("/api/profile/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: el.stName?.value || "",
            city: el.stCity?.value || "",
            login: loginGuard.login,
            telegramUsername: String(el.stTg?.value || "").replace(/^@+/, "").trim(),
            notificationsEnabled: Boolean(el.stNotif?.checked),
            showInDirectory: Boolean(el.stDirectory?.checked),
          }),
        });

        if (s.user) {
          s.user.displayName = payload.user.displayName;
          s.user.city = payload.user.city;
          s.user.login = payload.user.login || null;
          s.user.username = payload.user.username || payload.user.login || null;
          s.user.telegramUsername = payload.user.telegramUsername || null;
          s.user.notificationsEnabled = payload.user.notificationsEnabled;
          s.user.showInDirectory = payload.user.showInDirectory;
        }
        settingsLoginDraft = normalizeProfileLoginValue(payload?.user?.login || "");
        settingsLoginAvailability = {
          state: "idle",
          login: settingsLoginDraft,
          message: "",
        };

        renderSidebar();
        renderSettings();
        renderTelegramNotificationActions(Boolean(payload?.user?.notificationsEnabled));
        el.stStatus.textContent = PROFILE_SAVE_SUCCESS_MESSAGE;
        el.stStatus.className = "text-sm text-emerald-700";
        showSaveAlert(PROFILE_SAVE_SUCCESS_MESSAGE);
      } catch (error) {
        if (String(error?.code || "").startsWith("LOGIN_")) {
          applySettingsLoginAvailability(
            error.code === "LOGIN_TAKEN" ? "taken" : "invalid",
            settingsLoginDraft,
            error.message || "Не удалось сохранить логин",
          );
        }
        el.stStatus.textContent = `${error.message}`;
        el.stStatus.className = "text-sm text-red-700";
      }
    });

    el.stNotif?.addEventListener("change", () => {
      renderTelegramNotificationActions(Boolean(el.stNotif?.checked));
    });

    el.stDeact?.addEventListener("click", () => {
      showModal(
        "Деактивировать аккаунт?",
        `Все твои UNQ станут недоступны. Восстановление будет доступно ${reactivationWindowDays} дней, затем аккаунт удалится окончательно.`,
        "Подтвердить",
        async () => {
          try {
            await api("/api/profile/deactivate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            location.href = "/login";
          } catch (error) {
            if (el.stStatus) {
              el.stStatus.textContent = `${error.message}`;
              el.stStatus.className = "text-sm text-red-700";
            }
          }
        });
    });

    el.logout?.addEventListener("click", async () => {
      el.logout.disabled = true;
      try {
        try {
          await api("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch (error) {
          const isCsrfError = String(error?.message || "").toLowerCase().includes("invalid csrf token");
          if (!isCsrfError) {
            throw error;
          }
          // Session can rotate after inactivity; refresh token and retry logout once.
          await api("/api/auth/me", {
            method: "GET",
          });
          await api("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        }
        window.dispatchEvent(new CustomEvent("unqx:auth:logout"));
        location.href = "/login";
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось выйти");
        el.logout.disabled = false;
      }
    });

    el.stLinkTelegram?.addEventListener("click", async () => {
      const btn = el.stLinkTelegram;
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = true;
      try {
        const payload = await api("/api/profile/telegram/link/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const url = String(payload?.url || "").trim();
        if (!url) {
          throw new Error("Не удалось получить ссылку Telegram");
        }
        if (s.user) {
          s.user.notificationsEnabled = true;
        }
        if (el.stNotif instanceof HTMLInputElement) {
          el.stNotif.checked = true;
        }
        renderTelegramNotificationActions(true);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось подключить Telegram");
      } finally {
        btn.disabled = false;
      }
    });

    el.stUnlinkTelegram?.addEventListener("click", async () => {
      const btn = el.stUnlinkTelegram;
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = true;
      try {
        await api("/api/profile/telegram/link/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (s.user) {
          s.user.notificationsEnabled = false;
        }
        if (el.stNotif instanceof HTMLInputElement) {
          el.stNotif.checked = false;
        }
        renderTelegramNotificationActions(false);
        showModal("Готово", "Telegram уведомления отключены", "Ок");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось отключить Telegram");
      } finally {
        btn.disabled = false;
      }
    });

    el.qrClose?.addEventListener("click", closeQrModal);
    el.qrModal?.addEventListener("click", (event) => {
      if (event.target === el.qrModal) closeQrModal();
    });
    el.qrCopy?.addEventListener("click", async () => {
      const value = el.qrLink?.textContent || "";
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        showModal("Готово", "Ссылка скопирована");
      } catch {
        showModal("Ошибка", "Не удалось скопировать ссылку");
      }
    });
    el.qrDownloadPng?.addEventListener("click", () => {
      const canvas = el.qrBox?.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "unq-qr.png";
      link.click();
    });

    // ── Badge application handlers ──────────────────────────────────
    let badgeApps = [];
    const BADGE_STATUS_LABELS = {
      pending: "На рассмотрении",
      approved: "Одобрено ✓",
      rejected: "Отклонено",
      revoked: "Отозвано",
    };
    function renderBadgeStatuses() {
      const govApp = badgeApps.find((a) => a.badgeType === "government");
      const staffApp = badgeApps.find((a) => a.badgeType === "unqx_staff");
      if (el.badgeGovStatus instanceof HTMLElement) {
        el.badgeGovStatus.textContent = govApp ? (BADGE_STATUS_LABELS[govApp.status] || govApp.status) : "Не запрошено";
      }
      if (el.badgeGovNote instanceof HTMLElement) {
        if (govApp?.status === "rejected" && govApp.adminNote) {
          el.badgeGovNote.textContent = `Причина: ${govApp.adminNote}`;
          el.badgeGovNote.classList.remove("hidden");
        } else if (govApp?.status === "revoked" && govApp.adminNote) {
          el.badgeGovNote.textContent = `Причина отзыва: ${govApp.adminNote}`;
          el.badgeGovNote.classList.remove("hidden");
        } else {
          el.badgeGovNote.textContent = "";
          el.badgeGovNote.classList.add("hidden");
        }
      }
      if (el.badgeStaffStatus instanceof HTMLElement) {
        el.badgeStaffStatus.textContent = staffApp ? (BADGE_STATUS_LABELS[staffApp.status] || staffApp.status) : "Не запрошено";
      }
      if (el.badgeStaffNote instanceof HTMLElement) {
        if (staffApp?.status === "rejected" && staffApp.adminNote) {
          el.badgeStaffNote.textContent = `Причина: ${staffApp.adminNote}`;
          el.badgeStaffNote.classList.remove("hidden");
        } else if (staffApp?.status === "revoked" && staffApp.adminNote) {
          el.badgeStaffNote.textContent = `Причина отзыва: ${staffApp.adminNote}`;
          el.badgeStaffNote.classList.remove("hidden");
        } else {
          el.badgeStaffNote.textContent = "";
          el.badgeStaffNote.classList.add("hidden");
        }
      }
      if (el.badgeOpen instanceof HTMLButtonElement) {
        const govPending = govApp?.status === "pending";
        const staffPending = staffApp?.status === "pending";
        const bothPending = govPending && staffPending;
        el.badgeOpen.disabled = bothPending;
        el.badgeOpen.classList.toggle("opacity-60", bothPending);
      }
    }
    async function loadBadgeApplications() {
      try {
        const resp = await api("/api/profile/badge-applications");
        badgeApps = Array.isArray(resp.items) ? resp.items : [];
      } catch {
        badgeApps = [];
      }
      renderBadgeStatuses();
    }
    const closeBadgeModal = () => {
      if (!(el.badgeModal instanceof HTMLElement)) return;
      el.badgeModal.classList.add("hidden");
      el.badgeModal.classList.remove("flex");
    };
    el.badgeOpen?.addEventListener("click", () => {
      if (el.badgeOpen instanceof HTMLButtonElement && el.badgeOpen.disabled) return;
      if (!(el.badgeModal instanceof HTMLElement)) return;
      el.badgeModal.classList.remove("hidden");
      el.badgeModal.classList.add("flex");
    });
    el.badgeClose?.addEventListener("click", closeBadgeModal);
    el.badgeModal?.addEventListener("click", (event) => {
      if (event.target === el.badgeModal) closeBadgeModal();
    });
    el.badgeSubmit?.addEventListener("click", async () => {
      if (el.badgeSubmit instanceof HTMLButtonElement) el.badgeSubmit.disabled = true;
      try {
        const badgeType = el.badgeType?.value || "government";
        const workplace = el.badgeWorkplace?.value || "";
        const role = el.badgeRole?.value || "";
        const proofText = el.badgeProofText?.value || "";
        const proofLink = el.badgeProofLink?.value || "";
        if (!workplace.trim() || !role.trim()) {
          showModal("Проверь данные", "Укажите место работы и должность.");
          return;
        }
        await api("/api/profile/badge-application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ badgeType, workplace, role, proofText, proofLink }),
        });
        closeBadgeModal();
        if (el.badgeWorkplace instanceof HTMLInputElement) el.badgeWorkplace.value = "";
        if (el.badgeRole instanceof HTMLInputElement) el.badgeRole.value = "";
        if (el.badgeProofText instanceof HTMLTextAreaElement) el.badgeProofText.value = "";
        if (el.badgeProofLink instanceof HTMLInputElement) el.badgeProofLink.value = "";
        await loadBadgeApplications();
        showModal("Готово", "Заявка на бейдж отправлена");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось отправить заявку");
      } finally {
        if (el.badgeSubmit instanceof HTMLButtonElement) el.badgeSubmit.disabled = false;
      }
    });
    void loadBadgeApplications();

    const closeVerificationModal = () => {
      if (!(el.verificationModal instanceof HTMLElement)) return;
      el.verificationModal.classList.add("hidden");
      el.verificationModal.classList.remove("flex");
    };
    const fillVerificationFormFromLatest = () => {
      const latest = s.verification?.latestRequest;
      if (!latest) return;
      if (el.verificationCompany instanceof HTMLInputElement && !el.verificationCompany.value.trim()) {
        el.verificationCompany.value = String(latest.companyName || "");
      }
      if (el.verificationRole instanceof HTMLInputElement && !el.verificationRole.value.trim()) {
        el.verificationRole.value = String(latest.role || "");
      }
      if (el.verificationSector instanceof HTMLSelectElement) {
        const sector = String(latest.sector || "other").toLowerCase();
        el.verificationSector.value = ["design", "sales", "marketing", "it", "other"].includes(sector) ? sector : "other";
      }
      if (el.verificationProofType instanceof HTMLSelectElement) {
        const proofType = String(latest.proofType || "email").toLowerCase();
        el.verificationProofType.value = ["email", "linkedin", "website"].includes(proofType) ? proofType : "email";
      }
      if (el.verificationProofValue instanceof HTMLInputElement && !el.verificationProofValue.value.trim()) {
        el.verificationProofValue.value = String(latest.proofValue || "");
      }
    };
    el.verificationOpen?.addEventListener("click", () => {
      if (el.verificationOpen instanceof HTMLButtonElement && el.verificationOpen.disabled) {
        return;
      }
      if (!(el.verificationModal instanceof HTMLElement)) return;
      fillVerificationFormFromLatest();
      el.verificationModal.classList.remove("hidden");
      el.verificationModal.classList.add("flex");
    });
    el.verificationClose?.addEventListener("click", closeVerificationModal);
    el.verificationModal?.addEventListener("click", (event) => {
      if (event.target === el.verificationModal) closeVerificationModal();
    });
    el.verificationSubmit?.addEventListener("click", async () => {
      if (el.verificationSubmit instanceof HTMLButtonElement) {
        el.verificationSubmit.disabled = true;
      }
      try {
        await api("/api/profile/verification-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: el.verificationCompany?.value || "",
            role: el.verificationRole?.value || "",
            sector: el.verificationSector?.value || "other",
            proofType: el.verificationProofType?.value || "email",
            proofValue: el.verificationProofValue?.value || "",
            comment: el.verificationComment?.value || "",
          }),
        });
        closeVerificationModal();
        await load();
        showModal("Готово", "Заявка на верификацию отправлена");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось отправить заявку");
      } finally {
        if (el.verificationSubmit instanceof HTMLButtonElement) {
          el.verificationSubmit.disabled = false;
        }
      }
    });

    el.verificationCorrectionSubmit?.addEventListener("click", async () => {
      const correctionText = String(el.verificationCorrection?.value || "").trim();
      if (!correctionText) {
        showModal("Проверь данные", "Опишите, что нужно исправить в заявке.");
        return;
      }
      if (el.verificationCorrectionSubmit instanceof HTMLButtonElement) {
        el.verificationCorrectionSubmit.disabled = true;
      }
      try {
        await api("/api/profile/verification-request/correction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: correctionText }),
        });
        if (el.verificationCorrection instanceof HTMLTextAreaElement) {
          el.verificationCorrection.value = "";
        }
        await load();
        showModal("Готово", "Исправление отправлено администратору.");
      } catch (error) {
        showModal("Ошибка", error.message || "Не удалось отправить исправление");
      } finally {
        if (el.verificationCorrectionSubmit instanceof HTMLButtonElement) {
          el.verificationCorrectionSubmit.disabled = false;
        }
      }
    });

    const refreshProfileSoon = (delayMs = 150) => {
      if (hasPendingDraft()) {
        return;
      }
      if (profileRefreshTimer) {
        clearTimeout(profileRefreshTimer);
        profileRefreshTimer = null;
      }
      profileRefreshTimer = setTimeout(async () => {
        if (profileRefreshInFlight) return;
        profileRefreshInFlight = true;
        try {
          await load();
        } catch {
          // explicit user actions already show errors
        } finally {
          profileRefreshInFlight = false;
        }
      }, Math.max(0, Number(delayMs) || 0));
    };

    window.addEventListener("unqx:order:submitted", () => {
      location.hash = "#requests";
      refreshProfileSoon(80);
    });

    window.addEventListener("unqx:order:cancelled", () => {
      refreshProfileSoon(80);
    });

    window.addEventListener("focus", () => {
      refreshProfileSoon(150);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshProfileSoon(150);
      }
    });
    load().catch((error) => showModal("Ошибка", error.message || "Не удалось загрузить профиль"));
  })();
})();
