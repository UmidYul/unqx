const { test, expect } = require("@playwright/test");
const ejs = require("ejs");
const fs = require("node:fs/promises");
const path = require("node:path");

// Isolated UI fixtures: real templates/assets, with controlled API delays and prices.
// Run without a database: E2E_BASE_URL=http://unqx.test npx playwright test tests/e2e/home-interactions.spec.js
async function openHome(page, { price, availability, random, query = "?calcSlug=JCH843", count = 3 } = {}) {
  const html = await ejs.renderFile(path.join(process.cwd(), "src/views/public/home.ejs"), {
    title: "UNQX", cspNonce: "test", csrfToken: "test", assetVersion: "test", publicSettings: {},
    baseUrl: "http://unqx.test", canonicalUrl: "http://unqx.test/", userSession: null,
    testimonials: [], topWeeklyViews: Array.from({ length: count }, (_, i) => ({
      name: `Profile ${i}`, primarySlug: `AAA${String(i).padStart(3, "0")}`,
      avatarUrl: "/brand/default-avatar.svg",
    })), latestCreatedCards: [], latestPublishedPosts: [], slugTotalLimit: 17576000,
    activeFlashSale: null, nextDrop: null, telegramBotUsername: "unqx_bot", leaderboardEnabled: true,
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "unqx.test") return route.abort();
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
    if (url.pathname === "/api/cards/slug-price") {
      if (price) return price(route, url.searchParams.get("slug"));
      return route.fulfill({ json: { price: 1170000, calculation: { basePrice: 100000, lettersMultiplier: 3, digitsMultiplier: 3, markupPercent: 30, markupAmount: 270000 } } });
    }
    if (url.pathname === "/api/random-free-slug" && random) return random(route);
    if (url.pathname === "/api/cards/availability" && availability) return availability(route);
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { available: true, items: [], suggestions: [] } });
    const file = path.join(process.cwd(), "public", url.pathname);
    try { await fs.access(file); return await route.fulfill({ path: file }); } catch { return route.abort(); }
  });
  await page.goto(`http://unqx.test/${query}`);
}

function priceGate() {
  const pending = new Map();
  return {
    pending,
    handler: (route, slug) => new Promise((done) => {
      pending.set(slug, async (json, status = 200) => {
        await route.fulfill({ json, status }).catch(() => {});
        done();
      });
    }),
  };
}

async function setCombination(page, letters, digits) {
  await page.locator("#calc-letters").fill(letters);
  await page.locator("#calc-digits").fill(digits);
}

test("smoothly forms the server price and combination without waiting for recommendations", async ({ page }) => {
  const gate = priceGate();
  await openHome(page, { price: gate.handler, availability: () => new Promise(() => {}) });
  await expect(page.locator("#calc-status")).toContainText("Обновляем цену");
  await expect(page.locator("#calc-result")).toBeVisible();
  await page.evaluate(() => {
    window.priceValues = [];
    const node = document.getElementById("calc-result-price");
    new MutationObserver(() => window.priceValues.push(node.textContent.replace(/\s/g, "")))
      .observe(node, { childList: true, subtree: true, characterData: true });
  });
  await page.waitForTimeout(100);
  await expect(page.locator("#calc-result-price")).toHaveText("—");
  expect(await page.evaluate(() => window.priceValues)).toEqual([]);
  await gate.pending.get("JCH843")({ price: 1170000, calculation: {
    basePrice: 100000, lettersMultiplier: 3, digitsMultiplier: 3, markupPercent: 30, markupAmount: 270000,
  } });
  await expect(page.locator("#calc-result")).toHaveAttribute("data-animating", "true");
  const reels = page.locator(".calc-slug-reel-track");
  await expect(reels).toHaveCount(6);
  const firstTransform = await reels.first().evaluate((node) => getComputedStyle(node).transform);
  await page.waitForTimeout(100);
  expect(await reels.first().evaluate((node) => getComputedStyle(node).transform)).not.toBe(firstTransform);
  await expect(page.locator("#calc-result")).toBeVisible();
  await expect(page.locator("#calc-result-price")).toHaveText(/1\s170\s000/);
  await expect(page.locator("#calc-result-formula")).toContainText("наценка 30%");
  await expect(page.locator("#calc-result")).not.toHaveAttribute("data-animating", "true");
  await expect(page.locator("#calc-result-slug")).toHaveText("JCH843");
  const values = await page.evaluate(() => window.priceValues.map(Number));
  expect(values.length).toBeGreaterThan(10);
  expect(values.at(-1)).toBe(1170000);
  expect(values.every((value, index) => value >= 0 && value <= 1170000
    && (index === 0 || value >= values[index - 1]))).toBe(true);
});

