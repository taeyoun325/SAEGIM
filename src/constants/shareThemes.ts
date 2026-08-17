// 공유 카드는 SNS로 나가는 산출물이므로 보내는 사람의 기기 테마(다크모드)를 따르지 않는다.
// 같은 글을 공유하면 누가 공유해도 같은 카드가 나와야 하고, '밤' 테마와도 구분돼야 한다.
//
// 색은 직접 정한 값이라 외부 에셋 라이선스 문제가 없다(Open Color 같은 공개 팔레트의
// 톤 구성 방식을 참고했을 뿐, 이미지나 폰트를 가져다 쓰지 않는다).
// 각 테마는 단색이 아니라 두 색 그라디언트로 깊이를 주고, 브랜드 이름 아래
// 얇은 강조선을 둬서 글이 주인공으로 보이게 만든다.

export interface ShareTheme {
  id: string;
  name: string;
  // 카드 배경 그라디언트(위 → 아래). 테마 미리보기 스와치에는 첫 색을 쓴다.
  gradient: [string, string];
  textColor: string;
  accentColor: string;
  // 본문 뒤에 아주 옅게 깔리는 장식 원. 카드가 비어 보이지 않게 해준다.
  blobColor: string;
  showMascot: boolean;
  showQuoteMarks: boolean;
}

function seasonalTheme(): { gradient: [string, string]; accent: string; blob: string } {
  const month = new Date().getMonth() + 1; // 1~12
  // 봄: 연둣빛 / 여름: 물빛 / 가을: 감빛 / 겨울: 서늘한 청회색
  if (month >= 3 && month <= 5) return { gradient: ['#F2F9EC', '#D9EBCB'], accent: '#4C7038', blob: '#BFDCA8' };
  if (month >= 6 && month <= 8) return { gradient: ['#EEF7FC', '#CFE7F3'], accent: '#2F6987', blob: '#AED6E8' };
  if (month >= 9 && month <= 11) return { gradient: ['#FDF3EA', '#F6DCC4'], accent: '#9C5A2B', blob: '#EFC9A3' };
  return { gradient: ['#F1F4F9', '#DCE4EF'], accent: '#4A617E', blob: '#C2D0E2' };
}

const seasonal = seasonalTheme();

export const SHARE_THEMES: ShareTheme[] = [
  {
    id: 'default',
    name: '기본',
    gradient: ['#FFFDF9', '#F7E7D7'],
    textColor: '#3A3129',
    accentColor: '#96602D',
    blobColor: '#F0D2B4',
    showMascot: true,
    showQuoteMarks: false,
  },
  {
    id: 'minimal',
    name: '미니멀',
    // 흰 종이에 가까운 무채색. 글자 크기 대비만으로 보여주는 에디토리얼 느낌.
    gradient: ['#FFFFFF', '#F4F5F7'],
    textColor: '#1B1B1F',
    accentColor: '#5F656E',
    blobColor: '#E8EAEE',
    showMascot: false,
    showQuoteMarks: false,
  },
  {
    id: 'emotional',
    name: '감성',
    gradient: ['#FFF0E8', '#F6CFC2'],
    textColor: '#5B3A2E',
    accentColor: '#A2503A',
    blobColor: '#F2B9A4',
    showMascot: true,
    showQuoteMarks: true,
  },
  {
    id: 'night',
    name: '밤',
    // 남색 계열로 바꿔 '다크모드 배경'과 확실히 구분되게 했다.
    gradient: ['#232A38', '#141922'],
    textColor: '#F3EFE8',
    accentColor: '#E0B778',
    blobColor: '#3A4560',
    showMascot: true,
    showQuoteMarks: false,
  },
  {
    id: 'seasonal',
    name: '계절',
    gradient: seasonal.gradient,
    textColor: '#33302B',
    accentColor: seasonal.accent,
    blobColor: seasonal.blob,
    showMascot: true,
    showQuoteMarks: false,
  },
];

export const DEFAULT_SHARE_THEME = SHARE_THEMES[0];
