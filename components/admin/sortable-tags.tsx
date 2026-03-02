"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { UseFormRegister } from "react-hook-form";

import type { CardFormInput } from "@/types/card";

interface TagField {
  fieldId: string;
}

interface SortableTagsProps {
  fields: TagField[];
  register: UseFormRegister<CardFormInput>;
  remove: (index: number) => void;
  move: (oldIndex: number, newIndex: number) => void;
}

interface TagRowProps {
  id: string;
  index: number;
  register: UseFormRegister<CardFormInput>;
  remove: (index: number) => void;
}

function TagRow({ id, index, register, remove }: TagRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[auto_1fr_1fr_auto]"
    >
      <button
        type="button"
        className="mt-2 h-7 w-7 rounded-lg border border-neutral-300 text-neutral-500"
        aria-label="Drag"
        {...attributes}
        {...listeners}
      >
        ≡
      </button>

      <label className="text-xs font-medium text-neutral-600">
        Текст тега
        <input
          {...register(`tags.${index}.label`)}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm"
          placeholder="Top Dawg"
        />
      </label>

      <label className="text-xs font-medium text-neutral-600">
        Ссылка (необязательно)
        <input
          {...register(`tags.${index}.url`)}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm"
          placeholder="https://..."
        />
      </label>

      <button
        type="button"
        onClick={() => remove(index)}
        className="mt-6 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
      >
        Удалить
      </button>
    </div>
  );
}

export function SortableTags({ fields, register, remove, move }: SortableTagsProps) {
  const ids = fields.map((item) => item.fieldId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));

    if (oldIndex >= 0 && newIndex >= 0) {
      move(oldIndex, newIndex);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <TagRow key={field.fieldId} id={field.fieldId} index={index} register={register} remove={remove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
