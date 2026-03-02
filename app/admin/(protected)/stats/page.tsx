import Link from "next/link";

import { DailyLineChart } from "@/components/charts/daily-line-chart";
import { getGlobalStats } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export default async function GlobalStatsPage() {
  const stats = await getGlobalStats("Asia/Tashkent");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Общая статистика</h1>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Всего карточек</p>
          <p className="mt-2 text-2xl font-black">{stats.totalCards}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Активные</p>
          <p className="mt-2 text-2xl font-black">{stats.activeCards}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Всего просмотров</p>
          <p className="mt-2 text-2xl font-black">{stats.totalViews}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Уникальные просмотры</p>
          <p className="mt-2 text-2xl font-black">{stats.totalUniqueViews}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-bold">Просмотры за 30 дней</h2>
        <div className="mt-3">
          <DailyLineChart data={stats.dailySeries} />
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-bold">Топ-10 визиток по просмотрам</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Имя</th>
                <th className="px-3 py-2">Просмотры</th>
                <th className="px-3 py-2">Уникальные</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCards.map((card) => (
                <tr key={card.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <Link href={`/admin/cards/${card.id}/edit`} className="text-blue-700 hover:underline">
                      #{card.slug}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{card.name}</td>
                  <td className="px-3 py-2 font-semibold">{card.viewsCount}</td>
                  <td className="px-3 py-2 font-semibold">{card.uniqueViewsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
