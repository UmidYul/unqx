import { deleteAvatarByPublicPath, saveAvatarFromBuffer } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/server-auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Context {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: Context) {
  const { response } = await requireAdminApi();
  if (response) {
    return response;
  }

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      avatarUrl: true,
    },
  });

  if (!card) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File exceeds 5MB" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const avatarUrl = await saveAvatarFromBuffer(card.slug, buffer);

  if (card.avatarUrl && card.avatarUrl !== avatarUrl) {
    await deleteAvatarByPublicPath(card.avatarUrl);
  }

  await prisma.card.update({
    where: { id: card.id },
    data: {
      avatarUrl,
    },
  });

  return Response.json({ avatarUrl });
}
