# RFC-0001: MVP 구현 (Phase 0~7) — 회고

- **상태**: ✅ 완료 (2026-09-10)
- **관련 PRD**: [`docs/prd/todo-app.md`](../prd/todo-app.md)
- **관련 ADR**: [0001](../adr/0001-jwt-session-no-prisma-adapter.md) · [0002](../adr/0002-pin-prisma-6.md) · [0003](../adr/0003-date-as-string.md) · [0004](../adr/0004-routine-lazy-materialization.md) · [0005](../adr/0005-edge-safe-auth-split.md) · [0006](../adr/0006-shared-zod-validation.md)

> 이 RFC는 빈 디렉터리에서 MVP를 페이지 단위로 쌓아 올린 작업의 회고 기록이다.
> 원래 `PLAN.md` / `CONTEXT.md`에 있던 단계별 진행 내역을 여기로 이관했다.
> 현재 구조는 [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) 참고.

---

## 목표

개인용 일일 ToDo 앱의 MVP를 구축한다: 인증, 날짜별 할 일 CRUD, 날짜 이동,
카테고리 + 색상, 반복 루틴 CRUD. 반복 루틴의 **자동 채움**은 이 RFC의 범위 밖이며
[RFC-0002](0002-routine-auto-materialization.md)에서 다룬다.

## 범위

### Scope
- Next.js App Router + TypeScript + Tailwind v4 프로젝트 뼈대
- Prisma 6 + MongoDB Atlas 연결, `User`/`Todo`/`Routine`/`Category` 모델
- Auth.js v5 Credentials + JWT 세션, 회원가입/로그인, 라우트 보호
- `/day/[date]` 할 일 추가·완료 토글·삭제, 이전/다음/오늘 이동
- `/categories` 카테고리 CRUD(컬러 피커), 할 일에 색 지정
- `/routines` 루틴 CRUD(매일/매주, 요일 토글, 활성 토글, 인라인 수정)
- 모든 API에 소유권 격리 + zod 검증

### Non-scope
- 루틴 → 일일 ToDo 자동 채움(지연 생성) → [RFC-0002](0002-routine-auto-materialization.md)
- 로딩/에러/빈 상태 UI 정리, 반응형 점검, Vercel 배포 → [RFC-0003](0003-polish-and-deploy.md)
- 낙관적 업데이트, 캘린더 뷰, 알림

## 접근 방식

한 번에 전체를 만들지 않고 **Phase 0~7을 페이지 단위로** 진행했다. 각 Phase가 끝날 때마다
멈추고 "만든 것 요약 + 사용자가 직접 확인할 방법"을 제시하고, 승인 후 다음 Phase로 넘어갔다.

핵심 기술 결정은 진행 중에 별도 ADR로 분리했다(위 목록). 계획서(Prisma 7, `middleware.ts`,
"Next 15" 등)와 달라진 부분은 실행 중 발견해 ADR-0002 / ADR-0005에 반영했다.

## 작업 단계

- [x] **Phase 0 — 프로젝트 뼈대**: `create-next-app`(Next 16.3.4 / React 19 / Tailwind 4 / App Router),
      의존성 설치(`next-auth@beta`, `prisma`, `@prisma/client`, `bcryptjs`, `zod`, `react-hook-form`,
      `@hookform/resolvers`, `react-icons`), `.env.example`, `pnpm-workspace.yaml`의 `onlyBuiltDependencies`.
      → `pnpm build` 통과, `pnpm dev` 렌더.
- [x] **Phase 1 — DB 연결**: Prisma **6.19.3로 다운그레이드**(ADR-0002), `schema.prisma` 작성(모든 필드 `///` 주석),
      `.env`(Atlas `my-first-vibe-diary` / DB `todo`), `package.json` 스크립트(`postinstall`/`build`에 `prisma generate`,
      `db:push`, `db:studio`), `lib/prisma.ts`·`lib/date.ts`·`lib/validation.ts`.
      → `db:push`로 컬렉션·인덱스 생성, Atlas 연결 `count()` 성공.
- [x] **Phase 2 — 인증 기반 + 회원가입**: `auth.config.ts`(Edge-safe, ADR-0005), `auth.ts`(Credentials + `authorize`),
      `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/api/register/route.ts`(bcrypt.hash(10), P2002 처리),
      `app/providers.tsx`, `app/register/page.tsx`(RHF + zodResolver, 비밀번호 확인, 성공 시 자동 `signIn`).
      → 신규 201 / 중복 409 / 검증 400(한글 메시지), 저장 비번이 `$2...` 해시.
