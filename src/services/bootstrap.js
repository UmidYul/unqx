const { prisma } = require("../db/prisma");
const { ensurePlatformSettingsSeeded } = require("./platform-settings");
const { ensureTelegramWebhook } = require("./telegram-webhook");

let started = false;

function parseBoolean(value) {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

const shouldSeedTestimonialsOnBoot = parseBoolean(process.env.SEED_TESTIMONIALS_ON_BOOT);

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
    text: "Раздаю браслет на каждой встрече - люди реагируют как на магию. Визитку обновил уже три раза, браслет работает как часы.",
    sortOrder: 0,
  },
  {
    name: "Малика",
    slug: "MLK007",
    tariff: "premium",
    text: "Поставила ссылку в Instagram bio и на визитке. Очень удобно что всё в одном месте и можно менять.",
    sortOrder: 1,
  },
  {
    name: "Тимур",
    slug: "TMR000",
    tariff: "premium",
    text: "Взял для всей команды. Отдельный slug каждому сотруднику - выглядит профессионально на переговорах.",
    sortOrder: 2,
  },
];

async function seedTestimonials() {
  try {
    const existingCount = await prisma.testimonial.count();
    if (existingCount > 0) {
      return;
    }

    for (const item of DEFAULT_TESTIMONIALS) {
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

async function runBootstrapTasks() {
  if (started) {
    return;
  }
  started = true;

  try {
    await ensurePlatformSettingsSeeded();
    try {
      await ensureTelegramWebhook();
    } catch (error) {
      console.error("[express-app] failed to ensure telegram webhook", error);
    }

    const [testimonialsReady] = await Promise.all([
      hasTable("testimonials"),
    ]);

    if (testimonialsReady && shouldSeedTestimonialsOnBoot) {
      await seedTestimonials();
    } else if (!testimonialsReady) {
      console.warn("[express-app] skip testimonial seed: testimonials table is not migrated yet");
    }

  } catch (error) {
    console.error("[express-app] bootstrap tasks failed", error);
  }
}

module.exports = {
  runBootstrapTasks,
};
