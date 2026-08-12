import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts, Jua_400Regular } from '@expo-google-fonts/jua';
import { View, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { DialogProvider } from './src/context/DialogContext';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import { colors } from './src/constants/theme';
import { useIsWideWeb } from './src/hooks/useResponsive';

// 폰트가 아무리 느려도 이 시간이 지나면 앱을 띄운다.
// 폰트 하나 때문에 앱 전체가 빈 화면에 갇히는 것을 막는다(시스템 폰트로 대체됨).
const FONT_TIMEOUT_MS = 4000;

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
  const ready = fontsLoaded || !!fontError || fontTimedOut;

  if (!ready) {
    return (
      <View style={useNarrowFrame ? styles.webBackdrop : styles.fill}>
        <View style={[useNarrowFrame ? styles.phoneFrame : styles.fill, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={useNarrowFrame ? styles.webBackdrop : styles.fill}>
      <View style={useNarrowFrame ? styles.phoneFrame : styles.fill}>
        <DialogProvider>
          <AuthProvider>
            <OfflineBanner />
            <RootNavigator />
            <StatusBar style="auto" />
          </AuthProvider>
        </DialogProvider>
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
    backgroundColor: colors.background,
  },
});
