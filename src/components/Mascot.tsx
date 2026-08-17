import { Image } from 'react-native';

interface Props {
  size?: number;
}

// 새김의 마스코트 "새미". 소중한 생각을 하나하나 모아 마음속에 새기는 다람쥐.
export default function Mascot({ size = 120 }: Props) {
  return (
    <Image source={require('../assets/mascot.png')} style={{ width: size, height: size }} resizeMode="contain" />
  );
}
