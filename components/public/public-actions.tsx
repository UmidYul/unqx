"use client";

import { useState } from "react";

interface PublicActionsProps {
  slug: string;
  name: string;
  phone: string;
  url: string;
}

export function PublicActions({ slug, name, phone, url }: PublicActionsProps) {
  const [hint, setHint] = useState<string>("");

  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: name,
          text: phone,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      setHint("Ссылка скопирована");
      setTimeout(() => setHint(""), 1500);
    } catch {
      setHint("Не удалось поделиться");
      setTimeout(() => setHint(""), 1500);
    }
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <a
        href={`/api/cards/${slug}/vcf`}
        className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
      >
        Сохранить контакт
      </a>
      <button
        type="button"
        onClick={onShare}
        className="rounded-full border border-neutral-600 px-5 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200"
      >
        Поделиться
      </button>
      {hint ? <span className="text-xs text-neutral-600">{hint}</span> : null}
    </div>
  );
}
