(function initAdminDashboard() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") {
    return;
  }

  const publicBaseUrl = (body.getAttribute("data-public-base-url") || window.location.origin).replace(/\/$/, "");
  const modal = document.getElementById("qr-modal");
  const qrSvgWrap = document.getElementById("qr-svg-wrap");
  const qrCanvas = document.getElementById("qr-canvas");
  const qrTitleSlug = document.getElementById("qr-title-slug");
  const downloadPngBtn = document.getElementById("download-qr-png");
  const downloadSvgBtn = document.getElementById("download-qr-svg");
  const closeModalNodes = Array.from(document.querySelectorAll("[data-close-modal]"));

  let currentSlug = "";
  let currentUrl = "";
  let currentSvg = "";

  if (!modal || !qrSvgWrap || !qrCanvas) {
    return;
  }

  function injectLogoToSvg(svg, size, logoSize) {
    const x = Math.round((size - logoSize) / 2);
    const y = Math.round((size - logoSize) / 2);
    const whitePad = Math.round(logoSize * 0.2);
    const rectX = x - whitePad;
    const rectY = y - whitePad;
    const rectSize = logoSize + whitePad * 2;

    const logo = [
      `<rect x="${rectX}" y="${rectY}" width="${rectSize}" height="${rectSize}" fill="white" rx="12" ry="12" />`,
      `<image href="/brand/unq-mark.svg" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" />`,
    ].join("");

    return svg.replace("</svg>", `${logo}</svg>`);
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function drawLogoOnCanvas(canvas, size, logoSize) {
    return new Promise((resolve) => {
      const context = canvas.getContext("2d");
      if (!context) {
        resolve();
        return;
      }

      const image = new Image();
      image.onload = () => {
        const x = Math.round((size - logoSize) / 2);
        const y = Math.round((size - logoSize) / 2);
        const whitePad = Math.round(logoSize * 0.2);
        const rectX = x - whitePad;
        const rectY = y - whitePad;
        const rectSize = logoSize + whitePad * 2;

        context.fillStyle = "#ffffff";
        context.fillRect(rectX, rectY, rectSize, rectSize);
        context.drawImage(image, x, y, logoSize, logoSize);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = "/brand/unq-mark.svg";
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
  }

  async function openQrModal(slug) {
    if (typeof QRCode === "undefined") {
      return;
    }

    currentSlug = slug;
    currentUrl = `${publicBaseUrl}/${slug}`;

    if (qrTitleSlug) {
      qrTitleSlug.textContent = `#${slug}`;
    }

    const displaySvgRaw = await QRCode.toString(currentUrl, {
      type: "svg",
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    const downloadSvgRaw = await QRCode.toString(currentUrl, {
      type: "svg",
      width: 1000,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    const displaySvg = injectLogoToSvg(displaySvgRaw, 240, 44);
    currentSvg = injectLogoToSvg(downloadSvgRaw, 1000, 180);

    qrSvgWrap.innerHTML = displaySvg;

    await QRCode.toCanvas(qrCanvas, currentUrl, {
      width: 1000,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    await drawLogoOnCanvas(qrCanvas, 1000, 180);

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
  }

  closeModalNodes.forEach((node) => {
    node.addEventListener("click", closeModal);
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  if (downloadPngBtn) {
    downloadPngBtn.addEventListener("click", () => {
      if (!currentSlug) {
        return;
      }

      const link = document.createElement("a");
      link.href = qrCanvas.toDataURL("image/png");
      link.download = `${currentSlug}.png`;
      link.click();
    });
  }

  if (downloadSvgBtn) {
    downloadSvgBtn.addEventListener("click", () => {
      if (!currentSvg || !currentSlug) {
        return;
      }

      downloadBlob(currentSvg, "image/svg+xml;charset=utf-8", `${currentSlug}.svg`);
    });
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const actionNode = target.closest("[data-action]");
    if (!(actionNode instanceof HTMLElement)) {
      return;
    }

    const action = actionNode.getAttribute("data-action");

    if (action === "toggle") {
      const id = actionNode.getAttribute("data-id");
      const isActive = actionNode.getAttribute("data-active") === "1";
      if (!id) {
        return;
      }

      actionNode.setAttribute("disabled", "disabled");
      try {
        await fetch(`/api/admin/cards/${id}/toggle-active`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: !isActive }),
        });
        window.location.reload();
      } finally {
        actionNode.removeAttribute("disabled");
      }
      return;
    }

    if (action === "delete") {
      const id = actionNode.getAttribute("data-id");
      const slug = actionNode.getAttribute("data-slug") || "";

      if (!id) {
        return;
      }

      if (!window.confirm(`Удалить визитку #${slug}?`)) {
        return;
      }

      actionNode.setAttribute("disabled", "disabled");
      try {
        await fetch(`/api/admin/cards/${id}`, { method: "DELETE" });
        window.location.reload();
      } finally {
        actionNode.removeAttribute("disabled");
      }
      return;
    }

    if (action === "qr") {
      const slug = actionNode.getAttribute("data-slug");
      if (!slug) {
        return;
      }

      await openQrModal(slug);
    }
  });
})();
