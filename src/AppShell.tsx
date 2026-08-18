import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { ShareProvider } from './context/ShareContext';
import { FontScaleProvider } from './context/FontScaleContext';
import RootNavigator from './navigation/RootNavigator';
import OfflineBanner from './components/OfflineBanner';
import InstallPrompt from './components/InstallPrompt';

// 색 토큰을 쓰는 모든 화면/컴포넌트가 이 파일을 통해 들어온다.
// App.tsx가 저장된 테마 설정을 적용한 뒤에 이 모듈을 동적으로 불러오기 때문에,
// 여기서부터 로드되는 StyleSheet들은 선택된 팔레트를 정확히 반영한다.
export default function AppShell() {
  return (
    <FontScaleProvider>
      <DialogProvider>
        <ShareProvider>
          <AuthProvider>
            <OfflineBanner />
            <InstallPrompt />
            <RootNavigator />
            <StatusBar style="auto" />
          </AuthProvider>
        </ShareProvider>
      </DialogProvider>
    </FontScaleProvider>
  );
}
