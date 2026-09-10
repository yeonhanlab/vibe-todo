import { PrismaClient } from "@prisma/client";

// Next.js dev 환경에서 HMR로 인해 PrismaClient 인스턴스가 계속 늘어나는 것을 방지한다.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
