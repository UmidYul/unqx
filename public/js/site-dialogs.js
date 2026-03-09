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
  let inputWrap = null;
  let inputNode = null;
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
      '    <img src="/brand/logo.PNG" alt="" class="unqx-dialog-mark"/>',
      '    <h3 id="unqx-dialog-title" class="unqx-dialog-title">Подтверждение</h3>',
      "  </div>",
      '  <p class="unqx-dialog-message"></p>',
      '  <div class="unqx-dialog-input-wrap is-hidden">',
      '    <input type="text" class="unqx-dialog-input" autocomplete="off" />',
      "  </div>",
      '  <div class="unqx-dialog-actions">',
      '    <button type="button" class="interactive-btn unqx-dialog-btn is-secondary" data-unqx-dialog-cancel="1">Отмена</button>',
      '    <button type="button" class="interactive-btn unqx-dialog-btn" data-unqx-dialog-confirm="1">Подтвердить</button>',
      "  </div>",
      "</section>",
    ].join("");

    dialog = layer.querySelector(".unqx-dialog");
    titleNode = layer.querySelector(".unqx-dialog-title");
    messageNode = layer.querySelector(".unqx-dialog-message");
    inputWrap = layer.querySelector(".unqx-dialog-input-wrap");
    inputNode = layer.querySelector(".unqx-dialog-input");
    cancelButton = layer.querySelector("[data-unqx-dialog-cancel='1']");
    confirmButton = layer.querySelector("[data-unqx-dialog-confirm='1']");

    if (
      !(dialog instanceof HTMLElement) ||
      !(titleNode instanceof HTMLElement) ||
      !(messageNode instanceof HTMLElement) ||
      !(inputWrap instanceof HTMLElement) ||
      !(inputNode instanceof HTMLInputElement) ||
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
        resolveCurrent("cancel");
      }
      if (target.matches("[data-unqx-dialog-confirm='1']")) {
        resolveCurrent("confirm");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!isOpen || !current || !(dialog instanceof HTMLElement)) {
        return;
      }
      const activeInDialog = event.target instanceof Node && dialog.contains(event.target);
      if (event.key === "Escape") {
        event.preventDefault();
        resolveCurrent("cancel");
        return;
      }
      if (event.key === "Enter" && activeInDialog) {
        event.preventDefault();
        resolveCurrent("confirm");
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

  function resolveCurrent(action) {
    if (!current) {
      hide();
      showNext();
      return;
    }
    const item = current;
    const type = String(item.type || "confirm");
    let value = false;
    if (type === "alert") {
      value = true;
    } else if (type === "prompt") {
      value = action === "confirm" ? String(inputNode?.value || "") : null;
    } else {
      value = action === "confirm";
    }
    current = null;
    hide();
    item.resolve(value);
    showNext();
  }

  function showNext() {
    if (isOpen || queue.length === 0) {
      return;
    }

    if (!ensure()) {
      const item = queue.shift();
      if (item) {
        if (item.type === "alert") item.resolve(true);
        else if (item.type === "prompt") item.resolve(null);
        else item.resolve(false);
      }
      showNext();
      return;
    }

    const item = queue.shift();
    if (
      !item ||
      !(layer instanceof HTMLElement) ||
      !(titleNode instanceof HTMLElement) ||
      !(messageNode instanceof HTMLElement) ||
      !(inputWrap instanceof HTMLElement) ||
      !(inputNode instanceof HTMLInputElement) ||
      !(cancelButton instanceof HTMLButtonElement) ||
      !(confirmButton instanceof HTMLButtonElement)
    ) {
      return;
    }

    current = item;
    isOpen = true;
    const type = String(item.type || "confirm");
    titleNode.textContent = item.title;
    messageNode.textContent = item.message;
    cancelButton.textContent = item.cancelText;
    confirmButton.textContent = item.confirmText;
    cancelButton.classList.toggle("is-hidden", type === "alert");
    inputWrap.classList.toggle("is-hidden", type !== "prompt");
    inputNode.value = type === "prompt" ? String(item.defaultValue || "") : "";
    inputNode.placeholder = String(item.placeholder || "");

    layer.classList.remove("is-hidden");
    layer.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      if (type === "prompt") {
        inputNode.focus();
        inputNode.select();
      } else {
        confirmButton.focus();
      }
    });
  }

  function confirm(message, options = {}) {
    return new Promise((resolve) => {
      queue.push({
        type: "confirm",
        title: String(options.title || "Подтверждение"),
        message: String(message || ""),
        confirmText: String(options.confirmText || "Подтвердить"),
        cancelText: String(options.cancelText || "Отмена"),
        resolve,
      });
      showNext();
    });
  }

  function alert(message, options = {}) {
    return new Promise((resolve) => {
      queue.push({
        type: "alert",
        title: String(options.title || "Сообщение"),
        message: String(message || ""),
        confirmText: String(options.confirmText || "Понятно"),
        cancelText: "",
        resolve,
      });
      showNext();
    });
  }

  function prompt(message, defaultValue = "", options = {}) {
    return new Promise((resolve) => {
      queue.push({
        type: "prompt",
        title: String(options.title || "Введите значение"),
        message: String(message || ""),
        confirmText: String(options.confirmText || "Сохранить"),
        cancelText: String(options.cancelText || "Отмена"),
        defaultValue: String(defaultValue || ""),
        placeholder: String(options.placeholder || ""),
        resolve,
      });
      showNext();
    });
  }

  window.UNQSiteDialog = {
    ...(window.UNQSiteDialog || {}),
    alert,
    confirm,
    prompt,
  };
})();
