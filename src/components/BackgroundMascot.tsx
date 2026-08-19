import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { colors, getIsDarkMode } from '../constants/theme';

interface Props {
  source: ImageSourcePropType;
}

const SIZE = 150;
const isDark = getIsDarkMode();

// 그림 안쪽에 반투명한 부분(볼터치·하이라이트처럼 부드럽게 녹아드는 채색)이 있는데,
// 흰/크림 배경에서는 배경과 자연스럽게 섞여 보이던 게 어두운 배경 위에서는 그 자리가
// 뚫린 것처럼 보였다. scripts/close-mascot-holes.js로 에셋 자체의 알파를 채워 대부분
// 해결했지만, 눈매처럼 원래도 짙은 남색 계열 선화는 알파가 아니라 색 자체가 어두워서
// (완전 불투명) 검은 배경과 명암 대비가 낮아 여전히 흐릿하게 보인다.
// 이건 그림을 더 손봐서 고칠 문제가 아니라 배경 쪽에서 대비를 만들어줘야 하는
// 문제라, 다크 모드에서는 은은한 원형 글로우를 깔아 그 위에서 선화가 읽히게 한다.
const OPACITY = isDark ? 1 : 0.2;

export default function BackgroundMascot({ source }: Props) {
  return (
    <View style={styles.wrapper}>
      {isDark && <View style={styles.glow} />}
      <Image source={source} style={[styles.image, { opacity: OPACITY }]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 4 },
  glow: {
    position: 'absolute',
    width: SIZE * 0.85,
    height: SIZE * 0.85,
    borderRadius: SIZE,
    backgroundColor: colors.accent,
    opacity: 0.16,
  },
  image: {
    width: SIZE,
    height: SIZE,
  },
});
