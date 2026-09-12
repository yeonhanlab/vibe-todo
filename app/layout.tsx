import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "toDo",
  description: "매일의 할 일과 반복 루틴을 관리하는 개인용 ToDo 앱",
  // 홈 화면에 추가 시 Safari 주소창 없이 standalone 앱처럼 뜨게 한다.
  // (기존 홈 화면 아이콘은 추가 당시 상태로 고정돼 있어 반영되지 않는다 — 삭제 후 다시 추가해야 함)
  appleWebApp: {
    capable: true,
    title: "toDo",
    statusBarStyle: "default",
  },
  other: {
    // 이 Next 버전은 표준 mobile-web-app-capable만 자동 생성하므로,
    // 구형 iOS도 standalone으로 인식하게 apple 접두사 버전을 직접 추가한다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-black dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
