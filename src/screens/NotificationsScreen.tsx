import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../constants/theme';
import { AppNotification } from '../types/models';
import { getNotifications, markAllRead } from '../services/inboxService';
import { getDisplayProfile } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Row extends AppNotification {
  actorNickname: string;
}

// post_*/comment_* 알림은 "OO님이 ~" 형태라 닉네임 뒤에 이어 붙는 문구를 담고,
// report_* 알림은 상대방이 아니라 운영 처리 결과를 알리는 것이라 그 자체로 완결된 문장을 담는다.
const MESSAGE: Record<AppNotification['type'], string> = {
  post_like: '님이 내 글에 좋아요를 눌렀어요',
  post_comment: '님이 내 글에 댓글을 남겼어요',
  comment_like: '님이 내 댓글에 좋아요를 눌렀어요',
  comment_reply: '님이 내 댓글에 답글을 남겼어요',
  report_resolved: '신고하신 콘텐츠를 검토해 삭제했어요',
  report_dismissed: '신고하신 콘텐츠를 검토했지만 문제가 없다고 판단했어요',
  content_removed: '올리신 글/댓글이 신고 검토 후 커뮤니티 정책 위반으로 삭제됐어요',
};

const ICON: Record<AppNotification['type'], string> = {
  post_like: '♥',
  post_comment: '💬',
  comment_like: '♥',
  comment_reply: '↩️',
  report_resolved: '🛡️',
  report_dismissed: '🛡️',
  content_removed: '🚫',
};

// report_resolved/content_removed는 콘텐츠가 이미 삭제된 뒤라 게시물로 이동해봤자 볼 게 없다.
const REPORT_TYPES = new Set<AppNotification['type']>(['report_resolved', 'report_dismissed', 'content_removed']);
const NON_NAVIGABLE_TYPES = new Set<AppNotification['type']>(['report_resolved', 'content_removed']);

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile, refreshUnreadNotifications } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getNotifications(user.uid);
      // 차단은 새 알림이 안 오게 막는 것과는 별개로, 차단하기 전에 이미 와 있던 알림도
      // 지금부터는 안 보이는 게 맞다(피드/캘린더에서 그 사람 글을 숨기는 것과 같은 원칙).
      const blockedIds = profile?.blockedUserIds ?? [];
      const visible = list.filter((n) => !blockedIds.includes(n.actorId));
      // getDisplayProfile이 같은 사람에 대한 동시 요청을 하나로 합쳐주므로
      // 같은 사람이 여러 번 알림을 보냈어도 조회는 한 번만 나간다.
      const withNicknames: Row[] = await Promise.all(
        visible.map(async (n) => {
          const actor = await getDisplayProfile(n.actorId);
          return { ...n, actorNickname: actor?.nickname ?? '알 수 없음' };
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
      renderItem={({ item }) => {
        const isReport = REPORT_TYPES.has(item.type);
        return (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.rowUnread]}
            disabled={NON_NAVIGABLE_TYPES.has(item.type)}
            onPress={() => {
              // report_dismissed는 콘텐츠가 그대로 남아 있어 이동이 의미 있지만,
              // report_resolved/content_removed는 이미 삭제된 뒤라 이동할 곳이 없다(disabled 처리).
              if (NON_NAVIGABLE_TYPES.has(item.type)) return;
              navigation.navigate('PostDetail', { postId: item.postId });
            }}
          >
            <Text style={styles.icon}>{ICON[item.type]}</Text>
            <View style={styles.textCol}>
              <Text style={styles.message}>
                {!isReport && <Text style={styles.nickname}>{item.actorNickname}</Text>}
                {MESSAGE[item.type]}
              </Text>
              <Text style={styles.date}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
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
