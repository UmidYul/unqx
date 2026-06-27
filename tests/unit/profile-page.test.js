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
    expect(html).toContain('data-tab-target="community"');
    expect(html).toContain('data-tab-target="requests"');
    expect(html).toContain('data-tab-target="referrals"');
    expect(html).toContain('data-tab-target="settings"');
  });

  test("renders community panel and unread badge shell", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-community-tab-unread"');
    expect(html).toContain('data-tab-panel="community"');
    expect(html).toContain('id="profile-community-summary"');
    expect(html).toContain('id="profile-community-filters"');
    expect(html).toContain('id="profile-community-list"');
  });

  test("renders wall composer controls", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-wall-open-composer"');
    expect(html).toContain('id="profile-wall-composer-modal"');
    expect(html).toContain('id="profile-wall-editor"');
    expect(html).toContain('id="profile-wall-comments-enabled"');
    expect(html).toContain('id="profile-wall-submit"');
    expect(html).toContain('id="profile-wall-composer-close"');
    expect(html).not.toContain("1 пост в день");
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

  test("renders new theme groups, emoji backgrounds, and avatar frame picker", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain("Signature Themes");
    expect(html).toMatch(/Color\s+Presets/);
    expect(html).toMatch(/Фоновый\s+emoji/);
    expect(html).toMatch(/Рамка\s+аватара/);
    expect(html).toContain('data-theme="graffiti_neon"');
    expect(html).toContain('data-theme="color_blue"');
    expect(html).toContain('data-theme="heritage_crest"');
    expect(html).toContain('data-theme="football_pitch"');
    expect(html).toContain('data-theme="anime_blush"');
    expect(html).toContain('data-theme="cheetah_spots"');
    expect(html).toContain('data-theme="serpent_scale"');
    expect(html).toContain('data-emoji-background-pack="ghosts"');
    expect(html).toContain('data-emoji-background-pack="hearts"');
    expect(html).toContain('data-avatar-frame="chrome_ring"');
    expect(html).toContain('data-avatar-frame="tape_collage"');
    expect(html).toContain('data-avatar-frame="laurel_wreath"');
    expect(html).toContain('data-avatar-frame="medal_ribbon"');
    expect(html).not.toContain('data-avatar-frame="comic_boom"');
    expect(html).not.toContain(">Graffiti Neon</p>");
    expect(html).not.toContain("Comic Boom");
  });

  test("renders card editor categories and sticky preview shell", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-card-categories"');
    expect(html).toContain('data-card-editor-category="main"');
    expect(html).toContain('data-card-editor-category="links"');
    expect(html).toContain('data-card-editor-category="contacts"');
    expect(html).toContain('data-card-editor-category="design"');
    expect(html).toContain('data-card-editor-category="pets"');
    expect(html).toContain('data-card-editor-panel="main"');
    expect(html).toContain('data-card-editor-panel="links"');
    expect(html).toContain('data-card-editor-panel="contacts"');
    expect(html).toContain('data-card-editor-panel="design"');
    expect(html).toContain('data-card-editor-panel="pets"');
    expect(html).toContain('id="profile-card-pets-list"');
    expect(html).toContain('id="profile-preview-slug-label"');
    expect(html).toContain("Live Preview");
  });

  test("renders login inline status for editable login setup", async () => {
    const html = await renderProfileTemplate();
    expect(html).toContain('id="profile-settings-login"');
    expect(html).toContain('id="profile-settings-login-status"');
    expect(html).toMatch(/Логин можно менять в\s+любой момент, если он свободен/);
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
    expect(source).toContain("PROFILE_EMOJI_BACKGROUND_PACKS");
    expect(source).toContain("avatarFrame: effectiveAvatarFrame");
    expect(source).toContain("emojiBackgroundPack: effectiveEmojiBackgroundPack");
    expect(source).toContain('data-avatar-frame');
    expect(source).toContain('data-emoji-background-pack');
    expect(source).toContain("normalizeCardEditorCategory");
    expect(source).toContain("renderCardEditorCategory");
    expect(source).toContain("renderEmojiBackgroundPack");
    expect(source).toContain('data-card-editor-category');
    expect(source).toContain('data-card-editor-panel');
    expect(source).toContain("/api/profile/follows?type=");
    expect(source).toContain("/api/profile/follows/notifications/read-all");
    expect(source).toContain("data-community-follow-toggle");
    expect(source).toContain("renderCommunity");
    expect(source).toContain("profile-community-tab-unread");
    expect(source).toContain("patchCommunityFollowingCount");
    expect(source).toContain("patchCommunityItemsFollowState");
    expect(source).toContain("wallComposerModalOpen");
    expect(source).toContain("openWallComposerModal");
    expect(source).toContain("closeWallComposerModal");
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
    expect(source).toContain("normalizeEmojiBackgroundByPlan");
    expect(source).toContain("requestedAvatarFrame");
    expect(source).toContain("requestedEmojiBackgroundPack");
    expect(source).toContain('"/follows"');
    expect(source).toContain('"/follows/notifications/read-all"');
  });
});
