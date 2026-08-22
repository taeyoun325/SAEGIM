import { useEffect, useState } from 'react';
import Text from '../components/Text';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import TodayScreen from '../screens/TodayScreen';
import FeedScreen from '../screens/FeedScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CharacterScreen from '../screens/CharacterScreen';
import { colors, fonts, spacing } from '../constants/theme';
import { useIsWideWeb } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { isTourDone, markTourDone } from '../services/tourService';
import AppTourOverlay from '../components/AppTourOverlay';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Profile: '👤',
  Character: '🧪',
  Today: '🏠',
  Feed: '📰',
  Calendar: '📅',
};

const LABELS: Record<keyof MainTabParamList, string> = {
  Profile: '프로필',
  Character: '펫',
  Today: '오늘',
  Feed: '피드',
  Calendar: '캘린더',
};

export default function MainTabs() {
  const isWideWeb = useIsWideWeb();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [showTour, setShowTour] = useState(false);

  // 회원가입/로그인 직후 처음 메인 화면에 들어왔을 때 딱 한 번만 사용법을 안내한다.
  // 계정별로 기록하므로 한 기기를 여러 계정이 같이 써도 계정마다 한 번씩 보인다.
  const uid = user?.uid;

  // Firebase의 onAuthStateChanged는 초기 복원 과정에서 같은 사용자에 대해 매번 새
  // user 객체 참조로 여러 번 불릴 수 있다. user 객체 자체를 의존성으로 쓰면 그때마다
  // 이 effect가 다시 돌아 "안내 마치기"로 방금 닫은 투어를 다시 띄우는 경합이
  // 생기므로, 실제로 바뀔 때만 의미가 있는 uid 문자열을 의존성으로 쓴다.
  useEffect(() => {
    if (!uid) return;
    isTourDone(uid).then((done) => {
      if (!done) setShowTour(true);
    });
  }, [uid]);

  function finishTour() {
    setShowTour(false);
    if (uid) markTourDone(uid);
  }

  return (
    <>
      <Tab.Navigator
        initialRouteName="Today"
        screenOptions={({ route }) => ({
        headerShown: false,
        // 데스크톱 웹에서는 좌측 사이드바, 모바일에서는 하단 탭바.
        tabBarPosition: isWideWeb ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarIcon: () => <Text style={{ fontSize: isWideWeb ? 20 : 16 }}>{ICONS[route.name as keyof MainTabParamList]}</Text>,
        tabBarLabel: ({ color }) => (
          <Text style={{ fontFamily: fonts.regular, fontSize: isWideWeb ? 14 : 10, color }} numberOfLines={1}>
            {LABELS[route.name as keyof MainTabParamList]}
          </Text>
        ),
        ...(isWideWeb
          ? {
              tabBarStyle: {
                width: 220,
                borderRightWidth: 1,
                borderRightColor: colors.border,
                backgroundColor: colors.card,
                paddingTop: spacing.lg,
              },
              tabBarItemStyle: { height: 52, borderRadius: 999, marginHorizontal: spacing.md, marginVertical: 3 },
              tabBarActiveBackgroundColor: colors.accentSoft,
              tabBarLabelPosition: 'beside-icon' as const,
              sceneStyle: { backgroundColor: colors.background, maxWidth: 680, width: '100%', alignSelf: 'center' },
            }
          : {
              tabBarItemStyle: { paddingHorizontal: 0 },
              // 제스처 내비게이션 바(iOS 홈 인디케이터, 안드로이드 제스처 영역)에
              // 탭바가 가리지 않도록 하단 안전영역만큼 높이/패딩을 늘리고, 그 여백도
              // 탭바와 같은 배경색으로 채워 색이 끊겨 보이지 않게 한다.
              tabBarStyle: {
                height: 60 + insets.bottom,
                paddingBottom: 6 + insets.bottom,
                paddingTop: 4,
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            }),
      })}
    >
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Character" component={CharacterScreen} />
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
    </Tab.Navigator>
      {showTour && <AppTourOverlay onFinish={finishTour} />}
    </>
  );
}
