(function initSiteDialogs() {
  if (!(document.body instanceof HTMLElement)) {
    return;
  }

  const queue = [];
  let isOpen = false;
  let current = null;
  let layer = null;
  let dialog = null;
  let titleNode = null;
  let messageNode = null;
  let cancelButton = null;
  let confirmButton = null;

  function ensure() {
    if (layer instanceof HTMLElement) {
      return true;
    }

    layer = document.createElement("div");
    layer.className = "unqx-dialog-layer is-hidden";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = [
      '<div class="unqx-dialog-backdrop" data-unqx-dialog-cancel="1"></div>',
      '<section class="unqx-dialog" role="dialog" aria-modal="true" aria-labelledby="unqx-dialog-title">',
      '  <div class="unqx-dialog-head">',
      '    <img src="/brand/unq-mark.svg" alt="" class="unqx-dialog-mark"/>',
      '    <h3 id="unqx-dialog-title" class="unqx-dialog-title">Подтверждение</h3>',
      "  </div>",
      '  <p class="unqx-dialog-message"></p>',
      '  <div class="unqx-dialog-actions">',
      '    <button type="button" class="interactive-btn unqx-dialog-btn is-secondary" data-unqx-dialog-cancel="1">Отмена</button>',
      '    <button type="button" class="interactive-btn unqx-dialog-btn" data-unqx-dialog-confirm="1">Подтвердить</button>',
      "  </div>",
      "</section>",
    ].join("");

    dialog = layer.querySelector(".unqx-dialog");
    titleNode = layer.querySelector(".unqx-dialog-title");
    messageNode = layer.querySelector(".unqx-dialog-message");
    cancelButton = layer.querySelector("[data-unqx-dialog-cancel='1']");
    confirmButton = layer.querySelector("[data-unqx-dialog-confirm='1']");

    if (
      !(dialog instanceof HTMLElement) ||
      !(titleNode instanceof HTMLElement) ||
      !(messageNode instanceof HTMLElement) ||
      !(cancelButton instanceof HTMLButtonElement) ||
      !(confirmButton instanceof HTMLButtonElement)
    ) {
      return false;
    }

    layer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.matches("[data-unqx-dialog-cancel='1']")) {
        resolveCurrent(false);
      }
      if (target.matches("[data-unqx-dialog-confirm='1']")) {
        resolveCurrent(true);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!isOpen || !current) {
        return;
      }
      const activeInDialog = event.target instanceof Node && dialog.contains(event.target);
      if (event.key === "Escape") {
        event.preventDefault();
        resolveCurrent(false);
        return;
      }
      if (event.key === "Enter" && activeInDialog) {
        event.preventDefault();
        resolveCurrent(true);
      }
    });

    document.body.appendChild(layer);
    return true;
  }

  function hide() {
    if (!(layer instanceof HTMLElement)) {
      return;
    }
    layer.classList.add("is-hidden");
    layer.setAttribute("aria-hidden", "true");
    isOpen = false;
  }

  function resolveCurrent(value) {
    if (!current) {
      hide();
      showNext();
      return;
    }
    const item = current;
    current = null;
    hide();
    item.resolve(Boolean(value));
    showNext();
  }

  function showNext() {
    if (isOpen || queue.length === 0) {
      return;
    }

    if (!ensure()) {
      const item = queue.shift();
      if (item) {
        item.resolve(window.confirm(item.message));
      }
      showNext();
      return;
    }

    const item = queue.shift();
    if (!item || !(layer instanceof HTMLElement) || !(titleNode instanceof HTMLElement) || !(messageNode instanceof HTMLElement) || !(cancelButton instanceof HTMLButtonElement) || !(confirmButton instanceof HTMLButtonElement)) {
      return;
    }

    current = item;
    isOpen = true;
    titleNode.textContent = item.title;
    messageNode.textContent = item.message;
    cancelButton.textContent = item.cancelText;
    confirmButton.textContent = item.confirmText;

    layer.classList.remove("is-hidden");
    layer.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      confirmButton.focus();
    });
  }

  function confirm(message, options = {}) {
    return new Promise((resolve) => {
      queue.push({
        title: String(options.title || "Подтверждение"),
        message: String(message || ""),
        confirmText: String(options.confirmText || "Подтвердить"),
        cancelText: String(options.cancelText || "Отмена"),
        resolve,
      });
      showNext();
    });
  }

  window.UNQSiteDialog = {
    ...(window.UNQSiteDialog || {}),
    confirm,
  };
})();
