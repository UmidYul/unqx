"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Menu, X } from "lucide-react"

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-black tracking-tight text-neutral-900">
          UNQ+
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="#cards" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
            Визитки
          </Link>
          <Link href="#whoop" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
            WHOOP
          </Link>
          <Link href="#pricing" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
            Тарифы
          </Link>
          <Link href="#" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
            Войти
          </Link>
        </div>

        <Link
          href="#"
          className="btn-shimmer hidden items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 md:flex"
        >
          Занять slug
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-neutral-900 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="#cards" onClick={() => setMobileOpen(false)} className="text-sm text-neutral-500">
              Визитки
            </Link>
            <Link href="#whoop" onClick={() => setMobileOpen(false)} className="text-sm text-neutral-500">
              WHOOP
            </Link>
            <Link href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm text-neutral-500">
              Тарифы
            </Link>
            <Link href="#" className="text-sm text-neutral-500">
              Войти
            </Link>
            <Link
              href="#"
              className="btn-shimmer mt-2 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Занять slug
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
