import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignupScreen';
import SplashScreen from '../screens/SplashScreen';
import { isOnboardingDone } from '../services/onboardingService';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingDone().then(setOnboardingDone);
  }, []);

  // 온보딩 이력을 읽기 전에는 잘못된 첫 화면이 잠깐 보이지 않도록 시작화면을 유지한다.
  if (onboardingDone === null) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={onboardingDone ? 'Login' : 'Onboarding'}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
