import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <div>
            <Link href="/" className="text-xl font-black text-neutral-900">
              UNQ+
            </Link>
            <p className="mt-2 text-sm text-neutral-400">
              Цифровая визитка нового поколения
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-sm text-neutral-400">
            <Link href="#cards" className="transition-colors hover:text-neutral-900">Визитки</Link>
            <Link href="#whoop" className="transition-colors hover:text-neutral-900">WHOOP</Link>
            <Link href="#pricing" className="transition-colors hover:text-neutral-900">Тарифы</Link>
          </div>

          <p className="hidden text-4xl font-bold tracking-tight text-neutral-200 md:block">
            unqx.uz
          </p>
        </div>

        <div className="mt-12 border-t border-neutral-200 pt-6">
          <p className="text-xs text-neutral-400">
            &copy; 2026 UNQ+ &middot; Ташкент, Узбекистан
          </p>
        </div>
      </div>
    </footer>
  )
}
