export interface MoodOption {
  emoji: string;
  label: string;
}

// 오늘 글을 쓸 때 선택적으로 남기는 기분 태그. 굳이 감정을 분석하지 않고
// 사용자가 직접 고르는 고정된 보기 몇 개로만 구성한다.
export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '😊', label: '좋음' },
  { emoji: '😐', label: '보통' },
  { emoji: '😢', label: '슬픔' },
  { emoji: '😠', label: '화남' },
  { emoji: '😴', label: '피곤' },
];

export function moodLabel(emoji: string): string | null {
  return MOOD_OPTIONS.find((m) => m.emoji === emoji)?.label ?? null;
}
