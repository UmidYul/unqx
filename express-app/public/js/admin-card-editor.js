(function initCardEditor() {
  const form = document.getElementById("card-editor-form");
  if (!form) {
    return;
  }

  const body = document.body;
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

  const avatarFileInput = document.getElementById("avatar-file-input");
  const avatarCropWrap = document.getElementById("avatar-crop-wrap");
  const avatarCropImage = document.getElementById("avatar-crop-image");
  const uploadAvatarBtn = document.getElementById("upload-avatar-btn");
  const avatarCurrentImage = document.getElementById("avatar-current-image");
  const avatarFallback = document.getElementById("avatar-fallback");

  let cropper = null;
  let sourceObjectUrl = "";

  function setError(message) {
    if (!formErrorNode) {
      return;
    }

    if (!message) {
      formErrorNode.textContent = "";
      formErrorNode.hidden = true;
      return;
    }

    formErrorNode.textContent = message;
    formErrorNode.hidden = false;
  }

  function sanitizeSlug(value) {
    return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function createTagRow(data) {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.setAttribute("data-item", "tag");

    row.innerHTML = `
      <button type="button" class="drag-btn" data-drag-handle>≡</button>
      <label>
        <span>Текст тега</span>
        <input type="text" class="tag-label" maxlength="50" />
      </label>
      <label>
        <span>Ссылка</span>
        <input type="text" class="tag-url" placeholder="https://..." />
      </label>
      <button type="button" class="btn btn-danger btn-sm" data-remove-row>Удалить</button>
    `;

    const labelInput = row.querySelector(".tag-label");
    const urlInput = row.querySelector(".tag-url");
    labelInput.value = data && data.label ? data.label : "";
    urlInput.value = data && data.url ? data.url : "";

    return row;
  }

  function createButtonRow(data) {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.setAttribute("data-item", "button");

    row.innerHTML = `
      <button type="button" class="drag-btn" data-drag-handle>≡</button>
      <label>
        <span>Текст кнопки</span>
        <input type="text" class="button-label" maxlength="50" />
      </label>
      <label>
        <span>Ссылка</span>
        <input type="text" class="button-url" placeholder="https://..." />
      </label>
      <label class="checkbox-row mini">
        <input type="checkbox" class="button-active" />
        <span>Показывать</span>
      </label>
      <button type="button" class="btn btn-danger btn-sm" data-remove-row>Удалить</button>
    `;

    const labelInput = row.querySelector(".button-label");
    const urlInput = row.querySelector(".button-url");
    const activeInputNode = row.querySelector(".button-active");

    labelInput.value = data && data.label ? data.label : "";
    urlInput.value = data && data.url ? data.url : "https://";
    activeInputNode.checked = data && typeof data.isActive === "boolean" ? data.isActive : true;

    return row;
  }

  function refreshTagsPreview() {
    if (!tagsPreviewNode) {
      return;
    }

    const labels = Array.from(tagsList.querySelectorAll(".tag-label"))
      .map((input) => input.value.trim())
      .filter(Boolean);

    tagsPreviewNode.textContent = labels.length ? labels.join(" · ") : "Предпросмотр: теги появятся после ввода";
  }

  function readTagRows() {
    return Array.from(tagsList.querySelectorAll('[data-item="tag"]'))
      .map((row) => {
        const label = row.querySelector(".tag-label").value.trim();
        const url = row.querySelector(".tag-url").value.trim();
        return {
          label,
          url,
        };
      })
      .filter((tag) => tag.label.length > 0 || tag.url.length > 0)
      .map((tag) => ({
        label: tag.label,
        url: tag.url || undefined,
      }));
  }

  function readButtonRows() {
    return Array.from(buttonsList.querySelectorAll('[data-item="button"]'))
      .map((row) => {
        const label = row.querySelector(".button-label").value.trim();
        const url = row.querySelector(".button-url").value.trim();
        const isActive = row.querySelector(".button-active").checked;
        return {
          label,
          url,
          isActive,
        };
      })
      .filter((button) => button.label.length > 0 || (button.url.length > 0 && button.url !== "https://"));
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
    if (saveCardBtn) {
      saveCardBtn.disabled = isSaving;
      saveCardBtn.textContent = isSaving ? "Сохранение..." : "Сохранить";
    }
  }

  if (generateSlugBtn) {
    generateSlugBtn.addEventListener("click", async () => {
      setError("");
      try {
        const response = await fetch("/api/admin/slug/next", { method: "POST" });
        if (!response.ok) {
          setError("Не удалось сгенерировать slug");
          return;
        }

        const payload = await response.json();
        slugInput.value = payload.slug || "";
      } catch {
        setError("Не удалось сгенерировать slug");
      }
    });
  }

  if (previewCardBtn) {
    previewCardBtn.addEventListener("click", () => {
      const slug = sanitizeSlug(slugInput.value);
      if (!/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
        setError("Для предпросмотра нужен корректный slug (AAA001)");
        return;
      }

      window.open(`/${slug}`, "_blank", "noopener,noreferrer");
    });
  }

  slugInput.addEventListener("input", () => {
    slugInput.value = sanitizeSlug(slugInput.value);
  });

  addTagBtn.addEventListener("click", () => {
    tagsList.appendChild(createTagRow({ label: "", url: "" }));
    refreshTagsPreview();
  });

  addButtonBtn.addEventListener("click", () => {
    buttonsList.appendChild(createButtonRow({ label: "", url: "https://", isActive: true }));
  });

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

      const row = removeButton.closest(".editor-row");
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
    setError("");
    toggleSaving(true);

    try {
      const payload = collectPayload();
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
        setError(data.error || "Не удалось сохранить визитку");
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
    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = "";
    }
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener("change", () => {
      const file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) {
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Файл больше 5MB");
        return;
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Поддерживаются только JPG, PNG, WEBP");
        return;
      }

      setError("");
      destroyCropper();
      resetSourceObjectUrl();

      sourceObjectUrl = URL.createObjectURL(file);
      avatarCropImage.src = sourceObjectUrl;
      avatarCropWrap.hidden = false;

      avatarCropImage.onload = () => {
        if (typeof Cropper === "undefined") {
          setError("CropperJS не загружен");
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

  if (uploadAvatarBtn) {
    uploadAvatarBtn.addEventListener("click", async () => {
      if (!cardId) {
        setError("Сначала сохраните визитку");
        return;
      }

      if (!cropper) {
        setError("Выберите изображение и выполните обрезку");
        return;
      }

      setError("");
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
          setError("Не удалось подготовить изображение");
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
          setError(payload.error || "Не удалось загрузить аватар");
          return;
        }

        if (avatarCurrentImage) {
          avatarCurrentImage.src = payload.avatarUrl;
          avatarCurrentImage.hidden = false;
        }

        if (avatarFallback) {
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
              backgroundColor: "#111827",
            },
            {
              label: "Уникальные",
              data: stats.series7d.map((item) => item.uniqueViews),
              backgroundColor: "#10b981",
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
            },
          },
        },
      });
    }
  }

  refreshTagsPreview();
})();