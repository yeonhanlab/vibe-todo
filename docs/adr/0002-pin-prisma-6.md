# ADR-0002: Prisma 6.19.3 고정

## Status

Accepted (2026-09-10)

## Context

`pnpm create next-app` 이후 Prisma를 설치하면 `latest` dist-tag가 `prisma@7.x`(사실상 RC)를
가리키고 있었다. Prisma 7에서 확인된 문제:

- `schema.prisma`의 `datasource.url = env("DATABASE_URL")` 방식 미지원.
- 런타임에 driver adapter가 필수(구성 부담 증가).
- MongoDB 지원이 아직 미성숙 — 기본 설정만으로 즉시 깨짐.

이 앱은 MongoDB Atlas를 쓰고, 배포 대상은 Vercel이다. 안정성이 우선이다.

## Decision

- `prisma`와 `@prisma/client`를 **6.19.3**에 고정한다 (MongoDB 성숙도가 높은 마지막 6.x 계열 안정판).
- `package.json` dependencies에 캐럿 없이 정확한 버전(`"6.19.3"`)으로 명시한다.
- 스키마는 `url = env("DATABASE_URL")` 방식을 그대로 사용한다.
- MongoDB는 마이그레이션을 지원하지 않으므로 스키마 반영은 `prisma db push`(`pnpm run db:push`)로 한다.

## Consequences

- **장점**: 알려진 파괴적 변경을 피하고, 기존 문서/예제와 동작이 일치한다. driver adapter 구성 불필요.
- **단점**: Prisma 7+의 신기능/성능 개선을 당분간 받지 못한다. 보안 패치는 6.x 라인에서만 받는다.
- 업그레이드하려면 driver adapter 도입 + MongoDB 지원 성숙도를 재평가하고 새 ADR로 기록한다.
- `postinstall`과 `build` 스크립트에 `prisma generate`가 필요하다(Vercel에서 stale client 방지).
