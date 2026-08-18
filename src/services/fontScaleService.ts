import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONT_SCALE_STORAGE_KEY, FontScalePreference } from '../constants/theme';

function isValid(value: string | null): value is FontScalePreference {
  return value === 'small' || value === 'medium' || value === 'large';
}

export async function loadFontScalePreference(): Promise<FontScalePreference> {
  try {
    const stored = await AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY);
    return isValid(stored) ? stored : 'medium';
  } catch {
    return 'medium';
  }
}

export async function saveFontScalePreference(preference: FontScalePreference): Promise<void> {
  await AsyncStorage.setItem(FONT_SCALE_STORAGE_KEY, preference);
}
