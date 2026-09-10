import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { todayStr } from "@/lib/date";

// 홈: 로그인 상태에 따라 갈 곳을 정한다.
export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(`/day/${todayStr()}`);
  }
  redirect("/login");
}
