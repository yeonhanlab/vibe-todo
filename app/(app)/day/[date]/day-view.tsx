"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LuChevronLeft,
  LuChevronRight,
  LuCircle,
  LuPlus,
  LuTrash2,
  LuX,
} from "react-icons/lu";

import { addDays } from "@/lib/date";
import { todoTitleSchema } from "@/lib/validation";
import type { DayTodo } from "@/lib/todos";
import type { UserCategory } from "@/lib/categories";

// 추가 폼: 제목 + 카테고리(빈 문자열 = 없음)
const addFormSchema = todoTitleSchema.extend({ categoryId: z.string() });
type AddFormValues = z.infer<typeof addFormSchema>;

const fieldClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

export function DayView({
  date,
  today,
  label,
  initialTodos,
  categories,
}: {
  date: string;
  today: string;
  label: string;
  initialTodos: DayTodo[];
  categories: UserCategory[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [catMenuId, setCatMenuId] = useState<string | null>(null);

  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);
  const isToday = date === today;

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<AddFormValues>({
    resolver: zodResolver(addFormSchema),
    defaultValues: { title: "", categoryId: "" },
  });

  const doneCount = initialTodos.filter((t) => t.completed).length;

  async function onAdd(values: AddFormValues) {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        date,
        categoryId: values.categoryId || undefined,
      }),
    });
    if (res.ok) {
      // 패널은 열어둔 채 제목만 비우고 계속 입력할 수 있게 한다.
      reset({ title: "", categoryId: values.categoryId });
      setFocus("title");
      refresh();
    }
  }

  async function toggle(todo: DayTodo) {
    setBusyId(todo.id);
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });
    setBusyId(null);
    refresh();
  }

  async function remove(todo: DayTodo) {
    setBusyId(todo.id);
    await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
    setBusyId(null);
    refresh();
  }

  async function changeCategory(todo: DayTodo, categoryId: string) {
    setBusyId(todo.id);
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId === "" ? null : categoryId }),
    });
    setBusyId(null);
    setCatMenuId(null);
    refresh();
  }

  const navBtn =
    "flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50";

  return (
    <div className="flex flex-col gap-4">
      {/* 날짜 이동 */}
      <div className="flex items-center justify-between gap-2">
        <Link href={`/day/${prevDate}`} className={navBtn} aria-label="이전 날짜">
          <LuChevronLeft className="size-5" />
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="text-base font-semibold tracking-tight">{label}</h1>
          {isToday ? (
            <span className="mt-0.5 text-xs font-medium text-zinc-400">오늘</span>
          ) : (
            <Link
              href={`/day/${today}`}
              className="mt-0.5 text-xs font-medium text-blue-600 hover:underline"
            >
              오늘로 가기
            </Link>
          )}
        </div>
        <Link href={`/day/${nextDate}`} className={navBtn} aria-label="다음 날짜">
          <LuChevronRight className="size-5" />
        </Link>
      </div>

      <p className="text-center text-sm text-zinc-500">
        {initialTodos.length === 0
          ? "할 일 없음"
          : `${doneCount} / ${initialTodos.length} 완료`}
      </p>

      {/* 추가: 평소엔 버튼, 누르면 패널 펼침 */}
      {adding ? (
        <form
          onSubmit={handleSubmit(onAdd)}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3"
          noValidate
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">할 일 추가</span>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                reset({ title: "", categoryId: "" });
              }}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
              aria-label="닫기"
            >
              <LuX className="size-4" />
            </button>
          </div>

          <select {...register("categoryId")} className={fieldClass}>
            <option value="">카테고리 없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {categories.length === 0 && (
            <Link
              href="/categories"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              + 카테고리 만들기
            </Link>
          )}

          <div className="flex gap-2">
            <input
              {...register("title")}
              autoFocus
              placeholder="할 일 입력…"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
            >
              추가
            </button>
          </div>
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          <LuPlus className="size-4" />
          할 일 추가
        </button>
      )}

      {/* 목록 */}
      <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
        {initialTodos.length === 0 ? (
          <li className="px-3 py-10 text-center text-sm text-zinc-400">
            이 날짜에 등록된 할 일이 없습니다.
          </li>
        ) : (
          initialTodos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggle(todo)}
                disabled={busyId === todo.id}
                className="shrink-0 disabled:opacity-40"
                aria-label={todo.completed ? "완료 취소" : "완료"}
              >
                {todo.completed ? (
                  <LuCircle className="size-5 fill-zinc-900 text-zinc-900" />
                ) : (
                  <LuCircle className="size-5 text-zinc-300" />
                )}
              </button>

              <span
                className={`flex-1 text-sm ${
                  todo.completed
                    ? "text-zinc-400 line-through"
                    : "text-zinc-900"
                }`}
              >
                {todo.title}
              </span>

              {/* 카테고리 색 점 → 클릭 시 인라인 선택 */}
              {catMenuId === todo.id ? (
                <select
                  autoFocus
                  defaultValue={todo.category?.id ?? ""}
                  onChange={(e) => changeCategory(todo, e.target.value)}
                  onBlur={() => setCatMenuId(null)}
                  disabled={busyId === todo.id}
                  className="h-8 shrink-0 rounded-md border border-zinc-300 bg-white px-1 text-xs outline-none"
                >
                  <option value="">없음</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    categories.length > 0 ? setCatMenuId(todo.id) : undefined
                  }
                  className="shrink-0"
                  aria-label="카테고리"
                  title={todo.category?.name ?? "카테고리 없음"}
                >
                  <span
                    className={`block size-3.5 rounded-full ${
                      todo.category
                        ? "border border-black/10"
                        : "border border-dashed border-zinc-300"
                    }`}
                    style={
                      todo.category
                        ? { backgroundColor: todo.category.color }
                        : undefined
                    }
                  />
                </button>
              )}

              <button
                type="button"
                onClick={() => remove(todo)}
                disabled={busyId === todo.id}
                className="shrink-0 text-zinc-400 transition hover:text-red-600 disabled:opacity-40"
                aria-label="삭제"
              >
                <LuTrash2 className="size-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
