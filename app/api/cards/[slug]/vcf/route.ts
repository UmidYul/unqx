import { prisma } from "@/lib/prisma";
import { generateVCard } from "@/lib/vcard";

interface Context {
  params: {
    slug: string;
  };
}

export async function GET(_request: Request, { params }: Context) {
  const card = await prisma.card.findUnique({
    where: { slug: params.slug },
    select: {
      slug: true,
      isActive: true,
      name: true,
      phone: true,
      email: true,
      extraPhone: true,
      address: true,
      postcode: true,
      hashtag: true,
    },
  });

  if (!card || !card.isActive) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  const payload = generateVCard(card);

  return new Response(payload, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
