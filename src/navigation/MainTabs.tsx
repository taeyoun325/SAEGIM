import Text from '../components/Text';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import TodayScreen from '../screens/TodayScreen';
import FeedScreen from '../screens/FeedScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CharacterScreen from '../screens/CharacterScreen';
import { colors, fonts, spacing } from '../constants/theme';
import { useIsWideWeb } from '../hooks/useResponsive';

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
  Character: '캐릭터',
  Today: '오늘',
  Feed: '피드',
  Calendar: '캘린더',
};

export default function MainTabs() {
  const isWideWeb = useIsWideWeb();

  return (
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
              // 배경색을 지정하지 않으면 React Navigation 기본값(흰색)이 남아
              // 다크모드에서 하단 탭바만 하얗게 뜬다.
              tabBarStyle: {
                height: 60,
                paddingBottom: 6,
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
  );
}
