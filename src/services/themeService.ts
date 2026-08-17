import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_STORAGE_KEY, ThemePreference } from '../constants/theme';

function isValid(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return isValid(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
}

// 이미 만들어진 StyleSheet에는 바뀐 색이 반영되지 않으므로 화면을 처음부터 다시 그려야 한다.
// 웹은 새로고침으로 즉시 적용할 수 있고, 앱은 다음 실행 때 적용된다.
export const canReloadForTheme = Platform.OS === 'web';

export function reloadForTheme(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}
