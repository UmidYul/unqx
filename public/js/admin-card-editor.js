(function initCardEditor() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-card-editor") {
    return;
  }

  const form = document.getElementById("card-editor-form");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const mode = body.getAttribute("data-mode") || "create";
  const cardId = body.getAttribute("data-card-id") || "";

  const slugInput = document.getElementById("field-slug");
  const activeInput = document.getElementById("field-is-active");
  const nameInput = document.getElementById("field-name");
  const phoneInput = document.getElementById("field-phone");
  const hashtagInput = document.getElementById("field-hashtag");
  const verifiedInput = document.getElementById("field-verified");
  const addressInput = document.getElementById("field-address");
  const postcodeInput = document.getElementById("field-postcode");
  const emailInput = document.getElementById("field-email");
  const extraPhoneInput = document.getElementById("field-extra-phone");

  const tagsList = document.getElementById("tags-list");
  const buttonsList = document.getElementById("buttons-list");
  const addTagBtn = document.getElementById("add-tag-btn");
  const addButtonBtn = document.getElementById("add-button-btn");
  const tagsPreviewNode = document.getElementById("tags-preview");

  const generateSlugBtn = document.getElementById("generate-slug-btn");
  const previewCardBtn = document.getElementById("preview-card-btn");
  const saveCardBtn = document.getElementById("save-card-btn");
  const formErrorNode = document.getElementById("card-form-error");

  const slugErrorNode = document.getElementById("field-slug-error");
  const nameErrorNode = document.getElementById("field-name-error");
  const phoneErrorNode = document.getElementById("field-phone-error");
  const emailErrorNode = document.getElementById("field-email-error");

  const pickAvatarBtn = document.getElementById("pick-avatar-btn");
  const avatarFileInput = document.getElementById("avatar-file-input");
  const avatarCropWrap = document.getElementById("avatar-crop-wrap");
  const avatarCropImage = document.getElementById("avatar-crop-image");
  const uploadAvatarBtn = document.getElementById("upload-avatar-btn");
  const avatarCurrentImage = document.getElementById("avatar-current-image");
  const avatarFallback = document.getElementById("avatar-fallback");

  if (
    !(slugInput instanceof HTMLInputElement) ||
    !(activeInput instanceof HTMLInputElement) ||
    !(nameInput instanceof HTMLInputElement) ||
    !(phoneInput instanceof HTMLInputElement) ||
    !(hashtagInput instanceof HTMLInputElement) ||
    !(verifiedInput instanceof HTMLInputElement) ||
    !(addressInput instanceof HTMLInputElement) ||
    !(postcodeInput instanceof HTMLInputElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !(extraPhoneInput instanceof HTMLInputElement) ||
    !(tagsList instanceof HTMLElement) ||
    !(buttonsList instanceof HTMLElement)
  ) {
    return;
  }

  let cropper = null;
  let sourceObjectUrl = "";

  function setNodeMessage(node, message) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (!message) {
      node.textContent = "";
      node.classList.add("hidden");
      return;
    }

    node.textContent = message;
    node.classList.remove("hidden");
  }

  function clearFieldErrors() {
    setNodeMessage(slugErrorNode, "");
    setNodeMessage(nameErrorNode, "");
    setNodeMessage(phoneErrorNode, "");
    setNodeMessage(emailErrorNode, "");
  }

  function setFormError(message) {
    setNodeMessage(formErrorNode, message || "");
  }

  function sanitizeSlug(value) {
    return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function createTagRow(data) {
    const row = document.createElement("div");
    row.className = "grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[auto_1fr_1fr_auto]";
    row.setAttribute("data-item", "tag");

    row.innerHTML = `
      <button type="button" class="mt-2 h-7 w-7 rounded-lg border border-neutral-300 text-neutral-500" data-drag-handle>≡</button>

      <label class="text-xs font-medium text-neutral-600">
        Текст тега
        <input type="text" class="tag-label mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm" placeholder="Top Dawg" />
      </label>

      <label class="text-xs font-medium text-neutral-600">
        Ссылка (необязательно)
        <input type="text" class="tag-url mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm" placeholder="https://..." />
      </label>

      <button type="button" data-remove-row class="mt-6 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50">
        Удалить
      </button>
    `;

    const labelInput = row.querySelector(".tag-label");
    const urlInput = row.querySelector(".tag-url");

    if (labelInput instanceof HTMLInputElement) {
      labelInput.value = data && data.label ? String(data.label) : "";
    }

    if (urlInput instanceof HTMLInputElement) {
      urlInput.value = data && data.url ? String(data.url) : "";
    }

    return row;
  }

  function createButtonRow(data) {
    const row = document.createElement("div");
    row.className = "grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[auto_1fr_1fr_160px_auto]";
    row.setAttribute("data-item", "button");

    row.innerHTML = `
      <button type="button" class="mt-2 h-7 w-7 rounded-lg border border-neutral-300 text-neutral-500" data-drag-handle>≡</button>

      <label class="text-xs font-medium text-neutral-600">
        Текст кнопки
        <input type="text" class="button-label mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm" placeholder="TELEGRAM" />
      </label>

      <label class="text-xs font-medium text-neutral-600">
        Ссылка
        <input type="text" class="button-url mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm" placeholder="https://..." />
      </label>

      <label class="mt-6 flex items-center gap-2 text-xs font-semibold text-neutral-700">
        <input type="checkbox" class="button-active" />
        Показывать
      </label>

      <button type="button" data-remove-row class="mt-6 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50">
        Удалить
      </button>
    `;

    const labelInput = row.querySelector(".button-label");
    const urlInput = row.querySelector(".button-url");
    const activeNode = row.querySelector(".button-active");

    if (labelInput instanceof HTMLInputElement) {
      labelInput.value = data && data.label ? String(data.label) : "";
    }

    if (urlInput instanceof HTMLInputElement) {
      urlInput.value = data && data.url ? String(data.url) : "https://";
    }

    if (activeNode instanceof HTMLInputElement) {
      activeNode.checked = data && typeof data.isActive === "boolean" ? data.isActive : true;
    }

    return row;
  }

  function refreshTagsPreview() {
    if (!(tagsPreviewNode instanceof HTMLElement)) {
      return;
    }

    const labels = Array.from(tagsList.querySelectorAll(".tag-label"))
      .map((input) => (input instanceof HTMLInputElement ? input.value.trim() : ""))
      .filter(Boolean);

    tagsPreviewNode.textContent = labels.length ? labels.join(" · ") : "Предпросмотр: теги появятся после ввода";
  }

  function readTagRows() {
    return Array.from(tagsList.querySelectorAll('[data-item="tag"]'))
      .map((row) => {
        const labelInput = row.querySelector(".tag-label");
        const urlInput = row.querySelector(".tag-url");

        const label = labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "";
        const url = urlInput instanceof HTMLInputElement ? urlInput.value.trim() : "";

        return { label, url };
      })
      .filter((item) => item.label.length > 0 || item.url.length > 0)
      .map((item) => ({
        label: item.label,
        url: item.url || undefined,
      }));
  }

  function readButtonRows() {
    return Array.from(buttonsList.querySelectorAll('[data-item="button"]'))
      .map((row) => {
        const labelInput = row.querySelector(".button-label");
        const urlInput = row.querySelector(".button-url");
        const activeNode = row.querySelector(".button-active");

        const label = labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "";
        const url = urlInput instanceof HTMLInputElement ? urlInput.value.trim() : "";
        const isActive = activeNode instanceof HTMLInputElement ? activeNode.checked : true;

        return { label, url, isActive };
      })
      .filter((item) => item.label.length > 0 || (item.url.length > 0 && item.url !== "https://"));
  }

  function collectPayload() {
    return {
      slug: sanitizeSlug(slugInput.value),
      isActive: Boolean(activeInput.checked),
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      verified: Boolean(verifiedInput.checked),
      hashtag: hashtagInput.value.trim() || undefined,
      address: addressInput.value.trim() || undefined,
      postcode: postcodeInput.value.trim() || undefined,
      email: emailInput.value.trim() || undefined,
      extraPhone: extraPhoneInput.value.trim() || undefined,
      tags: readTagRows(),
      buttons: readButtonRows(),
    };
  }

  function toggleSaving(isSaving) {
    if (!(saveCardBtn instanceof HTMLButtonElement)) {
      return;
    }

    saveCardBtn.disabled = isSaving;
    saveCardBtn.textContent = isSaving ? "Сохранение..." : "Сохранить";
  }

  function validateBasic(payload) {
    clearFieldErrors();

    if (!/^[A-Z]{3}[0-9]{3}$/.test(payload.slug)) {
      setNodeMessage(slugErrorNode, "Slug должен быть в формате AAA001");
      return false;
    }

    if (!payload.name) {
      setNodeMessage(nameErrorNode, "Введите имя клиента");
      return false;
    }

    if (!payload.phone) {
      setNodeMessage(phoneErrorNode, "Введите телефон");
      return false;
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setNodeMessage(emailErrorNode, "Введите корректный email");
      return false;
    }

    return true;
  }

  if (generateSlugBtn instanceof HTMLElement) {
    generateSlugBtn.addEventListener("click", async () => {
      setFormError("");
      try {
        const response = await fetch("/api/admin/slug/next", { method: "POST" });
        if (!response.ok) {
          setFormError("Не удалось сгенерировать slug");
          return;
        }

        const payload = await response.json();
        slugInput.value = typeof payload.slug === "string" ? payload.slug : "";
      } catch {
        setFormError("Не удалось сгенерировать slug");
      }
    });
  }

  if (previewCardBtn instanceof HTMLElement) {
    previewCardBtn.addEventListener("click", () => {
      const slug = sanitizeSlug(slugInput.value);
      if (!/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
        setNodeMessage(slugErrorNode, "Для предпросмотра нужен корректный slug (AAA001)");
        return;
      }

      window.open(`/${slug}`, "_blank", "noopener,noreferrer");
    });
  }

  slugInput.addEventListener("input", () => {
    slugInput.value = sanitizeSlug(slugInput.value);
    clearFieldErrors();
  });

  if (addTagBtn instanceof HTMLElement) {
    addTagBtn.addEventListener("click", () => {
      tagsList.appendChild(createTagRow({ label: "", url: "" }));
      refreshTagsPreview();
    });
  }

  if (addButtonBtn instanceof HTMLElement) {
    addButtonBtn.addEventListener("click", () => {
      buttonsList.appendChild(createButtonRow({ label: "", url: "https://", isActive: true }));
    });
  }

  [tagsList, buttonsList].forEach((listNode) => {
    listNode.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const removeButton = target.closest("[data-remove-row]");
      if (!(removeButton instanceof HTMLElement)) {
        return;
      }

      const row = removeButton.closest("[data-item]");
      if (row) {
        row.remove();
      }

      refreshTagsPreview();
    });

    listNode.addEventListener("input", () => {
      refreshTagsPreview();
    });
  });

  if (typeof Sortable !== "undefined") {
    new Sortable(tagsList, {
      animation: 150,
      handle: "[data-drag-handle]",
    });

    new Sortable(buttonsList, {
      animation: 150,
      handle: "[data-drag-handle]",
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError("");

    const payload = collectPayload();
    if (!validateBasic(payload)) {
      return;
    }

    toggleSaving(true);
    try {
      const endpoint = mode === "create" ? "/api/admin/cards" : `/api/admin/cards/${cardId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error || "Не удалось сохранить визитку");
        return;
      }

      if (mode === "create") {
        window.location.href = `/admin/cards/${data.id}/edit`;
        return;
      }

      window.location.reload();
    } finally {
      toggleSaving(false);
    }
  });

  function destroyCropper() {
    if (cropper && typeof cropper.destroy === "function") {
      cropper.destroy();
    }
    cropper = null;
  }

  function resetSourceObjectUrl() {
    if (!sourceObjectUrl) {
      return;
    }

    URL.revokeObjectURL(sourceObjectUrl);
    sourceObjectUrl = "";
  }

  if (pickAvatarBtn instanceof HTMLElement && avatarFileInput instanceof HTMLInputElement) {
    pickAvatarBtn.addEventListener("click", () => {
      avatarFileInput.click();
    });
  }

  if (avatarFileInput instanceof HTMLInputElement && avatarCropWrap instanceof HTMLElement && avatarCropImage instanceof HTMLImageElement) {
    avatarFileInput.addEventListener("change", () => {
      const file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) {
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setFormError("Файл больше 5MB");
        return;
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setFormError("Поддерживаются только JPG, PNG, WEBP");
        return;
      }

      setFormError("");
      destroyCropper();
      resetSourceObjectUrl();

      sourceObjectUrl = URL.createObjectURL(file);
      avatarCropImage.src = sourceObjectUrl;
      avatarCropWrap.hidden = false;

      avatarCropImage.onload = () => {
        if (typeof Cropper === "undefined") {
          setFormError("CropperJS не загружен");
          return;
        }

        destroyCropper();
        cropper = new Cropper(avatarCropImage, {
          aspectRatio: 1,
          viewMode: 1,
          dragMode: "move",
          autoCropArea: 0.9,
          background: false,
        });
      };
    });
  }

  if (uploadAvatarBtn instanceof HTMLButtonElement) {
    uploadAvatarBtn.addEventListener("click", async () => {
      if (!cardId) {
        setFormError("Сначала сохраните визитку");
        return;
      }

      if (!cropper) {
        setFormError("Выберите изображение и выполните обрезку");
        return;
      }

      setFormError("");
      uploadAvatarBtn.disabled = true;
      uploadAvatarBtn.textContent = "Загрузка...";

      try {
        const canvas = cropper.getCroppedCanvas({
          width: 400,
          height: 400,
          imageSmoothingQuality: "high",
        });

        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/webp", 0.9);
        });

        if (!blob) {
          setFormError("Не удалось подготовить изображение");
          return;
        }

        const file = new File([blob], "avatar.webp", { type: "image/webp" });
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/admin/cards/${cardId}/avatar`, {
          method: "POST",
          body: formData,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setFormError(payload.error || "Не удалось загрузить аватар");
          return;
        }

        if (avatarCurrentImage instanceof HTMLImageElement) {
          avatarCurrentImage.src = payload.avatarUrl;
          avatarCurrentImage.hidden = false;
        }

        if (avatarFallback instanceof HTMLElement) {
          avatarFallback.hidden = true;
        }

        destroyCropper();
        avatarCropWrap.hidden = true;
        avatarCropImage.removeAttribute("src");
        resetSourceObjectUrl();
        avatarFileInput.value = "";
      } finally {
        uploadAvatarBtn.disabled = false;
        uploadAvatarBtn.textContent = "Сохранить обрезку";
      }
    });
  }

  const statsNode = document.getElementById("card-editor-stats");
  const statsCanvas = document.getElementById("card-stats-chart");
  if (statsNode && statsCanvas && typeof Chart !== "undefined") {
    const stats = JSON.parse(statsNode.textContent || "null");
    if (stats && Array.isArray(stats.series7d)) {
      new Chart(statsCanvas, {
        type: "bar",
        data: {
          labels: stats.series7d.map((item) => item.date),
          datasets: [
            {
              label: "Все просмотры",
              data: stats.series7d.map((item) => item.views),
              backgroundColor: "#1f2937",
              borderRadius: 4,
            },
            {
              label: "Уникальные",
              data: stats.series7d.map((item) => item.uniqueViews),
              backgroundColor: "#10b981",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
              grid: {
                color: "#dddddd",
                borderDash: [3, 3],
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
        },
      });
    }
  }

  refreshTagsPreview();
})();
