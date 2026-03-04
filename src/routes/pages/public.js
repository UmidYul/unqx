const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, requireUserPage, getUserSession } = require("../../middleware/auth");
const { getPublicCardBySlug } = require("../../services/cards");
const { getEffectivePlan } = require("../../services/profile");
const { absoluteUrl } = require("../../utils/url");
const { buildLeaderboard, normalizePeriod, getSlugTopBadge, getUserLeaderboardSummary } = require("../../services/leaderboard");
const { getFeatureSetting } = require("../../services/feature-settings");
const { getActiveFlashSale, resolveConditionLabel, getFlashSaleSlotsLeft } = require("../../services/flash-sales");
const { getPublicScoreForSlug } = require("../../services/unq-score");
const { normalizeRefCode } = require("../../services/referrals");
const { getPricingSettings } = require("../../services/pricing-settings");

const router = express.Router();

function sanitizeSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function isSlugStatusDecodeError(error) {
  if (!error || typeof error !== "object") return false;
  const message = String(error.message || "");
  return (
    error.code === "P2032" ||
    (message.includes("SlugStatus") && message.includes("incompatible value")) ||
    (message.includes("Error converting field") && message.includes("status"))
  );
}

function isSlugMissingColumnError(error) {
  if (!error || typeof error !== "object") return false;
  return error.code === "P2022" && String(error?.meta?.modelName || "") === "Slug";
}

async function findSlugByFullSlugWithLegacyFallback(fullSlug) {
  try {
    return await prisma.slug.findUnique({
      where: { fullSlug },
      select: {
        id: true,
        letters: true,
        digits: true,
        fullSlug: true,
        ownerTelegramId: true,
        status: true,
        isPrimary: true,
        pauseMessage: true,
        requestedAt: true,
        pendingExpiresAt: true,
        approvedAt: true,
        activatedAt: true,
        createdAt: true,
        updatedAt: true,
        owner: true,
      },
    });
  } catch (error) {
    if (!isSlugStatusDecodeError(error) && !isSlugMissingColumnError(error)) {
      throw error;
    }

    const rows = await prisma.$queryRaw`
      SELECT
        id,
        letters,
        digits,
        full_slug AS "fullSlug",
        owner_telegram_id AS "ownerTelegramId",
        status::text AS "status",
        is_primary AS "isPrimary",
        NULL::text AS "pauseMessage",
        NULL::timestamptz AS "requestedAt",
        NULL::timestamptz AS "pendingExpiresAt",
        NULL::timestamptz AS "approvedAt",
        NULL::timestamptz AS "activatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM slugs
      WHERE full_slug = ${fullSlug}
      LIMIT 1
    `;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return {
      ...row,
      owner: null,
    };
  }
}

