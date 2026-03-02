import { prisma } from "@/lib/prisma";
import { detectDevice } from "@/lib/ua";
import { createHash } from "crypto";

export const runtime = "nodejs";

interface Context {
  params: {
    slug: string;
  };
}

export async function POST(request: Request, { params }: Context) {
  const card = await prisma.card.findUnique({
    where: { slug: params.slug },
    select: { id: true, isActive: true },
  });

  if (!card || !card.isActive) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  const device = detectDevice(request.headers.get("user-agent"));
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || null;
  const dateKey = new Date().toISOString().slice(0, 10);
  const ipHash = ip ? createHash("sha256").update(`${ip}|${params.slug}|${dateKey}`).digest("hex") : null;
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    let isUnique = false;

    if (ipHash) {
      const existing = await tx.viewLog.findFirst({
        where: {
          cardId: card.id,
          ipHash,
          viewedAt: { gte: dayStart },
        },
        select: { id: true },
      });
      isUnique = !existing;
    }

    await tx.card.update({
      where: { id: card.id },
      data: {
        viewsCount: { increment: 1 },
        ...(isUnique ? { uniqueViewsCount: { increment: 1 } } : {}),
      },
    });

    await tx.viewLog.create({
      data: {
        cardId: card.id,
        device,
        ipHash,
        isUnique,
      },
    });
  });

  return Response.json({ ok: true });
}
