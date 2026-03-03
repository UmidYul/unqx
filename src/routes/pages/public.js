const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession } = require("../../middleware/auth");
const { getPublicCardBySlug } = require("../../services/cards");
const { absoluteUrl } = require("../../utils/url");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    let testimonials = [];
    try {
      testimonials = await prisma.testimonial.findMany({
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    } catch (error) {
      console.error("[express-app] failed to load testimonials", error);
    }

    res.render("public/home", {
      title: "UNQ+ | Цифровая визитка за 1 минуту",
      description: "Одна ссылка вместо тысячи слов. Создай свою цифровую визитку на unqx.uz",
      testimonials,
      slugTotalLimit: env.SLUG_TOTAL_LIMIT,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/themes",
  asyncHandler(async (req, res) => {
    res.render("public/themes", {
      title: "Темы Премиум | UNQ+",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/demo",
  asyncHandler(async (req, res) => {
    const allowedThemes = new Set(["default_dark", "light_minimal", "gradient", "neon", "corporate"]);
    const theme = typeof req.query.theme === "string" && allowedThemes.has(req.query.theme) ? req.query.theme : "default_dark";
    const embed = req.query.embed === "1";

    res.render("public/demo", {
      title: "UNQ+ Demo",
      theme,
      embed,
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
