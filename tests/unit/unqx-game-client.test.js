const path = require("node:path");
const fs = require("node:fs");

describe("unqx game client script", () => {
  test("uses expected API endpoints", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "unqx-game.js"), "utf-8");
    expect(source).toContain("/api/cards/unqx-game/spin");
    expect(source).toContain("/api/cards/unqx-game/history");
    expect(source).toContain("X-CSRF-Token");
  });

  test("contains loading state and auto refresh", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "unqx-game.js"), "utf-8");
    expect(source).toContain('spinButton.textContent = "Крутим..."');
    expect(source).toContain('spinButton.textContent = "Крутить"');
    expect(source).toContain('spinButton.textContent = "Лимит на сегодня"');
    expect(source).toContain("window.setInterval");
    expect(source).toContain("HISTORY_REFRESH_MS");
  });

  test("handles daily limit and winner profile links", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "unqx-game.js"), "utf-8");
    expect(source).toContain("DAILY_SPIN_LIMIT");
    expect(source).toContain("nextSpinAt");
    expect(source).toContain("unqx-game-history-winner-link");
    expect(source).toContain("unqx-game-lucky-text");
  });

  test("does not include emoji artifacts", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "js", "unqx-game.js"), "utf-8");
    expect(source.includes("🔥")).toBe(false);
    expect(source.includes("✅")).toBe(false);
    expect(source.includes("🏆")).toBe(false);
  });
});
