import { prisma } from "@/lib/prisma";

export type UserRoutine = {
  id: string;
  title: string;
  frequency: "DAILY" | "WEEKLY";
  weekdays: number[];
  active: boolean;
};

// 사용자의 루틴 목록 (만든 순).
export async function getRoutines(userId: string): Promise<UserRoutine[]> {
  return prisma.routine.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      frequency: true,
      weekdays: true,
      active: true,
    },
  });
}

// 요일 배열 정규화: 중복 제거 + 오름차순
export function normalizeWeekdays(days: number[]): number[] {
  return [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
}
