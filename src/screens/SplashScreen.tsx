import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Text from '../components/Text';
import Mascot from '../components/Mascot';
import { colors, spacing } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

// 앱을 켜면 가장 먼저 보이는 시작화면. 새미가 통통 튀며 등장한 뒤 본 화면으로 넘어간다.
export default function SplashScreen() {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // "동작 줄이기"를 켠 사용자에게는 옅어지며 나타나는 정도만 남기고,
    // 튀어오르는 계속 반복되는 움직임(무한 loop)은 아예 켜지 않는다.
    if (reducedMotion) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      scale.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -10, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [bounce, opacity, scale, reducedMotion]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }, { translateY: bounce }] }}>
        <Mascot size={160} />
      </Animated.View>
      <Animated.View style={{ opacity }}>
        <Text style={styles.appName}>새김</Text>
        <Text style={styles.tagline}>오늘의 생각을 새기다</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 40, fontWeight: '800', color: colors.primary, textAlign: 'center', marginTop: spacing.lg },
  tagline: { fontSize: 15, color: colors.textSoft, textAlign: 'center', marginTop: spacing.xs },
});
