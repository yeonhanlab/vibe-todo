import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRoutines, normalizeWeekdays } from "@/lib/routines";
import { todayStr } from "@/lib/date";
import { routineCreateSchema } from "@/lib/validation";

// GET /api/routines — 내 루틴 목록
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json(await getRoutines(session.user.id));
}

// POST /api/routines — 루틴 생성 (startDate 는 서버가 오늘로 설정)
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

  const parsed = routineCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { title, frequency } = parsed.data;
  const weekdays =
    frequency === "WEEKLY" ? normalizeWeekdays(parsed.data.weekdays) : [];

  const routine = await prisma.routine.create({
    data: {
      title,
      frequency,
      weekdays,
      startDate: todayStr(),
      userId: session.user.id,
    },
    select: {
      id: true,
      title: true,
      frequency: true,
      weekdays: true,
      active: true,
    },
  });
  return NextResponse.json(routine, { status: 201 });
}
