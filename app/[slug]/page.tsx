import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { CopyPhoneButton } from "@/components/public/copy-phone-button";
import { Lightning } from "@/components/public/lightning";
import { ViewTracker } from "@/components/public/view-tracker";
import { prisma } from "@/lib/prisma";
import { getPublicCardBySlug } from "@/lib/services/cards";
import { absoluteUrl } from "@/lib/url";

interface PageProps {
  params: {
    slug: string;
  };
}

export const dynamic = "force-dynamic";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function UnavailableCard({ slug }: { slug: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="rounded-3xl border border-neutral-400 bg-white/70 px-8 py-10 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">#{slug}</p>
        <h1 className="mt-3 text-2xl font-bold text-neutral-900">Визитка недоступна</h1>
        <p className="mt-2 text-sm text-neutral-600">Эта визитка временно отключена администратором.</p>
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const card = await getPublicCardBySlug(params.slug);

  if (!card) {
    return {
      title: "Визитка не найдена",
      description: "UNQ+ Digital Business Cards",
    };
  }

  const image = card.avatarUrl ? absoluteUrl(card.avatarUrl) : absoluteUrl("/brand/unq-mark.svg");

  return {
    title: `${card.name} | UNQ+`,
    description: card.phone,
    icons: {
      icon: card.avatarUrl ?? "/favicon.ico",
      shortcut: card.avatarUrl ?? "/favicon.ico",
    },
    openGraph: {
      title: `${card.name} | UNQ+`,
      description: card.phone,
      images: [image],
      type: "profile",
    },
  };
}

export default async function PublicCardPage({ params }: PageProps) {
  const card = await getPublicCardBySlug(params.slug);

  if (!card) {
    const requestHeaders = headers();
    await prisma.errorLog.create({
      data: {
        type: "not_found",
        path: `/${params.slug}`,
        userAgent: requestHeaders.get("user-agent") ?? "",
      },
    });
    notFound();
  }

  if (!card.isActive) {
    return <UnavailableCard slug={card.slug} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white pb-20 pt-6 text-black">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Lightning className="absolute left-8 top-1 h-[114px] w-[84px] md:hidden" />
        <Lightning className="absolute right-1 top-1 h-[130px] w-[92px] md:hidden" />
        <Lightning className="absolute left-4 top-[194px] h-[126px] w-[90px] md:hidden" />
        <Lightning className="absolute right-1 top-[350px] h-[128px] w-[92px] md:hidden" />
        <Lightning className="absolute left-4 top-[510px] h-[126px] w-[90px] md:hidden" />
        <Lightning className="absolute right-8 top-[560px] h-[118px] w-[84px] md:hidden" />

        <Lightning className="absolute left-[1%] top-[1%] hidden h-[96px] w-[70px] -rotate-6 text-black/60 md:block" />
        <Lightning className="absolute left-[5%] top-[8%] hidden h-[92px] w-[66px] rotate-2 text-black/60 md:block" />
        <Lightning className="absolute left-[10%] top-[8%] hidden h-[94px] w-[68px] -rotate-2 text-black/60 md:block" />
        <Lightning className="absolute left-[15%] top-[7%] hidden h-[92px] w-[66px] rotate-3 text-black/60 md:block" />
        <Lightning className="absolute left-[1%] top-[18%] hidden h-[98px] w-[70px] -rotate-4 text-black/60 md:block" />
        <Lightning className="absolute left-[8%] top-[23%] hidden h-[96px] w-[70px] rotate-4 text-black/60 md:block" />
        <Lightning className="absolute left-[13%] top-[31%] hidden h-[90px] w-[64px] -rotate-5 text-black/60 md:block" />
        <Lightning className="absolute left-[3%] top-[56%] hidden h-[98px] w-[70px] rotate-6 text-black/60 md:block" />
        <Lightning className="absolute left-[9%] top-[63%] hidden h-[94px] w-[68px] -rotate-3 text-black/60 md:block" />
        <Lightning className="absolute left-[14%] top-[83%] hidden h-[104px] w-[74px] rotate-5 text-black/60 md:block" />
        <Lightning className="absolute left-[27%] top-[74%] hidden h-[100px] w-[72px] -rotate-2 text-black/60 md:block" />

        <Lightning className="absolute right-[1%] top-[1%] hidden h-[96px] w-[70px] rotate-5 text-black/60 md:block" />
        <Lightning className="absolute right-[7%] top-[10%] hidden h-[98px] w-[70px] -rotate-4 text-black/60 md:block" />
        <Lightning className="absolute right-[13%] top-[18%] hidden h-[98px] w-[70px] rotate-3 text-black/60 md:block" />
        <Lightning className="absolute right-[2%] top-[33%] hidden h-[96px] w-[70px] -rotate-3 text-black/60 md:block" />
        <Lightning className="absolute right-[9%] top-[49%] hidden h-[96px] w-[70px] rotate-5 text-black/60 md:block" />
        <Lightning className="absolute right-[15%] top-[68%] hidden h-[98px] w-[70px] -rotate-6 text-black/60 md:block" />
        <Lightning className="absolute right-[4%] top-[75%] hidden h-[100px] w-[72px] rotate-4 text-black/60 md:block" />
        <Lightning className="absolute right-[12%] top-[85%] hidden h-[102px] w-[74px] -rotate-2 text-black/60 md:block" />
        <Lightning className="absolute right-[26%] top-[85%] hidden h-[102px] w-[74px] rotate-4 text-black/60 md:block" />

        <Lightning className="absolute left-[30%] top-[2%] hidden h-[92px] w-[66px] -rotate-2 text-black/60 md:block" />
        <Lightning className="absolute right-[30%] top-[2%] hidden h-[92px] w-[66px] rotate-2 text-black/60 md:block" />
        <Lightning className="absolute left-[31%] top-[24%] hidden h-[96px] w-[70px] rotate-4 text-black/60 md:block" />
        <Lightning className="absolute right-[31%] top-[27%] hidden h-[96px] w-[70px] -rotate-4 text-black/60 md:block" />
        <Lightning className="absolute left-[31%] top-[56%] hidden h-[96px] w-[70px] -rotate-3 text-black/60 md:block" />
        <Lightning className="absolute right-[31%] top-[58%] hidden h-[96px] w-[70px] rotate-3 text-black/60 md:block" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[820px] w-full max-w-[414px] flex-col items-center rounded-[32px] bg-white/85 px-7 py-6 md:min-h-[900px]">
        <p className="text-base font-normal leading-none text-[#2d2d2d]">#{card.slug}</p>

        <div className="mt-2 text-center">
          <div className="inline-flex flex-col items-center">
            <div className="text-[56px] font-black leading-[0.88] tracking-[-0.04em] text-black">UNQ+</div>
            <div className="mt-[3px] text-[19px] font-normal leading-none text-[#1b1b1b]">powered by scxr</div>
          </div>
        </div>

        <div className="animate-in relative mt-[22px] h-[54px] w-[54px]" style={{ animationDelay: "0ms" }}>
          <div className="relative flex h-[54px] w-[54px] items-center justify-center overflow-hidden rounded-full bg-neutral-300 shadow-sm">
            {card.avatarUrl ? (
              <Image src={card.avatarUrl} alt={card.name} fill className="object-cover" sizes="54px" />
            ) : (
              <span className="text-base font-bold text-neutral-700">{getInitials(card.name)}</span>
            )}
          </div>
        </div>

        <div className="animate-in mt-2 flex items-center gap-1.5" style={{ animationDelay: "100ms" }}>
          <h1 className="text-base font-normal leading-none">{card.name}</h1>
          {card.verified ? (
            <span className="inline-flex h-[14px] w-[14px] items-center justify-center text-[#5f6368]" aria-label="verified">
              <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="currentColor" aria-hidden>
                <path d="M12 2.4l2.1 1.7 2.7-.3 1.1 2.5 2.5 1.1-.3 2.7L21.6 12l-1.7 2.1.3 2.7-2.5 1.1-1.1 2.5-2.7-.3L12 21.6l-2.1-1.7-2.7.3-1.1-2.5-2.5-1.1.3-2.7L2.4 12l1.7-2.1-.3-2.7 2.5-1.1 1.1-2.5 2.7.3L12 2.4zm-1.1 13.2l5.1-5.1-1.2-1.2-3.9 3.9-1.8-1.8-1.2 1.2 3 3z" />
              </svg>
            </span>
          ) : null}
        </div>
        <p className="animate-in mt-1 flex items-center gap-2 text-base font-normal leading-none" style={{ animationDelay: "100ms" }}>
          <span>{card.phone}</span>
          <CopyPhoneButton phone={card.phone} />
        </p>

        {card.tags.length > 0 ? (
          <div className="animate-in mt-[8px] text-center text-xs leading-[1.58] text-[rgb(15,20,194)]" style={{ animationDelay: "200ms" }}>
            {card.tags.map((tag, idx) => (
              <span key={tag.id}>
                {idx > 0 ? " · " : ""}
                {tag.url ? (
                  <a href={tag.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {tag.label}
                  </a>
                ) : (
                  <span>{tag.label}</span>
                )}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-[12px] flex w-full max-w-[171px] flex-col gap-[9px]">
          {card.buttons.map((button, idx) => (
            <a
              key={button.id}
              href={button.url}
              target="_blank"
              rel="noopener noreferrer"
              className="animate-in btn-shimmer flex h-[50px] w-[171px] items-center justify-center rounded-[22px] bg-black text-center text-sm font-semibold leading-[21.7px] text-white transition hover:bg-black"
              style={{ animationDelay: `${300 + idx * 80}ms` }}
            >
              {button.label}
            </a>
          ))}
        </div>

        <div className="mt-auto w-full pt-10">
          {card.hashtag ? (
            <p className="animate-in text-center text-base font-normal" style={{ animationDelay: `${300 + card.buttons.length * 80 + 80}ms` }}>
              {card.hashtag}
            </p>
          ) : null}

          {(card.address || card.postcode || card.email || card.extraPhone) && (
            <section
              className="animate-in mx-auto mt-5 w-full max-w-[275px]"
              style={{ animationDelay: `${300 + card.buttons.length * 80 + 160}ms` }}
            >
              <h2 className="text-base font-normal">About info</h2>
              <div className="mt-2 space-y-1 text-base leading-[1.15]">
                {card.address ? <p>{`Address: ${card.address}`}</p> : null}
                {card.postcode ? <p>{`Postcode: ${card.postcode}`}</p> : null}
                {card.email ? <p>{`Email: ${card.email}`}</p> : null}
                {card.extraPhone ? <p>{`Phone: ${card.extraPhone}`}</p> : null}
              </div>
            </section>
          )}
        </div>
      </main>

      <ViewTracker slug={card.slug} />
    </div>
  );
}
