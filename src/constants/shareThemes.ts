import { colors } from './theme';

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
  if (month >= 9 && month <= 11) return { background: '#F6E3D4', accent: colors.accent }; // 가을
  return { background: '#E3EAF3', accent: '#7A93B5' }; // 겨울
}

const seasonal = seasonalColors();

export const SHARE_THEMES: ShareTheme[] = [
  {
    id: 'default',
    name: '기본',
    background: colors.background,
    textColor: colors.text,
    accentColor: colors.primary,
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
    background: colors.accentSoft,
    textColor: colors.primary,
    accentColor: colors.accent,
    showMascot: true,
    showQuoteMarks: true,
  },
  {
    id: 'night',
    name: '밤',
    background: colors.primary,
    textColor: '#FFFFFF',
    accentColor: colors.accent,
    showMascot: true,
    showQuoteMarks: false,
  },
  {
    id: 'seasonal',
    name: '계절',
    background: seasonal.background,
    textColor: colors.text,
    accentColor: seasonal.accent,
    showMascot: true,
    showQuoteMarks: false,
  },
];

export const DEFAULT_SHARE_THEME = SHARE_THEMES[0];
