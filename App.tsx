import { StatusBar } from 'expo-status-bar';
import { useFonts, Jua_400Regular } from '@expo-google-fonts/jua';
import { View, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { DialogProvider } from './src/context/DialogContext';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import { colors } from './src/constants/theme';
import { useIsWideWeb } from './src/hooks/useResponsive';

export default function App() {
  const [fontsLoaded] = useFonts({ Jua_400Regular });
  const isWideWeb = useIsWideWeb();

  // 좁은 화면(모바일 앱, 모바일 웹)에서는 항상 휴대폰 세로 비율로 고정한다.
  // 데스크톱처럼 넓은 웹 창에서는 전체 폭을 그대로 써서 데스크톱 레이아웃(사이드바 등)이 자리잡게 한다.
  const useNarrowFrame = Platform.OS === 'web' && !isWideWeb;

  if (!fontsLoaded) {
    return (
      <View style={useNarrowFrame ? styles.webBackdrop : styles.fill}>
        <View style={useNarrowFrame ? styles.phoneFrame : styles.fill}>
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
