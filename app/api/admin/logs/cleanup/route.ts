import { subDays } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/server-auth";

export async function POST() {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const threshold = subDays(new Date(), 30);
  const result = await prisma.errorLog.deleteMany({
    where: {
      occurredAt: { lt: threshold },
    },
  });

  return Response.json({ ok: true, deleted: result.count });
}
