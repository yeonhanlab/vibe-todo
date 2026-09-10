import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/categories";
import { categoryCreateSchema } from "@/lib/validation";

// GET /api/categories — 내 카테고리 목록
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json(await getCategories(session.user.id));
}

// POST /api/categories — 카테고리 생성
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const category = await prisma.category.create({
    data: { ...parsed.data, userId: session.user.id },
    select: { id: true, name: true, color: true },
  });
  return NextResponse.json(category, { status: 201 });
}
