/**
 * Держите список в соответствии с src/constants/official-unq-letters.js
 */
(function () {
  const PREFIXES = ["DAV", "PPP", "PAA", "UZB"];
  const SET = new Set(PREFIXES);

  const PURCHASE_NOTICE_TITLE = "Официальный префикс";
  const PURCHASE_NOTICE_BODY =
    "Покупка UNQ с такой буквенной серией возможна только после согласования с администрацией и руководством платформы. Эти комбинации закрепляются за ограниченным кругом лиц.";

  const PROFILE_BADGE_TITLE = "Официальный префикс";
  const PROFILE_BADGE_LINE =
    "Закрепление согласовано с администрацией и руководством UNQX — такие серии не для свободной продажи.";

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
    const raw = String(slug || "").toUpperCase().replace(/\s/g, "");
    const m = raw.match(/^([A-Z]{3})[0-9]{3}$/);
    return m ? SET.has(m[1]) : false;
  }

  function renderPurchaseNoticeHtml() {
    return (
      '<div class="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 px-4 py-3 shadow-sm ring-1 ring-amber-950/5">' +
      '<p class="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900/85">' +
      PURCHASE_NOTICE_TITLE +
      "</p>" +
      '<p class="mt-2 text-sm leading-relaxed text-stone-800">' +
      PURCHASE_NOTICE_BODY +
      "</p>" +
      "</div>"
    );
  }

  function renderProfileOfficialBadgeHtml() {
    return (
      '<div class="mt-3 rounded-xl border border-neutral-200/90 bg-gradient-to-b from-neutral-50 to-white px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">' +
      '<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">' +
      PROFILE_BADGE_TITLE +
      "</p>" +
      '<p class="mt-1 text-xs leading-snug text-neutral-600">' +
      PROFILE_BADGE_LINE +
      "</p>" +
      "</div>"
    );
  }

  window.UNQOfficialLetters = {
    PREFIXES: PREFIXES.slice(),
    isOfficialLetters,
    isOfficialSlug,
    renderPurchaseNoticeHtml,
    renderProfileOfficialBadgeHtml,
  };
})();
