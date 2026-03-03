import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { DemoStrip } from "@/components/demo-strip"
import { HowItWorks } from "@/components/how-it-works"
import { SlugCalculator } from "@/components/slug-calculator"
import { WhoopSection } from "@/components/whoop-section"
import { Pricing } from "@/components/pricing"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.3]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <DemoStrip />
        <HowItWorks />
        <SlugCalculator />
        <WhoopSection />
        <Pricing />
        <Footer />
      </div>
    </main>
  )
}
