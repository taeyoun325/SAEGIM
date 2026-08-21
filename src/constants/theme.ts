export type ColorTokens = {
  background: string;
  card: string;
  primary: string;
  accent: string;
  accentSoft: string;
  text: string;
  textSoft: string;
  border: string;
  danger: string;
  success: string;
};

// textSoft/danger/success는 기존 값이 카드(#FFFFFF) 위에서 4.5:1에 못 미쳐(각각
// 3.86 · 3.33 · 3.17) 작은 본문 글자(날짜, 오류 메시지, 공개/비공개 배지 등)에는
// WCAG AA 기준 미달이었다. 같은 색조를 유지한 채 명도만 낮춰 배경/카드 양쪽에서
// 4.5:1 이상이 되도록 다시 잡았다(textSoft 4.9~5.1 · danger 4.6~4.7 · success 4.6~4.7).
export const colors: ColorTokens = {
  background: '#FFFBF5',
  card: '#FFFFFF',
  primary: '#4A3F35',
  accent: '#E8A87C',
  accentSoft: '#F6E3D4',
  text: '#2E2A26',
  textSoft: '#756D66',
  border: '#EEE5DA',
  danger: '#B25959',
  success: '#567B6F',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 16,
  md: 24,
  lg: 32,
  full: 999,
};

export const fonts = {
  regular: 'Jua_400Regular',
};

// 글자 크기: 시스템 폰트 확대(OS 설정)와는 별개로 앱 안에서 직접 고를 수 있게 한다.
// WCAG 1.4.4(텍스트 200%까지 확대돼도 정보 손실이 없어야 한다)를 참고했지만,
// 여기서는 "고르면 바로 반영"되는 편의 기능으로 세 단계만 둔다.
export type FontScalePreference = 'small' | 'medium' | 'large';

export const FONT_SCALE_STORAGE_KEY = 'saegim:fontScale';

export const FONT_SCALE_VALUES: Record<FontScalePreference, number> = {
  small: 0.9,
  medium: 1,
  large: 1.2,
};
