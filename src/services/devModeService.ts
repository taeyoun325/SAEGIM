import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_MODE_KEY = 'saegim:devModeEnabled';

// 실험 기능을 켜고 끄는 스위치. 이 값 자체는 기기 로컬에만 저장되지만,
// 이 스위치가 보이는 설정 화면 섹션 자체를 관리자 계정에서만 렌더링하므로
// 사실상 "내 계정에서만" 실험 기능을 켤 수 있다(SettingsScreen의 admin 가드 참고).
export async function isDevModeEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(DEV_MODE_KEY);
  return v === 'true';
}

export async function setDevModeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEV_MODE_KEY, enabled ? 'true' : 'false');
}
