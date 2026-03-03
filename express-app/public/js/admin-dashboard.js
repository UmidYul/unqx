(function initAdminDashboard() {
  const body = document.body;
  if (!body || !body.classList.contains("admin-body")) {
    return;
  }

  const publicBaseUrl = (body.getAttribute("data-public-base-url") || window.location.origin).replace(/\/$/, "");
  const modal = document.getElementById("qr-modal");
  const qrCanvas = document.getElementById("qr-canvas");
  const qrTitleSlug = document.getElementById("qr-title-slug");
  const downloadPngBtn = document.getElementById("download-qr-png");
  const downloadSvgBtn = document.getElementById("download-qr-svg");
  const closeModalNodes = Array.from(document.querySelectorAll("[data-close-modal]"));

  let currentSlug = "";
  let currentUrl = "";
  let currentSvg = "";

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function closeModal() {
    if (!modal) {
      return;
    }
    modal.hidden = true;
  }

  async function openQrModal(slug) {
    if (!modal || !qrCanvas || typeof QRCode === "undefined") {
      return;
    }

    currentSlug = slug;
    currentUrl = `${publicBaseUrl}/${slug}`;
    if (qrTitleSlug) {
      qrTitleSlug.textContent = `#${slug}`;
    }

    await QRCode.toCanvas(qrCanvas, currentUrl, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    currentSvg = await QRCode.toString(currentUrl, {
      type: "svg",
      width: 1000,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    modal.hidden = false;
  }

  closeModalNodes.forEach((node) => {
    node.addEventListener("click", closeModal);
  });

  if (downloadPngBtn) {
    downloadPngBtn.addEventListener("click", () => {
      if (!qrCanvas || !currentSlug) {
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