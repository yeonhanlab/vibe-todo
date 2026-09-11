"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LuCalendarDays, LuTag, LuRepeat, LuLogOut } from "react-icons/lu";

// 보호 페이지 상단 공통 헤더. username / todayDate 는 서버 레이아웃에서 내려준다.
export function Header({
  username,
  todayDate,
}: {
  username: string;
  todayDate: string;
}) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    [
      "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition",
      active
        ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
    ].join(" ");

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1 px-3 py-3">
        <nav className="flex items-center gap-0.5">
          <Link
            href={`/day/${todayDate}`}
            className={linkClass(pathname.startsWith("/day"))}
          >
            <LuCalendarDays className="size-4 shrink-0" />
            오늘
          </Link>
          <Link
            href="/categories"
            className={linkClass(pathname.startsWith("/categories"))}
          >
            <LuTag className="size-4 shrink-0" />
            카테고리
          </Link>
          <Link
            href="/routines"
            className={linkClass(pathname.startsWith("/routines"))}
          >
            <LuRepeat className="size-4 shrink-0" />
            루틴
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          title={username}
        >
          <LuLogOut className="size-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </header>
  );
}
