import { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Text from '../components/Text';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import { unblockUser } from '../services/userService';

export default function BlockedUsersScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const blockedIds = profile?.blockedUserIds ?? [];

  async function handleUnblock(targetUid: string) {
    if (!user) return;
    setBusyId(targetUid);
    try {
      await unblockUser(user.uid, targetUid);
      await refreshProfile();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={blockedIds}
      keyExtractor={(id) => id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>차단한 사용자가 없어요.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.uid}>{item}</Text>
          <TouchableOpacity onPress={() => handleUnblock(item)} disabled={busyId === item}>
            <Text style={styles.unblockText}>{busyId === item ? '처리 중...' : '차단 해제'}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  uid: { color: colors.textSoft, fontSize: 12 },
  unblockText: { color: colors.primary, fontWeight: '600' },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
