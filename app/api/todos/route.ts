import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTodosForDate, nextOrderForDate } from "@/lib/todos";
import { isValidDateStr } from "@/lib/date";
import { todoCreateSchema } from "@/lib/validation";

// GET /api/todos?date=YYYY-MM-DD  — 해당 날짜의 내 할 일 목록
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date");
  if (!date || !isValidDateStr(date)) {
    return NextResponse.json(
      { error: "date 파라미터(YYYY-MM-DD)가 필요합니다." },
      { status: 400 },
    );
  }

  const todos = await getTodosForDate(session.user.id, date);
  return NextResponse.json(todos);
}

// POST /api/todos  — 할 일 추가
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

  const parsed = todoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { title, date, categoryId } = parsed.data;

  // 넘어온 카테고리가 내 카테고리인지 확인
  if (categoryId) {
    const owned = await prisma.category.findFirst({
      where: { id: categoryId, userId: session.user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 400 },
      );
    }
  }

  const order = await nextOrderForDate(session.user.id, date);

  const todo = await prisma.todo.create({
    data: {
      title,
      date,
      order,
      userId: session.user.id,
      categoryId: categoryId ?? null,
    },
    select: {
      id: true,
      title: true,
      completed: true,
      routineId: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json(todo, { status: 201 });
}
