# RFC-0005: 다크 모드 지원

- **상태**: ✅ 완료 (2026-09-11)
- **관련 PRD**: [`docs/prd/todo-app.md`](../prd/todo-app.md) §4.7
- **관련 ADR**: [ADR-0008 OS 설정만 따름](../adr/0008-dark-mode-os-preference-only.md)
- **선행**: 없음

---

## 목표

OS가 다크 모드일 때, 특히 로그인/회원가입 입력창에서 글자가 거의 안 보이던 문제를
없애고, 헤더·버튼·목록 전반이 다크에서도 자연스럽게 보이게 한다.

## 계기

라이트 배경(`bg-white`)의 입력창에 텍스트 색을 명시적으로 지정하지 않아, OS 다크 모드에서
브라우저가 폼 컨트롤에 적용하는 기본(다크용) 글자색이 흰 배경 위에 그대로 남아 거의
안 보이는 회색으로 렌더링됐다. 헤더는 항상 흰 배경으로 고정돼 있어 다크 모드에서도
튀어 보였다.

## 범위

### Scope
- `app/layout.tsx`, `app/globals.css` — body 배경/글자색에 `dark:` 토큰 적용,
  create-next-app이 만든 미사용 다크 CSS 변수 정리
- `components/header.tsx` — 헤더 배경(흰색→검정), 네비 링크·로그아웃 버튼 색
- `app/login/page.tsx`, `app/register/page.tsx` — 입력창에 **명시적** 라이트/다크
  텍스트·배경·테두리·포커스 색 지정 (근본 원인 수정)
- `app/(app)/day/[date]/day-view.tsx`, `categories-view.tsx`, `routines-view.tsx` —
  버튼·카드 테두리·목록 구분선·주요 텍스트에 `dark:` 클래스 추가

### Non-scope
- 앱 내 라이트/다크 토글 UI (ADR-0008 — OS 설정만 따름)
- 색상 팔레트 전면 재설계 (기존 zinc 계열 + 흰/검정 반전 수준으로 제한)

## 접근 방식

[ADR-0008](../adr/0008-dark-mode-os-preference-only.md): Tailwind v4 기본 `dark:` variant
(미디어 쿼리 기반, OS 설정을 그대로 따름)만 쓰고 토글은 만들지 않는다. 색은 컴포넌트별
Tailwind 클래스에 `dark:` 짝을 붙이는 방식으로 적용(전역 CSS 토큰 레이어 새로 안 만듦 —
기존 코드가 이미 컴포넌트 단위로 색을 관리하고 있어서 그 패턴을 그대로 확장).

원칙:
- 채워진 진한 배경(`bg-zinc-900`) 버튼은 다크에서 반전(`dark:bg-white dark:text-black`)해
  검정 페이지에 묻히지 않게 한다.
- 회색 보조 텍스트(`text-zinc-500/600/700`)는 다크에서 밝게(`dark:text-white` 또는
  `dark:text-zinc-300`) 올려 대비를 확보한다.
- 입력창은 배경·테두리·글자·포커스 링까지 전부 명시적으로 라이트/다크 쌍을 지정한다.

## 작업 단계

- [x] `app/layout.tsx` body에 `dark:bg-black dark:text-white`
- [x] `app/globals.css` — 안 쓰이던 `--background`/`--foreground` 변수와 다크 미디어 쿼리 제거
- [x] `components/header.tsx` — 헤더 배경·네비·로그아웃 버튼
- [x] `app/login/page.tsx`, `app/register/page.tsx` — 입력창(배경/테두리/글자/포커스),
      라벨, 설명 텍스트, 제출 버튼, 하단 링크
- [x] `day-view.tsx` — 날짜 이동 버튼, 추가 패널, 입력창, 목록 테두리/구분선, 완료 텍스트,
      드래그 핸들, 빈 상태 문구
- [x] `categories-view.tsx`, `routines-view.tsx` — 위와 동일한 패턴(입력창, 버튼, 목록,
      빈도/요일 토글, 인라인 수정 버튼)
- [x] `pnpm lint` + `tsc --noEmit` 통과

## 변경 파일

`app/layout.tsx`, `app/globals.css`, `components/header.tsx`, `app/login/page.tsx`,
`app/register/page.tsx`, `app/(app)/day/[date]/day-view.tsx`,
`app/(app)/categories/categories-view.tsx`, `app/(app)/routines/routines-view.tsx`

## 리스크

| 리스크 | 대응 |
|---|---|
| 새 컴포넌트에 `dark:` 클래스를 깜빡함 | ADR-0008에 명시, 리뷰 시 확인 |
| 순수 색 반전으로 대비가 부족한 조합이 남아있을 수 있음 | 실제 OS 다크 모드에서 사용하며 발견되는 대로 추가 수정 |

## 검증 방법 / 결과

- `pnpm lint`, `pnpm exec tsc --noEmit` 통과.
- OS 다크 모드에서 로그인/회원가입 입력창 글자가 명확히 보임(원래 버그 재현 후 수정 확인).
- 헤더가 다크에서 검정 배경으로 바뀌고, 활성 네비 항목은 흰 배경/검정 글자로 반전되어
  구분됨.
- **미검증**: 모든 화면(카테고리·루틴 인라인 수정 상태 등)을 다크 모드에서 픽셀 단위로
  대비 체크하진 않았다. 사용하다 안 보이는 조합이 보이면 추가 수정.
