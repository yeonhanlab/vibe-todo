import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

// 회원가입: 아이디 중복 확인 → 비밀번호 해시 → User 생성. (인증 불필요)
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다.", field: "username" },
      { status: 409 },
    );
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { username, password: hashed } });
  } catch (e) {
    // 동시 요청으로 인한 유니크 인덱스 충돌
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다.", field: "username" },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
