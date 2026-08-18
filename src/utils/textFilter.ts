// 뮤트한 단어가 글 내용에 들어있는지 확인한다(대소문자 구분 없이 부분 일치).
// 차단이 "누가 썼는지"로 거르는 것이라면, 이건 "무슨 내용인지"로 거르는 것이다.
export function matchesMutedKeyword(lines: string[], keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const content = lines.join(' ').toLowerCase();
  return keywords.some((k) => k.trim().length > 0 && content.includes(k.trim().toLowerCase()));
}
