# ADR-0003: 날짜를 `"YYYY-MM-DD"` 문자열로 저장

## Status

Accepted (2026-09-10)

## Context

앱의 핵심 조회는 "특정 날짜의 할 일 목록"이다. `Todo.date`, `Routine.startDate`를
어떤 타입으로 저장할지 결정해야 했다.

- **`DateTime`(UTC 타임스탬프)** — MongoDB/Prisma의 기본. 하지만 "그 날"이라는 개념은
  타임존에 따라 경계가 달라진다. 서버·클라이언트·DB의 타임존이 어긋나면 하루가 밀리는
  버그가 흔하다. `date`만 필요한데 시각까지 저장하면 동등 비교도 번거롭다.
- **`String "YYYY-MM-DD"`** — 사람이 말하는 "그 날"과 1:1로 대응. 문자열 동등 비교로
  날짜별 조회가 명확하고, 사전순 정렬이 곧 날짜순 정렬이다.

## Decision

- `Todo.date`, `Routine.startDate`를 `String`으로 저장하고 형식은 항상 `"YYYY-MM-DD"`로 강제한다.
- 날짜 계산(오늘, N일 이동, 요일)은 `lib/date.ts`에 모으고 **전부 UTC 기준**으로 계산한다.
  "오늘"의 기준 타임존만 `Asia/Seoul`로 고정한다(`todayStr()`).
- 조회는 `where: { userId, date: dateStr }` 문자열 동등 비교, 정렬은 `createdAt asc`(같은 날 안에서).
- 입력 형식 검증은 `lib/validation.ts`의 zod 스키마(`isValidDateStr`)로 한다.

## Consequences

- **장점**: 타임존 버그를 구조적으로 제거. Atlas 인덱스(`@@index([userId, date])`)가 단순하고
  범위 조회(`date >= todayStr()`)도 문자열 비교로 가능. URL(`/day/2026-09-11`)과 저장 형식이 동일.
- **단점**: "지난 30일" 같은 범위 계산은 애플리케이션 코드(`addDays`)로 해야 한다.
  DB 레벨 날짜 함수(`$dateTrunc` 등)를 쓸 수 없다. 형식이 깨진 문자열이 들어오지 않도록
  경계에서 항상 검증해야 한다.
- 캘린더/통계 뷰가 생겨 복잡한 날짜 집계가 필요해지면 파생 필드 추가를 검토한다(새 ADR).