test("settles an interrupted formation before waiting for another quote", async ({ page }) => {
  const gate = priceGate();
  await openHome(page, { price: gate.handler });
  await gate.pending.get("JCH843")({ price: 1170000 });
  await expect(page.locator("#calc-result")).toHaveAttribute("data-animating", "true");
  await setCombination(page, "XYZ", "111");
  await expect(page.locator("#calc-result-price")).toHaveText(/1\s170\s000/);
  await expect(page.locator("#calc-result-slug")).toHaveText("JCH843");
  await page.waitForTimeout(900);
  await expect(page.locator("#calc-result-price")).toHaveText(/1\s170\s000/);
  await gate.pending.get("XYZ111")({ price: 650000, source: "override" });
  await expect(page.locator("#calc-result-price")).toHaveText(/650\s000/);
  await expect(page.locator("#calc-result-slug")).toHaveText("XYZ111");
});

test("combination glyphs keep their baseline when the reels settle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gate = priceGate();
  await openHome(page, { price: gate.handler, query: "?calcSlug=DYP534" });
  await gate.pending.get("DYP534")({ price: 650000 });
  await expect(page.locator(".calc-slug-reel-track")).toHaveCount(6);
  const rolled = await page.locator("#calc-result-slug").evaluate((node) => {
    node.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    const range = document.createRange();
    range.selectNodeContents(node.querySelector(".calc-slug-reel-track > span:last-child"));
    const { x, y, height } = range.getBoundingClientRect();
    const block = node.getBoundingClientRect();
    return { x: x - block.x, y: y - block.y, height, blockHeight: block.height };
  });
  await expect(page.locator("#calc-result-slug")).toHaveText("DYP534");
  const settled = await page.locator("#calc-result-slug").evaluate((node) => {
    const range = document.createRange();
    range.setStart(node.firstChild, 0);
    range.setEnd(node.firstChild, 1);
    const { x, y, height } = range.getBoundingClientRect();
    const block = node.getBoundingClientRect();
    return { x: x - block.x, y: y - block.y, height, blockHeight: block.height };
  });
  expect(settled.x).toBeCloseTo(rolled.x, 1);
  expect(settled.y).toBeCloseTo(rolled.y, 1);
  expect(settled.height).toBeCloseTo(rolled.height, 1);
  expect(settled.blockHeight).toBeCloseTo(rolled.blockHeight, 1);
});

test("respects reduced motion and preserves the crossed-out flash price", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page, { price: (route) => route.fulfill({ json: {
    price: 650000, hasFlashSale: true, basePrice: 1000000, discountPercent: 35,
  } }) });
  await expect(page.locator("#calc-flash-final-price")).toHaveText(/650\s000/);
  await expect(page.locator("#calc-result-price .line-through")).toHaveText(/1\s000\s000/);
  await expect(page.locator("#calc-result-slug")).toHaveText("JCH843");
  await expect(page.locator(".calc-slug-reel")).toHaveCount(0);
  await expect(page.locator("#calc-result")).not.toHaveAttribute("data-animating", "true");
});

test("ignores stale requests after a new or incomplete combination", async ({ page }) => {
  const gate = priceGate();
  await openHome(page, { price: gate.handler });
  await setCombination(page, "XYZ", "111");
  await expect.poll(() => gate.pending.has("XYZ111")).toBe(true);
  await gate.pending.get("XYZ111")({ price: 900000 });
  await expect(page.locator("#calc-result-price")).toHaveText(/900\s000/);
  await gate.pending.get("JCH843")({ price: 1170000 });
  await expect(page.locator("#calc-result-slug")).toHaveText("XYZ111");
  await expect(page.locator("#calc-result-price")).toHaveText(/900\s000/);
  await setCombination(page, "ABC", "456");
  await page.locator("#calc-digits").fill("4");
  if (gate.pending.has("ABC456")) await gate.pending.get("ABC456")({ price: 700000 });
  await expect(page.locator("#calc-result")).toBeVisible();
  await expect(page.locator("#calc-status")).toContainText("Введите 3 буквы");
  await expect(page.locator("#calc-result-price")).toHaveText(/900\s000/);
  await expect(page.locator("#calc-reserve-link")).toHaveAttribute("aria-disabled", "true");
});

test("does not substitute an estimated price on failure and supports retry", async ({ page }) => {
  let calls = 0;
  await openHome(page, { price: (route) => route.fulfill(++calls === 1
    ? { status: 503, json: {} }
    : { json: { price: 650000, source: "override" } }) });
  await expect(page.locator("#calc-result")).toBeVisible();
  await expect(page.locator("#calc-retry")).toBeVisible();
  await page.locator("#calc-retry").click();
  await expect(page.locator("#calc-result-price")).toHaveText(/650\s000/);
  await expect(page.locator("#calc-result-formula")).toContainText("Персональная цена");
});

