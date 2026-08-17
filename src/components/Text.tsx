import { Text as RNText, TextProps } from 'react-native';
import { fonts } from '../constants/theme';

// 앱 전체에서 동글동글한 기본 폰트를 쓰기 위한 Text 래퍼.
// React 19에서 함수형 컴포넌트의 defaultProps가 무시되어 전역 오버라이드가 불가능하므로
// 화면 코드에서는 'react-native'의 Text 대신 이 컴포넌트를 사용한다.
export default function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts.regular }, style]} />;
}
