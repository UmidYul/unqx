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
  const state = {
    card: payload && typeof payload.card === "object" && payload.card ? payload.card : {},
    shareUrl: String(payload.shareUrl || window.location.href),
    viewsLabel: String(payload.viewsLabel || ""),
    score: payload.score || null,
    topBadge: payload.topBadge || null,
    officialUnqBadge: payload.officialUnqBadge && typeof payload.officialUnqBadge === "object" ? payload.officialUnqBadge : null,
    staffBadge: payload.staffBadge && typeof payload.staffBadge === "object" ? payload.staffBadge : null,
    trackViaPageRequest: Boolean(payload.trackViaPageRequest),
    slug: String(payload.slug || payload?.card?.slug || "").trim().toUpperCase(),
    wall: normalizeWallPayload(payload.wall),
    activeTab: "card",
    wallLoadingMore: false,
    wallBusyLikeIds: new Set(),
    wallCommentDrafts: {},
    wallBusyCommentPostIds: new Set(),
    wallBusyCommentIds: new Set(),
  };

  state.activeTab = state.wall && window.location.hash === "#posts" ? "posts" : "card";

  let searchTimer = null;
  let lastQuery = "";
  let lastItems = [];
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
  }

  function buildWallOptions() {
    if (!state.wall) return null;
    return {
      enabled: true,
      activeTab: state.activeTab,
      items: state.wall.items.map((item) => ({
        ...item,
        isBusy: state.wallBusyLikeIds.has(item.id),
        commentDraft: String(state.wallCommentDrafts[item.id] || ""),
        isCommentBusy: state.wallBusyCommentPostIds.has(item.id),
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

  function renderCard() {
    const root = window.CardView.mountCardView(host, state.card || {}, {
      shareUrl: state.shareUrl,
      viewsLabel: state.viewsLabel,
      score: state.score,
      topBadge: state.topBadge,
      officialUnqBadge: state.officialUnqBadge,
      staffBadge: state.staffBadge,
      wall: buildWallOptions(),
    });
    syncAvatarFallback(root);
    return root;
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

  function getWallCommentDraft(postId) {
    return String(state.wallCommentDrafts[String(postId || "").trim()] || "");
  }

  function setWallCommentDraft(postId, value) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) return;
    state.wallCommentDrafts = {
      ...state.wallCommentDrafts,
      [normalizedPostId]: String(value || "").slice(0, 1000),
    };
  }

  function clearWallCommentDraft(postId) {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) return;
    const nextDrafts = { ...state.wallCommentDrafts };
    delete nextDrafts[normalizedPostId];
    state.wallCommentDrafts = nextDrafts;
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

    const content = getWallCommentDraft(postId).trim();
    if (!content) {
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
          <p class="text-sm text-neutral-500">Ничего не найдено</p>
          <a href="${buyLink}" class="interactive-btn mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100">
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
        "interactive-btn flex items-center justify-between rounded-lg px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-50";
      row.innerHTML = `<span class="font-semibold text-neutral-800">${slugValue}</span><span class="ml-auto flex flex-col items-end pl-3 text-right"><span class="text-xs text-neutral-500">${nameValue}</span>${priceLabel ? `<span class="text-[11px] font-semibold text-neutral-700">${priceLabel}</span>` : ""}</span>`;
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
    if (!target || !target.matches("[data-wall-comment-input]")) {
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
    const form = target.closest(".unq-wall-comment-form");
    const counter = form instanceof HTMLElement ? form.querySelector("[data-wall-comment-counter]") : null;
    if (counter instanceof HTMLElement) {
      counter.textContent = `${getWallCommentDraft(postId).length}/1000`;
    }
    const submit = form instanceof HTMLElement ? form.querySelector("[data-wall-comment-submit]") : null;
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = !getWallCommentDraft(postId).trim() || state.wallBusyCommentPostIds.has(postId);
    }
  });

  host.addEventListener("click", async (event) => {
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

    const likeButton = target.closest("[data-wall-like]");
    if (likeButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(likeButton.getAttribute("data-post-id") || "").trim();
      await toggleWallLike(postId);
      return;
    }

    const submitCommentButton = target.closest("[data-wall-comment-submit]");
    if (submitCommentButton instanceof HTMLElement) {
      event.preventDefault();
      const postId = String(submitCommentButton.getAttribute("data-wall-post-id") || "").trim();
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
      const nextTab = window.location.hash === "#posts" ? "posts" : "card";
      if (nextTab !== state.activeTab) {
        state.activeTab = nextTab;
        renderCard();
      }
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
