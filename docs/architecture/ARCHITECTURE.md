# ARCHITECTURE — 현재 시스템 구조 스냅샷

> 이 문서는 **지금 코드가 어떤 구조인가**를 설명한다. 구조가 바뀔 때마다 갱신한다.
> "왜 이렇게 결정했나"는 [`docs/adr/`](../adr/), "이번 작업을 어떻게 하나"는 [`docs/rfcs/`](../rfcs/) 참고.

- **마지막 갱신**: 2026-09-11 (Phase 0~7 + 우선순위 드래그 재정렬[RFC-0004] + 루틴 자동 채움[RFC-0002] +
  다크 모드[RFC-0005] 반영. Vercel 실배포 완료 및 배포 트러블슈팅 §7·§8에 반영)

---

## 1. 개요

Next.js App Router 기반 개인용 일일 ToDo 앱. 단일 Next.js 프로세스가 SSR 페이지와
API 라우트를 모두 제공하고, MongoDB Atlas에 Prisma로 접근한다. 인증은 Auth.js v5
Credentials + JWT 세션이며, 별도 세션 스토어가 없다.

```
브라우저
  │  (쿠키: authjs.session-token = JWT)
  ▼
Next.js 16 (App Router, 단일 배포 단위 — Vercel)
  ├─ proxy.ts (Edge)        보호 경로 게이트: 미로그인 → /login
  ├─ Server Components       auth()로 세션 확인 후 lib/*에서 데이터 로드
  ├─ Client Components       폼/상호작용 → fetch → API 라우트 → router.refresh()
  └─ Route Handlers (/api)   auth() → zod 검증 → Prisma (userId 강제)
        │
        ▼
   Prisma Client 6.19.3 (lib/prisma.ts 싱글턴)
        │
        ▼
   MongoDB Atlas (클러스터 my-first-vibe-diary, DB "todo")
```

## 2. 기술 스택 (실제 설치 버전)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16.3.4 (App Router, Turbopack) | 미들웨어 파일 규칙이 `proxy.ts` |
| 언어/UI | TypeScript, React 19.2, Tailwind CSS v4 | 순수 Tailwind, 컴포넌트 라이브러리 없음. `dark:` variant로 다크 모드 지원(OS `prefers-color-scheme` 따름, 토글 UI는 없음) |
| 인증 | Auth.js v5 (`next-auth@5.0.0-beta.32`) | Credentials 전용, JWT 세션 |
| 비밀번호 해시 | `bcryptjs@3` | 자체 타입 포함 |
| ORM | Prisma 6.19.3 (`prisma` + `@prisma/client`) | 7.x는 MongoDB 미성숙 → 6.x 고정 ([ADR-0002](../adr/0002-pin-prisma-6.md)) |
| DB | MongoDB Atlas | 마이그레이션 없음 → `pnpm run db:push` |
| 폼 | `react-hook-form@7` + `@hookform/resolvers@5` + `zod@4` | 루틴 폼만 순수 useState |
| 아이콘 | `react-icons@5` (`react-icons/lu`, Lucide) | |
| 드래그 재정렬 | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | 할 일 순서 변경([ADR-0007](../adr/0007-manual-order-full-renumber.md)) |
| 패키지 매니저 | pnpm@10 | |

## 3. 런타임 구성 요소

### 3.1 인증 경계 (Edge / Node 분리)
- **`auth.config.ts`** — Edge 안전. `pages`, `session.strategy = "jwt"`,
  `authorized` / `jwt` / `session` 콜백만. Prisma·bcrypt를 import하지 않는다.
- **`auth.ts`** — Node 전용. `authConfig` 스프레드 + `Credentials` provider.
  `authorize`가 `lib/prisma`로 사용자 조회 후 `bcrypt.compare`. `handlers` / `auth` / `signIn` / `signOut` export.
- **`proxy.ts`** — `NextAuth(authConfig).auth`를 default export. `matcher`로 `/day`, `/routines`만 검사.
- 분리 근거: [ADR-0005](../adr/0005-edge-safe-auth-split.md)

