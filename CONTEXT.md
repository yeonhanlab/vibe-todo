# CONTEXT — 다음 작업 세션을 위한 인수인계 문서

> 이 파일은 "새 세션에서 빠르게 상황 파악"용 요약이다.
> 단계별 상세 진행 기록은 [`PLAN.md`](./PLAN.md) 에 있다 (Phase 0~9, 각 단계의 "한 일 / 체크포인트 결과").

---

## 1. 이 프로젝트가 뭔가

Next.js + TypeScript 기반 개인용 **일일 ToDo 앱**. 사용자별로 로그인해서 날짜별 할 일을 관리하고,
카테고리(색상)와 매일/매주 반복 루틴을 지원한다. 추후 Vercel 배포 예정.

---

## 2. 기술 스택 (실제 설치된 버전)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 16.3.4** (App Router, Turbopack) | 계획서의 "Next 15"와 다름 |
| 언어/UI | TypeScript, **React 19.2**, **Tailwind CSS v4** | 순수 Tailwind (컴포넌트 라이브러리 없음) |
| 인증 | **Auth.js v5** (`next-auth@5.0.0-beta.32`) | 아이디+비밀번호(Credentials)만, OAuth 없음 |
| 비밀번호 해시 | `bcryptjs@3` | 자체 타입 포함 → `@types/bcryptjs` 불필요 |
| ORM | **Prisma 6.19.3** (`prisma` + `@prisma/client`) | ⚠️ 7.x/8.x는 MongoDB 미성숙 → 6.x 마지막 안정판 고정 |
| DB | **MongoDB Atlas** (클러스터 `my-first-vibe-diary`, DB 이름 `todo`) | |
| 폼 | `react-hook-form@7` + `@hookform/resolvers@5` + `zod@4` | 루틴 폼만 예외(순수 useState) |
| 아이콘 | `react-icons@5` (Lucide 세트, `react-icons/lu`) | |
| 패키지 매니저 | **pnpm@10** | |

---

## 3. 계획서와 달라진 점 (실행 중 발견/결정)

1. **Prisma 7 → 6.19.3 다운그레이드**: Prisma 7은 스키마 `datasource.url` 미지원 + 런타임 driver adapter 필수라
   MongoDB에서 바로 깨짐. `npm view prisma dist-tags` 의 `latest`가 RC라서 그런 것. 6.19.3으로 고정.
2. **`middleware.ts` → `proxy.ts`**: Next 16에서 미들웨어 파일 규칙 이름이 `proxy`로 바뀜 (빌드 에러로 발견).
   `export default auth` (NextAuth(authConfig).auth) + `export const config = { matcher }`.
3. **`AUTH_TRUST_HOST=true`** 를 `.env`/`.env.example`에 추가: 로컬 `next start`(비-Vercel)에서 Auth.js가
   `UntrustedHost` 500 에러를 냄. Vercel 배포 시엔 자동 처리되어 무해.
4. **루틴 폼은 react-hook-form 미사용**: 빈도/요일 토글이 많아 `useState` + `zod safeParse`가 더 깔끔.
   나머지 폼(로그인/회원가입/카테고리/할 일 추가)은 RHF + zodResolver 사용.
5. `bcryptjs@3`이 타입을 자체 포함 → `@types/bcryptjs` 안 깔았음.

---

## 4. 파일 지도

