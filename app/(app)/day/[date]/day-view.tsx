"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LuChevronLeft,
  LuChevronRight,
  LuCircle,
  LuGripVertical,
  LuPlus,
  LuRepeat,
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
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white dark:focus:ring-white";

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

  // 드래그 재정렬을 위해 로컬 상태로 들고, 서버 재조회 결과(initialTodos)가 바뀌면 동기화한다.
  // (다른 조작 — 완료/삭제/카테고리 변경 — 은 기존대로 refresh() 후 이 동기화로 반영된다.)
  // useEffect 대신 렌더 중 비교로 처리한다: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [todos, setTodos] = useState<DayTodo[]>(initialTodos);
  const [prevInitialTodos, setPrevInitialTodos] = useState(initialTodos);
  if (initialTodos !== prevInitialTodos) {
    setPrevInitialTodos(initialTodos);
    setTodos(initialTodos);
  }

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

  const doneCount = todos.filter((t) => t.completed).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(todos, oldIndex, newIndex);
    setTodos(reordered); // 드래그 반응성을 위해 먼저 반영

    const res = await fetch("/api/todos/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, orderedIds: reordered.map((t) => t.id) }),
    });
    if (!res.ok) {
      setTodos(todos); // 저장 실패 시 되돌린다
      return;
    }
    refresh();
  }

  const navBtn =
    "flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900";

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

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-300">
        {todos.length === 0 ? "할 일 없음" : `${doneCount} / ${todos.length} 완료`}
      </p>

      {/* 추가: 평소엔 버튼, 누르면 패널 펼침 */}
      {adding ? (
        <form
          onSubmit={handleSubmit(onAdd)}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          noValidate
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-white">할 일 추가</span>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                reset({ title: "", categoryId: "" });
              }}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
              className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
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
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <LuPlus className="size-4" />
          할 일 추가
        </button>
      )}

      {/* 목록 (드래그로 순서 변경 가능) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={todos.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {todos.length === 0 ? (
              <li className="px-3 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                이 날짜에 등록된 할 일이 없습니다.
              </li>
            ) : (
              todos.map((todo) => (
                <SortableTodoRow
                  key={todo.id}
                  todo={todo}
                  busyId={busyId}
                  catMenuId={catMenuId}
                  categories={categories}
                  onToggle={toggle}
                  onRemove={remove}
                  onCategoryMenuOpen={setCatMenuId}
                  onCategoryChange={changeCategory}
                />
              ))
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableTodoRow({
  todo,
  busyId,
  catMenuId,
  categories,
  onToggle,
  onRemove,
  onCategoryMenuOpen,
  onCategoryChange,
}: {
  todo: DayTodo;
  busyId: string | null;
  catMenuId: string | null;
  categories: UserCategory[];
  onToggle: (todo: DayTodo) => void;
  onRemove: (todo: DayTodo) => void;
  onCategoryMenuOpen: (id: string | null) => void;
  onCategoryChange: (todo: DayTodo, categoryId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 ${isDragging ? "relative z-10 bg-zinc-50 dark:bg-zinc-900" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 touch-none cursor-grab text-zinc-300 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:text-zinc-400"
        aria-label="드래그하여 순서 변경"
      >
        <LuGripVertical className="size-4" />
      </button>

      <button
        type="button"
        onClick={() => onToggle(todo)}
        disabled={busyId === todo.id}
        className="shrink-0 disabled:opacity-40"
        aria-label={todo.completed ? "완료 취소" : "완료"}
      >
        {todo.completed ? (
          <LuCircle className="size-5 fill-zinc-900 text-zinc-900 dark:fill-white dark:text-white" />
        ) : (
          <LuCircle className="size-5 text-zinc-300 dark:text-zinc-600" />
        )}
      </button>

      <span
        className={`flex-1 text-sm ${
          todo.completed
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : "text-zinc-900 dark:text-white"
        }`}
      >
        {todo.title}
      </span>

      {/* 루틴에서 자동으로 채워진 항목 표시 */}
      {todo.routineId && (
        <LuRepeat
          className="size-3.5 shrink-0 text-zinc-300 dark:text-zinc-600"
          aria-label="반복 루틴에서 생성됨"
        />
      )}

      {/* 카테고리 색 점 → 클릭 시 인라인 선택 */}
      {catMenuId === todo.id ? (
        <select
          autoFocus
          defaultValue={todo.category?.id ?? ""}
          onChange={(e) => onCategoryChange(todo, e.target.value)}
          onBlur={() => onCategoryMenuOpen(null)}
          disabled={busyId === todo.id}
          className="h-8 shrink-0 rounded-md border border-zinc-300 bg-white px-1 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
            categories.length > 0 ? onCategoryMenuOpen(todo.id) : undefined
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
              todo.category ? { backgroundColor: todo.category.color } : undefined
            }
          />
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(todo)}
        disabled={busyId === todo.id}
        className="shrink-0 text-zinc-400 transition hover:text-red-600 disabled:opacity-40"
        aria-label="삭제"
      >
        <LuTrash2 className="size-4" />
      </button>
    </li>
  );
}
