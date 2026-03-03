const { prisma } = require("../db/prisma");

let started = false;

const DEFAULT_TESTIMONIALS = [
  {
    name: "Алишер",
    slug: "ALI001",
    tariff: "premium",
    text: "Раздаю браслет на каждой встрече — люди реагируют как на магию. Визитку обновил уже три раза, браслет работает как часы.",
    sortOrder: 0,
  },
  {
    name: "Малика",
    slug: "MLK007",
    tariff: "basic",
    text: "Поставила ссылку в Instagram bio и на визитке. Очень удобно что всё в одном месте и можно менять.",
    sortOrder: 1,
  },
  {
    name: "Тимур",
    slug: "TMR000",
    tariff: "premium",
    text: "Взял для всей команды. Отдельный slug каждому сотруднику — выглядит профессионально на переговорах.",
    sortOrder: 2,
  },
];

async function seedTestimonials() {
  for (const item of DEFAULT_TESTIMONIALS) {
    const existing = await prisma.testimonial.findFirst({
      where: { slug: item.slug, name: item.name },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.testimonial.create({
      data: {
        name: item.name,
        slug: item.slug,
        tariff: item.tariff,
        text: item.text,
        isVisible: true,
        sortOrder: item.sortOrder,
      },
    });
  }
}

async function backfillSlugRecords() {
  const cards = await prisma.card.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      createdAt: true,
    },
  });

  for (const card of cards) {
    await prisma.slugRecord.upsert({
      where: { slug: card.slug },
      create: {
        slug: card.slug,
        state: "TAKEN",
        ownerName: card.name,
        cardId: card.id,
        activationDate: card.createdAt,
      },
      update: {
        state: "TAKEN",
        ownerName: card.name,
        cardId: card.id,
        activationDate: card.createdAt,
      },
    });
  }
}

async function runBootstrapTasks() {
  if (started) {
    return;
  }
  started = true;

  try {
    await seedTestimonials();
    await backfillSlugRecords();
  } catch (error) {
    console.error("[express-app] bootstrap tasks failed", error);
  }
}

module.exports = {
  runBootstrapTasks,
};
