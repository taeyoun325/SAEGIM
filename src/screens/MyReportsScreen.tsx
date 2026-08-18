import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getMyReports } from '../services/reportService';
import { Report, ReportReason } from '../types/models';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

const REASON_LABELS: Record<ReportReason, string> = {
  spam: '스팸',
  abuse: '욕설/괴롭힘',
  inappropriate: '부적절한 콘텐츠',
  ad: '광고',
  other: '기타',
};

const STATUS_LABELS: Record<Report['status'], string> = {
  pending: '⏳ 검토 대기 중',
  reviewed: '✅ 처리 완료(삭제됨)',
  dismissed: '👀 검토함(문제없음)',
};

export default function MyReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setReports(await getMyReports(user.uid));
    } finally {
      setLoading(false);
    }
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
      contentContainerStyle={styles.list}
      data={reports}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>신고한 내역이 없어요.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.targetType}>{item.targetType === 'post' ? '게시물' : '댓글'} 신고</Text>
            <Text style={styles.date}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
          </View>
          <Text style={styles.reason}>사유: {REASON_LABELS[item.reason] ?? item.reason}</Text>
          <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  targetType: { color: colors.text, fontWeight: '700', fontSize: 14 },
  date: { color: colors.textSoft, fontSize: 12 },
  reason: { color: colors.textSoft, fontSize: 13, marginBottom: spacing.xs },
  status: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
