"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { AvatarUploader } from "@/components/admin/avatar-uploader";
import { SortableButtons } from "@/components/admin/sortable-buttons";
import { SortableTags } from "@/components/admin/sortable-tags";
import { DailyBarChart } from "@/components/charts/daily-bar-chart";
import { CardUpsertSchema } from "@/lib/validation";
import type { CardFormInput, DailyViewsPoint, DeviceSplit } from "@/types/card";

interface CardStatsView {
  totalViews: number;
  totalUniqueViews: number;
  series7d: DailyViewsPoint[];
  lastViewAt: string | null;
  deviceSplit: DeviceSplit;
}

interface CardEditorProps {
  mode: "create" | "edit";
  cardId?: string;
  initialValues: CardFormInput;
  initialAvatarUrl?: string | null;
  stats?: CardStatsView;
}

export function CardEditor({ mode, cardId, initialValues, initialAvatarUrl, stats }: CardEditorProps) {
  const router = useRouter();
  const [requestError, setRequestError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CardFormInput>({
    resolver: zodResolver(CardUpsertSchema) as never,
    defaultValues: initialValues,
  });

  const tags = useFieldArray({
    control,
    name: "tags",
    keyName: "fieldId",
  });

  const buttons = useFieldArray({
    control,
    name: "buttons",
    keyName: "fieldId",
  });

  const slugValue = watch("slug");
  const watchedTags = watch("tags");
  const tagsPreview = useMemo(() => {
    const labels = watchedTags.map((tag) => tag.label.trim()).filter(Boolean);
    return labels.join(" · ");
  }, [watchedTags]);

  const onGenerateSlug = async () => {
    setRequestError("");
    const response = await fetch("/api/admin/slug/next", { method: "POST" });
    if (!response.ok) {
      setRequestError("Не удалось сгенерировать slug");
      return;
    }

    const payload = (await response.json()) as { slug: string };
    setValue("slug", payload.slug, { shouldValidate: true });
  };

  const onPreview = () => {
    const slug = getValues("slug");
    if (!/^[A-Z]{3}[0-9]{3}$/.test(slug)) {
      setRequestError("Для предпросмотра нужен корректный slug (AAA001)");
      return;
    }

    window.open(`/${slug}`, "_blank", "noopener,noreferrer");
  };

  const onSubmit = handleSubmit(async (values) => {
    setRequestError("");

    const endpoint = mode === "create" ? "/api/admin/cards" : `/api/admin/cards/${cardId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setRequestError(payload.error ?? "Не удалось сохранить визитку");
      return;
    }

    const payload = (await response.json()) as { id: string };

    if (mode === "create") {
      router.push(`/admin/cards/${payload.id}/edit`);
      return;
    }

    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-bold">Основные данные</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-neutral-700">
            Slug
            <div className="mt-1 flex gap-2">
              <input type="hidden" {...register("slug")} />
              <input
                value={slugValue ?? ""}
                onChange={(event) =>
                  setValue("slug", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6), {
                    shouldValidate: true,
                  })
                }
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder="AAA001"
              />
              <button
                type="button"
                onClick={onGenerateSlug}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-100"
              >
                Авто
              </button>
            </div>
            {errors.slug ? <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p> : null}
          </label>

          <label className="mt-7 flex items-center gap-2 text-sm font-medium text-neutral-700 md:mt-0 md:self-end">
            <input type="checkbox" {...register("isActive")} />
            Активна
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Имя клиента
            <input {...register("name")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Телефон
            <input {...register("phone")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
            {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p> : null}
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Нижний хэштег
            <input {...register("hashtag")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </label>

          <label className="mt-7 flex items-center gap-2 text-sm font-medium text-neutral-700 md:mt-0 md:self-end">
            <input type="checkbox" {...register("verified")} />
            Верифицирован
          </label>
        </div>

        <div className="mt-4">
          <AvatarUploader cardId={cardId} avatarUrl={avatarUrl} onUploaded={setAvatarUrl} />
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Теги-ссылки</h2>
          <button
            type="button"
            onClick={() => tags.append({ label: "", url: undefined })}
            className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
          >
            + Добавить тег
          </button>
        </div>

        <div className="mt-3">
          <SortableTags fields={tags.fields} register={register} remove={tags.remove} move={tags.move} />
        </div>

        <p className="mt-3 text-sm text-blue-700">{tagsPreview || "Предпросмотр: теги появятся после ввода"}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Кнопки</h2>
          <button
            type="button"
            onClick={() => buttons.append({ label: "", url: "https://", isActive: true })}
            className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
          >
            + Добавить кнопку
          </button>
        </div>

        <div className="mt-3">
          <SortableButtons fields={buttons.fields} register={register} remove={buttons.remove} move={buttons.move} />
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-bold">Контакты</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-neutral-700">
            Адрес
            <input {...register("address")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Индекс
            <input {...register("postcode")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Email
            <input {...register("email")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Дополнительный телефон
            <input {...register("extraPhone")} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </label>
        </div>
      </section>

      {mode === "edit" && stats ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-bold">Статистика</h2>
          <div className="mt-3 grid gap-2 text-sm text-neutral-700 md:grid-cols-3">
            <p>
              <span className="font-semibold">Всего просмотров:</span> {stats.totalViews}
            </p>
            <p>
              <span className="font-semibold">Уникальные просмотры:</span> {stats.totalUniqueViews}
            </p>
            <p>
              <span className="font-semibold">Последний просмотр:</span>{" "}
              {stats.lastViewAt ? new Date(stats.lastViewAt).toLocaleString("ru-RU") : "Нет данных"}
            </p>
            <p>
              <span className="font-semibold">Mobile/Desktop:</span> {stats.deviceSplit.mobile}/{stats.deviceSplit.desktop}
            </p>
          </div>

          <div className="mt-3">
            <DailyBarChart data={stats.series7d} />
          </div>
        </section>
      ) : null}

      {requestError ? <p className="text-sm text-red-600">{requestError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {isSubmitting ? "Сохранение..." : "Сохранить"}
        </button>

        <button
          type="button"
          onClick={onPreview}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
        >
          Предпросмотр
        </button>

        <Link
          href="/admin/dashboard"
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
