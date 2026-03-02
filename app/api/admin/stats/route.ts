import { parsePositiveInt } from "@/lib/http";
import { getGlobalStats } from "@/lib/services/stats";
import { requireAdminApi } from "@/lib/server-auth";

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parsePositiveInt(searchParams.get("days"), 30), 90);

  const stats = await getGlobalStats("Asia/Tashkent");
  const normalized = days === 30 ? stats : { ...stats, dailySeries: stats.dailySeries.slice(-days) };

  return Response.json(normalized);
}
