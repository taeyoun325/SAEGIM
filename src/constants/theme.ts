import { Appearance } from 'react-native';

// 색 토큰은 하나가 여러 역할을 겸한다. 특히 primary는
//   (1) 제목/브랜드 텍스트 색  (2) 버튼 배경(그 위에 흰 글자)
// 두 가지로 쓰이므로, 다크 팔레트의 primary는 "어두운 배경 위에서 읽히면서
// 동시에 흰 글자를 받칠 수 있는" 중간 톤이어야 한다. 너무 밝게 잡으면 버튼 글자가 사라진다.
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

export const lightColors: ColorTokens = {
  background: '#FFFBF5',
  card: '#FFFFFF',
  primary: '#4A3F35',
  accent: '#E8A87C',
  accentSoft: '#F6E3D4',
  text: '#2E2A26',
  textSoft: '#8A8078',
  border: '#EEE5DA',
  danger: '#D96C6C',
  success: '#6C9A8B',
};

// 대비는 브라우저에서 실측해 맞췄다(라이트 모드 대비 회귀가 없도록):
//   primary on background 5.4:1 · primary on card 4.9:1 · primary on accentSoft 4.8:1
//   흰 글자 on primary 3.3:1 (버튼 라벨은 굵은 큰 글자라 AA-large 기준 통과)
export const darkColors: ColorTokens = {
  background: '#1A1714',
  card: '#252017',
  primary: '#A88763',
  accent: '#E8A87C',
  accentSoft: '#2B211A',
  text: '#F2EDE6',
  textSoft: '#A39A90',
  border: '#3A342E',
  danger: '#E58B8B',
  success: '#7FB3A2',
};

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'saegim:themePreference';

// 29개 화면이 StyleSheet.create에 색을 구워넣는 구조라, colors를 "내용을 바꿀 수 있는
// 하나의 객체"로 두고 화면 모듈이 로드되기 전에 값만 갈아끼운다.
// App.tsx가 저장된 설정을 먼저 읽고 applyThemePreference를 호출한 뒤에야
// 화면들이 들어있는 AppShell을 동적으로 불러오기 때문에, 이 방식으로 라이트/다크가
// 정확히 반영된다(실행 중 전환은 웹은 새로고침, 앱은 재시작 시 적용된다).
export const colors: ColorTokens = { ...lightColors };

let darkModeActive = false;

export function applyThemePreference(preference: ThemePreference): void {
  const systemDark = Appearance.getColorScheme() === 'dark';
  darkModeActive = preference === 'system' ? systemDark : preference === 'dark';
  Object.assign(colors, darkModeActive ? darkColors : lightColors);
}

export function getIsDarkMode(): boolean {
  return darkModeActive;
}

// 저장된 설정을 아직 읽지 못한 상태(최초 모듈 로드)에서는 기기 설정을 따른다.
applyThemePreference('system');

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
