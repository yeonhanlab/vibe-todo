"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCircle, LuPlus, LuPencil, LuTrash2, LuCheck, LuX } from "react-icons/lu";

import { WEEKDAY_LABELS } from "@/lib/date";
import { routineCreateSchema } from "@/lib/validation";
import type { UserRoutine } from "@/lib/routines";

type Freq = "DAILY" | "WEEKLY";

function freqLabel(r: Pick<UserRoutine, "frequency" | "weekdays">): string {
  if (r.frequency === "DAILY") return "매일";
  const days = [...r.weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join("·");
  return `매주 ${days}`;
}

function FreqToggle({
  value,
  onChange,
}: {
  value: Freq;
  onChange: (f: Freq) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
      {(["DAILY", "WEEKLY"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`rounded-md px-3 py-1 font-medium transition ${
            value === f
              ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
              : "text-zinc-600 dark:text-zinc-300"
          }`}
        >
          {f === "DAILY" ? "매일" : "매주"}
        </button>
      ))}
    </div>
  );
}

function WeekdayToggles({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <div className="flex gap-1">
      {WEEKDAY_LABELS.map((label, i) => {
        const on = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() =>
              onChange(on ? value.filter((d) => d !== i) : [...value, i])
            }
            className={`size-8 rounded-md text-sm font-medium transition ${
              on
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white dark:focus:ring-white";

export function RoutinesView({
  initialRoutines,
}: {
  initialRoutines: UserRoutine[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [busyId, setBusyId] = useState<string | null>(null);

  // 새 루틴
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<Freq>("DAILY");
  const [days, setDays] = useState<number[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // 인라인 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eFreq, setEFreq] = useState<Freq>("DAILY");
  const [eDays, setEDays] = useState<number[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = routineCreateSchema.safeParse({
      title,
      frequency: freq,
      weekdays: freq === "WEEKLY" ? days : [],
    });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    const res = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setCreating(false);
    if (res.ok) {
      setTitle("");
      setFreq("DAILY");
      setDays([]);
      refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.error ?? "추가에 실패했습니다.");
    }
  }

  function startEdit(r: UserRoutine) {
    setEditingId(r.id);
    setETitle(r.title);
    setEFreq(r.frequency);
    setEDays(r.weekdays);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (eTitle.trim() === "") {
      setEditError("루틴 이름을 입력하세요.");
      return;
    }
    if (eFreq === "WEEKLY" && eDays.length === 0) {
      setEditError("요일을 하나 이상 선택하세요.");
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/routines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eTitle,
        frequency: eFreq,
        weekdays: eFreq === "WEEKLY" ? eDays : [],
      }),
    });
    setBusyId(null);
    if (res.ok) {
      setEditingId(null);
      refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setEditError(d.error ?? "저장에 실패했습니다.");
    }
  }

  async function toggleActive(r: UserRoutine) {
    setBusyId(r.id);
    await fetch(`/api/routines/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    });
    setBusyId(null);
    refresh();
  }

  async function remove(r: UserRoutine) {
    if (!window.confirm(`"${r.title}" 루틴을 삭제할까요?`)) return;
    setBusyId(r.id);
    await fetch(`/api/routines/${r.id}`, { method: "DELETE" });
    setBusyId(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">루틴</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">
          매일 또는 매주 반복되는 할 일. 해당 날짜를 열면 그 날 목록에 자동으로
          추가됩니다.
        </p>
      </div>

      {/* 새 루틴 */}
      <form
        onSubmit={onCreate}
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-white">새 루틴</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="이름 (예: 물 마시기)"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FreqToggle value={freq} onChange={setFreq} />
          <button
            type="submit"
            disabled={creating}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <LuPlus className="size-4" />
            추가
          </button>
        </div>
        {freq === "WEEKLY" && (
          <WeekdayToggles value={days} onChange={setDays} />
        )}
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </form>

      {/* 목록 */}
      <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {initialRoutines.length === 0 ? (
          <li className="px-3 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            아직 루틴이 없습니다.
          </li>
        ) : (
          initialRoutines.map((r) =>
            editingId === r.id ? (
              <li key={r.id} className="flex flex-col gap-3 px-3 py-3">
                <input
                  value={eTitle}
                  onChange={(e) => setETitle(e.target.value)}
                  className={inputClass}
                />
                <div className="flex items-center gap-2">
                  <FreqToggle value={eFreq} onChange={setEFreq} />
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => saveEdit(r.id)}
                      disabled={busyId === r.id}
                      className="rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40"
                      aria-label="저장"
                    >
                      <LuCheck className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      aria-label="취소"
                    >
                      <LuX className="size-5" />
                    </button>
                  </div>
                </div>
                {eFreq === "WEEKLY" && (
                  <WeekdayToggles value={eDays} onChange={setEDays} />
                )}
                {editError && (
                  <p className="text-sm text-red-600">{editError}</p>
                )}
              </li>
            ) : (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleActive(r)}
                  disabled={busyId === r.id}
                  className="shrink-0 disabled:opacity-40"
                  aria-label={r.active ? "일시중지" : "재개"}
                  title={r.active ? "활성 (클릭하면 중지)" : "중지됨 (클릭하면 재개)"}
                >
                  {r.active ? (
                    <LuCircle className="size-5 fill-zinc-900 text-zinc-900 dark:fill-white dark:text-white" />
                  ) : (
                    <LuCircle className="size-5 text-zinc-300 dark:text-zinc-600" />
                  )}
                </button>

                <div className="flex flex-1 flex-col">
                  <span
                    className={`text-sm ${
                      r.active
                        ? "text-zinc-900 dark:text-white"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {r.title}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {freqLabel(r)}
                    {!r.active && " · 중지됨"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                  aria-label="수정"
                >
                  <LuPencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(r)}
                  disabled={busyId === r.id}
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
