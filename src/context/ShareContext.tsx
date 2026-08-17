import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ShareCard from '../components/ShareCard';
import ShareThemeModal from '../components/ShareThemeModal';
import { ShareTheme, DEFAULT_SHARE_THEME } from '../constants/shareThemes';
import { shareAsImage } from '../services/shareService';
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
  const cardRef = useRef<View>(null);

  const share = useCallback((next: ShareTarget) => {
    logEvent('share_open').catch(() => {});
    setTarget(next);
    setThemeModalVisible(true);
  }, []);

  function handleThemeSelect(selected: ShareTheme) {
    setTheme(selected);
    setThemeModalVisible(false);
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
          <ShareCard ref={cardRef} lines={target.lines} createdAt={target.createdAt} theme={theme} />
        </View>
      )}
      <ShareThemeModal
        visible={themeModalVisible}
        onSelect={handleThemeSelect}
        onClose={() => setThemeModalVisible(false)}
      />
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
});
