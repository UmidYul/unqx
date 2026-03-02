"use client";

import { useEffect, useRef } from "react";

interface ViewTrackerProps {
  slug: string;
}

export function ViewTracker({ slug }: ViewTrackerProps) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) {
      return;
    }

    sent.current = true;
    const url = `/api/cards/${slug}/view`;

    if (navigator.sendBeacon) {
      const payload = new Blob(["{}"], { type: "application/json" });
      navigator.sendBeacon(url, payload);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
      keepalive: true,
    });
  }, [slug]);

  return null;
}
