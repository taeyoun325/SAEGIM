import { useRef } from 'react';
import { Animated, StyleSheet, TouchableWithoutFeedback, View, Platform } from 'react-native';
import Mascot from './Mascot';
import Text from './Text';
import { colors, radius, spacing } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  onReveal: () => void;
}

// 오늘의 글감을 가리는 캐릭터 스티커. 누르면 옆으로 톡 떨어지듯 떼어지며 글감이 드러난다.
export default function PromptSticker({ onReveal }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  function handlePress() {
    // "동작 줄이기"를 켠 사용자에게는 옆으로 튕겨나가는 큰 움직임 대신
    // 자리 이동 없이 옅어지기만 하도록 한다(2.3.3 Animation from Interactions).
    if (reducedMotion) {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start(() => onReveal());
      return;
    }
    Animated.parallel([
      Animated.timing(translateX, { toValue: 280, duration: 380, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(translateY, { toValue: -50, duration: 380, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(rotate, { toValue: 1, duration: 380, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => onReveal());
  }

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '30deg'] });

  return (
    <Animated.View
      style={[styles.sticker, { transform: [{ translateX }, { translateY }, { rotate: rotateDeg }], opacity }]}
    >
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.stickerInner}>
          <Mascot size={88} />
          <Text style={styles.hint}>톡 눌러서{'\n'}오늘의 글감 보기</Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  stickerInner: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  hint: { marginTop: spacing.sm, color: colors.primary, fontSize: 13, textAlign: 'center', opacity: 0.8 },
});
