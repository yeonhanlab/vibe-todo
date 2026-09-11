# ADR-0006: zod 스키마를 클라이언트/서버 공용으로, 폼은 react-hook-form (루틴 폼 예외)

## Status

Accepted (2026-09-10)

## Context

사용자 입력은 로그인, 회원가입, 할 일 추가, 카테고리 생성/수정, 루틴 생성/수정 등
여러 폼에서 들어온다. 검증 규칙(길이, 형식, 요일 최소 1개 등)이 클라이언트와 서버에서
어긋나면, 클라에서 통과한 값이 서버에서 400이 나거나 그 반대가 된다.

## Decision

- **모든 검증 스키마를 `lib/validation.ts` 한 곳에** zod로 정의하고, 클라이언트 폼과
  API 라우트 핸들러가 같은 스키마를 import한다.
  (`registerSchema` / `loginSchema` / `todoCreateSchema` / `todoUpdateSchema` /
  `categoryCreateSchema` / `categoryUpdateSchema` / `routineCreateSchema` / `routineUpdateSchema`,
  공통 조각 `usernameField` / `passwordField` / `hexColor` / `objectId` 등)
- API 핸들러는 바디를 `schema.safeParse()` → 실패 시 `400` + 필드별 한글 메시지.
- 폼은 기본적으로 `react-hook-form` + `@hookform/resolvers`의 `zodResolver(스키마)`를 쓴다.
  `formState.errors`로 필드 에러, `isSubmitting`으로 버튼 상태, 서버 에러는 `setError("root" | 필드, ...)`로 반영.
- **예외 — 루틴 폼**: 빈도(매일/매주) 세그먼트 + 요일 7개 토글처럼 불리언 토글 위주라
  `react-hook-form`보다 순수 `useState` + `routineCreateSchema.safeParse()`가 더 단순하다.
  루틴 생성/수정 폼만 이 방식을 쓴다.
- 서버 전용 정규화(예: `username` 소문자화, `startDate = todayStr()`)는 스키마 통과 후
  핸들러에서 적용한다.

## Consequences

- **장점**: 검증 규칙이 한 곳에만 존재해 클라/서버 불일치가 구조적으로 사라진다.
  타입도 `z.infer`로 공유된다.
- **단점**: 폼 구현 방식이 두 가지(RHF / useState)로 갈려, 새 폼을 만들 때 어느 쪽인지 판단이 필요하다.
  기준은 "입력 필드 위주면 RHF, 토글 위주면 useState".
- `lib/validation.ts`가 커지면 도메인별 파일 분리를 검토한다(스키마 위치 규칙은 유지).
