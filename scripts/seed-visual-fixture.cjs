const { subDays, addHours } = require("date-fns");

const { prisma } = require("../src/db/prisma");

async function upsertCard(definition) {
  const card = await prisma.card.upsert({
    where: { slug: definition.slug },
    create: {
      slug: definition.slug,
      isActive: definition.isActive,
      avatarUrl: definition.avatarUrl || null,
      name: definition.name,
      phone: definition.phone,
      verified: Boolean(definition.verified),
      hashtag: definition.hashtag || null,
      address: definition.address || null,
      postcode: definition.postcode || null,
      email: definition.email || null,
      extraPhone: definition.extraPhone || null,
      viewsCount: 0,
      uniqueViewsCount: 0,
    },
    update: {
      isActive: definition.isActive,
      avatarUrl: definition.avatarUrl || null,
      name: definition.name,
      phone: definition.phone,
      verified: Boolean(definition.verified),
      hashtag: definition.hashtag || null,
      address: definition.address || null,
      postcode: definition.postcode || null,
      email: definition.email || null,
      extraPhone: definition.extraPhone || null,
    },
  });

  await prisma.tag.deleteMany({ where: { cardId: card.id } });
  await prisma.button.deleteMany({ where: { cardId: card.id } });

  if (definition.tags.length) {
    await prisma.tag.createMany({
      data: definition.tags.map((tag, index) => ({
        cardId: card.id,
        label: tag.label,
        url: tag.url || null,
        sortOrder: index,
      })),
    });
  }

  if (definition.buttons.length) {
    await prisma.button.createMany({
      data: definition.buttons.map((button, index) => ({
        cardId: card.id,
        label: button.label,
        url: button.url,
        isActive: button.isActive !== false,
        sortOrder: index,
      })),
    });
  }

  return card;
}

async function seedViews(cardId, seedBase) {
  await prisma.viewLog.deleteMany({ where: { cardId } });

  const rows = [];
  let totalViews = 0;
  let totalUniqueViews = 0;

  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const day = subDays(new Date(), dayOffset);
    const totalForDay = ((seedBase + dayOffset * 3) % 8) + 3;
    const uniqueForDay = Math.max(1, totalForDay - ((dayOffset + seedBase) % 3));

    for (let i = 0; i < totalForDay; i += 1) {
      const viewedAt = addHours(day, 8 + (i % 12));
      const isUnique = i < uniqueForDay;

      rows.push({
        cardId,
        viewedAt,
        device: i % 2 === 0 ? "mobile" : "desktop",
        ipHash: `visual-${cardId}-${dayOffset}-${i < uniqueForDay ? i : i % uniqueForDay}`,
        isUnique,
      });

      totalViews += 1;
      if (isUnique) {
        totalUniqueViews += 1;
      }
    }
  }

  if (rows.length) {
    await prisma.viewLog.createMany({ data: rows });
  }

  await prisma.card.update({
    where: { id: cardId },
    data: {
      viewsCount: totalViews,
      uniqueViewsCount: totalUniqueViews,
    },
  });
}

async function createDemoCard(slug, index) {
  const card = await upsertCard({
    slug,
    isActive: index % 2 === 0,
    avatarUrl: null,
    name: `Demo User ${index}`,
    phone: `+998 90 000 0${index} ${index}`,
    verified: false,
    hashtag: `#DEMO${index}`,
    address: "Tashkent",
    postcode: `10${index}`,
    email: `demo${index}@unqx.uz`,
    extraPhone: "",
    tags: [
      { label: `Tag ${index}`, url: "" },
      { label: "UNQX", url: "https://unqx.uz" },
    ],
    buttons: [
      { label: "WEBSITE", url: "https://unqx.uz", isActive: true },
      { label: "TELEGRAM", url: "https://t.me/unqx", isActive: true },
    ],
  });

  await seedViews(card.id, index + 5);
}

async function seedVisualFixture() {
  const active = await upsertCard({
    slug: "AAA001",
    isActive: true,
    avatarUrl: "/brand/unq-mark.svg",
    name: "UNQ Platform",
    phone: "+998 90 123 45 67",
    verified: true,
    hashtag: "#UNQPLUS",
    address: "Tashkent city, Uzbekistan",
    postcode: "100000",
    email: "hello@unqx.uz",
    extraPhone: "+998 71 123 45 67",
    tags: [
      { label: "Top Dawg", url: "https://t.me/unqx" },
      { label: "Producer", url: "" },
      { label: "UNQX Team", url: "https://unqx.uz" },
    ],
    buttons: [
      { label: "TELEGRAM", url: "https://t.me/unqx", isActive: true },
      { label: "INSTAGRAM", url: "https://instagram.com/unqx", isActive: true },
      { label: "WEBSITE", url: "https://unqx.uz", isActive: true },
    ],
  });

  const inactive = await upsertCard({
    slug: "AAA002",
    isActive: false,
    avatarUrl: null,
    name: "UNQ Archived",
    phone: "+998 90 765 43 21",
    verified: false,
    hashtag: "",
    address: "Tashkent",
    postcode: "100001",
    email: "archive@unqx.uz",
    extraPhone: "",
    tags: [
      { label: "Unavailable", url: "" },
      { label: "Support", url: "https://t.me/unqx" },
    ],
    buttons: [
      { label: "SUPPORT", url: "https://t.me/unqx", isActive: true },
    ],
  });

  await seedViews(active.id, 1);
  await seedViews(inactive.id, 2);

  for (let index = 3; index <= 8; index += 1) {
    await createDemoCard(`AAA00${index}`, index);
  }

  await prisma.errorLog.deleteMany({ where: { path: { startsWith: "/__visual" } } });

  await prisma.errorLog.createMany({
    data: [
      {
        type: "not_found",
        path: "/__visual/not-found",
        message: "Visual check 404",
        userAgent: "visual-checker",
        occurredAt: subDays(new Date(), 1),
      },
      {
        type: "server_error",
        path: "/__visual/error",
        message: "Visual check 500",
        userAgent: "visual-checker",
        occurredAt: subDays(new Date(), 2),
      },
      {
        type: "not_found",
        path: "/__visual/missing",
        message: "Visual check missing",
        userAgent: "visual-checker",
        occurredAt: subDays(new Date(), 5),
      },
    ],
  });

  console.log("[seed:visual] ready: AAA001 active, AAA002 inactive, demo cards and logs created");
}

seedVisualFixture()
  .catch((error) => {
    console.error("[seed:visual] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