```
proxy.ts                         Edge 미들웨어. /day, /routines 보호 → 미로그인 시 /login
auth.config.ts                   Edge-safe 설정 (pages, session:jwt, authorized/jwt/session 콜백). Prisma import 안 함
auth.ts                          Credentials provider + authorize(prisma+bcrypt). handlers/auth/signIn/signOut export
types/next-auth.d.ts             session.user.id, JWT.id 타입 보강

lib/prisma.ts                    PrismaClient 싱글턴 (dev HMR 대응)
lib/date.ts                      todayStr()(TZ Asia/Seoul), addDays, weekdayOf, formatKorean, isValidDateStr, WEEKDAY_LABELS — 계산은 전부 UTC 기준
lib/validation.ts                zod 스키마 전부 (register/login/todo/category/routine). 클라 폼 ↔ API 공용
lib/todos.ts                     getTodosForDate(userId, date) — 조회만 (Phase 8에서 루틴 지연 생성 로직 추가 예정)
lib/categories.ts                getCategories(userId)
lib/routines.ts                  getRoutines(userId), normalizeWeekdays()

app/layout.tsx                   루트. <Providers>(SessionProvider) + body 라이트 고정
app/providers.tsx                "use client" SessionProvider 래퍼
app/page.tsx                     로그인 여부로 /day/<오늘> 또는 /login 리다이렉트
app/login/page.tsx               로그인 폼 (RHF, signIn, callbackUrl)
app/register/page.tsx            회원가입 폼 (RHF, 비밀번호 확인, 성공 시 자동 signIn)
app/(app)/layout.tsx             보호 레이아웃. 서버에서 auth() 재확인 + <Header>
components/header.tsx            "use client". 오늘/카테고리/루틴 네비 + 로그아웃
app/(app)/day/[date]/page.tsx        서버: auth + getTodosForDate + getCategories → <DayView>
app/(app)/day/[date]/day-view.tsx    "use client". 날짜 이동, 펼침 추가 패널(카테고리 select), 완료 토글(채움/빈 동그라미), 색 점→인라인 카테고리 변경
app/(app)/categories/page.tsx + categories-view.tsx   카테고리 CRUD (컬러 피커)
app/(app)/routines/page.tsx + routines-view.tsx       루틴 CRUD (빈도/요일 토글, active 토글, 인라인 수정)

app/api/auth/[...nextauth]/route.ts   Auth.js 핸들러 재노출
app/api/register/route.ts             회원가입 (중복 409, 검증 400)
app/api/todos/route.ts                GET ?date= / POST (categoryId 소유권 확인)
app/api/todos/[id]/route.ts           PATCH(완료·제목·categoryId) / DELETE — 소유권 격리
app/api/categories/route.ts + [id]    카테고리 GET/POST, PATCH/DELETE
app/api/routines/route.ts + [id]      루틴 GET/POST(startDate=오늘), PATCH/DELETE

prisma/schema.prisma             모든 필드에 /// 주석
```

**공통 API 패턴**: 매 핸들러 `await auth()` → 없으면 401 → zod `safeParse` → 실패 400 →
모든 prisma 쿼리에 `userId: session.user.id` 강제(소유권 격리) → `updateMany`/`deleteMany`로 `{id, userId}` 조건, count 0이면 404.
ObjectId 형식 아닌 id는 404.

---

## 5. 데이터 모델 (`prisma/schema.prisma`)

- **User**: username(unique, 소문자 정규화), password(bcrypt 해시), createdAt
- **Todo**: userId, title, completed, date("YYYY-MM-DD" 문자열), routineId?(SetNull), categoryId?(SetNull), createdAt/updatedAt · `@@index([userId, date])`
- **Routine**: userId, title, frequency(DAILY|WEEKLY), weekdays(Int[], 0=일~6=토), active, startDate("YYYY-MM-DD"), createdAt/updatedAt · `@@index([userId, active])`
- **Category**: userId, name, color("#rrggbb"), createdAt/updatedAt · `@@index([userId])`
- 날짜는 전부 `"YYYY-MM-DD"` **문자열** (타임존 버그 회피)
- MongoDB라 마이그레이션 없음 → 스키마 변경 시 `pnpm run db:push`

---

## 6. 환경 변수 (`.env` — git에 안 올라감. `.env.example` 참고)

```
DATABASE_URL="mongodb+srv://...@my-first-vibe-diary.jvzn5sc.mongodb.net/todo?..."
AUTH_SECRET="(npx auth secret 또는 crypto.randomBytes(33).toString('base64'))"
AUTH_TRUST_HOST=true   # 로컬 next start 용. Vercel은 불필요
```

---

## 7. 실행 / 확인

```powershell
pnpm dev                 # 개발 서버 (포트 3000, 사용 중이면 3001/3002…)
pnpm run db:studio       # DB 내용 브라우저로 보기 (localhost:5555)
pnpm run db:push         # 스키마 변경을 Atlas에 반영 (⚠️ dev 서버 꺼야 함 — 아래 함정)
pnpm build               # prisma generate && next build
```

브라우저: `localhost:<포트>/` → 미로그인이면 `/login`. `yeonhan` 계정(비밀번호는 사용자가 알고 있음)으로 로그인.

---

## 8. ⚠️ 알아두면 좋은 함정

1. **git-bash 셸이 UTF-8 아님**: 터미널에서 한글 넣은 curl/스크립트를 돌리면 `����` 로 깨져 보이고 실제로 깨진 데이터가 저장됨.
   → 테스트 시 JSON 바디를 **Node로 파일에 써서** `curl --data-binary @file` 로 보내야 함. 브라우저는 항상 UTF-8이라 앱 자체는 정상.
