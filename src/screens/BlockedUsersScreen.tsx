import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { colors, spacing } from '../constants/theme';
import { unblockUser, getDisplayProfile } from '../services/userService';

export default function BlockedUsersScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { notify } = useDialog();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const blockedIds = profile?.blockedUserIds ?? [];

  // UID만으로는 누구를 차단했는지 알아볼 수 없어 해제 여부를 판단하기 어려웠다.
  // 목록을 열 때마다 닉네임을 조회해 채운다(캐시되므로 반복 조회 비용은 작다).
  const loadNicknames = useCallback(async () => {
    if (blockedIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const entries = await Promise.all(
        blockedIds.map(async (uid) => {
          const p = await getDisplayProfile(uid);
          return [uid, p?.nickname ?? '탈퇴한 사용자'] as const;
        })
      );
      setNicknames(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.blockedUserIds?.join(',')]);

  useFocusEffect(
    useCallback(() => {
      loadNicknames();
    }, [loadNicknames])
  );

  async function handleUnblock(targetUid: string) {
    if (!user) return;
    setBusyId(targetUid);
    try {
      await unblockUser(user.uid, targetUid);
      await refreshProfile();
    } catch (e: any) {
      await notify('오류', e?.message || '차단 해제에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
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
          <Text style={styles.nickname}>{nicknames[item] ?? '...'}</Text>
          <TouchableOpacity
            onPress={() => handleUnblock(item)}
            disabled={busyId === item}
            accessibilityRole="button"
            accessibilityLabel={`${nicknames[item] ?? '이 사용자'} 차단 해제`}
          >
            <Text style={styles.unblockText}>{busyId === item ? '처리 중...' : '차단 해제'}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  nickname: { color: colors.text, fontSize: 15, fontWeight: '600' },
  unblockText: { color: colors.primary, fontWeight: '600' },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
