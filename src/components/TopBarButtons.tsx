import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationBell from './NotificationBell';
import SettingsGearButton from './SettingsGearButton';
import { spacing } from '../constants/theme';

// 4개 탭 화면 우상단에 공통으로 얹는 종(알림)+톱니바퀴(설정) 버튼 묶음.
export default function TopBarButtons() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { top: insets.top + spacing.sm }]}>
      <NotificationBell />
      <SettingsGearButton inline />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