### 3.2 데이터 접근 계층 (`lib/`)
| 파일 | 역할 |
|---|---|
| `lib/prisma.ts` | `PrismaClient` `globalThis` 싱글턴 (dev HMR 커넥션 폭증 방지) |
| `lib/date.ts` | `todayStr()`(TZ Asia/Seoul), `addDays`, `weekdayOf`, `formatKorean`, `isValidDateStr`, `WEEKDAY_LABELS` — 계산은 전부 UTC 기준 |
| `lib/validation.ts` | zod 스키마 전부 (register / login / todo / category / routine). 클라 폼 ↔ API 공용 ([ADR-0006](../adr/0006-shared-zod-validation.md)) |
| `lib/todos.ts` | `getTodosForDate(userId, date)` — 조회 전에 `materializeRoutineTodos()`로 그 날 요일에 해당하는 활성 루틴을 지연 생성([RFC-0002](../rfcs/0002-routine-auto-materialization.md)), `order asc` → `createdAt asc` 순 조회. `nextOrderForDate(userId, date)` — 새 할 일(수동 추가·루틴 생성 공통)에 부여할 순서 계산([ADR-0007](../adr/0007-manual-order-full-renumber.md)) |
| `lib/categories.ts` | `getCategories(userId)` |
| `lib/routines.ts` | `getRoutines(userId)`, `normalizeWeekdays()` (중복 제거 + 정렬) |

### 3.3 라우트 구조
```
app/
├─ layout.tsx                  루트. <Providers>(SessionProvider) + body 라이트 고정
├─ providers.tsx               "use client" SessionProvider 래퍼
├─ page.tsx                    로그인 여부 → /day/<오늘> 또는 /login 리다이렉트
├─ login/page.tsx              로그인 폼 (RHF, signIn, callbackUrl 내부 경로만)
├─ register/page.tsx           회원가입 폼 (RHF, 비밀번호 확인, 성공 시 자동 signIn)
├─ (app)/                      보호 라우트 그룹
│  ├─ layout.tsx               서버에서 auth() 재확인 + <Header>
│  ├─ day/[date]/page.tsx      서버: auth + getTodosForDate + getCategories → <DayView>
│  ├─ day/[date]/day-view.tsx  "use client". 날짜 이동, 펼침 추가 패널, 완료 토글, 색 점 인라인 변경, 드래그 재정렬(@dnd-kit)
│  ├─ categories/page.tsx + categories-view.tsx   카테고리 CRUD (컬러 피커)
│  └─ routines/page.tsx + routines-view.tsx       루틴 CRUD (빈도/요일 토글, 인라인 수정)
├─ api/
│  ├─ auth/[...nextauth]/route.ts   Auth.js 핸들러 재노출
│  ├─ register/route.ts             회원가입 (중복 409, 검증 400) — 비보호
│  ├─ todos/route.ts                GET ?date= / POST
│  ├─ todos/[id]/route.ts           PATCH(완료·제목·categoryId) / DELETE
│  ├─ todos/reorder/route.ts        PATCH — 그 날짜 목록 전체 순서를 한 번에 저장(ADR-0007)
│  ├─ categories/route.ts + [id]/route.ts
│  └─ routines/route.ts + [id]/route.ts   POST 시 startDate = 서버의 오늘
components/header.tsx          "use client". 오늘/카테고리/루틴 네비 + 로그아웃
types/next-auth.d.ts           session.user.id, JWT.id 타입 보강
```

### 3.4 공통 API 패턴
모든 라우트 핸들러가 동일한 순서를 따른다:

1. `const session = await auth()` → 없으면 `401`.
2. 요청 바디를 `lib/validation.ts`의 zod 스키마로 `safeParse` → 실패 시 `400` (필드별 한글 메시지).
3. 모든 Prisma 쿼리에 `userId: session.user.id` 강제.
4. 수정/삭제는 `updateMany` / `deleteMany` + `where: { id, userId }` → 결과 count가 0이면 `404`.
5. ObjectId 형식이 아닌 `id`는 `404`.
6. 참조 무결성(`categoryId` 등)은 "내 소유인지" `findFirst`로 확인 후 반영.

예외: `PATCH /api/todos/reorder`는 항목 하나가 아니라 그 날짜의 목록 전체를 한 번에 다루므로,
`findFirst` 대신 "요청받은 id 개수 == (userId, date, id in 요청목록) 개수" 대조로 소유권을 확인한 뒤
`updateMany` 트랜잭션으로 반영한다([ADR-0007](../adr/0007-manual-order-full-renumber.md)).

