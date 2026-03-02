"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { QrModal } from "@/components/admin/qr-modal";

interface DashboardRow {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  viewsCount: number;
  uniqueViewsCount: number;
  createdAt: string;
}

interface DashboardTableProps {
  rows: DashboardRow[];
  publicBaseUrl: string;
}

export function DashboardTable({ rows, publicBaseUrl }: DashboardTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrSlug, setQrSlug] = useState<string | null>(null);

  const qrUrl = useMemo(() => {
    if (!qrSlug) {
      return "";
    }

    return `${publicBaseUrl}/${qrSlug}`;
  }, [publicBaseUrl, qrSlug]);

  const toggleActive = async (id: string, isActive: boolean) => {
    setBusyId(id);
    try {
      await fetch(`/api/admin/cards/${id}/toggle-active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !isActive }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const deleteCard = async (id: string, slug: string) => {
    if (!confirm(`Удалить визитку #${slug}?`)) {
      return;
    }

    setBusyId(id);
    try {
      await fetch(`/api/admin/cards/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Имя</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Просмотры</th>
              <th className="px-4 py-3">Уникальные</th>
              <th className="px-4 py-3">Создана</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-3 font-semibold text-blue-700">
                  <a href={`/${row.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    #{row.slug}
                  </a>
                </td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(row.id, row.isActive)}
                    disabled={busyId === row.id}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      row.isActive ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {row.isActive ? "Активна" : "Неактивна"}
                  </button>
                </td>
                <td className="px-4 py-3">{row.viewsCount}</td>
                <td className="px-4 py-3">{row.uniqueViewsCount}</td>
                <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString("ru-RU")}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/cards/${row.id}/edit`}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Редактировать
                    </Link>
                    <button
                      type="button"
                      onClick={() => setQrSlug(row.slug)}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      QR
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCard(row.id, row.slug)}
                      disabled={busyId === row.id}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  Ничего не найдено
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {qrSlug ? <QrModal slug={qrSlug} url={qrUrl} onClose={() => setQrSlug(null)} /> : null}
    </>
  );
}
