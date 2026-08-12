import AsyncStorage from '@react-native-async-storage/async-storage';

// 온보딩은 앱을 처음 설치한 사용자에게 한 번만 보여준다.
// 로그아웃 후 다시 로그인할 때마다 3페이지를 반복해서 보게 되면 불편하다.
const ONBOARDING_KEY = 'saegim:onboardingDone';

export async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // 저장 실패는 치명적이지 않다. 다음 실행에 온보딩을 한 번 더 보게 될 뿐이다.
  }
}
