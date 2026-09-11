# RFC-0002: 루틴 → 일일 ToDo 자동 채움 (지연 생성)

- **상태**: ✅ 완료 (2026-09-11, 동시성 하드닝은 미착수 — 아래 참고)
- **관련 PRD**: [`docs/prd/todo-app.md`](../prd/todo-app.md) §4.5
- **관련 ADR**: [ADR-0004](../adr/0004-routine-lazy-materialization.md) (지연 생성 결정)
- **선행**: [RFC-0001](0001-mvp-phase-0-7.md) 완료

---

## 목표

활성 루틴이 해당 요일의 날짜를 열 때, 그 날의 `Todo`로 자동 생성된다.
사용자가 매번 반복 항목을 다시 입력하지 않아도 된다.

## 범위

### Scope
- `lib/todos.ts`의 `getTodosForDate(userId, date)` 앞단에 지연 생성 로직 추가
- `day/[date]/page.tsx`가 이 함수를 사용하도록 연결 (이미 사용 중이면 동작 확인만)
- 루틴에서 생성된 `Todo`(`routineId != null`)를 목록에서 `LuRepeat` 뱃지로 표시
- 동시 요청 중복 생성 완화

### Non-scope
- 과거 날짜 소급 생성 (의도적으로 안 함)
- 루틴 수정 시 이미 생성된 미래 `Todo`를 되돌리는 처리 (생성분은 그대로 둠)
- 루틴 일시정지 스케줄, 예외 날짜(skip) 기능

## 접근 방식

[ADR-0004](../adr/0004-routine-lazy-materialization.md)의 지연 생성 절차를
`getTodosForDate` 안에 구현한다:

1. `active: true` 이고 `startDate <= date` 인 `Routine` 조회.
2. `weekdayOf(date)` 계산 → `frequency === "DAILY"` 이거나
   (`frequency === "WEEKLY"` 이고 `weekdays.includes(weekday)`)인 루틴만 대상.
3. 대상 루틴 중 `(userId, date, routineId)` `Todo`가 아직 없는 것만 `createMany`로 생성.
   - 먼저 해당 날짜의 기존 `Todo`를 조회해 `routineId` 집합을 만들고, 그 집합에 없는 루틴만 생성.
4. **가드**: `date >= todayStr()` 일 때만 생성. 과거 날짜는 조회만.
5. 이후 기존대로 `(userId, date)` 전체 `Todo`를 `createdAt asc`로 반환.

### 동시성

같은 날짜를 두 탭에서 동시에 열면 3번의 "존재 확인 → createMany" 사이에 경쟁이 생길 수 있다.
현재 스키마에 `(userId, date, routineId)` 유니크 제약이 없다.

- **1차 완화**: `createMany` 호출을 try/catch로 감싸고, 생성 후 최종 조회 결과를 신뢰한다
  (중복이 만들어져도 최종 목록에서 눈에 띄면 후속 대응).
- **필요 시**: `prisma/schema.prisma`의 `Todo`에 `@@unique([userId, date, routineId])` 추가 후
  `pnpm run db:push`. `routineId`가 `null`인 수동 항목이 많으면 MongoDB partial index 여부를 확인해야 하므로
  1차 완화로 충분한지 먼저 검증하고 결정한다.

## 작업 단계

- [x] `lib/todos.ts` — `getTodosForDate` 앞단에 `materializeRoutineTodos()` 추가(위 1~4단계). `date >= todayStr()` 가드 포함.
- [x] `lib/todos.ts` — 반환 타입(`DayTodo`)에 `routineId` 이미 노출되어 있었음(뱃지 표시에 사용).
- [x] `lib/todos.ts` — 새로 생성되는 루틴 Todo에도 `nextOrderForDate`로 순서 부여([ADR-0007](../adr/0007-manual-order-full-renumber.md)과 일관되게, RFC-0004 후속 작업 항목이었던 부분).
- [x] `app/(app)/day/[date]/day-view.tsx` — `routineId != null`인 항목에 `LuRepeat` 뱃지.
- [x] `app/(app)/day/[date]/page.tsx` — 기존에 이미 `getTodosForDate`를 쓰고 있어 변경 불필요, 연결 확인만 함.
- [ ] **동시성 하드닝 미착수**: 현재는 "존재 확인 → createMany"만 하고 try/catch나 유니크 제약은 추가하지 않았다.
      `(userId, date, routineId)` 유니크 인덱스가 없어서, 정말 같은 날짜를 동시에 두 탭에서 처음 열면
      이론상 중복 생성 여지가 남아있다 — 개인용 단일 세션 사용 패턴에서는 발생 가능성이 낮다고 보고 보류.
      재현되면 `@@unique([userId, date, routineId])` 추가를 검토한다.
- [x] 수동 회귀(curl, 아래 검증 결과) + `pnpm lint` + `tsc --noEmit` 통과, 테스트 데이터 정리.

## 변경 파일

- `lib/todos.ts` (지연 생성 로직)
- `app/(app)/day/[date]/day-view.tsx` (루틴 뱃지)
- `app/(app)/day/[date]/page.tsx` (연결 확인, 변경 없을 수 있음)
- (조건부) `prisma/schema.prisma` (`@@unique`)

## 리스크

| 리스크 | 대응 |
|---|---|
| 읽기 경로에 쓰기가 섞여 페이지 로드가 느려짐 | 대상 루틴 수는 소수. `createMany` 1회 + 조회 1회로 제한 |
| 동시 요청 중복 생성 | try/catch 완화 → 재현되면 유니크 제약 |
| 과거 날짜를 열었을 때 소급 생성 | `date >= todayStr()` 가드로 차단 (테스트 케이스 포함) |
| 루틴 비활성화 후에도 기존 항목 남음 | 의도된 동작 (PRD §4.5). 뱃지로 출처는 표시됨 |

## 검증 방법

- "물 마시기" 매일 루틴 생성 → **내일** 페이지 열면 자동 생성됨.
- 같은 항목의 완료 상태가 날짜마다 독립적이다.
- 매주 월·수 루틴 → 월·수 날짜에만 등장, 화·목엔 없음.
- 비활성 루틴 → 미래 날짜에 새로 안 생김. 이미 생성된 항목은 유지.
- **과거 날짜**(어제)를 열어도 루틴 항목이 소급 생성되지 않음.
- `startDate` 이전 날짜에는 등장하지 않음.
- `pnpm build` 통과.

### 검증 결과 (2026-09-11, `pnpm dev` + curl, 테스트 계정으로 확인 후 삭제)

- DAILY 루틴 생성 → 내일 날짜 `GET /api/todos`에서 자동 생성된 항목(`routineId` 채워짐) 확인.
- 같은 날짜를 다시 `GET` → 똑같은 `id`로 1건만 반환(중복 생성 안 됨).
- 어제 날짜 `GET` → 빈 배열(소급 생성 안 됨).
- WEEKLY(오늘 요일만) 루틴 생성 → 다른 요일의 미래 날짜엔 DAILY 루틴만 나오고 WEEKLY는 빠짐,
  **같은 요일의 다음 주 날짜**엔 DAILY·WEEKLY 둘 다 나옴 — 요일 필터링 정상.
- `pnpm lint`, `pnpm exec tsc --noEmit` 통과.
- **미검증**: 브라우저에서 `LuRepeat` 뱃지가 실제로 보이는지는 API 레벨 확인만 했고, 화면으로 직접 보진 못했다.
  `/routines`에서 매일 루틴 하나 만들고 `/day`로 가서 확인해줘.
