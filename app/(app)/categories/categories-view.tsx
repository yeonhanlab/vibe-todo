"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LuPlus, LuTrash2, LuPencil, LuCheck, LuX } from "react-icons/lu";

import {
  categoryCreateSchema,
  type CategoryCreateInput,
} from "@/lib/validation";
import type { UserCategory } from "@/lib/categories";

const DEFAULT_COLOR = "#3b82f6";

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white dark:focus:ring-white";

export function CategoriesView({
  initialCategories,
}: {
  initialCategories: UserCategory[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryCreateInput>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: "", color: DEFAULT_COLOR },
  });

  async function onCreate(values: CategoryCreateInput) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      reset({ name: "", color: DEFAULT_COLOR });
      refresh();
    }
  }

  function startEdit(c: UserCategory) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    setBusyId(null);
    if (res.ok) {
      setEditingId(null);
      refresh();
    }
  }

  async function remove(c: UserCategory) {
    if (
      !window.confirm(
        `"${c.name}" 카테고리를 삭제할까요?\n이 카테고리를 쓰던 할 일은 그대로 남고 색만 사라집니다.`,
      )
    ) {
      return;
    }
    setBusyId(c.id);
    await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    setBusyId(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-tight">카테고리</h1>

      {/* 새 카테고리 */}
      <form
        onSubmit={handleSubmit(onCreate)}
        className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        noValidate
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-white">새 카테고리</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            {...register("color")}
            defaultValue={DEFAULT_COLOR}
            className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="색상"
          />
          <input
            {...register("name")}
            placeholder="이름 (예: 업무)"
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            aria-label="추가"
          >
            <LuPlus className="size-5" />
          </button>
        </div>
        {(errors.name || errors.color) && (
          <p className="text-sm text-red-600">
            {errors.name?.message ?? errors.color?.message}
          </p>
        )}
      </form>

      {/* 목록 */}
      <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {initialCategories.length === 0 ? (
          <li className="px-3 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            아직 카테고리가 없습니다.
          </li>
        ) : (
          initialCategories.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900"
                  aria-label="색상"
                />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`${inputClass} h-9 flex-1`}
                />
                <button
                  type="button"
                  onClick={() => saveEdit(c.id)}
                  disabled={busyId === c.id || editName.trim() === ""}
                  className="shrink-0 rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40"
                  aria-label="저장"
                >
                  <LuCheck className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="취소"
                >
                  <LuX className="size-5" />
                </button>
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className="size-3.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: c.color }}
                />
                <span className="flex-1 text-sm text-zinc-900 dark:text-white">{c.name}</span>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                  aria-label="수정"
                >
                  <LuPencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={busyId === c.id}
                  className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  aria-label="삭제"
                >
                  <LuTrash2 className="size-4" />
                </button>
              </li>
            ),
          )
        )}
      </ul>
    </div>
  );
}
