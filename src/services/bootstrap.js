const { prisma } = require("../db/prisma");

let started = false;

function isMissingModelTable(error, modelName) {
  return (
    Boolean(error) &&
    error.code === "P2021" &&
    (!modelName || String(error?.meta?.modelName || "") === modelName)
  );
}

async function hasTable(tableName) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT to_regclass($1)::text AS table_ref",
      `public.${tableName}`,
    );
    const value = Array.isArray(rows) && rows.length > 0 ? rows[0].table_ref : null;
    return Boolean(value);
  } catch (error) {
    console.warn(`[express-app] failed to check table existence for ${tableName}`, error);
    return false;
  }
}

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
  try {
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
  } catch (error) {
    if (isMissingModelTable(error, "Testimonial")) {
      console.warn("[express-app] skip testimonial seed: testimonials table is not migrated yet");
      return;
    }
    throw error;
  }
}

async function backfillSlugRecords() {
  try {
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
  } catch (error) {
    if (isMissingModelTable(error, "SlugRecord")) {
      console.warn("[express-app] skip slug backfill: slug_records table is not migrated yet");
      return;
    }
    throw error;
  }
}

async function runBootstrapTasks() {
  if (started) {
    return;
  }
  started = true;

  try {
    const [testimonialsReady, slugRecordsReady] = await Promise.all([
      hasTable("testimonials"),
      hasTable("slug_records"),
    ]);

    if (testimonialsReady) {
      await seedTestimonials();
    } else {
      console.warn("[express-app] skip testimonial seed: testimonials table is not migrated yet");
    }

    if (slugRecordsReady) {
      await backfillSlugRecords();
    } else {
      console.warn("[express-app] skip slug backfill: slug_records table is not migrated yet");
    }
  } catch (error) {
    console.error("[express-app] bootstrap tasks failed", error);
  }
}

module.exports = {
  runBootstrapTasks,
};
