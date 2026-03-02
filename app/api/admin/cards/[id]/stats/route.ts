import { getCardStats } from "@/lib/services/stats";
import { requireAdminApi } from "@/lib/server-auth";

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

  const url = new URL(_request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "7");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, daysRaw)) : 7;
  const stats = await getCardStats(params.id, "Asia/Tashkent", days);
  return Response.json(stats);
}