### 3.5 클라이언트 상태 갱신
낙관적 업데이트를 쓰지 않는다. 클라이언트 컴포넌트가 `fetch`로 API를 호출하고
성공하면 `router.refresh()`로 서버 컴포넌트를 재요청해 최신 데이터를 받는다.

## 4. 데이터 모델 (`prisma/schema.prisma`)

모든 필드에 `///` doc 주석이 달려 있다. 요약:

- **User**: `username`(unique, 소문자 정규화), `password`(bcrypt 해시), `createdAt`
- **Todo**: `userId`, `title`, `completed`, `order?`(Int, nullable — 드래그 순서), `date`("YYYY-MM-DD" 문자열),
  `routineId?`(SetNull), `categoryId?`(SetNull), `createdAt`/`updatedAt` · `@@index([userId, date])`
- **Routine**: `userId`, `title`, `frequency`(DAILY|WEEKLY), `weekdays`(Int[], 0=일~6=토),
  `active`, `startDate`("YYYY-MM-DD"), 타임스탬프 · `@@index([userId, active])`
- **Category**: `userId`, `name`, `color`("#rrggbb"), 타임스탬프 · `@@index([userId])`

설계 근거:
- 날짜를 `DateTime`이 아닌 `String "YYYY-MM-DD"`로 저장 → [ADR-0003](../adr/0003-date-as-string.md)
- 루틴을 매 항목 미리 생성하지 않고 지연 생성 → [ADR-0004](../adr/0004-routine-lazy-materialization.md)
- 할 일 순서는 nullable 정수 + 드롭 시 전체 재넘버링 → [ADR-0007](../adr/0007-manual-order-full-renumber.md)
- MongoDB라 마이그레이션 파일이 없다. 스키마 변경은 `pnpm run db:push`로 반영.

## 5. 환경 변수 (`.env`, git 제외 — `.env.example` 참고)

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | MongoDB Atlas 연결 문자열 (DB 이름 포함) |
| `AUTH_SECRET` | Auth.js JWT 암호화 키 (`npx auth secret`) |
| `AUTH_TRUST_HOST` | 로컬 `next start` / 자체 호스팅에서 `true`. Vercel은 불필요 |

## 6. 빌드 / 실행

```
pnpm dev            # 개발 서버 (기본 3000)
pnpm build          # prisma generate && next build
pnpm start          # 프로덕션 서버
pnpm run db:push    # 스키마 변경을 Atlas에 반영 (dev 서버 종료 후)
pnpm run db:studio  # Prisma Studio (localhost:5555)
pnpm lint           # eslint
```

## 7. 알려진 함정

1. **git-bash 셸이 UTF-8이 아님** — 터미널에서 한글 리터럴을 넣은 curl/스크립트는 깨진 데이터를 저장한다.
   테스트 시 JSON 바디를 Node로 파일에 써서 `curl --data-binary @file`로 보낸다. 브라우저는 항상 UTF-8이라 앱 자체는 정상.
2. **Next 16은 같은 프로젝트에서 `next dev`를 2개 못 띄운다.** 격리 테스트는 `next start --port 3200`(프로덕션 빌드)로.
3. **`prisma generate` EPERM** — dev 서버 실행 중이면 엔진 dll이 잠긴다. `db:push` / `build` 전에 dev 서버 종료.
   스키마가 안 바뀌었으면 `pnpm exec next build`로 generate를 건너뛴다.
4. **`next start` 로컬에서 로그인 500** — `.env`에 `AUTH_TRUST_HOST=true` 필요(이미 추가됨).
5. **API 테스트 로그인 = CSRF 흐름** — `GET /api/auth/csrf`(쿠키 저장) →
   `POST /api/auth/callback/credentials`(form-urlencoded: csrfToken, username, password, callbackUrl) → 302 + 세션 쿠키.
