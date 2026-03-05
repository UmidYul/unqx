const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { getAdminSession, requireVerifiedUserPage, getUserSession } = require("../../middleware/auth");
const { getEffectivePlan } = require("../../services/profile");
const { absoluteUrl } = require("../../utils/url");
const { buildLeaderboard, normalizePeriod, getSlugTopBadge, getUserLeaderboardSummary } = require("../../services/leaderboard");
const { getFeatureSetting } = require("../../services/feature-settings");
const { getActiveFlashSale, resolveConditionLabel, getFlashSaleSlotsLeft } = require("../../services/flash-sales");
const { normalizeRefCode } = require("../../services/referrals");
const { getPricingSettings } = require("../../services/pricing-settings");
const { getManySettings } = require("../../services/platform-settings");
const { seoHub, getSeoPage } = require("../../content/seo-pages");

const router = express.Router();
const defaultSocialImage = absoluteUrl("/brand/logo.PNG");

function buildBreadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildFaqJsonLd(faqs) {
  if (!Array.isArray(faqs) || !faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

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

async function findUserByTelegramIdWithLegacyFallback(userId) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        username: true,
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
        id,
        first_name AS "firstName",
        username
      FROM users
      WHERE id = ${userId}
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
        price: true,
        ownerId: true,
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
        price,
        owner_id AS "ownerId",
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

async function findProfileCardByOwnerId(ownerId) {
  if (!ownerId) return null;
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      owner_id AS "ownerId",
      name,
      role,
      bio,
      email,
      avatar_url AS "avatarUrl",
      tags,
      buttons,
      theme,
      custom_color AS "customColor",
      show_branding AS "showBranding",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM profile_cards
    WHERE owner_id = ${ownerId}
    LIMIT 1
  `;
  return Array.isArray(rows) ? rows[0] || null : null;
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
    slugPrice: Number.isFinite(Number(profileCard.slugPrice)) ? Number(profileCard.slugPrice) : null,
    avatarUrl: profileCard.avatarUrl || null,
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
    const [leaderboardSettings, activeFlashSale, nextDrop, pricing, publicSettingsRaw] = await Promise.all([
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
      getManySettings([
        "platform_name",
        "platform_tagline",
        "platform_hero_subtitle",
        "platform_total_slugs",
        "pricing_footnote",
        "pricing_section_visible",
        "plan_basic_name",
        "plan_premium_name",
        "plan_basic_features",
        "plan_premium_features",
        "plan_premium_popular_badge",
        "bracelet_name",
        "bracelet_price",
        "bracelet_in_stock",
        "bracelet_cta_text",
        "bracelet_features",
        "bracelet_description",
        "bracelet_note",
        "contact_support_telegram",
        "contact_phone",
        "contact_response_time",
        "contact_error_fallback",
        "pending_expiry_hours",
      ]),
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
      title: "UNQX | Цифровая визитка за 1 минуту",
      description: "Одна ссылка вместо тысячи слов. Создай свою цифровую визитку на unqx.uz",
      image: defaultSocialImage,
      testimonials,
      slugTotalLimit: Number(publicSettingsRaw.platform_total_slugs || env.SLUG_TOTAL_LIMIT),
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
      publicSettings: publicSettingsRaw,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/login",
  asyncHandler(async (req, res) => {
    if (getUserSession(req)?.userId) {
      res.redirect("/profile");
      return;
    }
    res.render("public/login", {
      title: "Вход | UNQX",
      description: "Войди в UNQX по email и паролю",
      image: defaultSocialImage,
      next: typeof req.query.next === "string" ? req.query.next : "/profile",
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/register",
  asyncHandler(async (req, res) => {
    if (getUserSession(req)?.userId) {
      res.redirect("/profile");
      return;
    }
    res.render("public/register", {
      title: "Регистрация | UNQX",
      description: "Создай аккаунт UNQX",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    res.render("public/verify-email", {
      title: "Подтверждение email | UNQX",
      description: "Подтверди email и заверши регистрацию",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    res.render("public/forgot-password", {
      title: "Сброс пароля | UNQX",
      description: "Запрос кода для сброса пароля",
      image: defaultSocialImage,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/reset-password",
  asyncHandler(async (req, res) => {
    res.render("public/reset-password", {
      title: "Новый пароль | UNQX",
      description: "Установи новый пароль",
      image: defaultSocialImage,
      email: typeof req.query.email === "string" ? req.query.email : "",
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
      title: "Вас пригласили в UNQX",
      description: "Зарегистрируйтесь в UNQX и получите доступ к цифровой визитке по приглашению.",
      image: defaultSocialImage,
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
      title: "Темы Премиум | UNQX",
      description: "Каталог премиум-тем UNQX: выбери стиль визитки, цвета и оформление под свой бренд.",
      image: defaultSocialImage,
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
      title: "UNQX Demo",
      description: "Демо цифровой визитки UNQX: посмотри как выглядит карточка до покупки и настройки профиля.",
      image: defaultSocialImage,
      theme,
      embed,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/profile",
  requireVerifiedUserPage,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    const user = sessionUser?.userId ? await findUserByTelegramIdWithLegacyFallback(sessionUser.userId) : null;

    if (!user || user.status === "blocked" || user.status === "deactivated") {
      res.redirect("/login");
      return;
    }

    res.render("public/profile", {
      title: "Мой профиль | UNQX",
      description: "Личный кабинет UNQX: управляй визиткой, UNQ, аналитикой, заявками и настройками профиля.",
      image: defaultSocialImage,
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
        if (!user?.userId) return Promise.resolve(null);
        return getUserLeaderboardSummary({
          userId: user.userId,
          period,
        });
      })(),
    ]);

    res.render("public/leaderboard", {
      title: "Топ визиток недели · UNQX",
      description: "Топ визиток UNQX по UNQ Score",
      image: defaultSocialImage,
      period: board.period,
      items: board.publicItems,
      viewerTelegramId: getUserSession(req)?.userId || "",
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
      title: "Дропы slug · UNQX",
      description: "Актуальные и прошедшие дропы slug на UNQX",
      image: defaultSocialImage,
      drops: rows,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/guides",
  asyncHandler(async (req, res) => {
    const canonical = absoluteUrl("/guides");
    const hubJsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: seoHub.heading,
        description: seoHub.description,
        url: canonical,
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Гайды", url: canonical },
      ]),
    ];

    res.render("public/seo-hub", {
      title: seoHub.title,
      description: seoHub.description,
      heading: seoHub.heading,
      lead: seoHub.lead,
      cards: seoHub.cards,
      image: defaultSocialImage,
      jsonLd: hubJsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/faq",
  asyncHandler(async (req, res) => {
    const page = getSeoPage("faq");
    const canonical = absoluteUrl("/faq");
    if (!page) {
      res.redirect("/guides");
      return;
    }

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.heading,
        description: page.description,
        mainEntityOfPage: canonical,
        dateModified: page.updatedAt,
        author: {
          "@type": "Organization",
          name: "UNQX",
        },
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "FAQ", url: canonical },
      ]),
      buildFaqJsonLd(page.faqs),
    ].filter(Boolean);

    res.render("public/seo-page", {
      title: page.title,
      description: page.description,
      heading: page.heading,
      lead: page.lead,
      sections: page.sections,
      faqs: page.faqs,
      readingMinutes: page.readingMinutes,
      updatedAt: page.updatedAt,
      image: defaultSocialImage,
      jsonLd,
      adminSession: getAdminSession(req),
    });
  }),
);

router.get(
  "/guides/:slug",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const page = getSeoPage(slug);
    if (!page) {
      res.status(404).render("public/not-found", {
        title: "Гайд не найден",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    const canonical = absoluteUrl(`/guides/${slug}`);
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.heading,
        description: page.description,
        mainEntityOfPage: canonical,
        dateModified: page.updatedAt,
        author: {
          "@type": "Organization",
          name: "UNQX",
        },
      },
      buildBreadcrumbJsonLd([
        { name: "Главная", url: absoluteUrl("/") },
        { name: "Гайды", url: absoluteUrl("/guides") },
        { name: page.heading, url: canonical },
      ]),
      buildFaqJsonLd(page.faqs),
    ].filter(Boolean);

    res.render("public/seo-page", {
      title: page.title,
      description: page.description,
      heading: page.heading,
      lead: page.lead,
      sections: page.sections,
      faqs: page.faqs,
      readingMinutes: page.readingMinutes,
      updatedAt: page.updatedAt,
      image: defaultSocialImage,
      jsonLd,
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
            id: true,
            firstName: true,
            displayName: true,
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
        const name = owner.displayName || owner.profileCard?.name || owner.firstName || "UNQX User";
        return {
          slug: row.fullSlug,
          name,
          role: owner.profileCard?.role || "",
          bio: owner.profileCard?.bio || "",
          tags: tags.map((tag) => String(tag || "").trim()).filter(Boolean),
          avatarUrl: owner.profileCard?.avatarUrl || null,
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
      description: "Публичный каталог визиток UNQX",
      image: defaultSocialImage,
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
    if (!slugRow || !["active", "private"].includes(slugRow.status) || !slugRow.ownerId) {
      res.status(404).render("public/not-found", {
        title: "Визитка не найдена",
        slug,
        adminSession: getAdminSession(req),
      });
      return;
    }

    const [owner, profileCard] = await Promise.all([
      findUserByTelegramIdWithLegacyFallback(slugRow.ownerId),
      findProfileCardByOwnerId(slugRow.ownerId),
    ]);

    if (!owner || owner.status !== "active") {
      res.status(200).render("public/qr", {
        title: `QR ${slug}`,
        description: `QR-визитка UNQ ${slug} временно недоступна.`,
        image: defaultSocialImage,
        slug,
        unavailable: true,
        adminSession: getAdminSession(req),
      });
      return;
    }

    res.render("public/qr", {
      title: `QR ${slug}`,
      description: `QR-визитка UNQ ${slug}. Открой цифровую карточку владельца по ссылке и поделись за секунду.`,
      slug,
      image: defaultSocialImage,
      url: absoluteUrl(`/${slug}`),
      ownerName: profileCard?.name || owner.displayName || owner.firstName || "UNQX User",
      ownerRole: profileCard?.role || "",
      score: 0,
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
          : slugRow.ownerId
            ? await findUserByTelegramIdWithLegacyFallback(slugRow.ownerId)
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
        const profileCard = slugRow.ownerId
          ? await findProfileCardByOwnerId(slugRow.ownerId)
          : null;
        const primarySocial =
          profileCard && Array.isArray(profileCard.buttons)
            ? mapProfileButtons(profileCard.buttons)[0] || null
            : null;

        res.status(200).render("public/slug-paused", {
          title: `${slug} | Пауза`,
          slug,
          ownerName: owner?.displayName || owner?.firstName || "UNQX User",
          ownerUsername: owner?.username ? `@${owner.username}` : "",
          ownerAvatar: profileCard?.avatarUrl || "",
          pauseMessage: slugRow.pauseMessage || "Скоро вернусь · Пишите в Telegram",
          primarySocial,
          noindex: true,
          adminSession: getAdminSession(req),
        });
        return;
      }

      if (slugRow.status === "approved" || slugRow.status === "active" || slugRow.status === "private") {
        if (!slugRow.ownerId) {
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
          findUserByTelegramIdWithLegacyFallback(slugRow.ownerId),
          findProfileCardByOwnerId(slugRow.ownerId),
          prisma.analyticsView
            ? prisma.analyticsView
              .findMany({
                where: { slug },
                select: { sessionId: true },
              })
              .then((rows) => new Set(rows.map((row) => row.sessionId)).size)
            : Promise.resolve(0),
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
          profileCard: {
            ...profileCard,
            slugPrice: typeof slugRow.price === "number" ? slugRow.price : null,
          },
          viewsCount: views,
        });
        const image = card.avatarUrl ? absoluteUrl(card.avatarUrl) : absoluteUrl("/brand/logo.PNG");
        const score = null;

        const topBadge = await getSlugTopBadge(slug);
        res.render("public/card", {
          title: `${card.name} | UNQX`,
          description: `Цифровая визитка ${card.name} на UNQX: контакты, соцсети, QR и быстрый обмен ссылкой.`,
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
  }),
);

module.exports = {
  publicPagesRouter: router,
};

