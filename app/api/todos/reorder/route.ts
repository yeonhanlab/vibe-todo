import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reorderSchema } from "@/lib/validation";

// PATCH /api/todos/reorder — 그 날짜 목록 전체의 순서를 한 번에 저장한다 (ADR-0007).
// body: { date, orderedIds } — orderedIds는 그 날짜의 내 할 일 id를 원하는 순서대로 나열한 것.
export async function PATCH(request: Request) {
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

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  const { date, orderedIds } = parsed.data;

  // orderedIds가 전부 "그 날짜에 속한 내 할 일"인지 개수로 대조한다.
  // (다른 사용자의 항목이나 다른 날짜 항목이 섞여 있으면 개수가 어긋난다.)
  const count = await prisma.todo.count({
    where: { userId: session.user.id, date, id: { in: orderedIds } },
  });
  if (count !== orderedIds.length) {
    return NextResponse.json(
      { error: "요청한 목록이 실제 항목과 일치하지 않습니다." },
      { status: 400 },
    );
  }

  // 소유권 격리 유지: 각 업데이트도 updateMany + {id, userId}로 건다.
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.todo.updateMany({
        where: { id, userId: session.user.id },
        data: { order: index },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