2. **Next 16은 같은 프로젝트에서 `next dev` 2개 못 띄움** ("Another next dev server is already running").
   → 격리 테스트는 `pnpm exec next start --port 3200` (프로덕션 빌드) 로 함.
3. **`prisma generate` EPERM**: dev 서버가 실행 중이면 Prisma 엔진 dll이 잠겨서 재생성 실패.
   → `db:push` / `pnpm build` 전에 dev 서버 종료 필요. 스키마 안 바뀌었으면 `pnpm exec next build` (generate 생략)로 우회 가능.
4. **`next start` 로컬 테스트 시 로그인 500** → `.env`에 `AUTH_TRUST_HOST=true` 필요 (이미 추가됨).
5. **API 테스트용 로그인 = CSRF 흐름**:
   `GET /api/auth/csrf` (쿠키 저장) → `POST /api/auth/callback/credentials` (form-urlencoded: csrfToken, username, password, callbackUrl) → 302 + `authjs.session-token` 쿠키.

---

## 9. 현재 상태 (2026-09-10)

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 프로젝트 뼈대 | ✅ |
| 1 | Prisma + Atlas 연결 | ✅ |
| 2 | 인증 기반 + 회원가입 | ✅ |
| 3 | 로그인 + 라우트 보호 + 헤더 | ✅ |
| 4 | 일일 ToDo 페이지 (추가/완료/삭제) | ✅ |
| 5 | 날짜 이동 | ✅ |
| 6 | 카테고리 + 색상 | ✅ |
| 7 | 루틴 관리 페이지 (CRUD만) | ✅ |
| **8** | **루틴 → 일일 ToDo 자동 채움 (지연 생성)** | ⬜ 다음 |
| 9 | 마무리 + 배포 준비 | ⬜ |

**DB 현재 내용**: 사용자 `yeonhan` 1명 + 그가 브라우저에서 직접 만든 데이터
(할 일 몇 개, "산책" 카테고리 `#92b3e8`). 이건 사용자 실제 데이터라 건드리지 말 것.

---

## 10. Phase 8에서 할 일 (다음 작업)

**목표**: `active` 루틴이 해당 날짜를 열 때 그 날 Todo로 자동 생성된다.

- `lib/todos.ts` `getTodosForDate(userId, date)` **앞단에 지연 생성 로직 추가**:
  1. `active: true` 이고 `startDate <= date` 인 `Routine` 조회
  2. `weekdayOf(date)` 계산 → `frequency === "DAILY"` 이거나 (`WEEKLY` && `weekdays.includes(weekday)`) 인 루틴만 대상
  3. 대상 루틴 중 `(userId, date, routineId)` Todo가 아직 없는 것만 `createMany` 로 생성
  4. **가드**: `date >= todayStr()` 일 때만 생성 (과거 날짜는 조회만 — 소급 생성 안 함)
  5. 그다음 기존대로 `(userId, date)` 전체 Todo 반환
- `day-view.tsx`: 루틴에서 온 Todo(`routineId != null`)는 `LuRepeat` 뱃지 표시
- 동시 요청 시 중복 생성 방지 고려 (같은 날짜를 두 탭에서 동시에 열기 등). `createMany` 전에 존재 확인 + 유니크성은
  현재 스키마에 `(userId, date, routineId)` 유니크 제약이 없음 → 필요하면 `@@unique([userId, date, routineId])` 추가 검토
- 체크포인트: 매일 루틴 → 내일 페이지 열면 자동 생성 / 날짜별 완료 상태 독립 / 매주 루틴은 지정 요일에만 /
  비활성 루틴은 새로 안 생김(기존 유지) / 과거 날짜엔 소급 생성 안 됨

## Phase 9 (마지막)

로딩·에러·빈 상태 UI 정리, 반응형 점검, `README.md` 작성, Vercel 배포 체크리스트 반영
(`pnpm-lock.yaml` 커밋됨 · env 3개 등록 · `postinstall: prisma generate` 있음 ·
`pnpm-workspace.yaml`에 `onlyBuiltDependencies` 있음 · Atlas Network Access `0.0.0.0/0` 필요).

---

## 11. Git

- 원격: `origin` → `https://github.com/yeonhanlab/vibe-todo.git`
- 브랜치: `master`
- 커밋 attribution: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` + `Claude-Session: ...`
