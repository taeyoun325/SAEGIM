import type { ShareFontKey } from '../services/shareFontService';

// 공유 카드는 SNS로 나가는 산출물이므로 보내는 사람의 기기 테마(다크모드)를 따르지 않는다.
// 같은 글을 공유하면 누가 공유해도 같은 카드가 나와야 하고, '밤' 테마와도 구분돼야 한다.
//
// 꾸밈에 쓰는 외부 소스는 글꼴 하나뿐이다 — 구글 폰트(Open Font License)에서 가져온
// 나눔명조와 개구. 상업적 사용·재배포가 허용돼 있고 라이선스 전문이 패키지에 함께 들어온다.
// 이미지·아이콘은 가져다 쓰지 않고 전부 코드로 그린다(원·선·점). 원격 이미지를 쓰면
// 비행기 모드나 지하철에서 카드가 반쯤 빈 채로 찍히는데, 공유는 그럴 때 더 자주 한다.
//
// 각 테마는 색·글꼴·배경 무늬·테두리 네 가지를 조합해 서로 확실히 달라 보이게 만든다.

// 본문 뒤에 깔리는 배경 무늬. 전부 View로 그린다.
//   none  : 무늬 없음(장식 원만)
//   dots  : 규칙적인 점무늬 — 노트 표지 느낌
//   rules : 가로 줄 — 편지지 느낌
//   stars : 흩뿌린 작은 점 — 밤하늘 느낌
export type SharePattern = 'none' | 'dots' | 'rules' | 'stars';

export interface ShareTheme {
  id: string;
  name: string;
  // 카드 배경 그라디언트(위 → 아래). 테마 미리보기 스와치에는 첫 색을 쓴다.
  gradient: [string, string];
  textColor: string;
  accentColor: string;
  // 본문 뒤에 아주 옅게 깔리는 장식 원. 카드가 비어 보이지 않게 해준다.
  blobColor: string;
  showQuoteMarks: boolean;
  // 본문에 쓸 글꼴. 실제 로딩은 공유 직전에 한 벌만 이뤄진다(shareFontService).
  font: ShareFontKey;
  pattern: SharePattern;
  // 카드 안쪽에 한 겹 두르는 얇은 테두리. 액자처럼 보이게 해 글에 무게를 준다.
  framed: boolean;
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
    showQuoteMarks: false,
    font: 'jua',
    pattern: 'none',
    framed: false,
  },
  {
    id: 'minimal',
    name: '미니멀',
    // 흰 종이에 가까운 무채색. 글자 크기 대비만으로 보여주는 에디토리얼 느낌.
    gradient: ['#FFFFFF', '#F4F5F7'],
    textColor: '#1B1B1F',
    accentColor: '#5F656E',
    blobColor: '#E8EAEE',
    showQuoteMarks: false,
    font: 'jua',
    pattern: 'none',
    framed: false,
  },
  {
    id: 'emotional',
    name: '감성',
    gradient: ['#FFF0E8', '#F6CFC2'],
    textColor: '#5B3A2E',
    accentColor: '#A2503A',
    blobColor: '#F2B9A4',
    showQuoteMarks: true,
    font: 'myeongjo',
    pattern: 'none',
    framed: false,
  },
  {
    id: 'night',
    name: '밤',
    // 남색 계열로 바꿔 '다크모드 배경'과 확실히 구분되게 했다.
    gradient: ['#232A38', '#141922'],
    textColor: '#F3EFE8',
    accentColor: '#E0B778',
    blobColor: '#3A4560',
    showQuoteMarks: false,
    font: 'myeongjo',
    pattern: 'stars',
    framed: false,
  },
  {
    id: 'seasonal',
    name: '계절',
    gradient: seasonal.gradient,
    textColor: '#33302B',
    accentColor: seasonal.accent,
    blobColor: seasonal.blob,
    showQuoteMarks: false,
    font: 'jua',
    pattern: 'none',
    framed: false,
  },
  {
    id: 'letter',
    name: '편지',
    // 손글씨 + 가로 줄. 편지지에 눌러쓴 것처럼 보이게 한다.
    gradient: ['#FFFCF2', '#F6EEDA'],
    textColor: '#4A4034',
    accentColor: '#8A6F45',
    blobColor: '#EADFC4',
    showQuoteMarks: false,
    font: 'handwriting',
    pattern: 'rules',
    framed: false,
  },
  {
    id: 'book',
    name: '문고',
    // 명조 + 얇은 액자 테두리. 시집 한 쪽을 찍은 듯한 인상.
    gradient: ['#FBF7F0', '#EFE6D8'],
    textColor: '#2B2721',
    accentColor: '#6E5A3E',
    blobColor: '#E2D6C2',
    showQuoteMarks: true,
    font: 'myeongjo',
    pattern: 'none',
    framed: true,
  },
  {
    id: 'dotted',
    name: '점무늬',
    // 점무늬 배경. 다이어리 속지처럼 가볍고 밝은 인상.
    gradient: ['#F4F8FF', '#E2ECFA'],
    textColor: '#28303D',
    accentColor: '#40618C',
    blobColor: '#C9DAF0',
    showQuoteMarks: false,
    font: 'jua',
    pattern: 'dots',
    framed: false,
  },
];

export const DEFAULT_SHARE_THEME = SHARE_THEMES[0];
