import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeWeekdays } from "@/lib/routines";
import { routineUpdateSchema } from "@/lib/validation";

const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);

// PATCH /api/routines/:id — 이름 / 빈도 / 요일 / active 수정 (내 것만)
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
    return NextResponse.json({ error: "루틴을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = routineUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { frequency, weekdays, ...rest } = parsed.data;
  const data: Prisma.RoutineUpdateManyMutationInput = { ...rest };
  // 빈도가 함께 오면 요일도 그에 맞춰 정규화한다 (매일이면 빈 배열).
  if (frequency !== undefined) {
    data.frequency = frequency;
    data.weekdays =
      frequency === "WEEKLY" ? normalizeWeekdays(weekdays ?? []) : [];
  } else if (weekdays !== undefined) {
    data.weekdays = normalizeWeekdays(weekdays);
  }

  const result = await prisma.routine.updateMany({
    where: { id, userId: session.user.id },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "루틴을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/routines/:id — 삭제 (내 것만). 이 루틴에서 생성됐던 Todo 는 routineId 가 null 이 된다 (SetNull).
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
    return NextResponse.json({ error: "루틴을 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await prisma.routine.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "루틴을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
