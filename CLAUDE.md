# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트에서 작업할 때 따라야 하는 규칙과 문서 구조를 정의합니다.

---

## 1. 프로젝트 개요

개인용 **일일 ToDo 앱**. 사용자가 아이디/비밀번호로 로그인해 날짜별로 할 일을
등록·완료 체크하고, 카테고리(색상)로 분류하며, 매일/매주 반복 루틴을 등록하면
해당 날짜를 열 때 그 날의 할 일로 자동 채워진다(구현 완료 — [RFC-0002](docs/rfcs/0002-routine-auto-materialization.md)).
다크 모드는 OS 설정을 따른다([RFC-0005](docs/rfcs/0005-dark-mode.md)).
단일 사용자 전제지만 계정 시스템 자체는 다중 사용자를 지원하고, 모든 데이터는 소유자별로 격리된다.

- **목적**: 무거운 프로젝트 관리 기능 없이 "오늘 무엇을 할지"를 빠르게 적고 반복 항목을 자동화한다. 자세한 배경은 [`docs/prd/todo-app.md`](docs/prd/todo-app.md).
- **기술 스택**: Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS v4 (컴포넌트 라이브러리 없음) · Auth.js v5 (Credentials + JWT 세션) · Prisma 6.19.3 + MongoDB Atlas · zod + react-hook-form · pnpm. **배포됨** — `https://vibe-todo-app-sooty.vercel.app` (`master` 푸시 시 자동 배포).
- **주요 진입점**:
  - `app/page.tsx` — 로그인 여부에 따라 `/day/<오늘>` 또는 `/login`으로 리다이렉트
  - `app/(app)/day/[date]/page.tsx` — 날짜별 할 일 화면 (핵심 화면)
  - `auth.ts` / `auth.config.ts` / `proxy.ts` — 인증 및 라우트 보호 ([ADR-0005](docs/adr/0005-edge-safe-auth-split.md))
  - `prisma/schema.prisma` — 데이터 모델 (`User` / `Todo` / `Routine` / `Category`)
  - `lib/` — 데이터 접근 계층 (`prisma`, `todos`, `categories`, `routines`, `validation`, `date`)
- **현재 구조 스냅샷**: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)

---

## 2. 문서 구조 (Documentation Structure)

작업 성격에 따라 아래 위치에 문서를 만들고 참조합니다.

```
docs/
├── prd/            # 제품 요구사항 (Why / What) — 기능 작업 전 확인
├── architecture/
│   └── ARCHITECTURE.md   # 현재 시스템 구조 스냅샷 — 최신 상태 유지
├── adr/            # 개별 기술 결정 기록 (append-only)
└── rfcs/           # 기능별 구현 계획 (Plan 모드 산출물)
```

| 문서 | 질문 | 갱신 빈도 |
|---|---|---|
| PRD | 무엇을/왜 만드는가 (제품 관점) | 기능 시작 시 1회 |
| ARCHITECTURE.md | 전체 구조가 지금 어떤가 | 구조 변경 시마다 |
| ADR | 이 결정을 왜 이렇게 내렸나 | append-only, 결정마다 새 파일 |
| RFC/Plan | 이번 작업을 어떻게 구현하나 | 작업 단위마다 |

### 현재 문서

- **PRD**: [`docs/prd/todo-app.md`](docs/prd/todo-app.md)
- **ADR**: [0001 JWT 세션·어댑터 미사용](docs/adr/0001-jwt-session-no-prisma-adapter.md) ·
  [0002 Prisma 6 고정](docs/adr/0002-pin-prisma-6.md) ·
  [0003 날짜 문자열 저장](docs/adr/0003-date-as-string.md) ·
  [0004 루틴 지연 생성](docs/adr/0004-routine-lazy-materialization.md) ·
  [0005 Edge-safe auth 분리](docs/adr/0005-edge-safe-auth-split.md) ·
  [0006 zod 공용 검증](docs/adr/0006-shared-zod-validation.md) ·
  [0007 순서 필드 + 전체 재넘버링](docs/adr/0007-manual-order-full-renumber.md) ·
  [0008 다크 모드는 OS 설정만](docs/adr/0008-dark-mode-os-preference-only.md)
- **RFC**: [0001 MVP Phase 0~7 (완료)](docs/rfcs/0001-mvp-phase-0-7.md) ·
  [0002 루틴 자동 채움 (완료)](docs/rfcs/0002-routine-auto-materialization.md) ·
  [0003 마무리 + 배포 (진행 중)](docs/rfcs/0003-polish-and-deploy.md) ·
  [0004 우선순위 드래그 재정렬 (완료)](docs/rfcs/0004-priority-drag-reorder.md) ·
  [0005 다크 모드 (완료)](docs/rfcs/0005-dark-mode.md)

---

## 3. 워크플로우 (신규 기능 작업 시)

1. `docs/prd/`에 관련 PRD가 있는지 먼저 확인한다. 없으면 요구사항을 먼저 명확히 한다.
2. Plan 모드로 기술 접근 방식을 논의하고, 결과를 `docs/rfcs/<기능명>.md`로 정리한다.
    - RFC에는 목표, 범위(Scope/Non-scope), 접근 방식, 체크박스 작업 단계, 변경 파일 목록, 리스크, 검증 방법을 포함한다.
3. RFC 안에서 중요한 기술적 갈림길(A vs B 선택 등)이 있으면 `docs/adr/000X-제목.md`로 별도 분리한다.
    - ADR 포맷: Status / Context / Decision / Consequences
    - 결정이 바뀌면 새 ADR을 만들고 이전 ADR의 Status를 `Superseded by ADR-00XX`로 변경한다. 기존 ADR은 수정하지 않는다.
