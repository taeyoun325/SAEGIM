import { Platform, useWindowDimensions } from 'react-native';

export const WIDE_WEB_BREAKPOINT = 768;

// 웹에서 데스크톱처럼 넓은 창인지 여부. 네이티브 앱(Android/iOS)에서는 항상 false.
export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_WEB_BREAKPOINT;
}
