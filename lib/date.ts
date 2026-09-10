// 날짜는 앱 전체에서 "YYYY-MM-DD" 문자열로 다룬다.
// 타임존 이슈를 피하기 위해 날짜 계산은 항상 UTC 기준으로 처리한다.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "오늘"의 기준 타임존. Vercel 서버는 UTC이므로 명시적으로 고정한다.
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Seoul";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** 형식과 실제 존재하는 날짜인지 검증한다. */
export function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** APP_TIMEZONE 기준 오늘 날짜를 "YYYY-MM-DD"로 반환한다. */
export function todayStr(): string {
  // en-CA 로케일은 "YYYY-MM-DD" 형태로 포맷된다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTCDate(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** dateStr 에서 n일 만큼 이동한 날짜 문자열. n은 음수 가능. */
export function addDays(dateStr: string, n: number): string {
  const dt = toUTCDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTCDate(dt);
}

/** 요일 번호. 0(일) ~ 6(토). */
export function weekdayOf(dateStr: string): number {
  return toUTCDate(dateStr).getUTCDay();
}

/** "2026년 9월 10일 (수)" 형태로 표기. */
export function formatKorean(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEKDAY_LABELS[weekdayOf(dateStr)]})`;
}

export { WEEKDAY_LABELS };
