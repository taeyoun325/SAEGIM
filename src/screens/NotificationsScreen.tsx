import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../constants/theme';
import { AppNotification } from '../types/models';
import { getNotifications, markAllRead } from '../services/inboxService';
import { getUserProfile } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Row extends AppNotification {
  actorNickname: string;
}

const MESSAGE: Record<AppNotification['type'], string> = {
  post_like: '님이 내 글에 좋아요를 눌렀어요',
  post_comment: '님이 내 글에 댓글을 남겼어요',
  comment_like: '님이 내 댓글에 좋아요를 눌렀어요',
  comment_reply: '님이 내 댓글에 답글을 남겼어요',
};

const ICON: Record<AppNotification['type'], string> = {
  post_like: '♥',
  post_comment: '💬',
  comment_like: '♥',
  comment_reply: '↩️',
};

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, refreshUnreadNotifications } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getNotifications(user.uid);
      const nicknameCache = new Map<string, string>();
      const withNicknames: Row[] = await Promise.all(
        list.map(async (n) => {
          if (!nicknameCache.has(n.actorId)) {
            const actor = await getUserProfile(n.actorId);
            nicknameCache.set(n.actorId, actor?.nickname ?? '알 수 없음');
          }
          return { ...n, actorNickname: nicknameCache.get(n.actorId)! };
        })
      );
      setRows(withNicknames);

      // 알림함을 열면 그 시점의 알림을 모두 읽음 처리한다(받은메일함 패턴).
      await markAllRead(list);
      await refreshUnreadNotifications();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 알림이 없어요.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, !item.read && styles.rowUnread]}
          onPress={() => navigation.navigate('PostDetail', { postId: item.postId })}
        >
          <Text style={styles.icon}>{ICON[item.type]}</Text>
          <View style={styles.textCol}>
            <Text style={styles.message}>
              <Text style={styles.nickname}>{item.actorNickname}</Text>
              {MESSAGE[item.type]}
            </Text>
            <Text style={styles.date}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowUnread: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  icon: { fontSize: 20 },
  textCol: { flex: 1 },
  message: { color: colors.text, fontSize: 14, lineHeight: 20 },
  nickname: { fontWeight: '700', color: colors.primary },
  date: { color: colors.textSoft, fontSize: 11, marginTop: 2 },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
