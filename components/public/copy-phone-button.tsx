"use client";

import { useState } from "react";

interface CopyPhoneButtonProps {
  phone: string;
}

export function CopyPhoneButton({ phone }: CopyPhoneButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyWithFallback = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  };

  const onCopy = async () => {
    let ok = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(phone);
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      ok = copyWithFallback(phone);
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-current/30 text-current transition hover:opacity-80"
      aria-label="Скопировать телефон"
      title="Скопировать телефон"
    >
      {copied ? (
        <span className="text-[11px] leading-none">✓</span>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z" />
        </svg>
      )}
    </button>
  );
}
