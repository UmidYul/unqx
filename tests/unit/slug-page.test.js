const path = require("node:path");
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
    const source = require("node:fs").readFileSync(path.join(process.cwd(), "public", "js", "card-view.js"), "utf-8");
    expect(source.includes("Coming soon")).toBe(false);
    expect(source.includes("ABOUT INFO")).toBe(false);
  });

  test("card-view source uses localized share states", () => {
    const source = require("node:fs").readFileSync(path.join(process.cwd(), "public", "js", "public-card.js"), "utf-8");
    expect(source).toContain("Поделиться");
    expect(source).toContain("Скопировано");
    expect(source).toContain("Контакт сохранен");
  });
});
