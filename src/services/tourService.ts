import AsyncStorage from '@react-native-async-storage/async-storage';

// 사용법 안내 투어는 계정마다 한 번만 보여준다(온보딩과 달리 로그인 이후 화면이라
// uid를 알 수 있으므로, 한 기기에서 계정을 바꿔가며 써도 계정별로 각각 한 번씩 보인다).
function key(uid: string): string {
  return `saegim:tourDone:${uid}`;
}

export async function isTourDone(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(uid))) === '1';
  } catch {
    return true; // 확인이 안 되면 안 보여주는 쪽이 안전하다(매번 뜨는 것보다 낫다).
  }
}

export async function markTourDone(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(uid), '1');
  } catch {
    // 저장 실패는 치명적이지 않다. 다음 실행에 한 번 더 보일 뿐이다.
  }
}
