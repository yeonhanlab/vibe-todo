// Auth.js가 로그인/로그아웃/세션 조회에 쓰는 엔드포인트.
// /api/auth/* 로 들어오는 모든 요청을 Auth.js 핸들러에 위임한다.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
