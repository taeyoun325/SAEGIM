import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'saegim:appLockPin';

// 사설 저널링 앱에서 흔히 쓰이는 "훔쳐보기 방지" PIN이다 — 로그인 세션은 그대로
// 둔 채, 앱을 다시 열 때마다 PIN을 한 번 더 물어봐서 옆에서 잠깐 화면을 보거나
// 기기를 건네받은 사람이 비공개 글을 바로 보지 못하게 한다.
// 기기 로컬 저장소에만 있는 검사라 서버 통신이 필요 없다(Cloud Functions 불필요).
// PIN은 해시 없이 그대로 저장한다 — 위협 모델이 "어깨너머로 훔쳐보기"라 해시화해도
// 실질적 방어력 차이가 없고, 대신 PIN을 잊으면 영영 못 들어가는 상황을 막기 위해
// 로그아웃 후 재로그인으로 언제든 우회(=사실상 초기화)할 수 있게 설계했다.
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function isAppLockEnabled(): Promise<boolean> {
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return !!pin;
}

export async function setAppLockPin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, pin);
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(PIN_KEY);
  return stored !== null && stored === pin;
}

export async function disableAppLock(): Promise<void> {
  await AsyncStorage.removeItem(PIN_KEY);
}
