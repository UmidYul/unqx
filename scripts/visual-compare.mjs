import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS_DIR = path.join(ROOT_DIR, "artifacts", "visual");

const NEXT_BASE_URL = process.env.NEXT_BASE_URL || "http://127.0.0.1:3000";
const EXPRESS_BASE_URL = process.env.EXPRESS_BASE_URL || "http://127.0.0.1:3100";
const ACTIVE_SLUG = process.env.VISUAL_ACTIVE_SLUG || "AAA001";
const UNAVAILABLE_SLUG = process.env.VISUAL_UNAVAILABLE_SLUG || "AAA002";
const NOT_FOUND_SLUG = process.env.VISUAL_NOT_FOUND_SLUG || "ZZZ404";
const ERROR_500_PATH = process.env.VISUAL_ERROR_500_PATH || "";

const ADMIN_LOGIN = process.env.VISUAL_ADMIN_LOGIN || process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.VISUAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const DIFF_THRESHOLD = Number(process.env.VISUAL_DIFF_THRESHOLD || "0.002");

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
];

const MASK_SELECTORS = ["[data-dynamic-time='1']"];

const ROUTES = [
  { route: "home", state: "default", path: "/" },
  { route: "public-card", state: "active", path: `/${ACTIVE_SLUG}` },
  { route: "public-card", state: "unavailable", path: `/${UNAVAILABLE_SLUG}` },
  { route: "not-found", state: "default", path: `/${NOT_FOUND_SLUG}` },
  { route: "admin-login", state: "default", path: "/admin" },
  { route: "admin-login", state: "error", path: "/admin", action: "login-error" },
  { route: "admin-dashboard", state: "default", path: "/admin/dashboard", auth: true },
  { route: "admin-dashboard", state: "qr-modal", path: "/admin/dashboard", auth: true, action: "dashboard-qr" },
  { route: "admin-card-new", state: "default", path: "/admin/cards/new", auth: true },
  { route: "admin-card-edit", state: "default", path: "/admin/cards/{editId}/edit", auth: true, needsEditId: true },
  { route: "admin-stats", state: "default", path: "/admin/stats", auth: true },
  { route: "admin-logs", state: "default", path: "/admin/logs", auth: true },
];

if (ERROR_500_PATH) {
  ROUTES.splice(4, 0, { route: "error-500", state: "default", path: ERROR_500_PATH });
}

function shotPath(envName, route, state, viewportName) {
  return path.join(ARTIFACTS_DIR, envName, route, state, `${viewportName}.png`);
}

function diffPath(route, state, viewportName) {
  return path.join(ARTIFACTS_DIR, "diff", route, state, `${viewportName}.png`);
}

