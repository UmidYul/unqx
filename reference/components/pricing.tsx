import { ArrowRight, Check, X } from "lucide-react"

const plans = [
  {
    name: "Базовый",
    price: "29 000",
    highlighted: false,
    badge: null,
    included: [
      "1 цифровая визитка",
      "Стандартный шаблон",
      "До 3 кнопок (звонок, telegram, сайт)",
      "QR-код",
      "Базовая аналитика",
    ],
    excluded: [
      "Выбор темы",
      "Кастомные цвета",
      "Скрыть брендинг UNQX",
      "Больше 3 кнопок",
    ],
  },
  {
    name: "Премиум",
    price: "79 000",
    highlighted: true,
    badge: "Популярный",
    included: [
      "1 цифровая визитка",
      "Выбор темы (5+ тем)",
      "Кастомные цвета и фон",
      "Неограниченное кол-во кнопок",
      "Расширенная аналитика (динамика по дням)",
      "Скрыть брендинг UNQX",
      "QR-код + NFC поддержка",
      "Приоритетная поддержка",
    ],
    excluded: [],
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-16 text-2xl font-bold tracking-tight text-neutral-900">
          Тарифы
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${plan.highlighted
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900"
                }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-medium tracking-wide text-white ring-4 ring-neutral-50">
                  {plan.badge}
                </span>
              )}

              <p className={`font-mono text-xs uppercase tracking-widest ${plan.highlighted ? "text-neutral-400" : "text-neutral-400"}`}>
                {plan.name}
              </p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className={`text-sm ${plan.highlighted ? "text-neutral-400" : "text-neutral-400"}`}>
                  сум/мес
                </span>
              </div>

              <p className={`mt-1 text-xs ${plan.highlighted ? "text-neutral-500" : "text-neutral-400"}`}>
                + стоимость slug по калькулятору
              </p>

              <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                {plan.included.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-start gap-2.5 text-sm ${plan.highlighted ? "text-neutral-300" : "text-neutral-600"}`}
                  >
                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${plan.highlighted ? "text-white" : "text-neutral-900"}`} />
                    {feature}
                  </li>
                ))}
                {plan.excluded.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-start gap-2.5 text-sm ${plan.highlighted ? "text-neutral-600" : "text-neutral-300"}`}
                  >
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={`btn-shimmer mt-8 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-colors ${plan.highlighted
                    ? "bg-white text-neutral-900 hover:bg-neutral-100"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
                  }`}
              >
                Начать
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400">
          {'* Стоимость slug оплачивается единоразово при регистрации. '}
          <a href="#calculator" className="underline transition-colors hover:text-neutral-600">
            {'Узнать цену своего slug'}
          </a>
        </p>
      </div>
    </section>
  )
}
