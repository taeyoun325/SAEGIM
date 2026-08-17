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

// 기기의 다크모드 설정을 앱 실행 시점에 한 번 읽는다.
// (29개 화면이 StyleSheet.create에 색을 구워넣는 구조라 실행 중 전환은 하지 않는다.
//  테마를 바꾸면 앱 재시작 / 웹은 새로고침이 필요하다.)
export const isDarkMode = Appearance.getColorScheme() === 'dark';

export const colors: ColorTokens = isDarkMode ? darkColors : lightColors;

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
