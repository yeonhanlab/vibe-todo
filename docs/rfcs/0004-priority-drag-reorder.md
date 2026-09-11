# RFC-0004: 할 일 우선순위 드래그 재정렬

- **상태**: ✅ 완료 (2026-09-11)
- **관련 PRD**: [`docs/prd/todo-app.md`](../prd/todo-app.md) §4.5
- **관련 ADR**: [ADR-0007 순서 필드 + 전체 재넘버링](../adr/0007-manual-order-full-renumber.md)
- **선행**: 없음 (RFC-0002 루틴 자동 채움과 독립적으로 진행 가능)

---

## 목표

날짜별 할 일 목록에서 항목을 드래그해 순서를 바꾸고, 그 순서가 새로고침 후에도
유지되게 한다.

## 범위

### Scope
- `/day/[date]` 목록에서 드래그로 순서 변경 (마우스 + 터치)
- 변경된 순서를 서버에 저장하고, 그 날짜에 한정해 적용
- 수동 추가 항목과 루틴에서 자동 생성된 항목 모두 정렬 대상에 포함
- 새 항목은 항상 목록 맨 뒤에 추가

### Non-scope
- 날짜를 넘나드는 드래그(다른 날짜로 항목 이동) — 별도 이슈로 분리
- 카테고리별 그룹 정렬, 완료 항목을 자동으로 맨 아래로 내리는 정렬 규칙 변경
- 마감 기간 + 캘린더 (PRD §8 향후 고려사항 — 이 RFC와 무관)

## 접근 방식

핵심 결정([ADR-0007](../adr/0007-manual-order-full-renumber.md)): `Todo.order`를
nullable `Int?`로 추가하고, 드롭할 때마다 그 날짜 목록 전체를 `0..N-1`로 재넘버링해서
한 번에 저장한다. Fractional 인덱스 같은 정교한 기법은 이 규모(개인용 일일 목록)에는
과하다고 보고 채택하지 않는다.

### 데이터
- `prisma/schema.prisma`: `Todo.order Int?` 추가. `@@index([userId, date, order])` 추가 검토
  (기존 `@@index([userId, date])`와 겹치므로, 정렬 성능에 실익이 있는지 확인 후 결정 — 항목 수가
  적어 인덱스 없이도 충분하면 추가하지 않는다).
- `lib/todos.ts` `getTodosForDate`: 정렬을 `orderBy: [{ order: "asc" }, { createdAt: "asc" }]`로 변경.
  Prisma/MongoDB에서 `null`이 `asc` 정렬 시 어디로 오는지 확인 필요(라이브러리 동작에 따라
  `null`을 먼저/나중에 두는 옵션 지정).
- 새 `Todo` 생성(수동 추가, 루틴 지연 생성 둘 다): 그 날짜의 현재 최대 `order`를 조회해 `+1`로 설정.
  아직 아무 항목도 `order`가 없으면(레거시 날짜) `null`로 둔다.

### API
- 신규: `PATCH /api/todos/reorder` — body `{ date: string, orderedIds: string[] }`.
  1. `auth()` → 401.
  2. zod로 형식 검증(`date` 형식, `orderedIds` 배열).
  3. `orderedIds`가 전부 `(userId, date)`에 속하는 항목인지 개수 대조로 확인 — 불일치 시 400.
  4. 트랜잭션으로 `orderedIds[i]`마다 `order = i` 업데이트.
- 기존 `PATCH /api/todos/[id]`는 변경 없음(완료/제목/카테고리 그대로).

### 프론트엔드
- 신규 의존성: `@dnd-kit/core` + `@dnd-kit/sortable`(+ `@dnd-kit/utilities`) — 마우스/터치 모두
  지원하고 접근성(키보드 이동)도 갖춘 가벼운 라이브러리. 순수 HTML5 Drag and Drop API는
  모바일 터치 지원이 약해 채택하지 않는다.
- `day-view.tsx`: 목록을 `DndContext` + `SortableContext`로 감싸고, 각 행에 드래그 핸들
  아이콘(`LuGripVertical`) 추가. `onDragEnd`에서:
  1. 로컬 state 순서를 즉시 반영(드래그 반응성 확보).
  2. `PATCH /api/todos/reorder` 호출.
  3. 성공 시 `router.refresh()`로 서버 상태와 재동기화(기존 "요청 후 refresh" 패턴 유지).
  4. 실패 시 이전 순서로 되돌리고 에러 표시.

## 작업 단계

- [x] `prisma/schema.prisma`에 `Todo.order Int?` 추가 → `pnpm run db:push`
- [x] `lib/validation.ts`에 `reorderSchema` 추가
- [x] `lib/todos.ts` — `getTodosForDate` 정렬 변경, 신규 생성 시 `order` 부여 로직(`nextOrderForDate`, 수동 추가 경로)
- [ ] 루틴 지연 생성 경로([RFC-0002](0002-routine-auto-materialization.md) 구현 시)에도
      `nextOrderForDate`를 적용 — RFC-0002가 이 RFC보다 나중에 구현되므로, 그 작업에서 반영한다
