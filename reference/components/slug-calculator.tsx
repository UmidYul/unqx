"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { ArrowRight, Sparkles } from "lucide-react"

const EXAMPLES = [
  { letters: "AAA", digits: "000" },
  { letters: "ZZZ", digits: "999" },
  { letters: "ABC", digits: "123" },
  { letters: "ABA", digits: "001" },
  { letters: "XYZ", digits: "500" },
  { letters: "ABX", digits: "374" },
]

const BASE_PRICE = 100_000

function getLetterMultiplier(letters: string): { multiplier: number; label: string } {
  const upper = letters.toUpperCase()
  if (upper.length !== 3) return { multiplier: 1, label: "..." }

  const [a, b, c] = upper.split("")

  if (a === b && b === c) return { multiplier: 5, label: "Все одинаковые" }

  const ca = a.charCodeAt(0)
  const cb = b.charCodeAt(0)
  const cc = c.charCodeAt(0)
  if (cb - ca === 1 && cc - cb === 1) return { multiplier: 3, label: "По порядку" }
  if (a === c && a !== b) return { multiplier: 2, label: "Палиндром" }

  return { multiplier: 1, label: "Обычные" }
}

function getDigitMultiplier(digits: string): { multiplier: number; label: string } {
  if (digits.length !== 3) return { multiplier: 1, label: "..." }

  const num = parseInt(digits, 10)
  const [d1, d2, d3] = digits.split("")

  if (digits === "000") return { multiplier: 6, label: "Тройной ноль" }
  if (num >= 1 && num <= 9 && digits.startsWith("00")) return { multiplier: 4, label: "Первые девять" }
  if (d1 === d2 && d2 === d3) return { multiplier: 4, label: "Все одинаковые" }

  const n1 = parseInt(d1)
  const n2 = parseInt(d2)
  const n3 = parseInt(d3)
  if (n2 - n1 === 1 && n3 - n2 === 1) return { multiplier: 3, label: "По порядку" }
  if (num % 100 === 0 && num > 0) return { multiplier: 2, label: "Круглое" }
  if (d1 === d3 && d1 !== d2) return { multiplier: 1.5, label: "Палиндром" }

  return { multiplier: 1, label: "Обычные" }
}

function getRarityBadge(total: number): { label: string; color: string } {
  if (total >= 2_000_000) return { label: "LEGENDARY", color: "bg-amber-100 text-amber-800 border-amber-200" }
  if (total >= 1_000_000) return { label: "EPIC", color: "bg-violet-100 text-violet-800 border-violet-200" }
  if (total >= 400_000) return { label: "RARE", color: "bg-sky-100 text-sky-800 border-sky-200" }
  if (total >= 200_000) return { label: "UNCOMMON", color: "bg-emerald-100 text-emerald-800 border-emerald-200" }
  return { label: "COMMON", color: "bg-neutral-100 text-neutral-600 border-neutral-200" }
}

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU").replace(/,/g, " ")
}

export function SlugCalculator() {
  const [letters, setLetters] = useState("")
  const [digits, setDigits] = useState("")
  const [hasRevealed, setHasRevealed] = useState(false)
  const prevFilledRef = useRef(false)

  const isFilled = letters.length === 3 && digits.length === 3

  const result = useMemo(() => {
    if (!isFilled) return null
    const lm = getLetterMultiplier(letters)
    const dm = getDigitMultiplier(digits)
    const total = BASE_PRICE * lm.multiplier * dm.multiplier
    const rarity = getRarityBadge(total)
    return { lm, dm, total, rarity, slug: `${letters.toUpperCase()}${digits}` }
  }, [letters, digits, isFilled])

  useEffect(() => {
    if (isFilled && !prevFilledRef.current) {
      setHasRevealed(true)
    }
    prevFilledRef.current = isFilled
  }, [isFilled])

  function applyExample(ex: { letters: string; digits: string }) {
    setLetters(ex.letters)
    setDigits(ex.digits)
  }

  return (
    <section id="calculator" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-400">
          Slug Pricing Engine
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
          Узнай цену своего slug
        </h2>
        <p className="mt-3 text-base text-neutral-500">
          {'Формат: AAA000 — 3 буквы + 3 цифры. Цена считается автоматически.'}
        </p>

        {/* Inputs */}
        <div className="mt-10 flex items-center gap-3">
          <input
            type="text"
            maxLength={3}
            placeholder="AAA"
            value={letters}
            onChange={(e) => setLetters(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 3))}
            className="w-28 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center font-mono text-lg uppercase text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400"
          />
          <span className="text-neutral-300">&ndash;</span>
          <input
            type="text"
            maxLength={3}
            placeholder="000"
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            className="w-28 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center font-mono text-lg text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400"
          />
        </div>

        {/* Preview */}
        <p className="mt-3 font-mono text-sm text-neutral-400">
          unqx.uz/{letters ? letters.toUpperCase() : "___"}{digits || "___"}
        </p>

        {/* Example chips */}
        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.letters + ex.digits}
              onClick={() => applyExample(ex)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
            >
              {ex.letters}{ex.digits}
            </button>
          ))}
        </div>

        {/* Result card — appears once on first fill, then stays and updates values */}
        {hasRevealed && (
          <div className="mt-8 animate-fade-up rounded-2xl border border-neutral-200 bg-white p-8">
            {result ? (
              <>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-wider transition-all duration-300 ${result.rarity.color}`}>
                    <Sparkles className="h-3 w-3" />
                    {result.rarity.label}
                  </span>
                </div>

                <p className="mt-5 font-mono text-2xl font-bold tracking-wider text-neutral-900 transition-all duration-300">
                  {result.slug}
                </p>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-neutral-900 transition-all duration-300">{formatPrice(result.total)}</span>
                  <span className="text-sm text-neutral-400">сум</span>
                </div>

                <p className="mt-2 font-mono text-xs text-neutral-400 transition-all duration-300">
                  {formatPrice(BASE_PRICE)} x {result.lm.multiplier} x {result.dm.multiplier} = {formatPrice(result.total)} сум
                </p>

                <div className="mt-6 flex gap-6">
                  <div>
                    <p className="text-xs text-neutral-400">Буквы</p>
                    <p className="mt-1 text-sm font-medium text-neutral-700 transition-all duration-300">
                      {result.lm.label} <span className="text-neutral-400">x{result.lm.multiplier}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Цифры</p>
                    <p className="mt-1 text-sm font-medium text-neutral-700 transition-all duration-300">
                      {result.dm.label} <span className="text-neutral-400">x{result.dm.multiplier}</span>
                    </p>
                  </div>
                </div>

                <a
                  href="#"
                  className="btn-shimmer mt-8 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  {'Занять '}{result.slug}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-neutral-400">
                Заполните оба поля чтобы увидеть цену
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
