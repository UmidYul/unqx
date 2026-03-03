import { Link2, PenLine, Share2 } from "lucide-react"

const steps = [
  {
    icon: Link2,
    title: "Выбери slug",
    description: "Найди свой уникальный адрес",
  },
  {
    icon: PenLine,
    title: "Заполни карточку",
    description: "Фото, контакты, ссылки за 2 минуты",
  },
  {
    icon: Share2,
    title: "Делись везде",
    description: "QR, ссылка, NFC — где угодно",
  },
]

export function HowItWorks() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-16 text-2xl font-bold tracking-tight text-neutral-900">
          Как это работает
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                <step.icon className="h-4 w-4 text-neutral-900" />
              </div>
              <div>
                <span className="mb-1 block font-mono text-xs text-neutral-400">
                  {'0'}{i + 1}
                </span>
                <h3 className="text-base font-medium text-neutral-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
