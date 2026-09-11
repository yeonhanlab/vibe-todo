# RFC-0003: 마무리 + Vercel 배포 준비

- **상태**: ⬜ 진행 예정 (원래 계획의 Phase 9)
- **관련 PRD**: [`docs/prd/todo-app.md`](../prd/todo-app.md) §6
- **선행**: [RFC-0002](0002-routine-auto-materialization.md) 완료

---

## 목표

스타일을 정리하고 전체 회귀를 확인해, Vercel에 배포 가능한 상태로 만든다.

## 범위

### Scope
- 로딩 / 에러 / 빈 상태 UI 정리
- 반응형(모바일 폭) 점검 — `max-w-md mx-auto`, `px-4` 기준
- `README.md`를 실제 프로젝트 내용으로 정비 (로컬 실행법, 환경 변수)
- Vercel 배포 체크리스트 반영 및 실제 배포

### Non-scope
- 신규 기능. 이 단계는 정리와 배포만 다룬다.
- E2E 테스트 도입 (별도 이슈)

## 작업 단계

- [ ] 각 페이지 로딩 상태(`loading.tsx` 또는 스켈레톤) 및 에러 바운더리(`error.tsx`) 정리
- [ ] 빈 상태 문구 정리 (할 일 없음 / 카테고리 없음 / 루틴 없음)
- [ ] 모바일 폭에서 헤더 3링크 + 로그아웃 레이아웃 깨지지 않는지 점검
- [ ] `README.md` — 스택 요약, `pnpm` 명령, `.env` 3개 설명, 배포 방법
- [ ] Vercel 프로젝트 생성 및 Environment Variables 등록 (`DATABASE_URL`, `AUTH_SECRET`)
- [ ] MongoDB Atlas → Network Access `0.0.0.0/0` 허용
- [ ] 배포 후 전체 회귀 시나리오 통과 확인

## Vercel 배포 체크리스트

- [x] `pnpm-lock.yaml` 커밋됨 (Vercel이 pnpm 자동 감지)
- [x] `package.json`에 `"postinstall": "prisma generate"` 존재
- [x] `pnpm-workspace.yaml`에 `onlyBuiltDependencies`(prisma 관련) 존재
- [ ] Vercel Environment Variables에 `DATABASE_URL`, `AUTH_SECRET` 등록 (`AUTH_TRUST_HOST`는 불필요)
- [ ] Atlas Network Access `0.0.0.0/0`
- [ ] 커스텀 도메인 사용 시 `AUTH_URL` 지정 (기본 Vercel 도메인이면 불필요)

## 검증 방법 — 전체 회귀 시나리오

1. 회원가입 → 자동 로그인 → 오늘 페이지
2. 로그아웃 상태로 보호 경로 접근 → `/login`
3. ToDo 추가 · 완료 · 삭제, 새로고침 후 유지
4. 날짜 이동 시 목록 분리
5. 카테고리 생성 / 색상 지정 / 할 일에 적용 / 삭제 시 SetNull
6. 매일 루틴 → 미래 날짜 자동 채움, 완료 상태 날짜별 독립
7. 매주 루틴 → 지정 요일에만
8. 비활성 루틴 → 미래 날짜에 안 생김
9. 두 번째 계정에서 첫 번째 계정 데이터 안 보임 (소유권 격리)
10. `pnpm build` 통과
11. 배포된 URL에서 1~9 재확인

## 리스크

| 리스크 | 대응 |
|---|---|
| Vercel 빌드에서 stale Prisma client | `postinstall: prisma generate` 확인 (이미 존재) |
| Atlas 연결 거부 | Network Access IP 허용 확인 |
| `next start` 전용으로 넣은 `AUTH_TRUST_HOST`가 Vercel에서 문제 | Vercel에서는 무해. 필요 시 Vercel 환경에서만 제거 |
