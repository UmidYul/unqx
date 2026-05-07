const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderProfileTemplate() {
  const file = path.join(process.cwd(), "src", "views", "public", "profile.ejs");
  return ejs.renderFile(file, {
    title: "Мой профиль | UNQX",
    telegramBotUsername: "unqx_bot",
    reactivationWindowDays: 30,
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/profile",
    assetVersion: "test",
    userSession: null,
    publicSettings: {},
  });
}

describe("profile page", () => {
  test("renders profile page without crash", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Мой профиль | UNQX");
  });

  test("renders all profile tabs", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('data-tab-target="slugs"');
    expect(html).toContain('data-tab-target="card"');
    expect(html).toContain('data-tab-target="posts"');
    expect(html).toContain('data-tab-target="requests"');
    expect(html).toContain('data-tab-target="referrals"');
    expect(html).toContain('data-tab-target="settings"');
  });

  test("renders wall composer controls", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-wall-editor"');
    expect(html).toContain('id="profile-wall-comments-enabled"');
    expect(html).toContain('id="profile-wall-submit"');
    expect(html).toContain("1 пост в день");
    expect(html).toContain("комментарии можно отключать для каждого поста");
  });

  test("has modal close button and dialog semantics", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-modal-close-top"');
    expect(html).toContain('id="profile-modal-dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  test("contains required indicator and inline error for card name", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain(">Имя <span");
    expect(html).toContain('class="text-red-600">*</span>');
    expect(html).toContain('id="profile-card-name-error"');
  });

  test("renders new theme groups and avatar frame picker", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain("Signature Themes");
    expect(html).toContain("Color Presets");
    expect(html).toContain("Рамка аватара");
    expect(html).toContain('data-theme="graffiti_neon"');
    expect(html).toContain('data-theme="color_blue"');
    expect(html).toContain('data-avatar-frame="chrome_ring"');
    expect(html).toContain('data-avatar-frame="tape_collage"');
    expect(html).not.toContain('data-avatar-frame="comic_boom"');
    expect(html).not.toContain(">Graffiti Neon</p>");
    expect(html).not.toContain("Comic Boom");
  });

  test("renders login inline status for editable login setup", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-settings-login"');
    expect(html).toContain('id="profile-settings-login-status"');
    expect(html).toContain("Логин можно менять в любой момент, если он свободен");
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
    expect(source).toContain("data-wall-comment-submit");
    expect(source).toContain("data-wall-comments-toggle");
    expect(source).toContain("Комментарий опубликован");
    expect(source).toContain("Комментарий пустой");
    expect(source).toContain("wallDraftCommentsEnabled");
    expect(source).toContain("Комментарии отключены автором.");
    expect(source).toContain("Комментарии отключены автором для этого поста.");
    expect(source).toContain("/api/auth/check-availability?login=");
    expect(source).toContain("profile-settings-login-status");
    expect(source).toContain("PROFILE_LOGIN_AVAILABLE_MESSAGE");
    expect(source).toContain("PROFILE_LOGIN_CURRENT_MESSAGE");
    expect(source).toContain('s.user?.login || s.user?.username');
    expect(source).toContain("s.user.telegramUsername");
    expect(source).toContain("PROFILE_AVATAR_FRAMES");
    expect(source).toContain("avatarFrame: effectiveAvatarFrame");
    expect(source).toContain('data-avatar-frame');
  });

  test("profile card draft is kept in memory instead of persistent localStorage writes", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "profile.js"), "utf-8");
    expect(source).toContain("s.cardDraftDirty");
    expect(source).toContain("clearLegacyDraftStorage");
    expect(source).not.toContain("localStorage.setItem(");
  });

  test("profile API labels are emoji-free", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "profile.js"), "utf-8");
    const emojiRegex = /[🟢🟡🔴✅❌🎁🕐⛔⬜🆕💬💳⏳]/u;
    expect(emojiRegex.test(source)).toBe(false);
    expect(source).toContain("commentsEnabled: req.body?.commentsEnabled");
    expect(source).toContain("normalizeAvatarFrameByPlan");
    expect(source).toContain("requestedAvatarFrame");
  });
});
