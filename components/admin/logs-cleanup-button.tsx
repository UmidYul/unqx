"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogsCleanupButton() {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");

  const onCleanup = async () => {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/logs/cleanup", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { deleted?: number; error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Ошибка очистки");
        return;
      }

      setMessage(`Удалено: ${payload.deleted ?? 0}`);
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCleanup}
        disabled={isBusy}
        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
      >
        Очистить старше 30 дней
      </button>
      {message ? <span className="text-xs text-neutral-600">{message}</span> : null}
    </div>
  );
}
