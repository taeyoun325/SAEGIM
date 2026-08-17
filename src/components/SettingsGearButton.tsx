import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Text from './Text';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { spacing } from '../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  // TopBarButtons처럼 이미 위치가 잡힌 행 안에 넣을 때는 자체 absolute 배치를 끈다.
  inline?: boolean;
}

export default function SettingsGearButton({ inline }: Props) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[styles.button, !inline && { position: 'absolute', top: insets.top + spacing.sm, right: spacing.md, zIndex: 10 }]}
      onPress={() => navigation.navigate('Settings')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.icon}>⚙️</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: spacing.xs },
  icon: { fontSize: 20 },
});
