import type { DefaultSession } from "next-auth";

// next-auth 기본 타입에는 user.id가 없으므로 직접 추가한다.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
