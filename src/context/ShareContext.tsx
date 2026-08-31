import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import ShareCard from '../components/ShareCard';
import ShareThemeModal from '../components/ShareThemeModal';
import { ShareTheme, DEFAULT_SHARE_THEME } from '../constants/shareThemes';
import { shareAsImage } from '../services/shareService';
import { loadShareFont } from '../services/shareFontService';
import { colors, radius, spacing } from '../constants/theme';
import Text from '../components/Text';
import { logEvent } from '../services/statsService';
import { useDialog } from './DialogContext';

export interface ShareTarget {
  lines: string[];
  createdAt: number;
  filename: string;
}

interface ShareContextValue {
  // 테마 선택 모달을 띄우고, 고른 테마로 카드를 캡처해 공유까지 진행한다.
  share: (target: ShareTarget) => void;
}

const ShareContext = createContext<ShareContextValue | undefined>(undefined);

// 공유 카드는 화면 밖에 렌더링해 캡처하는 방식이라 화면마다 따로 두면
// 같은 코드가 반복되고 목록 화면에서는 카드 개수만큼 숨은 카드가 생긴다.
// 그래서 DialogContext와 같은 방식으로 앱 전체에 하나만 두고 공유를 요청받는다.
export function ShareProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useDialog();
  const [target, setTarget] = useState<ShareTarget | null>(null);
  const [theme, setTheme] = useState<ShareTheme>(DEFAULT_SHARE_THEME);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  // 테마가 실제로 반영된 뒤에 캡처해야 하므로 렌더 한 번을 기다린다.
  const [pendingCapture, setPendingCapture] = useState(false);
  // 테마마다 글꼴이 다르고, 한글 글꼴 한 벌은 3MB 안팎이라 고른 순간 받아온다.
  // 다 받기 전에 캡처하면 기본 글꼴로 찍힌 카드가 나가므로 준비될 때까지 기다린다.
  const [fontFamily, setFontFamily] = useState<string | undefined>(undefined);
  const [preparing, setPreparing] = useState(false);
  const cardRef = useRef<View>(null);

  const share = useCallback((next: ShareTarget) => {
    logEvent('share_open').catch(() => {});
    setTarget(next);
    setThemeModalVisible(true);
  }, []);

  async function handleThemeSelect(selected: ShareTheme) {
    setTheme(selected);
    setThemeModalVisible(false);
    setPreparing(true);
    // 실패해도 기본 글꼴을 돌려주므로 공유는 언제나 진행된다.
    const family = await loadShareFont(selected.font);
    setFontFamily(family);
    setPreparing(false);
    setPendingCapture(true);
  }

  useEffect(() => {
    if (!pendingCapture || !target) return;
    setPendingCapture(false);
    shareAsImage(cardRef, target.filename)
      .then(() => logEvent('share_done').catch(() => {}))
      .catch(async () => {
        await notify('오류', '공유 이미지를 만들지 못했어요.');
      });
  }, [pendingCapture, target, notify]);

  return (
    <ShareContext.Provider value={{ share }}>
      {children}
      {target && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard
            ref={cardRef}
            lines={target.lines}
            createdAt={target.createdAt}
            theme={theme}
            fontFamily={fontFamily}
          />
        </View>
      )}
      <ShareThemeModal
        visible={themeModalVisible}
        onSelect={handleThemeSelect}
        onClose={() => setThemeModalVisible(false)}
      />
      {/* 글꼴을 처음 받는 동안 화면이 멈춘 것처럼 보이지 않게 알린다(두 번째부터는 즉시 끝난다). */}
      {preparing && (
        <View style={styles.preparingBackdrop} pointerEvents="none">
          <View style={styles.preparingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.preparingText}>카드를 꾸미는 중…</Text>
          </View>
        </View>
      )}
    </ShareContext.Provider>
  );
}

export function useShare(): ShareContextValue {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('useShare must be used within ShareProvider');
  return ctx;
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, left: -9999 },
  preparingBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preparingBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  preparingText: { color: colors.textSoft, fontSize: 13 },
});
