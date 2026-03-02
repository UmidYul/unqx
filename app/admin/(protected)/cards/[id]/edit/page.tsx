import { notFound } from "next/navigation";

import { CardEditor } from "@/components/admin/card-editor";
import { getCardDetailsById } from "@/lib/services/cards";
import { getCardStats } from "@/lib/services/stats";

interface EditPageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function EditCardPage({ params }: EditPageProps) {
  const [card, stats] = await Promise.all([getCardDetailsById(params.id), getCardStats(params.id, "Asia/Tashkent")]);

  if (!card) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Редактирование #{card.slug}</h1>
      <CardEditor
        mode="edit"
        cardId={card.id}
        initialAvatarUrl={card.avatarUrl}
        initialValues={{
          slug: card.slug,
          isActive: card.isActive,
          name: card.name,
          phone: card.phone,
          verified: card.verified,
          hashtag: card.hashtag ?? undefined,
          address: card.address ?? undefined,
          postcode: card.postcode ?? undefined,
          email: card.email ?? undefined,
          extraPhone: card.extraPhone ?? undefined,
          tags: card.tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            url: tag.url ?? undefined,
            sortOrder: tag.sortOrder,
          })),
          buttons: card.buttons.map((button) => ({
            id: button.id,
            label: button.label,
            url: button.url,
            isActive: button.isActive,
            sortOrder: button.sortOrder,
          })),
        }}
        stats={{
          totalViews: stats.totalViews,
          totalUniqueViews: stats.totalUniqueViews,
          series7d: stats.series7d,
          lastViewAt: stats.lastViewAt ? stats.lastViewAt.toISOString() : null,
          deviceSplit: stats.deviceSplit,
        }}
      />
    </div>
  );
}
