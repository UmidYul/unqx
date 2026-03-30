/**
 * Конфиг «официальных» префиксов UNQ задаётся в админке (platform_settings, группа official_unq)
 * и пробрасывается в window.__UNQ_OFFICIAL_CLIENT_CONFIG из partial order-modal.
 */
(function () {
  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizePrefixes(list) {
    const arr = Array.isArray(list) ? list : [];
    const out = [];
    const seen = new Set();
    for (const item of arr) {
      const L = String(item || "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3);
      if (L.length === 3 && !seen.has(L)) {
        seen.add(L);
        out.push(L);
      }
    }
    return out.length ? out : ["DAV", "PPP", "PAA", "UZB"];
  }

  function buildApi(cfg) {
    const raw = cfg && typeof cfg === "object" ? cfg : {};
    const PREFIXES = normalizePrefixes(raw.prefixes);
    const SET = new Set(PREFIXES);
    const purchaseTitle = String(raw.purchaseNoticeTitle || "Официальная серия");
    const purchaseBody = String(
      raw.purchaseNoticeBody ||
        "Такой UNQ можно приобрести только после согласования с администрацией и руководством UNQX.",
    );
    const profileTitle = String(raw.profileBadgeTitle || "Официальная серия UNQ");
    const profileLine = String(
      raw.profileBadgeLine || "Закрепление согласовано с администрацией и руководством платформы.",
    );

    function normalizeLettersThree(value) {
      return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3);
    }

    function isOfficialLetters(letters) {
      const L = normalizeLettersThree(letters);
      return L.length === 3 && SET.has(L);
    }

    function isOfficialSlug(slug) {
      const m = String(slug || "")
        .toUpperCase()
        .replace(/\s/g, "")
        .match(/^([A-Z]{3})[0-9]{3}$/);
      return m ? SET.has(m[1]) : false;
    }

    function renderPurchaseNoticeHtml() {
      return (
        '<div class="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 px-4 py-3 shadow-sm ring-1 ring-amber-950/5">' +
        '<p class="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900/85">' +
        escHtml(purchaseTitle) +
        "</p>" +
        '<p class="mt-2 text-sm leading-relaxed text-stone-800">' +
        escHtml(purchaseBody) +
        "</p>" +
        "</div>"
      );
    }

    function renderProfileOfficialBadgeHtml() {
      return (
        '<div class="mt-3 rounded-xl border border-neutral-200/90 bg-gradient-to-b from-neutral-50 to-white px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">' +
        '<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">' +
        escHtml(profileTitle) +
        "</p>" +
        '<p class="mt-1 text-xs leading-snug text-neutral-600">' +
        escHtml(profileLine) +
        "</p>" +
        "</div>"
      );
    }

    return {
      PREFIXES: PREFIXES.slice(),
      isOfficialLetters,
      isOfficialSlug,
      renderPurchaseNoticeHtml,
      renderProfileOfficialBadgeHtml,
    };
  }

  function applyConfig(cfg) {
    window.UNQOfficialLetters = buildApi(cfg);
  }

  const inline = window.__UNQ_OFFICIAL_CLIENT_CONFIG;
  if (inline != null && typeof inline === "object") {
    applyConfig(inline);
  } else {
    applyConfig(null);
    fetch("/api/cards/official-unq-public-config", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload && typeof payload === "object") {
          applyConfig(payload);
        }
      })
      .catch(() => {});
  }
})();
