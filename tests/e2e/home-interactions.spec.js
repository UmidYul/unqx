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

test("shows only the final server price and does not wait for recommendations", async ({ page }) => {
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
  await gate.pending.get("JCH843")({ price: 1170000, calculation: {
    basePrice: 100000, lettersMultiplier: 3, digitsMultiplier: 3, markupPercent: 30, markupAmount: 270000,
  } });
  await expect(page.locator("#calc-result")).toBeVisible();
  await expect(page.locator("#calc-result-price")).toHaveText(/1\s170\s000/);
  await expect(page.locator("#calc-result-formula")).toContainText("наценка 30%");
  await page.waitForTimeout(600); // Catch the former 450 ms number animation and second price update.
  expect(await page.evaluate(() => window.priceValues)).toEqual(["1170000"]);
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
