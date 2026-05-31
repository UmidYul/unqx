const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderView(fileName, locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", fileName);
  return ejs.renderFile(file, {
    title: "Тестовая страница",
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/ABC123",
    telegramBotUsername: "unqx_bot",
    assetVersion: "test",
    userSession: null,
    publicSettings: {},
    ...locals,
  });
}

describe("slug page (:slug) templates", () => {
  test("renders public card view with card root and localized views label", async () => {
    const html = await renderView("card.ejs", {
      card: {
        slug: "ABC123",
        name: "Alex",
        tariff: "basic",
        buttons: [{ label: "Telegram", url: "https://t.me/example", isActive: true }],
      },
      description: "Публичная карточка",
    });

    expect(html).toContain('id="card-view-root"');
    expect(html).toContain("просмотров");
    expect(html).toContain("На главную");
  });

  test("passes top badge payload to client renderer without trophy emoji", async () => {
    const html = await renderView("card.ejs", {
      card: { slug: "ABC123", name: "Alex", tariff: "basic", buttons: [] },
      topBadge: { rank: 2 },
    });
    expect(html).toContain('"topBadge":{"rank":2}');
    expect(html).not.toContain("🏆");
  });

  test("passes wall payload to public card renderer", async () => {
    const html = await renderView("card.ejs", {
      card: { slug: "ABC123", name: "Alex", tariff: "basic", buttons: [] },
      wall: {
        enabled: true,
        items: [{ id: "post_1", content: "Первый пост", likesCount: 2, commentsCount: 1, commentsEnabled: false }],
        pagination: { page: 1, pageSize: 10, total: 1, hasMore: false },
      },
    });
    expect(html).toContain('"wall":{"enabled":true');
    expect(html).toContain('"content":"Первый пост"');
    expect(html).toContain('"commentsCount":1');
    expect(html).toContain('"commentsEnabled":false');
  });

  test("passes follow summary payload to public card renderer", async () => {
    const html = await renderView("card.ejs", {
      card: { slug: "ABC123", name: "Alex", tariff: "basic", buttons: [] },
      followSummary: {
        counts: { followers: 12, following: 5 },
        viewer: { isFollowing: false, canFollow: true, requiresAuth: false },
        previews: {
          following: [
            { userId: "user_2", name: "Mila", primarySlug: "MIL222", isPubliclyReachable: true },
          ],
        },
      },
    });
    expect(html).toContain('"followSummary":{"counts":{"followers":12,"following":5}');
    expect(html).toContain('"primarySlug":"MIL222"');
  });

  test("passes premium theme, emoji background, and avatar frame through card payload", async () => {
    const html = await renderView("card.ejs", {
      card: {
        slug: "ABC123",
        name: "Alex",
        tariff: "premium",
        theme: "graffiti_neon",
        emojiBackgroundPack: "ghosts",
        avatarFrame: "orbit_dots",
        buttons: [],
      },
    });
    expect(html).toContain('"theme":"graffiti_neon"');
    expect(html).toContain('"emojiBackgroundPack":"ghosts"');
    expect(html).toContain('"avatarFrame":"orbit_dots"');
    expect(html).toContain('data-card-theme="graffiti_neon"');
  });

  test("renders slug-state with primary CTA and back navigation", async () => {
    const html = await renderView("slug-state.ejs", {
      slug: "ABC123",
      heading: "Этот UNQ пока свободен",
      message: "Ты можешь занять его прямо сейчас.",
      ctaLabel: "Занять UNQ",
      ctaHref: "#",
      ctaOrderLink: true,
      ctaOrderPrefill: "ABC123",
    });
    expect(html).toContain("На главную");
    expect(html).toContain("data-order-link");
    expect(html).toContain("data-order-prefill=&#34;ABC123&#34;");
  });

  test("renders slug-state without optional cta flags", async () => {
    const html = await renderView("slug-state.ejs", {
      slug: "ABC123",
      heading: "Проверка",
      message: "Без доп. флагов",
      ctaLabel: "Открыть",
      ctaHref: "/",
    });
    expect(html).toContain("Открыть");
    expect(html).not.toContain("data-order-link");
  });

  test("renders paused slug page with owner block and link", async () => {
    const html = await renderView("slug-paused.ejs", {
      slug: "ABC123",
      ownerName: "Owner",
      ownerUsername: "@owner",
      primarySocial: { label: "Telegram", url: "https://t.me/owner" },
    });
    expect(html).toContain("Owner");
    expect(html).toContain("https://t.me/owner");
    expect(html).toContain("На главную");
  });

  test("renders private slug screen with selected theme and avatar frame", async () => {
    const html = await renderView("slug-private.ejs", {
      slug: "ABC123",
      ownerName: "Owner",
      ownerAvatar: "https://example.com/avatar.png",
      theme: "graffiti_neon",
      avatarFrame: "chrome_ring",
    });
    expect(html).toContain('data-card-theme="graffiti_neon"');
    expect(html).toContain('data-avatar-frame="chrome_ring"');
    expect(html).toContain("--theme-accent-color:#9bff62");
  });

  test("public page source uses login for public handle and telegramUsername for telegram fallback", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "public.js"), "utf-8");
    expect(source).toContain("ownerUsername: ownerHandle ? `@${ownerHandle}` : \"\"");
    expect(source).toContain("const usernameForTelegram = getPublicTelegramHandle(owner);");
    expect(source).toContain("u.login AS user_login");
  });

  test("public page source builds immediate fallback card instead of waiting for manual setup", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "public.js"), "utf-8");
    expect(source).toContain("function buildImmediatePublicProfileCard(user, profileCard)");
    expect(source).toContain("const effectiveProfileCard = buildImmediatePublicProfileCard(owner, profileCard);");
    expect(source).not.toContain("if (!owner || !profileCard) {");
  });

  test("renders unavailable page with readable message", async () => {
    const html = await renderView("unavailable.ejs", {
      slug: "ABC123",
    });
    expect(html).toContain("Визитка недоступна");
    expect(html).toContain("На главную");
  });

  test("renders localized not-found page with CTA", async () => {
    const html = await renderView("not-found.ejs", {});
    expect(html).toContain("Страница не найдена");
    expect(html).toContain("Проверь ссылку или вернись на главную страницу.");
    expect(html).toContain("На главную");
    expect(html).not.toContain("This page could not be found.");
  });

  test("card-view source does not contain developer-facing placeholders", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "card-view.js"), "utf-8");
    expect(source.includes("Coming soon")).toBe(false);
    expect(source.includes("ABOUT INFO")).toBe(false);
    expect(source).toContain("graffiti_neon");
    expect(source).toContain("color_blue");
    expect(source).toContain("AVATAR_FRAME_KEYS");
    expect(source).toContain("EMOJI_BACKGROUND_PACK_KEYS");
    expect(source).toContain("renderEmojiBackgroundOverlay");
    expect(source).toContain('data-emoji-background-pack');
    expect(source).toContain("renderAvatarFrame");
    expect(source).not.toContain("comic_boom");
  });

  test("sticker bubble avatar frame keeps a transparent center", () => {
    const cardViewSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "card-view.js"), "utf-8");
    const privateViewSource = fs.readFileSync(path.join(process.cwd(), "src", "views", "public", "slug-private.ejs"), "utf-8");
    expect(cardViewSource).toContain('fill-rule="evenodd"');
    expect(privateViewSource).toContain('fill-rule="evenodd"');
    expect(cardViewSource).toContain('M70 20c14 0 27 4 36 11');
    expect(privateViewSource).toContain('M70 20c14 0 27 4 36 11');
  });

  test("starburst avatar frame uses centered symmetric outline geometry", () => {
    const cardViewSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "card-view.js"), "utf-8");
    const privateViewSource = fs.readFileSync(path.join(process.cwd(), "src", "views", "public", "slug-private.ejs"), "utf-8");
    expect(cardViewSource).toContain('M70 6L84 29L111 20L104 47L132 54L113 72');
    expect(privateViewSource).toContain('M70 6L84 29L111 20L104 47L132 54L113 72');
    expect(cardViewSource).toContain('<circle cx="70" cy="70" r="51.5"');
    expect(privateViewSource).toContain('<circle cx="70" cy="70" r="51.5"');
  });

  test("removed comic boom frame falls back to none in templates", async () => {
    const publicHtml = await renderView("card.ejs", {
      card: {
        slug: "ABC123",
        name: "Alex",
        tariff: "premium",
        avatarFrame: "comic_boom",
        buttons: [],
      },
    });
    const privateHtml = await renderView("slug-private.ejs", {
      slug: "ABC123",
      ownerName: "Owner",
      avatarFrame: "comic_boom",
    });
    expect(publicHtml).not.toContain('data-avatar-frame="comic_boom"');
    expect(privateHtml).not.toContain('data-avatar-frame="comic_boom"');
  });

  test("card-view source uses localized share states", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "public-card.js"), "utf-8");
    expect(source).toContain("Поделиться");
    expect(source).toContain("Скопировано");
    expect(source).toContain("Контакт сохранен");
  });

  test("public card sources include posts and comments UI", () => {
    const cardViewSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "card-view.js"), "utf-8");
    const publicCardSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "public-card.js"), "utf-8");
    expect(cardViewSource).toContain("Посты");
    expect(cardViewSource).toContain("Визитка");
    expect(publicCardSource).toContain("wall-posts");
    expect(cardViewSource).toContain("Комментариев пока нет");
    expect(cardViewSource).toContain("data-wall-comment-open");
    expect(cardViewSource).toContain("data-wall-comment-compose");
    expect(cardViewSource).toContain("Комментарии отключены автором.");
    expect(cardViewSource).not.toContain("data-wall-comment-modal-submit");
    expect(cardViewSource).not.toContain("data-wall-comment-modal-input");
    expect(cardViewSource).not.toContain("data-wall-comment-submit");
    expect(cardViewSource).not.toContain("unq-wall-comment-form");
    expect(cardViewSource).not.toContain("data-wall-comments-toggle");
    expect(cardViewSource).toContain("unq-wall-comment-verified");
    expect(cardViewSource).toContain("comment.author?.verified");
    expect(cardViewSource).toContain("data-wall-post-author-link");
    expect(cardViewSource).toContain("data-wall-comment-author-link");
    expect(cardViewSource).toContain("const ownerProfileHref = ownerProfileHrefRaw;");
    expect(cardViewSource).toContain("data-wall-share");
    expect(cardViewSource).toContain("data-wall-posts-unread-dot");
    expect(publicCardSource).toContain("/comments");
    expect(publicCardSource).not.toContain("wallCommentModalPostId");
    expect(publicCardSource).not.toContain("data-wall-comment-modal-submit");
    expect(publicCardSource).toContain("data-wall-comment-compose");
    expect(publicCardSource).toContain("currentPost.commentsEnabled === false");
    expect(publicCardSource).toContain("target.closest(\"[data-wall-share]\")");
    expect(publicCardSource).toContain("startsWith(\"#wall-post-\")");
    expect(publicCardSource).toContain('searchParams.get("comments")');
    expect(publicCardSource).toContain("state.wallExpandedCommentPostIds.add(initialExpandedCommentPostId)");
    expect(publicCardSource).toContain('url.searchParams.delete("comments")');
    expect(publicCardSource).toContain("verified: Boolean(authorSource.verified)");
    expect(publicCardSource).toContain("profileHref: String(authorSource.profileHref || \"\").trim() || null");
    expect(publicCardSource).toContain("unqx_wall_seen_posts:");
    expect(publicCardSource).toContain("state.wallExpandedCommentPostIds.clear()");
    expect(publicCardSource).toContain("Введите комментарий");
    expect(publicCardSource).toContain("Комментарии отключены автором для этого поста");
    expect(cardViewSource).toContain("Подписчики");
    expect(cardViewSource).toContain("Подписки");
    expect(cardViewSource).toContain("data-follow-toggle");
    expect(cardViewSource).toContain("data-follow-open");
    expect(cardViewSource).toContain("data-follow-load-more");
    expect(publicCardSource).toContain("/api/cards/${encodeURIComponent(state.slug)}/follows");
    expect(publicCardSource).toContain("toggleFollow(");
    expect(publicCardSource).toContain("loadFollowDialog");
    expect(publicCardSource).toContain("isViewerOwnPublicCard");
    expect(publicCardSource).toContain("patchOwnFollowingDialogAfterToggle");
  });
});
