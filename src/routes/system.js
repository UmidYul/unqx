const express = require("express");

const { prisma } = require("../db/prisma");
const { getBaseUrl } = require("../utils/url");
const { asyncHandler } = require("../middleware/async");
const { getFeatureSetting } = require("../services/feature-settings");

const router = express.Router();

router.get("/robots.txt", (_req, res) => {
  const content = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /profile",
    `Sitemap: ${getBaseUrl()}/sitemap.xml`,
    "",
  ].join("\n");
  res.type("text/plain").send(content);
});

router.get(
  "/sitemap.xml",
  asyncHandler(async (_req, res) => {
    const [activeSlugs, legacyCards, leaderboardSettings, directorySettings, dropsCount] = await Promise.all([
      prisma.slug.findMany({
        where: {
          status: { in: ["active", "approved"] },
          ownerTelegramId: { not: null },
        },
        select: { fullSlug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.card.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      getFeatureSetting("leaderboard"),
      getFeatureSetting("directory"),
      prisma.drop.count(),
    ]);

    const base = getBaseUrl();
    const nowIso = new Date().toISOString();
    const homeUrl = `<url><loc>${base}/</loc><lastmod>${nowIso}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`;
    const themesUrl = `<url><loc>${base}/themes</loc><lastmod>${nowIso}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    const seoUrls = [
      "/guides",
      "/guides/digital-business-card",
      "/guides/nfc-business-card",
      "/guides/unq-slug",
      "/guides/cases",
      "/faq",
    ]
      .map((path) => `<url><loc>${base}${path}</loc><lastmod>${nowIso}</lastmod><changefreq>weekly</changefreq><priority>0.75</priority></url>`)
      .join("");

    const publicCardMap = new Map();
    activeSlugs.forEach((row) => {
      if (!publicCardMap.has(row.fullSlug)) {
        publicCardMap.set(row.fullSlug, row.updatedAt);
      }
    });
    legacyCards.forEach((row) => {
      if (!publicCardMap.has(row.slug)) {
        publicCardMap.set(row.slug, row.updatedAt);
      }
    });

    const cardUrls = Array.from(publicCardMap.entries())
      .map(
        ([slug, updatedAt]) =>
          `<url><loc>${base}/${slug}</loc><lastmod>${new Date(updatedAt).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
      )
      .join("");

    const leaderboardUrl = leaderboardSettings.enabled
      ? `<url><loc>${base}/leaderboard</loc><lastmod>${nowIso}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
      : "";
    const directoryUrl = directorySettings.enabled
      ? `<url><loc>${base}/directory</loc><lastmod>${nowIso}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`
      : "";
    const dropsUrl = dropsCount > 0
      ? `<url><loc>${base}/drops</loc><lastmod>${nowIso}</lastmod><changefreq>hourly</changefreq><priority>0.7</priority></url>`
      : `<url><loc>${base}/drops</loc><lastmod>${nowIso}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`;

    const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">${homeUrl}${themesUrl}${seoUrls}${leaderboardUrl}${directoryUrl}${dropsUrl}${cardUrls}</urlset>`;

    res.type("application/xml").send(xml);
  }),
);

module.exports = {
  systemRouter: router,
};
