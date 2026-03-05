const path = require("node:path");
const ejs = require("ejs");

const { BASE_PRICE, calculateSlugPrice } = require("../../src/services/slug-pricing");
const { applyFlashSaleToPrice } = require("../../src/services/flash-sales");
const { getEffectivePlan, getSlugLimit } = require("../../src/services/profile");

async function renderHomeTemplate() {
  const file = path.join(process.cwd(), "src", "views", "public", "home.ejs");
  return ejs.renderFile(file, {
    title: "UNQ+ | Цифровая визитка за 1 минуту",
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
  });
}

async function renderHomeTemplateAuthenticated() {
  const file = path.join(process.cwd(), "src", "views", "public", "home.ejs");
  return ejs.renderFile(file, {
    title: "UNQ+ | Цифровая визитка за 1 минуту",
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
    userSession: {
      userId: "123456",
      firstName: "Yuldashev",
      photoUrl: "https://t.me/i/userpic/320/example.jpg",
    },
  });
}

describe("home page", () => {
  test("renders page without crashing", async () => {
    const html = await renderHomeTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>UNQ+ | Цифровая визитка за 1 минуту</title>");
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
    expect(html).toContain("Yuldashev · Мой профиль");
    expect(html).toContain("data-auth-profile");
    expect(html).toContain("inline-flex");
    expect(html).toContain("Зарегистрироваться");
    expect(html).toContain("/login");
    expect(html).toContain("hidden");
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
    expect(getSlugLimit("basic")).toBe(1);
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
