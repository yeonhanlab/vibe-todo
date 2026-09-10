import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { todayStr } from "@/lib/date";
import { Header } from "@/components/header";

// (app) 라우트 그룹: /day, /routines 가 공유하는 레이아웃.
// 괄호 폴더라 URL에는 나타나지 않는다.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // middleware 로 이미 막지만, 서버에서 한 번 더 확인한다 (방어적).
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header username={session.user.name ?? "사용자"} todayDate={todayStr()} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
