import * as Font from 'expo-font';
import { Platform } from 'react-native';
// ⚠️ 패키지 루트에서 가져오면(예: '@expo-google-fonts/gaegu') index가 모든 굵기를
// 재수출해 쓰지도 않는 Light/Bold/ExtraBold까지 전부 번들에 들어간다(실측 18MB).
// 반드시 굵기별 하위 경로에서 필요한 한 벌만 가져온다.
import { NanumMyeongjo_400Regular } from '@expo-google-fonts/nanum-myeongjo/400Regular';
import { Gaegu_400Regular } from '@expo-google-fonts/gaegu/400Regular';
import { fonts } from '../constants/theme';

// 공유 카드 전용 글꼴.
//
// 카드를 더 꾸미는 가장 큰 지렛대는 색이 아니라 글꼴이다. 같은 문장이라도 명조로 쓰면
// 문학적으로, 손글씨로 쓰면 편지처럼 읽힌다. 그래서 테마마다 글꼴을 따로 준다.
//
// 출처는 구글 폰트(Open Font License)다 — 상업적 사용과 재배포가 허용돼 있고,
// 라이선스 전문은 node_modules/@expo-google-fonts/*/LICENSE_FONT에 함께 들어온다.
//
// ⚠️ 한글 글꼴은 한 벌이 3MB 안팎이라 앱 시작에서 함께 불러오면 안 된다. 이미 Jua
//    2MB 때문에 첫 화면이 늦는데(App.tsx 주석 참고) 여기에 6MB를 더하면 훨씬 나빠진다.
//    그래서 사용자가 공유 테마를 고른 그 순간에만 해당 글꼴 한 벌을 불러온다.
export type ShareFontKey = 'jua' | 'myeongjo' | 'handwriting';

const FONT_ASSETS: Record<Exclude<ShareFontKey, 'jua'>, { family: string; asset: number }> = {
  myeongjo: { family: 'NanumMyeongjo_400Regular', asset: NanumMyeongjo_400Regular },
  handwriting: { family: 'Gaegu_400Regular', asset: Gaegu_400Regular },
};

// 한 번 불러온 글꼴은 다시 불러오지 않는다. 실패한 글꼴도 기억해 두고 매번 재시도하지
// 않는다 — 공유할 때마다 3MB를 다시 받으려다 실패하면 기다림만 길어진다.
const loaded = new Set<string>();
const failed = new Set<string>();

// 테마가 요구하는 글꼴을 실제로 쓸 수 있는 상태로 만들고, 카드에 넘길 fontFamily를 돌려준다.
// 불러오지 못하면 기본 글꼴(Jua)을 돌려주므로 공유 자체는 어떤 경우에도 진행된다.
export async function loadShareFont(key: ShareFontKey): Promise<string> {
  if (key === 'jua') return fonts.regular;

  const { family, asset } = FONT_ASSETS[key];
  if (loaded.has(family)) return family;
  if (failed.has(family)) return fonts.regular;

  try {
    await Font.loadAsync({ [family]: asset });
    // 웹에서는 loadAsync가 @font-face를 등록만 하고 끝나, 바로 캡처하면 글꼴이 아직
    // 적용되지 않은 카드가 찍힌다. 브라우저가 글꼴을 실제로 쓸 준비를 마칠 때까지 기다린다.
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
    loaded.add(family);
    return family;
  } catch {
    failed.add(family);
    return fonts.regular;
  }
}
