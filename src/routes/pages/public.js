const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, requireUserPage, getUserSession } = require("../../middleware/auth");
const { getPublicCardBySlug } = require("../../services/cards");
const { getEffectivePlan } = require("../../services/profile");
const { absoluteUrl } = require("../../utils/url");

const router = express.Router();

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function mapProfileButtons(rawButtons) {
  const source = Array.isArray(rawButtons) ? rawButtons : [];
  return source
    .map((item) => {
      const obj = item && typeof item === "object" ? item : {};
      const label = String(obj.label || "").trim().slice(0, 50);
      const href = String(obj.href || obj.url || "").trim();
      if (!label || !href) {
        return null;
      }
      return {
        label,
        url: href,
        isActive: true,
      };
    })
    .filter(Boolean);
}

function mapProfileTags(rawTags) {
  const source = Array.isArray(rawTags) ? rawTags : [];
  return source
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((label) => ({ label }));
}

function buildPublicCardFromProfile({ slug, user, profileCard, viewsCount }) {
  const plan = getEffectivePlan(user).plan;
  return {
    slug,
    avatarUrl: profileCard.avatarUrl || null,
    name: profileCard.name,
    verified: false,
    tariff: plan,
    theme: profileCard.theme || "default_dark",
    phone: "",
    tags: mapProfileTags(profileCard.tags),
    buttons: mapProfileButtons(profileCard.buttons),
    hashtag: "",
    address: "",
    postcode: "",
    email: "",
    extraPhone: "",
    viewsCount: Number(viewsCount || 0),
    showBranding: Boolean(profileCard.showBranding),
  };
}

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
  "/profile",
  requireUserPage,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    const user = await prisma.user.findUnique({
      where: { telegramId: sessionUser.telegramId },
      select: {
        telegramId: true,
        firstName: true,
        username: true,
        status: true,
      },
    });

    if (!user || user.status === "blocked" || user.status === "deactivated") {
      res.redirect("/");
      return;
    }

    res.render("public/profile", {
      title: "Мой профиль | UNQ+",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);

    const slugRow = await prisma.slug.findUnique({
      where: { fullSlug: slug },
      include: {
        owner: true,
      },
    });

    if (slugRow) {
      if (slugRow.status === "blocked") {
        res.status(200).render("public/slug-state", {
          title: "Недоступно",
          slug,
          heading: "Недоступно",
          message: "Этот UNQ сейчас недоступен.",
          ctaLabel: "",
          ctaHref: "",
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "free" || slugRow.status === "pending") {
        res.status(200).render("public/slug-state", {
          title: "UNQ свободен",
          slug,
          heading: "Этот UNQ пока свободен",
          message: "Ты можешь занять его через форму на главной странице.",
          ctaLabel: "Занять →",
          ctaHref: `/#order`,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "approved") {
        res.status(200).render("public/slug-state", {
          title: `Скоро: ${slug}`,
          slug,
          heading: "Скоро появится",
          message: "Владелец уже получил доступ к UNQ и скоро опубликует визитку.",
          ctaLabel: "",
          ctaHref: "",
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "paused") {
        const owner = slugRow.owner
          ? slugRow.owner
          : slugRow.ownerTelegramId
            ? await prisma.user.findUnique({ where: { telegramId: slugRow.ownerTelegramId } })
            : null;
        if (owner && (owner.status === "blocked" || owner.status === "deactivated")) {
          res.status(200).render("public/slug-state", {
            title: "Недоступно",
            slug,
            heading: "Недоступно",
            message: "Эта визитка временно недоступна.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }
        const profileCard = slugRow.ownerTelegramId
          ? await prisma.profileCard.findUnique({ where: { ownerTelegramId: slugRow.ownerTelegramId } })
          : null;
        const primarySocial =
          profileCard && Array.isArray(profileCard.buttons)
            ? mapProfileButtons(profileCard.buttons)[0] || null
            : null;

        res.status(200).render("public/slug-paused", {
          title: `${slug} | Пауза`,
          slug,
          ownerName: owner?.displayName || owner?.firstName || "UNQ+ User",
          ownerUsername: owner?.username ? `@${owner.username}` : "",
          ownerAvatar: owner?.photoUrl || profileCard?.avatarUrl || "",
          pauseMessage: slugRow.pauseMessage || "Скоро вернусь · Пишите в Telegram",
          primarySocial,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "active" || slugRow.status === "private") {
        if (!slugRow.ownerTelegramId) {
          res.status(200).render("public/slug-state", {
            title: "Скоро",
            slug,
            heading: "Скоро появится",
            message: "Визитка для этого UNQ ещё не опубликована.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        const [owner, profileCard, views] = await Promise.all([
          prisma.user.findUnique({ where: { telegramId: slugRow.ownerTelegramId } }),
          prisma.profileCard.findUnique({ where: { ownerTelegramId: slugRow.ownerTelegramId } }),
          prisma.slugView.count({
            where: {
              fullSlug: slug,
              isUnique: true,
            },
          }),
        ]);

        if (!owner || !profileCard) {
          res.status(200).render("public/slug-state", {
            title: "Скоро",
            slug,
            heading: "Скоро появится",
            message: "Визитка для этого UNQ ещё не опубликована.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        if (owner.status === "blocked" || owner.status === "deactivated") {
          res.status(200).render("public/slug-state", {
            title: "Недоступно",
            slug,
            heading: "Недоступно",
            message: "Эта визитка временно недоступна.",
            ctaLabel: "",
            ctaHref: "",
            noindex: true,
            adminSession: getAdminSession(req),
          });
          return;
        }

        const card = buildPublicCardFromProfile({
          slug,
          user: owner,
          profileCard,
          viewsCount: views,
        });
        const image = card.avatarUrl ? absoluteUrl(card.avatarUrl) : absoluteUrl("/brand/unq-mark.svg");

        res.render("public/card", {
          title: `${card.name} | UNQ+`,
          description: card.name,
          image,
          card,
          noindex: slugRow.status === "private",
          adminSession: getAdminSession(req),
        });
        return;
      }
    }

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