function mapProfileButtons(rawButtons) {
  const allowedTypes = new Set([
    "phone",
    "telegram",
    "instagram",
    "tiktok",
    "youtube",
    "website",
    "whatsapp",
    "email",
    "other",
  ]);
  const source = Array.isArray(rawButtons) ? rawButtons : [];
  return source
    .map((item) => {
      const obj = item && typeof item === "object" ? item : {};
      const typeRaw = String(obj.type || "other")
        .trim()
        .toLowerCase();
      const type = allowedTypes.has(typeRaw) ? typeRaw : "other";
      const label = String(obj.label || "").trim().slice(0, 50);
      const href = String(obj.href || obj.url || "").trim();
      if (!label || !href) {
        return null;
      }
      return {
        type,
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
    avatarUrl: profileCard.avatarUrl || user?.photoUrl || null,
    name: profileCard.name,
    verified: false,
    tariff: plan,
    theme: profileCard.theme || "default_dark",
    phone: "",
    tags: mapProfileTags(profileCard.tags),
    buttons: mapProfileButtons(profileCard.buttons),
    hashtag: profileCard.hashtag || "",
    address: profileCard.address || "",
    postcode: profileCard.postcode || "",
    email: profileCard.email || "",
    extraPhone: profileCard.extraPhone || "",
    viewsCount: Number(viewsCount || 0),
    showBranding: Boolean(profileCard.showBranding),
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [leaderboardSettings, activeFlashSale, nextDrop, pricing] = await Promise.all([
      getFeatureSetting("leaderboard"),
      getActiveFlashSale(),
      prisma.drop.findFirst({
        where: {
          isFinished: false,
          isLive: false,
          dropAt: { gt: new Date() },
        },
        orderBy: { dropAt: "asc" },
      }),
      getPricingSettings(),
    ]);
    const flashSaleSlotsLeft = activeFlashSale ? await getFlashSaleSlotsLeft(activeFlashSale) : null;

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
      leaderboardEnabled: Boolean(leaderboardSettings.enabled),
      activeFlashSale: activeFlashSale
        ? {
            id: activeFlashSale.id,
            discountPercent: activeFlashSale.discountPercent,
            conditionLabel: resolveConditionLabel(activeFlashSale),
            slotsLeft: Number.isFinite(flashSaleSlotsLeft) ? flashSaleSlotsLeft : null,
            startsAt: activeFlashSale.startsAt,
            endsAt: activeFlashSale.endsAt,
            description: activeFlashSale.description || activeFlashSale.title,
          }
        : null,
      nextDrop: nextDrop
        ? {
            id: nextDrop.id,
            title: nextDrop.title,
            dropAt: nextDrop.dropAt,
            slugCount: nextDrop.slugCount,
          }
        : null,
      pricing,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/ref/:refCode",
  asyncHandler(async (req, res) => {
    const refCode = normalizeRefCode(req.params.refCode);
    if (!refCode) {
      res.redirect("/");
      return;
    }

    if (req.session) {
      req.session.pendingRefCode = refCode;
    }

    const referrer = await prisma.user.findFirst({
      where: { refCode },
      select: {
        firstName: true,
        displayName: true,
        username: true,
      },
    });

    const referrerName = (referrer?.displayName || referrer?.firstName || "").trim();
    const referrerUsername = referrer?.username ? `@${referrer.username}` : "";

    res.render("public/referral", {
      title: "Вас пригласили в UNQ+",
      description: "Зарегистрируйтесь в UNQ+ и получите доступ к цифровой визитке по приглашению.",
      refCode,
      referrerName,
      referrerUsername,
      noindex: true,
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
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const settings = await getFeatureSetting("leaderboard");
    if (!settings.enabled) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "leaderboard",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const period = normalizePeriod(req.query.period);
    const [board, userSummary] = await Promise.all([
      buildLeaderboard(period),
      (() => {
        const user = getUserSession(req);
        if (!user?.telegramId) return Promise.resolve(null);
        return getUserLeaderboardSummary({
          telegramId: user.telegramId,
          period,
        });
      })(),
    ]);

    res.render("public/leaderboard", {
      title: "Топ визиток недели · UNQ+",
      description: "Топ визиток UNQ+ по UNQ Score",
      period: board.period,
      items: board.publicItems,
      userSummary,
      leaderboardSettings: board.settings,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/drops",
  asyncHandler(async (req, res) => {
    const rows = await prisma.drop.findMany({
      orderBy: { dropAt: "desc" },
      take: 50,
    });
    res.render("public/drops", {
      title: "Дропы slug · UNQ+",
      description: "Актуальные и прошедшие дропы slug на UNQ+",
      drops: rows,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);

    const slugRow = await findSlugByFullSlugWithLegacyFallback(slug);

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

      if (slugRow.status === "free") {
        res.status(200).render("public/slug-state", {
          title: "UNQ свободен",
          slug,
          heading: "Этот UNQ пока свободен",
          message: "Ты можешь занять его прямо сейчас.",
          ctaLabel: "Занять",
          ctaHref: "#",
          ctaOrderLink: true,
          ctaOrderPrefill: slug,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "pending" || slugRow.status === "reserved") {
        res.status(200).render("public/slug-state", {
          title: `UNQ занят: ${slug}`,
          slug,
          heading: "Этот UNQ уже занят",
          message: "Сейчас он на рассмотрении. Встань в wishlist и мы сообщим, если он освободится.",
          ctaLabel: "Встать в wishlist",
          ctaHref: "#",
          ctaWaitlistSlug: slug,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "reserved_drop") {
        res.status(200).render("public/slug-state", {
          title: `UNQ доступен в дропе`,
          slug,
          heading: "Этот UNQ доступен в дропе",
          message: "Подпишись на ближайший дроп и забери этот slug в момент старта.",
          ctaLabel: "Перейти к дропам",
          ctaHref: "/drops",
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

      if (slugRow.status === "approved" || slugRow.status === "active" || slugRow.status === "private") {
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
        const viewerTelegramId = getUserSession(req)?.telegramId || null;
        const score = await getPublicScoreForSlug({
          slug,
          viewerTelegramId,
        });

        const topBadge = await getSlugTopBadge(slug);
        res.render("public/card", {
          title: `${card.name} | UNQ+`,
          description: card.name,
          image,
          card,
          topBadge,
          score,
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
      score: null,
      adminSession: getAdminSession(req),
    });
  }),
);

module.exports = {
  publicPagesRouter: router,
};

