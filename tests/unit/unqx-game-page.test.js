const path = require("node:path");
const ejs = require("ejs");

async function renderUnqxGameTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", "unqx-game.ejs");
  return ejs.renderFile(file, {
    title: "UNQX Lucky | Крути комбинации",
    description: "UNQX Lucky",
    cspNonce: "nonce",
    csrfToken: "csrf",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/unqx-game",
    ...locals,
  });
}

describe("unqx game page", () => {
  test("renders page without crashing", async () => {
    const html = await renderUnqxGameTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("UNQX Lucky");
  });

  test("contains spin button and result block", async () => {
    const html = await renderUnqxGameTemplate();
    expect(html).toContain('id="unqx-game-spin-button"');
    expect(html).toContain("Крутить");
    expect(html).toContain('id="unqx-game-result-slug"');
    expect(html).toContain('id="unqx-game-result-price"');
    expect(html).toContain('id="unqx-game-lucky-box"');
    expect(html).toContain('id="unqx-game-spin-limit"');
  });

  test("contains history list and manual refresh button", async () => {
    const html = await renderUnqxGameTemplate();
    expect(html).toContain('id="unqx-game-history-list"');
    expect(html).toContain('id="unqx-game-history-refresh"');
    expect(html).toContain('id="unqx-game-history-empty"');
  });

  test("includes dedicated style and script files", async () => {
    const html = await renderUnqxGameTemplate();
    expect(html).toContain('/css/unqx-game.css');
    expect(html).toContain('/js/unqx-game.js');
  });
});
