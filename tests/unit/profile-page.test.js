const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderProfileTemplate() {
  const file = path.join(process.cwd(), "src", "views", "public", "profile.ejs");
  return ejs.renderFile(file, {
    title: "Мой профиль | UNQ+",
    telegramBotUsername: "unqx_bot",
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/profile",
  });
}

describe("profile page", () => {
  test("renders profile page without crash", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Мой профиль | UNQ+");
  });

  test("renders all profile tabs", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('data-tab-target="slugs"');
    expect(html).toContain('data-tab-target="card"');
    expect(html).toContain('data-tab-target="requests"');
    expect(html).toContain('data-tab-target="referrals"');
    expect(html).toContain('data-tab-target="settings"');
  });

  test("has modal close button and dialog semantics", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-modal-close-top"');
    expect(html).toContain('id="profile-modal-dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  test("contains required indicator and inline error for card name", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain("Имя <span class=\"text-red-600\">*</span>");
    expect(html).toContain('id="profile-card-name-error"');
  });

  test("does not contain emoji artifacts in profile template", async () => {
    const html = await renderProfileTemplate();
    const emojiRegex = /[🟢🟡🔴✅❌🎁🕐👁📅]/u;
    expect(emojiRegex.test(html)).toBe(false);
  });

  test("profile client script uses localized views text and keyboard modal handlers", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "profile.js"), "utf-8");
    expect(source).toContain("просмотров");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("modalIsOpen");
  });

  test("profile API labels are emoji-free", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "profile.js"), "utf-8");
    const emojiRegex = /[🟢🟡🔴✅❌🎁🕐⛔⬜🆕💬💳⏳]/u;
    expect(emojiRegex.test(source)).toBe(false);
  });
});
