(function initPublicCardPage() {
  const host = document.getElementById("card-view-root");
  const payloadNode = document.getElementById("card-view-data");
  if (!(host instanceof HTMLElement) || !(payloadNode instanceof HTMLScriptElement) || typeof window.CardView === "undefined") {
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(payloadNode.textContent || "{}") || {};
  } catch {
    payload = {};
  }

  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  const slugSearchForm = document.getElementById("card-slug-search-form");
  const slugSearchInput = document.getElementById("card-slug-search-input");
  const slugSearchResults = document.getElementById("card-slug-search-results");
  const WALL_COMMENT_CONTENT_MAX = 1000;
  const WALL_SEEN_POSTS_STORAGE_KEY_PREFIX = "unqx_wall_seen_posts:";

  function getWallPostIdFromHash(hashValue) {
    const normalizedHash = String(hashValue || "").trim();
    if (!normalizedHash.toLowerCase().startsWith("#wall-post-")) {
      return "";
    }
    const encodedPostId = normalizedHash.slice("#wall-post-".length);
    if (!encodedPostId) {
      return "";
    }
    try {
      return decodeURIComponent(encodedPostId);
    } catch {
      return encodedPostId;
    }
  }

  function shouldOpenHashPostComments(searchValue) {
    const searchParams = new URLSearchParams(String(searchValue || ""));
    const rawValue = String(searchParams.get("comments") || "").trim().toLowerCase();
    return rawValue === "1" || rawValue === "true" || rawValue === "open";
  }

  function clearHashPostCommentsRequest() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("comments")) {
        return;
      }
      url.searchParams.delete("comments");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Ignore history/url failures and keep the wall interactive.
    }
  }

  const emptyFollowPagination = () => ({
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
  });
  const state = {
    card: payload && typeof payload.card === "object" && payload.card ? payload.card : {},
    shareUrl: String(payload.shareUrl || window.location.href),
    viewsLabel: String(payload.viewsLabel || ""),
    score: payload.score || null,
    customTheme:
      payload.customTheme && typeof payload.customTheme === "object"
        ? payload.customTheme
        : null,
    topBadge: payload.topBadge || null,
    officialUnqBadge: payload.officialUnqBadge && typeof payload.officialUnqBadge === "object" ? payload.officialUnqBadge : null,
    staffBadge: payload.staffBadge && typeof payload.staffBadge === "object" ? payload.staffBadge : null,
    limitedCardBadge: payload.limitedCardBadge && typeof payload.limitedCardBadge === "object" ? payload.limitedCardBadge : null,
    viewerCommentComposer:
      payload.viewerCommentComposer && typeof payload.viewerCommentComposer === "object"
        ? {
          avatarUrl: String(payload.viewerCommentComposer.avatarUrl || "").trim() || "/brand/profile-user.svg",
          initials: String(payload.viewerCommentComposer.initials || "").trim() || "UN",
          placeholder: String(payload.viewerCommentComposer.placeholder || "").trim() || "Добавьте ответ...",
        }
        : {
          avatarUrl: "/brand/profile-user.svg",
          initials: "UN",
          placeholder: "Добавьте ответ...",
        },
    trackViaPageRequest: Boolean(payload.trackViaPageRequest),
    slug: String(payload.slug || payload?.card?.slug || "").trim().toUpperCase(),
    wall: normalizeWallPayload(payload.wall),
    followSummary: normalizeFollowSummary(payload.followSummary),
    followBusySlugs: new Set(),
    followDialog: {
      open: false,
      type: "following",
      loading: false,
      error: "",
      items: [],
      pagination: emptyFollowPagination(),
    },
    activeTab: "card",
    wallLoadingMore: false,
    wallBusyLikeIds: new Set(),
    wallCommentDrafts: {},
    wallBusyCommentPostIds: new Set(),
    wallBusyCommentIds: new Set(),
    wallExpandedCommentPostIds: new Set(),
    wallHasUnreadPosts: false,
  };

  function syncCustomThemePageBackground() {
    const pageBg = String(state.customTheme?.config?.pageBg || "").trim();
    if (pageBg) {
      document.documentElement.style.setProperty("--unqx-public-page-bg", pageBg);
      document.body?.classList.add("has-custom-theme-page-bg");
    } else {
      document.documentElement.style.removeProperty("--unqx-public-page-bg");
      document.body?.classList.remove("has-custom-theme-page-bg");
    }
  }

  syncCustomThemePageBackground();

  function isPostsHash(hashValue) {
    const normalized = String(hashValue || "").trim().toLowerCase();
    return normalized === "#posts" || normalized.startsWith("#wall-post-");
  }

  state.activeTab = state.wall && isPostsHash(window.location.hash) ? "posts" : "card";
  const initialExpandedCommentPostId =
    state.wall && shouldOpenHashPostComments(window.location.search) ? getWallPostIdFromHash(window.location.hash) : "";
  if (initialExpandedCommentPostId) {
    state.wallExpandedCommentPostIds.add(initialExpandedCommentPostId);
    clearHashPostCommentsRequest();
  }

  let searchTimer = null;
  let lastQuery = "";
  let lastItems = [];
  let profileAudio = null;
  let profileAudioUrl = "";
  let profileMusicButton = null;
  const liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.style.position = "absolute";
  liveRegion.style.width = "1px";
  liveRegion.style.height = "1px";
  liveRegion.style.padding = "0";
  liveRegion.style.margin = "-1px";
  liveRegion.style.overflow = "hidden";
  liveRegion.style.clip = "rect(0, 0, 0, 0)";
  liveRegion.style.whiteSpace = "nowrap";
  liveRegion.style.border = "0";
  document.body.appendChild(liveRegion);

  const followDialogPortal = document.createElement("div");
  followDialogPortal.setAttribute("data-follow-dialog-portal", "");
  document.body.appendChild(followDialogPortal);

  let followDialogScrollTop = 0;
  let followDialogLastFocused = null;
  let followDialogWasOpen = false;

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

  function normalizeWallPayload(rawWall) {
    if (!rawWall || typeof rawWall !== "object" || rawWall.enabled === false) {
      return null;
    }
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
          wallAuthorLabel: String(authorSource.wallAuthorLabel || authorSource.name || "UNQX User").trim() || "UNQX User",
          verified: Boolean(authorSource.verified),
          profileHref: String(authorSource.profileHref || "").trim() || null,
          avatarUrl: String(authorSource.avatarUrl || "").trim() || null,
          initials: String(authorSource.initials || "").trim() || "UN",
        },
      };
    };
    const items = Array.isArray(rawWall.items)
      ? rawWall.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const comments = Array.isArray(item.comments) ? item.comments.map(normalizeWallComment).filter(Boolean) : [];
          return {
            ...item,
            id: String(item.id || "").trim(),
            content: String(item.content || ""),
            commentsEnabled: item.commentsEnabled !== false,
            status: String(item.status || "published"),
            likesCount: Number(item.likesCount || 0),
            commentsCount: Math.max(0, Number(item.commentsCount || comments.length)),
            comments,
            viewerHasLiked: Boolean(item.viewerHasLiked),
            viewerCanLike: Boolean(item.viewerCanLike),
            isEdited: Boolean(item.isEdited),
          };
        })
        .filter((item) => item && item.id)
      : [];
    const pagination = rawWall.pagination && typeof rawWall.pagination === "object" ? rawWall.pagination : {};
    return {
      enabled: true,
      items,
      pagination: {
        page: Math.max(1, Number(pagination.page || 1)),
        pageSize: Math.max(1, Number(pagination.pageSize || 10)),
        total: Math.max(0, Number(pagination.total || items.length)),
        hasMore: Boolean(pagination.hasMore),
      },
    };
  }

  function normalizeFollowItem(rawItem) {
    if (!rawItem || typeof rawItem !== "object") {
      return null;
    }
    const name = String(rawItem.name || "UNQX User").trim() || "UNQX User";
    const primarySlug = String(rawItem.primarySlug || "").trim().toUpperCase() || null;
    return {
      userId: String(rawItem.userId || "").trim(),
      name,
      initials:
        String(rawItem.initials || "").trim() ||
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => (part[0] ? part[0].toUpperCase() : ""))
          .join("") ||
        "UN",
      avatarUrl: String(rawItem.avatarUrl || "").trim() || null,
      primarySlug,
      role: String(rawItem.role || "").trim(),
      verified: Boolean(rawItem.verified),
      followedAt: rawItem.followedAt || null,
      isFollowing: Boolean(rawItem.isFollowing),
      canFollow: rawItem.canFollow !== false && Boolean(primarySlug),
      requiresAuth: Boolean(rawItem.requiresAuth),
      isPubliclyReachable: rawItem.isPubliclyReachable !== false && Boolean(primarySlug),
      profileHref:
        String(rawItem.profileHref || "").trim() || (primarySlug ? `/${encodeURIComponent(primarySlug)}` : null),
    };
  }

  function normalizeFollowSummary(rawSummary) {
    const summary = rawSummary && typeof rawSummary === "object" ? rawSummary : {};
    const counts = summary.counts && typeof summary.counts === "object" ? summary.counts : {};
    const viewer = summary.viewer && typeof summary.viewer === "object" ? summary.viewer : {};
    const previews = summary.previews && typeof summary.previews === "object" ? summary.previews : {};
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
      unreadFollowersCount: Math.max(0, Number(summary.unreadFollowersCount || 0)),
      previews: {
        following: Array.isArray(previews.following)
          ? previews.following.map(normalizeFollowItem).filter(Boolean)
          : [],
      },
    };
  }

  function syncFollowDialogBodyLock() {
    document.body.classList.toggle("modal-open", Boolean(state.followDialog?.open));
  }

  function syncFollowDialogPortal(root) {
    const currentDialogBody = followDialogPortal.querySelector(".unq-follow-dialog-body");
    if (currentDialogBody instanceof HTMLElement) {
      followDialogScrollTop = currentDialogBody.scrollTop;
    }

    if (root instanceof HTMLElement) {
      const themeKey = String(root.getAttribute("data-card-theme") || "").trim();
      const rootStyleText = String(root.getAttribute("style") || root.style.cssText || "").trim();
      if (themeKey) {
        followDialogPortal.setAttribute("data-card-theme", themeKey);
      } else {
        followDialogPortal.removeAttribute("data-card-theme");
      }
      followDialogPortal.style.cssText = rootStyleText;
    } else {
      followDialogPortal.removeAttribute("data-card-theme");
      followDialogPortal.style.cssText = "";
    }

    const nextDialog = root instanceof HTMLElement ? root.querySelector("[data-follows-dialog]") : null;
    if (!(nextDialog instanceof HTMLElement)) {
      followDialogPortal.replaceChildren();
      followDialogWasOpen = false;
      return;
    }

    const shouldFocusDialog = Boolean(state.followDialog?.open) && !followDialogWasOpen;
    followDialogPortal.replaceChildren(nextDialog);

    const nextDialogBody = followDialogPortal.querySelector(".unq-follow-dialog-body");
    if (nextDialogBody instanceof HTMLElement) {
      nextDialogBody.scrollTop = followDialogScrollTop;
    }

    followDialogWasOpen = Boolean(state.followDialog?.open);

    if (!shouldFocusDialog) {
      return;
    }

    const nextDialogCard = followDialogPortal.querySelector(".unq-follow-dialog-card");
    if (nextDialogCard instanceof HTMLElement) {
      window.requestAnimationFrame(() => {
        nextDialogCard.focus({ preventScroll: true });
      });
    }
  }

  function mergeWallItems(currentItems, nextItems) {
    const existingIds = new Set((Array.isArray(currentItems) ? currentItems : []).map((item) => String(item?.id || "")));
    const merged = Array.isArray(currentItems) ? currentItems.slice(0) : [];
    for (const item of Array.isArray(nextItems) ? nextItems : []) {
      if (!item || !item.id || existingIds.has(item.id)) continue;
      merged.push(item);
      existingIds.add(item.id);
    }
    return merged;
  }

  function replaceWallPost(nextPost) {
    if (!state.wall || !nextPost || !nextPost.id) return;
    const normalizedWall = normalizeWallPayload({
      enabled: true,
      items: [nextPost],
      pagination: state.wall.pagination,
    });
    const normalizedPost = normalizedWall?.items?.[0];
    if (!normalizedPost) return;
    state.wall.items = state.wall.items.map((item) => (item.id === normalizedPost.id ? normalizedPost : item));
    syncWallCommentsExpandedState(normalizedPost.id, normalizedPost.commentsCount || normalizedPost.comments?.length || 0);
  }

  function buildWallOptions() {
    if (!state.wall) return null;
    return {
      enabled: true,
      activeTab: state.activeTab,
      hasUnreadPosts: Boolean(state.wallHasUnreadPosts),
      items: state.wall.items.map((item) => ({
        ...item,
        isBusy: state.wallBusyLikeIds.has(item.id),
        commentDraft: String(state.wallCommentDrafts[item.id] || ""),
        isCommentBusy: state.wallBusyCommentPostIds.has(item.id),
        isCommentsExpanded: state.wallExpandedCommentPostIds.has(item.id),
        comments: Array.isArray(item.comments)
          ? item.comments.map((comment) => ({
            ...comment,
            isBusyDelete: state.wallBusyCommentIds.has(comment.id),
          }))
          : [],
      })),
      pagination: {
        ...state.wall.pagination,
        isLoadingMore: state.wallLoadingMore,
      },
    };
  }

  function getWallSeenPostsStorageKey() {
    const normalizedSlug = String(state.slug || state.card?.slug || "").trim().toUpperCase();
    return normalizedSlug ? `${WALL_SEEN_POSTS_STORAGE_KEY_PREFIX}${normalizedSlug}` : "";
  }

  function readWallSeenPostsMarker() {
    const storageKey = getWallSeenPostsStorageKey();
    if (!storageKey || !window.localStorage) {
      return "";
    }
    try {
      return String(window.localStorage.getItem(storageKey) || "").trim();
    } catch {
      return "";
    }
  }

  function writeWallSeenPostsMarker(value) {
    const storageKey = getWallSeenPostsStorageKey();
    if (!storageKey || !window.localStorage) {
      return;
    }
    const normalizedValue = String(value || "").trim();
    try {
      if (normalizedValue) {
        window.localStorage.setItem(storageKey, normalizedValue);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage failures so the wall keeps working in private mode.
    }
  }

  function getLatestWallPostMarker() {
    if (!state.wall || !Array.isArray(state.wall.items) || !state.wall.items.length) {
      return "";
    }
    let latestTime = 0;
    let latestMarker = "";
    for (const item of state.wall.items) {
      const marker = String(item?.createdAt || "").trim();
      const timestamp = marker ? new Date(marker).getTime() : Number.NaN;
      if (!Number.isFinite(timestamp) || timestamp <= latestTime) {
        continue;
      }
      latestTime = timestamp;
      latestMarker = marker;
    }
    return latestMarker;
  }

  function refreshWallUnreadPostsState() {
    if (!state.wall || state.activeTab === "posts") {
      state.wallHasUnreadPosts = false;
      return;
    }
    const latestMarker = getLatestWallPostMarker();
    if (!latestMarker) {
      state.wallHasUnreadPosts = false;
      return;
    }
    const latestTime = new Date(latestMarker).getTime();
    const seenTime = new Date(readWallSeenPostsMarker()).getTime();
    state.wallHasUnreadPosts = Number.isFinite(latestTime) && (!Number.isFinite(seenTime) || latestTime > seenTime);
  }

  function markWallPostsSeen() {
    const latestMarker = getLatestWallPostMarker();
    if (!latestMarker) {
      state.wallHasUnreadPosts = false;
      return;
    }
    writeWallSeenPostsMarker(latestMarker);
    state.wallHasUnreadPosts = false;
  }

  function syncWallSeenState() {
    if (!state.wall) {
      state.wallHasUnreadPosts = false;
      return;
    }
    if (state.activeTab === "posts") {
      markWallPostsSeen();
      return;
    }
    refreshWallUnreadPostsState();
  }

  function renderCard() {
    syncWallSeenState();
    const root = window.CardView.mountCardView(host, state.card || {}, {
      shareUrl: state.shareUrl,
      viewsLabel: state.viewsLabel,
      score: state.score,
      customThemeTokens: state.customTheme && typeof state.customTheme.config === "object" ? state.customTheme.config : null,
      customThemeOverlaySvg: state.customTheme ? String(state.customTheme.overlaySvg || "") : "",
      customThemeCacheVersion: state.customTheme ? Number(state.customTheme.cacheVersion || 1) : 1,
      topBadge: state.topBadge,
      officialUnqBadge: state.officialUnqBadge,
      staffBadge: state.staffBadge,
      limitedCardBadge: state.limitedCardBadge,
      viewerCommentComposer: state.viewerCommentComposer,
      followSummary: state.followSummary,
      followDialog: state.followDialog,
      followBusySlugs: Array.from(state.followBusySlugs || []),
      wall: buildWallOptions(),
    });
    syncFollowDialogPortal(root);
    syncFollowDialogBodyLock();
    syncAvatarFallback(root);
    initProfileMusic(root);
    scrollToWallHashTarget();
    return root;
  }

  function setProfileMusicPlaying(playing) {
    if (!(profileMusicButton instanceof HTMLButtonElement)) return;
    profileMusicButton.classList.toggle("is-playing", Boolean(playing));
    profileMusicButton.setAttribute("aria-label", playing ? "Поставить музыку на паузу" : "Включить музыку");
    const label = profileMusicButton.querySelector("[data-profile-music-label]");
    if (label instanceof HTMLElement) {
      label.textContent = playing ? "Поставить музыку на паузу" : "Включить музыку";
    }
  }

  async function playProfileMusic() {
    if (!profileAudio) return;
    try {
      await profileAudio.play();
      setProfileMusicPlaying(true);
    } catch {
      setProfileMusicPlaying(false);
    }
  }

  function toggleProfileMusic() {
    if (!profileAudio) return;
    if (profileAudio.paused) {
      void playProfileMusic();
      return;
    }
    profileAudio.pause();
    setProfileMusicPlaying(false);
  }

  function initProfileMusic(root) {
    profileMusicButton = root instanceof HTMLElement ? root.querySelector("[data-profile-music-player]") : null;
    if (!(profileMusicButton instanceof HTMLButtonElement)) {
      if (profileAudio) profileAudio.pause();
      profileAudio = null;
      profileAudioUrl = "";
      return;
    }
    const audioUrl = String(profileMusicButton.getAttribute("data-audio-url") || "").trim();
    if (!audioUrl) return;
    if (!profileAudio || profileAudioUrl !== audioUrl) {
      if (profileAudio) profileAudio.pause();
      profileAudio = new Audio(audioUrl);
      profileAudio.loop = true;
      profileAudio.preload = "none";
      profileAudioUrl = audioUrl;
      profileAudio.addEventListener("pause", () => setProfileMusicPlaying(false));
      profileAudio.addEventListener("play", () => setProfileMusicPlaying(true));
      profileAudio.addEventListener("ended", () => setProfileMusicPlaying(false));
    }
    profileMusicButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleProfileMusic();
    });
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a, button, input, textarea, select, [role='button']")) {
        return;
      }
      if (profileAudio && profileAudio.paused) {
        void playProfileMusic();
      }
    }, { once: true });
  }

  function scrollToWallHashTarget() {
    if (!state.wall || state.activeTab !== "posts") {
      return;
    }
    const hash = String(window.location.hash || "").trim();
    if (!hash || !hash.toLowerCase().startsWith("#wall-post-")) {
      return;
    }
    const targetId = hash.slice(1);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }

  function syncAvatarFallback(root) {
    if (!(root instanceof HTMLElement)) {
      return;
    }
    const avatarImage = root.querySelector("[data-avatar-image]");
    const avatarFallback = root.querySelector("[data-avatar-fallback]");

    const showFallback = () => {
      if (avatarImage instanceof HTMLElement) {
        avatarImage.classList.add("hidden");
        avatarImage.style.display = "none";
      }
      if (avatarFallback instanceof HTMLElement) {
        avatarFallback.classList.remove("hidden");
        avatarFallback.style.display = "flex";
        avatarFallback.setAttribute("aria-hidden", "false");
      }
    };

    const hideFallback = () => {
      if (avatarFallback instanceof HTMLElement) {
        avatarFallback.classList.add("hidden");
        avatarFallback.style.display = "none";
        avatarFallback.setAttribute("aria-hidden", "true");
      }
      if (avatarImage instanceof HTMLElement) {
        avatarImage.classList.remove("hidden");
        avatarImage.style.display = "";
      }
    };

    if (!(avatarImage instanceof HTMLElement)) {
      showFallback();
      return;
    }

    hideFallback();
    if (avatarImage instanceof HTMLImageElement && avatarImage.complete && avatarImage.naturalWidth > 0) {
      hideFallback();
      return;
    }
    avatarImage.addEventListener("load", hideFallback, { once: true });
    avatarImage.addEventListener("error", showFallback, { once: true });
  }

  function copyWithFallback(value) {
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
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      return copyWithFallback(value);
    }

    return copyWithFallback(value);
  }

  function announce(text) {
    liveRegion.textContent = text;
  }

  function showToast(text, kind = "success") {
    const value = String(text || "").trim();
    if (!value) return;
    let toast = document.getElementById("public-card-toast");
    if (!(toast instanceof HTMLElement)) {
      toast = document.createElement("div");
      toast.id = "public-card-toast";
      toast.className = "public-card-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = value;
    toast.classList.remove("is-error", "is-visible");
    if (kind === "error") {
      toast.classList.add("is-error");
    }
    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });
    const timerKey = "toastTimer";
    const previousTimer = Number(toast.dataset[timerKey] || 0);
    if (previousTimer) {
      window.clearTimeout(previousTimer);
    }
    const nextTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      delete toast.dataset[timerKey];
    }, 1600);
    toast.dataset[timerKey] = String(nextTimer);
  }

  function buildLoginUrl(nextPath) {
    const rawNext =
      String(nextPath || "").trim() ||
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return `/login?next=${encodeURIComponent(rawNext.startsWith("/") ? rawNext : `/${rawNext.replace(/^\/+/, "")}`)}`;
  }

  function applyFollowSummary(summary) {
    state.followSummary = normalizeFollowSummary(summary);
  }

  function isViewerOwnPublicCard() {
    const summary = normalizeFollowSummary(state.followSummary);
    return !summary.viewer.requiresAuth && !summary.viewer.canFollow;
  }

  function patchOwnFollowingCount(delta) {
    const normalizedDelta = Number(delta);
    if (!Number.isFinite(normalizedDelta) || !normalizedDelta) {
      return;
    }
    const summary = normalizeFollowSummary(state.followSummary);
    state.followSummary = {
      ...summary,
      counts: {
        ...summary.counts,
        following: Math.max(0, Number(summary.counts.following || 0) + normalizedDelta),
      },
    };
  }

  function patchOwnFollowingDialogAfterToggle(slug, isFollowing) {
    const normalizedSlug = String(slug || "").trim().toUpperCase();
    if (!normalizedSlug || !isViewerOwnPublicCard()) {
      return;
    }

    patchOwnFollowingCount(isFollowing ? 1 : -1);

    if (state.followDialog?.type !== "following" || isFollowing || !Array.isArray(state.followDialog?.items)) {
      return;
    }

    const nextItems = state.followDialog.items.filter(
      (item) => String(item?.primarySlug || "").trim().toUpperCase() !== normalizedSlug,
    );
    const removedCount = state.followDialog.items.length - nextItems.length;
    if (removedCount <= 0) {
      return;
    }

    state.followDialog = {
      ...state.followDialog,
      items: nextItems,
      pagination: {
        ...state.followDialog.pagination,
        total: Math.max(0, Number(state.followDialog?.pagination?.total || 0) - removedCount),
      },
    };
  }

  function patchFollowStateCollections(slug, isFollowing) {
    const normalizedSlug = String(slug || "").trim().toUpperCase();
    if (!normalizedSlug) {
      return;
    }

    if (state.followDialog && Array.isArray(state.followDialog.items)) {
      state.followDialog.items = state.followDialog.items.map((item) => {
        if (!item || String(item.primarySlug || "").trim().toUpperCase() !== normalizedSlug) {
          return item;
        }
        return {
          ...item,
          isFollowing,
        };
      });
    }

    const previews = Array.isArray(state.followSummary?.previews?.following)
      ? state.followSummary.previews.following
      : [];
    if (previews.length) {
      state.followSummary = {
        ...state.followSummary,
        previews: {
          ...state.followSummary.previews,
          following: previews.map((item) => {
            if (!item || String(item.primarySlug || "").trim().toUpperCase() !== normalizedSlug) {
              return item;
            }
            return {
              ...item,
              isFollowing,
            };
          }),
        },
      };
    }
  }

  async function toggleFollow(slug, options = {}) {
    const normalizedSlug = String(slug || "").trim().toUpperCase();
    if (!normalizedSlug || state.followBusySlugs.has(normalizedSlug)) {
      return;
    }

    const followingNow = Boolean(options.following);
    const loginNext = String(options.loginNext || "").trim();
    state.followBusySlugs.add(normalizedSlug);
    renderCard();

    try {
      const { response, data } = await requestJson(`/api/cards/${encodeURIComponent(normalizedSlug)}/follow`, {
        method: followingNow ? "DELETE" : "POST",
      });

      if (response.status === 401) {
        window.location.href = buildLoginUrl(loginNext);
        return;
      }

      if (!response.ok) {
        showToast(data.error || "Не удалось обновить подписку", "error");
        return;
      }

      if (normalizedSlug === String(state.slug || "").trim().toUpperCase()) {
        applyFollowSummary(data.summary);
      }
      patchOwnFollowingDialogAfterToggle(normalizedSlug, !followingNow);
      patchFollowStateCollections(normalizedSlug, !followingNow);
      renderCard();
      showToast(!followingNow ? "Подписка оформлена" : "Подписка отменена");
      announce(!followingNow ? "Подписка оформлена" : "Подписка отменена");
      return data;
    } catch {
      showToast("Не удалось обновить подписку", "error");
    } finally {
      state.followBusySlugs.delete(normalizedSlug);
      renderCard();
    }
    return null;
  }

  async function loadFollowDialog(options = {}) {
    const append = Boolean(options.append);
    const type = state.followDialog?.type === "followers" ? "followers" : "following";
    const currentPage = Math.max(1, Number(state.followDialog?.pagination?.page || 1));
    const nextPage = append ? currentPage + 1 : 1;
    state.followDialog = {
      ...state.followDialog,
      open: true,
      loading: true,
      error: "",
      type,
      items: append ? state.followDialog.items.slice(0) : [],
      pagination: append ? state.followDialog.pagination : emptyFollowPagination(),
    };
    renderCard();

    try {
      const { response, data } = await requestJson(
        `/api/cards/${encodeURIComponent(state.slug)}/follows?type=${encodeURIComponent(type)}&page=${encodeURIComponent(String(nextPage))}`,
      );
      if (!response.ok) {
        state.followDialog = {
          ...state.followDialog,
          loading: false,
          error: data.error || "Не удалось загрузить список",
        };
        renderCard();
        return;
      }

      const items = Array.isArray(data.items) ? data.items.map(normalizeFollowItem).filter(Boolean) : [];
      state.followDialog = {
        ...state.followDialog,
        open: true,
        loading: false,
        error: "",
        type,
        items: append ? state.followDialog.items.concat(items) : items,
        pagination: data.pagination && typeof data.pagination === "object"
          ? {
            page: Math.max(1, Number(data.pagination.page || nextPage)),
            pageSize: Math.max(1, Number(data.pagination.pageSize || 20)),
            total: Math.max(0, Number(data.pagination.total || 0)),
            hasMore: Boolean(data.pagination.hasMore),
          }
          : emptyFollowPagination(),
      };
      if (data.summary) {
        applyFollowSummary(data.summary);
      }
      renderCard();
    } catch {
      state.followDialog = {
        ...state.followDialog,
        loading: false,
        error: "Не удалось загрузить список",
      };
      renderCard();
    }
  }

  function openFollowDialog(type) {
    followDialogLastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    followDialogScrollTop = 0;
    state.followDialog = {
      ...state.followDialog,
      open: true,
      type: type === "followers" ? "followers" : "following",
      error: "",
    };
    void loadFollowDialog();
  }

  function closeFollowDialog() {
    const focusTarget = followDialogLastFocused;
    state.followDialog = {
      ...state.followDialog,
      open: false,
      loading: false,
      error: "",
    };
    followDialogLastFocused = null;
    followDialogScrollTop = 0;
    renderCard();
    if (focusTarget instanceof HTMLElement) {
      window.requestAnimationFrame(() => {
        focusTarget.focus();
      });
    }
  }

  async function requestJson(url, options = {}, allowRetry = true) {
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
  }

  function wallLoginUrl() {
    const nextPath = `/${encodeURIComponent(state.slug || String(state.card?.slug || ""))}#posts`;
    return `/login?next=${encodeURIComponent(nextPath)}`;
  }

  function buildWallShareUrl(postId) {
    const shareBase = String(state.shareUrl || window.location.href || "").trim() || window.location.href;
    try {
      const url = new URL(shareBase, window.location.href);
      const normalizedPostId = String(postId || "").trim();
      url.hash = normalizedPostId ? `wall-post-${encodeURIComponent(normalizedPostId)}` : "posts";
      return url.toString();
    } catch {
      return shareBase;
    }
  }

  async function shareWallPost(postId) {
    const shareUrl = buildWallShareUrl(postId);
    let shared = false;

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          url: shareUrl,
        });
        shared = true;
        showToast("Ссылка на пост отправлена");
        announce("Ссылка на пост отправлена");
      }
    } catch {
      shared = false;
    }

    if (shared) {
      return;
    }

    const copied = await copyText(shareUrl);
    showToast(copied ? "Ссылка на пост скопирована" : "Не удалось скопировать ссылку", copied ? "success" : "error");
    announce(copied ? "Ссылка на пост скопирована" : "Не удалось скопировать ссылку");
  }

  function getWallCommentDraft(postId) {
    return String(state.wallCommentDrafts[String(postId || "").trim()] || "");
  }

  function setWallCommentDraft(postId, value) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) return;
    state.wallCommentDrafts = {
      ...state.wallCommentDrafts,
      [normalizedPostId]: String(value || "").slice(0, WALL_COMMENT_CONTENT_MAX),
    };
  }

  function clearWallCommentDraft(postId) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) return;
    const nextDrafts = { ...state.wallCommentDrafts };
    delete nextDrafts[normalizedPostId];
    state.wallCommentDrafts = nextDrafts;
  }

  function getWallCommentInlineInput(postId) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) {
      return null;
    }
    const candidates = host.querySelectorAll("[data-wall-comment-inline-input]");
    for (const candidate of candidates) {
      if (
        candidate instanceof HTMLTextAreaElement &&
        String(candidate.getAttribute("data-wall-post-id") || "").trim() === normalizedPostId
      ) {
        return candidate;
      }
    }
    return null;
  }

  function readWallCommentDraft(postId) {
    const inlineInput = getWallCommentInlineInput(postId);
    if (inlineInput instanceof HTMLTextAreaElement) {
      return String(inlineInput.value || "");
    }
    return getWallCommentDraft(postId);
  }

  function setWallCommentsExpanded(postId, expanded) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) {
      return;
    }
    if (expanded) {
      state.wallExpandedCommentPostIds.clear();
      state.wallExpandedCommentPostIds.add(normalizedPostId);
    } else {
      state.wallExpandedCommentPostIds.delete(normalizedPostId);
    }
  }

  function syncWallCommentsExpandedState(postId) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId || !state.wall) {
      return;
    }
    if (!state.wall.items.some((item) => item && item.id === normalizedPostId)) {
      state.wallExpandedCommentPostIds.delete(normalizedPostId);
    }
  }

  async function toggleWallLike(postId) {
    if (!state.wall || !postId || state.wallBusyLikeIds.has(postId)) {
      return;
    }
    const currentPost = state.wall.items.find((item) => item.id === postId);
    if (!currentPost) {
      return;
    }

    state.wallBusyLikeIds.add(postId);
    renderCard();

    try {
      const method = currentPost.viewerHasLiked ? "DELETE" : "PUT";
      const { response, data } = await requestJson(
        `/api/cards/${encodeURIComponent(state.slug)}/wall-posts/${encodeURIComponent(postId)}/like`,
        { method },
      );

      if (!response.ok) {
        if (response.status === 401 || data.code === "AUTH_REQUIRED") {
          window.location.assign(wallLoginUrl());
          return;
        }
        showToast(data.error || "Не удалось обновить лайк", "error");
        return;
      }

      if (data.post && typeof data.post === "object") {
        replaceWallPost(data.post);
        renderCard();
      }
    } catch {
      showToast("Не удалось обновить лайк", "error");
    } finally {
      state.wallBusyLikeIds.delete(postId);
      renderCard();
    }
  }

  async function submitWallComment(postId) {
    if (!state.wall || !postId || state.wallBusyCommentPostIds.has(postId)) {
      return;
    }

    const currentPost = state.wall.items.find((item) => item.id === postId);
    if (!currentPost) {
      return;
    }
    if (currentPost.commentsEnabled === false) {
      showToast("Комментарии отключены автором для этого поста", "error");
      return;
    }

    const liveDraft = readWallCommentDraft(postId);
    if (liveDraft !== getWallCommentDraft(postId)) {
      setWallCommentDraft(postId, liveDraft);
    }
    const content = getWallCommentDraft(postId).trim();
    if (!content) {
      const inlineInput = getWallCommentInlineInput(postId);
      if (inlineInput instanceof HTMLTextAreaElement) {
        inlineInput.focus();
      }
      showToast("Введите комментарий", "error");
      return;
    }

    state.wallBusyCommentPostIds.add(postId);
    renderCard();

    try {
      const { response, data } = await requestJson(
        `/api/cards/${encodeURIComponent(state.slug)}/wall-posts/${encodeURIComponent(postId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );

      if (!response.ok) {
        if (response.status === 401 || data.code === "AUTH_REQUIRED") {
          window.location.assign(wallLoginUrl());
          return;
        }
        showToast(data.error || "Не удалось отправить комментарий", "error");
        return;
      }

      if (data.post && typeof data.post === "object") {
        replaceWallPost(data.post);
        setWallCommentsExpanded(postId, true);
        clearWallCommentDraft(postId);
        renderCard();
      }
    } catch {
      showToast("Не удалось отправить комментарий", "error");
    } finally {
      state.wallBusyCommentPostIds.delete(postId);
      renderCard();
    }
  }

  async function deleteWallComment(postId, commentId) {
    if (!state.wall || !postId || !commentId || state.wallBusyCommentIds.has(commentId)) {
      return;
    }

    state.wallBusyCommentIds.add(commentId);
    renderCard();

    try {
      const { response, data } = await requestJson(
        `/api/cards/${encodeURIComponent(state.slug)}/wall-posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        if (response.status === 401 || data.code === "AUTH_REQUIRED") {
          window.location.assign(wallLoginUrl());
          return;
        }
        showToast(data.error || "Не удалось удалить комментарий", "error");
        return;
      }

      if (data.post && typeof data.post === "object") {
        replaceWallPost(data.post);
        renderCard();
      }
    } catch {
      showToast("Не удалось удалить комментарий", "error");
    } finally {
      state.wallBusyCommentIds.delete(commentId);
      renderCard();
    }
  }

  async function loadMoreWallPosts() {
    if (!state.wall || state.wallLoadingMore || !state.wall.pagination.hasMore) {
      return;
    }
    state.wallLoadingMore = true;
    renderCard();
    try {
      const nextPage = Number(state.wall.pagination.page || 1) + 1;
      const { response, data } = await requestJson(
        `/api/cards/${encodeURIComponent(state.slug)}/wall-posts?page=${encodeURIComponent(nextPage)}&pageSize=${encodeURIComponent(state.wall.pagination.pageSize || 10)}`,
      );
      if (!response.ok) {
        showToast(data.error || "Не удалось загрузить посты", "error");
        return;
      }
      const nextWall = normalizeWallPayload({
        enabled: true,
        items: data.items,
        pagination: data.pagination,
      });
      if (!nextWall) {
        return;
      }
      state.wall.items = mergeWallItems(state.wall.items, nextWall.items);
      state.wall.pagination = nextWall.pagination;
      renderCard();
    } catch {
      showToast("Не удалось загрузить посты", "error");
    } finally {
      state.wallLoadingMore = false;
      renderCard();
    }
  }

  function normalizeSearchSlug(value) {
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

  const STRICT_SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;

  function hideResults() {
    if (!(slugSearchResults instanceof HTMLElement)) return;
    slugSearchResults.classList.add("hidden");
    slugSearchResults.innerHTML = "";
  }

  function renderResults(items, query) {
    if (!(slugSearchResults instanceof HTMLElement)) return;
    slugSearchResults.innerHTML = "";
    if (!query) {
      hideResults();
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const buyLink = `/?calcSlug=${encodeURIComponent(query)}#calculator`;
      slugSearchResults.innerHTML = `
        <div class="px-2 py-2">
          <p class="public-card-search-empty text-sm">Ничего не найдено</p>
          <a href="${buyLink}" class="interactive-btn mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition">
            Купить ${query}
            <svg class="icon-stroke h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>
          </a>
        </div>
      `;
      slugSearchResults.classList.remove("hidden");
      return;
    }

    const list = document.createElement("div");
    list.className = "flex flex-col";
    for (const item of items.slice(0, 8)) {
      const slugValue = String(item?.slug || "").toUpperCase();
      if (!slugValue) continue;
      const nameValue = String(item?.name || "UNQX User").trim() || "UNQX User";
      const priceValue = Number(item?.slugPrice || 0);
      const priceLabel = Number.isFinite(priceValue) && priceValue > 0 ? `${priceValue.toLocaleString("ru-RU")} сум` : "";
      const row = document.createElement("a");
      row.href = `/${encodeURIComponent(slugValue)}`;
      row.className =
        "public-card-search-row interactive-btn flex items-center justify-between rounded-lg px-2 py-2 text-sm";
      row.innerHTML = `<span class="public-card-search-slug font-semibold">${slugValue}</span><span class="ml-auto flex flex-col items-end pl-3 text-right"><span class="public-card-search-name text-xs">${nameValue}</span>${priceLabel ? `<span class="public-card-search-price text-[11px] font-semibold">${priceLabel}</span>` : ""}</span>`;
      list.appendChild(row);
    }
    slugSearchResults.appendChild(list);
    slugSearchResults.classList.remove("hidden");
  }

  async function searchSlugs(query) {
    if (!query) {
      lastItems = [];
      renderResults([], "");
      return;
    }

    if (!STRICT_SLUG_REGEX.test(query)) {
      hideResults();
      return;
    }

    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const nextPayload = await response.json();
      const items = Array.isArray(nextPayload?.items) ? nextPayload.items : [];
      if (query !== lastQuery) {
        return;
      }
      lastItems = items;
      renderResults(items, query);
    } catch {
      if (query === lastQuery) {
        renderResults([], query);
      }
    }
  }

  host.addEventListener("input", (event) => {
    const target = event.target instanceof HTMLTextAreaElement ? event.target : null;
    if (!target) {
      return;
    }
    const postId = String(target.getAttribute("data-wall-post-id") || "").trim();
    if (!postId) {
      return;
    }
    setWallCommentDraft(postId, target.value);
    if (target.value !== getWallCommentDraft(postId)) {
      target.value = getWallCommentDraft(postId);
    }
    if (!target.matches("[data-wall-comment-inline-input]")) {
      return;
    }
  });

  const handleCardClick = async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    const tabButton = target.closest("[data-card-tab]");
    if (tabButton instanceof HTMLElement && state.wall) {
      const nextTab = tabButton.getAttribute("data-card-tab") === "posts" ? "posts" : "card";
      if (nextTab === "posts") {
        if (window.location.hash !== "#posts") {
          window.location.hash = "posts";
          return;
        }
      } else if (window.location.hash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      state.activeTab = nextTab;
      renderCard();
      return;
    }

    const followOpenButton = target.closest("[data-follow-open]");
    if (followOpenButton instanceof HTMLElement) {
      event.preventDefault();
      openFollowDialog(String(followOpenButton.getAttribute("data-follow-open") || ""));
      return;
    }

    const followCloseButton = target.closest("[data-follow-close]");
    if (followCloseButton instanceof HTMLElement) {
      event.preventDefault();
      closeFollowDialog();
      return;
    }

    const followLoadMoreButton = target.closest("[data-follow-load-more]");
    if (followLoadMoreButton instanceof HTMLElement) {
      event.preventDefault();
      if (!state.followDialog.loading) {
        void loadFollowDialog({ append: true });
      }
      return;
    }

    const followToggleButton = target.closest("[data-follow-toggle]");
    if (followToggleButton instanceof HTMLElement) {
      event.preventDefault();
      const followSlug = String(followToggleButton.getAttribute("data-follow-slug") || "").trim();
      const following = String(followToggleButton.getAttribute("data-following") || "").trim() === "true";
      const loginNext = String(followToggleButton.getAttribute("data-login-next") || "").trim();
      await toggleFollow(followSlug, { following, loginNext });
      return;
    }

    const likeButton = target.closest("[data-wall-like]");
    if (likeButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(likeButton.getAttribute("data-post-id") || "").trim();
      await toggleWallLike(postId);
      return;
    }

    const openCommentButton = target.closest("[data-wall-comment-open]");
    if (openCommentButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(openCommentButton.getAttribute("data-wall-post-id") || "").trim();
      if (!postId) {
        return;
      }
      setWallCommentsExpanded(postId, !state.wallExpandedCommentPostIds.has(postId));
      renderCard();
      return;
    }

    const composeCommentButton = target.closest("[data-wall-comment-compose]");
    if (composeCommentButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(composeCommentButton.getAttribute("data-wall-post-id") || "").trim();
      await submitWallComment(postId);
      return;
    }

    const deleteCommentButton = target.closest("[data-wall-comment-delete]");
    if (deleteCommentButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(deleteCommentButton.getAttribute("data-wall-post-id") || "").trim();
      const commentId = String(deleteCommentButton.getAttribute("data-wall-comment-id") || "").trim();
      await deleteWallComment(postId, commentId);
      return;
    }

    const wallShareButton = target.closest("[data-wall-share]");
    if (wallShareButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(wallShareButton.getAttribute("data-wall-post-id") || "").trim();
      await shareWallPost(postId);
      return;
    }

    const loadMoreButton = target.closest("[data-wall-load-more]");
    if (loadMoreButton instanceof HTMLElement) {
      event.preventDefault();
      await loadMoreWallPosts();
      return;
    }

    const shareButton = target.closest("[data-share-card]");
    if (shareButton instanceof HTMLButtonElement) {
      const root = host.querySelector("[data-card-view]");
      const shareLabel = root instanceof HTMLElement ? root.querySelector("[data-share-label]") : null;
      let shared = false;

      try {
        if (navigator.share) {
          await navigator.share({
            title: document.title,
            url: state.shareUrl,
          });
          shared = true;
          if (shareLabel instanceof HTMLElement) {
            shareLabel.textContent = "Отправлено";
          }
          announce("Ссылка отправлена");
        }
      } catch {
        shared = false;
      }

      if (!shared) {
        const copied = await copyText(state.shareUrl);
        if (shareLabel instanceof HTMLElement) {
          shareLabel.textContent = copied ? "Скопировано" : "Ошибка";
        }
        showToast(copied ? "Ссылка скопирована" : "Не удалось скопировать ссылку", copied ? "success" : "error");
        announce(copied ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
      }

      window.setTimeout(() => {
        const nextRoot = host.querySelector("[data-card-view]");
        const nextLabel = nextRoot instanceof HTMLElement ? nextRoot.querySelector("[data-share-label]") : null;
        if (nextLabel instanceof HTMLElement) {
          nextLabel.textContent = "Поделиться";
        }
      }, 1600);
      return;
    }

    const saveContactButton = target.closest("[data-save-contact]");
    if (saveContactButton instanceof HTMLButtonElement) {
      const card = state.card && typeof state.card === "object" ? state.card : {};
      const fullName = String(card.name || "UNQX User").trim();
      const phone = String(card.phone || card.extraPhone || "").trim();
      const email = String(card.email || "").trim();
      const safeName = fullName || "UNQ User";
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${safeName}`];
      if (phone) {
        lines.push(`TEL;TYPE=CELL:${phone}`);
      }
      if (email) {
        lines.push(`EMAIL;TYPE=INTERNET:${email}`);
      }
      if (state.shareUrl) {
        lines.push(`URL:${state.shareUrl}`);
      }
      lines.push("END:VCARD");

      const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = (state.slug || "unq-card").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      link.href = downloadUrl;
      link.download = `${fileName || "contact"}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      announce("Контакт сохранен");
      return;
    }

    const actionButton = target.closest("[data-track-action]");
    if (actionButton instanceof HTMLElement && state.slug) {
      const clickUrl = `/api/cards/${encodeURIComponent(state.slug)}/click`;
      const cardToCopy = String(actionButton.getAttribute("data-copy-card") || "").trim();
      if (cardToCopy) {
        event.preventDefault();
        const copied = await copyText(cardToCopy);
        const labelNode = actionButton.querySelector("span");
        const previousText = labelNode instanceof HTMLElement ? labelNode.textContent || "" : "";
        if (labelNode instanceof HTMLElement) {
          labelNode.textContent = copied ? "Скопировано" : "Ошибка копирования";
          window.setTimeout(() => {
            labelNode.textContent = previousText;
          }, 1400);
        }
        showToast(copied ? "Номер карты скопирован" : "Не удалось скопировать номер карты", copied ? "success" : "error");
        announce(copied ? "Номер карты скопирован" : "Не удалось скопировать номер карты");
      }

      const buttonType = String(actionButton.getAttribute("data-button-type") || "other").toLowerCase();
      const bodyText = JSON.stringify({ buttonType });
      if (navigator.sendBeacon) {
        const body = new Blob([bodyText], { type: "application/json" });
        navigator.sendBeacon(clickUrl, body);
        return;
      }
      void fetch(clickUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText,
        keepalive: true,
      });
    }
  };

  host.addEventListener("click", handleCardClick);
  followDialogPortal.addEventListener("click", handleCardClick);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.followDialog?.open) {
      closeFollowDialog();
    }
  });

  if (slugSearchInput instanceof HTMLInputElement) {
    slugSearchInput.addEventListener("input", () => {
      const query = normalizeSearchSlug(slugSearchInput.value);
      slugSearchInput.value = query;
      slugSearchInput.setCustomValidity("");
      lastQuery = query;
      if (searchTimer) {
        window.clearTimeout(searchTimer);
      }
      if (query.length < 6) {
        hideResults();
        return;
      }
      searchTimer = window.setTimeout(() => {
        void searchSlugs(query);
      }, 140);
    });

    slugSearchInput.addEventListener("focus", () => {
      if (lastQuery) {
        renderResults(lastItems, lastQuery);
      }
    });
  }

  if (slugSearchForm instanceof HTMLFormElement && slugSearchInput instanceof HTMLInputElement) {
    slugSearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = normalizeSearchSlug(slugSearchInput.value);
      slugSearchInput.value = query;
      slugSearchInput.setCustomValidity("");
      if (!STRICT_SLUG_REGEX.test(query)) {
        slugSearchInput.setCustomValidity("Введите UNQ в формате 3 буквы и 3 цифры (AAA001)");
        slugSearchInput.reportValidity();
        hideResults();
        return;
      }
      lastQuery = query;
      if (searchTimer) {
        window.clearTimeout(searchTimer);
      }
      void searchSlugs(query);
    });
  }

  document.addEventListener("click", (event) => {
    if (!(slugSearchResults instanceof HTMLElement) || !(slugSearchForm instanceof HTMLFormElement)) return;
    const target = event.target;
    if (target instanceof Node && !slugSearchForm.contains(target) && !slugSearchResults.contains(target)) {
      hideResults();
    }
  });

  if (state.wall) {
    window.addEventListener("hashchange", () => {
      const nextTab = isPostsHash(window.location.hash) ? "posts" : "card";
      if (nextTab !== state.activeTab) {
        state.activeTab = nextTab;
        renderCard();
        return;
      }
      scrollToWallHashTarget();
    });
  }

  renderCard();

  if (!state.slug) {
    return;
  }

  function readCookie(name) {
    const raw = String(document.cookie || "");
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = raw.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function isOwnerSlug(currentSlug) {
    const raw = readCookie("unqx_owner_slugs");
    if (!raw) return false;
    const owned = new Set(
      raw
        .split(",")
        .map((item) => String(item || "").trim().toUpperCase())
        .filter(Boolean),
    );
    return owned.has(String(currentSlug || "").trim().toUpperCase());
  }

  if (state.trackViaPageRequest) {
    return;
  }

  if (isOwnerSlug(state.slug)) {
    return;
  }

  const src = new URLSearchParams(window.location.search).get("src");
  const viewUrl = `/api/cards/${encodeURIComponent(state.slug)}/view${src ? `?src=${encodeURIComponent(src)}` : ""}`;

  if (navigator.sendBeacon) {
    const beaconPayload = new Blob(["{}"], { type: "application/json" });
    navigator.sendBeacon(viewUrl, beaconPayload);
    return;
  }

  void fetch(viewUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    keepalive: true,
  });
})();
