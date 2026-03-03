import { ArrowRight, Check, Package } from "lucide-react"
import Image from "next/image"

const features = [
  "Непрерывный мониторинг здоровья",
  "Аналитика сна и восстановления",
  "Без экрана — только данные",
  "Официальная гарантия",
]

export function WhoopSection() {
  return (
    <section id="whoop" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-16 md:grid-cols-2">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-400">
              Также продаём
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              WHOOP
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-500">
              Фитнес-браслет нового поколения. Официально в Узбекистане.
            </p>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">300 000</span>
              <span className="text-sm text-neutral-400">сум</span>
            </div>

            <p className="mt-2 text-sm text-neutral-400">
              {'Официальная поставка \u00B7 Гарантия \u00B7 Ташкент'}
            </p>

            <ul className="mt-8 flex flex-col gap-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-neutral-600">
                  <Check className="h-4 w-4 shrink-0 text-neutral-900" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#"
                className="btn-shimmer inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                {'Заказать WHOOP'}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600">
                <Package className="h-3 w-3" />
                {'В наличии'}
              </span>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white p-8">
              <div className="absolute right-8 top-8 rounded-full bg-neutral-100 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                WHOOP 4.0
              </div>
              <Image
                src="/images/whoop.jpg"
                alt="WHOOP 4.0 fitness bracelet"
                width={500}
                height={400}
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
