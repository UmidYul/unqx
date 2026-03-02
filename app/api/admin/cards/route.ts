import { Prisma } from "@prisma/client";

import { listCards, createCard } from "@/lib/services/cards";
import { requireAdminApi } from "@/lib/server-auth";
import { CardUpsertSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const rawStatus = searchParams.get("status") ?? "all";
  const status = rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";

  const result = await listCards({
    query: q,
    status,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: 20,
  });

  return Response.json(result);
}

export async function POST(request: Request) {
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

  try {
    const card = await createCard(parsed.data);
    return Response.json({ id: card.id, slug: card.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "Slug already exists" }, { status: 409 });
    }

    throw error;
  }
}
