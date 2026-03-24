(function initPrivateCardLockScreen() {
  const dataNode = document.getElementById("private-card-data");
  const form = document.getElementById("private-card-form");
  const input = document.getElementById("private-card-password");
  const fieldWrap = document.getElementById("private-card-field-wrap");
  const errorNode = document.getElementById("private-card-error");
  const submitButton = document.getElementById("private-card-submit");
  const backButton = document.getElementById("private-card-back");
  const shell = document.getElementById("private-card-shell");

  if (!(dataNode instanceof HTMLScriptElement) || !(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(dataNode.textContent || "{}") || {};
  } catch {
    payload = {};
  }

  const slug = String(payload.slug || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  if (!slug) {
    return;
  }

  const storageKey = `unqx.private_access.${slug}`;
  const csrfToken = String(document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "");
  if (backButton instanceof HTMLAnchorElement) {
    backButton.addEventListener("click", (event) => {
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  }

  const setError = (message) => {
    if (!(errorNode instanceof HTMLElement)) return;
    const text = String(message || "").trim();
    errorNode.textContent = text;
    errorNode.classList.toggle("hidden", !text);
  };

  const shakeField = () => {
    if (!(fieldWrap instanceof HTMLElement)) return;
    fieldWrap.classList.remove("is-shake");
    requestAnimationFrame(() => {
      fieldWrap.classList.add("is-shake");
      window.setTimeout(() => fieldWrap.classList.remove("is-shake"), 420);
    });
  };

  const readStoredAccess = () => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const token = String(parsed.token || "").trim();
      const expiresAt = Number(parsed.expiresAt || 0);
      if (!token || !expiresAt) return null;
      return { token, expiresAt };
    } catch {
      return null;
    }
  };

  const clearStoredAccess = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  const writeStoredAccess = (token, expiresAt) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        token,
        expiresAt,
      }));
    } catch {
      // ignore
    }
  };

  const callPrivateAccessApi = async (endpoint, body) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: JSON.stringify(body || {}),
    });

    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(String(responsePayload.error || "Request failed"));
      error.code = responsePayload.code;
      throw error;
    }
    return responsePayload;
  };

  const navigateToUnlockedCard = () => {
    if (shell instanceof HTMLElement) {
      shell.classList.add("is-unlocking");
    }
    window.setTimeout(() => {
      window.location.replace(`/${encodeURIComponent(slug)}`);
    }, 180);
  };

  const tryResume = async () => {
    const stored = readStoredAccess();
    if (!stored) {
      return;
    }

    if (stored.expiresAt <= Date.now()) {
      clearStoredAccess();
      return;
    }

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Проверяем...";
    }

    try {
      const resumed = await callPrivateAccessApi(`/api/cards/private-access/${encodeURIComponent(slug)}/resume`, {
        token: stored.token,
      });
      const expiresAt = Date.parse(String(resumed.expiresAt || "")) || stored.expiresAt;
      if (resumed.token && expiresAt > Date.now()) {
        writeStoredAccess(String(resumed.token), expiresAt);
        navigateToUnlockedCard();
        return;
      }
      clearStoredAccess();
    } catch {
      clearStoredAccess();
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Открыть";
      }
    }
  };

  void tryResume();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    const password = String(input.value || "");
    if (!password) {
      setError("Введите пароль");
      shakeField();
      input.focus();
      return;
    }

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Открываем...";
    }

    try {
      const unlocked = await callPrivateAccessApi(`/api/cards/private-access/${encodeURIComponent(slug)}/unlock`, {
        password,
      });
      const granted = Boolean(unlocked?.granted || unlocked?.ok);
      const token = String(unlocked?.token || "").trim();
      const expiresAt = Date.parse(String(unlocked?.expiresAt || ""));

      if (token && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        writeStoredAccess(token, expiresAt);
      } else if (!granted) {
        throw new Error("Сеанс не выдан");
      } else {
        clearStoredAccess();
      }
      navigateToUnlockedCard();
    } catch (error) {
      const code = String(error?.code || "").trim().toUpperCase();
      if (code === "PRIVATE_ACCESS_INVALID_PASSWORD") {
        setError("Неверный пароль");
      } else if (code === "FORBIDDEN") {
        setError("Браузер заблокировал проверку. Откройте ссылку напрямую в браузере.");
      } else {
        setError("Не удалось открыть визитку. Попробуйте ещё раз.");
      }
      shakeField();
      input.focus();
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Открыть";
      }
    }
  });
})();
