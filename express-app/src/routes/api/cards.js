const { createHash } = require("node:crypto");

const express = require("express");

const { prisma } = require("../../db/prisma");
const { detectDevice } = require("../../services/ua");
const { generateVCard } = require("../../services/vcard");
const { asyncHandler } = require("../../middleware/async");

const router = express.Router();

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
    const forwardedFor = req.get("x-forwarded-for");
    const realIp = req.get("x-real-ip");
    const ip = (forwardedFor ? forwardedFor.split(",")[0].trim() : null) || (realIp ? realIp.trim() : null);
    const dateKey = new Date().toISOString().slice(0, 10);
    const ipHash = ip ? createHash("sha256").update(`${ip}|${req.params.slug}|${dateKey}`).digest("hex") : null;
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