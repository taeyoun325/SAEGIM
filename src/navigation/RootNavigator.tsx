import { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { colors, getIsDarkMode } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { isAppLockEnabled } from '../services/appLockService';
import AppLockScreen from '../components/AppLockScreen';
import AuthNavigator from './AuthNavigator';
import MainTabs from './MainTabs';
import PostDetailScreen from '../screens/PostDetailScreen';
import OtherProfileScreen from '../screens/OtherProfileScreen';
import ReportScreen from '../screens/ReportScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import MyReportsScreen from '../screens/MyReportsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import CommunityGuidelinesScreen from '../screens/CommunityGuidelinesScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyWritingsScreen from '../screens/MyWritingsScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SplashScreen from '../screens/SplashScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import PracticeWritingScreen from '../screens/PracticeWritingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// 시작화면이 깜빡이고 사라지지 않도록 최소 노출 시간을 둔다.
const MIN_SPLASH_MS = 1600;

// 스택 헤더/화면 배경은 React Navigation이 자기 테마로 칠하므로,
// 앱 색 토큰을 넘겨줘야 다크모드에서 헤더만 하얗게 남지 않는다.
const base = getIsDarkMode() ? DarkTheme : DefaultTheme;
const navigationTheme = {
  ...base,
  colors: {
    ...base.colors,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.danger,
  },
};

// 명시적 linking 설정 없이는 웹에서 새로고침(콜드 로드)으로 들어온 중첩 경로
// (예: /MainTabs/Feed)가 기본 탭(Today)으로 돌아가버린다 — React Navigation의
// 자동 경로 추론이 탭 내비게이터처럼 중첩된 구조까지는 안정적으로 못 맞추기
// 때문이다. PWA 바로가기(manifest.json shortcuts)가 정확한 화면으로 열리려면
// 이 설정이 꼭 필요하고, 링크 공유·북마크 전반에도 함께 적용된다.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Today: 'MainTabs/Today',
          Feed: 'MainTabs/Feed',
          Calendar: 'MainTabs/Calendar',
          Profile: 'MainTabs/Profile',
        },
      },
      PostDetail: 'PostDetail',
      OtherProfile: 'OtherProfile',
      Report: 'Report',
      BlockedUsers: 'BlockedUsers',
      MyReports: 'MyReports',
      PrivacyPolicy: 'PrivacyPolicy',
      CommunityGuidelines: 'CommunityGuidelines',
      AdminReports: 'AdminReports',
      AdminDashboard: 'AdminDashboard',
      Settings: 'Settings',
      MyWritings: 'MyWritings',
      SavedPosts: 'SavedPosts',
      PracticeWriting: 'PracticeWriting',
      Notifications: 'Notifications',
    },
  },
};

export default function RootNavigator() {
  const { user, profile, loading, signOut } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // 콜드 스타트마다(로그인 상태가 될 때마다) 앱 잠금이 켜져 있는지 딱 한 번만 확인한다.
  // profile은 글쓰기/좋아요 등 온갖 동작 후 refreshProfile()로 계속 새 참조를 받으므로,
  // lockChecked 가드 없이 profile을 의존성에 넣으면 한 번 풀었던 잠금이 프로필이
  // 갱신될 때마다 다시 걸려버린다. 로그아웃하면 다음 로그인 때 다시 확인해야 하므로
  // lockChecked도 함께 초기화한다.
  useEffect(() => {
    if (user && profile && !lockChecked) {
      isAppLockEnabled().then((enabled) => {
        setAppLocked(enabled);
        setLockChecked(true);
      });
    } else if (!user && lockChecked) {
      setLockChecked(false);
      setAppLocked(false);
    }
  }, [user, profile, lockChecked]);

  if (loading || !splashDone) {
    return <SplashScreen />;
  }

  // 코드 로그인은 인증(user)과 프로필 생성(닉네임 입력) 사이에 사람이 개입하는
  // 구간이 있다 — user만 보고 바로 MainTabs로 넘어가면 프로필 없는 상태로
  // 진입해버리므로, profile까지 생겼을 때만 실제 앱 화면을 보여준다.
  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      {!user ? (
        <AuthNavigator />
      ) : !profile ? (
        <ProfileSetupScreen />
      ) : !lockChecked ? (
        <SplashScreen />
      ) : appLocked ? (
        <AppLockScreen onUnlock={() => setAppLocked(false)} onLogout={signOut} />
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '게시물' }} />
          <Stack.Screen name="OtherProfile" component={OtherProfileScreen} options={{ title: '프로필' }} />
          <Stack.Screen name="Report" component={ReportScreen} options={{ title: '신고하기' }} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: '차단 목록' }} />
          <Stack.Screen name="MyReports" component={MyReportsScreen} options={{ title: '내 신고 내역' }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: '개인정보처리방침' }} />
          <Stack.Screen name="CommunityGuidelines" component={CommunityGuidelinesScreen} options={{ title: '커뮤니티 가이드라인' }} />
          <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: '신고 관리' }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: '통계 대시보드' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
          <Stack.Screen name="MyWritings" component={MyWritingsScreen} options={{ title: '내 새김 관리' }} />
          <Stack.Screen name="SavedPosts" component={SavedPostsScreen} options={{ title: '저장한 글' }} />
          <Stack.Screen name="PracticeWriting" component={PracticeWritingScreen} options={{ title: '지난 글감 다시 써보기' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: '알림' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
