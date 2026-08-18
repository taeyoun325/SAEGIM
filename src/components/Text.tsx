import { Text as RNText, TextProps, StyleSheet, TextStyle } from 'react-native';
import { fonts } from '../constants/theme';
import { useFontScale } from '../context/FontScaleContext';

// 앱 전체에서 동글동글한 기본 폰트를 쓰기 위한 Text 래퍼.
// React 19에서 함수형 컴포넌트의 defaultProps가 무시되어 전역 오버라이드가 불가능하므로
// 화면 코드에서는 'react-native'의 Text 대신 이 컴포넌트를 사용한다.
// 글자 크기 설정(FontScaleContext)도 여기서 함께 적용한다 — 화면마다 고친 게 아니라
// 이 한 곳에서 fontSize가 지정된 스타일에만 배율을 곱한다(글자 크기가 없는 스타일은 그대로 둔다).
export default function Text({ style, ...props }: TextProps) {
  const { scale } = useFontScale();
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const scaledStyle = flat?.fontSize ? { fontSize: flat.fontSize * scale } : undefined;
  return <RNText {...props} style={[{ fontFamily: fonts.regular }, style, scaledStyle]} />;
}
