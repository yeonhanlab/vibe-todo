# 일일 ToDo 앱

개인용 일일 ToDo 앱. 날짜별로 할 일을 등록·완료 체크하고, 카테고리(색상)로 분류하며,
매일/매주 반복 루틴을 등록해두면 해당 날짜에 자동으로 채워진다.

자세한 제품 요구사항은 [`docs/prd/todo-app.md`](docs/prd/todo-app.md),
전체 구조는 [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) 참고.

## 기술 스택

- **프레임워크**: Next.js 16 (App Router, Turbopack) + TypeScript + React 19
- **스타일**: Tailwind CSS v4 (컴포넌트 라이브러리 없음)
- **인증**: Auth.js v5 — 아이디/비밀번호(Credentials), JWT 세션
- **DB**: Prisma 6 + MongoDB Atlas
- **폼/검증**: react-hook-form + zod (클라이언트/서버 공용 스키마)
- **패키지 매니저**: pnpm

## 로컬 실행

```bash
pnpm install
```

`.env.example`을 복사해 `.env`를 만들고 값을 채운다.

```
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>/<dbname>?retryWrites=true&w=majority"
AUTH_SECRET="<npx auth secret 로 생성>"
AUTH_TRUST_HOST=true   # 로컬 next start 용. Vercel 배포 시엔 불필요
```

스키마를 Atlas에 반영한다 (MongoDB는 마이그레이션이 없어 `db push`를 쓴다).

```bash
pnpm run db:push
```

개발 서버 실행:

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000) 접속 → 미로그인이면 `/login`으로 이동한다.
`/register`에서 계정을 만들 수 있다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 (기본 포트 3000) |
| `pnpm build` | `prisma generate && next build` |
| `pnpm start` | 프로덕션 서버 실행 (`build` 이후) |
| `pnpm lint` | ESLint |
| `pnpm run db:push` | 스키마 변경을 Atlas에 반영 (dev 서버는 종료한 뒤 실행) |
| `pnpm run db:studio` | Prisma Studio (`localhost:5555`)로 DB 내용 확인 |

## 문서

- [`CLAUDE.md`](CLAUDE.md) — 작업 규칙, 문서 구조, 컨벤션
- [`docs/prd/`](docs/prd/) — 제품 요구사항
- [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) — 현재 구조, 알려진 함정, 배포 체크리스트
- [`docs/adr/`](docs/adr/) — 기술 결정 기록
- [`docs/rfcs/`](docs/rfcs/) — 기능별 구현 계획 (완료/진행 예정)

## 배포

Vercel + MongoDB Atlas 대상. 체크리스트는
[`docs/rfcs/0003-polish-and-deploy.md`](docs/rfcs/0003-polish-and-deploy.md) 참고.
