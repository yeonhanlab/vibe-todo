# ADR-0001: JWT 세션 전략, Prisma 어댑터 미사용

## Status

Accepted (2026-09-10)

## Context

인증은 Auth.js v5의 Credentials provider(아이디 + 비밀번호)만 쓴다. OAuth는 범위 밖이다.
Auth.js는 세션을 두 가지 방식으로 유지할 수 있다:

- **데이터베이스 세션** — DB 어댑터(`@auth/prisma-adapter` 등)가 세션 레코드를 저장/조회.
- **JWT 세션** — 세션 상태를 서명된 쿠키(JWT)에 담고 서버는 상태를 저장하지 않음.

Auth.js의 제약: **Credentials provider는 데이터베이스 세션 전략을 지원하지 않는다.**
또한 미들웨어(`proxy.ts`)는 Edge 런타임에서 실행되며 여기서는 Prisma를 실행할 수 없다.

## Decision

- `session.strategy = "jwt"`로 고정한다.
- Prisma 어댑터를 도입하지 않는다. `User` 모델만 직접 관리하고,
  `authorize`에서 사용자 조회 + `bcrypt.compare`를 직접 수행한다.
- `callbacks.jwt`에서 최초 로그인 시 `token.id = user.id`,
  `callbacks.session`에서 `session.user.id = token.id`를 채운다.
- `Session`/`Account`/`VerificationToken` 등 어댑터용 모델은 스키마에 두지 않는다.

## Consequences

- **장점**: 스키마가 단순해지고(User/Todo/Routine/Category만), 세션 조회 시 DB 왕복이 없다.
  Edge 미들웨어에서 쿠키만으로 로그인 여부를 판단할 수 있다.
- **단점**: 서버 측에서 특정 세션을 즉시 무효화할 수 없다(로그아웃은 클라이언트 쿠키 삭제).
  세션에 담을 수 있는 정보량이 쿠키 크기로 제한된다.
- 이후 OAuth provider나 서버 측 세션 강제 만료가 필요해지면 어댑터 도입을 재검토해야 한다
  (새 ADR로 기록).
- `types/next-auth.d.ts`에서 `session.user.id`와 `JWT.id` 타입을 보강해야 한다.
