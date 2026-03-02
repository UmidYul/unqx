import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/server-auth";

const ToggleSchema = z.object({
  isActive: z.boolean(),
});

interface Context {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: Context) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const body = await request.json();
  const parsed = ToggleSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const card = await prisma.card.update({
    where: { id: params.id },
    data: {
      isActive: parsed.data.isActive,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  return Response.json(card);
}