- [x] `app/api/todos/reorder/route.ts` 신규 (PATCH) — 소유권 검증(개수 대조) + 트랜잭션 업데이트
- [x] `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [x] `day-view.tsx` — DnD 컨텍스트, 드래그 핸들, `onDragEnd` 핸들러
- [x] 수동 회귀 확인 (아래 검증 방법) + `pnpm build` / `pnpm lint` 통과
- [x] `docs/architecture/ARCHITECTURE.md` §2/§3.2/§3.3/§3.4/§4 갱신 (신규 API, `order` 필드, `@dnd-kit` 반영)

## 변경 파일

- `prisma/schema.prisma`
- `lib/validation.ts`, `lib/todos.ts`
- `app/api/todos/reorder/route.ts` (신규)
- `app/(app)/day/[date]/day-view.tsx`
- `package.json` (신규 의존성)

## 리스크

| 리스크 | 대응 |
|---|---|
| 레거시 데이터(`order` 없음)와 새 데이터가 섞여 정렬이 꼬임 | `order` 없으면 `createdAt` 폴백, 첫 드래그 시 그 날짜 전체를 백필 |
| 터치 기기에서 드래그가 스크롤과 충돌 | `@dnd-kit`의 pointer/touch 센서 설정(activation constraint)으로 완화, 실기기 확인 필수 |
| 신규 API의 소유권 누락으로 남의 항목 순서 변경 | `orderedIds` 개수 대조 + `updateMany`도 `where:{id,userId}` 유지 (기존 패턴 준수) |
| 항목 수가 많아지면 매 드롭마다 전체 재넘버링 비용 증가 | 현재 규모에서는 무시 가능. 커지면 ADR-0007 재검토 |

## 검증 방법

- 항목 3개 이상을 드래그로 순서 변경 → 새로고침 후에도 순서 유지.
- 순서 변경 후 새 항목 추가 → 맨 뒤에 추가됨.
- 루틴에서 자동 생성된 항목도 드래그 대상에 포함되고 순서 유지됨. (RFC-0002 구현 후 재확인 필요)
- 어떤 날짜에서 순서를 바꿔도 다른 날짜의 순서에는 영향 없음.
- 모바일 폭 + 터치(또는 브라우저 터치 에뮬레이션)에서 드래그 동작.
- 다른 사용자 계정으로 `/api/todos/reorder` 호출 시 자신의 항목만 영향(소유권 격리).
- `pnpm build` 통과, 테스트 계정/데이터 정리.

### 검증 결과 (2026-09-11, `next start --port 3200` + curl)

API 레벨은 전부 확인했다:

- `POST /api/todos` 3건 생성 → `GET ?date=`가 `createdAt asc`(생성 순) 반환 — `order`가 아직 없는 날짜는 기존 정렬 유지.
- `PATCH /api/todos/reorder`로 순서를 뒤바꿈 → `GET`에 바뀐 순서 그대로 반영·유지됨.
- 순서를 바꾼 뒤 새 항목 추가 → 맨 뒤(`order = max + 1`)에 붙음(레거시/미조작 날짜와 섞이지 않음 확인).
- 다른 사용자 계정으로 첫 번째 사용자의 id들을 넣어 reorder 시도 → `400`(개수 불일치로 거부), 원본 데이터 불변 확인.
- 비로그인 reorder 요청 → `401`. 잘못된 날짜 형식 → `400`(zod 메시지).
- `pnpm lint` 통과(최초 시도 시 `useEffect` 안 `setState` 직접 호출을 지적하는 `react-hooks/set-state-in-effect` 오류가 나서, [React 문서의 권장 패턴](https://react.dev/reference/react/useState#storing-information-from-previous-renders)대로 렌더 중 비교 방식으로 수정 후 통과).
- `pnpm build` 통과(`prisma generate` 포함). `pnpm run db:push` 실행 — MongoDB는 nullable 필드 추가라 "이미 동기화됨"으로 확인.
- 테스트로 만든 두 계정과 그 할 일은 작업 후 모두 삭제함.

**아직 확인하지 못한 것**: 실제 브라우저에서의 드래그 조작감(마우스/터치)과 모바일 폭 레이아웃은
이 세션에 브라우저가 없어 API 계약만 검증했다. `pnpm dev`로 직접 드래그해보고,
특히 터치 기기(또는 브라우저 개발자 도구의 터치 에뮬레이션)에서 스크롤과 드래그가
충돌하지 않는지 확인이 필요하다.