- [x] **Phase 3 — 로그인 + 라우트 보호 + 헤더**: **`middleware.ts` → `proxy.ts`**(Next 16, ADR-0005),
      `app/login/page.tsx`(RHF, `signIn("credentials", {redirect:false})`, `callbackUrl` 내부 경로만, `useSearchParams`는 `<Suspense>`),
      `components/header.tsx`(네비 + 로그아웃), `app/(app)/layout.tsx`(서버 `auth()` 재확인), `app/(app)/day/[date]/page.tsx` stub,
      `app/page.tsx` 리다이렉트. **`AUTH_TRUST_HOST=true`** 추가(ADR-0005).
      → 비로그인 보호경로 307 → `/login?callbackUrl=`, 로그인 시 세션 쿠키 발급, 틀린 비번 시 쿠키 없음.
- [x] **Phase 4 — 일일 ToDo (반복 제외)**: `lib/todos.ts` `getTodosForDate`(조회만), `todoTitleSchema`/`todoCreateSchema`,
      `app/api/todos/route.ts`(GET ?date= / POST), `app/api/todos/[id]/route.ts`(PATCH/DELETE, `updateMany`/`deleteMany` `where:{id,userId}` → 0건 404),
      `day-view.tsx`(RHF 추가 폼, 완료 토글, 삭제, `router.refresh()`).
      → CRUD 정상, 소유권 격리(남의 todo → 404), 비로그인 POST 401. 한글 저장 정상(깨짐은 git-bash 셸 인코딩 문제).
- [x] **Phase 5 — 날짜 이동**: `<DayView>`에 `today` prop, `<Link>` 기반 이전/다음(`addDays`), "오늘로 가기"(오늘이 아닐 때만),
      완료/전체 카운트. → `addDays` 경계(월/연/윤년) 정상, 날짜별 목록 분리 확인.
- [x] **Phase 6 — 카테고리 + 색상**: `Category` 모델 + `Todo.categoryId?` + `User.categories`(`db:push`),
      `hexColor`/`objectId`/`categoryCreateSchema`/`categoryUpdateSchema`, `lib/categories.ts`,
      `app/api/categories/*`(소유권 격리), `todos` API에 `categoryId` 소유 확인, `/categories` 페이지(컬러 피커 + 인라인 수정 + 삭제),
      `day-view.tsx` 펼침 입력 패널(카테고리 `<select>`) + 색 점(점 클릭 시 인라인 변경), 헤더에 "카테고리" 링크.
      → CRUD 정상, 잘못된 color 400, `categoryId: null` 해제, 내 것 아닌 categoryId 400, **SetNull 확인**(카테고리 삭제 후 Todo 유지).
- [x] **Phase 7 — 루틴 관리 페이지 (CRUD만)**: `routineCreateSchema`에서 `startDate` 제거(서버가 오늘로 설정),
      WEEKLY면 요일 1개↑ refine, `lib/routines.ts`(`getRoutines`, `normalizeWeekdays`),
      `app/api/routines/*`(소유권 격리, PATCH 시 빈도 바뀌면 요일 정규화 — 매일→`[]`),
      `routines-view.tsx`(**RHF 대신 useState + `safeParse`**, ADR-0006 — 빈도 세그먼트/요일 토글/active 토글/인라인 수정/삭제).
      → DAILY/WEEKLY 생성, 요일 `[5,1,3,3]` → `[1,3,5]` 정규화, WEEKLY 요일 0개 400, 빈도 변경 시 요일 반영/클리어, 소유권 격리.

## 변경/생성 파일

프로젝트 전체가 이 RFC의 산출물이다. 상세 파일 목록은
[`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) §3 참고.
(`prisma/schema.prisma`, `auth.config.ts`, `auth.ts`, `proxy.ts`, `types/next-auth.d.ts`,
`lib/*`, `app/**`, `components/header.tsx`, `package.json` 스크립트, `.env.example`)

## 리스크 / 미해결

- 지연 생성 시 동시 요청 중복 생성 가능성 → RFC-0002에서 다룸.
- `next start` 로컬 테스트 시 `AUTH_TRUST_HOST` 필요(해결됨, `.env`에 반영).
- git-bash 셸 UTF-8 문제로 CLI 테스트 시 한글 바디는 파일로 전달해야 함(앱 자체는 정상).

## 검증 방법

각 Phase 종료 시 dev 서버 또는 `next start`(격리 시 포트 3200) 대상 curl로
API 계약(상태 코드, 소유권 격리, zod 400)을 확인하고, `pnpm build` 통과를 확인했다.
전체 회귀 시나리오는 [RFC-0003](0003-polish-and-deploy.md) §검증에 정리한다.
