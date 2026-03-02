import { Prisma } from "@prisma/client";

import { deleteAvatarByPublicPath, renameAvatarBySlug } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { getCardDetailsById, updateCard } from "@/lib/services/cards";
import { getCardStats } from "@/lib/services/stats";
import { requireAdminApi } from "@/lib/server-auth";
import { CardUpsertSchema } from "@/lib/validation";

export const runtime = "nodejs";

interface Context {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: Context) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const [card, stats] = await Promise.all([getCardDetailsById(params.id), getCardStats(params.id, "Asia/Tashkent")]);

  if (!card) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  return Response.json({ card, stats });
}

export async function PATCH(request: Request, { params }: Context) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const body = await request.json();
  const parsed = CardUpsertSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const existing = await prisma.card.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      avatarUrl: true,
    },
  });

  if (!existing) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  try {
    const updated = await updateCard(params.id, parsed.data);

    if (existing.slug !== parsed.data.slug && existing.avatarUrl) {
      const moved = await renameAvatarBySlug(existing.slug, parsed.data.slug);

      await prisma.card.update({
        where: { id: updated.id },
        data: {
          avatarUrl: moved,
        },
      });

      if (!moved) {
        await deleteAvatarByPublicPath(existing.avatarUrl);
      }
    }

    return Response.json({ id: updated.id, slug: parsed.data.slug });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "Slug already exists" }, { status: 409 });
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      avatarUrl: true,
    },
  });

  if (!card) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  await prisma.card.delete({ where: { id: params.id } });
  await deleteAvatarByPublicPath(card.avatarUrl);

  return Response.json({ ok: true });
}