4. 작업이 전체 구조에 영향을 준다면 `docs/architecture/ARCHITECTURE.md`를 갱신한다.
5. 작업 완료 후 관련 GitHub Issue 상태를 갱신한다 (아래 4번 참고).

---

## 4. GitHub Issue 워크플로우

- 작업 시작 전: `gh issue list`로 관련 이슈가 이미 있는지 확인한다.
- RFC 완료 후: 작업을 단위별로 쪼개서 `gh issue create`로 등록한다.
- 커밋/PR에는 관련 이슈를 `Closes #N` 형식으로 연결한다.
- 라벨 규칙: `bug` / `feature` / `refactor` / `chore` 중 최소 하나를 지정한다.

---

## 5. 코드 스타일 / 컨벤션

- **커밋 메시지**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`). 제목은 한국어 가능.
- **브랜치 전략**: `feature/` · `fix:` · `refactor/` · `chore/` 프리픽스 + PR 필수. `master`에 직접 푸시하지 않는다(§6).
- **패키지 매니저**: `pnpm` 고정. `npm` / `yarn` 명령을 쓰지 않는다.
- **검증 스키마**: 모든 입력 검증은 `lib/validation.ts`에 zod로 정의하고 클라이언트 폼과 API 라우트가 공유한다 ([ADR-0006](docs/adr/0006-shared-zod-validation.md)). 폼은 기본 `react-hook-form` + `zodResolver`, 토글 위주 폼(루틴)만 `useState` + `safeParse`.
- **API 라우트 공통 패턴**: `await auth()` → 없으면 401 → zod `safeParse` → 실패 400 → 모든 Prisma 쿼리에 `userId` 강제 → 수정/삭제는 `updateMany`/`deleteMany` + `where:{id,userId}`, count 0이면 404. ObjectId 형식 아닌 id는 404.
- **날짜**: DB·URL·로직 전부 `"YYYY-MM-DD"` 문자열 ([ADR-0003](docs/adr/0003-date-as-string.md)). 날짜 계산은 `lib/date.ts`만 사용하고 직접 `new Date()` 조작하지 않는다.
- **Prisma 스키마**: 모든 모델/필드/인덱스에 `///` doc 주석을 단다. 커밋 전 `prisma format` 통과. 스키마 변경은 마이그레이션이 아니라 `pnpm run db:push`(MongoDB).
- **린트/빌드**: 커밋 전 `pnpm lint` + `pnpm build`(= `prisma generate && next build`) 통과.
- **테스트 (커밋 전 필수)**: 커밋 전에 변경 범위를 반드시 검증한다. 자동화 테스트 스위트가 없으므로 dev 서버 또는 `next start`(격리 시 포트 3200)로 해당 기능의 정상 경로 + 소유권 격리 + zod 400을 직접 확인하고, 확인한 절차와 결과를 RFC의 "검증 방법"에 남긴다. 검증 없이 커밋하지 않는다. 테스트로 만든 계정/데이터는 정리한다(`yeonhan` 계정과 그 데이터는 사용자 실제 데이터이므로 건드리지 않는다).
- **오버 엔지니어링 금지**: RFC 스코프에 필요한 만큼만 만든다. 지금 쓰지 않는 추상화 계층·설정 옵션·제네릭·"나중을 위한" 확장 포인트를 미리 넣지 않는다. 기존 패턴(위 API 공통 패턴, `lib/*` 구조)을 그대로 따르고, 새 패턴이 필요하면 RFC/ADR에 근거를 남긴 뒤 도입한다.
- **Next.js 16 주의**: 미들웨어 파일은 `middleware.ts`가 아니라 `proxy.ts`. API가 학습 데이터와 다를 수 있으므로 `node_modules/next/dist/docs/`를 참고한다(`AGENTS.md`).

---

## 6. 하지 말아야 할 것 (Guardrails)

- `docs/adr/`에 있는 파일은 직접 수정하지 않는다 (append-only).
- 사람 확인 없이 `main`/`master` 브랜치에 직접 푸시하지 않는다.
- 프로덕션 환경변수나 시크릿이 포함된 파일은 커밋하지 않는다. (`.env`는 `.gitignore`에 포함, `.env.example`만 커밋)
- 스코프 밖(RFC의 Non-scope에 명시된) 작업은 별도 이슈로 분리하고, 현재 작업에 포함하지 않는다.
- `yeonhan` 계정과 그 계정이 브라우저에서 만든 데이터(할 일, "산책" 카테고리 등)는 삭제하거나 수정하지 않는다.
- `pnpm run db:push` / `pnpm build` 전에 dev 서버를 종료한다 (Prisma 엔진 dll 잠금 → `generate` EPERM).
- CLI에서 한글이 포함된 요청 바디를 직접 만들지 않는다 (git-bash 셸이 UTF-8이 아니라 깨진 데이터가 저장됨). Node로 파일에 써서 `curl --data-binary @file`로 보낸다.
- `AGENTS.md`의 `<!-- BEGIN:nextjs-agent-rules -->` 블록은 `next dev`가 재생성하므로 변경분에서 되돌리지 말고 그대로 커밋한다.

---

## 7. 참고 링크

- 아키텍처 현황: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- 진행 중인 ADR 목록: [`docs/adr/`](docs/adr/)
- 이슈 트래커: https://github.com/yeonhanlab/vibe-todo/issues
- 저장소: https://github.com/yeonhanlab/vibe-todo
