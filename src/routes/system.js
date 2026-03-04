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
    "Disallow: /api/admin",
    "Disallow: /api/cards",
    `Sitemap: ${getBaseUrl()}/sitemap.xml`,
    "",
  ].join("\n");
  res.type("text/plain").send(content);
});

router.get(
  "/sitemap.xml",
  asyncHandler(async (_req, res) => {
    const [cards, leaderboardSettings, dropsCount] = await Promise.all([
      prisma.card.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      getFeatureSetting("leaderboard"),
      prisma.drop.count(),
    ]);

    const base = getBaseUrl();
    const homeUrl = `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
    const cardUrls = cards
      .map(
        (card) => `<url><loc>${base}/${card.slug}</loc><lastmod>${card.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
      )
      .join("");

    const leaderboardUrl = leaderboardSettings.enabled
      ? `<url><loc>${base}/leaderboard</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`
      : "";
    const dropsUrl = dropsCount > 0
      ? `<url><loc>${base}/drops</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>`
      : `<url><loc>${base}/drops</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`;

    const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">${homeUrl}${leaderboardUrl}${dropsUrl}${cardUrls}</urlset>`;

    res.type("application/xml").send(xml);
  }),
);

module.exports = {
  systemRouter: router,
};
