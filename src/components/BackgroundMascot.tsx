import { Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { getIsDarkMode } from '../constants/theme';

interface Props {
  source: ImageSourcePropType;
}

const SIZE = 150;

// 이 그림은 알파 투명도가 아니라 불투명한 색칠(음영)로 털 질감을 표현했다.
// 라이트 모드의 0.2 투명도는 흰 배경 위에서는 괜찮지만, 검은 배경 위에 같은 비율로
// 섞으면 음영 간 명암 대비가 절반 이하로 줄어들어(예: 밝은 털 213 vs 그림자 150이
// 섞이면 110 vs 82로 좁혀짐) 세부 선/음영이 뭉개져 보인다 — 낮은 불투명도 값을
// 조정하는 정도로는 해결되지 않는 문제라, 다크 모드에서는 아예 불투명하게 그려
// 원본 그림 그대로 보이게 한다.
const OPACITY = getIsDarkMode() ? 1 : 0.2;

// 각 화면 콘텐츠 맨 아래 여백에 놓이는 새미 장식.
// 모든 화면에서 동일한 정사각 규격(400x400 투명 배경 에셋)을 같은 크기로 렌더링해
// 화면마다 크기나 여백이 달라 보이지 않게 한다.
export default function BackgroundMascot({ source }: Props) {
  return <Image source={source} style={styles.image} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  image: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    marginTop: 28,
    marginBottom: 4,
    opacity: OPACITY,
  },
});
