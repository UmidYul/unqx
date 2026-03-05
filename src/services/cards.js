const { prisma } = require("../db/prisma");
const { compareSlugs, getNextSlug, isValidSlug } = require("./slug");

function legacyCardsError() {
  const error = new Error("Legacy cards API is deprecated");
  error.code = "LEGACY_CARDS_DEPRECATED";
  return error;
}

async function getPublicCardBySlug() {
  return null;
}

async function listCards(options = {}) {
  const pageSize = options.pageSize ?? 20;
  const page = Math.max(1, options.page ?? 1);
  return {
    items: [],
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 1,
    },
  };
}

async function getCardDetailsById() {
  return null;
}

async function createCard() {
  throw legacyCardsError();
}

async function updateCard() {
  throw legacyCardsError();
}

async function generateNextSlug() {
  const slugs = await prisma.slug.findMany({
    select: { fullSlug: true },
  });
  const max =
    slugs
      .map((item) => item.fullSlug)
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

