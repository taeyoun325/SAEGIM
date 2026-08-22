// 펫이 매일 건네는 짧은 한마디 + 쓰다듬을 때 나오는 즉흥 반응.
// 글감(promptPool.ts)과 같은 방식으로 날짜만으로 결정론적으로 고른다 —
// 서버 없이도 모든 사용자가 같은 날 같은 한마디를 보고, 하루가 지나면 자연히 바뀐다.

export const CHARACTER_DAILY_LINES: string[] = [
  '오늘은 어떤 생각이 떠올랐나요?',
  '저는 매일 당신을 기다리고 있어요.',
  '오늘도 함께 자라볼까요?',
  '가끔은 세 줄도 길게 느껴지는 날이 있죠. 짧아도 괜찮아요.',
  '어제 새긴 생각, 오늘 다시 읽어보면 느낌이 다를지도 몰라요.',
  '날씨가 어떻든, 여기는 항상 당신 편이에요.',
  '오늘 하루도 애썼어요.',
  '가끔 저를 쓰다듬어 주는 것도 잊지 마세요.',
  '새기는 건 잘하는 것보다 계속하는 게 더 중요해요.',
  '오늘의 글감, 벌써 확인했나요?',
  '작은 생각도 나중엔 큰 기록이 돼요.',
  '당신이 새긴 만큼 저도 자라고 있어요.',
  '오늘은 어떤 기분인가요?',
  '누군가 당신의 글을 읽고 위로받았을지도 몰라요.',
  '쉬어가는 날도 성장의 일부예요.',
  '캘린더를 보면 우리가 함께한 날들이 보여요.',
  '오늘 새긴 생각이 언젠가 소중한 기록이 될 거예요.',
  '도감에 아직 못 채운 친구가 있어요, 궁금하지 않아요?',
  '가끔은 지난 글감으로 다시 써보는 것도 재밌어요.',
  '당신의 세 줄을 기다리고 있어요.',
];

// 쓰다듬기(탭)에 대한 즉흥 반응. 매번 랜덤이라 눌러볼 때마다 다르게 나온다.
export const CHARACTER_PAT_REACTIONS: string[] = [
  '기분 좋아요!',
  '헤헤, 간지러워요.',
  '오늘도 고마워요.',
  '조금 더요!',
  '당신 손길이 좋아요.',
  '기운이 나요!',
  '저도 당신이 좋아요.',
];

// 오늘 남긴 기분 이모지에 대한 펫의 짧은 반응.
export const CHARACTER_MOOD_REACTIONS: Record<string, string> = {
  '😊': '오늘 기분 좋으시다니 저도 덩달아 신나요!',
  '😐': '그냥 그런 날도 괜찮아요, 저랑 같이 있어요.',
  '😢': '오늘은 제가 옆에 있을게요.',
  '😠': '화날 땐 화내도 돼요. 저는 여기 있을게요.',
  '😴': '오늘은 푹 쉬어요. 저도 같이 졸릴래요.',
};

// 날짜 문자열(YYYY-MM-DD)만으로 결정되는 인덱스를 뽑는다. promptService.ts의
// fallbackPromptFor와 같은 방식(1970-01-01부터 며칠째인지)이라 시간대와 무관하다.
function dayNumberFor(dateStr: string): number {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 86400000);
}

export function getCharacterDailyLine(dateStr: string): string {
  const dayNumber = dayNumberFor(dateStr);
  const index = ((dayNumber % CHARACTER_DAILY_LINES.length) + CHARACTER_DAILY_LINES.length) % CHARACTER_DAILY_LINES.length;
  return CHARACTER_DAILY_LINES[index];
}

export function randomPatReaction(): string {
  return CHARACTER_PAT_REACTIONS[Math.floor(Math.random() * CHARACTER_PAT_REACTIONS.length)];
}

export function moodReactionLine(mood: string): string | null {
  return CHARACTER_MOOD_REACTIONS[mood] ?? null;
}
