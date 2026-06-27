const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "test-admin-hash";

const { BASE_PRICE, calculateSlugPrice } = require("../../src/services/slug-pricing");
const { applyFlashSaleToPrice } = require("../../src/services/flash-sales");
const { getEffectivePlan, getSlugLimit } = require("../../src/services/profile");

async function renderHomeTemplate() {
  const file = path.join(process.cwd(), "src", "views", "public", "home.ejs");
  return ejs.renderFile(file, {
    title: "UNQX | Цифровая визитка за 1 минуту",
    description: "Одна ссылка вместо тысячи слов",
    slugTotalLimit: 17576,
    leaderboardEnabled: true,
    activeFlashSale: null,
    nextDrop: null,
    testimonials: [],
    telegramBotUsername: "unqx_bot",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/",
    cspNonce: "test-nonce",
    csrfToken: "csrf",
    assetVersion: "test",
    publicSettings: {},
    topWeeklyViews: [],
    latestCreatedCards: [],
    latestPublishedPosts: [],
    authPhotoUrl: "",
    userSession: null,
  });
}

async function renderHomeTemplateAuthenticated() {
  const file = path.join(process.cwd(), "src", "views", "public", "home.ejs");
  return ejs.renderFile(file, {
    title: "UNQX | Цифровая визитка за 1 минуту",
    description: "Одна ссылка вместо тысячи слов",
    slugTotalLimit: 17576,
    leaderboardEnabled: true,
    activeFlashSale: null,
    nextDrop: null,
    testimonials: [],
    telegramBotUsername: "unqx_bot",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/",
    cspNonce: "test-nonce",
    csrfToken: "csrf",
    assetVersion: "test",
    publicSettings: {},
    topWeeklyViews: [],
    latestCreatedCards: [],
    latestPublishedPosts: [],
    authPhotoUrl: "",
    userSession: {
      userId: "123456",
      firstName: "Yuldashev",
      photoUrl: "https://t.me/i/userpic/320/example.jpg",
    },
  });
}

async function renderHomeTemplateWithPosts() {
  const file = path.join(process.cwd(), "src", "views", "public", "home.ejs");
  return ejs.renderFile(file, {
    title: "UNQX | Цифровая визитка за 1 минуту",
    description: "Одна ссылка вместо тысячи слов",
    slugTotalLimit: 17576,
    leaderboardEnabled: true,
    activeFlashSale: null,
    nextDrop: null,
    testimonials: [],
    telegramBotUsername: "unqx_bot",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/",
    cspNonce: "test-nonce",
    csrfToken: "csrf",
    assetVersion: "test",
    publicSettings: {},
    topWeeklyViews: [],
    latestCreatedCards: [],
    authPhotoUrl: "",
    userSession: null,
    latestPublishedPosts: [
      {
        id: "post_1",
        content: "Первый пост для главной",
        createdAt: new Date("2026-05-09T10:00:00.000Z"),
        likesCount: 4,
        commentsCount: 2,
        viewerHasLiked: true,
        postHref: "/ABC123#wall-post-post_1",
        author: {
          userId: "user_1",
          name: "Alex",
          handle: "alex",
          primarySlug: "ABC123",
          profileHref: "/ABC123",
          role: "Designer",
        },
        viewerFollowState: {
          isFollowing: false,
          canFollow: true,
        },
      },
    ],
  });
}

async function renderHomeTemplateWithFlashSale() {
  const file = path.join(process.cwd(), "src", "views", "public", "home.ejs");
  return ejs.renderFile(file, {
    title: "UNQX | Цифровая визитка за 1 минуту",
    description: "Одна ссылка вместо тысячи слов",
    slugTotalLimit: 17576,
    leaderboardEnabled: true,
    activeFlashSale: {
      id: "flash_1",
      title: "Summer drop access",
      description: "Минус цена на выбранные UNQ, пока идет таймер.",
      discountPercent: 25,
      conditionType: "pattern_000",
      conditionLabel: "UNQ с цифрами 000",
      slotsLeft: 17,
      startsAt: new Date("2026-06-02T09:00:00.000Z"),
      endsAt: new Date("2026-06-03T09:00:00.000Z"),
      presentation: {
        explanation: "Скидка действует на свободные UNQ, у которых последние три цифры равны 000.",
        purchaseHint: "Введите свой UNQ ниже. Если он участвует в акции, мы сразу покажем цену со скидкой.",
        matchModeLabel: "Если ваш UNQ подходит под условие, скидка применяется автоматически на этапе покупки.",
        includeRules: ["Последние 3 цифры: 000"],
        excludeRules: [],
        examples: ["AAA000", "UNQ000", "WOW000"],
        outcomeHint: "Если UNQ не подходит под условия акции, останется обычная цена без скидки.",
      },
    },
    nextDrop: null,
    testimonials: [],
    telegramBotUsername: "unqx_bot",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/",
    cspNonce: "test-nonce",
    csrfToken: "csrf",
    assetVersion: "test",
    publicSettings: {},
    topWeeklyViews: [],
    latestCreatedCards: [],
    latestPublishedPosts: [],
    authPhotoUrl: "",
    userSession: null,
  });
}

