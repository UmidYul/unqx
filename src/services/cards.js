const { prisma } = require("../db/prisma");
const { compareSlugs, getNextSlug, isValidSlug } = require("./slug");

async function getPublicCardBySlug(slug) {
  const card = await prisma.card.findUnique({
    where: { slug },
  });

  if (!card) {
    return null;
  }

  const [tags, buttons] = await Promise.all([
    prisma.tag.findMany({
      where: { cardId: card.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.button.findMany({
      where: {
        cardId: card.id,
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return {
    ...card,
    tags,
    buttons,
  };
}

async function listCards(options = {}) {
  const pageSize = options.pageSize ?? 20;
  const page = Math.max(1, options.page ?? 1);
  const status = options.status ?? "all";
  const query = options.query ? options.query.trim() : undefined;

  const where = {};

  if (status === "active") {
    where.isActive = true;
  }

  if (status === "inactive") {
    where.isActive = false;
  }

  if (query) {
    where.OR = [
      { slug: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.card.count({ where }),
    prisma.card.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        viewsCount: true,
        uniqueViewsCount: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function getCardDetailsById(id) {
  return prisma.card.findUnique({
    where: { id },
    include: {
      tags: { orderBy: { sortOrder: "asc" } },
      buttons: { orderBy: { sortOrder: "asc" } },
    },
  });
}

function normalizeTags(input) {
  return (input.tags || []).map((tag, index) => ({
    label: tag.label.trim(),
    url: tag.url ? tag.url.trim() : null,
    sortOrder: index,
  }));
}

function normalizeButtons(input) {
  return (input.buttons || []).map((button, index) => ({
    label: button.label.trim(),
    url: button.url.trim(),
    isActive: button.isActive,
    sortOrder: index,
  }));
}

async function createCard(input) {
  const tags = normalizeTags(input);
  const buttons = normalizeButtons(input);

  return prisma.card.create({
    data: {
      slug: input.slug,
      isActive: input.isActive,
      name: input.name,
      phone: input.phone,
      verified: input.verified,
      hashtag: input.hashtag ?? null,
      address: input.address ?? null,
      postcode: input.postcode ?? null,
      email: input.email ?? null,
      extraPhone: input.extraPhone ?? null,
      tags: {
        createMany: {
          data: tags,
        },
      },
      buttons: {
        createMany: {
          data: buttons,
        },
      },
    },
    include: {
      tags: { orderBy: { sortOrder: "asc" } },
      buttons: { orderBy: { sortOrder: "asc" } },
    },
  });
}

async function updateCard(id, input) {
  const tags = normalizeTags(input);
  const buttons = normalizeButtons(input);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.card.update({
      where: { id },
      data: {
        slug: input.slug,
        isActive: input.isActive,
        name: input.name,
        phone: input.phone,
        verified: input.verified,
        hashtag: input.hashtag ?? null,
        address: input.address ?? null,
        postcode: input.postcode ?? null,
        email: input.email ?? null,
        extraPhone: input.extraPhone ?? null,
      },
    });

    await tx.tag.deleteMany({ where: { cardId: id } });
    await tx.button.deleteMany({ where: { cardId: id } });

    if (tags.length > 0) {
      await tx.tag.createMany({
        data: tags.map((tag) => ({ ...tag, cardId: id })),
      });
    }

    if (buttons.length > 0) {
      await tx.button.createMany({
        data: buttons.map((button) => ({ ...button, cardId: id })),
      });
    }

    return updated;
  });
}

async function generateNextSlug() {
  const slugs = await prisma.card.findMany({
    select: { slug: true },
  });

  const max =
    slugs
      .map((item) => item.slug)
      .filter(isValidSlug)
      .sort(compareSlugs)
      .pop() ?? null;

  return getNextSlug(max);
}

module.exports = {
  getPublicCardBySlug,
  listCards,
  getCardDetailsById,
  createCard,
  updateCard,
  generateNextSlug,
};
