import type { NextAuthConfig } from "next-auth";

// Edge(미들웨어)에서도 로드되는 "가벼운" 설정.
// Prisma / bcrypt 같은 Node 전용 코드는 여기에 두지 않는다. (실제 검증 로직은 auth.ts)
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    // Credentials provider는 DB 세션(어댑터)을 지원하지 않으므로 JWT 전략을 쓴다.
    strategy: "jwt",
  },
  providers: [], // auth.ts에서 Credentials provider를 채운다.
  callbacks: {
    // 미들웨어가 요청마다 호출한다. 보호 경로면 로그인 여부를 반환한다.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = ["/day", "/routines"];
      const isProtected = protectedPrefixes.some((p) =>
        nextUrl.pathname.startsWith(p),
      );
      if (isProtected) return isLoggedIn;
      return true;
    },
    // 로그인 직후(user 있음) 토큰에 사용자 id를 심는다.
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    // 클라이언트/서버에서 읽는 session 객체에 user.id를 노출한다.
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
