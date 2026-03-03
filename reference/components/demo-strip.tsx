import { ArrowRight, Globe, Instagram, Linkedin } from "lucide-react"

const demos = [
  { name: "Alex Karimov", role: "Product Designer", slug: "alex" },
  { name: "Dilnoza R.", role: "Marketing Lead", slug: "dilnoza" },
  { name: "Sardor M.", role: "Full-Stack Dev", slug: "sardor" },
  { name: "Nodira K.", role: "Brand Strategist", slug: "nodira" },
  { name: "Temur A.", role: "Founder, CEO", slug: "temur" },
]

export function DemoStrip() {
  return (
    <section id="cards" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center gap-2 text-sm text-neutral-400">
          <span>Живые примеры</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {demos.map((demo) => (
            <a
              key={demo.slug}
              href={`/${demo.slug}`}
              className="flex min-w-[220px] flex-col items-center rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-neutral-400 hover:shadow-sm"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
                {demo.name.charAt(0)}
              </div>
              <p className="text-sm font-medium text-neutral-900">{demo.name}</p>
              <p className="mt-1 text-xs text-neutral-400">{demo.role}</p>
              <div className="mt-4 flex items-center gap-3">
                <Instagram className="h-3.5 w-3.5 text-neutral-400" />
                <Linkedin className="h-3.5 w-3.5 text-neutral-400" />
                <Globe className="h-3.5 w-3.5 text-neutral-400" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
