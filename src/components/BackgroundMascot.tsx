import { Image, StyleSheet, ImageSourcePropType } from 'react-native';

interface Props {
  source: ImageSourcePropType;
}

const SIZE = 150;

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
    opacity: 0.2,
  },
});