describe("home page", () => {
  test("renders page without crashing", async () => {
    const html = await renderHomeTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>UNQX | Цифровая визитка за 1 минуту</title>");
  });

  test("renders key user elements", async () => {
    const html = await renderHomeTemplate();
    expect(html).toContain('id="hero-check"');
    expect(html).toContain('id="home-slug-input"');
    expect(html).toContain('id="calc-result"');
    expect(html).toContain('id="order-modal-root"');
    expect(html).toContain('id="order-modal-close-top"');
  });

  test("has one primary page heading", async () => {
    const html = await renderHomeTemplate();
    const h1Count = (html.match(/<h1\b/g) || []).length;
    expect(h1Count).toBe(1);
  });

  test("does not contain emoji artifacts in home template", async () => {
    const html = await renderHomeTemplate();
    const emojiRegex = /[⚡🔥✅❌⏰✓🏆🥇🥈🥉]/u;
    expect(emojiRegex.test(html)).toBe(false);
  });

  test("renders profile button immediately when user session exists", async () => {
    const html = await renderHomeTemplateAuthenticated();
    expect(html).toContain("data-auth-profile");
    expect(html).toContain("data-auth-avatar");
    expect(html).toContain("inline-flex");
    expect(html).toContain("/profile");
    expect(html).toContain("hidden");
  });

  test("renders latest posts section with follow CTA and deep link", async () => {
    const html = await renderHomeTemplateWithPosts();
    expect(html).toContain("Последние посты");
    expect(html).toContain("Первый пост для главной");
    expect(html).toContain('data-home-follow-button');
    expect(html).toContain('data-home-post-like');
    expect(html).toContain('data-home-post-comment');
    expect(html).toContain('data-home-post-share');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("/ABC123#wall-post-post_1");
    expect(html).toContain('data-post-comments-href="/ABC123?comments=1#wall-post-post_1"');
    expect(html).toContain('id="latest-posts"');
  });

  test("renders posts link after UNQ ELITE in public navigation", async () => {
    const html = await renderHomeTemplate();
    const residentsIndex = html.indexOf(">Резиденты</a>");
    const eliteIndex = html.indexOf("UNQ&nbsp;ELITE");
    const postsIndex = html.indexOf('href="/posts"');
    const loginIndex = html.indexOf('data-auth-login');

    expect(residentsIndex).toBeGreaterThan(-1);
    expect(eliteIndex).toBeGreaterThan(residentsIndex);
    expect(postsIndex).toBeGreaterThan(eliteIndex);
    expect(loginIndex).toBeGreaterThan(postsIndex);
  });

  test("renders flash sale banner with modal CTA and flash order modal content", async () => {
    const html = await renderHomeTemplateWithFlashSale();
    expect(html).toContain("data-flash-sale-banner");
    expect(html).not.toContain('id="flash-sale-details"');
    expect(html).toContain("data-order-link");
    expect(html).toContain('data-order-source="flash"');
    expect(html).toContain('data-order-offer="flash_sale"');
    expect(html).toContain("data-flash-sale-meta=");
    expect(html).toMatch(/site-flash-sale-marquee-group"\s+aria-hidden=(?:&#34;|")true(?:&#34;|")/);
    expect(html).toContain('id="order-modal-flash-hero"');
    expect(html).toContain('id="order-modal-flash-story"');
    expect(html).toContain('id="order-modal-flash-include-list"');
    expect(html).toContain('id="order-modal-flash-purchase-card"');
    expect(html).toContain('id="order-modal-flash-countdown" data-flash-countdown');
  });

  test("latest posts client source handles SVG clicks and keeps comment/share wiring", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "public-home-search.js"), "utf-8");
    const styles = fs.readFileSync(path.join(process.cwd(), "public", "css", "public-card.css"), "utf-8");
    expect(source).toContain('event.target instanceof Element ? event.target.closest("[data-home-follow-button]") : null');
    expect(source).toContain("const target = event.target instanceof Element ? event.target : null;");
    expect(source).toContain('commentButton.getAttribute("data-post-comments-href")');
    expect(source).toContain('const shareButton = target.closest("[data-home-post-share]");');
    expect(styles).toContain("--home-post-like-accent: #c45766;");
    expect(styles).toContain(".home-latest-post-action-button[data-home-post-like]:hover,");
  });

  test("weekly top badges stay compact", () => {
    const styles = fs.readFileSync(path.join(process.cwd(), "public", "css", "public-card.css"), "utf-8");

    expect(styles).toContain("[data-page=\"public-home\"] .home-weekly-card-rank");
    expect(styles).toContain("min-height: 26px;");
    expect(styles).toContain("[data-page=\"public-home\"] .home-weekly-card-slug-chip");
    expect(styles).toContain("min-height: 24px;");
    expect(styles).not.toContain("min-height: 36px;\n  min-width: 52px;");
  });

  test("flash sale client source shares countdown wiring, flash modal tone, and hero pricing follow-up", () => {
    const realtimeSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "public-realtime.js"), "utf-8");
    const homeSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "public-home-search.js"), "utf-8");
    const orderModalSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "order-modal.js"), "utf-8");
    const modalStyles = fs.readFileSync(path.join(process.cwd(), "public", "css", "base.css"), "utf-8");
    expect(realtimeSource).toContain('document.querySelectorAll("[data-flash-countdown]")');
    expect(homeSource).toContain('fetch(`/api/cards/slug-price?slug=${encodeURIComponent(slug)}`');
    expect(homeSource).toContain('label: priceInfo?.hasFlashSale ? "Купить со скидкой" : "Купить"');
    expect(orderModalSource).toContain('state.refSource === "flash"');
    expect(orderModalSource).toContain('document.querySelector("[data-flash-sale-banner]")');
    expect(orderModalSource).toContain('dom.root.dataset.modalTone = "flash"');
    expect(orderModalSource).toContain('payload?.flashSale && typeof payload.flashSale === "object"');
    expect(orderModalSource).toContain('document.getElementById("order-modal-flash-story")');
    expect(modalStyles).toContain('#order-modal-root[data-modal-tone="flash"] #order-modal-dialog');
    expect(modalStyles).toContain(".order-modal-flash-hero");
    expect(modalStyles).toContain(".order-modal-flash-story");
    expect(modalStyles).toContain(".order-modal-flash-eligibility-badge.is-active");
  });

  test("matches AAA + 000 = 3 000 000", () => {
    const result = calculateSlugPrice({ letters: "AAA", digits: "000" });
    expect(result.total).toBe(BASE_PRICE * 5 * 6);
    expect(result.total).toBe(3_000_000);
  });

  test("matches ABC + 123 = 900 000", () => {
    const result = calculateSlugPrice({ letters: "ABC", digits: "123" });
    expect(result.total).toBe(BASE_PRICE * 3 * 3);
    expect(result.total).toBe(900_000);
  });

  test("matches ABX + 374 = 100 000", () => {
    const result = calculateSlugPrice({ letters: "ABX", digits: "374" });
    expect(result.total).toBe(BASE_PRICE);
    expect(result.total).toBe(100_000);
  });

  test("basic and premium slug limits are enforced", () => {
    expect(getSlugLimit("basic")).toBe(3);
    expect(getSlugLimit("premium")).toBe(3);
  });

  test("none plan is treated as none", () => {
    const none = getEffectivePlan({
      plan: "none",
    });
    expect(none.plan).toBe("none");
    expect(none.isPremium).toBe(false);
  });

  test("flash sale discount applies only to matching slug", () => {
    const sale = {
      conditionType: "pattern_000",
      discountPercent: 20,
    };
    const matched = applyFlashSaleToPrice({ slug: "ABC000", basePrice: 1_000_000, sale });
    const notMatched = applyFlashSaleToPrice({ slug: "ABC111", basePrice: 1_000_000, sale });
    expect(matched.hasDiscount).toBe(true);
    expect(matched.finalPrice).toBe(800_000);
    expect(notMatched.hasDiscount).toBe(false);
    expect(notMatched.finalPrice).toBe(1_000_000);
  });
});
