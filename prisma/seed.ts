import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const card = await prisma.card.upsert({
    where: { slug: "AAA001" },
    update: {
      isActive: true,
      avatarUrl: null,
      name: "Shukhrat Isroilov",
      phone: "+998 33 333 13 37",
      verified: true,
      hashtag: "#UnqPower2026",
      address: "Farghona, Mustaqillik 13",
      postcode: "150100",
      email: "unq@uz.com",
      extraPhone: "+998200001360",
    },
    create: {
      slug: "AAA001",
      isActive: true,
      name: "Shukhrat Isroilov",
      phone: "+998 33 333 13 37",
      verified: true,
      hashtag: "#UnqPower2026",
      address: "Farghona, Mustaqillik 13",
      postcode: "150100",
      email: "unq@uz.com",
      extraPhone: "+998200001360",
    },
  });

  await prisma.tag.deleteMany({ where: { cardId: card.id } });
  await prisma.button.deleteMany({ where: { cardId: card.id } });
  await prisma.viewLog.deleteMany({ where: { cardId: card.id } });

  await prisma.tag.createMany({
    data: [
      { cardId: card.id, label: "*Top Dawg", url: "https://t.me", sortOrder: 0 },
      { cardId: card.id, label: "ALBLAK 52", url: "https://instagram.com", sortOrder: 1 },
      { cardId: card.id, label: "ICEGERGERT", url: null, sortOrder: 2 },
    ],
  });

  await prisma.button.createMany({
    data: [
      { cardId: card.id, label: "TELEGRAM", url: "https://t.me", sortOrder: 0, isActive: true },
      { cardId: card.id, label: "INSTAGRAM", url: "https://instagram.com", sortOrder: 1, isActive: true },
      { cardId: card.id, label: "CLICK", url: "https://click.uz", sortOrder: 2, isActive: true },
      { cardId: card.id, label: "STEAM TRADE", url: "https://steamcommunity.com", sortOrder: 3, isActive: true },
    ],
  });

  const now = new Date();
  const logs = Array.from({ length: 20 }, (_, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (idx % 10));
    d.setHours(9 + (idx % 8), (idx * 7) % 60, 0, 0);
    const day = d.toISOString().slice(0, 10);
    const ip = `192.168.0.${(idx % 6) + 1}`;
    const ipHash = createHash("sha256").update(`${ip}|${card.slug}|${day}`).digest("hex");
    const isUnique = idx < 10;

    return {
      cardId: card.id,
      viewedAt: d,
      device: idx % 3 === 0 ? "desktop" : "mobile",
      ipHash,
      isUnique,
    };
  });

  await prisma.viewLog.createMany({ data: logs });
  await prisma.card.update({
    where: { id: card.id },
    data: {
      viewsCount: logs.length,
      uniqueViewsCount: logs.filter((item) => item.isUnique).length,
    },
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