test("profile cards move together in subpixel steps and wrap without gaps", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page, { count: 1 });
  const feed = page.locator(".home-profile-marquee");
  await feed.scrollIntoViewIfNeeded();
  await expect.poll(() => feed.evaluate((v) => v.querySelector("a").getAnimations()[0]?.playState)).toBe("running");
  const samples = await feed.evaluate(async (v) => {
    const cards = Array.from(v.querySelectorAll("a"));
    const frames = [];
    for (let i = 0; i < 20; i++) {
      await new Promise(requestAnimationFrame);
      frames.push({ x: cards[0].getBoundingClientRect().x,
        times: cards.map((c) => c.getAnimations()[0].currentTime) });
    }
    return { frames, scroll: v.scrollLeft, trackTransform: getComputedStyle(v.firstElementChild).transform };
  });
  expect(samples.scroll).toBe(0);
  expect(samples.trackTransform).toBe("none");
  const steps = samples.frames.slice(1).map((frame, i) => samples.frames[i].x - frame.x);
  expect(steps.filter((delta) => delta > 0 && delta < 1).length).toBeGreaterThan(10);
  for (const frame of samples.frames) expect(Math.max(...frame.times) - Math.min(...frame.times)).toBeLessThan(0.1);
  await feed.evaluate((v) => v.querySelectorAll("a").forEach((card) => {
    const animation = card.getAnimations()[0];
    animation.currentTime = animation.effect.getTiming().duration - 100;
  }));
  await page.waitForTimeout(300);
  expect(await feed.evaluate((v) => {
    const bounds = v.getBoundingClientRect();
    const rects = Array.from(v.querySelectorAll("a"), (a) => a.getBoundingClientRect())
      .filter((r) => r.right > bounds.left && r.left < bounds.right).sort((a, b) => a.left - b.left);
    return rects[0].left <= bounds.left + 15 && rects.at(-1).right >= bounds.right - 15
      && rects.slice(1).every((r, i) => r.left - rects[i].right <= 13);
  })).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(feed).not.toHaveClass(/is-animated/);
  expect(await feed.evaluate((v) => v.getAnimations({ subtree: true }).length)).toBe(0);
});


test("a delayed initial random slug never replaces user input", async ({ page }) => {
  let releaseRandom;
  await openHome(page, { query: "", random: (route) => new Promise((done) => {
    releaseRandom = async () => { await route.fulfill({ json: { slug: "ZZZ888" } }); done(); };
  }) });
  await setCombination(page, "JCH", "843");
  await expect(page.locator("#calc-result-slug")).toHaveText("JCH843");
  await expect.poll(() => typeof releaseRandom).toBe("function");
  await releaseRandom();
  await expect(page.locator("#calc-letters")).toHaveValue("JCH");
  await expect(page.locator("#calc-digits")).toHaveValue("843");
  await expect(page.locator("#calc-result-slug")).toHaveText("JCH843");
});


test("keeps the quote card and previous amount in place until the next price arrives", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gate = priceGate();
  await openHome(page, { price: gate.handler });
  await expect.poll(() => gate.pending.has("JCH843")).toBe(true);
  await gate.pending.get("JCH843")({ price: 1170000, source: "override" });
  const card = page.locator("#calc-result");
  await expect(page.locator("#calc-result-price")).toHaveText(/1\s170\s000/);
  const before = await card.boundingBox();
  await setCombination(page, "XYZ", "111");
  await expect.poll(() => gate.pending.has("XYZ111")).toBe(true);
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#calc-result-price")).toHaveText(/1\s170\s000/);
  await expect(page.locator("#calc-result-slug")).toHaveText("JCH843");
  const pending = await card.boundingBox();
  expect(pending.height).toBeCloseTo(before.height, 0);
  expect(pending.width).toBeCloseTo(before.width, 0);
  await expect(page.locator("#calc-reserve-link")).toHaveAttribute("aria-disabled", "true");
  await page.evaluate(() => document.getElementById("calc-reserve-link").click());
  await expect(page.locator("#order-modal-root")).toBeHidden();
  await gate.pending.get("XYZ111")({ price: 900000, source: "override" });
  await expect(page.locator("#calc-result-price")).toHaveText(/900\s000/);
  await expect(card).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#calc-reserve-link")).toHaveAttribute("aria-disabled", "false");
  await expect.poll(() => page.locator("#calc-result-price").evaluate((node) => node.getAnimations().length)).toBe(0);
  await expect(page.locator("#calc-result-slug")).toHaveText("XYZ111");
});
