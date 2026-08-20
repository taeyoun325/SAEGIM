import { CIVILITY_NUDGE_WORDS } from '../constants/civilityWords';

// 글/댓글을 올리기 전에 명백히 공격적인 표현이 있는지 확인한다(부분 일치).
// 걸러도 막지 않는다 — 호출부에서 "정말 남길까요?" 되묻는 용도로만 쓴다.
export function containsSensitiveWord(text: string): boolean {
  const lower = text.toLowerCase();
  return CIVILITY_NUDGE_WORDS.some((w) => lower.includes(w));
}
