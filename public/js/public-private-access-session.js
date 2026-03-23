(function initPrivateAccessSessionTimer() {
  const payloadNode = document.getElementById("card-view-data");
  if (!(payloadNode instanceof HTMLScriptElement)) {
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(payloadNode.textContent || "{}") || {};
  } catch {
    payload = {};
  }

  const privateAccess = payload && typeof payload.privateAccess === "object" ? payload.privateAccess : null;
  if (!privateAccess) {
    return;
  }

  const slug = String(privateAccess.slug || payload.slug || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  const expiresAt = Date.parse(String(privateAccess.expiresAt || ""));

  if (!slug || !Number.isFinite(expiresAt)) {
    return;
  }

  const storageKey = `unqx.private_access.${slug}`;
  const csrfToken = String(document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "");

  const readStored = () => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const token = String(parsed.token || "").trim();
      const storedExp = Number(parsed.expiresAt || 0);
      if (!token || !storedExp) return null;
      return { token, expiresAt: storedExp };
    } catch {
      return null;
    }
  };

  const writeStored = (token, nextExpiresAt) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ token, expiresAt: nextExpiresAt }));
    } catch {
      // ignore
    }
  };

  const clearStored = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  const stored = readStored();
  if (stored?.token) {
    writeStored(stored.token, expiresAt);
  }

  const lockAndRedirect = () => {
    clearStored();
    const url = `/api/cards/private-access/${encodeURIComponent(slug)}/lock`;
    const body = JSON.stringify({ reason: "expired" });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      void fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        keepalive: true,
        body,
      }).catch(() => undefined);
    }

    const target = `/${encodeURIComponent(slug)}?locked=expired`;
    if (window.location.pathname + window.location.search !== target) {
      window.location.replace(target);
    }
  };

  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    lockAndRedirect();
    return;
  }

  const timerId = window.setTimeout(lockAndRedirect, remaining + 20);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() >= expiresAt) {
      window.clearTimeout(timerId);
      lockAndRedirect();
    }
  });
})();