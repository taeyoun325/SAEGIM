import { RefObject } from 'react';
import { View } from 'react-native';
import { toPng } from 'html-to-image';

// 웹: DOM으로 렌더된 뷰를 캡처해 Web Share API(지원 시) 또는 다운로드로 전달한다.
export async function shareAsImage(ref: RefObject<View | null>, filename: string): Promise<void> {
  const node = ref.current as unknown as HTMLElement | null;
  if (!node) return;

  const dataUrl = await toPng(node, { pixelRatio: 2 });

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (nav.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${filename}.png`, { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '새김' });
        return;
      }
    } catch {
      // 공유 실패/취소 시 다운로드로 대체한다.
    }
  }

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}
