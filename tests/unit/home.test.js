const path = require("node:path");
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
    expect(html).toContain('id="latest-posts"');
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
