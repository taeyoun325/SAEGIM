import { RefObject } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// 네이티브(Android/iOS): 뷰를 이미지로 캡처해 OS 공유시트로 전달한다.
export async function shareAsImage(ref: RefObject<View | null>, filename: string): Promise<void> {
  if (!ref.current) return;
  const uri = await captureRef(ref, { format: 'png', quality: 1 });
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: filename });
  }
}
