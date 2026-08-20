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

export function promptIdToDateString(promptId: string): string {
  return `${promptId.slice(0, 4)}-${promptId.slice(4, 6)}-${promptId.slice(6, 8)}`;
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

// 오늘을 포함해 최근 N일의 날짜 문자열을 오래된 날짜순으로 반환한다.
// "이번 주 새김" 같은 최근 N일 요약 위젯에 쓴다.
export function recentDateStrings(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    result.push(timestampToDateString(Date.now() - i * 24 * 60 * 60 * 1000));
  }
  return result;
}

// N년 전 오늘(같은 월/일)의 promptId를 구한다. "1년 전 오늘" 회고 카드에 쓴다.
// 2/29처럼 대상 연도에 없는 날짜는 Date가 자동으로 다음 날로 보정한다(연 1회, 4년에 한 번뿐인
// 아주 드문 경우라 별도 처리를 두지 않는다).
export function yearsAgoPromptId(years: number): string {
  const now = toServiceDate(new Date());
  const past = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  const y = past.getFullYear();
  const m = String(past.getMonth() + 1).padStart(2, '0');
  const d = String(past.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
