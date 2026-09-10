import { prisma } from "@/lib/prisma";

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

// 특정 날짜의 할 일 목록을 만든 순서대로 반환한다.
// (Phase 8에서 이 함수 앞단에 "그 날 요일에 해당하는 루틴을 Todo로 지연 생성" 로직이 추가된다.)
export async function getTodosForDate(
  userId: string,
  date: string,
): Promise<DayTodo[]> {
  return prisma.todo.findMany({
    where: { userId, date },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      completed: true,
      routineId: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });
}
