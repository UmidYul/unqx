(function initPublicHomeSearch() {
  const pageNode = document.querySelector('[data-page="public-home-search"]');
  if (!(pageNode instanceof HTMLElement)) {
    return;
  }

  const input = document.getElementById("home-search-input");
  const resultsWrap = document.getElementById("home-search-results");
  const hint = document.getElementById("home-search-hint");

  if (!(input instanceof HTMLInputElement) || !(resultsWrap instanceof HTMLElement)) {
    return;
  }

  let activeIndex = -1;
  let items = [];
  let debounceTimer = null;

  function sanitizeQuery(value) {
    return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function closeResults() {
    resultsWrap.classList.add("hidden");
    resultsWrap.innerHTML = "";
    activeIndex = -1;
    items = [];
  }

  function renderEmpty(message) {
    items = [];
    activeIndex = -1;
    resultsWrap.innerHTML = `<p class="px-4 py-3 text-sm text-neutral-600">${message}</p>`;
    resultsWrap.classList.remove("hidden");
  }

  function setActive(index) {
    activeIndex = index;
    Array.from(resultsWrap.querySelectorAll("[data-result-index]")).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const isActive = Number(node.getAttribute("data-result-index")) === activeIndex;
      node.classList.toggle("bg-black", isActive);
      node.classList.toggle("text-white", isActive);
      node.classList.toggle("bg-white", !isActive);
      node.classList.toggle("text-neutral-900", !isActive);
    });
  }

  function goToSlug(slug) {
    if (!slug) {
      return;
    }

    window.location.href = `/${slug}`;
  }

  function renderItems(nextItems) {
    items = nextItems;
    activeIndex = nextItems.length ? 0 : -1;

    if (!items.length) {
      renderEmpty("Ничего не найдено");
      return;
    }

    resultsWrap.innerHTML = items
      .map(
        (item, index) => `
          <button
            type="button"
            class="home-search-result-item flex w-full items-center justify-between border-b border-black/5 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-black hover:text-white"
            data-result-index="${index}"
            data-result-slug="${item.slug}"
          >
            <span class="font-semibold tracking-[0.08em]">#${item.slug}</span>
            <span class="ml-3 truncate text-xs opacity-80">${item.name || ""}</span>
          </button>
        `,
      )
      .join("");

    resultsWrap.classList.remove("hidden");
    setActive(activeIndex);
  }

  async function fetchSearch(query) {
    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        renderEmpty("Не удалось выполнить поиск");
        return;
      }

      const payload = await response.json();
      renderItems(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      renderEmpty("Не удалось выполнить поиск");
    }
  }

  input.addEventListener("input", () => {
    const query = sanitizeQuery(input.value);
    input.value = query;

    if (hint instanceof HTMLElement) {
      hint.textContent = query ? "Ищем по ID..." : "Введите ID и нажмите Enter для перехода.";
    }

    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }

    if (!query) {
      closeResults();
      return;
    }

    debounceTimer = window.setTimeout(() => {
      fetchSearch(query);
    }, 250);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeResults();
      return;
    }

    if (!items.length) {
      if (event.key === "Enter") {
        const query = sanitizeQuery(input.value);
        if (query.length === 6) {
          goToSlug(query);
        }
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + items.length) % items.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = items[activeIndex] || items[0];
      if (selected && selected.slug) {
        goToSlug(selected.slug);
      }
    }
  });

  resultsWrap.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const row = target.closest("[data-result-slug]");
    if (!(row instanceof HTMLElement)) {
      return;
    }

    goToSlug(row.getAttribute("data-result-slug") || "");
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target === input || target.closest("#home-search-results")) {
      return;
    }

    closeResults();
  });
})();
