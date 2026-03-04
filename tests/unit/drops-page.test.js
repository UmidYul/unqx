const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderDropsTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", "drops.ejs");
  return ejs.renderFile(file, {
    title: "Дропы slug · UNQ+",
    description: "Дропы slug UNQ+",
    drops: [],
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/drops",
    telegramBotUsername: "unqx_bot",
    ...locals,
  });
}

describe("drops page", () => {
  test("renders drops page without crashing", async () => {
    const html = await renderDropsTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Дропы slug");
  });

  test("renders centered empty state when there are no drops", async () => {
    const html = await renderDropsTemplate({ drops: [] });
    expect(html).toContain("Пока нет активных дропов");
    expect(html).toContain("Следующие запуски появятся здесь совсем скоро.");
    expect(html).not.toContain("Форма заказа для дропа");
  });

  test("renders drop card with emoji-free live label", async () => {
    const html = await renderDropsTemplate({
      drops: [
        {
          id: "drop_1",
          title: "Friday Drop",
          description: "Top slugs",
          dropAt: new Date("2026-03-10T10:00:00.000Z"),
          slugCount: 100,
          isLive: true,
          isFinished: false,
          slugsPool: ["AAA001", "AAA002"],
          soldSlugs: [],
        },
      ],
    });
    expect(html).toContain("ДРОП НАЧАЛСЯ");
    expect(html).not.toContain("🔥");
    expect(html).toContain("status-dot");
  });

  test("contains live region for drop feedback", async () => {
    const html = await renderDropsTemplate();
    expect(html).toContain('id="drops-toast-region"');
    expect(html).toContain('aria-live="polite"');
  });

  test("drops client script has retry and emoji-free waitlist success", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "drops.js"), "utf-8");
    expect(source).toContain("drops-retry-live");
    expect(source).toContain("Уведомление включено");
    expect(source.includes("✅")).toBe(false);
  });
});
