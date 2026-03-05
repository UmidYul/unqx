const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

async function renderLeaderboardTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", "leaderboard.ejs");
  return ejs.renderFile(file, {
    title: "Топ визиток недели · UNQX",
    description: "Топ визиток UNQX",
    period: "week",
    items: [],
    userSummary: null,
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/leaderboard",
    ...locals,
  });
}

describe("leaderboard page", () => {
  test("renders leaderboard without crash", async () => {
    const html = await renderLeaderboardTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Топ визиток недели");
  });

  test("shows empty state when leaderboard has no items", async () => {
    const html = await renderLeaderboardTemplate({ items: [] });
    expect(html).toContain("Рейтинг пока пуст.");
  });

  test("renders top item without medal emoji", async () => {
    const html = await renderLeaderboardTemplate({
      items: [
        {
          rank: 1,
          slug: "ABC123",
          ownerName: "Alex",
          avatarUrl: "/brand/unq-mark.svg",
          score: 512,
          topPercent: 9,
          rarityLabel: "RARE",
          views: 100,
          plan: "premium",
        },
      ],
    });
    expect(html).toContain("ABC123");
    expect(html).not.toContain("🥇");
    expect(html).not.toContain("🥈");
    expect(html).not.toContain("🥉");
  });

  test("renders user summary block", async () => {
    const html = await renderLeaderboardTemplate({
      userSummary: { rank: 5, score: 412, limit: 20, toTopScore: 89 },
    });
    expect(html).toContain("Твой Score: 412");
    expect(html).toContain("Позиция #5");
    expect(html).toContain("До топ-20 нужно ещё 89 баллов");
  });

  test("contains leaderboard share live region for accessibility", async () => {
    const html = await renderLeaderboardTemplate();
    expect(html).toContain('id="leaderboard-toast-region"');
    expect(html).toContain('aria-live="polite"');
  });

  test("share script does not use emoji in copied text", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "leaderboard.js"), "utf-8");
    expect(source.includes("🔥")).toBe(false);
    expect(source).toContain("Я на #");
    expect(source).toContain("Скопировано");
  });
});
