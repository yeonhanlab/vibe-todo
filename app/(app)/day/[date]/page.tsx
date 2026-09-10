import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTodosForDate } from "@/lib/todos";
import { getCategories } from "@/lib/categories";
import { formatKorean, isValidDateStr, todayStr } from "@/lib/date";
import { DayView } from "./day-view";

// 특정 날짜의 할 일 페이지 (서버 컴포넌트).
// DB에서 목록을 읽어 클라이언트 컴포넌트 <DayView>에 넘긴다.
export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  // 잘못된 날짜 형식이면 오늘로 보정
  if (!isValidDateStr(date)) {
    redirect(`/day/${todayStr()}`);
  }

  // (app) 레이아웃에서 이미 확인하지만, 여기서 userId 타입을 좁히기 위해 다시 읽는다. (쿠키만 읽음, DB 조회 없음)
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [todos, categories] = await Promise.all([
    getTodosForDate(session.user.id, date),
    getCategories(session.user.id),
  ]);

  return (
    <DayView
      date={date}
      today={todayStr()}
      label={formatKorean(date)}
      initialTodos={todos}
      categories={categories}
    />
  );
}
