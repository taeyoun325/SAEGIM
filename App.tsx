import { Suspense, lazy, useEffect, useState } from 'react';
import { useFonts, Jua_400Regular } from '@expo-google-fonts/jua';
import { View, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { colors } from './src/constants/theme';
import { useIsWideWeb } from './src/hooks/useResponsive';

const AppShell = lazy(() => import('./src/AppShell'));

// 폰트가 아무리 느려도 이 시간이 지나면 앱을 띄운다.
// 폰트 하나 때문에 앱 전체가 빈 화면에 갇히는 것을 막는다(시스템 폰트로 대체됨).
const FONT_TIMEOUT_MS = 4000;

// 웹에서는 폰트를 아예 기다리지 않는다.
// Jua는 2MB라, 처음 방문한 사람은 그동안 빈 화면만 보게 된다.
// 웹의 fontFamily는 CSS라서 폰트가 없으면 시스템 한글 폰트로 자연스럽게 대체되고,
// 폰트가 도착하면 그때 바뀐다 — 글자가 깨지거나 사라지지 않는다.
// 네이티브는 폰트가 앱에 포함돼 바로 로드되므로 기존처럼 기다린다.
const WAIT_FOR_FONTS = Platform.OS !== 'web';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Jua_400Regular });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  const isWideWeb = useIsWideWeb();

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // 좁은 화면(모바일 앱, 모바일 웹)에서는 항상 휴대폰 세로 비율로 고정한다.
  // 데스크톱처럼 넓은 웹 창에서는 전체 폭을 그대로 써서 데스크톱 레이아웃(사이드바 등)이 자리잡게 한다.
  const useNarrowFrame = Platform.OS === 'web' && !isWideWeb;

  // 폰트 로딩 실패나 지연은 치명적이지 않다. 앱은 반드시 뜬다.
  const fontSettled = fontsLoaded || !!fontError || fontTimedOut;
  const ready = !WAIT_FOR_FONTS || fontSettled;

  const frameStyle = [useNarrowFrame ? styles.phoneFrame : styles.fill, { backgroundColor: colors.background }];

  if (!ready) {
    return (
      <View style={useNarrowFrame ? styles.webBackdrop : styles.fill}>
        <View style={[...frameStyle, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={useNarrowFrame ? styles.webBackdrop : styles.fill}>
      <View style={frameStyle}>
        <Suspense
          fallback={
            <View style={[styles.fill, styles.center]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          }
        >
          <AppShell />
        </Suspense>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  webBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000022' },
  phoneFrame: {
    width: '100%',
    maxWidth: 430,
    height: '100vh' as unknown as number,
    maxHeight: 932,
    overflow: 'hidden',
  },
});
