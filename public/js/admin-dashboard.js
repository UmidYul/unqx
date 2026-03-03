(function initAdminDashboard() {
  const body = document.body;
  if (!body || body.getAttribute("data-page") !== "admin-dashboard") {
    return;
  }

  const publicBaseUrl = (body.getAttribute("data-public-base-url") || window.location.origin).replace(/\/$/, "");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const modal = document.getElementById("qr-modal");
  const qrSvgWrap = document.getElementById("qr-svg-wrap");
  const qrCanvas = document.getElementById("qr-canvas");
  const qrTitleSlug = document.getElementById("qr-title-slug");
  const qrErrorNode = document.getElementById("qr-error");
  const downloadPngBtn = document.getElementById("download-qr-png");
  const downloadSvgBtn = document.getElementById("download-qr-svg");
  const closeModalNodes = Array.from(document.querySelectorAll("[data-close-modal]"));

  let currentSlug = "";
  let currentUrl = "";
  let currentSvg = "";
  const qrLogoUrl = "/brand/unq-mark.svg";
  let qrLogoDataUrl = "";
  let qrLogoSvgMarkup = "";

  if (!modal || !qrSvgWrap || !qrCanvas) {
    return;
  }

  function withCsrfHeaders(headers = {}) {
    if (!csrfToken) {
      return headers;
    }

    return {
      ...headers,
      "X-CSRF-Token": csrfToken,
    };
  }

  function setQrError(message) {
    if (!(qrErrorNode instanceof HTMLElement)) {
      return;
    }

    if (!message) {
      qrErrorNode.textContent = "";
      qrErrorNode.classList.add("hidden");
      return;
    }

    qrErrorNode.textContent = message;
    qrErrorNode.classList.remove("hidden");
  }

  async function resolveQrLogoSrc() {
    if (qrLogoDataUrl) {
      return qrLogoDataUrl;
    }

    try {
      const response = await fetch(qrLogoUrl, { cache: "force-cache" });
      if (!response.ok) {
        return qrLogoUrl;
      }

      const svgText = await response.text();
      const encodedSvg = encodeURIComponent(svgText)
        .replace(/'/g, "%27")
        .replace(/"/g, "%22");

      qrLogoDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      return qrLogoDataUrl;
    } catch {
      return qrLogoUrl;
    }
  }

  async function resolveQrLogoSvgMarkup() {
    if (qrLogoSvgMarkup) {
      return qrLogoSvgMarkup;
    }

    try {
      const response = await fetch(qrLogoUrl, { cache: "force-cache" });
      if (!response.ok) {
        return "";
      }

      const svgText = await response.text();
      const cleaned = svgText
        .replace(/<\?xml[\s\S]*?\?>/gi, "")
        .replace(/<!doctype[\s\S]*?>/gi, "")
        .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
        .trim();
      const inner = cleaned
        .replace(/^[\s\S]*?<svg[^>]*>/i, "")
        .replace(/<\/svg>\s*$/i, "")
        .trim();
      const viewBoxMatch = cleaned.match(/viewBox="([^"]+)"/i);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 120 120";

      qrLogoSvgMarkup = `<svg x="0" y="0" width="100%" height="100%" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
      return qrLogoSvgMarkup;
    } catch {
      return "";
    }
  }

  function injectLogoToSvg(svg, size, logoSize, logoSrc, logoSvgMarkup = "") {
    const x = Math.round((size - logoSize) / 2);
    const y = Math.round((size - logoSize) / 2);
    const whitePad = Math.round(logoSize * 0.2);
    const rectX = x - whitePad;
    const rectY = y - whitePad;
    const rectSize = logoSize + whitePad * 2;
    const logoBody = logoSvgMarkup
      ? `<g transform="translate(${x},${y})"><svg x="0" y="0" width="${logoSize}" height="${logoSize}" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">${logoSvgMarkup.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "")}</svg></g>`
      : `<image href="${logoSrc}" xlink:href="${logoSrc}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />`;

    const logo = [
      `<rect x="${rectX}" y="${rectY}" width="${rectSize}" height="${rectSize}" fill="white" rx="12" ry="12" />`,
      logoBody,
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

  function drawLogoOnCanvas(canvas, size, logoSize, logoSrc) {
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
      image.src = logoSrc;
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
    setQrError("");
  }

  async function openQrModal(slug) {
    if (typeof QRCode === "undefined") {
      setQrError("QR библиотека не загружена. Обновите страницу.");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    try {
      setQrError("");
      currentSlug = slug;
      currentUrl = `${publicBaseUrl}/${slug}`;

      if (qrTitleSlug) {
        qrTitleSlug.textContent = `#${slug}`;
      }

      const displaySvgRaw = await QRCode.toString(currentUrl, {
        type: "svg",
        width: 240,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      const downloadSvgRaw = await QRCode.toString(currentUrl, {
        type: "svg",
        width: 1000,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      const [logoSrc, logoSvgMarkup] = await Promise.all([resolveQrLogoSrc(), resolveQrLogoSvgMarkup()]);
      const displaySvg = injectLogoToSvg(displaySvgRaw, 240, 44, logoSrc, logoSvgMarkup);
      currentSvg = injectLogoToSvg(downloadSvgRaw, 1000, 180, logoSrc, logoSvgMarkup);

      qrSvgWrap.innerHTML = displaySvg;

      await QRCode.toCanvas(qrCanvas, currentUrl, {
        width: 1000,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      await drawLogoOnCanvas(qrCanvas, 1000, 180, logoSrc);

      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.setAttribute("aria-hidden", "false");
    } catch {
      setQrError("Не удалось сгенерировать QR-код. Попробуйте еще раз.");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.setAttribute("aria-hidden", "false");
    }
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
          headers: withCsrfHeaders({
            "Content-Type": "application/json",
          }),
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
        await fetch(`/api/admin/cards/${id}`, {
          method: "DELETE",
          headers: withCsrfHeaders(),
        });
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
