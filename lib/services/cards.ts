import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { compareSlugs, getNextSlug, isValidSlug } from "@/lib/slug";
import type { CardFormInput } from "@/types/card";

export async function getPublicCardBySlug(slug: string) {
  return prisma.card.findUnique({
    where: { slug },
    include: {
      tags: { orderBy: { sortOrder: "asc" } },
      buttons: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export interface ListCardsOptions {
  query?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
}

export async function listCards(options: ListCardsOptions = {}) {
  const pageSize = options.pageSize ?? 20;
  const page = Math.max(1, options.page ?? 1);
  const status = options.status ?? "all";
  const query = options.query?.trim();

  const where: Prisma.CardWhereInput = {};

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

export async function getCardDetailsById(id: string) {
  return prisma.card.findUnique({
    where: { id },
    include: {
      tags: { orderBy: { sortOrder: "asc" } },
      buttons: { orderBy: { sortOrder: "asc" } },
    },
  });
}

function normalizeTags(input: CardFormInput) {
  return input.tags.map((tag, index) => ({
    label: tag.label.trim(),
    url: tag.url?.trim() || null,
    sortOrder: index,
  }));
}

function normalizeButtons(input: CardFormInput) {
  return input.buttons.map((button, index) => ({
    label: button.label.trim(),
    url: button.url.trim(),
    isActive: button.isActive,
    sortOrder: index,
  }));
}

export async function createCard(input: CardFormInput) {
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

export async function updateCard(id: string, input: CardFormInput) {
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

export async function generateNextSlug() {
  const slugs = await prisma.card.findMany({
    select: { slug: true },
  });

  const max = slugs
    .map((item) => item.slug)
    .filter(isValidSlug)
    .sort(compareSlugs)
    .pop() ?? null;

  return getNextSlug(max);
}
