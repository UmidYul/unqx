"use client";

import { useMemo, useRef, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface AvatarUploaderProps {
  cardId?: string;
  avatarUrl?: string | null;
  onUploaded: (url: string) => void;
}

function getDefaultCrop(): Crop {
  return { unit: "%", x: 10, y: 10, width: 80, height: 80 };
}

function computeSourceRect(crop: Crop, image: HTMLImageElement) {
  if (crop.unit === "%") {
    return {
      sx: (crop.x / 100) * image.naturalWidth,
      sy: (crop.y / 100) * image.naturalHeight,
      sWidth: (crop.width / 100) * image.naturalWidth,
      sHeight: (crop.height / 100) * image.naturalHeight,
    };
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  return {
    sx: crop.x * scaleX,
    sy: crop.y * scaleY,
    sWidth: crop.width * scaleX,
    sHeight: crop.height * scaleY,
  };
}

export function AvatarUploader({ cardId, avatarUrl, onUploaded }: AvatarUploaderProps) {
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>(getDefaultCrop());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const canUpload = Boolean(cardId);

  const preview = useMemo(() => source ?? avatarUrl ?? null, [source, avatarUrl]);

  const readFile = (file?: File) => {
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
    setSource(URL.createObjectURL(file));
    setCrop(getDefaultCrop());
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    readFile(event.dataTransfer.files[0]);
  };

  const onUpload = async () => {
    if (!cardId || !imageRef.current || !crop.width || !crop.height) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const image = imageRef.current;
      const { sx, sy, sWidth, sHeight } = computeSourceRect(crop, image);

      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas not supported");
      }

      ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, 400, 400);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) {
        throw new Error("Failed to process image");
      }

      const file = new File([blob], "avatar.webp", { type: "image/webp" });
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/cards/${cardId}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }

      const data = (await response.json()) as { avatarUrl: string };
      onUploaded(data.avatarUrl);
      setSource(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-800">Аватар</h3>

      {!canUpload ? (
        <p className="rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          Для загрузки аватара сначала сохраните визитку.
        </p>
      ) : null}

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-600"
      >
        <p>Перетащите файл сюда или выберите вручную</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
        >
          Выбрать файл
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => readFile(event.target.files?.[0])}
        />
      </div>

      {preview ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          {source ? (
            <ReactCrop crop={crop} onChange={(value) => setCrop(value)} aspect={1} circularCrop>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source}
                alt="Crop preview"
                ref={imageRef}
                className="max-h-[260px] w-auto"
                onLoad={() => setCrop(getDefaultCrop())}
              />
            </ReactCrop>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Avatar" className="h-24 w-24 rounded-full object-cover" />
          )}
        </div>
      ) : null}

      {source && canUpload ? (
        <button
          type="button"
          disabled={pending}
          onClick={onUpload}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Загрузка..." : "Сохранить обрезку"}
        </button>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
