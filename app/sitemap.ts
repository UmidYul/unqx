import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cards = await prisma.card.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  });

  return cards.map((card) => ({
    url: `https://unqx.uz/${card.slug}`,
    lastModified: card.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}
