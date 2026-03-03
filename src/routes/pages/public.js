const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession } = require("../../middleware/auth");
const { getPublicCardBySlug } = require("../../services/cards");
const { absoluteUrl } = require("../../utils/url");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.render("public/home", {
      title: "UNQ+ Digital Business Cards",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const card = await getPublicCardBySlug(req.params.slug);

    if (!card) {
      try {
        await prisma.errorLog.create({
          data: {
            type: "not_found",
            path: `/${req.params.slug}`,
            userAgent: req.get("user-agent") || "",
          },
        });
      } catch (error) {
        console.error("[express-app] failed to persist not_found log", error);
      }

      res.status(404).render("public/not-found", {
        title: "Визитка не найдена",
        slug: req.params.slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    if (!card.isActive) {
      res.status(200).render("public/unavailable", {
        title: "Визитка недоступна",
        slug: card.slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    const image = card.avatarUrl ? absoluteUrl(card.avatarUrl) : absoluteUrl("/brand/unq-mark.svg");

    res.render("public/card", {
      title: `${card.name} | UNQ+`,
      description: card.phone,
      image,
      card,
      adminSession: getAdminSession(req),
    });
  }),
);

module.exports = {
  publicPagesRouter: router,
};
