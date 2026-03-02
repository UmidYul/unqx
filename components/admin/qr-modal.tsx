"use client";

import { useRef } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

interface QrModalProps {
  slug: string;
  url: string;
  onClose: () => void;
}

export function QrModal({ slug, url, onClose }: QrModalProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug}.png`;
    a.click();
  };

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slug}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">QR-код #{slug}</h3>
          <button type="button" className="text-sm text-neutral-500 hover:text-neutral-900" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="rounded-xl border border-neutral-200 p-3">
            <QRCodeSVG
              ref={svgRef}
              value={url}
              size={240}
              marginSize={2}
              imageSettings={{ src: "/brand/unq-mark.svg", width: 44, height: 44, excavate: true }}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={downloadPng}
            className="w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Скачать PNG 1000x1000
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
          >
            Скачать SVG
          </button>
        </div>

        <div className="hidden">
          <QRCodeCanvas
            ref={canvasRef}
            value={url}
            size={1000}
            marginSize={2}
            imageSettings={{ src: "/brand/unq-mark.svg", width: 180, height: 180, excavate: true }}
          />
        </div>
      </div>
    </div>
  );
}
