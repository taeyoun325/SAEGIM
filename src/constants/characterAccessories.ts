// 펫 육성 실험의 "꾸미기" 아이템. 이모지 조합만으로 표현해 별도 그림
// 자산 없이도 장착감을 줄 수 있게 했다(스프라이트 전환은 characterGrowth.ts
// 상단에 남겨둔 CC0 소스로 다음 단계에서 진행).
export interface CharacterAccessoryDef {
  id: string;
  emoji: string; // '' = 장식 없음
  label: string;
  minAffection: number; // 먹이 주기로 쌓은 애정도가 이 값 이상이면 해금
}

export const CHARACTER_ACCESSORIES: CharacterAccessoryDef[] = [
  { id: 'none', emoji: '', label: '없음', minAffection: 0 },
  { id: 'ribbon', emoji: '🎀', label: '리본', minAffection: 3 },
  { id: 'cap', emoji: '🧢', label: '모자', minAffection: 7 },
  { id: 'glasses', emoji: '🕶️', label: '선글라스', minAffection: 15 },
  { id: 'crown', emoji: '👑', label: '왕관', minAffection: 30 },
];
