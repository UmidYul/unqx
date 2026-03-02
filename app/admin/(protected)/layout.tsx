import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/admin/logout-button";
import { getAdminSession } from "@/lib/server-auth";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAdminSession();

  if (!session?.user?.id) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin/dashboard" className="text-lg font-black tracking-tight">
              UNQ+ Admin
            </Link>
            <nav className="flex items-center gap-3 text-sm font-medium text-neutral-700">
              <Link href="/admin/dashboard" className="rounded-full px-3 py-1.5 transition hover:bg-neutral-100">
                Дашборд
              </Link>
              <Link href="/admin/cards/new" className="rounded-full px-3 py-1.5 transition hover:bg-neutral-100">
                Создать
              </Link>
              <Link href="/admin/stats" className="rounded-full px-3 py-1.5 transition hover:bg-neutral-100">
                Статистика
              </Link>
              <Link href="/admin/logs" className="rounded-full px-3 py-1.5 transition hover:bg-neutral-100">
                Логи
              </Link>
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
