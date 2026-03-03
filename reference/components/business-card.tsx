"use client"

import {
  Phone,
  MessageCircle,
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Share2,
  Download,
  Eye,
  BadgeCheck,
  MousePointerClick,
  ArrowUpRight,
  MapPin,
  Mail,
  Hash,
} from "lucide-react"

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3l-.5 3H13v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z" />
    </svg>
  )
}

interface BusinessCardProps {
  slug: string
}

export function BusinessCard({ slug }: BusinessCardProps) {
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Shukhrat Isroilov | UNQ+",
        url: `https://unqx.uz/${slug}`,
      })
    } else {
      await navigator.clipboard.writeText(`https://unqx.uz/${slug}`)
    }
  }

  return (
    <div className="w-full max-w-[520px] animate-card-enter">
      {/* Card ID */}
      <div
        className="animate-fade-up mb-4 flex items-center justify-between px-1"
        style={{ animationDelay: "0.1s" }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-neutral-400 uppercase">
          <Hash className="h-3 w-3" />
          AAA001
        </span>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
          aria-label="Share"
        >
          <Share2 className="h-3 w-3" />
        </button>
      </div>

      {/* Main card */}
      <div
        className="animate-fade-up rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
        style={{ animationDelay: "0.2s" }}
      >
        {/* Brand */}
        <div
          className="animate-fade-up text-center"
          style={{ animationDelay: "0.3s" }}
        >
          <h2 className="text-2xl font-black tracking-tight text-neutral-900">
            UNQ+
          </h2>
          <p className="mt-0.5 text-[10px] tracking-widest text-neutral-400 uppercase">
            powered by scxr
          </p>
        </div>

        {/* Avatar + Info */}
        <div
          className="animate-fade-up mt-8 flex flex-col items-center"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-700">
              SI
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-lg font-semibold text-neutral-900">
                Shukhrat Isroilov
              </h1>
              <BadgeCheck className="h-4 w-4 text-neutral-900" />
            </div>
            <a
              href="tel:+998333331337"
              className="mt-1 flex items-center justify-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <Phone className="h-3 w-3" />
              +998 33 333 13 37
            </a>
          </div>
        </div>

        {/* Tags */}
        <div
          className="animate-fade-up mt-5 flex flex-wrap justify-center gap-1.5"
          style={{ animationDelay: "0.5s" }}
        >
          {["Top Dawg", "ALBLAK 52", "ICEGERGERT"].map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="my-6 h-px bg-neutral-100" />

        {/* Action buttons */}
        <div
          className="animate-fade-up flex flex-col gap-2.5"
          style={{ animationDelay: "0.6s" }}
        >
          {[
            { label: "Telegram", icon: MessageCircle, href: "https://t.me/shukhrat" },
            { label: "Instagram", icon: Instagram, href: "https://instagram.com/" },
            { label: "Click", icon: MousePointerClick, href: "#" },
            { label: "Steam Trade", icon: ArrowUpRight, href: "#" },
          ].map(({ label, icon: Icon, href }) => (
            <a
              key={label}
              href={href}
              className="btn-shimmer flex items-center justify-center gap-2.5 rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-medium tracking-wide text-white uppercase transition-colors hover:bg-neutral-800"
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="my-6 h-px bg-neutral-100" />

        {/* Hashtag */}
        <div
          className="animate-fade-up"
          style={{ animationDelay: "0.7s" }}
        >
          <p className="text-center text-xs font-medium tracking-wide text-neutral-400">
            #UnqPower2026
          </p>
        </div>

        {/* About info */}
        <div
          className="animate-fade-up mt-6 rounded-xl bg-neutral-50 p-5"
          style={{ animationDelay: "0.8s" }}
        >
          <h3 className="text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">
            About info
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-start gap-2 text-sm text-neutral-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span>Farghona, Mustaqillik 13</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span>unq@uz.com</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span>+998200001360</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Hash className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span>Postcode: 150100</span>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div
          className="animate-fade-up mt-6 flex items-center justify-center gap-2"
          style={{ animationDelay: "0.9s" }}
        >
          {[
            { icon: Instagram, label: "Instagram" },
            { icon: Linkedin, label: "LinkedIn" },
            { icon: TikTokIcon, label: "TikTok" },
            { icon: Youtube, label: "YouTube" },
          ].map(({ icon: Icon, label }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>

        {/* VCF download */}
        <div
          className="animate-fade-up mt-5 text-center"
          style={{ animationDelay: "1s" }}
        >
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <Download className="h-3 w-3" />
            Save contact (.vcf)
          </a>
        </div>
      </div>

      {/* Footer stats */}
      <div
        className="animate-fade-up mt-4 flex items-center justify-between px-1"
        style={{ animationDelay: "1.1s" }}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <Eye className="h-3 w-3" />
          342 views
        </div>
        <div className="flex items-center gap-1 text-[10px] text-neutral-400">
          <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" />
          UNQ+
        </div>
      </div>
    </div>
  )
}
