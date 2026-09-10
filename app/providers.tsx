"use client";

import { SessionProvider } from "next-auth/react";

// 클라이언트 컴포넌트에서 useSession() 등을 쓸 수 있도록 앱 전체를 감싼다.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
