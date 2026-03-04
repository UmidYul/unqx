const path = require("node:path");
const ejs = require("ejs");

async function renderPublicView(fileName, locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", fileName);
  return ejs.renderFile(file, {
    title: "",
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/test",
    ...locals,
  });
}

describe("error pages", () => {
  test("404 page is localized and has main CTA", async () => {
    const html = await renderPublicView("not-found.ejs");
    expect(html).toContain("404 · Страница не найдена");
    expect(html).toContain("На главную");
    expect(html).not.toContain("This page could not be found.");
  });

  test("500 page is localized and has retry + home actions", async () => {
    const html = await renderPublicView("error-500.ejs");
    expect(html).toContain("500 · Временная ошибка сервера");
    expect(html).toContain(">Повторить<");
    expect(html).toContain("На главную");
    expect(html).not.toContain("Internal Server Error.");
  });

  test("error pages are emoji-free", async () => {
    const notFoundHtml = await renderPublicView("not-found.ejs");
    const error500Html = await renderPublicView("error-500.ejs");
    const emojiRegex = /[✅❌🔥⚡🏆🥇🥈🥉⏰👁📅🎁]/u;
    expect(emojiRegex.test(notFoundHtml)).toBe(false);
    expect(emojiRegex.test(error500Html)).toBe(false);
  });
});
