import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todoUpdateSchema } from "@/lib/validation";

// MongoDB ObjectId 형식이 아니면 Prisma가 예외를 던지므로 미리 걸러낸다.
const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);

// PATCH /api/todos/:id  — 완료 여부 / 제목 수정 (내 것만)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  if (!isObjectId(id)) {
    return NextResponse.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = todoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  // 카테고리를 지정하는 경우, 그 카테고리가 내 것인지 확인 (null 은 해제이므로 통과)
  if (typeof parsed.data.categoryId === "string") {
    const owned = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 400 },
      );
    }
  }

  // 소유권 격리: id + userId 가 모두 맞아야 수정된다.
  const result = await prisma.todo.updateMany({
    where: { id, userId: session.user.id },
    data: parsed.data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/todos/:id  — 삭제 (내 것만)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  if (!isObjectId(id)) {
    return NextResponse.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await prisma.todo.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
