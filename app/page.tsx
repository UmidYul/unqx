import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-5xl font-black tracking-tight">UNQ+</h1>
      <p className="text-lg text-neutral-600">Digital Business Cards Platform</p>
      <div className="flex gap-3">
        <Link
          href="/AAA001"
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          Демо визитка
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-neutral-500 px-5 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200"
        >
          Админка
        </Link>
      </div>
    </main>
  );
}
