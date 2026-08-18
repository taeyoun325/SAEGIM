import { CIVILITY_NUDGE_WORDS } from '../constants/civilityWords';

// 뮤트한 단어가 글 내용에 들어있는지 확인한다(대소문자 구분 없이 부분 일치).
// 차단이 "누가 썼는지"로 거르는 것이라면, 이건 "무슨 내용인지"로 거르는 것이다.
export function matchesMutedKeyword(lines: string[], keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const content = lines.join(' ').toLowerCase();
  return keywords.some((k) => k.trim().length > 0 && content.includes(k.trim().toLowerCase()));
}

// 글/댓글을 올리기 전에 명백히 공격적인 표현이 있는지 확인한다(부분 일치).
// 걸러도 막지 않는다 — 호출부에서 "정말 남길까요?" 되묻는 용도로만 쓴다.
export function containsSensitiveWord(text: string): boolean {
  const lower = text.toLowerCase();
  return CIVILITY_NUDGE_WORDS.some((w) => lower.includes(w));
}
