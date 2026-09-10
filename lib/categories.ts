import { prisma } from "@/lib/prisma";

export type UserCategory = {
  id: string;
  name: string;
  color: string;
};

// 사용자의 카테고리 목록 (만든 순).
export async function getCategories(userId: string): Promise<UserCategory[]> {
  return prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true },
  });
}
