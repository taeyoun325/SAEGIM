// 공유 카드는 SNS로 나가는 산출물이므로 보내는 사람의 기기 테마(다크모드)를 따르지 않는다.
// 같은 글을 공유하면 누가 공유해도 같은 카드가 나와야 하고, '밤' 테마와도 구분돼야 한다.
import { lightColors } from './theme';

export interface ShareTheme {
  id: string;
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  showMascot: boolean;
  showQuoteMarks: boolean;
}

function seasonalColors(): { background: string; accent: string } {
  const month = new Date().getMonth() + 1; // 1~12
  if (month >= 3 && month <= 5) return { background: '#E4F1DB', accent: '#7FAE6B' }; // 봄
  if (month >= 6 && month <= 8) return { background: '#DCEEF7', accent: '#5B9BC4' }; // 여름
  if (month >= 9 && month <= 11) return { background: '#F6E3D4', accent: lightColors.accent }; // 가을
  return { background: '#E3EAF3', accent: '#7A93B5' }; // 겨울
}

const seasonal = seasonalColors();

export const SHARE_THEMES: ShareTheme[] = [
  {
    id: 'default',
    name: '기본',
    background: lightColors.background,
    textColor: lightColors.text,
    accentColor: lightColors.primary,
    showMascot: true,
    showQuoteMarks: false,
  },
  {
    id: 'minimal',
    name: '미니멀',
    background: '#FFFFFF',
    textColor: '#1A1A1A',
    accentColor: '#1A1A1A',
    showMascot: false,
    showQuoteMarks: false,
  },
  {
    id: 'emotional',
    name: '감성',
    background: lightColors.accentSoft,
    textColor: lightColors.primary,
    accentColor: lightColors.accent,
    showMascot: true,
    showQuoteMarks: true,
  },
  {
    id: 'night',
    name: '밤',
    background: lightColors.primary,
    textColor: '#FFFFFF',
    accentColor: lightColors.accent,
    showMascot: true,
    showQuoteMarks: false,
  },
  {
    id: 'seasonal',
    name: '계절',
    background: seasonal.background,
    textColor: lightColors.text,
    accentColor: seasonal.accent,
    showMascot: true,
    showQuoteMarks: false,
  },
];

export const DEFAULT_SHARE_THEME = SHARE_THEMES[0];
