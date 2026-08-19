import { Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { getIsDarkMode } from '../constants/theme';

interface Props {
  source: ImageSourcePropType;
}

const SIZE = 150;

// 어두운 털 색이 많은 그림이라 라이트 모드와 같은 0.2 투명도를 검은 배경 위에 그대로
// 쓰면 어두운 픽셀들이 배경에 묻혀 사라지면서 군데군데 비어 보인다(다 그려지지 않은
// 것처럼 보이는 원인). 다크 모드에서는 불투명도를 높여 형태가 온전히 보이게 한다.
const OPACITY = getIsDarkMode() ? 0.45 : 0.2;

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
