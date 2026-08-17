import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import Text from './Text';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationBell() {
  const navigation = useNavigation<Nav>();
  const { unreadNotifications } = useAuth();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.icon}>🔔</Text>
      {unreadNotifications > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: spacing.xs },
  icon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
