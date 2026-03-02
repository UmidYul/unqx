import Link from "next/link";

import { LogsCleanupButton } from "@/components/admin/logs-cleanup-button";
import { prisma } from "@/lib/prisma";

interface LogsPageProps {
  searchParams?: {
    type?: string;
    page?: string;
  };
}

export const dynamic = "force-dynamic";

function buildUrl(type: string, page: number) {
  const search = new URLSearchParams();

  if (type !== "all") {
    search.set("type", type);
  }

  search.set("page", String(page));
  return `/admin/logs?${search.toString()}`;
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const rawType = searchParams?.type ?? "all";
  const type = rawType === "not_found" || rawType === "server_error" ? rawType : "all";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const pageSize = 50;

  const where = type === "all" ? {} : { type };

  const [total, logs] = await Promise.all([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Логи ошибок</h1>
        <LogsCleanupButton />
      </div>

      <form action="/admin/logs" className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-[220px_auto]">
        <select
          name="type"
          defaultValue={type}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        >
          <option value="all">Все типы</option>
          <option value="not_found">404 (not_found)</option>
          <option value="server_error">500 (server_error)</option>
        </select>
        <button
          type="submit"
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
        >
          Применить
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Путь</th>
              <th className="px-4 py-3">Сообщение</th>
              <th className="px-4 py-3">Браузер</th>
              <th className="px-4 py-3">Время</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-3">{log.type}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.path}</td>
                <td className="px-4 py-3 text-xs text-neutral-700">{log.message || "-"}</td>
                <td className="px-4 py-3 text-xs text-neutral-700">{log.userAgent || "-"}</td>
                <td className="px-4 py-3 text-xs">{new Date(log.occurredAt).toLocaleString("ru-RU")}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Логи не найдены
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>
          Страница {page} из {totalPages} (всего {total})
        </span>
        <div className="flex gap-2">
          <Link
            href={buildUrl(type, Math.max(1, page - 1))}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100"
          >
            Назад
          </Link>
          <Link
            href={buildUrl(type, Math.min(totalPages, page + 1))}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100"
          >
            Вперёд
          </Link>
        </div>
      </div>
    </div>
  );
}
