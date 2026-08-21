import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationBell from './NotificationBell';
import SettingsGearButton from './SettingsGearButton';
import { spacing } from '../constants/theme';

// 5개 탭 화면 우상단에 공통으로 얹는 종(알림)+톱니바퀴(설정) 버튼 묶음.
// 예전엔 absolute로 화면 콘텐츠 위에 띄웠는데, 그러면 화면마다 콘텐츠가
// 이 버튼과 안 겹치게 얼마나 내려야 하는지를 각자 손으로 맞춰야 했고
// 기기마다 상태바 높이가 달라 어긋나기 쉬웠다. 대신 이 컴포넌트가 실제
// 레이아웃 공간을 차지하게 해서, 뒤따르는 콘텐츠가 항상 자동으로 그 아래에서
// 시작하도록 한다 — 절대 겹칠 수 없는 구조.
export default function TopBarButtons() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm }]}>
      <NotificationBell />
      <SettingsGearButton inline />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
