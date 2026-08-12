// 모든 사용자가 같은 순간에 같은 글감을 받아야 하므로, 기기 시간대와 무관하게
// 서비스 기준 시간대(KST)로 "오늘"을 계산한다.
const SERVICE_TIMEZONE_OFFSET_MINUTES = 9 * 60;

function toServiceDate(date: Date): Date {
  return new Date(date.getTime() + (SERVICE_TIMEZONE_OFFSET_MINUTES + date.getTimezoneOffset()) * 60 * 1000);
}

export function todayDateString(): string {
  const now = toServiceDate(new Date());
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateStringToPromptId(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

export function isConsecutiveDay(prevDateStr: string, currentDateStr: string): boolean {
  const prev = new Date(prevDateStr);
  const current = new Date(currentDateStr);
  const diffMs = current.getTime() - prev.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

export function formatDisplayDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.');
}

// 타임스탬프를 서비스 기준 날짜 문자열로 변환한다 (게시물/프로필 날짜 표시용).
export function timestampToDateString(ms: number): string {
  const d = toServiceDate(new Date(ms));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
