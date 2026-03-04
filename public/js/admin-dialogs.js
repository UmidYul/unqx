(function initAdminDialogs() {
  const body = document.body;
  if (!body || body.getAttribute("data-admin-layout") !== "1") {
    return;
  }

  const nativeAlert = typeof window.alert === "function" ? window.alert.bind(window) : null;
  const nativeConfirm = typeof window.confirm === "function" ? window.confirm.bind(window) : null;
  const nativePrompt = typeof window.prompt === "function" ? window.prompt.bind(window) : null;

  const queue = [];
  let isOpen = false;
  let currentItem = null;
  let layer = null;
  let dialogNode = null;
  let titleNode = null;
  let messageNode = null;
  let inputWrapNode = null;
  let inputNode = null;
  let cancelButton = null;
  let confirmButton = null;

  function ensureDialog() {
    if (layer instanceof HTMLElement) {
      return true;
    }

    if (!(document.body instanceof HTMLElement)) {
      return false;
    }

    layer = document.createElement("div");
    layer.className = "admin-alert-layer is-hidden";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = [
      '<div class="admin-alert-backdrop" data-admin-alert-close="1"></div>',
      '<div class="admin-alert-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-alert-title">',
      '  <div class="admin-alert-head">',
      '    <img src="/brand/unq-mark.svg" alt="" class="admin-alert-mark"/>',
      '    <h3 id="admin-alert-title" class="admin-alert-title">Сообщение</h3>',
      "  </div>",
      '  <p class="admin-alert-message"></p>',
      '  <div class="admin-alert-input-wrap is-hidden">',
      '    <input type="text" class="admin-alert-input" autocomplete="off"/>',
      "  </div>",
      '  <div class="admin-alert-actions">',
      '    <button type="button" class="admin-alert-btn is-secondary is-hidden" data-admin-alert-cancel="1">Отмена</button>',
      '    <button type="button" class="admin-alert-btn" data-admin-alert-confirm="1">Понятно</button>',
      "  </div>",
      "</div>",
    ].join("");

    dialogNode = layer.querySelector(".admin-alert-dialog");
    titleNode = layer.querySelector(".admin-alert-title");
    messageNode = layer.querySelector(".admin-alert-message");
    inputWrapNode = layer.querySelector(".admin-alert-input-wrap");
    inputNode = layer.querySelector(".admin-alert-input");
    cancelButton = layer.querySelector("[data-admin-alert-cancel='1']");
    confirmButton = layer.querySelector("[data-admin-alert-confirm='1']");

    if (
      !(dialogNode instanceof HTMLElement) ||
      !(titleNode instanceof HTMLElement) ||
      !(messageNode instanceof HTMLElement) ||
      !(inputWrapNode instanceof HTMLElement) ||
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
      if (target.matches("[data-admin-alert-close='1']")) {
        if (!currentItem) {
          closeCurrent();
          return;
        }
        if (currentItem.type === "alert") {
          closeCurrent();
          return;
        }
        cancelCurrent();
      }
    });

    cancelButton.addEventListener("click", () => {
      cancelCurrent();
    });

    confirmButton.addEventListener("click", () => {
      submitCurrent();
    });

    document.addEventListener("keydown", (event) => {
      if (!isOpen || !currentItem) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (currentItem.type === "alert") {
          closeCurrent();
        } else {
          cancelCurrent();
        }
        return;
      }
      if (event.key === "Enter") {
        const target = event.target;
        const inDialog = target instanceof Node && dialogNode.contains(target);
        if (!inDialog) {
          return;
        }
        event.preventDefault();
        submitCurrent();
      }
    });

    document.body.appendChild(layer);
    return true;
  }

  function hideDialog() {
    if (!(layer instanceof HTMLElement)) {
      return;
    }
    layer.classList.add("is-hidden");
    layer.setAttribute("aria-hidden", "true");
    isOpen = false;
    currentItem = null;
  }

  function resolveAndContinue(value) {
    if (!currentItem) {
      hideDialog();
      showNext();
      return;
    }
    const item = currentItem;
    hideDialog();
    item.resolve(value);
    showNext();
  }

  function closeCurrent() {
    if (!currentItem || currentItem.type !== "alert") {
      hideDialog();
      showNext();
      return;
    }
    resolveAndContinue(undefined);
  }

  function cancelCurrent() {
    if (!currentItem) {
      hideDialog();
      showNext();
      return;
    }
    if (currentItem.type === "confirm") {
      resolveAndContinue(false);
      return;
    }
    if (currentItem.type === "prompt") {
      resolveAndContinue(null);
      return;
    }
    resolveAndContinue(undefined);
  }

  function submitCurrent() {
    if (!currentItem) {
      return;
    }
    if (currentItem.type === "confirm") {
      resolveAndContinue(true);
      return;
    }
    if (currentItem.type === "prompt") {
      const value = inputNode instanceof HTMLInputElement ? inputNode.value : "";
      resolveAndContinue(value);
      return;
    }
    resolveAndContinue(undefined);
  }

  function fallbackResolve(item) {
    if (!item) return;
    if (item.type === "confirm") {
      const value = nativeConfirm ? nativeConfirm(item.message) : false;
      item.resolve(Boolean(value));
      return;
    }
    if (item.type === "prompt") {
      const value = nativePrompt ? nativePrompt(item.message, item.defaultValue) : null;
      item.resolve(value === null ? null : String(value));
      return;
    }
    if (nativeAlert) {
      nativeAlert(item.message);
    }
    item.resolve(undefined);
  }

  function showNext() {
    if (isOpen || queue.length === 0) {
      return;
    }

    if (!ensureDialog()) {
      const item = queue.shift();
      fallbackResolve(item);
      showNext();
      return;
    }

    const item = queue.shift();
    if (!item) {
      return;
    }

    if (
      !(layer instanceof HTMLElement) ||
      !(titleNode instanceof HTMLElement) ||
      !(messageNode instanceof HTMLElement) ||
      !(inputWrapNode instanceof HTMLElement) ||
      !(cancelButton instanceof HTMLButtonElement) ||
      !(confirmButton instanceof HTMLButtonElement) ||
      !(inputNode instanceof HTMLInputElement)
    ) {
      fallbackResolve(item);
      showNext();
      return;
    }

    currentItem = item;
    isOpen = true;
    titleNode.textContent = item.title;
    messageNode.textContent = item.message;
    confirmButton.textContent = item.confirmText;

    const needCancel = item.type === "confirm" || item.type === "prompt";
    cancelButton.classList.toggle("is-hidden", !needCancel);
    cancelButton.textContent = item.cancelText;

    const needInput = item.type === "prompt";
    inputWrapNode.classList.toggle("is-hidden", !needInput);
    if (needInput) {
      inputNode.value = item.defaultValue;
      inputNode.placeholder = item.placeholder;
    } else {
      inputNode.value = "";
      inputNode.placeholder = "";
    }

    layer.classList.remove("is-hidden");
    layer.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      if (needInput) {
        inputNode.focus();
        inputNode.select();
      } else {
        confirmButton.focus();
      }
    });
  }

  function modalAlert(message, options = {}) {
    return new Promise((resolve) => {
      queue.push({
        type: "alert",
        title: String(options.title || "Сообщение"),
        message: String(message ?? ""),
        confirmText: String(options.confirmText || "Понятно"),
        cancelText: "",
        defaultValue: "",
        placeholder: "",
        resolve,
      });
      showNext();
    });
  }

  function modalConfirm(message, options = {}) {
    return new Promise((resolve) => {
      queue.push({
        type: "confirm",
        title: String(options.title || "Подтверждение"),
        message: String(message ?? ""),
        confirmText: String(options.confirmText || "Подтвердить"),
        cancelText: String(options.cancelText || "Отмена"),
        defaultValue: "",
        placeholder: "",
        resolve,
      });
      showNext();
    });
  }

  function modalPrompt(message, defaultValue = "", options = {}) {
    return new Promise((resolve) => {
      queue.push({
        type: "prompt",
        title: String(options.title || "Введите значение"),
        message: String(message ?? ""),
        confirmText: String(options.confirmText || "Сохранить"),
        cancelText: String(options.cancelText || "Отмена"),
        defaultValue: String(defaultValue ?? ""),
        placeholder: String(options.placeholder || ""),
        resolve,
      });
      showNext();
    });
  }

  window.UNQAdminDialog = {
    alert: modalAlert,
    confirm: modalConfirm,
    prompt: modalPrompt,
  };

  window.alert = function patchedAlert(message) {
    void modalAlert(message);
  };
})();
