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

  test("public page source uses login for public handle and telegramUsername for telegram fallback", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "pages", "public.js"), "utf-8");
    expect(source).toContain("ownerUsername: ownerHandle ? `@${ownerHandle}` : \"\"");
    expect(source).toContain("const usernameForTelegram = getPublicTelegramHandle(owner);");
    expect(source).toContain("u.login AS user_login");
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
    expect(publicCardSource).toContain("verified: Boolean(authorSource.verified)");
    expect(publicCardSource).toContain("profileHref: String(authorSource.profileHref || \"\").trim() || null");
    expect(publicCardSource).toContain("unqx_wall_seen_posts:");
    expect(publicCardSource).toContain("state.wallExpandedCommentPostIds.clear()");
    expect(publicCardSource).toContain("Введите комментарий");
    const cardsApiSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "cards.js"), "utf-8");
    expect(cardsApiSource).toContain("Комментарии отключены автором для этого поста");
  });
});
