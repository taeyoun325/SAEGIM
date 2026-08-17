import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainTabs from './MainTabs';
import PostDetailScreen from '../screens/PostDetailScreen';
import OtherProfileScreen from '../screens/OtherProfileScreen';
import ReportScreen from '../screens/ReportScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyWritingsScreen from '../screens/MyWritingsScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// 시작화면이 깜빡이고 사라지지 않도록 최소 노출 시간을 둔다.
const MIN_SPLASH_MS = 1600;

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !splashDone) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '게시물' }} />
          <Stack.Screen name="OtherProfile" component={OtherProfileScreen} options={{ title: '프로필' }} />
          <Stack.Screen name="Report" component={ReportScreen} options={{ title: '신고하기' }} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: '차단 목록' }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: '개인정보처리방침' }} />
          <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: '신고 관리' }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: '통계 대시보드' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
          <Stack.Screen name="MyWritings" component={MyWritingsScreen} options={{ title: '내 새김 관리' }} />
          <Stack.Screen name="SavedPosts" component={SavedPostsScreen} options={{ title: '저장한 글' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
