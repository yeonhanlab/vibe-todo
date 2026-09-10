# ToDo 앱 구축 계획 (Next.js + TS + Tailwind + Prisma/MongoDB + Auth.js v5)

## Context

빈 디렉터리에서 개인용 일일 ToDo 앱을 새로 만든다. 요구사항:

- **프레임워크**: Next.js (App Router) + TypeScript
- **스타일**: 순수 Tailwind CSS (컴포넌트 라이브러리 없음)
- **인증**: Auth.js v5 (`next-auth@beta`), 아이디 + 비밀번호(Credentials)만. OAuth 미사용
- **DB**: Prisma + MongoDB Atlas
- **ToDo 범위**: 기본(제목/완료/날짜) + 매일·매주 반복되는 루틴
- **패키지 매니저**: pnpm
- **배포**: 추후 Vercel

목표: 사용자가 회원가입/로그인 후 날짜별로 그 날의 ToDo를 등록·완료 체크하고,
반복 루틴을 등록하면 해당 요일마다 그 날짜의 ToDo가 자동으로 채워지는 앱.

---

## 기술 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| Router | App Router | Next 최신 표준, 서버 컴포넌트에서 `auth()` 직접 사용 |
| 세션 전략 | **JWT** (`session.strategy = "jwt"`) | Credentials provider는 DB 세션(어댑터) 미지원 |
| Prisma 어댑터 | **미사용** | 순수 Credentials + JWT에서는 불필요. User 모델만 직접 관리 |
| 비밀번호 해시 | `bcryptjs` (순수 JS) | Windows/Vercel에서 네이티브 빌드 이슈 없음 |
| Edge 대응 | `auth.config.ts` / `auth.ts` 분리 | 미들웨어(Edge)에서 Prisma·bcrypt 실행 불가 → config 분리 패턴 |
| 날짜 저장 | `date` 를 `"YYYY-MM-DD"` **String** | 타임존 버그 회피, Atlas 인덱스 단순, 날짜별 조회 명확 |
| 반복 처리 | `Routine` 모델 + **지연 생성(lazy materialization)** | 날짜 조회 시 해당 요일 루틴의 Todo 인스턴스를 없으면 생성 |
| 입력 검증 | `zod` (+ `@hookform/resolvers`) | 클라이언트/서버 동일 스키마 공유 (`lib/validation.ts`) |
| 폼 관리 | `react-hook-form` | 모든 사용자 입력 폼(로그인·회원가입·ToDo 추가·루틴). `zodResolver`로 zod 스키마 연결 |
| 아이콘 | `react-icons` | 추가·삭제·체크·이전/다음·로그아웃 아이콘 (`react-icons/lu` Lucide 세트) |
| MongoDB 스키마 반영 | `prisma db push` | MongoDB는 migration 미지원 |

---

## 데이터 모델 (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id         String     @id @default(auto()) @map("_id") @db.ObjectId
  username   String     @unique
  password   String                   // bcrypt 해시
  createdAt  DateTime   @default(now())
  todos      Todo[]
  routines   Routine[]
  categories Category[]
}

enum Frequency {
  DAILY
  WEEKLY
}

// 사용자가 정의하는 할 일 분류 + 색상 (Phase 6에서 추가)
model Category {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String                   // 예: "업무", "운동"
  color     String                   // hex, 예: "#ef4444" (팔레트에서 선택)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  todos     Todo[]

  @@index([userId])
}

model Routine {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  userId    String    @db.ObjectId
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  frequency Frequency @default(DAILY)
  weekdays  Int[]                     // WEEKLY일 때 0(일)~6(토)
  active    Boolean   @default(true)
  startDate String                    // "YYYY-MM-DD" — 이 날짜부터 적용
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  todos     Todo[]

  @@index([userId, active])
}

