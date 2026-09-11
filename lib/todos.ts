import { prisma } from "@/lib/prisma";
import { todayStr, weekdayOf } from "@/lib/date";

// 목록에서 쓰는 카테고리 정보 (색 점 표시용)
export type TodoCategory = {
  id: string;
  name: string;
  color: string;
};

// 화면에 넘길 최소한의 할 일 정보
export type DayTodo = {
  id: string;
  title: string;
  completed: boolean;
  routineId: string | null;
  category: TodoCategory | null;
};

// 특정 날짜의 할 일 목록을 반환한다. 조회 전에 그 날짜 요일에 해당하는 활성 루틴을
// 먼저 Todo로 지연 생성한다(RFC-0002, ADR-0004). order를 지정한 항목이 있으면 그 순서를,
// 아직 아무도 순서를 정하지 않은 날짜면 만든 순서(createdAt)를 그대로 따른다. (ADR-0007)
export async function getTodosForDate(
  userId: string,
  date: string,
): Promise<DayTodo[]> {
  await materializeRoutineTodos(userId, date);

  return prisma.todo.findMany({
    where: { userId, date },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      completed: true,
      routineId: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });
}

// 활성 루틴 중 이 날짜의 요일에 해당하는데 아직 이 날짜의 Todo가 없는 것만 생성한다.
// 과거 날짜(오늘보다 이전)는 소급 생성하지 않고 조회만 한다.
async function materializeRoutineTodos(
  userId: string,
  date: string,
): Promise<void> {
  if (date < todayStr()) return;

  const routines = await prisma.routine.findMany({
    where: { userId, active: true, startDate: { lte: date } },
    select: { id: true, title: true, frequency: true, weekdays: true },
  });
  if (routines.length === 0) return;

  const weekday = weekdayOf(date);
  const due = routines.filter(
    (r) =>
      r.frequency === "DAILY" ||
      (r.frequency === "WEEKLY" && r.weekdays.includes(weekday)),
  );
  if (due.length === 0) return;

  const existing = await prisma.todo.findMany({
    where: { userId, date, routineId: { in: due.map((r) => r.id) } },
    select: { routineId: true },
  });
  const alreadyMade = new Set(existing.map((t) => t.routineId));
  const toCreate = due.filter((r) => !alreadyMade.has(r.id));
  if (toCreate.length === 0) return;

  // 같은 order 정책을 따른다(ADR-0007): 이 날짜에 이미 순서가 있으면 이어서 부여,
  // 없으면 전부 null로 두고 createdAt 순서를 따르게 한다.
  let cursor = await nextOrderForDate(userId, date);

  await prisma.todo.createMany({
    data: toCreate.map((r) => ({
      userId,
      title: r.title,
      date,
      routineId: r.id,
      order: cursor === null ? null : cursor++,
    })),
  });
}

// 새 할 일에 부여할 order 값. 그 날짜에 이미 순서를 정한(order != null) 항목이 있으면
// 맨 뒤(최댓값 + 1)에 붙이고, 아직 아무도 순서를 정하지 않은 날짜면 null을 반환해
// createdAt 순서를 그대로 따르게 둔다(ADR-0007 — 드래그 전까지는 order 컬럼을 건드리지 않는다).
export async function nextOrderForDate(
  userId: string,
  date: string,
): Promise<number | null> {
  const existing = await prisma.todo.findMany({
    where: { userId, date },
    select: { order: true },
  });
  const maxOrder = existing.reduce(
    (max, t) => (t.order !== null && t.order > max ? t.order : max),
    -1,
  );
  return maxOrder === -1 ? null : maxOrder + 1;
}
