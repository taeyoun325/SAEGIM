import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FontScalePreference, FONT_SCALE_VALUES } from '../constants/theme';
import { loadFontScalePreference, saveFontScalePreference } from '../services/fontScaleService';

interface FontScaleContextValue {
  preference: FontScalePreference;
  scale: number;
  setPreference: (next: FontScalePreference) => void;
}

const FontScaleContext = createContext<FontScaleContextValue>({
  preference: 'medium',
  scale: 1,
  setPreference: () => {},
});

// 색 테마와 달리 글자 크기는 StyleSheet에 구워지지 않고 Text 컴포넌트가 매 렌더마다
// 곱해서 적용하므로(components/Text.tsx), 새로고침 없이 고르는 즉시 반영된다.
export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<FontScalePreference>('medium');

  useEffect(() => {
    loadFontScalePreference().then(setPreferenceState);
  }, []);

  function setPreference(next: FontScalePreference) {
    setPreferenceState(next);
    saveFontScalePreference(next).catch(() => {});
  }

  return (
    <FontScaleContext.Provider value={{ preference, scale: FONT_SCALE_VALUES[preference], setPreference }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale(): FontScaleContextValue {
  return useContext(FontScaleContext);
}
