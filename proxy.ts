import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16에서 "middleware" 규칙이 "proxy"로 이름이 바뀌었다. 역할은 동일하다:
// 매 요청마다 authConfig.callbacks.authorized 를 실행하고,
// 보호 경로인데 로그인 안 됐으면 /login?callbackUrl=... 로 돌려보낸다.
// authConfig 는 Prisma/bcrypt 를 import 하지 않으므로 Edge 런타임에서 안전하다.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // 이 경로들만 검사한다. (정적 파일, /api/auth/*, /login, /register 등은 통과)
  matcher: ["/day", "/day/:path*", "/routines", "/routines/:path*"],
};
