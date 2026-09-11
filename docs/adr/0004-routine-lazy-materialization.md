# ADR-0004: 반복 루틴을 지연 생성(lazy materialization)으로 처리

## Status

Accepted (2026-09-10)

## Context

"매일 물 마시기", "매주 월·수 회의 준비" 같은 반복 루틴이 해당 날짜의 할 일로
나타나야 한다. 반복을 실제 `Todo` 레코드로 언제 만들지 선택지가 있다:

- **사전 생성(eager)** — 루틴 등록 시 앞으로 N일치 `Todo`를 미리 만든다. 크론/스케줄러로
  매일 다음 날치를 채운다. → 스케줄러 인프라 필요(Vercel Cron 등), 루틴 수정 시 이미 만든
  미래 항목들을 어떻게 처리할지 복잡, 저장 공간 낭비.
- **완전 가상(never materialize)** — `Todo`를 만들지 않고 조회 시점에 루틴을 합성해 보여준다.
  → 개별 항목의 완료 체크·삭제·카테고리 지정을 저장할 곳이 없다.
- **지연 생성(lazy)** — 특정 날짜를 **조회할 때** 그 날 대상 루틴의 `Todo`가 없으면 그 자리에서 만든다.

## Decision

- 지연 생성을 채택한다. `lib/todos.ts`의 `getTodosForDate(userId, date)` 앞단에서:
  1. `active: true` 이고 `startDate <= date` 인 `Routine` 조회.
  2. `weekdayOf(date)` 계산 → `frequency === "DAILY"` 이거나 (`WEEKLY` 이고 `weekdays.includes(weekday)`)인 루틴만 대상.
  3. 대상 루틴 중 `(userId, date, routineId)` `Todo`가 아직 없는 것만 `createMany`로 생성.
  4. **가드**: `date >= todayStr()` 일 때만 생성한다. 과거 날짜는 조회만 하고 소급 생성하지 않는다.
  5. 이후 기존대로 `(userId, date)` 전체 `Todo`를 반환.
- 생성된 `Todo`는 `routineId`로 원본 루틴에 연결하고, 루틴 삭제 시 `onDelete: SetNull`로 항목은 남긴다.
- 완료 여부는 `Todo`마다 저장되므로 날짜별로 독립적이다.

## Consequences

- **장점**: 스케줄러 인프라가 필요 없다. 루틴을 수정/비활성화하면 아직 생성되지 않은
  미래 날짜에 자연스럽게 반영된다(이미 생성된 항목은 유지). 저장은 실제로 열어본 날짜에 대해서만 발생.
- **단점**: 읽기 경로(`getTodosForDate`)에 쓰기가 섞인다. 같은 날짜를 두 탭에서 동시에 열면
  중복 생성 가능성이 있다 — 현재 스키마에 `(userId, date, routineId)` 유니크 제약이 없다.
  Phase 8에서 `createMany` 전 존재 확인으로 완화하고, 필요 시 `@@unique([userId, date, routineId])` 추가를 검토한다.
- 과거 날짜에는 루틴이 소급 표시되지 않는다(의도된 동작 — PRD 참조).
- 이 로직은 아직 구현 전이다. 구현 계획: [`docs/rfcs/0002-routine-auto-materialization.md`](../rfcs/0002-routine-auto-materialization.md).
