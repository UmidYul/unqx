const { createHash } = require("node:crypto");

const express = require("express");

const { prisma } = require("../../db/prisma");
const { detectDevice } = require("../../services/ua");
const { generateVCard } = require("../../services/vcard");
const { asyncHandler } = require("../../middleware/async");

const router = express.Router();
const SLUG_REGEX = /^[A-Z]{3}[0-9]{3}$/;

function normalizeIp(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const raw = value.trim().toLowerCase();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }

  if (raw === "::1") {
    return "127.0.0.1";
  }

  return raw;
}

function pickClientIdentity(req) {
  const forwardedFor = req.get("x-forwarded-for");
  const realIp = req.get("x-real-ip");

  const forwardedIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const directIp = normalizeIp(forwardedIp) || normalizeIp(realIp) || normalizeIp(req.ip);

  if (directIp) {
    return `ip:${directIp}`;
  }

  const userAgent = (req.get("user-agent") || "").trim();
  const acceptLanguage = (req.get("accept-language") || "").trim();

  if (!userAgent && !acceptLanguage) {
    return null;
  }

  return `fp:${userAgent}|${acceptLanguage}`;
}

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.q === "string" ? req.query.q : "";
    const query = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    if (!query) {
      res.json({ items: [] });
      return;
    }

    const items = await prisma.card.findMany({
      where: {
        isActive: true,
        slug: {
          startsWith: query,
          mode: "insensitive",
        },
      },
      select: {
        slug: true,
        name: true,
      },
      orderBy: {
        slug: "asc",
      },
      take: 8,
    });

    res.json({ items });
  }),
);

router.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const slug = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const validFormat = SLUG_REGEX.test(slug);

    if (!validFormat) {
      res.json({
        slug,
        validFormat: false,
        available: false,
        reason: "invalid_format",
      });
      return;
    }

    const existing = await prisma.card.findUnique({
      where: { slug },
      select: { id: true },
    });

    res.json({
      slug,
      validFormat: true,
      available: !existing,
    });
  }),
);

router.post(
  "/:slug/view",
  asyncHandler(async (req, res) => {
    const card = await prisma.card.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, isActive: true },
    });

    if (!card || !card.isActive) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const device = detectDevice(req.get("user-agent"));
    const dateKey = new Date().toISOString().slice(0, 10);
    const identity = pickClientIdentity(req);
    const ipHash = identity ? createHash("sha256").update(`${identity}|${req.params.slug}|${dateKey}`).digest("hex") : null;
    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);

    await prisma.$transaction(async (tx) => {
      let isUnique = false;

      if (ipHash) {
        const existing = await tx.viewLog.findFirst({
          where: {
            cardId: card.id,
            ipHash,
            viewedAt: { gte: dayStart },
          },
          select: { id: true },
        });

        isUnique = !existing;
      }

      await tx.card.update({
        where: { id: card.id },
        data: {
          viewsCount: { increment: 1 },
          ...(isUnique ? { uniqueViewsCount: { increment: 1 } } : {}),
        },
      });

      await tx.viewLog.create({
        data: {
          cardId: card.id,
          device,
          ipHash,
          isUnique,
        },
      });
    });

    res.json({ ok: true });
  }),
);

router.get(
  "/:slug/vcf",
  asyncHandler(async (req, res) => {
    const card = await prisma.card.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        isActive: true,
        name: true,
        phone: true,
        email: true,
        extraPhone: true,
        address: true,
        postcode: true,
        hashtag: true,
      },
    });

    if (!card || !card.isActive) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const payload = generateVCard(card);

    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${card.slug}.vcf"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(payload);
  }),
);

module.exports = {
  publicApiRouter: router,
};