async function ensureDirFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        caret-color: transparent !important;
      }
      [data-dynamic-time="1"] {
        color: transparent !important;
        text-shadow: none !important;
      }
    `,
  }).catch(() => {});

  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });

  await page.waitForTimeout(150);
}

async function ensureAdminSession(page, baseUrl) {
  if (!ADMIN_PASSWORD) {
    return false;
  }

  await page.goto(new URL("/admin", baseUrl).toString(), { waitUntil: "networkidle" });

  if (page.url().includes("/admin/dashboard")) {
    return true;
  }

  const loginField = page.locator("input[name='login']");
  const passwordField = page.locator("input[name='password']");
  if (!(await loginField.count()) || !(await passwordField.count())) {
    return false;
  }

  await loginField.fill(ADMIN_LOGIN);
  await passwordField.fill(ADMIN_PASSWORD);

  await Promise.all([
    page.waitForURL("**/admin/dashboard", { timeout: 15000 }),
    page.locator("button[type='submit']").click(),
  ]).catch(() => {});

  return page.url().includes("/admin/dashboard");
}

async function resolveEditId(page, baseUrl) {
  await page.goto(new URL("/admin/dashboard", baseUrl).toString(), { waitUntil: "networkidle" });
  const link = page.locator("a[href*='/admin/cards/'][href$='/edit']").first();

  if (!(await link.count())) {
    return null;
  }

  const href = await link.getAttribute("href");
  if (!href) {
    return null;
  }

  const match = href.match(/\/admin\/cards\/([^/]+)\/edit/);
  return match ? match[1] : null;
}

async function performStateAction(page, actionName) {
  if (actionName === "login-error") {
    await page.locator("input[name='login']").fill("invalid").catch(() => {});
    await page.locator("input[name='password']").fill("invalid").catch(() => {});
    await page.locator("button[type='submit']").click().catch(() => {});
    await page.waitForTimeout(250);
    return;
  }

  if (actionName === "dashboard-qr") {
    const qrButton = page.locator("[data-action='qr']").first();
    if (!(await qrButton.count())) {
      return;
    }

    await qrButton.click();
    await page.waitForTimeout(250);
  }
}

async function captureEnvironment(browser, envName, baseUrl) {
  const captured = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      timezoneId: "Asia/Tashkent",
      locale: "ru-RU",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();
    let hasAuth = false;
    let editId = null;

    for (const routeDef of ROUTES) {
      if (routeDef.auth) {
        if (!hasAuth) {
          hasAuth = await ensureAdminSession(page, baseUrl);
        }

        if (!hasAuth) {
          console.warn(`[visual] skip ${envName}:${routeDef.route}/${routeDef.state} (${viewport.name}) - no admin password`);
          continue;
        }
      }

      let targetPath = routeDef.path;
      if (routeDef.needsEditId) {
        if (!editId) {
          editId = await resolveEditId(page, baseUrl);
        }

        if (!editId) {
          console.warn(`[visual] skip ${envName}:${routeDef.route}/${routeDef.state} (${viewport.name}) - no edit card link`);
          continue;
        }

        targetPath = targetPath.replace("{editId}", editId);
      }

      const targetUrl = new URL(targetPath, baseUrl).toString();
      await page.goto(targetUrl, { waitUntil: "networkidle" });

      if (routeDef.action) {
        await performStateAction(page, routeDef.action);
      }

      await stabilizePage(page);

      const outputPath = shotPath(envName, routeDef.route, routeDef.state, viewport.name);
      await ensureDirFor(outputPath);

      const masks = [];
      for (const selector of MASK_SELECTORS) {
        const locator = page.locator(selector);
        if (await locator.count()) {
          masks.push(locator);
        }
      }

      await page.screenshot({
        path: outputPath,
        fullPage: false,
        mask: masks,
      });

      captured.push({
        route: routeDef.route,
        state: routeDef.state,
        viewport: viewport.name,
      });

      console.log(`[visual] captured ${envName}:${routeDef.route}/${routeDef.state} (${viewport.name})`);
    }

    await context.close();
  }

  return captured;
}

async function compareArtifacts(entries) {
  const keyMap = new Map();

  for (const entry of entries) {
    const key = `${entry.route}::${entry.state}::${entry.viewport}`;
    keyMap.set(key, entry);
  }

  const results = [];

  for (const entry of keyMap.values()) {
    const nextFile = shotPath("next", entry.route, entry.state, entry.viewport);
    const expressFile = shotPath("express", entry.route, entry.state, entry.viewport);

    if (!(await fileExists(nextFile)) || !(await fileExists(expressFile))) {
      continue;
    }

    const nextImg = PNG.sync.read(await fs.readFile(nextFile));
    const expressImg = PNG.sync.read(await fs.readFile(expressFile));

    if (nextImg.width !== expressImg.width || nextImg.height !== expressImg.height) {
      console.warn(`[visual] skipped diff (size mismatch): ${entry.route}/${entry.state} ${entry.viewport}`);
      continue;
    }

    const diff = new PNG({ width: nextImg.width, height: nextImg.height });
    const diffPixels = pixelmatch(
      nextImg.data,
      expressImg.data,
      diff.data,
      nextImg.width,
      nextImg.height,
      { threshold: 0.1 },
    );

    const ratio = diffPixels / (nextImg.width * nextImg.height);
    const outputPath = diffPath(entry.route, entry.state, entry.viewport);
    await ensureDirFor(outputPath);
    await fs.writeFile(outputPath, PNG.sync.write(diff));

    results.push({ ...entry, ratio });
  }

  return results;
}

function printSummary(results) {
  if (!results.length) {
    console.log("[visual] no comparable screenshots were produced");
    return false;
  }

  let hasFailures = false;

  console.log("\n[visual] Diff summary");
  for (const result of results) {
    const percent = (result.ratio * 100).toFixed(3);
    const mark = result.ratio <= DIFF_THRESHOLD ? "OK" : "FAIL";

    if (mark === "FAIL") {
      hasFailures = true;
    }

    console.log(`${mark} ${result.route}/${result.state} ${result.viewport} -> ${percent}%`);
  }

  console.log(`\n[visual] threshold: ${(DIFF_THRESHOLD * 100).toFixed(3)}%`);
  console.log(`[visual] artifacts: ${ARTIFACTS_DIR}`);

  return hasFailures;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    console.log(`[visual] next base: ${NEXT_BASE_URL}`);
    console.log(`[visual] express base: ${EXPRESS_BASE_URL}`);
    if (!ADMIN_PASSWORD) {
      console.log("[visual] VISUAL_ADMIN_PASSWORD is not set, private admin routes may be skipped");
    }

    const nextEntries = await captureEnvironment(browser, "next", NEXT_BASE_URL);
    const expressEntries = await captureEnvironment(browser, "express", EXPRESS_BASE_URL);
    const diffResults = await compareArtifacts([...nextEntries, ...expressEntries]);
    const hasFailures = printSummary(diffResults);

    if (hasFailures) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[visual] failed", error);
  process.exitCode = 1;
});
