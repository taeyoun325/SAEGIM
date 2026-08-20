import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Text from './Text';
import { colors, spacing, radius } from '../constants/theme';

const DISMISSED_KEY = 'saegim:installPromptDismissedAt';
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome/i.test(ua);
  return isIos && isSafari;
}

// 홈 화면에 설치하면 참여도가 크게 오른다는 사례(Pinterest, Trivago 등)를 조사해
// 반영했다. 안드로이드/크롬은 beforeinstallprompt로 직접 설치 버튼을 띄울 수 있지만,
// iOS 사파리는 이 이벤트 자체가 없어 "공유 → 홈 화면에 추가" 경로를 안내하는
// 수밖에 없다 — 두 경우를 구분해서 보여준다.
export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // 판단 전까지는 숨겨둔다(깜빡임 방지)

  useEffect(() => {
    if (isStandalone()) return;

    AsyncStorage.getItem(DISMISSED_KEY).then((raw) => {
      const dismissedAt = raw ? Number(raw) : 0;
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
      setDismissed(false);
      if (isIosSafari()) setShowIosHint(true);
    });

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleDismiss() {
    setDismissed(true);
    await AsyncStorage.setItem(DISMISSED_KEY, String(Date.now()));
  }

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
    await handleDismiss();
  }

  if (dismissed || (!deferredEvent && !showIosHint)) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {deferredEvent
          ? '📲 홈 화면에 새김을 추가하면 앱처럼 빠르게 열 수 있어요.'
          : '📲 공유 버튼을 누르고 "홈 화면에 추가"를 선택하면 앱처럼 쓸 수 있어요.'}
      </Text>
      <View style={styles.actions}>
        {deferredEvent && (
          <TouchableOpacity style={styles.installButton} onPress={handleInstall} accessibilityRole="button" accessibilityLabel="홈 화면에 설치">
            <Text style={styles.installButtonText}>설치</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleDismiss} accessibilityRole="button" accessibilityLabel="설치 안내 닫기">
          <Text style={styles.dismissText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  text: { flex: 1, color: colors.primary, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  installButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  installButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dismissText: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
});
