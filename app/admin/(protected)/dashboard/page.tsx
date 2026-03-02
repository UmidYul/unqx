import Link from "next/link";

import { DashboardTable } from "@/components/admin/dashboard-table";
import { listCards } from "@/lib/services/cards";
import { getBaseUrl } from "@/lib/url";

interface DashboardPageProps {
  searchParams?: {
    q?: string;
    status?: string;
    page?: string;
  };
}

export const dynamic = "force-dynamic";

function buildUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.length > 0) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `/admin/dashboard?${query}` : "/admin/dashboard";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const q = searchParams?.q ?? "";
  const status = searchParams?.status === "active" || searchParams?.status === "inactive" ? searchParams.status : "all";
  const page = Number(searchParams?.page ?? "1") || 1;

  const result = await listCards({
    query: q,
    status,
    page,
    pageSize: 20,
  });

  const rows = result.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Визитки</h1>
        <Link
          href="/admin/cards/new"
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          + Создать визитку
        </Link>
      </div>

      <form action="/admin/dashboard" className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Поиск по slug или имени"
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        >
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
        <button
          type="submit"
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
        >
          Применить
        </button>
      </form>

      <DashboardTable rows={rows} publicBaseUrl={getBaseUrl()} />

      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>
          Страница {result.pagination.page} из {result.pagination.totalPages} (всего {result.pagination.total})
        </span>
        <div className="flex gap-2">
          <Link
            href={buildUrl({ q, status, page: String(Math.max(1, result.pagination.page - 1)) })}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100"
          >
            Назад
          </Link>
          <Link
            href={buildUrl({
              q,
              status,
              page: String(Math.min(result.pagination.totalPages, result.pagination.page + 1)),
            })}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100"
          >
            Вперёд
          </Link>
        </div>
      </div>
    </div>
  );
}
