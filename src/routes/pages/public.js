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
  return error.code === "P2022";
}

function isUserMissingColumnError(error) {
  if (!error || typeof error !== "object") return false;
  return error.code === "P2022";
}

async function findUserByTelegramIdWithLegacyFallback(telegramId) {
  try {
    return await prisma.user.findUnique({
      where: { telegramId },
      select: {
        telegramId: true,
        firstName: true,
        username: true,
        photoUrl: true,
        displayName: true,
        status: true,
        plan: true,
        isVerified: true,
        verifiedCompany: true,
      },
    });
  } catch (error) {
    if (!isUserMissingColumnError(error)) {
      throw error;
    }
    const rows = await prisma.$queryRaw`
      SELECT
        telegram_id AS "telegramId",
        first_name AS "firstName",
        username,
        photo_url AS "photoUrl"
      FROM users
      WHERE telegram_id = ${telegramId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return {
      ...row,
      displayName: null,
      status: "active",
      plan: "none",
      isVerified: false,
      verifiedCompany: null,
    };
  }
}

async function findUserByRefCodeWithLegacyFallback(refCode) {
  try {
    return await prisma.user.findFirst({
      where: { refCode },
      select: {
        firstName: true,
        displayName: true,
        username: true,
      },
    });
  } catch (error) {
    if (!isUserMissingColumnError(error)) {
      throw error;
    }
    return null;
  }
}

async function findSlugByFullSlugWithLegacyFallback(fullSlug) {
  try {
    return await prisma.slug.findUnique({
      where: { fullSlug },
      select: {
        id: true,
        fullSlug: true,
        ownerTelegramId: true,
        status: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (!isSlugStatusDecodeError(error) && !isSlugMissingColumnError(error)) {
      throw error;
    }

    const rows = await prisma.$queryRaw`
      SELECT
        id,
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
      letters: null,
      digits: null,
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

function classifySectorFromTags(tags) {
  const joined = (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").toLowerCase())
    .join(" ");
  if (/(дизайн|design|ux|ui|product)/i.test(joined)) return "design";
  if (/(продаж|sales|account|bizdev)/i.test(joined)) return "sales";
  if (/(маркет|marketing|smm|seo|brand)/i.test(joined)) return "marketing";
  if (/(it|dev|developer|frontend|backend|qa|data|ai)/i.test(joined)) return "it";
  return "other";
}

function buildPublicCardFromProfile({ slug, user, profileCard, viewsCount }) {
  const plan = getEffectivePlan(user).plan;
  return {
    slug,
    avatarUrl: profileCard.avatarUrl || user?.photoUrl || null,
    name: profileCard.name,
    verified: Boolean(user?.isVerified),
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

    const referrer = await findUserByRefCodeWithLegacyFallback(refCode);

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
    const user = await findUserByTelegramIdWithLegacyFallback(sessionUser.telegramId);

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
  "/directory",
  asyncHandler(async (req, res) => {
    const directorySettings = await getFeatureSetting("directory");
    if (!directorySettings.enabled) {
      res.status(404).render("public/not-found", {
        title: "Страница не найдена",
        slug: "directory",
        adminSession: getAdminSession(req),
      });
      return;
    }

    const q = String(req.query.q || "").trim().slice(0, 80);
    const sector = String(req.query.sector || "all").trim().toLowerCase();
    const sort = ["score", "date", "views"].includes(String(req.query.sort || "")) ? String(req.query.sort) : "score";
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 24;

    const exclusions = prisma.directoryExclusion
      ? await prisma.directoryExclusion.findMany({ select: { slug: true } })
      : [];
    const excludedSlugs = exclusions.map((row) => row.slug);

    const where = {
      status: "active",
      ownerTelegramId: { not: null },
      owner: {
        status: "active",
        showInDirectory: true,
      },
      ...(excludedSlugs.length ? { fullSlug: { notIn: excludedSlugs } } : {}),
    };

    const rows = await prisma.slug.findMany({
      where,
      orderBy:
        sort === "views"
          ? [{ analyticsViewsCount: "desc" }, { updatedAt: "desc" }]
          : sort === "date"
            ? [{ createdAt: "desc" }]
            : [{ updatedAt: "desc" }],
      include: {
        owner: {
          select: {
            telegramId: true,
            firstName: true,
            displayName: true,
            photoUrl: true,
            isVerified: true,
            verifiedCompany: true,
            unqScore: {
              select: {
                score: true,
                percentile: true,
              },
            },
            profileCard: {
              select: {
                name: true,
                role: true,
                bio: true,
                tags: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      take: 500,
    });

    const prepared = rows
      .map((row) => {
        const owner = row.owner;
        if (!owner) return null;
        const tags = Array.isArray(owner.profileCard?.tags) ? owner.profileCard.tags : [];
        const name = owner.displayName || owner.profileCard?.name || owner.firstName || "UNQ+ User";
        return {
          slug: row.fullSlug,
          name,
          role: owner.profileCard?.role || "",
          bio: owner.profileCard?.bio || "",
          tags: tags.map((tag) => String(tag || "").trim()).filter(Boolean),
          avatarUrl: owner.profileCard?.avatarUrl || owner.photoUrl || null,
          isVerified: Boolean(owner.isVerified),
          verifiedCompany: owner.verifiedCompany || "",
          score: Number(owner.unqScore?.score || 0),
          topPercent: Math.max(1, Math.round(Number(owner.unqScore?.percentile ? 100 - owner.unqScore.percentile : 100))),
          views: Number(row.analyticsViewsCount || 0),
          createdAt: row.createdAt,
          sector: classifySectorFromTags(tags),
        };
      })
      .filter(Boolean)
      .filter((item) => {
        if (sector !== "all" && item.sector !== sector) return false;
        if (!q) return true;
        const hay = [item.name, item.role, item.bio, item.slug, item.tags.join(" ")].join(" ").toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => {
        if (sort === "views") return b.views - a.views;
        if (sort === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return b.score - a.score;
      });

    const total = prepared.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const items = prepared.slice((safePage - 1) * pageSize, safePage * pageSize);

    res.render("public/directory", {
      title: "UNQ Directory",
      description: "Публичный каталог визиток UNQ+",
      items,
      pagination: { page: safePage, totalPages, total },
      filters: { q, sector, sort },
      noindex: false,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/qr/:slug",
  asyncHandler(async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const slugRow = await findSlugByFullSlugWithLegacyFallback(slug);
    if (!slugRow || !["active", "private"].includes(slugRow.status) || !slugRow.ownerTelegramId) {
      res.status(404).render("public/not-found", {
        title: "Визитка не найдена",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    const [owner, profileCard, score] = await Promise.all([
      findUserByTelegramIdWithLegacyFallback(slugRow.ownerTelegramId),
      prisma.profileCard.findUnique({
        where: { ownerTelegramId: slugRow.ownerTelegramId },
        select: { name: true, role: true },
      }),
      getPublicScoreForSlug({ slug, viewerTelegramId: null }),
    ]);

    if (!owner || owner.status !== "active") {
      res.status(200).render("public/qr", {
        title: `QR ${slug}`,
        slug,
        unavailable: true,
        adminSession: getAdminSession(req),
      });
      return;
    }

    res.render("public/qr", {
      title: `QR ${slug}`,
      slug,
      url: `${env.BASE_URL.replace(/\/$/, "")}/${slug}`,
      ownerName: profileCard?.name || owner.displayName || owner.firstName || "UNQ+ User",
      ownerRole: profileCard?.role || "",
      score: score ? Number(score.score || 0) : 0,
      unavailable: false,
      noindex: slugRow.status === "private",
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
            ? await findUserByTelegramIdWithLegacyFallback(slugRow.ownerTelegramId)
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
          findUserByTelegramIdWithLegacyFallback(slugRow.ownerTelegramId),
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