model Todo {
  id         String    @id @default(auto()) @map("_id") @db.ObjectId
  userId     String    @db.ObjectId
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String
  completed  Boolean   @default(false)
  date       String                    // "YYYY-MM-DD"
  routineId  String?   @db.ObjectId     // 루틴에서 생성된 경우 연결
  routine    Routine?  @relation(fields: [routineId], references: [id], onDelete: SetNull)
  categoryId String?   @db.ObjectId     // 카테고리 (Phase 6)
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId, date])
}
```

---

## 프로젝트 구조

```
todo/
├─ prisma/schema.prisma
├─ middleware.ts                     # /day, /routines 보호
├─ auth.config.ts                    # Edge-safe: pages, authorized 콜백 (provider 없음)
├─ auth.ts                           # Credentials provider + authorize(Prisma+bcrypt), handlers/auth/signIn/signOut export
├─ types/next-auth.d.ts              # session.user.id 타입 확장
├─ lib/
│   ├─ prisma.ts                     # PrismaClient 싱글턴 (dev HMR 대응)
│   ├─ todos.ts                      # getTodosForDate(userId, date): 루틴 지연 생성 + 조회
│   ├─ validation.ts                 # zod 스키마 (registerSchema, todoSchema, routineSchema) — 클라/서버 공용
│   └─ date.ts                       # todayStr(), addDays(), formatKorean() 등 날짜 유틸
├─ app/
│   ├─ layout.tsx                    # 루트 레이아웃 + <Providers> (SessionProvider)
│   ├─ globals.css                   # Tailwind 진입점
│   ├─ providers.tsx                 # "use client" SessionProvider 래퍼
│   ├─ page.tsx                      # 로그인 시 /day/<오늘>로 redirect, 아니면 /login
│   ├─ login/page.tsx               # 로그인 폼 (client) → signIn("credentials")
│   ├─ register/page.tsx            # 회원가입 폼 → POST /api/register → signIn
│   ├─ day/[date]/page.tsx          # 서버 컴포넌트: auth() + getTodosForDate → <DayView>
│   ├─ day/[date]/day-view.tsx      # "use client": 목록/추가/토글/삭제, 이전·다음·오늘 이동
│   ├─ routines/page.tsx            # 서버 컴포넌트: 루틴 목록
│   ├─ routines/routines-view.tsx   # "use client": 루틴 CRUD 폼
│   └─ api/
│       ├─ auth/[...nextauth]/route.ts   # export { GET, POST } = handlers
│       ├─ register/route.ts             # POST: username 중복확인 + bcrypt.hash + 생성
│       ├─ todos/route.ts                # GET(?date=), POST
│       ├─ todos/[id]/route.ts           # PATCH(완료토글/제목), DELETE
│       ├─ routines/route.ts             # GET, POST
│       └─ routines/[id]/route.ts        # PATCH, DELETE
└─ .env  /  .env.example
```

---

## 핵심 구현 포인트

### 1. Auth.js v5 config 분리
- `auth.config.ts`: `pages: { signIn: "/login" }` + `callbacks.authorized`(미들웨어용, `auth?.user` 유무로 판단). provider·어댑터 없음 → Edge 안전.
- `auth.ts`: `authConfig` 스프레드 + `providers: [Credentials({ ... authorize })]`.
  - `authorize`: `lib/prisma`로 `username` 조회 → `bcrypt.compare` → 성공 시 `{ id, name: username }` 반환.
  - `session.strategy = "jwt"`.
  - `callbacks.jwt`: 최초 로그인 시 `token.id = user.id`.
  - `callbacks.session`: `session.user.id = token.id`.
  - `export const { handlers, auth, signIn, signOut } = NextAuth(...)`.
- `middleware.ts`: `NextAuth(authConfig).auth`로 감싸고 `matcher: ["/day/:path*", "/routines/:path*", "/"]`.

### 2. `lib/prisma.ts`
Next.js dev HMR에서 커넥션 폭증 방지하는 `globalThis` 싱글턴 표준 패턴.

### 3. `lib/todos.ts` — `getTodosForDate(userId, dateStr)`
1. `active: true` 이고 `startDate <= dateStr` 인 `Routine` 조회.
2. `dateStr`의 요일 계산. `frequency === DAILY` 이거나 (`WEEKLY` 이고 `weekdays.includes(weekday)`)인 루틴만 대상.
3. 대상 루틴 중 `(userId, date=dateStr, routineId)` Todo가 없는 것만 `createMany`로 생성.
4. `(userId, date=dateStr)` 전체 Todo를 `createdAt asc`로 반환.
- 과거 날짜 소급 생성을 막으려면 `dateStr >= todayStr()` 일 때만 생성(과거는 조회만).

### 4. API route 공통
- 매 핸들러 시작에서 `const session = await auth();` → 없으면 `401`.
- 모든 쿼리에 `userId: session.user.id` 강제(소유권 격리).
- 바디는 `lib/validation.ts`의 `zod` 스키마로 `safeParse` → 실패 시 `400` (클라 폼과 동일 스키마).
- `/api/register`는 비보호. `username` 소문자 정규화 + 3~20자, `password` 8자 이상 검증.

### 5. 폼 (`react-hook-form` + `zodResolver`)
- 모든 입력 폼은 `useForm({ resolver: zodResolver(스키마) })` 사용. 검증 규칙은 `lib/validation.ts`에서 import → 서버와 동일.
- `formState.errors`로 필드별 에러 메시지 표시, `isSubmitting`으로 버튼 비활성/로딩.
- 서버 응답 에러(예: 중복된 아이디)는 `setError("username", ...)` 또는 루트 에러(`setError("root", ...)`)로 폼에 반영.
- 적용 폼: 로그인, 회원가입, ToDo 빠른 추가(인풋 1개 + submit), 루틴 생성/수정.

### 6. UI (순수 Tailwind + `react-icons`)
- 라이트 위주, 모바일 폭 대응(`max-w-md mx-auto`, `px-4`).
- 아이콘은 `react-icons/lu`(Lucide): `LuPlus`(추가), `LuTrash2`(삭제), `LuCheck`/`LuCircle`(완료 토글), `LuChevronLeft`·`LuChevronRight`(날짜 이동), `LuLogOut`(로그아웃), `LuRepeat`(루틴).
- `day/[date]`: 상단에 날짜 + "◀ / 오늘 / ▶" 이동(다음 날짜로 라우팅), 완료/전체 카운트, 입력창 + 추가 버튼, 리스트(체크박스·제목·삭제). 완료 항목은 `line-through opacity-60`.
- `routines`: 제목·빈도(매일/매주)·매주면 요일 토글, 활성 스위치, 삭제. 하단에 안내 문구.
- 변경 후 `router.refresh()`로 서버 컴포넌트 재요청.
- 로그아웃 버튼(`signOut`)은 공통 헤더에.

### 7. 환경 변수 (`.env`)
```
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>/<dbname>?retryWrites=true&w=majority"
AUTH_SECRET="<npx auth secret 로 생성>"
```
`.env.example`에는 값 비운 채로 커밋. `.env`는 `.gitignore`에 포함.

---

## 작업 방식 — 단계별(페이지 단위) 진행

한 번에 전체를 만들지 않는다. 아래 **Phase 0~8**을 순서대로 진행하며,
**각 Phase가 끝날 때마다 멈추고** 무엇을 만들었는지 요약 + 직접 확인할 방법을 알려준다.
사용자가 확인/승인하면 다음 Phase로 넘어간다.

각 Phase 설명의 구성: **목표 / 만들·수정할 파일 / 끝나면 확인할 것(사용자 체크포인트)**.

---

### Phase 0 — 프로젝트 뼈대 (실행 가능한 빈 앱) ✅ 완료
- **목표**: Next.js 앱이 `pnpm dev`로 뜨고, 의존성·환경 파일 틀이 준비된 상태.
- **한 일**:
  - `pnpm create next-app` (Next 16.3.4 / React 19 / Tailwind 4 / App Router / `@/*` alias / git init 생략)
  - `pnpm add next-auth@beta prisma @prisma/client bcryptjs zod react-hook-form @hookform/resolvers react-icons`
    (`bcryptjs` 3.x는 자체 타입 포함 → `@types/bcryptjs` 불필요. Prisma 버전은 Phase 1에서 6.19.3으로 확정 — 아래 참고)
  - `pnpm-workspace.yaml`에 `onlyBuiltDependencies`(prisma 관련 + esbuild) 추가
  - `.env.example` 작성(`DATABASE_URL`, `AUTH_SECRET` 자리). `.gitignore`는 이미 `.env*` 포함
  - `app/page.tsx` 임시 랜딩(“설정 중”), `app/layout.tsx` 메타데이터·`lang="ko"` 정리
- **체크포인트**: `pnpm build` 통과, `pnpm dev` → `localhost:3000` 렌더.
- **비고**: `package.json`의 `postinstall: prisma generate` / `build` 수정은 스키마가 생기는 **Phase 1**에서 추가.

### Phase 1 — 데이터베이스 연결 (Prisma + Atlas) ✅ 완료
- **목표**: Atlas에 스키마가 반영되고 앱에서 Prisma Client로 접근 가능.
- **한 일**:
  - **Prisma 6.19.3으로 확정**: 처음 설치된 `prisma@7.10.0`은 파괴적 변경이 커서(스키마의 `datasource.url` 미지원,
    런타임에 driver adapter 필수, MongoDB 지원 미성숙) MongoDB 성숙도가 높은 마지막 6.x인 **6.19.3**으로 다운그레이드.
  - `prisma/schema.prisma` 작성 (위 [데이터 모델](#데이터-모델-prismaschemaprisma), `url = env("DATABASE_URL")` 방식).
    모든 필드/모델/인덱스에 `///` doc 주석. `prisma format` 통과.
  - `.env`: `AUTH_SECRET` 자동 생성, `DATABASE_URL` = Atlas `my-first-vibe-diary` 클러스터 / DB 이름 `todo`
  - `package.json` 스크립트: `postinstall`/`build`에 `prisma generate`, `db:push`, `db:studio` 추가
  - `lib/prisma.ts`(싱글턴), `lib/date.ts`(UTC 기준 날짜 유틸, 오늘 기준 TZ = `Asia/Seoul`), `lib/validation.ts`(zod 스키마) 작성
- **체크포인트 결과**:
  - `pnpm run db:push` → 컬렉션 `User`/`Routine`/`Todo` + 인덱스(`User_username_key`, `Routine_userId_active_idx`, `Todo_userId_date_idx`) 생성됨
  - 앱 측 `PrismaClient`로 Atlas 연결 및 `count()` 쿼리 성공 (전부 0건)
  - `pnpm build` 통과

### Phase 2 — 인증 기반 + 회원가입 페이지 ✅ 완료
- **목표**: `/register`에서 계정을 만들 수 있다.
- **한 일**:
  - `auth.config.ts` (Edge-safe: `pages`, `session.strategy=jwt`, `authorized`/`jwt`/`session` 콜백)
  - `auth.ts` (Credentials provider + `authorize`: `loginSchema` 검증 → `prisma.user.findUnique` → `bcrypt.compare`)
  - `types/next-auth.d.ts` (`session.user.id`, `JWT.id` 타입 보강)
  - `app/api/auth/[...nextauth]/route.ts` (`handlers` 재노출)
  - `app/api/register/route.ts` (`registerSchema` 검증 → 중복 확인 → `bcrypt.hash(10)` → `user.create`, P2002 처리)
  - `app/providers.tsx` (`SessionProvider`) + `app/layout.tsx`에 연결, body 배경 라이트 고정
  - `app/register/page.tsx` (react-hook-form + zodResolver, 비밀번호 확인 필드, 서버 에러를 `setError`로 폼 반영, 성공 시 자동 `signIn` → `/`)
  - `lib/validation.ts`: `usernameField`/`passwordField` 분리, `registerFormSchema`(확인 필드+일치검사) 추가
- **체크포인트 결과**:
  - `pnpm build` 통과 (`/register`, `/api/register`, `/api/auth/[...nextauth]` 라우트 생성)
  - `POST /api/register` — 신규 201, 중복 409(`field:"username"`), 짧은 비번/짧은 아이디 400 + 한글 메시지
  - DB 확인: 저장된 `password`가 `$2...` 해시, `bcrypt.compare` 정답 true / 오답 false → `authorize` 로직 검증
  - 테스트 계정은 삭제해 DB는 다시 0건

### Phase 3 — 로그인 페이지 + 라우트 보호 + 공통 헤더 ✅ 완료
- **목표**: 로그인/로그아웃이 되고, 비로그인 상태로 보호 경로 접근 시 `/login`으로 튕긴다.
- **한 일**:
  - `proxy.ts` — **Next 16에서 `middleware.ts` 규칙이 `proxy.ts`로 이름 변경됨**(빌드 에러로 확인). `NextAuth(authConfig)`의
    `auth`를 default export, `matcher: ["/day", "/day/:path*", "/routines", "/routines/:path*"]`
  - `app/login/page.tsx` — react-hook-form + zodResolver(`loginSchema`), `signIn("credentials", {redirect:false})`,
    실패 시 폼에 에러, 성공 시 `callbackUrl`(내부 경로만) 또는 `/`로 이동. `useSearchParams`는 `<Suspense>`로 감쌈
  - `components/header.tsx` — "use client". 오늘/루틴 네비(`usePathname`로 활성 표시) + 로그아웃(`signOut({redirectTo:"/login"})`).
    아이콘 `LuCalendarDays`/`LuRepeat`/`LuLogOut`
  - `app/(app)/layout.tsx` — 라우트 그룹. 서버에서 `auth()` 재확인 후 `<Header>` + 본문. `username`/`todayDate` 주입
  - `app/(app)/day/[date]/page.tsx` — **임시 stub**(날짜 헤더 + 안내문). 잘못된 날짜는 오늘로 redirect. Phase 4에서 교체
  - `app/page.tsx` — `auth()` 결과로 `/day/<오늘>` 또는 `/login`으로 redirect
- **체크포인트 결과** (dev 서버 + curl):
  - 로그아웃 상태 `/day/2026-09-10` → `307` → `/login?callbackUrl=...` (proxy 동작)
  - 로그아웃 상태 `/` → `307` → `/login`
  - CSRF 흐름으로 로그인 → `302` → `callbackUrl`, `authjs.session-token` 쿠키 발급
  - 로그인 상태 `/day/2026-09-10` → stub 페이지 + 헤더(오늘/루틴/로그아웃) 렌더
  - 로그인 상태 `/` → `307` → `/day/<오늘>`
  - 틀린 비밀번호 → `302` → `/login?error=CredentialsSignin`, 세션 쿠키 없음
  - `pnpm build` 통과
- **비고**: DB에 사용자 `yeonhan` 1건 존재 — 테스트 중 브라우저에서 직접 만드신 계정으로 보임(내 테스트 계정 아님). 그대로 둠.

### Phase 4 — 일일 ToDo 페이지 (반복 제외) ✅ 완료
- **목표**: 특정 날짜의 ToDo를 추가/완료토글/삭제할 수 있다. (루틴 연동은 아직 없음)
- **한 일**:
  - `lib/todos.ts` — `getTodosForDate(userId, date)` **조회만** (`findMany`, `createdAt asc`, `DayTodo` 타입). 루틴 지연 생성은 Phase 7.
  - `lib/validation.ts` — `todoTitleSchema` 분리, `todoCreateSchema = todoTitleSchema.extend({date})`
  - `app/api/todos/route.ts` — `GET ?date=`(목록), `POST`(추가). 둘 다 `auth()` → 401, zod → 400.
  - `app/api/todos/[id]/route.ts` — `PATCH`(완료/제목), `DELETE`. **소유권 격리**: `updateMany`/`deleteMany` `where: { id, userId }` → 0건이면 404. ObjectId 형식 아니면 404.
  - `app/(app)/day/[date]/page.tsx` — stub 제거. 서버에서 `auth()` + `getTodosForDate` → `<DayView>`.
  - `app/(app)/day/[date]/day-view.tsx` — "use client". 추가 폼(react-hook-form + `todoTitleSchema`), 완료 토글(빈 네모 `LuSquare` ↔ 체크된 네모 `LuSquareCheck`), 삭제(`LuTrash2`). 변경 후 `router.refresh()`. 완료 항목은 `line-through text-zinc-400`.
- **선택 결정**: 반응은 요청→refresh(낙관적 업데이트 X) / 제목 수정 UI는 이번엔 생략(API는 지원) / 완료해도 자리 유지.
- **후속 변경(사용자 요청)**: 완료 토글 아이콘을 네모 체크박스 → **빈 동그라미(`LuCircle`) ↔ 채워진 동그라미(`LuCircle` + `fill-zinc-900`)** 로 교체.
- **체크포인트 결과** (사용자 dev 서버 :3001 대상 curl):
  - `POST` 201, `GET ?date=` 목록, `PATCH {completed:true}` 반영, `DELETE` 200
  - 소유권 격리: 다른 사용자가 남의 todo PATCH/DELETE → 404
  - 비로그인 `POST` → 401, 잘못된 id → 404
  - `/day/2026-09-10` 페이지가 "n / m 완료" 카운트와 목록 렌더
  - **한글 저장 정상**: Node로 만든 UTF-8 JSON을 `POST`하면 title이 바이트 단위로 정확히 저장/조회됨.
    (테스트 중 보인 `�` 깨짐은 git-bash 셸이 한글 리터럴을 UTF-8이 아닌 코드페이지로 인코딩한 것 — 브라우저는 항상 UTF-8이라 앱 자체는 이상 없음)
  - `pnpm exec next build` 통과 (schema 미변경이라 `prisma generate`는 실행 중 dev 서버가 엔진 dll을 잠가서 건너뜀)
  - 테스트 계정/데이터 전부 삭제 → DB는 `yeonhan` 1명, todo 0건

### Phase 5 — 날짜 이동 네비게이션 ✅ 완료
- **목표**: 이전/다음/오늘 버튼으로 날짜를 이동하며, 날짜별로 목록이 분리된다.
- **한 일**:
  - `page.tsx` → `<DayView>`에 `today={todayStr()}` prop 추가
  - `day-view.tsx` 상단에 `<Link>` 기반 이동: `LuChevronLeft`(→`/day/${addDays(date,-1)}`), 날짜 라벨,
    `LuChevronRight`(→`/day/${addDays(date,1)}`). 날짜 라벨 아래: 오늘이면 "오늘" 표시, 아니면 "오늘로 가기" 링크
  - 완료/전체 카운트 라인
  - 잘못된 날짜는 `page.tsx`에서 오늘로 redirect (Phase 3부터 존재)
- **체크포인트 결과**:
  - `addDays` 경계: 월(09-30→10-01), 연(01-01→전년 12-31), 윤년(2024-02-28→02-29) 정상
  - dev 서버: `/day/2026-09-11` → prev `/day/2026-09-10`, next `/day/2026-09-12`, "오늘로 가기" 노출, 09-11 항목만 표시(09-10 항목 안 섞임)
  - `/day/2026-09-10`(오늘) → "오늘로 가기" 없음
  - `pnpm exec next build` 통과. 테스트 계정 삭제.
- **참고**: 사용자가 브라우저에서 `yeonhan` 계정으로 직접 할 일 1건 등록함(2026-09-10, 한글 정상 저장). 그대로 둠 →
  앞서 있었던 `�` 깨짐이 셸 문제였고 앱은 정상임이 실제 UI로도 확인됨.

### Phase 6 — 카테고리 + 색상 (사용자 요청 추가) ✅ 완료
- **목표**: 사용자가 카테고리(이름 + 색상)를 만들고, 할 일에 지정할 수 있다. 목록에 색상으로 표시된다.
- **확정 결정**: ① 색상 = 자유 컬러 피커(`<input type="color">`) ② 관리 = 별도 `/categories` ③ 날짜 페이지 한 페이지 유지 + 펼침 입력 패널
- **한 일**:
  - `prisma/schema.prisma` — `Category` 모델(`///` 주석) + `Todo.categoryId?` + `User.categories`. `pnpm run db:push` → `Category` 컬렉션 + `Category_userId_idx`
  - `lib/validation.ts` — `hexColor`(`/^#[0-9a-fA-F]{6}$/`), `objectId`, `categoryCreateSchema`/`categoryUpdateSchema`,
    `todoCreateSchema`에 `categoryId: objectId.nullish()`, `todoUpdateSchema`에 `categoryId: objectId.nullable().optional()`(null=해제)
  - `lib/categories.ts` — `getCategories(userId)`
  - `lib/todos.ts` — `DayTodo`에 `category` 추가, `getTodosForDate` select에 `category {id,name,color}`
  - `app/api/categories/route.ts`(GET/POST), `app/api/categories/[id]/route.ts`(PATCH/DELETE) — 소유권 격리(`updateMany`/`deleteMany` `where:{id,userId}`)
  - `app/api/todos/*` — 넘어온 `categoryId`가 내 카테고리인지 `findFirst`로 확인 후 반영. `POST` 응답 select에 category 포함
  - `app/(app)/categories/page.tsx` + `categories-view.tsx` — 목록 + 생성(컬러 피커 + 이름) + 인라인 수정(`LuPencil`/`LuCheck`/`LuX`) + 삭제(`window.confirm`)
  - `app/(app)/day/[date]/page.tsx` — `getCategories`도 병렬 조회해 `<DayView categories>` 전달
  - `app/(app)/day/[date]/day-view.tsx` — `adding` 상태로 **펼침 입력 패널**(카테고리 `<select>` + 제목), 각 항목 우측에 **색 점**(`style={{backgroundColor}}`, 카테고리 없으면 점선 원),
    점 클릭 시 인라인 `<select>`로 카테고리 변경. 추가 성공 시 패널은 열어두고 제목만 비움(연속 입력)
  - `components/header.tsx` — "카테고리" 링크(`LuTag`) 추가, 3개 링크 들어가도록 레이아웃 컴팩트화(username은 로그아웃 버튼 `title` 툴팁으로)
  - **`.env` / `.env.example`에 `AUTH_TRUST_HOST=true` 추가** — 로컬 `next start`(비-Vercel)에서 Auth.js `UntrustedHost` 방지. Vercel은 자동이라 무해
- **체크포인트 결과** (`next start` 프로덕션 서버 :3200 대상 curl):
  - 카테고리 생성/목록/수정/삭제 정상, 잘못된 color(`"blue"`) → 400
  - 할 일에 `categoryId` 지정 → 응답·목록에 `category{id,name,color}` 포함, day 페이지 HTML에 `background-color:#...` 인라인 스타일 렌더
  - `categoryId: null` PATCH → 해제됨, 내 것이 아닌 `categoryId` → 400
  - 소유권 격리: 다른 사용자가 남의 카테고리 PATCH/DELETE → 404, 남의 카테고리 목록 안 보임
  - **SetNull 확인**: 카테고리 삭제 후 그 카테고리 쓰던 Todo는 그대로 존재, `categoryId`만 `null`
  - `pnpm build` 통과. 테스트 계정/데이터 전부 삭제
- **참고**: 사용자가 브라우저에서 직접 "산책" 카테고리(`#92b3e8`) 생성 + "밤산책" 할 일에 적용함. 정상 저장 확인, 그대로 둠.

### Phase 7 — 루틴 관리 페이지 ✅ 완료
- **목표**: `/routines`에서 매일/매주 반복 루틴을 CRUD 할 수 있다. (자동 채움은 Phase 8)
- **확정 결정**: `startDate`는 폼에 없고 서버가 오늘로 설정 / 인라인 수정에서 빈도·요일까지 전부 변경 가능
- **한 일**:
  - `lib/validation.ts` — `routineCreateSchema`에서 `startDate` 제거, WEEKLY면 요일 1개↑ refine. `routineUpdateSchema`에 동일 refine 추가
  - `lib/routines.ts` — `getRoutines(userId)`, `normalizeWeekdays()`(중복 제거+정렬)
  - `app/api/routines/route.ts`(GET/POST, `startDate: todayStr()` 서버 설정), `app/api/routines/[id]/route.ts`(PATCH/DELETE, 소유권 격리).
    PATCH: 빈도가 오면 요일도 맞춰 정규화(매일→`[]`)
  - `app/(app)/routines/page.tsx` + `routines-view.tsx` — **RHF 대신 plain useState + `routineCreateSchema.safeParse`**(토글 위주 폼이라).
    빈도 세그먼트(`매일`/`매주`), 요일 토글(`WEEKDAY_LABELS` 재사용), active 토글은 행 왼쪽 `LuCircle`(채움/빈), 인라인 수정(빈도·요일 포함), 삭제(`window.confirm`)
- **체크포인트 결과** (`next start` :3200 curl):
  - DAILY/WEEKLY 생성 정상, WEEKLY 요일 `[5,1,3,3]` → `[1,3,5]`로 정규화
  - WEEKLY + 요일 0개 → 400. active 토글 200
  - 빈도 변경: DAILY→WEEKLY 요일 반영, WEEKLY→DAILY 시 `weekdays` `[]`로 클리어
  - 소유권 격리: 남의 루틴 PATCH/DELETE → 404, 목록 안 보임
  - `/routines` 페이지 렌더, `pnpm build` 통과. 테스트 데이터 삭제
- **비고**: `Routine` 삭제 시 그 루틴이 만든 Todo는 `routineId`만 `null`(SetNull) — 이미 스키마에 반영됨

### Phase 8 — 루틴 → 일일 ToDo 자동 채움 (지연 생성)
- **목표**: 루틴이 해당 요일 날짜를 열 때 그 날 ToDo로 자동 생성된다.
- **파일/작업**:
  - `lib/todos.ts` `getTodosForDate` 에 [핵심 구현 3](#3-libtodosts--gettodosfordateuserid-datestr) 의 지연 생성 로직 추가(오늘 이후 날짜만 생성, `createMany`, 중복 방지)
  - `day/[date]/page.tsx`가 이 함수를 사용하도록 연결
  - 루틴에서 온 Todo는 목록에서 `LuRepeat` 뱃지로 표시
- **체크포인트**: “물 마시기” 매일 루틴 생성 → 내일 페이지 열면 자동 생성. 날짜별 완료 상태 독립. 매주 루틴은 지정 요일에만 등장. 비활성 루틴은 새로 안 생김(기존 유지).

### Phase 9 — 마무리 + 배포 준비
- **목표**: 스타일 정리, 전체 회귀 확인, Vercel 배포 가능한 상태.
- **파일/작업**:
  - 로딩/에러/빈 상태 UI 정리, 반응형(모바일 폭) 점검
  - `README.md`(로컬 실행법, 환경 변수)
  - 아래 [Vercel 체크리스트](#vercel-배포-시-체크리스트) 항목 반영
- **체크포인트(전체 회귀)**:
  1. 회원가입 → 자동 로그인 → 오늘 페이지
  2. 로그아웃 상태로 보호 경로 접근 → `/login`
  3. ToDo 추가·완료·삭제, 새로고침 유지
  4. 날짜 이동 시 목록 분리
  5. 카테고리 생성/색상 지정/할 일에 적용/삭제 시 SetNull
  6. 매일 루틴 → 미래 날짜 자동 채움, 완료 상태 날짜별 독립
  7. 매주 루틴 → 지정 요일에만
  8. 비활성 루틴 → 미래 날짜에 안 생김
  9. 2번째 계정에서 1번째 계정 데이터 안 보임(소유권 격리)
  10. `pnpm build` 통과

---

## Vercel 배포 시 체크리스트 (추후)

- `pnpm-lock.yaml` 커밋. Vercel이 pnpm 자동 감지.
- Project Settings → Environment Variables: `DATABASE_URL`, `AUTH_SECRET` 등록.
- `package.json`에 `"postinstall": "prisma generate"` (없으면 stale client로 빌드 실패).
- pnpm이 빌드 스크립트를 막으므로 `package.json`에
  `"pnpm": { "onlyBuiltDependencies": ["prisma", "@prisma/client", "@prisma/engines"] }` 추가.
- MongoDB Atlas → Network Access에 `0.0.0.0/0` 허용 (또는 Vercel 통합).
- Auth.js v5는 `AUTH_URL` 없이도 Vercel에서 동작(자동 감지). 커스텀 도메인이면 `AUTH_URL` 지정.
