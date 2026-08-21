import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { ShareProvider } from './context/ShareContext';
import { FontScaleProvider } from './context/FontScaleContext';
import RootNavigator from './navigation/RootNavigator';
import OfflineBanner from './components/OfflineBanner';
import InstallPrompt from './components/InstallPrompt';

export default function AppShell() {
  return (
    <FontScaleProvider>
      <DialogProvider>
        <ShareProvider>
          <AuthProvider>
            <OfflineBanner />
            <InstallPrompt />
            <RootNavigator />
            <StatusBar style="dark" />
          </AuthProvider>
        </ShareProvider>
      </DialogProvider>
    </FontScaleProvider>
  );
}