6. **로컬 dev 서버가 켜진 채로 `pnpm build` / `pnpm run db:push`를 돌리면 그 dev 서버가 깨진다** —
   둘 다 내부적으로 `prisma generate`를 실행해서, dev 서버가 이미 메모리에 올려둔 Prisma Client를
   실행 중에 덮어써버린다. `auth.ts`가 `lib/prisma`를 import하므로 인증 관련 API 전체가
   `/api/auth/session`, `providers`, `/api/register` 500으로 깨지는 형태로 나타난다.
   **dev 서버를 껐다 켜면 복구된다.** (Vercel 배포/격리 테스트용 `next start`처럼 별도 프로세스로
   돌리는 빌드는 무관 — 문제는 "같은 프로젝트의 실행 중인 dev 서버 위에서" 돌릴 때만 생긴다.)
7. **Vercel 환경변수에 따옴표를 같이 붙여넣으면 연결이 깨진다** — `.env` 파일은
   `DATABASE_URL="mongodb+srv://..."`처럼 따옴표 포함이 정상 문법(dotenv가 파싱 시 벗겨냄)이지만,
   Vercel의 Environment Variables 입력창은 이 문법을 모른다. 따옴표까지 통째로 붙여넣으면
   그 문자 자체가 연결 문자열의 일부가 되어 Prisma가 연결에 실패한다 — 증상은 로그인 시
   `error=Configuration`으로 리다이렉트되며 **정확히 MongoDB 드라이버의 기본
   `serverSelectionTimeoutMS`(30초)만큼 걸린 뒤** 실패하는 것으로 나타난다(로딩 스피너가
   30초간 멈춰 있는 것처럼 보임). Vercel엔 따옴표를 뺀 값만 넣는다.
8. **`DATABASE_URL`에 DB 이름(`/todo`)이 빠지면 다른(빈) 데이터베이스로 연결된다** —
   Atlas의 "Connect" 창이 기본으로 주는 연결 문자열은 보통 `.../?retryWrites=...`처럼 db 이름이
   없는 형태다. 이 상태로 등록하면 클러스터 연결 자체는 되지만 로컬과 다른 빈 db를 보게 되어,
   존재하는 계정인데도 "아이디 또는 비밀번호가 올바르지 않습니다"가 뜬다(계정을 못 찾을 뿐 —
   비번 문제가 아님). 호스트 뒤에 `/todo`가 붙어 있는지 꼭 확인한다.
9. **MongoDB Atlas Network Access에 `0.0.0.0/0`이 없으면 Vercel에서 연결이 30초간 멎다가 실패한다** —
   증상은 7번과 동일(`error=Configuration`, 정확히 30초). 로컬 `.env`가 맞아도 Atlas 쪽
   IP 허용 목록에 Vercel을 허용하지 않으면 발생한다. **Security → Network Access → Add IP
   Address → `0.0.0.0/0`**, "temporary" 토글은 꺼둔다(켜두면 몇 시간 뒤 자동 삭제되어 재발한다).
   재배포는 필요 없고 몇십 초 내로 바로 반영된다.

## 8. 배포 (Vercel)

- 배포됨: `https://vibe-todo-app-sooty.vercel.app` — GitHub `origin`(`yeonhanlab/vibe-todo`) 연동으로
  `master` 푸시 시 자동 배포.
- `pnpm-lock.yaml` 커밋됨. Vercel이 pnpm 자동 감지.
- Environment Variables에 `DATABASE_URL`, `AUTH_SECRET` 등록 완료 (`AUTH_TRUST_HOST`는 Vercel에서 불필요).
  등록/수정 시 값에 따옴표를 포함하지 않는다 — 위 7번 함정 참고.
- `package.json`에 `postinstall: prisma generate` 존재 (없으면 stale client로 빌드 실패).
- `pnpm-workspace.yaml`에 `onlyBuiltDependencies`(prisma 관련) 존재.
- MongoDB Atlas → Network Access에 `0.0.0.0/0` 허용 등록 완료 — 위 9번 함정 참고.
- Auth.js v5는 `AUTH_URL` 없이 Vercel에서 동작. 커스텀 도메인이면 `AUTH_URL` 지정.
- **환경변수를 바꾼 뒤에는 Deployments → 최근 배포 `···` → Redeploy로 다시 배포해야 반영된다**
  (저장만으로는 이미 빌드된 배포에 적용되지 않는다). Network Access 변경은 Redeploy가 필요 없다.
- 남은 항목은 [RFC-0003](../rfcs/0003-polish-and-deploy.md) 참고 (로딩/에러/빈 상태 UI, 반응형 점검).
