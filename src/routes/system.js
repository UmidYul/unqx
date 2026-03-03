const express = require("express");

const { prisma } = require("../db/prisma");
const { getBaseUrl } = require("../utils/url");
const { asyncHandler } = require("../middleware/async");

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
    const cards = await prisma.card.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const base = getBaseUrl();
    const homeUrl = `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
    const cardUrls = cards
      .map(
        (card) => `<url><loc>${base}/${card.slug}</loc><lastmod>${card.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
      )
      .join("");

    const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">${homeUrl}${cardUrls}</urlset>`;

    res.type("application/xml").send(xml);
  }),
);

module.exports = {
  systemRouter: router,
};
