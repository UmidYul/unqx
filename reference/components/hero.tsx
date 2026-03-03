"use client"

import { useState } from "react"
import { ArrowRight, Check, Users, Calculator } from "lucide-react"

export function Hero() {
  const [slug, setSlug] = useState("")
  const [checked, setChecked] = useState(false)
  const [available, setAvailable] = useState(false)

  function handleCheck() {
    if (!slug.trim()) return
    setChecked(true)
    setAvailable(true)
  }

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-neutral-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[500px] w-[500px] rounded-full bg-neutral-200/40 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-7xl">
          Твой slug.
          <br />
          Твой бренд.
          <br />
          Навсегда.
        </h1>

        <p className="mx-auto mt-6 max-w-md text-lg text-neutral-500">
          Цифровая визитка за 1 минуту — одна ссылка вместо тысячи слов.
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-neutral-200 bg-white px-4 py-3 focus-within:border-neutral-400">
            <span className="mr-2 text-sm text-neutral-400">unqx.uz/</span>
            <input
              type="text"
              placeholder="your-name"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setChecked(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-300"
            />
          </div>
          <button
            onClick={handleCheck}
            className="btn-shimmer flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Проверить
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {checked && available && (
          <div className="mt-6 animate-fade-up">
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-900">
              <Check className="h-4 w-4" />
              <span>
                {'unqx.uz/'}{slug}{' доступен'}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <a
                href="#"
                className="btn-shimmer inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                {'Занять slug'}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="#calculator"
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <Calculator className="h-3.5 w-3.5" />
                Узнать цену
              </a>
            </div>

            <p className="mt-3 text-xs text-neutral-400">
              {'Цена зависит от уникальности — AAA000 стоит дороже чем ABX374'}
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-neutral-400">
          <Users className="h-3.5 w-3.5" />
          <span>{'1,200+ человек уже заняли свой slug'}</span>
        </div>
      </div>
    </section>
  )
}
