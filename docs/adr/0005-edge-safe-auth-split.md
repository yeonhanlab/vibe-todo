# ADR-0005: Edge 안전을 위한 Auth 설정 분리 (`auth.config.ts` / `auth.ts` / `proxy.ts`)

## Status

Accepted (2026-09-10)

## Context

보호 경로(`/day/*`, `/routines/*`) 접근을 미들웨어에서 걸러야 한다. Next.js의
미들웨어는 **Edge 런타임**에서 실행되며 여기서는 Prisma Client와 `bcryptjs`
(Node API 의존)를 실행할 수 없다.

한편 로그인 검증(`authorize`)에는 Prisma로 사용자를 조회하고 `bcrypt.compare`를
해야 한다. 즉 "미들웨어용 설정"과 "로그인 검증용 설정"의 실행 환경이 다르다.

추가로 Next.js 16에서 미들웨어 파일 규칙 이름이 `middleware.ts` → **`proxy.ts`**로
바뀌었다(빌드 에러로 확인). 역할은 동일하다.

## Decision

설정을 세 파일로 나눈다:

- **`auth.config.ts`** (Edge 안전): `pages`, `session.strategy = "jwt"`,
  `callbacks.authorized`(미들웨어가 `auth?.user` 유무로 판단), `jwt`, `session` 콜백.
  provider·어댑터 없음. **Prisma/bcrypt를 import하지 않는다.**
- **`auth.ts`** (Node): `...authConfig` 스프레드 + `providers: [Credentials({ authorize })]`.
  `authorize`가 `lib/prisma` + `bcrypt.compare` 사용.
  `export const { handlers, auth, signIn, signOut } = NextAuth(...)`.
- **`proxy.ts`**: `const { auth } = NextAuth(authConfig); export default auth;`
  + `export const config = { matcher: ["/day", "/day/:path*", "/routines", "/routines/:path*"] }`.

또한 로컬 `next start`(비-Vercel)에서 Auth.js가 `UntrustedHost` 500을 내므로
`.env` / `.env.example`에 `AUTH_TRUST_HOST=true`를 둔다(Vercel에서는 자동 처리되어 무해).

## Consequences

- **장점**: 미들웨어 번들에 Prisma/bcrypt가 들어가지 않아 Edge에서 동작한다.
  로그인 검증 로직과 라우팅 가드가 같은 `pages`/`callbacks` 기반을 공유한다.
- **단점**: 설정이 두 파일로 나뉘어 있어, 콜백을 바꿀 때 어느 파일인지 헷갈릴 수 있다.
  `authConfig`를 `auth.ts`에서 스프레드하는 것을 잊으면 `pages` 설정이 누락된다.
- 미들웨어에서 하는 판단은 "로그인 쿠키가 유효한가"까지다. 세밀한 권한(리소스 소유권)은
  각 API 라우트 핸들러에서 `userId` 강제로 처리한다([ARCHITECTURE.md](../architecture/ARCHITECTURE.md) §3.4).
- Next.js 문서/예제에서 `middleware.ts`를 언급하면 이 프로젝트에서는 `proxy.ts`로 읽는다.
