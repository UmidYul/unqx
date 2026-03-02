import { generateNextSlug } from "@/lib/services/cards";
import { requireAdminApi } from "@/lib/server-auth";

export async function POST() {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const slug = await generateNextSlug();
  return Response.json({ slug });
}
