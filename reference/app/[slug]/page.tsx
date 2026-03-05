import { BusinessCard } from "@/components/business-card"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return {
    title: `${slug} | UNQX`,
    description: `Digital card ${slug} on UNQX`,
  }
}

export default async function SlugPage({ params }: Props) {
  const { slug } = await params

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Soft radial background */}
      <div className="pointer-events-none absolute inset-0 bg-neutral-50" />

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top-left soft blur */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-neutral-200/50 blur-3xl" />

      {/* Bottom-right soft blur */}
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-neutral-300/30 blur-3xl" />

      {/* Center glow behind the card */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 blur-3xl" />

      {/* Card */}
      <div className="relative z-10">
        <BusinessCard slug={slug} />
      </div>
    </main>
  )
}
