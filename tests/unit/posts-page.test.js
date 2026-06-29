const path = require("node:path");
const ejs = require("ejs");

async function renderPostsTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", "posts.ejs");
  return ejs.renderFile(file, {
    title: "Посты | UNQX",
    description: "Все опубликованные посты пользователей UNQX.",
    cspNonce: "nonce",
    csrfToken: "csrf",
    assetVersion: "test",
    image: "/brand/logo.PNG",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/posts",
    leaderboardEnabled: true,
    authPhotoUrl: "",
    userSession: null,
    posts: [
      {
        id: "post_1",
        content: "Первый публичный пост",
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        likesCount: 5,
        commentsCount: 2,
        viewerHasLiked: true,
        postHref: "/ABC123#wall-post-post_1",
        author: {
          userId: "user_1",
          name: "Ali",
          handle: "ali",
          primarySlug: "ABC123",
          profileHref: "/ABC123",
          verified: true,
        },
        viewerFollowState: {
          canFollow: true,
          isFollowing: false,
        },
      },
    ],
    pagination: {
      page: 2,
      pageSize: 12,
      total: 25,
      totalPages: 3,
      hasMore: true,
    },
    adminSession: null,
    ...locals,
  });
}

describe("public posts page", () => {
  test("renders all-posts page with navigation, post actions, and pagination", async () => {
    const html = await renderPostsTemplate();

    expect(html).toContain("<h1");
    expect(html).toContain("Посты");
    expect(html).toContain('href="/posts"');
    expect(html).toContain("Первый публичный пост");
    expect(html).toContain('data-home-post-like');
    expect(html).toContain('data-home-post-comment');
    expect(html).toContain('data-home-post-share');
    expect(html).toContain('data-home-follow-button');
    expect(html).toContain("/ABC123#wall-post-post_1");
    expect(html).toContain('src="/brand/unqlogo.png"');
    expect(html).not.toContain("home-latest-post-meta-row");
    expect(html).not.toContain("comments&nbsp;");
    expect(html).toContain('data-home-post-like-count>5</span>');
    expect(html).toContain('<span class="home-latest-post-action-value">2</span>');
    expect(html).toMatch(/5 минут[ау]? назад/);
    expect(html).toContain("/posts?page=1");
    expect(html).toContain("/posts?page=3");
    expect(html).toContain("public-posts-pagination");
    expect(html).toContain("Найдено: 25");
    expect(html).toContain("2/3");
  });

  test("posts page styles use responsive grid and wide pagination", () => {
    const fs = require("node:fs");
    const styles = fs.readFileSync(path.join(process.cwd(), "public", "css", "public-card.css"), "utf-8");

    expect(styles).toContain(".public-posts-page .public-posts-grid");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain("grid-template-columns: 1fr;");
    expect(styles).toContain(".public-posts-pagination");
    expect(styles).toContain(".public-posts-summary-panel");
    expect(styles).toContain(".home-latest-post-action-value");
    expect(styles).toContain("justify-content: space-between;");
  });
});
